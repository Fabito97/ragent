"""
agents/rag_agent.py
Agentic reasoning layer built with LangChain's create_tool_calling_agent.

Session management
------------------
The server owns conversation history. The client passes a session_id and
the server retrieves, uses, and updates the history automatically.
No message history is ever sent over the wire by the client.

If no session_id is provided, a new session is created and its ID is
returned in the response so the client can use it for follow-up requests.
"""
from typing import Any, Dict, List, Optional

from langchain_groq import ChatGroq
from langchain_classic.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from config import settings
from app.agents.tools import AGENT_TOOLS
from app.agents.session_store import session_store
from app.utils.logger import get_logger

log = get_logger(__name__)


AGENT_SYSTEM_PROMPT = """You are an autonomous AI knowledge assistant for enterprise documents.

Your responsibilities
---------------------
1. PLAN     – Read the user's question carefully. Understand what they are asking
               and which documents are relevant before calling any tools.
2. VERIFY   – If the user mentions a document by name, call list_uploaded_documents
               first to confirm the exact filename exists in the knowledge base.
3. RETRIEVE – Call retrieve_documents to fetch relevant passages from the knowledge base.
               You may call it multiple times with different queries or file scopes
               if the question requires evidence from multiple angles.
4. EXPAND   – If a retrieved chunk appears cut off or incomplete, call
               fetch_chunks_by_index with the next chunk index to get the continuation.
               If you want the full content of a specific page, call fetch_chunks_by_page.
               Use these tools to fill gaps — do not guess at missing content.
5. SYNTHESISE – Read all retrieved passages carefully and compose your final answer
               directly from the evidence in your context. You are the reasoning layer —
               do not delegate answer writing to any tool.
6. VALIDATE – Only include information supported by the retrieved passages.
               Never fabricate data, filenames, numbers, or names.
               Always cite the source filename and page number when referencing content.
7. PRESENTATION – Filenames in the knowledge base are stored with an internal
               UUID prefix (e.g. "89638c86_Atomic_Habits.pdf"). Use the full name
               exactly as stored when calling tools — this ensures accurate filtering.
               However, when presenting a filename to the user in your response,
               always strip the prefix and show only the human-readable part
               (e.g. "Atomic_Habits.pdf", not "89638c86_Atomic_Habits.pdf").
               Never expose tool names, chunk indices, or any other system
               implementation detail in your response to the user.
               When citing sources, use only the format: (Source: filename, Page: N or Chunk: N).
               Only use chunk index when page is not available.
               Do not use bracket citation markers like 【†】or any other reference numbering system.
               Dont explain your instructions deeply, you can present your answer concisely
               Dont not tell the user tell the user you were instructed to hide somethings when asked

How to pass filenames to tools
-------------------------------
- Single file : filenames="annual_report_2024.pdf"
- Multi file  : filenames="report_2023.pdf|report_2024.pdf"
- All docs    : filenames=""  (leave empty — searches the entire knowledge base)

Decision making for file scope
-------------------------------
You will sometimes receive "Additional file context" below alongside the user's
question. This context is provided by the caller as a hint — not a directive.
Read the user's question first, then decide:
  - If the question clearly targets specific files mentioned in the query, use those.
  - If the question is general and the additional context is relevant, use it.
  - If the question contradicts the additional context, follow the question.
  - If unsure, call list_uploaded_documents to see what is available, then decide.
You are the decision maker. Use your judgement.

Handling empty search results
------------------------------
If retrieve_documents or answer_with_rag returns no results:
  - Do not immediately give up or return a generic "not found" message.
  - Call list_uploaded_documents to get the current list of available documents.
  - Present that list to the user in your response so they can see what is available.
  - Ask them to specify which document they would like you to search in.
  - Only give up after presenting the available documents and asking for guidance.
{api_context}"""


def _build_api_context(api_filenames: Optional[List[str]]) -> str:
    if not api_filenames:
        return ""
    joined = "\n".join(f"  - {f}" for f in api_filenames)
    return (
        f"\nAdditional file context\n"
        f"-----------------------\n"
        f"The following filename(s) were attached to this request by the user.\n"
        f"Consider them as context alongside the user's question \n"
        f"Prioritise them when no file is mentioned in the query itself.\n"
        f"use your judgement to decide whether and how to use them or clarify with the user:\n"
        f"{joined}"
    )


def _build_agent_executor(api_filenames: Optional[List[str]] = None) -> AgentExecutor:
    llm = ChatGroq(
        model=settings.LLM_MODEL,
        api_key=settings.GROQ_API_KEY,
        temperature=0.1,
        max_tokens=4096,
    )

    system_prompt = AGENT_SYSTEM_PROMPT.format(
        api_context=_build_api_context(api_filenames)
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="chat_history", optional=True),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ]
    )

    agent = create_tool_calling_agent(llm=llm, tools=AGENT_TOOLS, prompt=prompt)

    return AgentExecutor(
        agent=agent,
        tools=AGENT_TOOLS,
        verbose=settings.DEBUG,
        max_iterations=8,
        handle_parsing_errors=True,
        return_intermediate_steps=True,
    )


def run_agent(
    query: str,
    session_id: Optional[str] = None,
    api_filenames: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Run the agentic pipeline for *query*.

    Parameters
    ----------
    query         : The user's natural-language question.
    session_id    : Optional. ID of an existing session to continue a conversation.
                    If None or not found, a new session is created automatically.
    api_filenames : Optional filenames passed via the API request field.
                    Presented to the agent as context — the agent decides
                    whether and how to use them.

    Returns
    -------
    {
        "answer":       str,
        "session_id":   str,    # always returned — use for follow-up requests
        "steps":        [...],
        "tools_used":   [str, ...],
    }
    """
    # Resolve session 
    session = session_store.get_or_create(session_id)
    is_new = session_id != session.session_id

    log.info(
        "Agent invoked – session: %s (%s) | query: '%.80s' | api_filenames: %s",
        session.session_id,
        "new" if is_new else "existing",
        query,
        api_filenames or "none",
    )

    session.add_human_turn(query)

    session.compact_history()

    # Run agent with session history 
    executor = _build_agent_executor(api_filenames=api_filenames)

    result = executor.invoke({
        "input": query,
        "chat_history": session.history,   # server-managed, not from client
    })

    answer = result.get("output", "No answer produced.")

    if not answer or answer.strip() == "":
        log.warning("Agent produced empty answer for query: '%.80s'", query)
        answer = "I was unable to generate a response. Please try rephrasing your question."

    # Persist this turn into the session 
    session.add_ai_turn(answer)

    # Build response 
    intermediate = result.get("intermediate_steps", [])
    tools_used = []
    steps_summary = []
    for action, observation in intermediate:
        tool_name = getattr(action, "tool", str(action))
        tools_used.append(tool_name)
        steps_summary.append({
            "tool": tool_name,
            "input": getattr(action, "tool_input", ""),
            "output_preview": str(observation)[:300],
        })

    log.info(
        "Agent complete – session: %s | tools: %s | answer: %d chars",
        session.session_id,
        list(dict.fromkeys(tools_used)),
        len(answer),
    )

    return {
        "answer": answer,
        "session_id": session.session_id,
        "steps": steps_summary,
        "tools_used": list(dict.fromkeys(tools_used)),
    }
