"""
routes/sessions.py
Session management endpoints:
  GET    /sessions/{session_id}         – Inspect a session's conversation history
  DELETE /sessions/{session_id}         – Delete a session
  GET    /sessions/stats                – Active session count (admin/debug)
"""
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.agents.session_store import session_store
from app.utils.logger import get_logger

log = get_logger(__name__)
router = APIRouter(prefix="/sessions", tags=["Sessions"])


# ── Response schemas ──────────────────────────────────────────────────────────
class MessageOut(BaseModel):
    role: str       # "user" or "assistant"
    content: str


class SessionDetailResponse(BaseModel):
    session_id: str
    turn_count: int
    history: List[MessageOut]


class SessionSummary(BaseModel):
    session_id: str
    message_count: int
    first_message: Optional[str]
    created_at: float
    last_active: float

class ListSessionsResponse(BaseModel):
    total: int
    sessions: List[SessionSummary]


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/", response_model=ListSessionsResponse)
def list_sessions():
    """
    List all active sessions with lightweight summary info.
    Returns session ID, message count, created_at, last_active and first message

    Use GET /sessions/{session_id}/messages to retrieve the full history of a session.
    """
    result = session_store.list_active()
    return ListSessionsResponse(
        total=len(result),
        sessions=result,
    )


@router.get("/{session_id}/messages", response_model=SessionDetailResponse)
def get_session(session_id: str):
    """
    Displays the full conversation history of a session.
    Useful for debugging or displaying in a client UI.
    """
    if not session_id or not session_id.strip():
        raise HTTPException(status_code=400, detail="Session ID must not be empty.")

    session = session_store.get(session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' not found or has expired.",
        )

    history = []
    for msg in session.history:
        role = "user" if msg.__class__.__name__ == "HumanMessage" else "assistant"
        history.append(MessageOut(role=role, content=msg.content))

    return SessionDetailResponse(
        session_id=session_id,
        turn_count=len(session.history) // 2,
        history=history,
    )


@router.delete("/{session_id}")
def delete_session(session_id: str):
    """Delete a session and all its conversation history."""
    if not session_id or not session_id.strip():
        raise HTTPException(status_code=400, detail="Session ID must not be empty.")

    existed = session_store.delete(session_id)
    if not existed:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    log.info("Deleted session: %s", session_id)
    return {"message": f"Session '{session_id}' deleted."}
