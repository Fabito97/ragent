"""
routes/documents.py
Document management endpoints:
  POST   /documents/upload            – Upload & ingest a document
  GET    /documents/                  – List all ingested documents
  GET    /documents/{filename}        – Get document info + all stored chunks
  GET    /documents/{filename}/download – Download the original file
  DELETE /documents/{filename}        – Remove a document from the knowledge base
"""
import os
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import settings
from app.ingestion.loader import load_document
from app.ingestion.chunker import chunk_documents
from app.retrieval.vector_store import (
    add_documents,
    list_documents,
    delete_document,
    get_chunks_by_filename,
)
from app.utils.validators import validate_file
from app.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter(prefix="/documents", tags=["Documents"])


# ── Response schemas ──────────────────────────────────────────────────────────
class UploadResponse(BaseModel):
    message: str
    filename: str
    pages_loaded: int
    chunks_stored: int

class DocumentSummary(BaseModel):
    filename: str
    chunks: int

class DocumentListResponse(BaseModel):
    total_chunks: int
    documents: List[DocumentSummary]


class ChunkInfo(BaseModel):
    chunk_index: int
    text: str
    source: str
    extra_metadata: Dict[str, Any]


class DocumentDetailResponse(BaseModel):
    filename: str
    total_chunks: int
    file_on_disk: bool
    disk_path: Optional[str]
    chunks: List[ChunkInfo]


class DeleteResponse(BaseModel):
    message: str
    filename: str
    chunks_removed: int


