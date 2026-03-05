"""
utils/validators.py – Input validation helpers (file & query).
"""
import os
from fastapi import HTTPException, UploadFile
from config import settings
from app.utils.logger import get_logger

log = get_logger(__name__)


def validate_file(file: UploadFile, content: bytes) -> None:
    """
    Validate uploaded file by extension and size.
    Raises HTTPException on failure so FastAPI returns a clean 400.
    """
    ext = os.path.splitext(file.filename or "")[-1].lstrip(".").lower()

    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '.{ext}' is not allowed. "
                   f"Supported types: {sorted(settings.ALLOWED_EXTENSIONS)}",
        )

    if len(content) > settings.MAX_FILE_SIZE_BYTES:
        max_mb = settings.MAX_FILE_SIZE_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the maximum allowed size of {max_mb} MB.",
        )

    log.info("File validated: %s (%d bytes)", file.filename, len(content))


def validate_query(query: str) -> str:
    """
    Basic guardrail on the user query.
    Returns the cleaned query or raises HTTPException.
    """
    query = query.strip()

    if not query:
        raise HTTPException(status_code=400, detail="Query must not be empty.")

    if len(query) > 2000:
        raise HTTPException(
            status_code=400,
            detail="Query is too long (max 2000 characters).",
        )

    # Block obviously malicious prompt-injection attempts
    injection_patterns = ["ignore previous instructions", "disregard all"]
    lower_q = query.lower()
    for pattern in injection_patterns:
        if pattern in lower_q:
            raise HTTPException(
                status_code=400,
                detail="Query contains disallowed content.",
            )

    return query
