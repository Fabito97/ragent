"""
ingestion/chunker.py
Splits LangChain Documents into smaller overlapping chunks
using LangChain's RecursiveCharacterTextSplitter.
"""
from typing import List

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import settings
from app.utils.logger import get_logger

log = get_logger(__name__)


def chunk_documents(docs: List[Document]) -> List[Document]:
    """
    Split a list of LangChain Documents into smaller chunks.

    Uses RecursiveCharacterTextSplitter which tries to split on
    natural boundaries (paragraphs → sentences → words → chars)
    before falling back to a hard character cut.

    Returns a new list of Document objects with an extra
    metadata key ``chunk_index`` indicating the chunk's position.
    """
    if not docs:
        raise ValueError("Cannot chunk empty document list")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        length_function=len,
        # Prefer splitting at paragraph breaks first
        separators=["\n\n", "\n", " ", ""],
    )

    chunks = splitter.split_documents(docs)

    if not chunks:
        raise ValueError("Chunking produced no text chunks.")

    # Add chunk index to metadata so we can trace back the original document
    for idx, chunk in enumerate(chunks):
        chunk.metadata["chunk_index"] = idx

    log.info(
        "Chunked %d document page(s) into %d chunk(s) "
        "(size=%d, overlap=%d)",
        len(docs),
        len(chunks),
        settings.CHUNK_SIZE,
        settings.CHUNK_OVERLAP,
    )
    return chunks
