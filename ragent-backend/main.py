"""
main.py – FastAPI application entry point.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from app.routes.health import router as health_router
from app.routes.documents import router as documents_router
from app.routes.query import router as query_router
from app.routes.sessions import router as sessions_router
from app.utils.logger import get_logger

log = get_logger("main")

# ── Application ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="RAG Agent API",
    description=(
        "AI-powered document knowledge base. "
        "Upload documents (PDF, TXT, CSV, Excel) and query them "
        "using RAG or an autonomous AI agent."
    ),
    version="1.0.0",
    docs_url="/docs",       # Swagger UI
    redoc_url="/redoc",     # ReDoc UI
)

# ── CORS (adjust origins for production) ─────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error("Unhandled exception on %s: %s", request.url, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(documents_router)
app.include_router(query_router)
app.include_router(sessions_router)


# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
def root():
    return {
        "message": "RAG Agent API is running.",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "upload_document": "POST /documents/upload",
            "list_documents":  "GET  /documents/",
            "get_document": "GET /documents/{filename}",
            "delete_document": "DELETE /documents/{filename}",
            "query_rag":       "POST /query/rag",
            "query_agent":     "POST /query/agent",
            "list_active_sessions":   "GET /sessions/",
            "session_history": "GET  /sessions/{session_id}",
            "delete_session":  "DELETE /sessions/{session_id}",
            },
    }


# ── Dev runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    log.info("Starting server on %s:%s", settings.APP_HOST, settings.APP_PORT)
    uvicorn.run(
        "main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.DEBUG,
    )
