import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatInput from "../components/chat/ChatInput";
import { useChatContext } from "../context/ChatContext";
import { ChatInterface } from "../components/chat/ChatInterface";

import { useParams } from "react-router-dom";
const ChatPage = () => {
  const navigate = useNavigate();
  const {
    messages,
    isNewConversation,
    isSending,
    messageDraft,
    setConversation,
    setDraft,
    isErrorMessage,
    isLoadingConversations,
    sendMessage,
    startNewConversation,
  } = useChatContext();
  const { conversationId } = useParams();

  const [loadError, setLoadError] = React.useState<string | null>(null);

  useEffect(() => {
    if (conversationId) {
     // clear any previous load errors and fetch messages
      setLoadError(null);
      setConversation(conversationId);
    }
  }, [conversationId, setConversation]);

  if (isLoadingConversations) {
    return (
      <div>
        <div className="flex h-screen flex-col items-center justify-center text-center pb-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading Chat...</p>
        </div>
      </div>
    );
  }

  const hasLoadFailure =
    !!loadError ||
    isErrorMessage ||
    (conversationId && !messages && !isLoadingConversations);

  if (hasLoadFailure) {
    const errorText =
      loadError ||
      (isErrorMessage && "An error occurred while loading conversations.") ||
      "Failed to load messages.";


    const handleNew = () => {
      startNewConversation();
      navigate("/");
    };

    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-4 pb-20">
        <p className="text-red-500 mb-4">{errorText}</p>
        <div className="space-x-4">
         
          <button
            onClick={handleNew}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            Start new conversation
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="h-full">
      {isNewConversation ? (
        <div
          className={`flex flex-col justify-center pb-10 max-w-[900px] m-auto h-full ${
            messages?.length === 0 ? "pb-50" : ""
          } h-full overflow-hidden`}
        >
          <div className="flex flex-col items-center justify-center text-center my-10 w-full">
            <div className="text-4xl mb-2">
              <img src="/favicon-32x32.png" alt="logo" className="w-15 h-15" />
            </div>
            <h2 className="text-2xl font-medium mb-2">
              {!conversationId && "Welcome to"} Rag Agent
            </h2>
            <div className="empty-subtitle">
              Upload documents, ask questions, and get accurate AI-powered
              answers.
            </div>
            <div className="flex sm:flex-row flex-col text-xs gap-4 justify-center items-center mt-4">
              {[
                "I need some information",
                "Can you help me, please?",
                "What can you do for me?",
              ].map((suggestion, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-gray-600 p-2 rounded-lg shadow-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => setDraft(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          </div>

          <ChatInput
            value={messageDraft}
            onChange={setDraft}
            onSendMessage={(content) =>
              sendMessage(content, undefined, navigate)
            }
            isLoading={isSending}
          />
        </div>
      ) : (
        <ChatInterface />
      )}
    </section>
  );
};

export default ChatPage;
