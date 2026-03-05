# Design Decisions & Rationale

This document captures the key technical choices made during the development of the RAG Agent system. It explains the selected packages, architectural patterns, model choices, and how the agent orchestration works.

---

## Backend Framework

- **FastAPI** – chosen for its high performance (Starlette/ASGI), automatic OpenAPI generation, and developer ergonomics (Pydantic models). The async nature aligns with concurrent vector store access and external HTTP calls to the LLM provider.

## Language Models & Embeddings

- **LLM: Groq (`openai/gpt-oss-120b` or similar)**
  - Selected for its OpenAI-compatible API, free tier, and low latency inference running on Groq hardware.
  - Using the LangChain Groq wrapper allows seamless integration with the rest of the LangChain ecosystem.
  - Temperature default set to 0.1–0.2 to minimise hallucinations; `max_tokens` configured via environment.

- **Embeddings: `all-MiniLM-L6-v2` (HuggingFace)**
  - Runs entirely on CPU, lightweight (≈90 MB) and fast to embed sentences.
  - Good semantic recall for English documents, free to use.
  - Could be swapped to larger models (e.g. `sentence-transformers/all-mpnet-base-v2`) if higher quality is required, but at the cost of speed and memory.

## Vector Database

- **ChromaDB** – local, file-based vector store with Python SDK.
  - No external infrastructure required, which simplifies deployment and keeps the project self-contained.
  - Persistence is achieved via a directory (`./chroma_db`) that can be checked into volume mounts in Docker.
  - For production-scale or multi-instance setups, a managed vector DB (Pinecone, Weaviate, etc.) would be more appropriate.

## Document Handling

- **LangChain loaders** – PDF, text, CSV, and Excel.
  - Leverage existing community code to handle parsing nuances.
  - Additional loaders (Word, HTML) can be plugged in if needed.

- **RecursiveCharacterTextSplitter** – splits documents into chunks with configurable size and overlap.
  - Overlap ensures that information spanning chunk boundaries is not lost.
  - Chunk size of 800 characters balances retrieval precision with prompt length.

## Agent Orchestration

- **Tool-Calling Agent (LangChain)**
  - Allows the LLM to plan which tools to call and to see their outputs.
  - Tools implemented in `app/agents/tools.py` are simple Python functions decorated with `@tool`.
  - AgentExecutor wraps the agent and enforces a `max_iterations` cap (6) to prevent runaway loops.
  - Multi-turn conversation history is preserved by passing `chat_history` to the agent; this mimics a chat interface and enables follow-up clarifications.

- **Tools Defined**
  - `retrieve_documents(query: str)` – searches Chroma and returns raw chunks.
  - `answer_with_rag(question: str)` – runs the one‑shot RAG pipeline and returns a final answer with sources.
  - `list_uploaded_documents()` – returns names of documents currently ingested.
  - `fetch_chunks_by_page` / `fetch_chunks_by_index` – debugging helpers for inspecting stored chunks.

- **Chain Style: LCEL (LangChain Expression Language)**
  - Used in `pipeline.py` to declaratively build the RAG chain (retrieve → prompt → LLM → output parser).
  - Improves readability over manually wiring chains, and allows type checking.

## Package Choices

- **LangChain** – central orchestration of loaders, splitters, chains, and agents.
- **Pydantic** – strong request/response validation and environment settings.
- **Uvicorn/Gunicorn** – for serving FastAPI, with standard deployment recipes.
- **PyPDF2**, **openpyxl**, **pandas** – for document parsing.
- **ChromaDB** + **sentence-transformers** – for vector search capabilities.
- **React + Vite + TypeScript** – frontend stack chosen for developer experience and fast hot-reload.
- **Redux Toolkit & RTK Query** – state management and typed API slices for the frontend.
- **Tailwind CSS (if used)** – check UI for styling; not present in repo, so maybe plain CSS.

## Modeling & Prompting

- Prompts are carefully crafted to ensure the LLM remains grounded by:
  1. Stating the question clearly.
  2. Including retrieved context labeled with source identifiers.
  3. Instructing the model to answer only from the context and cite sources.

- When the agent calls a tool, the tool’s docstring is included in the prompt to explain its purpose.
  - This enables dynamic planning without hard-coding reasoning steps.

## Frontend Decisions

- **React** for component-based UI.
- **Vite** for fast build times and native ES modules.
- **TypeScript** for type safety across API boundaries.
- Simple folder organization (pages, components, context, store) to keep future features modular.
- Chat UI leverages a context provider to hold messages and streaming state.

## Operational Considerations

- **Environment Variables** – all secrets and tunables are surfaced via `.env` keys documented in the root README.
- **Logging** – structured JSON logging via `app/utils/logger.py` allows easy ingestion by tools like Datadog.
- **Validation** – `validators.py` ensures that queries are non-empty and uploaded files have allowed extensions.
- **Security** – currently open to the public. Future work includes API keys or OAuth2 guards.

## Future / Optional Enhancements

- Add re‑ranking step post-retrieval to improve answer relevance.
- Swap to a managed vector database for distributed deployments.
- Add OCR support to ingest scanned documents.
- Introduce caching layers (Redis) for repeated questions and reduce LLM calls.
- Augment the agent with external web search or a Python REPL tool to answer code questions.

---

> This document is intended for developers and reviewers who wish to understand _why_ the system was built the way it was, and to ease onboarding of new contributors.