# ── Internal helper ───────────────────────────────────────────────────────────
def _find_disk_path(filename: str) -> Optional[str]:
    """
    Locate the physical file in the upload directory on the project root.
    Files are saved with a UUID prefix (e.g. 'a1b2c3d4_report.pdf'),
    so we scan for any file that ends with the original filename.
    Returns the full path if found, None otherwise.
    """
    try:
        for f in os.listdir(settings.UPLOAD_DIR):
            if f == filename or f.endswith(f"_{filename}"):
                return os.path.join(settings.UPLOAD_DIR, f)
    except OSError:
        pass
    return None


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a document (PDF, TXT, CSV, XLSX, XLS).

    Pipeline:
    1. Validate file type & size
    2. Save to disk
    3. Load with appropriate LangChain loader
    4. Split into overlapping chunks
    5. Embed and store in ChromaDB
    """
    content = await file.read()

    # 1. Validate
    validate_file(file, content)

    # 2. Save with a unique prefix to avoid collisions
    safe_name = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    save_path = os.path.join(settings.UPLOAD_DIR, safe_name)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    with open(save_path, "wb") as f:
        f.write(content)
    log.info("Saved upload: %s", save_path)

    try:
        # 3. Load document pages
        docs = load_document(save_path)

        # 4. Chunk
        chunks = chunk_documents(docs)

        # 5. Embed & store
        stored = add_documents(chunks)

        return UploadResponse(
            message="Document ingested successfully.",
            filename=file.filename,
            pages_loaded=len(docs),
            chunks_stored=stored,
        )
    except Exception as e:
        # Clean up on failure
        if os.path.exists(save_path):
            os.remove(save_path)
            log.info("Removed failed upload: %s", save_path)
        log.error("Failed to ingest document '%s': %s", file.filename, e, exc_info=True)
        raise HTTPException(status_code=422, detail=f"Could not process document: {e}")


@router.get("/", response_model=DocumentListResponse)
def get_documents():
    """List all documents currently stored in the knowledge base."""
    return list_documents()


@router.get("/{filename}", response_model=DocumentDetailResponse)
def get_document(filename: str):
    """
    Retrieve full details for a single document by its filename.

    Returns:
    - Basic file info (chunk count, whether the original file is still on disk)
    - Every stored text chunk in reading order (sorted by chunk_index)
    - The metadata attached to each chunk

    Useful for:
    - Inspecting what text was actually extracted and stored from a file
    - Debugging retrieval quality (seeing exactly what the LLM can access)
    - Verifying a document was ingested correctly before querying it
    """
    chunks = get_chunks_by_filename(filename)

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail=f"No document named '{filename}' found in the knowledge base.",
        )

    disk_path = _find_disk_path(filename)

    # Build the chunk list — separate known fields from any extra metadata
    chunk_list = []
    for doc in chunks:
        meta = doc.metadata.copy()
        chunk_index = meta.pop("chunk_index", -1)
        source = meta.pop("source", filename)
        # Remove internal fields we already surface at the top level
        meta.pop("filename", None)
        meta.pop("id", None)

        chunk_list.append(
            ChunkInfo(
                chunk_index=chunk_index,
                text=doc.page_content,
                source=source,
                extra_metadata=meta,
            )
        )

    return DocumentDetailResponse(
        filename=filename,
        total_chunks=len(chunk_list),
        file_on_disk=disk_path is not None,
        disk_path=disk_path,
        chunks=chunk_list,
    )


@router.delete("/{filename}", response_model=DeleteResponse)
def remove_document(filename: str):
    """
    Delete all vector-store chunks that belong to *filename*
    and remove the physical file from disk.
    """
    removed = delete_document(filename)

    # Remove physical file (best-effort)
    disk_path = _find_disk_path(filename)
    if disk_path:
        try:
            os.remove(disk_path)
            log.info("Removed file from disk: %s", disk_path)
        except OSError as e:
            log.warning("Could not remove file from disk: %s", e)

    if removed == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No document named '{filename}' found in the knowledge base.",
        )

    return DeleteResponse(
        message="Document removed successfully.",
        filename=filename,
        chunks_removed=removed,
    )


@router.get("/{filename}/download")
def download_document(filename: str):
    """
    Download the original uploaded file by its filename.

    Returns the raw file as a binary download — the same file the user
    originally uploaded, retrieved from the uploads directory on disk.

    Raises 404 if the original file is no longer on disk (it may have been
    manually removed, or the uploads directory cleared between restarts).
    """
    disk_path = _find_disk_path(filename)

    if not disk_path:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Original file '{filename}' is not on disk. "
                "The document may still exist in the knowledge base — "
                "use GET /documents/{filename} to inspect its stored chunks."
            ),
        )

    log.info("Serving file download: %s", disk_path)

    # FileResponse streams the file directly — no need to read it into memory
    return FileResponse(
        path=disk_path,
        filename=filename,          # sets Content-Disposition header
        media_type="application/octet-stream",
    )


@router.post("/{filename}/reingest", response_model=UploadResponse)
def reingest_document(filename: str):
    """
    Re-process and re-embed an already uploaded document.

    Use this after updating the ingestion logic (e.g. fixing PDF extraction)
    to replace stale chunks with freshly extracted, cleaned content.

    Pipeline:
    1. Locate the original file on disk
    2. Delete all existing chunks for this filename from ChromaDB
    3. Re-load, re-chunk, re-embed, and re-store
    """
    disk_path = _find_disk_path(filename)
    if not disk_path:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Original file '{filename}' is not on disk and cannot be re-ingested. "
                "Please upload the file again using POST /documents/upload."
            ),
        )

    # Remove stale chunks before re-ingesting
    removed = delete_document(filename)
    log.info("Removed %d stale chunk(s) for '%s' before re-ingestion", removed, filename)

    try:
        docs = load_document(disk_path)
    except Exception as exc:
        log.error("Failed to re-load '%s': %s", filename, exc)
        raise HTTPException(status_code=422, detail=f"Could not parse document: {exc}")

    chunks = chunk_documents(docs)
    stored = add_documents(chunks)

    return UploadResponse(
        message=f"Document re-ingested successfully. Replaced {removed} stale chunk(s).",
        filename=filename,
        pages_loaded=len(docs),
        chunks_stored=stored,
    )
