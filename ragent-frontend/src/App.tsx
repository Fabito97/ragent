import { Provider } from "react-redux";
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";
import RootLayout from "./components/layout/RootLayout";
import ChatPage from "./pages/ChatPage";
import DocumentPage from "./pages/DocumentPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      // { index: true, element: <NewChat /> },
      {
        index: true,
        element: <Navigate to="/chat" replace />,
      },
      { path: "chat/:conversationId?", element: <ChatPage /> },
      { path: "documents/", element: <DocumentPage /> },

      // Add more routes later
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
