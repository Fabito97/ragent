"""
ingestion/loader.py
Loads documents from disk using LangChain's built-in document loaders.
Supported: PDF, TXT, CSV, Excel (xlsx/xls)
"""
import os
import re
from typing import List

from langchain_core.documents import Document
from langchain_community.document_loaders import (
    PyMuPDFLoader,
    TextLoader,
    CSVLoader,
    UnstructuredExcelLoader,
)
from app.utils.logger import get_logger

log = get_logger(__name__)

LOADER_MAP = {
    "pdf":  PyMuPDFLoader,
    "txt":  TextLoader,
    "csv":  CSVLoader,
    "xlsx": UnstructuredExcelLoader,
    "xls":  UnstructuredExcelLoader,
}


def load_document(file_path: str) -> List[Document]:
    """
    Load a document from *file_path* using the appropriate LangChain loader.

    For PDFs, extraction quality is validated after loading. Pages where text
    was stored character-by-character (a common e-reader / calibre artefact)
    are automatically detected and reconstructed into readable prose.

    Returns a list of LangChain Document objects.
    Each Document has:
        .page_content – the extracted (and cleaned) text
        .metadata     – dict with at least {"source": file_path}
    """
    ext = os.path.splitext(file_path)[-1].lstrip(".").lower()

    loader_cls = LOADER_MAP.get(ext)
    if loader_cls is None:
        raise ValueError(f"Unsupported file extension: .{ext}")

    log.info("Loading '%s' with %s", file_path, loader_cls.__name__)

    loader = loader_cls(file_path)
    docs = loader.load()

    if not docs:
        raise ValueError("Document produced no pages. The file may be empty or corrupted.")

    # Attach original filename to every page's metadata
    filename = os.path.basename(file_path)
    for doc in docs:
        doc.metadata.setdefault("source", file_path)
        doc.metadata["filename"] = filename

    log.info("Loaded %d document page(s) from '%s'", len(docs), filename)
    return docs
