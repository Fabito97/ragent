import React, { useEffect, useState, useRef } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { navItems } from "../../lib/constants";
import { useChatContext } from "../../context/ChatContext";
import DocumentUploadModal from "../documents/DocumentUploadModal";
import { useDeleteSessionMutation } from "../../store/api/chatApi";

const Sidebar = () => {
  const location = useLocation();
  const {
    startNewConversation,
    conversations,
    setConversation,
    resetChat,
    conversationId,
    currentConversation,
  } = useChatContext();
  const navigate = useNavigate();
  const [isDocsModalOpen, setDocsModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [deleteSession] = useDeleteSessionMutation();

  const isChatPage =
    location.pathname === "/" || location.pathname.startsWith("/chat");

  const isRouteActive = (href: string) => {
    // Special case: Chat nav uses href === '/' but should match both '/' and '/chat/...'
    if (href === "/") {
      return isChatPage;
    }

    // Default case: match first segment
    return location.pathname === href;
  };

  const handleDeleteConversation = async (
    e: React.MouseEvent,
    conversationId: string,
  ) => {
    e.stopPropagation();
    try {
      console.log("Deleting Conversation", conversationId)
      await deleteSession(conversationId).unwrap();
      // If deleted conversation is current, navigate home
      console.log("Current Conversation Id", currentConversation?.id)
      if (conversationId === currentConversation?.id) {
        console.log("navigating to home")
        resetChat();
        navigate("/");
      }
      setOpenMenuId(null);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  return (
    <aside
      style={{
        background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
      }}
      className="w-64 flex flex-col shrink-0 shadow-md border-r border-gray-700 text-gray-100"
    >
      <div className="px-4 py-2 border-b border-gray-700/50 bg-whit mb-5 h-17 w-full">
        <div className=" flex flex- justify-start items-center w-full">
          <img src="/favicon-32x32.png" alt="Logo" className="w-11 h-11" />
          <div className="flex flex-col items-center gap- w-full">
            <h2 className="font-bold text-sm w-full ">RAgent</h2>
            <p className="text-xs text-left w-full text-gray-500">
              Intelligent insights
            </p>
          </div>
        </div>
      </div>

      <div className="px-5">
        <DocumentUploadModal
          isOpen={isDocsModalOpen}
          onClose={() => setDocsModalOpen(false)}
        />

        {/* Navigation */}
        <div className="flex flex-col mb-10">
          <div className={`flex flex-col justify-startitems-center gap-2 `}>
            {navItems.slice(1, 2).map((item, idx) => (
              <NavLink
                to={item.href}
                key={idx}
                className={({ isActive }) =>
                  `${
                    idx > 1 && "hidden"
                  } py-2 px-4 rounded-lg gap-2 flex items-center text-xs ${
                    isRouteActive(item.href)
                      ? "bg-blue-700 text-white"
                      : "bg-gray-00 text-gray-300 hover:bg-blue-900 border border-gray-500"
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.name}</span>
              </NavLink>
            ))}
          </div>
        </div>

        {/* RECENT CHATS */}
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center gap-2 mb-5 px-2">
            <h3 className="text-gray-500 text-xs font-bold">CHATS</h3>
            <button
              onClick={() => {
                startNewConversation();
                navigate(`/`);
              }}
              className="btn rounded-lg border-gray-600 border p-1 px-2 bg-gray-700 flex justify-center gap-2 items-center"
            >
              <span>➕</span>
              <span className="text-xs">New Chat</span>
            </button>
          </div>

          {conversations && conversations.length > 0 ? (
            <div className="flex flex-col gap-4 p-2">
              {conversations?.map((conversation) => (
                <div key={conversation.id} className="relative group">
                  <div
                    onClick={() => {
                      setConversation(conversation.id);
                      navigate(`/chat/${conversation.id}`, {
                        state: { conversationId: conversation.id },
                      });
                    }}
                    className={`text-xs text-gray-400 pb-2 border-b cursor-pointer flex items-center justify-between ${
                      conversation.id === conversationId && isChatPage
                        ? "text-white border-gray-300"
                        : "border-[#646cff] hover:border-gray-400 hover:text-gray-300/80"
                    }`}
                  >
                    <button className="text-left flex-1">
                      {conversation.title}
                    </button>

                    {/* Menu button */}
                    <div className="relative ml-2" ref={menuRef}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(
                            openMenuId === conversation.id
                              ? null
                              : conversation.id,
                          );
                        }}
                        className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
                        title="Options"
                      >
                        <MoreVertical size={16} className="text-gray-300" />
                      </button>

                      {/* Dropdown menu */}
                      {openMenuId === conversation.id && (
                        <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-50 min-w-32">
                          <button
                            onClick={(e) =>
                              handleDeleteConversation(e, conversation.id)
                            }
                            className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-gray-700 hover:text-red-300 first:rounded-t last:rounded-b"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : conversations ? (
            <div
              className={
                "flex justify-center text-xs text-gray-500 text-center pt-5"
              }
            >
              No Chats yet, click on New chat to start a conversation
            </div>
          ) : (
            <div
              className={
                "flex justify-center text-xs text-gray-500 text-center pt-5"
              }
            >
              Failed to load conversations, please try again.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
