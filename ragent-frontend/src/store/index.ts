import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import chatReducer from "./slice/chatSlice";
import { chatApi } from "./api/chatApi";
import { documentsApi } from "./api/documentsApi";
// import { analysisApi } from '../features/analysis/analysisApi';

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    // RTK Query reducers
    [chatApi.reducerPath]: chatApi.reducer,
    [documentsApi.reducerPath]: documentsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(chatApi.middleware)
      .concat(documentsApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
