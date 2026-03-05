"""
retrieval/vector_store.py
Manages the ChromaDB vector store via LangChain's Chroma integration.
Handles embedding generation, document storage, and similarity search.
"""
from typing import List, Optional, Tuple, Dict, Any

from langchain_core.documents import Document
from langchain_chroma import Chroma
try:
    from langchain_huggingface import HuggingFaceEmbeddings
except ImportError:
    from langchain_community.embeddings import HuggingFaceEmbeddings

from config import settings
from app.utils.logger import get_logger

log = get_logger(__name__)

# ── Singleton embedding model (loaded once) ───────────────────────────────────
_embeddings = None


def _get_embeddings() -> HuggingFaceEmbeddings:
    """Lazy-load the HuggingFace sentence-transformer embedding model."""
    global _embeddings
    if _embeddings is None:
        log.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
        _embeddings = HuggingFaceEmbeddings(
            model_name=settings.EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


# ── Singleton Chroma vector store ─────────────────────────────────────────────
_vector_store: Optional[Chroma] = None


def get_vector_store() -> Chroma:
    """Return (or initialise) the persistent ChromaDB vector store."""
    global _vector_store
    if _vector_store is None:
        log.info(
            "Initialising ChromaDB at '%s' (collection: %s)",
            settings.CHROMA_PERSIST_DIR,
            settings.CHROMA_COLLECTION_NAME,
        )
        _vector_store = Chroma(
            collection_name=settings.CHROMA_COLLECTION_NAME,
            embedding_function=_get_embeddings(),
            persist_directory=settings.CHROMA_PERSIST_DIR,
        )
    return _vector_store


def _build_filter(filenames: Optional[List[str]]) -> Optional[Dict[str, Any]]:
    """
    Build the correct ChromaDB metadata filter for 1, or many filenames.

    ChromaDB's filter parameter requires different shapes depending on count:
      - None / empty  → no filter (search everything)
      - 1 filename    → {"filename": "report.pdf"}           flat dict
      - 2+ filenames  → {"$or": [{"filename": "a.pdf"},      $or operator
                                  {"filename": "b.pdf"}]}

    The LangChain Chroma wrapper passes this dict straight to ChromaDB's
    `where` clause, which supports both forms.
    """
    if not filenames:
        return None
    if len(filenames) == 1:
        return {"filename": filenames[0]}
    # Multiple filenames — use ChromaDB's $or operator
    return {"$or": [{"filename": f} for f in filenames]}


def add_documents(chunks: List[Document]) -> int:
    """
    Embed *chunks* and store them in ChromaDB. Returns chunk count.
    """
    if not chunks:
        raise ValueError("Cannot add empty chunk list to vector store")

    store = get_vector_store()
    store.add_documents(chunks)
    count = len(chunks)
    log.info("Added %d chunk(s) to vector store.", count)
    return count


def similarity_search(
    query: str,
    k: Optional[int] = None,
    filenames: Optional[List[str]] = None,
) -> List[Document]:
    """
    Retrieve the top-k most similar document chunks for *query*.

    Parameters
    ----------
    query     : The natural-language search query.
    k         : Number of results to return. Defaults to settings.TOP_K_RESULTS.
    filenames : Optional list of filenames to restrict the search to.
                Pass one name to scope to a single file, multiple to search
                across a defined set. None searches the entire knowledge base.

    Filter shape is determined automatically:
      []        → no filter  (search everything)
      ["a.pdf"] → {"filename": "a.pdf"}
      ["a.pdf", "b.csv"] → {"$or": [{"filename": "a.pdf"}, {"filename": "b.csv"}]}
    """
    if not query or not query.strip():
        raise ValueError("Search query must not be empty")

    store = get_vector_store()
    top_k = k or settings.TOP_K_RESULTS
    file_filter = _build_filter(filenames)

    if filenames:
        log.info("Searching within %s for query: '%.80s'", filenames, query)
    else:
        log.info("Searching all documents for query: '%.80s'", query)

    results = store.similarity_search(query, k=top_k, filter=file_filter)
    log.info("Retrieved %d chunk(s)", len(results))
    return results


def similarity_search_with_score(
    query: str,
    k: Optional[int] = None,
    filenames: Optional[List[str]] = None,
) -> List[Tuple[Document, float]]:
    """
    Same as similarity_search but also returns relevance scores.
    Returns [(Document, score), ...] – lower score = more similar (L2 distance).
    """
    store = get_vector_store()
    top_k = k or settings.TOP_K_RESULTS
    file_filter = _build_filter(filenames)
    return store.similarity_search_with_score(query, k=top_k, filter=file_filter)


def get_chunks_by_index(
    filename: str,
    chunk_indices: List[int],
) -> List[Document]:
    """
    Fetch specific chunks from *filename* by their exact chunk_index values.
    Returns chunks sorted by chunk_index — order is guaranteed regardless
    of the order indices were requested in.
    """
    store = get_vector_store()
    collection = store._collection
    data = collection.get(include=["metadatas", "documents"])

    chunks = []
    index_set = set(chunk_indices)
    for doc_id, meta, text in zip(data["ids"], data["metadatas"], data["documents"]):
        if (
            meta.get("filename") == filename
            and meta.get("chunk_index") in index_set
        ):
            chunks.append(Document(page_content=text, metadata={**meta, "id": doc_id}))

    chunks.sort(key=lambda d: d.metadata.get("chunk_index", 0))
    return chunks


def get_chunks_by_page(
    filename: str,
    page: int,
) -> List[Document]:
    """
    Fetch all chunks from *filename* that belong to *page*.
    Page numbers are zero-indexed internally — pass the human-readable
    page number (1-based) and this function converts automatically.
    Returns chunks sorted by chunk_index.
    """
    store = get_vector_store()
    collection = store._collection
    data = collection.get(include=["metadatas", "documents"])

    # Page metadata is stored 0-indexed by PyPDF, convert from human-readable
    page_index = page - 1

    chunks = []
    for doc_id, meta, text in zip(data["ids"], data["metadatas"], data["documents"]):
        if (
            meta.get("filename") == filename
            and meta.get("page") == page_index
        ):
            chunks.append(Document(page_content=text, metadata={**meta, "id": doc_id}))

    chunks.sort(key=lambda d: d.metadata.get("chunk_index", 0))
    return chunks


def list_documents() -> dict:
    """
    Return total chunk count and a per-file breakdown of chunk counts.
    """
    store = get_vector_store()
    collection = store._collection  # internal ChromaDB collection
    data = collection.get(include=["metadatas"])

    file_chunks: dict = {}
    for meta in data["metadatas"]:
        filename = meta.get("filename", "unknown")
        file_chunks[filename] = file_chunks.get(filename, 0) + 1

    log.info("list_documents – %d unique file(s) found", len(file_chunks))

    return {
        "total_chunks": len(data["ids"]),
        "documents": [
            {"filename": f, "chunks": c}
            for f, c in sorted(file_chunks.items())
        ],
    }


def delete_document(filename: str) -> int:
    """
    Delete all chunks that belong to *filename*.
    Returns the number of chunks removed.
    """
    store = get_vector_store()
    collection = store._collection
    data = collection.get(include=["metadatas"])
    ids_to_delete = [
        doc_id
        for doc_id, meta in zip(data["ids"], data["metadatas"])
        if meta.get("filename") == filename
    ]
    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
        log.info("Deleted %d chunk(s) for file '%s'", len(ids_to_delete), filename)
    return len(ids_to_delete)


def get_chunks_by_filename(filename: str) -> List[Document]:
    """
    Return all stored chunks that belong to *filename*, ordered by chunk_index.
    Used by the document inspection route.
    """
    store = get_vector_store()
    collection = store._collection
    data = collection.get(include=["metadatas", "documents"])

    chunks = []
    for doc_id, meta, text in zip(
        data["ids"], data["metadatas"], data["documents"]
    ):
        if meta.get("filename") == filename:
            chunks.append(
                Document(page_content=text, metadata={**meta, "id": doc_id})
            )

    # Sort by chunk_index so the caller gets them in reading order
    chunks.sort(key=lambda d: d.metadata.get("chunk_index", 0))
    return chunks
