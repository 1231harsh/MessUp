import { useEffect, useRef, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import { useChatStore } from "../store/useChatStore";
import {
  MessageSquare,
  Loader2,
  Check,
  CheckCheck,
  ShieldCheck,
  Lock,
} from "lucide-react";
import encryptionService from "../lib/encryption";
import EncryptedImageMessage from "./EncryptedImageMessage";

const ChatContainer = ({ selectedUser, onClose }) => {
  const messageEndRef = useRef(null);

  const { sendMessage, currentUser, isLoadingOldMessages, getMessageStatus } =
    useChatStore();

  // Subscribe to messages
  const messages = useChatStore((state) =>
    selectedUser ? state.messages[selectedUser.username] || [] : [],
  );

  const [hasEncryption, setHasEncryption] = useState(false);

  /* ================= Encryption status ================= */
  useEffect(() => {
    if (selectedUser) {
      setHasEncryption(encryptionService.isInitialized);
    }
  }, [selectedUser]);

  /* ================= Auto scroll ================= */
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (text, image) => {
    if (!text.trim() && !image) return;
    await sendMessage(text, image);
  };

  if (!selectedUser) return null;

  const isLoadingMessages = isLoadingOldMessages(selectedUser.username);

  /* ================= Message status ================= */
  const getMessageStatusDisplay = (message, isOwn) => {
    if (!isOwn) return null;

    if (message.isTemp) {
      return {
        icon: <Loader2 className="size-3 animate-spin" />,
        text: "Sending...",
      };
    }

    const status = message.status || getMessageStatus(message._id);

    switch (status) {
      case "DELIVERED":
        return { icon: <CheckCheck className="size-3" />, text: "Delivered" };
      case "READ":
        return {
          icon: <CheckCheck className="size-3 text-blue-400" />,
          text: "Read",
        };
      default:
        return { icon: <Check className="size-3" />, text: "Sent" };
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-base-100">
      <ChatHeader user={selectedUser} onClose={onClose} />

      {/* Encryption banner */}
      <div
        className={`px-4 py-2 border-b flex items-center justify-center gap-2 ${
          hasEncryption
            ? "bg-green-50 border-green-200"
            : "bg-yellow-50 border-yellow-200"
        }`}
      >
        {hasEncryption ? (
          <>
            <ShieldCheck className="size-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">
              End-to-end encrypted
            </span>
          </>
        ) : (
          <>
            <Lock className="size-4 text-yellow-600" />
            <span className="text-sm text-yellow-700 font-medium">
              Setting up encryption...
            </span>
          </>
        )}
      </div>

      {/* ================= Messages ================= */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {isLoadingMessages ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin size-6 text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="mx-auto size-12 text-primary" />
            <p className="mt-4 text-base-content/60">
              Start your encrypted conversation
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwn = message.senderId === currentUser?.username;
            const status = getMessageStatusDisplay(message, isOwn);

            return (
              <div key={message._id}>
                <div
                  ref={index === messages.length - 1 ? messageEndRef : null}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[70%]">
                    {/* Message bubble */}
                    <div
                      className={`px-3 py-2 rounded-lg ${
                        isOwn
                          ? "bg-primary text-primary-content"
                          : "bg-base-200"
                      }`}
                    >
                      {/* IMAGE MESSAGE */}
                      {message.mediaType === "IMAGE" && (
                        <>
                          {/* Temp uploading message */}
                          {message.isTemp && (
                            <div className="text-xs italic opacity-80 flex items-center gap-2">
                              <Loader2 className="size-3 animate-spin" />
                              Uploading image...
                            </div>
                          )}

                          {/* Final image */}
                          {!message.isTemp && message.mediaId && (
                            <EncryptedImageMessage message={message} />
                          )}

                          {/* Edge case fallback */}
                          {!message.isTemp && !message.mediaId && (
                            <div className="text-xs italic opacity-70">
                              Processing image...
                            </div>
                          )}
                        </>
                      )}

                      {/* TEXT MESSAGE */}
                      {message.text && <p>{message.text}</p>}
                    </div>

                    {/* Status */}
                    {status && isOwn && (
                      <div className="text-xs text-right mt-1 flex items-center justify-end gap-1 opacity-80">
                        {status.icon}
                        {status.text}
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
