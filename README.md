# Enterprise RAG Agent – Technical Documentation

## Table of Contents
1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Project Structure](#3-project-structure)
4. [Agent Roles & Reasoning Flow](#4-agent-roles--reasoning-flow)
5. [System Setup](#5-system-setup)
6. [API Reference](#6-api-reference)
7. [Configuration Reference](#7-configuration-reference)
8. [Deployment Guide](#8-deployment-guide)
9. [Limitations & Challenges](#9-limitations--challenges)

---

## 1. Overview

This application is an AI-powered document knowledge base that combines:
- **LangChain** – orchestration framework for agents, chains, loaders, and splitters
- **Retrieval-Augmented Generation (RAG)** – grounds LLM answers in uploaded documents
- **Agentic AI** – autonomous multi-step reasoning using tool-calling agents
- **ChromaDB** – persistent local vector database for semantic search
- **Groq GPT** – LLM backbone for reasoning and generation
- **FastAPI** – high-performance async REST API layer

Users upload documents in PDF, TXT, CSV, or Excel format. They can then ask natural-language questions. The system retrieves relevant content and generates grounded, citation-backed answers.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      FastAPI REST API                        │
│  POST /documents/upload   GET /documents/   POST /query/rag  │
│  GET /documents/{f}       GET /health       POST /query/agent|
│  DELETE /documents/{f}    GET /documents/{f}/download        |
└────────────┬─────────────────────┬───────────────────────────┘
             │                     │
     ┌───────▼──────┐     ┌────────▼────────────────────────┐
     │  Ingestion   │     │        Query Layer              │
     │  Pipeline    │     │                                 │
     │              │     │  ┌──────────┐  ┌─────────────┐  │
     │ 1. Load doc  │     │  │  RAG     │  │  Agent      │  │
     │    (LangChain│     │  │  Chain   │  │  Executor   │  │
     │    loaders)  │     │  │  (LCEL)  │  │  (Tool-call)│  │
     │ 2. Chunk     │     │  └────┬─────┘  └──────┬──────┘  │
     │    (RecChar  │     │       │                │        │
     │    Splitter) │     │       └────────┬───────┘        │
     │ 3. Embed &   │     │                │                │
     │    Store     │     │       ┌────────▼──────────┐     │
     └──────┬───────┘     │       │  Retrieval Layer  |     │
            │             │       │  (ChromaDB +      │     │
            └─────────────┼──────►│  HuggingFace      │     │
                          │       │  Embeddings)      │     │
                          │       └────────┬──────────┘     │
                          │                │                │
                          │       ┌────────▼──────────┐     │
                          │       │  LLM Layer        │     │
                          │       │  (Claude via      │     │
                          │       │  LangChain-       │     │
                          │       │  Anthropic)       │     │
                          │       └───────────────────┘     │
                          └─────────────────────────────────┘
```

### Key Design Decisions
| Decision | Choice | Reason |
|---|---|---|
| Vector DB | ChromaDB | Local persistent store, no extra infra needed |
| Embeddings | `all-MiniLM-L6-v2` (HuggingFace) | Fast, free, runs on CPU |
| LLM | Groq (openai/gpt-oss-120b) | Ultra-fast inference, free tier, OpenAI-compatible |
| Agent type | Tool-calling agent (LangChain) | Native tool-use API, clean intermediate steps |
| Chain style | LCEL (LangChain Expression Language) | Composable, readable, type-safe |

---

## 3. Project Structure

```
rag_agent/
├── main.py                   # FastAPI app, router registration, global error handler
├── config.py                 # All settings loaded from .env
├── requirements.txt          # Python dependencies
├── .env.example              # Environment variable template
├── DOCUMENTATION.md          # This file
│
├── app/
│   ├── ingestion/
│   │   ├── loader.py         # LangChain document loaders (PDF/TXT/CSV/Excel)
│   │   └── chunker.py        # RecursiveCharacterTextSplitter wrapper
│   │
│   ├── retrieval/
│   │   └── vector_store.py   # ChromaDB + HuggingFace embeddings (CRUD + search)
│   │
│   ├── rag/
│   │   └── pipeline.py       # LCEL RAG chain (retrieve → prompt → LLM → parse)
│   │
│   ├── agents/
│   │   ├── tools.py          # LangChain @tool definitions (retrieve, rag, list)
│   │   └── rag_agent.py      # AgentExecutor with tool-calling, multi-turn support
│   │
│   ├── routes/
│   │   ├── health.py         # GET /health
│   │   ├── documents.py      # POST/GET/DELETE /documents/
│   │   └── query.py          # POST /query/rag  POST /query/agent
│   │
│   └── utils/
│       ├── logger.py         # Centralised logging
│       └── validators.py     # File & query validation / guardrails
│
├── uploads/                  # Uploaded files stored here
└── chroma_db/                # ChromaDB persistence directory
```

---

## 4. Agent Roles & Reasoning Flow

### Orchestrator Agent (`rag_agent.py`)
- **Role**: Plans which tools to call based on the user's question
- **Model**: GPT (via `Groq`)
- **Framework**: `create_tool_calling_agent` + `AgentExecutor`
- **Max iterations**: 6 (safety cap to prevent infinite loops)

### Agent Tools (`tools.py`)
| Tool | Purpose |
|---|---|
| `retrieve_documents` | Fetch raw relevant passages from ChromaDB |
| `answer_with_rag` | Generate full LLM-synthesised answer using RAG pipeline |
| `list_uploaded_documents` | Show what documents are in the knowledge base |

### Reasoning Flow
```
User Question
    │
    ▼
Agent Plans → calls retrieve_documents(query)
    │
    ▼
Agent Reviews chunks → calls answer_with_rag(query)
    │                    (for complex questions: may call retrieve again)
    ▼
Agent Validates answer (is it grounded? complete?)
    │
    ▼
Final Answer + Steps + Tools Used → returned to API caller
```

### RAG vs Agent endpoint
| | `/query/rag` | `/query/agent` |
|---|---|---|
| Reasoning | Fixed 1-step pipeline | Multi-step autonomous |
| Speed | Faster | Slower (more LLM calls) |
| Transparency | Source list | Full step trace |
| Best for | Simple factual queries | Complex multi-hop questions |

---

## 5. System Setup

### Prerequisites
- Python 3.11+
- Groq API key

### Installation

```bash
# 1. Clone / extract the project
cd rag_agent

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=your_key_here

# 5. Start the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Verify installation
Open `http://localhost:8000/docs` for the interactive Swagger UI.

---

## 6. API Reference

### `GET /health`
Returns system status and knowledge-base statistics.

**Response**
```json
{
  "status": "ok",
  "llm_model": "openai/gpt-oss-120b",
  "embedding_model": "all-MiniLM-L6-v2",
  "knowledge_base": { "total_chunks": 42, "documents": ["report.pdf"] }
}
```

---

### `POST /documents/upload`
Upload and ingest a document into the knowledge base.

**Request**: `multipart/form-data` with field `file`.

**Supported formats**: `pdf`, `txt`, `csv`, `xlsx`, `xls`

**Response**
```json
{
  "message": "Document ingested successfully.",
  "filename": "report.pdf",
  "pages_loaded": 12,
  "chunks_stored": 47
}
```

---

### `GET /documents/`
List all documents in the knowledge base.

**Response**
```json
{
  "total_chunks": 47,
  "documents": ["report.pdf", "data.csv"]
}
```

---

### `DELETE /documents/{filename}`
Remove a document and all its chunks from the knowledge base.

**Response**
```json
{
  "message": "Document removed successfully.",
  "filename": "report.pdf",
  "chunks_removed": 47
}
```

---

### `POST /query/rag`
Direct RAG query — fast, fixed pipeline.

**Request**
```json
{ "question": "What were the Q3 revenue figures?" }
```

**Response**
```json
{
  "answer": "According to the uploaded report, Q3 revenue was $4.2M...",
  "sources": [
    { "filename": "report.pdf", "chunk_index": 12 }
  ]
}
```

---

### `POST /query/agent`
Agentic query — autonomous multi-step reasoning.

**Request**
```json
{
  "question": "Compare the risk factors in the 2023 and 2024 annual reports.",
  "chat_history": [
    { "role": "human", "content": "I uploaded both annual reports." },
    { "role": "ai",    "content": "Great, I can see them in the knowledge base." }
  ]
}
```

**Response**
```json
{
  "answer": "Based on both reports, the 2024 filing highlights...",
  "tools_used": ["retrieve_documents", "answer_with_rag"],
  "steps": [
    {
      "tool": "retrieve_documents",
      "input": "risk factors 2023",
      "output_preview": "[Chunk 1 | Source: 2023_annual.pdf]\nRisk factor..."
    }
  ]
}
```

---

## 7. Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | _(required)_ | Your Groq API key (free at console.groq.com) |
| `LLM_MODEL` | `openai/gpt-oss-120b` | Groq model to use |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Sentence-transformer model |
| `UPLOAD_DIR` | `./uploads` | Where uploaded files are saved |
| `CHROMA_PERSIST_DIR` | `./chroma_db` | ChromaDB persistence directory |
| `CHROMA_COLLECTION_NAME` | `enterprise_docs` | ChromaDB collection name |
| `CHUNK_SIZE` | `800` | Characters per chunk |
| `CHUNK_OVERLAP` | `150` | Overlap between adjacent chunks |
| `TOP_K_RESULTS` | `5` | Chunks retrieved per query |
| `MAX_FILE_SIZE_MB` | `50` | Maximum upload size |
| `ALLOWED_EXTENSIONS` | `pdf,txt,csv,xlsx,xls` | Permitted file types |
| `DEBUG` | `false` | Enable verbose agent logging |

---

## 8. Deployment Guide

### Local (development)
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Production (Gunicorn + Uvicorn workers)
```bash
pip install gunicorn
gunicorn main:app -k uvicorn.workers.UvicornWorker -w 2 -b 0.0.0.0:8000
```

### Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t rag-agent .
docker run -e GROQ_API_KEY=your_key -p 8000:8000 rag-agent
```

### Environment variables in production
Never commit `.env` to source control. Use:
- Docker `--env-file` or `-e` flags
- Cloud provider secret managers (AWS Secrets Manager, GCP Secret Manager)
- Platform environment variable settings (Railway, Render, Fly.io)

---

## 9. Limitations & Challenges

### Limitations
| Area | Limitation |
|---|---|
| **Memory** | ChromaDB is local; not suited for multi-server deployments without a shared volume |
| **Embeddings** | `all-MiniLM-L6-v2` is English-optimised; multilingual docs may have lower recall |
| **File size** | Very large documents (>50 MB) increase ingestion time significantly |
| **Tables** | Complex multi-column tables in PDFs may not parse cleanly with PyPDF |
| **Images** | Image content within PDFs (charts, diagrams) is not extracted |
| **Context window** | Long documents are chunked; cross-chunk reasoning requires agent multi-hop calls |
| **Concurrency** | Singleton vector store may have race conditions under heavy parallel writes |

### Challenges Encountered
1. **Prompt injection** – Mitigated with query validation that rejects known injection patterns.
2. **Hallucination** – System prompt strictly instructs the LLM to only use provided context. Temperature is set to 0.1–0.2 for factual grounding.
3. **Chunk boundary splitting** – Answers sometimes span two chunks. Solved with `CHUNK_OVERLAP=150` to ensure no information is lost at boundaries.
4. **Agent infinite loops** – Mitigated by setting `max_iterations=6` on the AgentExecutor.
5. **Cold start latency** – Embedding model download (~90 MB) on first run. Subsequent starts use the cached model.

### Future Improvements
- Add a re-ranking step (cross-encoder) after initial retrieval for higher precision
- Support for tables and OCR for scanned PDF documents
- Add authentication (API key or OAuth2) to the FastAPI routes
- Implement query caching to avoid redundant LLM calls for repeated questions
- Add a `/query/stream` endpoint using Server-Sent Events for streaming responses
