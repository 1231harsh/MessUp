import { create } from "zustand";
import webSocketService from "../lib/websocket";
import { getCurrentUser, getOldChatMessages } from "../lib/api";
import encryptionService from "../lib/encryption";
import { useAuthStore } from "./useAuthStore";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const useChatStore = create((set, get) => ({
  /* ================= STATE ================= */
  messages: {},
  messageStatuses: {},
  selectedUser: null,
  isConnected: false,
  isLoading: false,
  currentUser: null,
  loadingOldMessages: {},

  /* ================= INIT ================= */
  initializeWebSocket: async () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) return false;

    try {
      const currentUser = await getCurrentUser();
      if (!currentUser?.username) return false;

      set({ currentUser, isLoading: true });

      await encryptionService.initialize(currentUser.username);
      await webSocketService.connect(currentUser.username);

      webSocketService.addMessageHandler(
        "chatStore",
        get().handleIncomingMessage,
      );

      set({ isConnected: true, isLoading: false });
      return true;
    } catch (err) {
      console.error("WS init failed:", err);
      set({ isConnected: false, isLoading: false });
      return false;
    }
  },

  disconnectWebSocket: () => {
    webSocketService.removeMessageHandler("chatStore");
    webSocketService.disconnect();
    set({ isConnected: false });
  },

  /* ================= HISTORY ================= */
  loadOldMessages: async (username) => {
    if (get().loadingOldMessages[username]) return;

    set((s) => ({
      loadingOldMessages: { ...s.loadingOldMessages, [username]: true },
    }));

    try {
      const oldMessages = await getOldChatMessages(username);

      const processed = await Promise.all(
        oldMessages.map(async (msg) => {
          let text = msg.text || "[Empty message]";
          let isEncrypted = false;
          let decryptionFailed = false;

          if (msg.text && encryptionService.isEncryptedMessage(msg.text)) {
            try {
              text = await encryptionService.decryptMessage(msg.text);
              isEncrypted = true;
            } catch {
              text = "[Message could not be decrypted]";
              isEncrypted = true;
              decryptionFailed = true;
            }
          }

          return {
            ...msg,
            text,
            isEncrypted,
            decryptionFailed,
            status: msg.status || "SENT",
          };
        }),
      );

      set((state) => {
        const existing = state.messages[username] || [];
        const map = new Map();

        [...processed, ...existing].forEach((m) => map.set(m._id, m));

        const merged = [...map.values()].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        );

        return {
          messages: { ...state.messages, [username]: merged },
          loadingOldMessages: {
            ...state.loadingOldMessages,
            [username]: false,
          },
        };
      });
    } catch (e) {
      console.error("Load history failed:", e);
      set((s) => ({
        loadingOldMessages: { ...s.loadingOldMessages, [username]: false },
      }));
    }
  },

  /* ================= USER SELECT ================= */
  selectUser: async (user) => {
    set({ selectedUser: user });

    const msgs = get().messages[user.username];
    if (!msgs || msgs.length === 0) {
      await get().loadOldMessages(user.username);
    }

    // mark messages as READ locally
    set((state) => {
      const updated = (state.messages[user.username] || []).map((m) =>
        m.senderId !== state.currentUser?.username
          ? { ...m, status: "READ" }
          : m,
      );

      return {
        messages: { ...state.messages, [user.username]: updated },
      };
    });
  },

  /* ================= SEND ================= */
  sendMessage: async (text, image = null) => {
    const { selectedUser, currentUser } = get();
    if (!selectedUser || !currentUser || (!text.trim() && !image)) return false;
    if (!webSocketService.isConnected()) return false;

    const tempId = `temp-${Date.now()}-${Math.random()}`;

    const tempMessage = {
      _id: tempId,
      clientId: tempId,
      senderId: currentUser.username,
      receiverId: selectedUser.username,
      text: image ? null : text,
      mediaType: image ? "IMAGE" : null,
      createdAt: new Date().toISOString(),
      isTemp: true,
      status: "SENDING",
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [selectedUser.username]: [
          ...(state.messages[selectedUser.username] || []),
          tempMessage,
        ],
      },
      messageStatuses: {
        ...state.messageStatuses,
        [tempId]: "SENDING",
      },
    }));

    try {
      if (image) {
        const encrypted = await encryptionService.encryptImage(
          image,
          selectedUser.username,
        );

        const fd = new FormData();
        fd.append("file", encrypted.encryptedBlob);
        fd.append("receiverId", selectedUser.username);
        fd.append("contentType", encrypted.originalContentType);

        const res = await fetch(`${API_BASE_URL}/api/media/images`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });

        const { mediaId } = await res.json();

        await webSocketService.sendPrivateMessage(
          currentUser.username,
          selectedUser.username,
          null,
          tempId,
          {
            mediaType: "IMAGE",
            mediaId,
            encryptedKeyForRecipient: encrypted.encryptedKeyForRecipient,
            encryptedKeyForSender: encrypted.encryptedKeyForSender,
            iv: encrypted.iv,
            contentType: encrypted.originalContentType,
          },
        );
      } else {
        await webSocketService.sendPrivateMessage(
          currentUser.username,
          selectedUser.username,
          text,
          tempId,
        );
      }

      return true;
    } catch {
      get().updateMessageStatus(
        selectedUser.username,
        tempId,
        "FAILED",
        tempId,
      );
      return false;
    }
  },

  /* ================= INCOMING ================= */
  handleIncomingMessage: async (data) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const otherUser =
      data.sender === currentUser.username ? data.receiver : data.sender;

    if (data.type === "private" || data.type === "sent") {
      const incomingTempId = data.clientId || data.tempId;

      const base = {
        _id: data.messageId,
        clientId: incomingTempId,
        senderId: data.sender,
        receiverId: data.receiver,
        createdAt: data.timestamp || new Date().toISOString(),
        status: "SENT",
        isTemp: false,
      };

      let message = base;

      if (data.mediaType === "IMAGE") {
        message = {
          ...base,
          mediaType: "IMAGE",
          mediaId: data.mediaId,
          iv: data.iv,
          encryptedKeyForRecipient: data.encryptedKeyForRecipient,
          encryptedKeyForSender: data.encryptedKeyForSender,
          contentType: data.contentType,
        };
      } else {
        let text = data.message;
        if (text && encryptionService.isEncryptedMessage(text)) {
          try {
            text = await encryptionService.decryptMessage(text);
          } catch {
            text = "[Message could not be decrypted]";
          }
        }
        message = { ...base, text };
      }

      set((state) => {
        const existing = [...(state.messages[otherUser] || [])];

        const idx = existing.findIndex(
          (m) => m.isTemp && m.clientId === incomingTempId,
        );

        if (idx !== -1) {
          const old = existing[idx];
          existing[idx] = { ...message, createdAt: old.createdAt };
        } else {
          existing.push(message);
        }

        const statuses = { ...state.messageStatuses };
        if (incomingTempId) delete statuses[incomingTempId];
        statuses[message._id] = "SENT";

        return {
          messages: { ...state.messages, [otherUser]: existing },
          messageStatuses: statuses,
        };
      });
    }

    if (data.type === "delivered" || data.type === "read") {
      get().updateMessageStatus(
        otherUser,
        data.messageId,
        data.type.toUpperCase(),
        data.tempId,
      );
    }
  },

  /* ================= STATUS ================= */
  updateMessageStatus: (username, messageId, status, tempId) => {
    set((state) => {
      const msgs = [...(state.messages[username] || [])];
      const idx = msgs.findIndex(
        (m) => m._id === messageId || (tempId && m.clientId === tempId),
      );

      if (idx !== -1) {
        msgs[idx] = { ...msgs[idx], _id: messageId, status, isTemp: false };
      }

      const statuses = { ...state.messageStatuses };
      if (tempId) delete statuses[tempId];
      statuses[messageId] = status;

      return {
        messages: { ...state.messages, [username]: msgs },
        messageStatuses: statuses,
      };
    });
  },

  /* ================= GETTERS ================= */
  getMessagesForUser: (u) => get().messages[u] || [],
  getLastMessageForUser: (u) => {
    const m = get().messages[u] || [];
    return m[m.length - 1] || null;
  },
  getUnreadCountForUser: (u) => {
    const { messages, currentUser } = get();
    return (messages[u] || []).filter(
      (m) => m.senderId !== currentUser?.username && m.status !== "READ",
    ).length;
  },
  getMessageStatus: (id) => get().messageStatuses[id] || "SENT",
  isLoadingOldMessages: (username) =>
    get().loadingOldMessages[username] || false,
}));

export { useChatStore };
