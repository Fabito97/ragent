# Architecture Overview

This document dives deeper into the **backend** and **frontend** structure of the RAG Agent project, with diagrams and flow charts showing how data moves between components.

---

## High-Level Architecture

The system is split into two main parts:

1. **Backend (Python / FastAPI)**
2. **Frontend (TypeScript / React + Vite)**

The backend exposes a REST API for document ingestion, querying, and session management. The frontend provides a single-page application that interacts with the API to allow users to upload documents, ask questions, and review answers.

```
+----------------+            +-------------------------+
|   Browser SPA   | <------->  |    FastAPI Backend      |
| (React + Vite)  |   HTTP    |                         |
+----------------+            |                         |
                              |  +-------------------+  |
                              |  |  Knowledge Base   |  |
                              |  |  (ChromaDB)       |  |
                              |  +-------------------+  |
                              +-------------------------+
```

## Backend Structure

```
rag_agent/ragent-backend/
├── main.py                   # entrypoint, FastAPI app
├── config.py                 # pydantic settings
├── requirements.txt          # pip dependencies
├── .env.example              # env var template
├── API_REFERENCE.md          # detailed endpoint docs
├── app/
│   ├── ingestion/
│   │   ├── loader.py         # document loaders (pdf, txt, csv, xlsx)
│   │   └── chunker.py        # text splitter wrapper
│   ├── retrieval/
│   │   └── vector_store.py   # CRUD + search against ChromaDB
│   ├── rag/
│   │   └── pipeline.py       # LCEL chain for retrieval & prompting
│   ├── agents/
│   │   ├── tools.py          # @tool definitions for agent
│   │   └── rag_agent.py      # AgentExecutor orchestration
│   ├── routes/
│   │   ├── health.py         # /health
│   │   ├── documents.py      # file CRUD endpoints
│   │   └── query.py          # /query/rag & /query/agent
│   └── utils/
│       ├── logger.py         # structured logging
│       └── validators.py     # input guardrails
├── uploads/                  # persisted user files
└── chroma_db/                # persistent vector store
```

### Data Flow – Ingestion

1. Client uploads a file via `POST /documents/upload`.
2. `documents.py` validates and saves the file to `uploads/`.
3. `loader.py` selects an appropriate LangChain loader and reads raw text.
4. `chunker.py` splits text into overlapping chunks using `RecursiveCharacterTextSplitter`.
5. Each chunk is embedded using the HuggingFace model and stored in Chroma via `vector_store.py`.

### Data Flow – Query (RAG)

1. Client calls `POST /query/rag` with a question.
2. `query.py` calls `pipeline.answer()` which:
   1. Retrieves top‑k chunks from Chroma.
   2. Constructs a prompt template with retrieved text.
   3. Sends prompt to LLM (via LangChain Groq wrapper).
   4. Parses and returns answer plus source references.

### Data Flow – Query (Agent)

1. Client calls `POST /query/agent` with a question (and optional chat history).
2. `rag_agent.Agent.execute()` spins up a LangChain tool‑calling agent.
3. The agent may call `retrieve_documents` multiple times, inspect results, and finally call `answer_with_rag` to generate the final response.
4. The agent returns a trace of tools used, intermediate reasoning steps, and the final answer.

## Frontend Structure

```
rag_agent/ragent-frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── assets/              # static icons, logos
└── src/
    ├── App.tsx              # root component
    ├── index.tsx            # ReactDOM entrypoint
    ├── pages/
    │   ├── ChatPage.tsx     # main QA interface
    │   ├── DocumentPage.tsx # upload / list documents
    │   └── NewChatPage.tsx  # start new session
    ├── components/          # reusable UI pieces
    │   ├── chat/             # chat input/bubbles
    │   ├── documents/        # file cards & details
    │   ├── layout/           # header / sidebar / RootLayout
    │   └── ui/               # modal, spinner, icons
    ├── context/             # React Context providers
    │   ├── ChatContext.tsx
    │   └── ThemeContext.tsx
    ├── hooks/
    │   └── useUploader.ts
    ├── lib/                 # shared utilities
    │   ├── constants.ts
    │   └── utils.ts
    ├── store/               # Redux Toolkit slices & API
    └── types/               # TypeScript type definitions
```

### Frontend Data Flow

1. User uploads a document via `DocumentPage` → calls `documentsApi.uploadDocument`.
2. List view refreshes by fetching `GET /documents/`.
3. On `ChatPage`, user submits question → `chatApi.sendRagQuery` or `sendAgentQuery`.
4. Responses are rendered as chat bubbles with citations or step traces.

### Flowcharts

#### Agent Reasoning Flow

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

---

For frontend routing and component interactions please refer to the `ragent-frontend/src` tree above.

> **Note:** The diagrams in this document are rendered using Mermaid.js, which is supported on GitHub and most markdown viewers.
