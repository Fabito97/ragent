import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Message, status } from "../../types";

interface ChatState {
  // All messages in the current conversation session
  messages: Message[];

  // Backend conversation session ID (null until first message is sent)
  conversationId: string | null;

  // Whether the current conversation is new 
  isNewConversation: boolean;

  // Optional input draft (for UI input box)
  messageDraft: string;

  // Error state for failed requests or stream
  error: string | null;
}

const initialState: ChatState = {
  messages: [],
  conversationId: null,
  isNewConversation: true,
  messageDraft: "",
  error: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    // Add a new message (user or assistant)
    addMessage: (state, action: PayloadAction<Message>) => {
      state.messages.push(action.payload);
    },

    setMessages: (state, action: PayloadAction<Message[]>) => {
      state.messages = action.payload;
    },
    // Start streaming assistant response
   
    updateMessageContent: (
      state,
      action: PayloadAction<{
        id: string;
        content: string;
        status: status;
        timestamp?: number;
        conversationId?: string;
      }>
    ) => {
      const msg = state.messages.find((m) => m.id === action.payload.id);
      if (msg) {
        msg.content = action.payload.content;
        msg.status = action.payload.status;
        if (action.payload.timestamp) msg.timestamp = action.payload.timestamp;
        if (action.payload.conversationId)
          msg.conversationId = action.payload.conversationId;
      }
    },

    // Set the conversation ID after first message is sent
    setConversationId: (state, action: PayloadAction<string | null>) => {
      state.conversationId = action.payload;
      state.isNewConversation = false;
    },

    // Clear all messages (e.g. when starting fresh)
    clearMessages: (state) => {
      state.messages = [];
    },

    // Mark conversation as no longer new (after first message is sent)
    markConversationStarted: (state) => {
      state.isNewConversation = false;
    },

    // Set error state
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Set input draft (optional for UI)
    setMessageDraft: (state, action: PayloadAction<string>) => {
      state.messageDraft = action.payload;
    },

    removeMessage: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter((m) => m.id !== action.payload);
    },

    updateMessageStatus: (
      state,
      action: PayloadAction<{ id: string; status: status }>
    ) => {
      const msg = state.messages.find((m) => m.id === action.payload.id);
      if (msg) msg.status = action.payload.status;
    },

    // Reset entire chat state (e.g. when starting new chat)
    resetChatState: (state) => {
      state.messages = [];
      state.conversationId = null;
      state.isNewConversation = true;
      state.messageDraft = "";
      state.error = null;
    },

    // Start a new chat - only clear conversationId and draft, keep messages cached
    startNewChat: (state) => {
      state.conversationId = null;
      state.isNewConversation = true;
      state.messageDraft = "";
      state.error = null;
      // Keep messages in cache so they're not lost if user navigates back
    },
  },
});

export const {
  addMessage,
  updateMessageStatus,
  setConversationId,
  updateMessageContent,
  clearMessages,
  setMessages,
  setError,
  setMessageDraft,
  resetChatState,
  startNewChat,
  markConversationStarted,
} = chatSlice.actions;

export default chatSlice.reducer;
