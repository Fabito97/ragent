// features/chat/chatApi.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// Backend base URL (FastAPI running on port 8000)
export const BASE_URL = "http://127.0.0.1:8000";

// Types matching the backend responses
export interface RAGResponse {
  answer: string;
  sources: { filename: string; chunk_index: number }[];
  scoped_to?: string[] | null;
}

export interface AgentResponse {
  answer: string;
  session_id: string;
  tools_used: string[];
  steps: Array<{ tool: string; input: any; output_preview: string }>;
}

export interface HealthResponse {
  status: string;
  llm_model: string;
  embedding_model: string;
  knowledge_base: {
    total_chunks: number;
    documents: string[];
  };
}

export interface SessionSummary {
  session_id: string;
  message_count: number;
  first_message: string;
  created_at: number;
  last_active: number;
}

export interface ListSessionsResponse {
  total: number;
  sessions: SessionSummary[];
}

export interface MessageOut {
  role: "user" | "assistant";
  content: string;
}

export interface SessionDetailResponse {
  session_id: string;
  turn_count: number;
  history: MessageOut[];
}

export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: fetchBaseQuery({ baseUrl: BASE_URL }),
  tagTypes: ["Sessions"],
  endpoints: (builder) => ({
    // Health check
    getHealthStatus: builder.query<HealthResponse, void>({
      query: () => "/health",
    }),

    // Query endpoints
    queryRag: builder.mutation<
      RAGResponse,
      { question: string; filenames?: string[] }
    >({
      query: ({ question, filenames }) => ({
        url: "/query/rag",
        method: "POST",
        body: { question, filenames: filenames ?? null },
      }),
    }),

    queryAgent: builder.mutation<
      AgentResponse,
      { question: string; session_id?: string; filenames?: string[] }
    >({
      query: ({ question, session_id, filenames }) => ({
        url: "/query/agent",
        method: "POST",
        body: {
          question,
          session_id: session_id ?? undefined,
          filenames: filenames ?? null,
        },
      }),
      invalidatesTags: ["Sessions"],
    }),

    // Session management
    listSessions: builder.query<ListSessionsResponse, void>({
      query: () => "/sessions/",
      providesTags: ["Sessions"],
    }),

    getSessionMessages: builder.query<SessionDetailResponse, string>({
      query: (sessionId) => `/sessions/${sessionId}/messages`,
    }),

    clearSession: builder.mutation<SessionDetailResponse, string>({
      query: (sessionId) => ({
        url: `/sessions/${sessionId}/clear`,
        method: "POST",
      }),
      invalidatesTags: ["Sessions"],
    }),

    deleteSession: builder.mutation<{ message: string }, string>({
      query: (sessionId) => ({
        url: `/sessions/${sessionId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Sessions"],
    }),
  }),
});

export const {
  useGetHealthStatusQuery,
  useQueryRagMutation,
  useQueryAgentMutation,
  useListSessionsQuery,
  useGetSessionMessagesQuery,
  useClearSessionMutation,
  useDeleteSessionMutation,
} = chatApi;
