import React, { useState } from "react";
import { X, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { extractFilename } from "../../utils/fileUtils";
import type {
  DocumentDetailResponse,
  ChunkInfo,
} from "../../store/api/documentsApi";
import LoadingSpinner from "../ui/LoadingSpinner.tsx"

interface DocumentDetailsSidebarProps {
  document: DocumentDetailResponse | null;
  isLoading: boolean;
  onClose: () => void;
}

export const DocumentDetailsSidebar: React.FC<DocumentDetailsSidebarProps> = ({
  document,
  isLoading,
  onClose,
}) => {
  const [showChunks, setShowChunks] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  if (!document) return null;

  const cleanFilename = extractFilename(document.filename);

  const toggleChunkExpanded = (chunkIndex: number) => {
    const newSet = new Set(expandedChunks);
    if (newSet.has(chunkIndex)) {
      newSet.delete(chunkIndex);
    } else {
      newSet.add(chunkIndex);
    }
    setExpandedChunks(newSet);
  };

  const getPageInfo = (
    chunk: ChunkInfo,
  ): { page?: number; totalPages?: number } => {
    const meta = chunk.extra_metadata;
    return {
      page: meta?.page !== undefined ? meta.page + 1 : undefined, // Convert 0-indexed to 1-indexed
      totalPages: meta?.total_pages,
    };
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-gray-900 border-l border-gray-700 shadow-2xl flex flex-col z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-gray-100 truncate">
            {cleanFilename}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {document.total_chunks} chunks stored
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 transition-colors shrink-0"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
          <div className="text-xs text-gray-400">Loading...</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {/* Document Info */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase">
              Info
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Chunks:</span>
                <span className="text-gray-300 font-medium">
                  {document.total_chunks}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <span
                  className={
                    document.file_on_disk ? "text-green-400" : "text-yellow-400"
                  }
                >
                  {document.file_on_disk ? "Available" : "Unavailable"}
                </span>
              </div>
            </div>
          </div>

          {/* Inspect Chunks Button */}
          <div className="p-4 border-b border-gray-700">
            <button
              onClick={() => setShowChunks(!showChunks)}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded text-sm transition-colors"
            >
              <Eye size={14} />
              {showChunks ? "Hide" : "Inspect"} Chunks
            </button>
          </div>

          {/* Chunks List */}
          {showChunks && (
            <div className="divide-y divide-gray-700 ">
              {document.chunks.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-xs">
                  No chunks
                </div>
              ) : (
                document.chunks.map((chunk) => {
                  const pageInfo = getPageInfo(chunk);
                  const isExpanded = expandedChunks.has(chunk.chunk_index);

                  return (
                    <div
                      key={chunk.chunk_index}
                      className="border-b border-gray-700 last:border-b-0"
                    >
                      <button
                        onClick={() => toggleChunkExpanded(chunk.chunk_index)}
                        className="w-full px-4 py-2 hover:bg-gray-800 transition-colors flex items-center justify-between text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-semibold text-gray-300">
                            Chunk {chunk.chunk_index}
                          </h4>
                          {pageInfo.page && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Page {pageInfo.page}
                              {pageInfo.totalPages &&
                                ` / ${pageInfo.totalPages}`}
                            </p>
                          )}
                        </div>
                        {isExpanded ? (
                          <ChevronUp
                            size={16}
                            className="text-gray-500 shrink-0"
                          />
                        ) : (
                          <ChevronDown
                            size={16}
                            className="text-gray-500 shrink-0"
                          />
                        )}
                      </button>

                      {/* Expanded chunk content - only text */}
                      {isExpanded && (
                        <div className="px-4 py-3 bg-gray-800/50 border-t border-gray-700">
                          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap wrap-break-word">
                            {chunk.text}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
