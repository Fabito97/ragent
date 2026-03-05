import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ChatInput from "../components/chat/ChatInput";
import { useChatContext } from "../context/ChatContext";
import { ChatInterface } from "../components/chat/ChatInterface";

const NewChat = () => {
  const navigate = useNavigate();
  const {
    conversationId,
    messages,
    isNewConversation,
    isStreaming,
    isSending,
    messageDraft,
    setDraft,
    sendMessage,
  } = useChatContext();

  useEffect(() => {
    if (conversationId) navigate(`/chat/${conversationId}`);
  }, []);

  return (
    <section>
      {isNewConversation ? (
        <div
          className={`flex flex-col justify-center pb-10 max-w-[900px] m-auto h-full ${
            messages?.length === 0 ? "pb-50" : ""
          } h-full overflow-hidden`}
        >
          <div className="flex flex-col items-center justify-center text-center my-10 w-full">
            <div className="text-4xl mb-2">
              <img src="favicon-32x32.png" alt="logo" className="w-15 h-15" />
            </div>
            <h2 className="text-2xl font-medium mb-2">Welcome to Rag Agent</h2>
            <div className="empty-subtitle">
              Upload documents, ask questions, and get instant AI-powered
              answers.
            </div>
            <div className="flex sm:flex-row flex-col text-xs gap-4 justify-center items-center mt-4">
              {[
                "I need your help",
                "How do you work?",
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
            onSendMessage={(content) => sendMessage(content, undefined, navigate)}
            isLoading={isSending || isStreaming}
          />
        </div>
      ) : (
        <ChatInterface />
      )}
    </section>
  );
};

export default NewChat;
