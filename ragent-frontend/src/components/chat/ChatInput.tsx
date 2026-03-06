import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import PaperAirplaneIcon from "../ui/icons/PaperAirplaneIcon";
import PlusIcon from "../ui/icons/PlusIcon";
import { useGetDocumentsQuery } from "../../store/api/documentsApi";
import DocumentUploadModal from "../documents/DocumentUploadModal";
import { extractFilename } from "../../utils/fileUtils";

interface ChatInputProps {
  value: string;
  onChange: (text: string) => void;
  onSendMessage: (content: string, filenames?: string[]) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSendMessage,
  isLoading,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [showDocsList, setShowDocsList] = useState(false);
  const [selectedFilenames, setSelectedFilenames] = useState<string[]>([]);
  const { data: documentsData } = useGetDocumentsQuery();
  const documents = documentsData?.documents || [];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200;
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [value]);

  const handleSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (value.trim()) {
      onSendMessage(
        value,
        selectedFilenames.length > 0 ? selectedFilenames : undefined
      );
      onChange(""); // Clear draft after sending
      setSelectedFilenames([]); // Clear selected files
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleDocumentClick = (filename: string) => {
    const cleanFilename = extractFilename(filename);
    // Check if already added
    if (!selectedFilenames.includes(cleanFilename)) {
      setSelectedFilenames([...selectedFilenames, cleanFilename]);
    }
    setShowDocsList(false);
  };

  const handleRemoveContext = (filename: string) => {
    setSelectedFilenames(selectedFilenames.filter((f) => f !== filename));
  };

  const handleDocumentButtonClick = () => {
    if (documents.length === 0) {
      setIsDocsModalOpen(true);
    } else {
      setShowDocsList(!showDocsList);
    }
  };

  return (
    <div className="shrink-0">
      <div className="relative max-w-3xl mx-auto border-t border-gray-300 rounded-xl dark:border-gray-700/50 bg-gray-200 dark:bg-gray-900 p-4 shrink-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Context tags at top */}
          {selectedFilenames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFilenames.map((filename, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
                >
                  <span>{filename}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveContext(filename)}
                    className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 font-bold"
                    aria-label={`Remove ${filename} context`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              rows={1}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-12 max-h-32 scrollbar-thin"
              disabled={isLoading}
              style={{ overflowY: "auto" }}
              autoFocus
            />
          </div>

          {/* Buttons below textarea */}
          <div className="flex items-center justify-between gap-3">
            {/* Document button with dropdown on left */}
            <div className="relative">
              <button
                type="button"
                onClick={handleDocumentButtonClick}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400 h-10 w-10 flex items-center justify-center shrink-0"
                title={
                  documents.length === 0
                    ? "Add documents"
                    : "Add document context"
                }
              >
                <PlusIcon />
              </button>

              {/* Documents dropdown list */}
              {showDocsList && documents.length > 0 && (
                <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 min-h-12 overflow-y-auto min-w-48 z-50">
                  {documents.map(({filename}) => {
                    const cleanFilename = extractFilename(filename);
                    const isSelected = selectedFilenames.includes(cleanFilename);
                    return (
                      <button
                        key={filename}
                        type="button"
                        onClick={() => handleDocumentClick(filename)}
                        className={`w-full text-left text-xs px-4 py-2 border-b border-gray-200 dark:border-gray-600 last:border-b-0 transition-colors ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 font-semibold"
                            : "text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        {cleanFilename}
                        {isSelected && " ✓"}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Send button on right */}
            <button
              type="submit"
              disabled={isLoading || !value.trim()}
              className="bg-blue-600 text-white rounded-lg p-2 h-10 w-10 flex items-center justify-center shrink-0 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              aria-label="Send message"
            >
              <PaperAirplaneIcon />
            </button>
          </div>
        </form>
      </div>

      {/* Upload modal */}
      <DocumentUploadModal
        isOpen={isDocsModalOpen}
        onClose={() => setIsDocsModalOpen(false)}
      />
    </div>
  );
};

export default ChatInput;
