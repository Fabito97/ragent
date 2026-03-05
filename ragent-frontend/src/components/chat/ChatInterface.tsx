import React, { useEffect, useRef } from "react";
import ChatInput from "./ChatInput";
import NewChat from "../../pages/NewChatPage";
import MessageBubble from "./MessageBubble";
import { useChatContext } from "../../context/ChatContext";
import { useParams } from "react-router-dom";
import AddDocumentModal from "../AddDocumentModal";

export const ChatInterface: React.FC = () => {
  const {
    currentConversation,
    messages,
    isNewConversation,
    isStreaming,
    isSending,
    messageDraft,
    error,
    setDraft,
    sendMessage,
    selectConversation,
  } = useChatContext();
  const { conversationId } = useParams();

  useEffect(() => {
    if (conversationId) {
      selectConversation(conversationId); // fetch messages, set active
    }
  }, [conversationId, selectConversation]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages.at(-1)?.content]);

  return (
    <section className="relative flex flex-col h-full">
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        <div className="space-y-6 flex flex-col items-center justify-end max-w-3xl mx-auto mt-10">
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSending={isSending}
              isStreaming={isStreaming}
              error={error || undefined}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput
        value={messageDraft}
        onChange={setDraft}
        onSendMessage={sendMessage}
        isLoading={isSending || isStreaming}
      />
    </section>
  );
};
