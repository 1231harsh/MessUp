import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

class GroupWebSocketService {
  constructor() {
    this.stompClient = null;
    this.connected = false;
    this.messageHandlers = new Map();
    this.groupSubscriptions = new Map();
    this.currentUsername = null;
  }

  connect(username) {
    return new Promise((resolve, reject) => {
      try {
        console.log('🔌 Connecting Group WebSocket for user:', username);
        this.currentUsername = username;

        const socket = new SockJS(`${API_BASE_URL}/chat`);
        this.stompClient = Stomp.over(socket);

        // Disable debug to reduce noise
        this.stompClient.debug = null;

        this.stompClient.connect({},
          (frame) => {
            console.log('✅ Group WebSocket Connected as', username);
            this.connected = true;
            resolve(frame);
          },
          (error) => {
            console.error('❌ Group WebSocket Connection failed:', error);
            this.connected = false;
            reject(error);
          }
        );
      } catch (error) {
        console.error('❌ Failed to create group connection:', error);
        reject(error);
      }
    });
  }

  subscribeToGroup(groupId) {
    if (!this.stompClient || !this.connected) {
      console.warn('⚠️ Cannot subscribe to group: not connected');
      return;
    }

    try {
      const destination = `/topic/group/${groupId}`;
      console.log('📡 Subscribing to group:', destination);

      const subscription = this.stompClient.subscribe(destination, (message) => {
        try {
          const messageData = JSON.parse(message.body);
          console.log('📨 Received group message:', messageData);

          // Notify all handlers
          this.messageHandlers.forEach((handler) => {
            handler(messageData, groupId);
          });
        } catch (error) {
          console.error('❌ Error parsing group message:', error);
        }
      });

      this.groupSubscriptions.set(groupId, subscription);
      console.log('✅ Subscribed to group:', groupId);
    } catch (error) {
      console.error('❌ Group subscription failed:', error);
    }
  }

  unsubscribeFromGroup(groupId) {
    const subscription = this.groupSubscriptions.get(groupId);
    if (subscription) {
      subscription.unsubscribe();
      this.groupSubscriptions.delete(groupId);
      console.log('🔌 Unsubscribed from group:', groupId);
    }
  }

  sendGroupMessage(groupId, sender, message) {
    if (!this.stompClient || !this.connected) {
      throw new Error('Not connected to WebSocket');
    }

    const payload = {
      groupId: groupId,
      sender: sender,
      message: message
    };

    console.log('📤 Sending group message:', payload);
    this.stompClient.send('/app/groupMessage', {}, JSON.stringify(payload));
    console.log('✅ Group message sent');
  }

  addMessageHandler(id, handler) {
    this.messageHandlers.set(id, handler);
  }

  removeMessageHandler(id) {
    this.messageHandlers.delete(id);
  }

  disconnect() {
    if (this.stompClient && this.connected) {
      // Unsubscribe from all groups
      this.groupSubscriptions.forEach((subscription) => {
        subscription.unsubscribe();
      });
      this.groupSubscriptions.clear();

      this.stompClient.disconnect();
      this.connected = false;
      this.stompClient = null;
      console.log('🔌 Group WebSocket Disconnected');
    }
  }

  isConnected() {
    return this.connected && this.stompClient && this.stompClient.connected;
  }
}

const groupWebSocketService = new GroupWebSocketService();
export default groupWebSocketService;
