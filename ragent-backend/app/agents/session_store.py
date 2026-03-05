"""
agents/session_store.py
In-memory session store for managing agent conversation history.

Design
------
Sessions are keyed by a UUID session_id. Each session holds a list of
LangChain message objects (HumanMessage / AIMessage) that grows as the
conversation progresses. The server owns and manages this state — the
client only needs to pass a session_id.

A new session is created automatically when no session_id is provided.
Sessions expire after a configurable TTL of inactivity to prevent
unbounded memory growth.

Limitations
-----------
- In-process memory only. Sessions are lost on server restart.
- Not suitable for multi-worker deployments (each worker has its own store).
  For production, the dict can be swapped for Redis or a similar shared store.
"""
import uuid
import time
from typing import Dict, List, Optional

from langchain_core.messages import HumanMessage, AIMessage, BaseMessage

from app.utils.logger import get_logger

log = get_logger(__name__)

# Session TTL — sessions inactive longer than this are eligible for cleanup
SESSION_TTL_SECONDS = 60 * 60 * 2  # 2 hours


class Session:
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.history: List[BaseMessage] = []
        self.created_at = time.time()
        self.last_active = time.time()

    def add_human_turn(self, human: str) -> None:
        self.history.append(HumanMessage(content=human))
        self.last_active = time.time()

    def add_ai_turn(self, ai: str) -> None:
        self.history.append(AIMessage(content=ai))
        self.last_active = time.time()

    def is_expired(self) -> bool:
        return (time.time() - self.last_active) > SESSION_TTL_SECONDS


class SessionStore:
    def __init__(self):
        self._sessions: Dict[str, Session] = {}

    def create(self) -> Session:
        """Create a new session and return it."""
        session_id = str(uuid.uuid4())
        session = Session(session_id)
        self._sessions[session_id] = session
        log.info("Created session: %s", session_id)
        return session

    def get(self, session_id: str) -> Optional[Session]:
        """
        Return the session for *session_id*, or None if it doesn't exist
        or has expired.
        """
        session = self._sessions.get(session_id)
        if session is None:
            return None
        if session.is_expired():
            self.delete(session_id)
            log.info("Session expired and removed: %s", session_id)
            return None
        return session

    def get_or_create(self, session_id: Optional[str]) -> Session:
        """
        Return existing session if session_id is provided and valid,
        otherwise create and return a new one.
        """
        if session_id:
            session = self.get(session_id)
            if session:
                return session
            log.warning(
                "Session '%s' not found or expired — creating new session", session_id
            )
        return self.create()

    def delete(self, session_id: str) -> bool:
        """Delete a session. Returns True if it existed."""
        existed = session_id in self._sessions
        self._sessions.pop(session_id, None)
        return existed

    def cleanup_expired(self) -> int:
        """Remove all expired sessions in order not to bloat memory. Returns count removed."""
        expired = [sid for sid, s in self._sessions.items() if s.is_expired()]
        for sid in expired:
            del self._sessions[sid]
        if expired:
            log.info("Cleaned up %d expired session(s)", len(expired))
        return len(expired)

    def list_active(self) -> List[dict]:
        """
        Return a summary of all active (non-expired) sessions.
        Each entry contains id, message count, first_message, created_at, and last_active
        as Unix timestamps — no message content included.
        """
        self.cleanup_expired()
        return [
            {
                "session_id": s.session_id,
                "message_count": len(s.history),
                "first_message": s.history[0].content if s.history else None,
                "created_at": s.created_at,
                "last_active": s.last_active,
            }
            for s in self._sessions.values()
        ]


# ── Module-level singleton — one store for the entire application lifetime ────
session_store = SessionStore()
