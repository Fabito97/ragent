// src/features/documents/documentsApi.ts
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { BASE_URL } from "./chatApi";

// Backend document API shapes (match FastAPI routes)
export interface UploadResponse {
  message: string;
  filename: string;
  pages_loaded: number;
  chunks_stored: number;
}

export interface DocumentListResponse {
  total_chunks: number;
  documents: string[]; // filenames
}

export interface ChunkInfo {
  chunk_index: number;
  text: string;
  source: string;
  extra_metadata: Record<string, any>;
}

export interface DocumentDetailResponse {
  filename: string;
  total_chunks: number;
  file_on_disk: boolean;
  disk_path?: string | null;
  chunks: ChunkInfo[];
}

export interface DeleteResponse {
  message: string;
  filename: string;
  chunks_removed: number;
}

export const documentsApi = createApi({
  reducerPath: "documentsApi",
  baseQuery: fetchBaseQuery({ baseUrl: BASE_URL }),
  tagTypes: ["Documents", "Document"],
  endpoints: (builder) => ({
    uploadDocument: builder.mutation<UploadResponse, FormData>({
      query: (formData) => ({
        url: "/documents/upload",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Documents"],
    }),
    getDocuments: builder.query<DocumentListResponse, void>({
      query: () => "/documents/",
      providesTags: (result) =>
        result?.documents
          ? [
              ...result.documents.map((filename) => ({
                type: "Document" as const,
                id: filename,
              })),
              { type: "Documents", id: "LIST" },
            ]
          : [{ type: "Documents", id: "LIST" }],
    }),
    getDocumentById: builder.query<DocumentDetailResponse, string>({
      query: (filename) => `/documents/${filename}`,
      providesTags: (result, error, id) => [{ type: "Document", id }],
    }),
    deleteDocument: builder.mutation<DeleteResponse, string>({
      query: (filename) => ({
        url: `/documents/${filename}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Document", id },
        { type: "Documents", id: "LIST" },
      ],
    }),
    downloadDocument: builder.query<Blob, string>({
      query: (filename) => ({
        url: `/documents/${filename}/download`,
        responseHandler: async (response) => {
          if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`);
          return response.blob();
        },
      }),
    }),
    reingestDocument: builder.mutation<UploadResponse, string>({
      query: (filename) => ({
        url: `/documents/${filename}/reingest`,
        method: "POST",
      }),
      invalidatesTags: (result, error, id) => [{ type: "Document", id }],
    }),
  }),
});

export const {
  useUploadDocumentMutation,
  useGetDocumentsQuery,
  useGetDocumentByIdQuery,
  useDeleteDocumentMutation,
  useDownloadDocumentQuery,
  useReingestDocumentMutation,
} = documentsApi;
