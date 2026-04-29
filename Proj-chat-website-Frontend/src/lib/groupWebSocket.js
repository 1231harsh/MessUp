import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

class GroupWebSocketService {
  constructor() {
    this.stompClient = null;
    this.connected = false;
    this.messageHandlers = new Map();
    this.groupSubscriptions = new Map();
    this.currentUsername = null;
    this.groupKeySubscriptions = new Map(); // groupId -> subscription
    this.keyUpdateHandlers = new Map(); // name -> callback
  }

  connect(username) {
    if (this.connected) return Promise.resolve();

    return new Promise((resolve, reject) => {
      try {
        console.log("🔌 Connecting Group WebSocket for:", username);
        this.currentUsername = username;

        const socket = new SockJS(`${API_BASE_URL}/chat`);
        this.stompClient = Stomp.over(socket);
        this.stompClient.debug = null;

        this.stompClient.connect(
          {},
          () => {
            console.log("✅ Group WS Connected");
            this.connected = true;
            resolve();
          },
          (error) => {
            console.error("❌ Group WS Failed:", error);
            this.connected = false;
            reject(error);
          },
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  subscribeToGroup(groupId) {
    if (!this.connected || !this.stompClient) return;

    if (this.groupSubscriptions.has(groupId)) return; // prevent duplicate subscribe

    const destination = `/topic/group/${groupId}`;
    console.log("📡 Subscribing:", destination);

    const subscription = this.stompClient.subscribe(destination, (msg) => {
      try {
        const data = JSON.parse(msg.body);

        this.messageHandlers.forEach((handler) => {
          handler(data, groupId);
        });
      } catch (e) {
        console.error("Group message parse error:", e);
      }
    });

    this.groupSubscriptions.set(groupId, subscription);
  }

  unsubscribeFromGroup(groupId) {
    const sub = this.groupSubscriptions.get(groupId);
    if (sub) {
      sub.unsubscribe();
      this.groupSubscriptions.delete(groupId);
      console.log("🔌 Unsubscribed group:", groupId);
    }
  }

  sendGroupMessage(groupId, sender, message, tempId, iv) {
    if (!this.connected || !this.stompClient?.connected)
      throw new Error("WS not connected");

    this.stompClient.send(
      "/app/groupMessage",
      {},
      JSON.stringify({
        groupId,
        sender,
        message,
        tempId,
        iv, // 🔐 THIS WAS MISSING
      }),
    );
  }

  addMessageHandler(id, handler) {
    this.messageHandlers.set(id, handler);
  }

  removeMessageHandler(id) {
    this.messageHandlers.delete(id);
  }

  addKeyUpdateHandler(name, handler) {
    this.keyUpdateHandlers.set(name, handler);
  }

  removeKeyUpdateHandler(name) {
    this.keyUpdateHandlers.delete(name);
  }

  subscribeToGroupKeyUpdates(groupId) {
    if (!this.stompClient || !this.stompClient.connected) return;

    if (this.groupKeySubscriptions.has(groupId)) return;

    const sub = this.stompClient.subscribe(
      `/topic/group/${groupId}/key-update`,
      () => {
        console.log("🔐 Group key rotated", groupId);

        this.keyUpdateHandlers.forEach((handler) => handler(groupId));
      },
    );

    this.groupKeySubscriptions.set(groupId, sub);
  }

  unsubscribeFromGroupKeyUpdates(groupId) {
    const sub = this.groupKeySubscriptions.get(groupId);
    if (sub) {
      sub.unsubscribe();
      this.groupKeySubscriptions.delete(groupId);
    }
  }

  disconnect() {
    this.groupSubscriptions.forEach((s) => s.unsubscribe());
    this.groupSubscriptions.clear();

    if (this.stompClient) this.stompClient.disconnect();

    this.connected = false;
    this.stompClient = null;

    this.groupKeySubscriptions.forEach((sub) => sub.unsubscribe());
    this.groupKeySubscriptions.clear();
    this.keyUpdateHandlers.clear();
  }

  isConnected() {
    return this.connected && this.stompClient?.connected;
  }
}

export default new GroupWebSocketService();
