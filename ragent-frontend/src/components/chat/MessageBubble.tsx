import { useMemo } from "react";
import LoadingSpinner from "../ui/LoadingSpinner";
import UserIcon from "../ui/icons/UserIcon";
import LogoIcon from "../ui/icons/LogoIcon";
import type { Message } from "../../types";
import DOMPurify from "dompurify";
import { marked } from "marked";

interface MessageBubbleProps {
  message: Message;
  isSending: boolean;
  isStreaming: boolean;
  error?: string;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSending,
  isStreaming,
  error,
}) => {
  const isUser = message.sender === "user";
  const isAI = message.sender === "assistant";

  const bubbleAlignment = isUser ? "justify-end" : "justify-start";
  const bubbleColor = isUser ? "dark:bg-gray-700/50 bg-gray-200" : "bg-gray-00";
  const bubbleStyles = `max-w-xs md:max-w-md lg:max-w-2xl px-4 py-2 rounded-lg shadow-m ${bubbleColor}`;

  const AILogo = () => (
    <div className="rounded-full flex items-center justify-center mr-3 shrink-0 text-xl pt-5">
      <LogoIcon className="w-4 h-4" />
    </div>
  );

  const UserLogo = () => (
    <div className="w-8 h-8 rounded-full dark:bg-gray-900 flex items-center justify-center ml-3 shrink-0">
      <UserIcon className="h-4 w-4" />
    </div>
  );

  const preprocess = (text: string) =>
    text
      .replace(/\n\n/g, "\n\n") // preserve paragraph breaks
      .replace(/^(\d+)\.\s/gm, (_, n) => `${n}. `); // ensure numbered lists are respected

  const reviewHtml = useMemo(() => {
    if (!message.content) return "";
    try {
      const raw = marked.parse(preprocess(message.content));
      return DOMPurify.sanitize(String(raw));
    } catch (e) {
      console.error("Error parsing markdown:", e);
      return DOMPurify.sanitize(String(message.content));
    }
  }, [message.content]);

  return (
    <div className={`flex items-start ${bubbleAlignment} w-full`}>
      <div className={bubbleStyles}>
        {isAI &&
        (message.status === "pending" || message.status === "streaming") ? (
          <LoadingSpinner />
        ) : isAI ? (
          <div className="mb-10 mt-5 flex items-start justify-start gap-1">
            {<AILogo />}
            {error ? (
              <div>
                <p className="px-3 py-2 border border-red-500 rounded-lg animate-pulse">{error}</p>
              </div>
            ) : (
              <div
                className="prose prose-sm dark:prose-invert max-w-none
              dark:prose-headings:text-gray-100 prose-headings:font-semibold
              dark:prose-p:text-gray-300 prose-p:text-gray-700 prose-p:leading-relaxed
              dark:prose-strong:text-gray-200 prose-strong:text-gray-900 prose-strong:font-bold
              dark:prose-code:text-gray-300 prose-code:text-gray-800 prose-code:bg-gray-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
              dark:prose-pre:bg-gray-900 prose-pre:bg-gray-100 prose-pre:border prose-pre:border-gray-700 dark:prose-pre:border-gray-600 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
              dark:prose-blockquote:border-gray-600 dark:prose-blockquote:text-gray-300 prose-blockquote:border-l-4 prose-blockquote:border-gray-400 prose-blockquote:pl-4 prose-blockquote:italic
              dark:prose-a:text-blue-400 prose-a:text-blue-600 prose-a:underline dark:hover:prose-a:text-blue-300 hover:prose-a:text-blue-700
              dark:prose-ul:text-gray-300 prose-ul:text-gray-700 dark:prose-li:text-gray-300 prose-li:text-gray-700
              dark:prose-ol:text-gray-300 prose-ol:text-gray-700
              dark:prose-thead:border-gray-600 prose-thead:border-gray-300 dark:prose-th:text-gray-200 prose-th:text-gray-900 dark:prose-th:bg-gray-800/50 prose-th:bg-gray-100
              dark:prose-tr:border-gray-700 prose-tr:border-gray-300 dark:prose-td:text-gray-300 prose-td:text-gray-700 dark:prose-td:border-gray-700 prose-td:border-gray-300
              dark:prose-hr:border-gray-600 prose-hr:border-gray-300"
              >
                <div dangerouslySetInnerHTML={{ __html: reviewHtml }} />
              </div>
            )}
          </div>
        ) : (
          <p className="dark:text-white text-sm whitespace-pre-wrap wrap-break-words">
            {message.content}
          </p>
        )}
       
      </div>
      {isUser && <UserLogo />}
    </div>
  );
};

export default MessageBubble;
