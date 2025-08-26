import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import ChatContainer from "../components/ChatContainer";
import GroupChatContainer from "../components/GroupChatContainer";
import NoChatSelected from "../components/NoChatSelected";
import { useChatStore } from "../store/useChatStore";
import { useGroupChatStore } from "../store/useGroupChatStore";
import toast from "react-hot-toast";
// import ErrorBoundary from "../components/ErrorBoundary"; // Optional

const HomePage = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  const {
    initializeWebSocket,
    disconnectWebSocket,
    isConnected: chatConnected,
    isLoading: chatLoading,
  } = useChatStore();

  const {
    initializeGroupWebSocket,
    disconnectGroupWebSocket,
    isConnected: groupChatConnected,
    isLoading: groupChatLoading,
  } = useGroupChatStore();

  useEffect(() => {
    const initChat = async () => {
      const chatSuccess = await initializeWebSocket();
      if (!chatSuccess) toast.error("Failed to connect to chat service");

      const groupSuccess = await initializeGroupWebSocket();
      if (!groupSuccess) toast.error("Failed to connect to group chat service");
    };

    initChat();

    return () => {
      disconnectWebSocket();
      disconnectGroupWebSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ensure these methods are stable or memoized in stores

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSelectedGroup(null);
  };

  const handleSelectGroup = (group) => {
    setSelectedGroup(group);
    setSelectedUser(null);
  };

  const handleCloseChat = () => {
    setSelectedUser(null);
    setSelectedGroup(null);
  };

  const handleTabChange = (tabId) => {
    if (tabId === activeTab) return;

    setActiveTab(tabId);
    setSelectedUser(null);
    setSelectedGroup(null);
  };

  const isConnected = chatConnected && groupChatConnected;
  const isLoading = chatLoading || groupChatLoading;

  return (
    <div className="h-screen bg-base-200">
      <div className="flex items-center justify-center pt-20 px-4">
        <div className="bg-base-100 rounded-lg shadow-cl w-full max-w-6xl h-[calc(100vh-8rem)]">
          {!isConnected && !isLoading && (
            <div className="bg-warning text-warning-content px-4 py-2 text-sm text-center">
              Chat service disconnected. Trying to reconnect...
            </div>
          )}

          <div className="flex h-full rounded-lg overflow-hidden">
            <Sidebar
              onSelectUser={handleSelectUser}
              onSelectGroup={handleSelectGroup}
              selectedUserId={selectedUser?._id}
              selectedGroupId={selectedGroup?.id}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />

            {!selectedUser && !selectedGroup ? (
              <NoChatSelected />
            ) : selectedGroup ? (
              // <ErrorBoundary fallback={<div>Group chat failed to load.</div>}>
              <GroupChatContainer
                selectedGroup={selectedGroup}
                onClose={handleCloseChat}
              />
            ) : (
              // </ErrorBoundary>
              // <ErrorBoundary fallback={<div>Chat failed to load.</div>}>
              <ChatContainer
                selectedUser={selectedUser}
                onClose={handleCloseChat}
              />
              // </ErrorBoundary>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
