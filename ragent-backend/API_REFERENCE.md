# RAgent — API Reference

This document describes every public HTTP endpoint exposed by the **RAG Agent** application, including request bodies, response bodies, status codes, and common errors.

---

## Table of Contents

- [Overview](#overview)
- [Root Endpoint](#root-endpoint)
- [Health Endpoint](#health-endpoint)
- [Documents API](#documents-api)
- [Query API](#query-api)
- [Sessions API](#sessions-api)
- [Agent Tools](#agent-tools)
- [Error Responses](#error-responses)
- [Implementation Notes](#implementation-notes)

---

## Overview

**Base URL**: `http://localhost:8000`

**Documentation**:

- Interactive API docs: `/docs` (Swagger UI)
- Alternative docs: `/redoc` (ReDoc)
- OpenAPI schema: `/openapi.json`

### Supported File Formats

The API accepts the following document types for ingestion:

- **PDF** (`.pdf`)
- **Text** (`.txt`)
- **CSV** (`.csv`)
- **Excel** (`.xlsx`, `.xls`)

---

## Root Endpoint

### GET `/`

Returns a quick index of available endpoints and helpful links.

**Request**

| Property | Value |
| -------- | ----- |
| Method   | GET   |
| Auth     | None  |
| Body     | None  |

**Response** (200 OK)

```json
{
  "message": "Enterprise RAG Agent API is running.",
  "docs": "/docs",
  "health": "/health",
  "endpoints": {
    "upload_document": "POST /documents/upload",
    "list_documents": "GET /documents/",
    "delete_document": "DELETE /documents/{filename}",
    "query_rag": "POST /query/rag",
    "query_agent": "POST /query/agent",
    "session_history": "GET /sessions/{session_id}/messages",
    "clear_session": "POST /sessions/{session_id}/clear",
    "delete_session": "DELETE /sessions/{session_id}"
  }
}
```

---

## Health Endpoint

### GET `/health`

Returns system health status and knowledge-base statistics.

**Request**

| Property | Value |
| -------- | ----- |
| Method   | GET   |
| Auth     | None  |
| Body     | None  |

**Response** (200 OK)

**Schema**: `HealthResponse`

| Field                         | Type    | Description                             |
| ----------------------------- | ------- | --------------------------------------- |
| `status`                      | string  | System status (e.g., `"ok"`)            |
| `llm_model`                   | string  | LLM model name from configuration       |
| `embedding_model`             | string  | Embedding model name from configuration |
| `knowledge_base`              | object  | Knowledge-base statistics               |
| `knowledge_base.total_chunks` | integer | Total number of stored chunks           |
| `knowledge_base.documents`    | array   | List of document filenames              |

**Example Response**

```json
{
  "status": "ok",
  "llm_model": "gpt-4",
  "embedding_model": "all-MiniLM-L6-v2",
  "knowledge_base": {
    "total_chunks": 820,
    "documents": ["89638c86_Atomic_Habits_(www.ztcprep.com).pdf"]
  }
}
```

---

## Documents API

### POST `/documents/upload`

Upload a document and ingest it into the knowledge base.

**Pipeline**: Validate → Save → Load → Chunk → Embed → Store

**Request**

| Property     | Value                 |
| ------------ | --------------------- |
| Method       | POST                  |
| Content-Type | `multipart/form-data` |
| Auth         | None                  |

**Form Parameters**

| Name   | Type | Required | Description                              |
| ------ | ---- | -------- | ---------------------------------------- |
| `file` | file | ✓        | Document file (PDF, TXT, CSV, XLSX, XLS) |

**Response** (201 Created)

**Schema**: `UploadResponse`

| Field           | Type    | Description                         |
| --------------- | ------- | ----------------------------------- |
| `message`       | string  | Success message                     |
| `filename`      | string  | Original uploaded filename          |
| `pages_loaded`  | integer | Number of pages extracted           |
| `chunks_stored` | integer | Number of chunks created and stored |

**Example Response**

```json
{
  "message": "Document ingested successfully.",
  "filename": "report.pdf",
  "pages_loaded": 10,
  "chunks_stored": 40
}
```

**Error Responses**

| Status | Condition                                      |
| ------ | ---------------------------------------------- |
| `400`  | Invalid file type or missing file parameter    |
| `422`  | File parse/load failure; saved file is removed |

---

### GET `/documents/`

List all ingested documents and total chunk count in the vector store.

**Request**

| Property | Value |
| -------- | ----- |
| Method   | GET   |
| Auth     | None  |
| Body     | None  |

**Response** (200 OK)

**Schema**: `DocumentListResponse`

| Field          | Type    | Description                                        |
| -------------- | ------- | -------------------------------------------------- |
| `total_chunks` | integer | Total number of stored chunks across all documents |
| `documents`    | array   | List of document filenames                         |

**Example Response**

```json
{
  "total_chunks": 820,
  "documents": ["89638c86_Atomic_Habits_(www.ztcprep.com).pdf"]
}
```

---

### GET `/documents/{filename}`

Retrieve full details for a document: metadata and all stored chunks in reading order.

**Use Cases**

- Inspect what text was extracted and stored
- Debug retrieval quality
- Verify correct ingestion before querying

**Request**

| Property | Value |
| -------- | ----- |
| Method   | GET   |
| Auth     | None  |
| Body     | None  |

**Path Parameters**

| Name       | Type   | Description                               |
| ---------- | ------ | ----------------------------------------- |
| `filename` | string | Original filename provided at upload time |

**Response** (200 OK)

**Schema**: `DocumentDetailResponse`

| Field          | Type           | Description                                            |
| -------------- | -------------- | ------------------------------------------------------ |
| `filename`     | string         | The document filename                                  |
| `total_chunks` | integer        | Number of chunks stored                                |
| `file_on_disk` | boolean        | Whether the original file exists on disk               |
| `disk_path`    | string \| null | Path to the original file (if on disk)                 |
| `chunks`       | array          | Array of `ChunkInfo` objects (sorted by `chunk_index`) |

**ChunkInfo Schema**

| Field            | Type    | Description                                    |
| ---------------- | ------- | ---------------------------------------------- |
| `chunk_index`    | integer | Sequential chunk number                        |
| `text`           | string  | The chunk text content                         |
| `source`         | string  | Source path/filename that was recorded         |
| `extra_metadata` | object  | Loader-specific metadata (varies by file type) |

**Example Response**

```json
{
  "filename": "89638c86_Atomic_Habits_(www.ztcprep.com).pdf",
  "total_chunks": 820,
  "file_on_disk": true,
  "disk_path": "./uploads\\89638c86_Atomic_Habits_(www.ztcprep.com).pdf",
  "chunks": [
    {
      "chunk_index": 0,
      "text": "www.ztcprep.com",
      "source": "./uploads\\89638c86_Atomic_Habits_(www.ztcprep.com).pdf",
      "extra_metadata": {
        "page": 0,
        "total_pages": 285,
        "page_label": "1",
        "producer": "calibre 3.27.1 [https://calibre-ebook.com]",
        "title": "Atomic Habits: Tiny Changes, Remarkable Results",
        "author": "James Clear",
        "creator": "calibre 3.27.1 [https://calibre-ebook.com]",
        "creationdate": "2018-10-18T05:47:09+00:00",
        "moddate": "2021-05-23T16:43:41+03:30"
      }
    },
    {
      "chunk_index": 1,
      "text": "Introduction\nAtoms are the tiny units that make up everything...",
      "source": "./uploads\\89638c86_Atomic_Habits_(www.ztcprep.com).pdf",
      "extra_metadata": {
        "page": 1,
        "total_pages": 285,
        "page_label": "2",
        ...
      }
    }
  ]
}
```

**Error Responses**

| Status | Condition                                 |
| ------ | ----------------------------------------- |
| `404`  | No chunks found for the provided filename |

---

### DELETE `/documents/{filename}`

Remove all vector-store chunks for a document and delete the physical file from disk (best-effort).

**Request**

| Property | Value  |
| -------- | ------ |
| Method   | DELETE |
| Auth     | None   |
| Body     | None   |

**Path Parameters**

| Name       | Type   | Description                 |
| ---------- | ------ | --------------------------- |
| `filename` | string | Document filename to delete |

**Response** (200 OK)

**Schema**: `DeleteResponse`

| Field            | Type    | Description                                |
| ---------------- | ------- | ------------------------------------------ |
| `message`        | string  | Success message                            |
| `filename`       | string  | The deleted filename                       |
| `chunks_removed` | integer | Number of chunks removed from vector store |

**Example Response**

```json
{
  "message": "Document removed successfully.",
  "filename": "report.pdf",
  "chunks_removed": 40
}
```

**Error Responses**

| Status | Condition                                 |
| ------ | ----------------------------------------- |
| `404`  | No chunks found for the provided filename |

---

### POST `/documents/{filename}/reingest`

Re-load and re-ingest an already uploaded document. Deletes stale chunks and replaces them with freshly extracted, chunked, and embedded content.

**Use Cases**

- Update extraction after fixing PDF parsing logic
- Apply new chunking strategy to existing documents
- Clean up malformed or incomplete ingestions

**Request**

| Property | Value |
| -------- | ----- |
| Method   | POST  |
| Auth     | None  |
| Body     | None  |

**Path Parameters**

| Name       | Type   | Description                   |
| ---------- | ------ | ----------------------------- |
| `filename` | string | Document filename to reingest |

**Response** (200 OK)

**Schema**: `UploadResponse`

| Field           | Type    | Description                                   |
| --------------- | ------- | --------------------------------------------- |
| `message`       | string  | Success message (notes stale chunks replaced) |
| `filename`      | string  | The reingested filename                       |
| `pages_loaded`  | integer | Number of pages extracted                     |
| `chunks_stored` | integer | Number of new chunks created                  |

**Example Response**

```json
{
  "message": "Document re-ingested successfully. Replaced 40 stale chunk(s).",
  "filename": "report.pdf",
  "pages_loaded": 10,
  "chunks_stored": 42
}
```

**Error Responses**

| Status | Condition                                                |
| ------ | -------------------------------------------------------- |
| `404`  | Original file not found on disk and cannot be reingested |
| `422`  | File parse/load failure during re-ingestion              |

---

## Query API

### POST `/query/rag`

Direct Retrieval-Augmented Generation (RAG) query. Stateless—no session or memory.

**Pipeline**: Search vector store → Retrieve similar chunks → Generate answer

**Request**

| Property     | Value              |
| ------------ | ------------------ |
| Method       | POST               |
| Content-Type | `application/json` |
| Auth         | None               |

**Request Body** — `QueryRequest`

| Field       | Type   | Required | Description                                         |
| ----------- | ------ | -------- | --------------------------------------------------- |
| `question`  | string | ✓        | Natural-language question (1–2000 chars)            |
| `filenames` | array  | ✗        | Restrict retrieval to these documents (exact match) |

**Example Request**

```json
{
  "question": "Summarize the book's main idea in one sentence.",
  "filenames": ["89638c86_Atomic_Habits_(www.ztcprep.com).pdf"]
}
```

**Response** (200 OK)

**Schema**: `RAGResponse`

| Field                   | Type          | Description                                 |
| ----------------------- | ------------- | ------------------------------------------- |
| `answer`                | string        | Generated answer to the question            |
| `sources`               | array         | Array of `SourceRef` objects                |
| `sources[].filename`    | string        | Source document filename                    |
| `sources[].chunk_index` | integer       | Chunk index within the document             |
| `scoped_to`             | array \| null | Filenames used as search filter (or `null`) |

**Example Response**

```json
{
  "answer": "Tiny daily improvements compound into significant changes over time.",
  "sources": [
    {
      "filename": "89638c86_Atomic_Habits_(www.ztcprep.com).pdf",
      "chunk_index": 123
    }
  ],
  "scoped_to": ["89638c86_Atomic_Habits_(www.ztcprep.com).pdf"]
}
```

**Error Responses**

| Status        | Condition                                                 |
| ------------- | --------------------------------------------------------- |
| `400` / `422` | Invalid question (missing, too long, or validation error) |
| `500`         | Unexpected processing error                               |

---

### POST `/query/agent`

Agentic reasoning with server-managed conversation sessions. The server stores session history; clients never send message history.

**Features**

- Multi-turn conversations with full context
- Tool-based reasoning (search, calculation, etc.)
- Automatic session expiry (≈2 hours inactivity)

**Session Flow**

1. **First request**: Omit `session_id`. A new session is created and returned in the response.
2. **Follow-up requests**: Include the returned `session_id` to continue the conversation.
3. **Expiry**: Sessions expire automatically after ~2 hours without activity.

**Request**

| Property     | Value              |
| ------------ | ------------------ |
| Method       | POST               |
| Content-Type | `application/json` |
| Auth         | None               |

**Request Body** — `AgentQueryRequest`

| Field        | Type   | Required | Description                                 |
| ------------ | ------ | -------- | ------------------------------------------- |
| `question`   | string | ✓        | Natural-language question (1–2000 chars)    |
| `session_id` | string | ✗        | Existing session ID (omit to create new)    |
| `filenames`  | array  | ✗        | Hint to agent about which files to consider |

**Example Request (New Session)**

```json
{
  "question": "What are the key habits recommended in Atomic Habits?"
}
```

**Example Request (Continuation)**

```json
{
  "question": "Can you elaborate on the first habit?",
  "session_id": "1a2b3c"
}
```

**Response** (200 OK)

**Schema**: `AgentResponse`

| Field        | Type   | Description                             |
| ------------ | ------ | --------------------------------------- |
| `answer`     | string | Generated answer                        |
| `session_id` | string | Session ID (use in follow-ups)          |
| `tools_used` | array  | Names of tools invoked during reasoning |
| `steps`      | array  | Array of `AgentStep` objects            |

**AgentStep Schema**

| Field            | Type   | Description                  |
| ---------------- | ------ | ---------------------------- |
| `tool`           | string | Tool name that was invoked   |
| `input`          | object | Input provided to the tool   |
| `output_preview` | string | Short preview of tool output |

**Example Response**

```json
{
  "answer": "The book recommends focusing on systems rather than goals. It emphasizes that tiny, consistent habits compound into remarkable results over time.",
  "session_id": "1a2b3c",
  "tools_used": ["search"],
  "steps": [
    {
      "tool": "search",
      "input": {
        "query": "key habits atomic habits"
      },
      "output_preview": "Found 5 relevant chunks from the knowledge base"
    }
  ]
}
```

**Error Responses**

| Status        | Condition                      |
| ------------- | ------------------------------ |
| `400` / `422` | Invalid question or session ID |
| `500`         | Unexpected processing error    |

---

## Sessions API

### GET `/sessions/`

List all active sessions with metadata (no message contents).

**Request**

| Property | Value |
| -------- | ----- |
| Method   | GET   |
| Auth     | None  |
| Body     | None  |

**Response** (200 OK)

**Schema**: `ListSessionsResponse`

| Field      | Type    | Description                       |
| ---------- | ------- | --------------------------------- |
| `total`    | integer | Total number of active sessions   |
| `sessions` | array   | Array of `SessionSummary` objects |

**SessionSummary Schema**

| Field           | Type           | Description                          |
| --------------- | -------------- | ------------------------------------ |
| `session_id`    | string         | Unique session identifier            |
| `message_count` | integer        | Number of messages in conversation   |
| `first_message` | string \| null | Preview of the first user message    |
| `created_at`    | number         | Creation timestamp (Unix epoch)      |
| `last_active`   | number         | Last activity timestamp (Unix epoch) |

**Example Response**

```json
{
  "total": 2,
  "sessions": [
    {
      "session_id": "1a2b3c",
      "message_count": 4,
      "first_message": "What is Atomic Habits about?",
      "created_at": 1670000000.0,
      "last_active": 1670003600.0
    },
    {
      "session_id": "4d5e6f",
      "message_count": 2,
      "first_message": "Tell me about habits",
      "created_at": 1670010000.0,
      "last_active": 1670011200.0
    }
  ]
}
```

---

### GET `/sessions/{session_id}/messages`

Retrieve full conversation history for a session (for client UIs or debugging).

**Request**

| Property | Value |
| -------- | ----- |
| Method   | GET   |
| Auth     | None  |
| Body     | None  |

**Path Parameters**

| Name         | Type   | Description            |
| ------------ | ------ | ---------------------- |
| `session_id` | string | Session ID to retrieve |

**Response** (200 OK)

**Schema**: `SessionDetailResponse`

| Field        | Type    | Description                                                     |
| ------------ | ------- | --------------------------------------------------------------- |
| `session_id` | string  | The session ID                                                  |
| `turn_count` | integer | Number of conversation turns (calculated as history length ÷ 2) |
| `history`    | array   | Array of `MessageOut` objects                                   |

**MessageOut Schema**

| Field     | Type   | Description                               |
| --------- | ------ | ----------------------------------------- |
| `role`    | string | Message sender: `"user"` or `"assistant"` |
| `content` | string | Message content                           |

**Example Response**

```json
{
  "session_id": "1a2b3c",
  "turn_count": 2,
  "history": [
    {
      "role": "user",
      "content": "What is Atomic Habits about?"
    },
    {
      "role": "assistant",
      "content": "Atomic Habits is a book about the power of tiny, incremental improvements..."
    },
    {
      "role": "user",
      "content": "Can you summarize the main ideas?"
    },
    {
      "role": "assistant",
      "content": "The main ideas include: 1) Focus on systems not goals, 2) Small changes compound, 3)..."
    }
  ]
}
```

**Error Responses**

| Status | Condition                        |
| ------ | -------------------------------- |
| `404`  | Session not found or has expired |

---

### DELETE `/sessions/{session_id}`

Delete a session and all its conversation history.

**Request**

| Property | Value  |
| -------- | ------ |
| Method   | DELETE |
| Auth     | None   |
| Body     | None   |

**Path Parameters**

| Name         | Type   | Description          |
| ------------ | ------ | -------------------- |
| `session_id` | string | Session ID to delete |

**Response** (200 OK)

```json
{
  "message": "Session '1a2b3c' deleted."
}
```

**Error Responses**

| Status | Condition         |
| ------ | ----------------- |
| `404`  | Session not found |

---

## Agent Tools

The agent can invoke specialized tools to retrieve and analyze documents. These tools are automatically available when using `POST /query/agent`.

### retrieve_documents

Search the knowledge base for document chunks relevant to a query.

**Parameters**

| Name        | Type   | Required | Description                                                                  |
| ----------- | ------ | -------- | ---------------------------------------------------------------------------- |
| `query`     | string | ✓        | The search question or topic to look for                                     |
| `filenames` | string | ✗        | Pipe-separated filenames to restrict search (e.g., `"file1.pdf\|file2.pdf"`) |

**Returns**

A formatted string containing the top matching text passages with source filenames, chunk indices, and page numbers.

**Example Usage (within agent reasoning)**

```
Tool: retrieve_documents
Input: {
  "query": "What are the key principles of habit formation?",
  "filenames": "89638c86_Atomic_Habits_(www.ztcprep.com).pdf"
}

Output:
[Chunk 42 | Source: 89638c86_Atomic_Habits_(www.ztcprep.com).pdf | Page: 5]
Habit formation follows four key steps: cue, craving, response, and reward...

---

[Chunk 45 | Source: 89638c86_Atomic_Habits_(www.ztcprep.com).pdf | Page: 6]
The feedback loop of habits reinforces behavior through consistent repetition...
```

**When the Agent Uses This**

- User asks questions about document content
- Semantic search is needed to find relevant passages
- Agent wants to gather evidence for reasoning

---

### list_uploaded_documents

List all documents currently stored in the knowledge base with their exact filenames and chunk counts.

**Parameters**

| Name    | Type   | Required | Description                                              |
| ------- | ------ | -------- | -------------------------------------------------------- |
| `dummy` | string | ✗        | Unused parameter (required for LangChain tool signature) |

**Returns**

A formatted string listing all available documents with their exact filenames and total chunk count.

**Example Output**

```
Total chunks in knowledge base: 820
Documents:
  - 89638c86_Atomic_Habits_(www.ztcprep.com).pdf (820 chunks)
```

**When the Agent Uses This**

- User mentions a document by name (agent verifies exact filename)
- Search returns no results (agent shows user what documents are available)
- Agent needs to recommend which document to search

---

### fetch_chunks_by_index

Fetch specific chunks from a document by their sequential index numbers.

**Parameters**

| Name            | Type   | Required | Description                                             |
| --------------- | ------ | -------- | ------------------------------------------------------- |
| `filename`      | string | ✓        | Exact filename as returned by `list_uploaded_documents` |
| `chunk_indices` | string | ✓        | Comma-separated chunk indices (e.g., `"5,6,7"`)         |

**Returns**

The full text of requested chunks with metadata (chunk index, source, page number).

**Example Usage**

```
Tool: fetch_chunks_by_index
Input: {
  "filename": "89638c86_Atomic_Habits_(www.ztcprep.com).pdf",
  "chunk_indices": "42,43"
}

Output:
[Chunk 42 | Source: 89638c86_Atomic_Habits_(www.ztcprep.com).pdf | Page: 5]
First principle of habit formation...

---

[Chunk 43 | Source: 89638c86_Atomic_Habits_(www.ztcprep.com).pdf | Page: 5]
The second principle builds on the first...
```

**When the Agent Uses This**

- A retrieved chunk ends mid-sentence or mid-paragraph
- Agent wants surrounding context (fetching previous/next chunks)
- User asks for a specific chunk number
- Agent needs the complete argument from a multi-chunk passage

---

### fetch_chunks_by_page

Fetch all chunks from a specific page of a document.

**Parameters**

| Name       | Type    | Required | Description                                                  |
| ---------- | ------- | -------- | ------------------------------------------------------------ |
| `filename` | string  | ✓        | Exact filename as returned by `list_uploaded_documents`      |
| `page`     | integer | ✓        | Human-readable page number (1-based, as printed in document) |

**Returns**

All chunks that belong to the specified page, in order.

**Example Usage**

```
Tool: fetch_chunks_by_page
Input: {
  "filename": "89638c86_Atomic_Habits_(www.ztcprep.com).pdf",
  "page": 10
}

Output:
[Chunk index 25 | Source: 89638c86_Atomic_Habits_(www.ztcprep.com).pdf | Page: 10]
Beginning of page 10 content...

---

[Chunk index 26 | Source: 89638c86_Atomic_Habits_(www.ztcprep.com).pdf | Page: 10]
Continuation of page 10...
```

**When the Agent Uses This**

- User asks about a specific page number ("What's on page 42?")
- Agent wants full page context rather than semantic search results
- Retrieved chunks reference a particular page the agent wants to explore completely

---

## Error Responses

All error responses follow a consistent format.

### 404 Not Found

Returned when a requested resource (document, session) does not exist or has expired.

**Example**

```json
{
  "detail": "No document named 'foo.pdf' found in the knowledge base."
}
```

Common scenarios:

- Document filename not in vector store
- Session has expired
- Original file removed from disk

### 422 Unprocessable Entity

Returned when input validation fails or a file cannot be processed.

**Example**

```json
{
  "detail": "Could not parse document: PDF is corrupted or not readable"
}
```

Common scenarios:

- Unsupported file format
- Corrupted or malformed file
- Invalid request body (missing required fields)
- Question exceeds maximum length

### 500 Internal Server Error

Returned for unexpected server-side errors.

**Example**

```json
{
  "detail": "An unexpected error occurred. Please try again."
}
```

---

## Implementation Notes

### File Upload Handling

- Files are saved with a **UUID prefix** to avoid collisions: `a1b2c3d4_report.pdf`
- The server searches for files by exact match or suffix pattern (`_{filename}`)
- If upload fails during processing, the saved file is automatically removed

### Vector Store Filtering

The `filenames` parameter is passed directly to ChromaDB:

- **No filter** (empty list): Search entire knowledge base
- **Single file**: Flat filter `{"filename": "report.pdf"}`
- **Multiple files**: `$or` filter `{"$or": [{"filename": "a.pdf"}, {"filename": "b.pdf"}]}`

### Metadata Extraction

Chunk metadata varies by file type and loader:

| Loader      | Common Metadata                                                                    | Notes                       |
| ----------- | ---------------------------------------------------------------------------------- | --------------------------- |
| PDF         | `page`, `total_pages`, `page_label`, `title`, `author`, `producer`, `creationdate` | Varies by PDF content       |
| TXT         | Minimal                                                                            | May include basic file info |
| CSV / Excel | Column headers, row indices                                                        | Depends on structure        |

### Session Lifecycle

- Sessions are created on-demand when `session_id` is omitted from `POST /query/agent`
- Sessions expire automatically after ~2 hours without activity
- Message history is stored server-side; clients never send full history

---

**Last Updated**: March 2026  
**API Version**: 1.0.0
