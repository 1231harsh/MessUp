import { create } from "zustand";
import groupWebSocketService from "../lib/groupWebSocket";
import { getCurrentUser } from "../lib/api";
import {
  getUserGroups,
  getGroupMessages,
  getGroupMembers,
} from "../lib/groupApi";

const useGroupChatStore = create((set, get) => ({
  /* ================= STATE ================= */

  messages: {},
  groups: [],
  groupMembers: {},
  selectedGroup: null,
  currentUser: null,
  loadingOldMessages: {},
  isConnected: false,

  /* ================= INIT ================= */

  initializeGroupWebSocket: async () => {
    if (get().isConnected) return true;

    const currentUser = await getCurrentUser();
    if (!currentUser?.username) return false;

    set({ currentUser });

    await groupWebSocketService.connect(currentUser.username);

    groupWebSocketService.addMessageHandler(
      "groupStore",
      get().handleIncomingGroupMessage,
    );

    set({ isConnected: true });

    await get().loadUserGroups();
    return true;
  },

  disconnectGroupWebSocket: () => {
    groupWebSocketService.removeMessageHandler("groupStore");
    groupWebSocketService.disconnect();
    set({ isConnected: false });
  },

  /* ================= GROUPS ================= */

  loadUserGroups: async () => {
    const groups = (await getUserGroups()) || [];
    set({ groups });
    return groups;
  },

  refreshGroups: async () => {
    try {
      await get().loadUserGroups();
    } catch (err) {
      console.error("Failed to refresh groups", err);
    }
  },

  loadGroupMembers: async (groupId) => {
    const members = await getGroupMembers(groupId);
    set((state) => ({
      groupMembers: { ...state.groupMembers, [groupId]: members || [] },
    }));
  },

  /* ================= HISTORY ================= */

  loadOldMessages: async (groupId) => {
    if (!groupId || get().loadingOldMessages[groupId]) return;

    set((state) => ({
      loadingOldMessages: { ...state.loadingOldMessages, [groupId]: true },
    }));

    const msgs = await getGroupMessages(groupId);

    const processed = (msgs || []).map((m) => ({
      _id: m.messageId,
      senderId: m.sender,
      senderName: m.senderName || m.sender || "Unknown",
      text: m.message,
      iv: m.iv || null,
      createdAt: m.timestamp,
      groupId,
      isTemp: false,
    }));

    processed.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    set((state) => ({
      messages: { ...state.messages, [groupId]: processed },
      loadingOldMessages: { ...state.loadingOldMessages, [groupId]: false },
    }));
  },

  /* ================= SEND ================= */

  sendGroupMessage: async (groupId, encryptedText, iv) => {
    const { currentUser } = get();
    if (!currentUser || !encryptedText?.trim()) return false;

    const tempId = "temp-" + Date.now();

    const tempMessage = {
      _id: tempId,
      senderId: currentUser.username,
      senderName: currentUser.username,
      text: encryptedText,
      iv: iv || null,
      createdAt: new Date().toISOString(),
      groupId,
      isTemp: true,
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [groupId]: [...(state.messages[groupId] || []), tempMessage],
      },
    }));

    groupWebSocketService.sendGroupMessage(
      groupId,
      currentUser.username,
      encryptedText,
      tempId,
      iv,
    );

    return true;
  },

  /* ================= INCOMING ================= */

  handleIncomingGroupMessage: (data, groupId) => {
    if (!data?.messageId) return;

    const message = {
      _id: data.messageId,
      senderId: data.sender,
      senderName: data.senderName || data.sender || "Unknown",
      text: data.message,
      iv: data.iv || null,
      createdAt: data.timestamp,
      groupId,
      isTemp: false,
    };

    set((state) => {
      const existing = [...(state.messages[groupId] || [])];

      // Replace optimistic message
      if (data.tempId) {
        const idx = existing.findIndex((m) => m._id === data.tempId);
        if (idx !== -1) {
          existing[idx] = message;
        } else {
          existing.push(message);
        }
      } else {
        if (!existing.some((m) => m._id === message._id)) {
          existing.push(message);
        }
      }

      existing.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      return { messages: { ...state.messages, [groupId]: existing } };
    });
  },

  /* ================= GETTERS (RESTORED) ================= */

  getMessagesForGroup: (groupId) => {
    return get().messages[groupId] || [];
  },

  getLastMessageForGroup: (groupId) => {
    const msgs = get().messages[groupId] || [];
    return msgs.length ? msgs[msgs.length - 1] : null;
  },

  getUnreadCountForGroup: () => 0,

  isLoadingOldMessages: (groupId) => {
    return get().loadingOldMessages[groupId] || false;
  },

  getGroupMembers: (groupId) => {
    return get().groupMembers[groupId] || [];
  },

  /* ================= NAVIGATION ================= */

  selectGroup: (group) => set({ selectedGroup: group }),
  getSelectedGroup: () => get().selectedGroup,
}));

export { useGroupChatStore };
