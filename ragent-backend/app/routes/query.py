"""
routes/query.py
Query endpoints:
  POST /query/rag    – Direct RAG pipeline (stateless, no agent)
  POST /query/agent  – Agentic pipeline with server-managed session history
"""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.rag.pipeline import run_rag_pipeline
from app.agents.rag_agent import run_agent
from app.utils.validators import validate_query
from app.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter(prefix="/query", tags=["Query"])


# ── Request / Response schemas ────────────────────────────────────────────────
class QueryRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Natural-language question to ask the knowledge base.",
    )
    filenames: Optional[List[str]] = Field(
        default=None,
        description=(
            "Optional. Restrict retrieval to these specific files. "
            "Passed directly to the search filter. "
            "Leave null to search the entire knowledge base."
        ),
    )


class AgentQueryRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = Field(
        default=None,
        description=(
            "Optional. ID of an existing conversation session. "
            "When provided, the agent continues from where the last turn left off. "
            "When omitted, a new session is created and its ID is returned — "
            "pass it in subsequent requests to maintain conversation context."
        ),
    )
    filenames: Optional[List[str]] = Field(
        default=None,
        description=(
            "Optional. Filenames provided as additional context for the agent. "
            "The agent decides how to use them based on the question."
        ),
    )


class SourceRef(BaseModel):
    filename: str
    chunk_index: int


class RAGResponse(BaseModel):
    answer: str
    sources: List[SourceRef]
    scoped_to: Optional[List[str]] = Field(
        default=None,
        description="The filenames passed to the search filter for this query.",
    )


class AgentStep(BaseModel):
    tool: str
    input: Any
    output_preview: str


class AgentResponse(BaseModel):
    answer: str
    session_id: str = Field(
        description=(
            "Session ID for this conversation. "
            "Pass this in subsequent requests to continue the conversation."
        )
    )
    tools_used: List[str]
    steps: List[AgentStep]


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/rag", response_model=RAGResponse)
def query_rag(request: QueryRequest):
    """
    Direct Retrieval-Augmented Generation query. Stateless — no session, no memory.

    The `filenames` field is passed to the agent as context or scope.
    """
    try:
        question = validate_query(request.question)
        result = run_rag_pipeline(question, filenames=request.filenames)
        return RAGResponse(
            answer=result["answer"],
            sources=[SourceRef(**s) for s in result["sources"]],
            scoped_to=request.filenames or None,
        )
    except HTTPException:
        raise
    except Exception as e:
        log.error("Error in RAG pipeline: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process query.")


@router.post("/agent", response_model=AgentResponse)
def query_agent(request: AgentQueryRequest):
    """
    Agentic reasoning query with server-managed conversation memory.

    Session behaviour
    -----------------
    - First request: omit `session_id`. A new session is created and its ID
      is returned in the response.
    - Follow-up requests: pass the returned `session_id`. The agent will have
      full context of the prior conversation.
    - Sessions expire after 2 hours of inactivity.

    The client never sends message history — the server manages it entirely.
    """
    try:
        question = validate_query(request.question)
        result = run_agent(
            question,
            session_id=request.session_id,
            api_filenames=request.filenames,
        )
        return AgentResponse(
            answer=result["answer"],
            session_id=result["session_id"],
            tools_used=result["tools_used"],
            steps=[AgentStep(**s) for s in result["steps"]],
        )
    except HTTPException:
        raise
    except Exception as e:
        log.error("Error in agent pipeline: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process query.")
