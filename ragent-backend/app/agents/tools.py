"""
agents/tools.py
LangChain Tool definitions that the agent can call.

four tools only:
  - retrieve_documents     : Searches ChromaDB and returns raw text passages.
                             The agent reads these and synthesises the answer itself.
  - list_uploaded_documents: Lists all files in the knowledge base.
  - fetch_chunks_by_index: Gets a particular chunk by its index
  - fetch_chunks_by_page: Gets all chunks of a particular page
"""
from typing import List, Optional

from langchain.tools import tool

import re

from app.retrieval.vector_store import similarity_search, list_documents, get_chunks_by_index, get_chunks_by_page
from app.utils.logger import get_logger

log = get_logger(__name__)


def _parse_filenames(raw: Optional[str]) -> Optional[List[str]]:
    """
    Parse a pipe-separated filename string into a list.
    Returns None (search everything) if input is empty or whitespace.

    "report.pdf"                 → ["report.pdf"]
    "report.pdf|summary.csv"     → ["report.pdf", "summary.csv"]
    "" / None                    → None
    """
    if not raw or not raw.strip():
        return None
    parts = [p.strip() for p in raw.split("|") if p.strip()]
    return parts if parts else None



@tool
def retrieve_documents(query: str, filenames: str = "") -> str:
    """
    Search the knowledge base for document chunks relevant to the query.
    Returns the top matching text passages with their source filenames.

    Parameters
    ----------
    query     : The search question or topic to look for.
    filenames : Optional. Pipe-separated filenames to restrict the search to.
                Use the exact filename as returned by list_uploaded_documents.
                Leave empty to search all documents.
                  Single file → "89638c86_Atomic_Habits.pdf"
                  Multi file  → "89638c86_Atomic_Habits.pdf|a1b2c3d4_report.pdf"

    After receiving results, read the passages carefully and compose your
    answer directly from the evidence. Do not call any other tool to
    generate the answer — that is your job as the reasoning agent.
    """
    parsed = _parse_filenames(filenames)
    docs = similarity_search(query, filenames=parsed)

    if not docs:
        scope = f" in {parsed}" if parsed else ""
        return f"No relevant chunks found for this query{scope}."

    parts = []
    for doc in docs:
        src = doc.metadata.get("filename", "unknown")
        idx = doc.metadata.get("chunk_index", "?")
        page = doc.metadata.get("page")
        page_info = f" | Page: {page + 1}" if page is not None else ""
        parts.append(f"[Chunk {idx} | Source: {src}{page_info}]\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)


@tool
def list_uploaded_documents(dummy: str = "") -> str:
    """
    List all documents currently stored in the knowledge base.
    Returns exact filenames (as stored) and chunk count per file.

    Call this when:
    - The user mentions a document by name — use the exact filename returned
      here when calling retrieve_documents or the positional fetch tools.
    - A search returns no results — show the user what is available and
      ask them to specify which document to look into.
    """
    info = list_documents()
    doc_list = "\n".join(
        f"  - {d['filename']} ({d['chunks']} chunks)"
        for d in info["documents"]
    ) or "  (none)"
    return (
        f"Total chunks in knowledge base: {info['total_chunks']}\n"
        f"Documents:\n{doc_list}"
    )


@tool
def fetch_chunks_by_index(filename: str, chunk_indices: str) -> str:
    """
    Fetch specific chunks from a document by their chunk index.
    Use this when a retrieved chunk appears incomplete or cut off —
    request the next index to get the continuation.

    Parameters
    ----------
    filename      : Exact filename as returned by list_uploaded_documents.
    chunk_indices : Comma-separated chunk indices to fetch.
                    Example: "5,6" fetches chunks 5 and 6 in order.

    When to use
    -----------
    - A chunk ends mid-sentence or mid-argument → fetch index + 1
    - You want surrounding context for a specific chunk → fetch index - 1 and index + 1
    """
    try:
        indices = [int(i.strip()) for i in chunk_indices.split(",") if i.strip()]
    except ValueError:
        return "Invalid chunk_indices format. Use comma-separated integers e.g. '5,6'."

    if not indices:
        return "No chunk indices provided."

    docs = get_chunks_by_index(filename, indices)

    if not docs:
        return f"No chunks found for indices {indices} in '{filename}'."

    parts = []
    for doc in docs:
        idx = doc.metadata.get("chunk_index", "?")
        page = doc.metadata.get("page")
        page_info = f" | Page: {page + 1}" if page is not None else ""
        src = doc.metadata.get("filename", "unknown")
        parts.append(f"[Chunk {idx} | Source: {src}{page_info}]\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)


@tool
def fetch_chunks_by_page(filename: str, page: int) -> str:
    """
    Fetch all chunks from a specific page of a document.
    Use this when you want the complete content of a known page rather
    than relying on semantic search to find relevant passages.

    Parameters
    ----------
    filename : Exact filename as returned by list_uploaded_documents.
    page     : The human-readable page number (1-based, as printed in the book/document).

    When to use
    -----------
    - The user asks about a specific page number
    - You want full page context rather than semantically selected chunks
    - Retrieved chunks reference a page you want to explore fully
    """
    if page < 1:
        return "Page number must be 1 or greater."



    docs = get_chunks_by_page(filename, page)

    if not docs:
        return f"No chunks found on page {page} of '{filename}'."

    parts = []
    for doc in docs:
        idx = doc.metadata.get("chunk_index", "?")
        src = doc.metadata.get("filename", "unknown")
        parts.append(f"[Chunk index {idx} | Source: {src} | Page: {page}]\n{doc.page_content}")
    return "\n\n---\n\n".join(parts)


AGENT_TOOLS = [retrieve_documents, list_uploaded_documents, fetch_chunks_by_page, fetch_chunks_by_index]
