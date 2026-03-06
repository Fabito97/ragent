import React, { useEffect, useRef } from "react";
import ChatInput from "./ChatInput";
import MessageBubble from "./MessageBubble";
import { useChatContext } from "../../context/ChatContext";

export const ChatInterface = () => {
  const {
    messages,
    isSending,
    messageDraft,
    error,
    setDraft,
    sendMessage,
  } = useChatContext();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages.at(-1)?.content]);

  return (
    <section className="relative flex flex-col h-full">
      <div className="flex-1 flex-glow overflow-y-auto scrollbar-thin p-4 sm:p-6">
        <div
          className={`space-y-6 flex flex-col items-center justify-end max-w-3xl mx-auto mt-10  ${messages.length === 0 ? "min-h-[50vh]" : ""}`}
        >
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              error={error || undefined}
              isLast={idx === messages.length - 1}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex-shrink-0">
        <ChatInput
          value={messageDraft}
          onChange={setDraft}
          onSendMessage={sendMessage}
          isLoading={isSending}
        />
      </div>
    </section>
  );
};
