import { useEffect, useRef, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import { formatMessageTime, getDateLabel } from "../lib/utils";
import { useChatStore } from "../store/useChatStore";
import { MessageSquare, Sparkles, Loader2, Check, CheckCheck, Shield, ShieldCheck, Lock } from "lucide-react";
import encryptionService from "../lib/encryption";

const ChatContainer = ({ selectedUser, onClose }) => {
  const messageEndRef = useRef(null);
  const {
    getMessagesForUser,
    sendMessage,
    isLoading,
    currentUser,
    isLoadingOldMessages,
    getMessageStatus
  } = useChatStore();

  const [messages, setMessages] = useState([]);
  const [hasEncryption, setHasEncryption] = useState(false);

  // Check if we have encryption set up with this user
  useEffect(() => {
    if (selectedUser) {
      // For now, assume encryption is available if we have the service initialized
      setHasEncryption(encryptionService.isInitialized);
    }
  }, [selectedUser]);

  // Get messages for the selected user
  useEffect(() => {
    if (selectedUser) {
      const userMessages = getMessagesForUser(selectedUser.username);
      setMessages(userMessages);
    }
  }, [selectedUser, getMessagesForUser]);

  // Subscribe to message updates for this user
  useEffect(() => {
    if (!selectedUser) return;

    const interval = setInterval(() => {
      const userMessages = getMessagesForUser(selectedUser.username);
      setMessages(userMessages);
    }, 1000); // Check for new messages every second

    return () => clearInterval(interval);
  }, [selectedUser, getMessagesForUser]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (text, image) => {
    if (!text.trim() && !image) return;

    const success = await sendMessage(text, image);
    if (!success) {
      console.error('Failed to send message');
    }
  };

  if (!selectedUser) {
    return null;
  }

  const isLoadingMessages = isLoadingOldMessages(selectedUser.username);

  // Function to check if messages are consecutive (same sender, within 2 minutes)
  const isConsecutiveMessage = (currentMsg, prevMsg) => {
    if (!prevMsg || !currentMsg) return false;

    const isSameSender = currentMsg.senderId === prevMsg.senderId;
    const timeDiff = new Date(currentMsg.createdAt) - new Date(prevMsg.createdAt);
    const isWithinTimeLimit = timeDiff < 2 * 60 * 1000; // 2 minutes

    return isSameSender && isWithinTimeLimit;
  };

  // Function to get message status with proper icons and real-time updates
  const getMessageStatusDisplay = (message, isOwnMessage) => {
    if (!isOwnMessage) return null;

    if (message.isTemp) {
      return {
        icon: <Loader2 className="size-3 animate-spin" />,
        text: "Sending...",
        className: "text-white/60"
      };
    }

    // Get real-time status from store
    const status = message.status || getMessageStatus(message._id) || 'SENT';

    switch (status) {
      case 'SENT':
        return {
          icon: <Check className="size-3" />,
          text: "Sent",
          className: "text-white/70"
        };
      case 'DELIVERED':
        return {
          icon: <CheckCheck className="size-3" />,
          text: "Delivered",
          className: "text-white/70"
        };
      case 'READ':
        return {
          icon: <CheckCheck className="size-3" />,
          text: "Read",
          className: "text-blue-400" // Blue for read messages
        };
      default:
        return {
          icon: <Check className="size-3" />,
          text: "Sent",
          className: "text-white/70"
        };
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-base-100">
      <ChatHeader user={selectedUser} onClose={onClose} />

      {/* Encryption Status Banner */}
      <div className={`px-4 py-2 border-b flex items-center justify-center gap-2 ${
        hasEncryption
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200'
      }`}>
        {hasEncryption ? (
          <>
            <ShieldCheck className="size-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">
              End-to-end encrypted
            </span>
            <span className="text-xs text-green-600">
              Messages are secured with encryption
            </span>
          </>
        ) : (
          <>
            <Lock className="size-4 text-yellow-600" />
            <span className="text-sm text-yellow-700 font-medium">
              Setting up encryption...
            </span>
            <span className="text-xs text-yellow-600">
              Keys are being exchanged
            </span>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-gradient-to-b from-base-100 to-base-50">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 bg-base-200/50 backdrop-blur-sm rounded-full px-6 py-3">
              <Loader2 className="animate-spin size-5 text-primary" />
              <span className="text-base-content/70 text-sm font-medium">Loading encrypted chat history...</span>
            </div>
          </div>
        ) : isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 bg-base-200/50 backdrop-blur-sm rounded-full px-6 py-3">
              <div className="animate-spin size-5 border-2 border-primary border-t-transparent rounded-full"></div>
              <span className="text-base-content/70 text-sm font-medium">Loading messages...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {/* App Icon with MessUp branding */}
            <div className="flex justify-center gap-4 mb-8">
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center animate-bounce shadow-lg border border-primary/20 backdrop-blur-sm">
                  <MessageSquare className="w-10 h-10 text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center">
                  <Shield className="w-3 h-3 text-white" />
                </div>
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-primary/60 animate-pulse" />
                {/* <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <div className="bg-primary/90 backdrop-blur-sm text-primary-content text-xs font-bold px-3 py-1 rounded-full shadow-lg border border-primary/30">
                    MessUp
                  </div>
                </div> */}
              </div>
            </div>

            <div className="space-y-6 max-w-sm">
              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-base-content">
                  Ready to chat securely with{" "}
                  <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                    {selectedUser.fullName}
                  </span>
                  ?
                </h3>

                <p className="text-base-content/60 leading-relaxed">
                  Your messages are protected with end-to-end encryption. Start your secure conversation! 🔒✨
                </p>
              </div>

              {/* Security features */}
              <div className="mt-8 p-4 bg-green-50 rounded-xl border border-green-200 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="size-4 text-green-600" />
                  <p className="text-sm text-green-700 font-medium">
                    🔐 Your messages are encrypted
                  </p>
                </div>
                <p className="text-xs text-green-600">
                  Only you and {selectedUser.fullName} can read these messages
                </p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const prevMessage = messages[index - 1];
            const nextMessage = messages[index + 1];
            const currDate = new Date(message.createdAt).toDateString();
            const prevDate = prevMessage ? new Date(prevMessage.createdAt).toDateString() : null;
            const showDateLabel = currDate !== prevDate;

            // FIXED: Use currentUser.username to properly determine if message is from current user
            const isOwnMessage = message.senderId === currentUser?.username;
            const isConsecutive = isConsecutiveMessage(message, prevMessage);
            const isLastInGroup = !nextMessage || !isConsecutiveMessage(nextMessage, message);

            const messageStatus = getMessageStatusDisplay(message, isOwnMessage);

            return (
              <div key={message._id}>
                {showDateLabel && (
                  <div className="flex items-center justify-center my-6">
                    <div className="bg-base-200/80 backdrop-blur-sm text-base-content/60 text-xs font-medium px-4 py-2 rounded-full shadow-sm">
                      {getDateLabel(message.createdAt)}
                    </div>
                  </div>
                )}

                <div
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} ${
                    isConsecutive ? "mb-1" : "mb-3"
                  }`}
                  ref={index === messages.length - 1 ? messageEndRef : null}
                >
                  {/* Avatar - only show for first message in group and received messages */}
                  {!isOwnMessage && !isConsecutive && (
                    <div className="mr-2 mt-auto">
                      <div className="size-8 rounded-full border border-base-300/50 shadow-sm overflow-hidden">
                        <img
                          src={selectedUser.profilePic}
                          alt="profile pic"
                          className="rounded-full object-cover"
                          onError={(e) => {
                            e.target.src = '/avatar.png';
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Spacer for consecutive received messages */}
                  {!isOwnMessage && isConsecutive && (
                    <div className="w-10"></div>
                  )}

                  <div className="max-w-[70%] flex flex-col">
                    {/* Message bubble */}
                    <div
                      className={`px-3 py-2 shadow-sm relative ${
                        isOwnMessage
                          ? "bg-gradient-to-br from-primary to-primary/90 text-primary-content ml-auto"
                          : "bg-base-200 text-base-content"
                      } ${
                        // Rounded corners based on position in group
                        isOwnMessage
                          ? isConsecutive
                            ? isLastInGroup
                              ? "rounded-l-2xl rounded-tr-2xl rounded-br-md" // Last in group
                              : "rounded-l-2xl rounded-r-md" // Middle of group
                            : isLastInGroup
                            ? "rounded-l-2xl rounded-tr-2xl rounded-br-md" // Single or last
                            : "rounded-l-2xl rounded-tr-2xl rounded-br-sm" // First in group
                          : isConsecutive
                          ? isLastInGroup
                            ? "rounded-r-2xl rounded-tl-2xl rounded-bl-md" // Last in group
                            : "rounded-r-2xl rounded-l-md" // Middle of group
                          : isLastInGroup
                          ? "rounded-r-2xl rounded-tl-2xl rounded-bl-md" // Single or last
                          : "rounded-r-2xl rounded-tl-2xl rounded-bl-sm" // First in group
                      }`}
                    >
                      {/* Encryption indicator for received messages */}
                      {!isOwnMessage && !isConsecutive && message.isEncrypted && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                          <Shield className="w-2 h-2 text-white" />
                        </div>
                      )}

                      {/* Decryption failed indicator */}
                      {message.decryptionFailed && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">!</span>
                        </div>
                      )}

                      {/* Message content */}
                      <div className="flex flex-col">
                        {message.image && (
                          <img
                            src={message.image}
                            alt="Attachment"
                            className="max-w-[200px] rounded-lg mb-2 shadow-sm"
                          />
                        )}

                        {message.text && (
                          <div className="flex items-end gap-2">
                            <p className={`leading-relaxed flex-1 ${message.decryptionFailed ? 'text-red-300 italic' : ''}`}>
                              {message.text}
                            </p>

                            {/* Time and status in bottom right */}
                            <div className="flex items-center gap-1 text-xs flex-shrink-0 ml-2 mt-1">
                              <span className="text-[11px] opacity-70">
                                {formatMessageTime(message.createdAt)}
                              </span>

                              {/* Status indicator for own messages */}
                              {messageStatus && (
                                <div className={`flex items-center ${messageStatus.className}`}>
                                  {messageStatus.icon}
                                </div>
                              )}

                              {/* Encryption indicator for own messages */}
                              {isOwnMessage && message.isEncrypted && (
                                <Shield className="size-2 opacity-70" />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status text below message for own messages */}
                    {messageStatus && isOwnMessage && (
                      <div className="text-xs text-base-content/50 mt-1 text-right flex items-center justify-end gap-1">
                        {messageStatus.text}
                        {message.isEncrypted && <span className="text-green-600">• Encrypted</span>}
                        {message.decryptionFailed && <span className="text-red-600">• Decryption failed</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <MessageInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatContainer;
