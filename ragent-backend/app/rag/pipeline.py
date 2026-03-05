"""
rag/pipeline.py
Retrieval-Augmented Generation (RAG) pipeline built with LangChain LCEL.

Flow:
  query → retrieve relevant chunks → build prompt → LLM → answer
"""
from typing import Any, Dict, List, Optional

from langchain_groq import ChatGroq
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from config import settings
from app.retrieval.vector_store import similarity_search
from app.utils.logger import get_logger

log = get_logger(__name__)

_llm = None


def _get_llm() -> ChatGroq:
    global _llm
    if _llm is None:
        _llm = ChatGroq(
            model=settings.LLM_MODEL,
            api_key=settings.GROQ_API_KEY,
            temperature=0.2,
            max_tokens=2048,
        )
    return _llm


RAG_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are an expert enterprise knowledge assistant.
Your job is to answer user questions ONLY using the provided document context.

Rules:
1. Answer solely from the context below – do NOT use outside knowledge.
2. If the answer is not in the context, say "I could not find relevant information in the uploaded documents."
3. Be concise, factual, and cite the source document when possible.
4. Never fabricate facts, numbers, or names.

Context:
{context}
""",
        ),
        ("human", "{question}"),
    ]
)


def _format_context(docs: List[Document]) -> str:
    if not docs:
        return "No relevant context found."
    parts = []
    for i, doc in enumerate(docs, 1):
        src = doc.metadata.get("filename", doc.metadata.get("source", "unknown"))
        parts.append(f"[{i}] Source: {src}\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)


def run_rag_pipeline(
    query: str,
    filenames: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Execute the RAG pipeline for *query*.

    Parameters
    ----------
    query     : The user's natural-language question.
    filenames : Optional list of filenames to restrict retrieval to.
                Accepts one or many. None searches the entire knowledge base.

    Returns
    -------
    {
        "answer":    str,
        "sources":   [{"filename": str, "chunk_index": int}, ...],
        "scoped_to": List[str] | None,
    }
    """
    log.info(
        "RAG pipeline – query: '%.80s'%s",
        query,
        f" [scoped to: {filenames}]" if filenames else "",
    )

    retrieved_docs = similarity_search(query, filenames=filenames)

    if not retrieved_docs:
        msg = (
            f"I could not find relevant information in {filenames}."
            if filenames
            else "I could not find relevant information in the uploaded documents."
        )
        return {"answer": msg, "sources": [], "scoped_to": filenames}

    context = _format_context(retrieved_docs)
    prompt_value = RAG_PROMPT.invoke({"context": context, "question": query})
    raw_response = _get_llm().invoke(prompt_value)
    answer = StrOutputParser().invoke(raw_response)

    sources = [
        {
            "filename": d.metadata.get("filename", "unknown"),
            "chunk_index": d.metadata.get("chunk_index", -1),
        }
        for d in retrieved_docs
    ]

    log.info("RAG pipeline complete – answer length: %d chars", len(answer))
    return {"answer": answer, "sources": sources, "scoped_to": filenames}
