import { Provider } from "react-redux";
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { store } from "./store";
import RootLayout from "./components/layout/RootLayout";
import NewChat from "./pages/NewChatPage";
import ChatPage from "./pages/ChatPage";
import DocumentPage from "./pages/DocumentPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <NewChat /> },
      { path: "chat/:conversationId", element: <ChatPage /> },
      { path: "documents/", element: <DocumentPage /> },

      // Add more routes later
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
