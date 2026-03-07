import React, {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  addMessage,
  updateMessageStatus,
  updateMessageContent,
  setError,
  setConversationId,
  setMessages,
  clearMessages,
  startNewChat,
  setMessageDraft,
  markConversationStarted,
  resetChatState
} from "../store/slice/chatSlice";
import {
  useQueryAgentMutation,
  useListSessionsQuery,
  useGetSessionMessagesQuery,
} from "../store/api/chatApi";
import { Message, Conversation } from "../types";

interface ChatContextType {
  conversationId: string | null;
  isNewConversation: boolean;
  currentConversation: Conversation | null;
  conversations: Conversation[] | undefined;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  messages: Message[];
  isSending: boolean;
  isErrorMessage: boolean;
  messageDraft: string;
  error: string | null;
  sendMessage: (
    content: string,
    filenames?: string[],
    navigate?: (path: string) => void,
  ) => void;
  startNewConversation: () => void;
  resetChat: () => void;
  setConversation: (id: string) => void;
  setDraft: (text: string) => void;
}

const MAX_TITLE_LENGTH = 27;

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const dispatch = useAppDispatch();

  // Redux state
  const {
    conversationId,
    isNewConversation,
    messageDraft,
    error,
    messages,
  } = useAppSelector((state) => state.chat);

  // API hooks
  const [queryAgentApi, { isLoading: isSending }] = useQueryAgentMutation();
  const { data: sessionsData, isLoading: isLoadingConversations } = useListSessionsQuery();
  const { data: sessionDetails, isLoading: isLoadingMessages, isError: isErrorMessage } = useGetSessionMessagesQuery(
    conversationId || "",
    { skip: !conversationId },
  );
  
  // Only clears conversationId and draft, keep message cache
  const startNewConversation = useCallback(() => {
    dispatch(startNewChat());
  }, [dispatch]);
 
  const resetChat = useCallback(() => {
    dispatch(resetChatState());
  }, [dispatch]);

  // Sets conversation id
  const setConversation = useCallback(
    async (id: string | null) => {
      dispatch(setConversationId(id));
      // Messages will be fetched via useGetSessionMessagesQuery hook
    },
    [dispatch],
  );

  // Update draft text
  const setDraft = useCallback(
    (text: string) => {
      dispatch(setMessageDraft(text));
    },
    [dispatch],
  );

  const getConversationTitle = (firstMessage: string) =>
    firstMessage.length > MAX_TITLE_LENGTH
      ? firstMessage.slice(0, MAX_TITLE_LENGTH) + "..."
      : firstMessage;

  // Map sessions to conversations format
  const conversations: Conversation[] | undefined = useMemo(() => {
    if (!sessionsData?.sessions) return undefined;

    return sessionsData.sessions.map((session) => ({
      id: session.session_id,
      title: session.first_message
        ? getConversationTitle(session.first_message)
        : "New Chat",
      messages: [],
      createdAt: new Date(session.created_at * 1000).toISOString(),
      updatedAt: new Date(session.last_active * 1000).toISOString(),
    }));
  }, [sessionsData?.sessions]);


  // Derive current conversation info
  const currentConversation: Conversation | null = useMemo(() => {
    if (!conversationId || !conversations) return null;

    return conversations.find((c) => c.id === conversationId) ?? null;
  }, [conversationId, conversations]);


  // When session details are loaded, update messages in Redux
  React.useEffect(() => {
    if (sessionDetails?.history) {
      const loadedMessages: Message[] = sessionDetails.history.map(
        (msg, idx) => ({
          id: `${sessionDetails.session_id}-${idx}`,
          sender: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
          timestamp: Date.now(),
          status: "sent" as const,
        }),
      );

      dispatch(setMessages(loadedMessages));

      dispatch(markConversationStarted());
    }
  }, [sessionDetails, dispatch]);


  // Send message function
  const sendMessage = useCallback(
    async (
      content: string,
      filenames?: string[],
      navigate?: (path: string) => void,
    ) => {
      const userMessageId = crypto.randomUUID();
      const aiMessageId = crypto.randomUUID();

      console.log("Adding conversation message")

      // If starting a new chat (no conversationId), clear old messages first
      if (!conversationId && isNewConversation) {
        dispatch(clearMessages());
      }

      // Mark conversation as started so welcome UI disappears
      if (isNewConversation) {
        dispatch(markConversationStarted());
      }

      // Add user message
      const userMessage: Message = {
        id: userMessageId,
        sender: "user",
        content,
        timestamp: Date.now(),
        status: "pending",
      };
      dispatch(addMessage(userMessage));

      // Add placeholder AI message
      const aiPlaceholder: Message = {
        id: aiMessageId,
        sender: "assistant",
        content: "",
        timestamp: Date.now(),
        status: "pending",
      };
      dispatch(addMessage(aiPlaceholder));

      dispatch(setError(null));

      try {
        const result = await queryAgentApi({
          question: content,
          session_id: conversationId ?? undefined,
          filenames: filenames && filenames.length > 0 ? filenames : undefined,
        }).unwrap();

        // Server returns `answer` and `session_id`.
        const newSessionId = result.session_id;
        if (!conversationId && newSessionId) {
          dispatch(setConversationId(newSessionId));
          if (navigate) {
            navigate(`/chat/${newSessionId}`);
          }
        }

        // Update placeholder AI message with agent answer
        dispatch(
          updateMessageContent({
            id: aiMessageId,
            content: result.answer,
            status: "sent",
            timestamp: Date.now(),
            conversationId: newSessionId,
          }),
        );

        // Mark user message as sent
        dispatch(updateMessageStatus({ id: userMessageId, status: "sent" }));
      } catch (err) {
        console.error("Error sending message:", err);
        dispatch(setError("An error occured while sending message, please try again"));
        dispatch(updateMessageStatus({ id: userMessageId, status: "error" }));
        dispatch(updateMessageStatus({ id: aiMessageId, status: "error" }));
      }
    },
    [conversationId, isNewConversation, dispatch, queryAgentApi],
  );

  return (
    <ChatContext.Provider
      value={{
        conversationId,
        isNewConversation,
        currentConversation,
        conversations,
        isLoadingConversations,
        isLoadingMessages,
        messages,
        isSending,
        messageDraft,
        error,
        isErrorMessage,
        sendMessage,
        startNewConversation,
        resetChat,
        setConversation,
        setDraft,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
};
