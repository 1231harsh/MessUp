import { create } from "zustand";
import webSocketService from "../lib/websocket";
import { getCurrentUser } from "../lib/api";
import { getOldChatMessages } from "../lib/api";
import encryptionService from "../lib/encryption";
import { useAuthStore } from "./useAuthStore";


const useChatStore = create((set, get) => ({
  // State
  messages: {},
  messageStatuses: {},
  selectedUser: null,
  isConnected: false,
  isLoading: false,
  currentUser: null,
  loadingOldMessages: {},

  // Initialize WebSocket and encryption
  initializeWebSocket: async () => {

    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      console.warn("⚠️ Skipping WebSocket init — not authenticated");
      return;
    }

    try {
      // Get current user from backend
      const currentUser = await getCurrentUser();
      if (!currentUser?.username) {
        console.error('❌ No username found');
        return false;
      }

      set({ currentUser, isLoading: true });

      // Initialize encryption service with username
      console.log('🔐 Initializing encryption for user:', currentUser.username);
      await encryptionService.initialize(currentUser.username);

      await webSocketService.connect(currentUser.username);

      webSocketService.addMessageHandler('chatStore', (messageData) => {
        get().handleIncomingMessage(messageData);
      });

      set({ isConnected: true, isLoading: false });
      console.log('✅ WebSocket and encryption ready');
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
    // encryptionService.clearKeys();
    set({ isConnected: false });
  },

  // Load old messages for a user and decrypt them
  loadOldMessages: async (username) => {
    const { loadingOldMessages } = get();

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

      // Process messages and attempt decryption
      const processedMessages = await Promise.all(
        oldMessages.map(async (msg, index) => {
          if (!msg.text || typeof msg.text !== 'string') {
            console.warn(`⚠️ Message ${index} has no text or invalid text format`);
            return {
              ...msg,
              text: '[Empty message]',
              decryptionFailed: true
            };
          }

          if (encryptionService.isEncryptedMessage(msg.text)) {
            try {
              console.log(`🔓 Attempting to decrypt old message ${index}...`);
              const decryptedText = await encryptionService.decryptMessage(msg.text);

              if (decryptedText &&
                  !decryptedText.startsWith('[') &&
                  !decryptedText.includes('could not be decrypted') &&
                  !decryptedText.includes('key mismatch')) {
                console.log(`✅ Old message ${index} decrypted successfully`);
                return {
                  ...msg,
                  text: decryptedText,
                  isEncrypted: true,
                  decryptionSuccessful: true
                };
              } else {
                console.warn(`⚠️ Decryption failed for message ${index}:`, decryptedText);
                return {
                  ...msg,
                  text: decryptedText || '[Message could not be decrypted]',
                  isEncrypted: true,
                  decryptionFailed: true
                };
              }
            } catch (error) {
              console.warn(`⚠️ Failed to decrypt old message ${index}:`, error);
              return {
                ...msg,
                text: '[Message could not be decrypted]',
                isEncrypted: true,
                decryptionFailed: true
              };
            }
          }

          return {
            ...msg,
            isEncrypted: false
          };
        })
      );

      const sortedMessages = processedMessages.sort((a, b) =>
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

  // Select user and set up encryption
  selectUser: async (user) => {
    set({ selectedUser: user });

    console.log(`🔐 Setting up chat with ${user.username}...`);

    const { messages } = get();
    if (!messages[user.username] || messages[user.username].length === 0) {
      await get().loadOldMessages(user.username);
    }
  },

  // Send message (will be encrypted automatically)
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
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const tempMessage = {
        _id: messageId,
        senderId: currentUser.username,
        receiverId: selectedUser.username,
        text: text,
        createdAt: new Date().toISOString(),
        isTemp: true,
        status: 'SENT'
      };

      set((state) => ({
        messages: {
          ...state.messages,
          [selectedUser.username]: [
            ...(state.messages[selectedUser.username] || []),
            tempMessage
          ]
        },
        messageStatuses: {
          ...state.messageStatuses,
          [messageId]: 'SENT'
        }
      }));

      await webSocketService.sendPrivateMessage(
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

  // Handle incoming messages (decrypt them if needed)
  handleIncomingMessage: async (messageData) => {
    const { currentUser } = get();
    if (!currentUser) return;

    const otherUser = messageData.sender === currentUser.username
      ? messageData.receiver
      : messageData.sender;

    let decryptedText = messageData.message;
    let isEncrypted = false;
    let decryptionFailed = false;

    if (messageData.message && encryptionService.isEncryptedMessage(messageData.message)) {
      try {
        console.log('🔓 Attempting to decrypt incoming message...');
        decryptedText = await encryptionService.decryptMessage(messageData.message);

        if (decryptedText &&
            !decryptedText.startsWith('[') &&
            !decryptedText.includes('could not be decrypted') &&
            !decryptedText.includes('key mismatch')) {
          isEncrypted = true;
          console.log('✅ Incoming message decrypted successfully');
        } else {
          console.error('❌ Decryption failed:', decryptedText);
          isEncrypted = true;
          decryptionFailed = true;
        }
      } catch (error) {
        console.error('❌ Failed to decrypt incoming message:', error);
        decryptedText = '[Message could not be decrypted]';
        isEncrypted = true;
        decryptionFailed = true;
      }
    }

    const formattedMessage = {
      _id: messageData.messageId || `ws-${Date.now()}-${Math.random()}`,
      senderId: messageData.sender,
      receiverId: messageData.receiver,
      text: decryptedText,
      createdAt: messageData.timestamp || new Date().toISOString(),
      status: 'DELIVERED',
      isEncrypted: isEncrypted,
      decryptionFailed: decryptionFailed
    };

    set((state) => {
      const existing = state.messages[otherUser] || [];

      const filtered = existing.filter((msg) => {
        const isDuplicate =
          msg.senderId === formattedMessage.senderId &&
          msg.text === formattedMessage.text &&
          Math.abs(
            new Date(msg.createdAt) - new Date(formattedMessage.createdAt)
          ) < 2000;
        return !isDuplicate;
      });

      return {
        messages: {
          ...state.messages,
          [otherUser]: [...filtered, formattedMessage]
        },
        messageStatuses: {
          ...state.messageStatuses,
          [formattedMessage._id]: 'DELIVERED'
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

  // Get unread count
  getUnreadCountForUser: (username) => {
    const { messages, currentUser } = get();
    const userMessages = messages[username] || [];

    return userMessages.filter(msg =>
      msg.senderId !== currentUser?.username &&
      (!msg.status || msg.status !== 'read')
    ).length;
  },

  // Get message status
  getMessageStatus: (messageId) => {
    const { messageStatuses } = get();
    return messageStatuses[messageId] || 'SENT';
  },

  // Check if old messages are loading
  isLoadingOldMessages: (username) => {
    const { loadingOldMessages } = get();
    return loadingOldMessages[username] || false;
  }
}));

export { useChatStore };
