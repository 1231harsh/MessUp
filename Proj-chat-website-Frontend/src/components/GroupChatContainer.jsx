import { useEffect, useRef, useState, useMemo } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import { formatMessageTime } from "../lib/utils";
import { useGroupChatStore } from "../store/useGroupChatStore";
import groupWebSocketService from "../lib/groupWebSocket";
import groupEncryptionService from "../lib/groupEncryptionService";
import { getCurrentUserFromToken } from "../lib/jwtUtils";
import { Loader2, Users, CheckCheck } from "lucide-react";

const GroupChatContainer = ({ onClose }) => {
  const messageEndRef = useRef(null);
  const [authUser, setAuthUser] = useState(null);

  const [showMembers, setShowMembers] = useState(false);
  const [ready, setReady] = useState(false);
  const [decryptedMessages, setDecryptedMessages] = useState([]);

  /* ---------------- STORE (STABLE SELECTORS) ---------------- */

  const selectedGroup = useGroupChatStore((s) => s.selectedGroup);
  const groupId = selectedGroup?.id;

  const rawMessages = useGroupChatStore((s) => s.messages);
  const rawMembers = useGroupChatStore((s) => s.groupMembers);
  const loadingMap = useGroupChatStore((s) => s.loadingOldMessages);

  const messages = useMemo(
    () => (groupId ? rawMessages[groupId] || [] : []),
    [rawMessages, groupId],
  );

  const groupMembers = useMemo(
    () => (groupId ? rawMembers[groupId] || [] : []),
    [rawMembers, groupId],
  );

  const isLoading = groupId ? loadingMap[groupId] : false;

  const sendGroupMessage = useGroupChatStore((s) => s.sendGroupMessage);
  const loadOldMessages = useGroupChatStore((s) => s.loadOldMessages);
  const loadGroupMembers = useGroupChatStore((s) => s.loadGroupMembers);

  useEffect(() => {
    let active = true;

    const loadAuthUser = async () => {
      try {
        const user = await getCurrentUserFromToken();
        if (active) {
          setAuthUser(user);
        }
      } catch {
        if (active) {
          setAuthUser(null);
        }
      }
    };

    loadAuthUser();

    return () => {
      active = false;
    };
  }, []);

  const reloadGroupKey = async () => {
    if (!groupId) return;

    setReady(false);
    setDecryptedMessages([]);
    await groupEncryptionService.loadGroupKey(groupId, { forceReload: true });
    setReady(true);
  };

  /* ---------------- LOAD GROUP KEY ---------------- */

  useEffect(() => {
    if (!groupId) return;

    let active = true;

    (async () => {
      setReady(false);
      setDecryptedMessages([]);
      await groupEncryptionService.loadGroupKey(groupId);
      if (active) setReady(true);
    })();

    return () => {
      active = false;
      setDecryptedMessages([]);
      groupEncryptionService.clearGroup(groupId);
    };
  }, [groupId]);

  /* ---------------- SUBSCRIBE ---------------- */

  useEffect(() => {
    if (!groupId || !ready) return;

    groupWebSocketService.subscribeToGroup(groupId);
    groupWebSocketService.subscribeToGroupKeyUpdates(groupId);
    groupWebSocketService.addKeyUpdateHandler("groupChatContainer", async (updatedGroupId) => {
      if (updatedGroupId !== groupId) return;

      await reloadGroupKey();
      await loadOldMessages(groupId);
      await loadGroupMembers(groupId);
    });

    loadOldMessages(groupId);
    loadGroupMembers(groupId);

    return () => {
      groupWebSocketService.removeKeyUpdateHandler("groupChatContainer");
      groupWebSocketService.unsubscribeFromGroupKeyUpdates(groupId);
      groupWebSocketService.unsubscribeFromGroup(groupId);
    };
  }, [groupId, ready]);

  /* ---------------- DECRYPT ---------------- */

  useEffect(() => {
    if (!ready || !groupId) {
      setDecryptedMessages([]);
      return;
    }

    let active = true;

    const decryptAllMessages = async () => {
      const nextMessages = await Promise.all(
        messages.map(async (msg) => {
          if (!msg?.iv || !msg?.text) return msg;

          try {
            const plainText = await groupEncryptionService.decryptMessage(
              groupId,
              msg.text,
              msg.iv,
            );

            return { ...msg, text: plainText };
          } catch {
            return { ...msg, text: "🔒 Unable to decrypt" };
          }
        }),
      );

      if (active) {
        setDecryptedMessages(nextMessages);
      }
    };

    decryptAllMessages();

    return () => {
      active = false;
    };
  }, [messages, ready, groupId]);

  /* ---------------- AUTO SCROLL ---------------- */

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* ---------------- SEND ---------------- */

  const handleSendMessage = async (text) => {
    if (!text.trim() || !groupId || !ready) return;

    const encrypted = await groupEncryptionService.encryptMessage(
      groupId,
      text,
    );

    await sendGroupMessage(groupId, encrypted.message, encrypted.iv);
  };

  if (!selectedGroup) return null;

  /* ---------------- UI ---------------- */

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-base-100">
      <ChatHeader
        user={{
          fullName: `${selectedGroup.name} (${groupMembers.length} members)`,
          username: selectedGroup.name,
        }}
        onClose={onClose}
        isGroup
      />

      <div className="px-4 py-2 border-b bg-base-50">
        <button
          onClick={() => setShowMembers(!showMembers)}
          className="flex items-center gap-2 text-sm"
        >
          <Users className="size-4" />
          {groupMembers.length} members
        </button>

        {showMembers && (
          <div className="mt-2 flex flex-wrap gap-2">
            {groupMembers.map((m) => (
              <div
                key={`member-${m.username}`}
                className="px-3 py-1 rounded-full bg-base-200 text-sm"
              >
                {m.username} {m.username === authUser?.username && "(You)"}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {!ready || isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin" />
          </div>
        ) : decryptedMessages.length === 0 ? (
          <div className="text-center py-20 text-base-content/60">
            <Users className="mx-auto mb-3" />
            Start conversation in {selectedGroup.name}
          </div>
        ) : (
          decryptedMessages.map((msg, i) => {
            const isOwn = msg.senderId === authUser?.username;

            return (
              <div
                key={msg._id}
                ref={i === decryptedMessages.length - 1 ? messageEndRef : null}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`px-3 py-2 rounded-lg max-w-[70%] ${
                    isOwn ? "bg-primary text-white" : "bg-base-200"
                  }`}
                >
                  {!isOwn && (
                    <div className="text-xs text-primary font-semibold mb-1">
                      {msg.senderName || msg.senderId}
                    </div>
                  )}

                  <p>{msg.text}</p>

                  <div className="text-[10px] opacity-70 text-right flex gap-1 justify-end items-center">
                    {formatMessageTime(msg.createdAt)}
                    {isOwn && <CheckCheck size={12} />}
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

export default GroupChatContainer;
