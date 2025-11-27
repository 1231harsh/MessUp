import SockJS from "sockjs-client";
import Stomp from "stompjs";
import encryptionService from "./encryption";
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

class WebSocketService {
  constructor() {
    this.stompClient = null;
    this.connected = false;
    this.messageHandlers = new Map();
    this.currentUsername = null;
    this.subscriptions = new Map();
  }

  connect(username) {
    return new Promise((resolve, reject) => {
      try {
        console.log("🔌 Connecting WebSocket for user:", username);
        this.currentUsername = username;

        const socket = new SockJS(`${API_BASE_URL}/chat`);
        this.stompClient = Stomp.over(socket);

        // Disable debug to reduce noise
        this.stompClient.debug = null;

        this.stompClient.connect(
          {},
          (frame) => {
            console.log("✅ Connected as", username);

            this.subscribeToPrivateMessages(username);

            this.connected = true;

            console.log("✅ Connected as", username);
            resolve(frame);
          },
          (error) => {
            console.error("❌ Connection failed:", error);
            this.connected = false;
            reject(error);
          }
        );
      } catch (error) {
        console.error("❌ Failed to create connection:", error);
        reject(error);
      }
    });
  }

  subscribeToPrivateMessages(username) {
    if (!this.stompClient || !this.connected) {
      console.warn("⚠️ Cannot subscribe: not connected");
      return;
    }

    // // Check if connection is really ready
    // if (!this.stompClient.connected) {
    //   console.warn("⚠️ STOMP client not fully connected yet, retrying...");
    //   setTimeout(() => this.subscribeToPrivateMessages(username), 200);
    //   return;
    // }

    try {
      const destinations = [
        `/user/${username}/private`, // incoming messages
        `/user/${username}/private/sent`, 
        `/user/${username}/private/delivered`, // delivery updates for messages I sent
        `/user/${username}/private/read`, // read updates
      ];

      destinations.forEach((dest) => {
        if(this.subscriptions.has(dest)) return;

        console.log("📡 Subscribing to:", dest);

        const subscription = this.stompClient.subscribe(dest, (message) => {
          try {
            const messageData = JSON.parse(message.body);
            console.log("📨 Received message:", messageData);

            // Attach type info to messageData so store can handle it correctly
            const type = dest.split("/").pop(); // private | delivered | read
            this.messageHandlers.forEach((handler) => {
              handler({ ...messageData, type });
            });
          } catch (error) {
            console.error("❌ Error parsing message:", error);
          }
        });

        this.subscriptions.set(dest, subscription);
      });

      console.log("✅ Subscribed to all private message channels");
    } catch (error) {
      console.error("❌ Subscription failed:", error);
      // Retry subscription after a delay
      setTimeout(() => this.subscribeToPrivateMessages(username), 500);
    }
  }

  async sendPrivateMessage(sender, receiver, message, tempId) {
    if (!this.stompClient || !this.connected) {
      throw new Error("Not connected to WebSocket");
    }

    // Double check connection state
    if (!this.stompClient.connected) {
      throw new Error("WebSocket connection not ready");
    }

    try {
      console.log("🔐 Attempting to encrypt message before sending...");

      // Try to encrypt the message
      const encryptedMessage = await encryptionService.encryptMessage(
        message,
        receiver
      );

      let payload;

      if (encryptedMessage) {
        // Send encrypted message
        payload = {
          sender: sender,
          receiver: receiver,
          message: encryptedMessage, // This is the encrypted JSON string
          isEncrypted: true,
          tempId: tempId,
        };
        console.log("📤 Sending encrypted message");
      } 
      // else {
      //   // Fallback: send unencrypted if encryption fails
      //   console.warn("⚠️ Encryption failed, sending unencrypted message");
      //   payload = {
      //     sender: sender,
      //     receiver: receiver,
      //     message: message,
      //     isEncrypted: false,
      //   };
      // }

      this.stompClient.send(
        "/app/sendPrivateMessage",
        {},
        JSON.stringify(payload)
      );
      console.log("✅ Message sent to backend");
    } catch (error) {
      console.error("❌ Failed to send message:", error);
      throw error;
    }
  }

  addMessageHandler(id, handler) {
    this.messageHandlers.set(id, handler);
  }

  removeMessageHandler(id) {
    this.messageHandlers.delete(id);
  }

  disconnect() {
    if (this.stompClient && this.connected) {
      // Unsubscribe from all subscriptions
      this.subscriptions.forEach((subscription) => {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.warn("⚠️ Error unsubscribing:", error);
        }
      });
      this.subscriptions.clear();

      this.stompClient.disconnect();
      this.connected = false;
      this.stompClient = null;
      console.log("🔌 Disconnected");
    }
  }

  isConnected() {
    return this.connected && this.stompClient && this.stompClient.connected;
  }
}

const webSocketService = new WebSocketService();
export default webSocketService;
