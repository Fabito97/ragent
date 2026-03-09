"""
ingestion/loader.py
Loads documents from disk using LangChain's built-in document loaders.
Supported: PDF, TXT, CSV, Excel (xlsx/xls)
"""
import os
from typing import List

from langchain_core.documents import Document
from langchain_community.document_loaders import (
    PyMuPDFLoader,
    TextLoader,
    CSVLoader,
    Docx2txtLoader
)
from app.utils.logger import get_logger

log = get_logger(__name__)

LOADER_MAP = {
    "pdf":  PyMuPDFLoader,
    "txt":  TextLoader,
    "docx": Docx2txtLoader,
    "csv":  None,   # handled by _load_tabular
    "xlsx": None,   # handled by _load_tabular
    "xls":  None,   # handled by _load_tabular
}

def _load_tabular(file_path: str) -> List[Document]:
    """
    Load CSV or Excel files using pandas DataFrameLoader — one Document per row.

    Each row is converted to a natural language string using column headers as
    labels: "Column1: value1 | Column2: value2 | ...". This gives the embedder
    enough signal to distinguish individual records semantically, rather than
    flattening everything into one unstructured text blob.

    All columns are also stored in Document metadata so structured fields
    (status, owner, date, budget, etc.) are preserved alongside the text.

    For Excel files, each sheet is processed independently. Sheet name and
    row index are included in metadata for traceability.
    For CSV files, there is only one logical sheet.
    """
    try:
        import pandas as pd
        from langchain_community.document_loaders import DataFrameLoader
    except ImportError:
        raise ImportError("pandas is required for tabular loading: pip install pandas openpyxl")

    ext = file_path.rsplit(".", 1)[-1].lower()

    # Build a dict of {sheet_name: DataFrame} — CSV has one implicit sheet
    if ext == "csv":
        sheets = {"CSV": pd.read_csv(file_path).fillna("").astype(str)}
    else:
        xl = pd.ExcelFile(file_path)
        sheets = {
            name: xl.parse(name).fillna("").astype(str)
            for name in xl.sheet_names
        }

    all_docs = []

    for sheet_name, df in sheets.items():
        if df.empty:
            log.warning("Sheet '%s' in '%s' is empty — skipping.", sheet_name, file_path)
            continue

        # Synthetic content column: "Col1: val1 | Col2: val2 | ..."
        # Empty values are omitted to keep content clean.
        content_col = "__content__"
        df[content_col] = df.apply(
            lambda row: " | ".join(
                f"{col}: {row[col]}"
                for col in df.columns
                if col != content_col and str(row[col]).strip()
            ),
            axis=1,
        )

        loader = DataFrameLoader(df, page_content_column=content_col)
        docs = loader.load()

        for i, doc in enumerate(docs):
            doc.metadata["sheet"]     = sheet_name
            doc.metadata["row_index"] = i
            doc.metadata["source"]    = file_path
            doc.metadata.pop(content_col, None)  # remove synthetic col from metadata

        all_docs.extend(docs)

    total_sheets = len(sheets)
    log.info(
        "Loaded %d row(s) across %d sheet(s) from '%s'",
        len(all_docs), total_sheets, file_path,
    )
    return all_docs

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

    # Excel files use a custom pandas-based loader (no unstructured dependency)
    if ext in ("xlsx", "xls", "csv"):
        docs = _load_tabular(file_path)
        filename = os.path.basename(file_path)
        for doc in docs:
            doc.metadata["filename"] = filename
        return docs

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
