"""
routes/health.py
Health & status endpoints.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.retrieval.vector_store import list_documents
from config import settings

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    status: str
    llm_model: str
    embedding_model: str
    knowledge_base: dict


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Returns system health and current knowledge-base statistics."""
    kb = list_documents()
    return HealthResponse(
        status="ok",
        llm_model=settings.LLM_MODEL,
        embedding_model=settings.EMBEDDING_MODEL,
        knowledge_base=kb,
    )
