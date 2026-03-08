"""
config.py – Central configuration loaded from .env file.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "llama3-70b-8192")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    APP_HOST: str = os.getenv("APP_HOST", "0.0.0.0")
    APP_PORT: int = int(os.getenv("APP_PORT", 8000))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    CHROMA_PERSIST_DIR: str = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
    CHROMA_COLLECTION_NAME: str = os.getenv("CHROMA_COLLECTION_NAME", "enterprise_docs")

    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", 800))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", 150))
    TOP_K_RESULTS: int = int(os.getenv("TOP_K_RESULTS", 5))

    MAX_FILE_SIZE_BYTES: int = int(os.getenv("MAX_FILE_SIZE_MB", 50)) * 1024 * 1024
    ALLOWED_EXTENSIONS: set = set(
        os.getenv("ALLOWED_EXTENSIONS", "pdf,txt,csv,xlsx,xls,docx").split(",")
    )


settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
