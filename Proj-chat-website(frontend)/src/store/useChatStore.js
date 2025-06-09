import { create } from "zustand";
import webSocketService from "../lib/websocket";
import { getCurrentUserFromToken } from "../lib/jwtUtils";
import { getOldChatMessages } from "../lib/api";

const useChatStore = create((set, get) => ({
  // State
  messages: {},
  selectedUser: null,
  isConnected: false,
  isLoading: false,
  currentUser: null,
  loadingOldMessages: {},

  // Initialize WebSocket
  initializeWebSocket: async () => {
    const currentUser = getCurrentUserFromToken();
    if (!currentUser?.username) {
      console.error('❌ No username found');
      return false;
    }

    try {
      set({ currentUser, isLoading: true });

      await webSocketService.connect(currentUser.username);

      webSocketService.addMessageHandler('chatStore', (messageData) => {
        get().handleIncomingMessage(messageData);
      });

      set({ isConnected: true, isLoading: false });
      console.log('✅ WebSocket ready');
      return true;
    } catch (error) {
      console.error('❌ WebSocket failed:', error);
      set({ isConnected: false, isLoading: false });
      return false;
    }
  },

  // Disconnect
  disconnectWebSocket: () => {
    webSocketService.removeMessageHandler('chatStore');
    webSocketService.disconnect();
    set({ isConnected: false });
  },

  // Load old messages for a user
  loadOldMessages: async (username) => {
    const { loadingOldMessages } = get();

    // Prevent multiple simultaneous loads for the same user
    if (loadingOldMessages[username]) {
      return;
    }

    set((state) => ({
      loadingOldMessages: {
        ...state.loadingOldMessages,
        [username]: true
      }
    }));

    try {
      console.log('🔄 Loading old messages for:', username);
      const oldMessages = await getOldChatMessages(username);

      console.log('📥 Loaded old messages:', oldMessages.length);

      // Sort messages by timestamp (oldest first)
      const sortedMessages = oldMessages.sort((a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt)
      );

      set((state) => ({
        messages: {
          ...state.messages,
          [username]: sortedMessages
        },
        loadingOldMessages: {
          ...state.loadingOldMessages,
          [username]: false
        }
      }));

      return sortedMessages;
    } catch (error) {
      console.error('❌ Failed to load old messages:', error);

      set((state) => ({
        loadingOldMessages: {
          ...state.loadingOldMessages,
          [username]: false
        }
      }));

      return [];
    }
  },

  // Select user and load their old messages
  selectUser: async (user) => {
    set({ selectedUser: user });

    // Check if we already have messages for this user
    const { messages } = get();
    if (!messages[user.username] || messages[user.username].length === 0) {
      // Load old messages if we don't have any
      await get().loadOldMessages(user.username);
    }
  },

  // Send message
  sendMessage: async (text, image = null) => {
    const { selectedUser, currentUser } = get();

    if (!selectedUser || !currentUser || !text.trim()) {
      return false;
    }

    if (!webSocketService.isConnected()) {
      console.error('❌ Not connected');
      return false;
    }

    try {
      // Add to local state immediately
      const tempMessage = {
        _id: `temp-${Date.now()}`,
        senderId: currentUser.username,
        receiverId: selectedUser.username,
        text: text,
        createdAt: new Date().toISOString(),
        isTemp: true
      };

      set((state) => ({
        messages: {
          ...state.messages,
          [selectedUser.username]: [
            ...(state.messages[selectedUser.username] || []),
            tempMessage
          ]
        }
      }));

      // Send via WebSocket
      webSocketService.sendPrivateMessage(
        currentUser.username,
        selectedUser.username,
        text
      );

      return true;
    } catch (error) {
      console.error('❌ Send failed:', error);
      return false;
    }
  },

  // Handle incoming messages
  handleIncomingMessage: (messageData) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const otherUser = messageData.sender === currentUser.username
      ? messageData.receiver
      : messageData.sender;

    const formattedMessage = {
      _id: `ws-${Date.now()}-${Math.random()}`,
      senderId: messageData.sender,
      receiverId: messageData.receiver,
      text: messageData.message,
      createdAt: new Date().toISOString()
    };

    set((state) => {
      const existing = state.messages[otherUser] || [];

      // Remove any temp messages with same content
      const filtered = existing.filter(msg =>
        !(msg.isTemp && msg.text === formattedMessage.text && msg.senderId === formattedMessage.senderId)
      );

      return {
        messages: {
          ...state.messages,
          [otherUser]: [...filtered, formattedMessage]
        }
      };
    });
  },

  // Get messages for user
  getMessagesForUser: (username) => {
    const { messages } = get();
    return messages[username] || [];
  },

  // Get last message
  getLastMessageForUser: (username) => {
    const messages = get().getMessagesForUser(username);
    return messages.length > 0 ? messages[messages.length - 1] : null;
  },

  // Get unread count (placeholder)
  getUnreadCountForUser: (username) => {
    return 0;
  },

  // Check if old messages are loading
  isLoadingOldMessages: (username) => {
    const { loadingOldMessages } = get();
    return loadingOldMessages[username] || false;
  }
}));

export { useChatStore };
