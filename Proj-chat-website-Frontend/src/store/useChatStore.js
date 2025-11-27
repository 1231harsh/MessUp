import { create } from "zustand";
import webSocketService from "../lib/websocket";
import { getCurrentUser, getOldChatMessages } from "../lib/api";
import encryptionService from "../lib/encryption";
import { useAuthStore } from "./useAuthStore";

const useChatStore = create((set, get) => ({
  // State
  messages: {}, // { username: [msg1, msg2, ...] }
  messageStatuses: {}, // { messageId: 'SENT' | 'DELIVERED' | 'READ' }
  selectedUser: null,
  isConnected: false,
  isLoading: false,
  currentUser: null,
  loadingOldMessages: {},

  // Initialize WebSocket and encryption
  initializeWebSocket: async () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) return;

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser?.username) return false;

      set({ currentUser, isLoading: true });

      await encryptionService.initialize(currentUser.username);
      await webSocketService.connect(currentUser.username);

      webSocketService.addMessageHandler(
        "chatStore",
        get().handleIncomingMessage
      );

      set({ isConnected: true, isLoading: false });
      return true;
    } catch (error) {
      console.error("WebSocket init failed:", error);
      set({ isConnected: false, isLoading: false });
      return false;
    }
  },

  // Disconnect
  disconnectWebSocket: () => {
    webSocketService.removeMessageHandler("chatStore");
    webSocketService.disconnect();
    set({ isConnected: false });
  },

  // Load old messages
  loadOldMessages: async (username) => {
    const { loadingOldMessages } = get();
    if (loadingOldMessages[username]) return;

    set((state) => ({
      loadingOldMessages: { ...state.loadingOldMessages, [username]: true },
    }));

    try {
      const oldMessages = await getOldChatMessages(username);

      const processedMessages = await Promise.all(
        oldMessages.map(async (msg, index) => {
          let text = msg.text || "[Empty message]";
          let isEncrypted = false;
          let decryptionFailed = false;

          if (msg.text && encryptionService.isEncryptedMessage(msg.text)) {
            try {
              const decrypted = await encryptionService.decryptMessage(
                msg.text
              );
              if (decrypted) text = decrypted;
              isEncrypted = true;
            } catch (e) {
              text = "[Message could not be decrypted]";
              isEncrypted = true;
              decryptionFailed = true;
            }
          }

          const status = msg.status || "SENT";

          return { ...msg, text, isEncrypted, decryptionFailed,status};
        })
      );

      processedMessages.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );

      set((state) => ({
        messages: { ...state.messages, [username]: processedMessages },
        loadingOldMessages: { ...state.loadingOldMessages, [username]: false },
      }));

      return processedMessages;
    } catch (error) {
      console.error("Failed to load old messages:", error);
      set((state) => ({
        loadingOldMessages: { ...state.loadingOldMessages, [username]: false },
      }));
      return [];
    }
  },

  // Select a user
  selectUser: async (user) => {
    set({ selectedUser: user });
    const { messages } = get();
    if (!messages[user.username] || messages[user.username].length === 0) {
      await get().loadOldMessages(user.username);
    }
  },

  // Send a message
  sendMessage: async (text, image = null) => {
    const { selectedUser, currentUser } = get();
    if (
      !selectedUser ||
      !currentUser ||
      !text.trim() ||
      !webSocketService.isConnected()
    ) {
      console.log("❌ Cannot send: missing user, text, or not connected");
      return false;
    }

    const tempMessageId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    console.log(tempMessageId,"This is tempMessageId");
    const tempMessage = {
      _id: tempMessageId,
      clientId: tempMessageId,
      senderId: currentUser.username,
      receiverId: selectedUser.username,
      text,
      createdAt: new Date().toISOString(),
      isTemp: true,
      status: "SENDING",
    };

    console.log("📤 Adding temp message:", tempMessage);

    set((state) => ({
      messages: {
        ...state.messages,
        [selectedUser.username]: [
          ...(state.messages[selectedUser.username] || []),
          tempMessage,
        ],
      },
      messageStatuses: { ...state.messageStatuses, [tempMessageId]: "SENDING" },
    }));

    try {
      await webSocketService.sendPrivateMessage(
        currentUser.username,
        selectedUser.username,
        text,
        tempMessageId
      );
      console.log("✅ Message sent to backend, waiting for confirmation");
      return true;
    } catch (error) {
      console.error("❌ Send failed:", error);
      get().updateMessageStatus(selectedUser.username, tempMessageId, "FAILED");
      return false;
    }
  },

  // Handle incoming message
  handleIncomingMessage: async (messageData) => {
    const { currentUser } = get();
    if (!currentUser) return;

    console.log("📨 Incoming message:", messageData);

    const { type } = messageData; // "private", "delivered", "read"
    const otherUser =
      messageData.sender === currentUser.username
        ? messageData.receiver
        : messageData.sender;

    if (type === "sent") {
      let text = messageData.message;
      let isEncrypted = false;
      let decryptionFailed = false;

      console.log("00000000000000000000000000000000inside00000000000000000000000000000000");
      if (text && encryptionService.isEncryptedMessage(text)) {
        try {
          const decrypted = await encryptionService.decryptMessage(text);
          text = decrypted || "[Message could not be decrypted]";
          isEncrypted = true;
        } catch {
          text = "[Message could not be decrypted]";
          isEncrypted = true;
          decryptionFailed = true;
        }
      }

      const formattedMessage = {
        _id: messageData.messageId,
        senderId: messageData.sender,
        receiverId: messageData.receiver,
        text,
        createdAt: messageData.timestamp || new Date().toISOString(),
        status: "SENT",
        isEncrypted,
        decryptionFailed,
      };

      console.log("💬 Formatted message:", formattedMessage);

      set((state) => {
        const existing = state.messages[otherUser] || [];

        const tempIndex = existing.findIndex(
          (m) =>
            m.isTemp &&
            m.clientId &&
            messageData.clientId &&
            m.clientId === messageData.clientId
        );

        let newMessages;
        if (tempIndex !== -1) {
          console.log("🔄 Replacing temp message at index", tempIndex);
          existing[tempIndex] = { ...formattedMessage, isTemp: false };
          newMessages = [...existing];
        } else {
          const filtered = existing.filter((msg) => {
            const isDuplicate =
              msg.senderId === formattedMessage.senderId &&
              msg.text === formattedMessage.text &&
              Math.abs(
                new Date(msg.createdAt) - new Date(formattedMessage.createdAt)
              ) < 2000;
            return !isDuplicate;
          });
          newMessages = [...filtered, formattedMessage];
        }

        const newMessageStatuses = {
          ...state.messageStatuses,
          [formattedMessage._id]: formattedMessage.status,
        };

        console.log("📊 Updated messages for", otherUser, newMessages);
        console.log("📊 Updated messageStatuses:", newMessageStatuses);

        return {
          messages: { ...state.messages, [otherUser]: newMessages },
          messageStatuses: newMessageStatuses,
        };
      });
    } else if (type === "delivered" || type === "read") {
      console.log(
        `🔔 Updating message status to ${type.toUpperCase()} for messageId:`,
        messageData.messageId
      );
      console.log(messageData.tempId,"Line 263");
      get().updateMessageStatus(
        otherUser,
        messageData.messageId,
        type.toUpperCase(),
        messageData.message,
        messageData.tempId
      );
    }
  },

  // Update message status manually
  updateMessageStatus: (username, messageId, status, messageText, tempId) => {
    set((state) => {
      const msgs = state.messages[username] || [];
      console.log(
        "🔄 Updating status. username:",
        username,
        "messageId:",
        messageId,
        "status:",
        status,
        "messageText:",
        messageText,
        "tempId:",
        tempId
      );


      console.log(tempId);

      const index = msgs.findIndex(
        (m) =>
          m._id === messageId ||
          (m.isTemp && m.text === messageText) ||
          (m.isTemp && tempId && m.clientId === tempId)
      );

      if (index !== -1) {
        console.log("✅ Found message to update at index", index);
        msgs[index] = { ...msgs[index], _id: messageId, status, isTemp: false };
      } else {
        console.warn(
          "⚠️ Could not find message to update with ID or text match"
        );
      }

      const newMessageStatuses = {
        ...state.messageStatuses,
        [messageId]: status,
      };
      return {
        messages: { ...state.messages, [username]: msgs },
        messageStatuses: newMessageStatuses,
      };
    });
  },

  // Getters
  getMessagesForUser: (username) => get().messages[username] || [],
  getLastMessageForUser: (username) => {
    const messages = get().getMessagesForUser(username);
    return messages.length ? messages[messages.length - 1] : null;
  },
  getUnreadCountForUser: (username) => {
    const { messages, currentUser } = get();
    return (messages[username] || []).filter(
      (msg) => msg.senderId !== currentUser?.username && msg.status !== "READ"
    ).length;
  },
  getMessageStatus: (messageId) => get().messageStatuses[messageId] || "SENT",
  isLoadingOldMessages: (username) =>
    get().loadingOldMessages[username] || false,
}));

export { useChatStore };
