import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Upload, Zap } from "lucide-react";
import { ThemeToggle } from "../ThemeToggle";
import DocumentUploadModal from "../documents/DocumentUploadModal";
import { useChatContext } from "../../context/ChatContext";
import { useGetDocumentsQuery } from "../../store/api/documentsApi";

const Header = () => {
  const [isDocsModalOpen, setDocsModalOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentConversation,
    isNewConversation,
    messages,
    startNewConversation,
  } = useChatContext();
  const { data: documentsData } = useGetDocumentsQuery();

  // Determine which content to show based on route
  const isChatPage = location.pathname.startsWith("/chat");
  const isDocumentsPage = location.pathname.startsWith("/documents");

  const handleNewChat = () => {
    startNewConversation();
    navigate("/");
  };

  return (
    <header className="static top-0 shadow-md w-full border-b border-gray-300 dark:border-gray-700/50 h-17">
      <div className="flex items-center gap-4 p-4 justify-between">

        {/* Chat Page */}
        {isChatPage && (
          <div className="flex justify-between gap-2 items-center w-160">
            <div className="flex flex-col">
              <h1 className="font-medium text-lg text-gray-800 dark:text-gray-100">
                {isNewConversation ? "New Chat" : "Agent Chat"}
              </h1>

              {/* Current Session info (title and date)*/}
              {currentConversation && (
                <div className="flex items-center gap-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {currentConversation.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {currentConversation.updatedAt
                      ? new Date(
                          currentConversation.updatedAt,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : ""}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Document Page */}
        {isDocumentsPage && (
          <div className=" flex justify-between items-center gap-2 w-150">
            {/* Documents Page: Document and chunk counts */}
            <div>
              <h1 className="font-medium text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-500" />
                Documents
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {documentsData?.documents?.length || 0} document
                {documentsData?.documents?.length !== 1 ? "s" : ""},{" "}
                {documentsData?.total_chunks || 0} total chunks
              </p>
            </div>
          </div>
        )}

        {/* Right hand - menu Action buttons */}
        <div className="ml-auto flex gap-4">
          {isChatPage && currentConversation && (
            <button
              onClick={handleNewChat}
              className="px-4 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              New Chat
            </button>
          )}

          {isDocumentsPage && (
            <button
              onClick={() => setDocsModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1 px-3 rounded-lg transition-colors"
            >
              <Upload size={16} />
              Upload
            </button>
          )}

          <ThemeToggle />
        </div>
      </div>

      <DocumentUploadModal
        isOpen={isDocsModalOpen}
        onClose={() => setDocsModalOpen(false)}
      />
    </header>
  );
};

export default Header;
