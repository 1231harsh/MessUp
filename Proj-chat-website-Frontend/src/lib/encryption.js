import { stringify } from "postcss";
import { usePassphraseStore } from "../store/usePassphraseStore";
const API_BASE_URL = import.meta.env.VITE_BASE_URL;

// End-to-End Encryption utilities using Web Crypto API
class EncryptionService {
  constructor() {
    this.currentUsername = null;
    this.userPassword = null;
    this.keyPair = null;
    this.publicKey = null;
    this.privateKey = null;
    this.contactKeys = new Map();
    this.isInitialized = false;
    this.keyStorageKey = "messup_encryption_keys";
    this.initPromise = null;
    this.keyUploadPending = false;
    this.uploadInProgress = false;
  }

  // Set current username
  setCurrentUsername(username) {
    this.currentUsername = username;
    this.keyStorageKey = `messup_encryption_keys_${username}`;
  }

  setPassphraseHandler(handler) {
    this.passphraseHandler = handler;
  }

  // Generate RSA key pair ONLY once per user
  async generateKeyPair(password) {
    try {
      console.log("🔐 Generating new RSA key pair...");

      this.keyPair = await window.crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
      );

      this.publicKey = this.keyPair.publicKey;
      this.privateKey = this.keyPair.privateKey;

      await this.storeKeys();
      await this.backupEncryptedPrivateKey(password);

      this.keyUploadPending = true;
      this.isInitialized = true;

      console.log("🔐 New key pair generated and backed up");
      return this.keyPair;
    } catch (error) {
      console.error("❌ Failed to generate key pair:", error);
      throw error;
    }
  }

  // Upload public key to server (only when authenticated)
  async uploadPublicKeyToServer() {
    if (this.uploadInProgress) return;
    this.uploadInProgress = true;

    try {
      const isLoggedIn = await this.isUserAuthenticated();
      if (!isLoggedIn) {
        console.warn("🔐 User not authenticated yet. Will retry later.");
        this.keyUploadPending = true;
        return;
      }
      if (!this.currentUsername || !this.publicKey) {
        console.error("❌ Cannot upload key: missing username or public key");
        return;
      }

      const publicKeyJwk = await window.crypto.subtle.exportKey(
        "jwk",
        this.publicKey
      );
      console.log(
        "🔐 Uploading public key to server for user:",
        this.currentUsername
      );

      // FIXED: Use the same API configuration as other requests
      const response = await fetch(`${API_BASE_URL}/api/keys/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // This ensures cookies are sent
        body: JSON.stringify({
          username: this.currentUsername,
          publicKeyJwk: publicKeyJwk,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Check if response is HTML (OAuth2 redirect)
        if (
          errorText.includes("<!DOCTYPE html>") ||
          errorText.includes("<html>")
        ) {
          console.log(
            "🔐 Received HTML response (OAuth2 redirect), marking for retry after authentication"
          );
          this.keyUploadPending = true;
          return;
        }

        // If it's an authentication error, mark for retry later
        if (response.status === 401 || response.status === 403) {
          console.log(
            "🔐 Authentication required for key upload, will retry after login"
          );
          this.keyUploadPending = true;
          return;
        }

        throw new Error(
          `Failed to upload public key: ${response.status} - ${errorText}`
        );
      }

      const result = await response.text();
      console.log("✅ Public key uploaded to server successfully:", result);
      this.keyUploadPending = false;
    } catch (error) {
      console.error("❌ Failed to upload public key to server:", error);

      // If it's a network, auth, or CORS error, mark for retry
      if (
        error.message.includes("401") ||
        error.message.includes("403") ||
        error.message.includes("fetch") ||
        error.message.includes("CORS") ||
        error.message.includes("Failed to fetch")
      ) {
        console.log("🔐 Network/Auth error, will retry key upload later");
        this.keyUploadPending = true;
      }
    }
  }

  // Store keys with a single consistent key
  async storeKeys() {
    try {
      if (!this.publicKey || !this.privateKey) {
        throw new Error("No keys to store");
      }

      const publicKeyJwk = await window.crypto.subtle.exportKey(
        "jwk",
        this.publicKey
      );
      const privateKeyJwk = await window.crypto.subtle.exportKey(
        "jwk",
        this.privateKey
      );

      const keyData = {
        publicKey: publicKeyJwk,
        privateKey: privateKeyJwk,
        timestamp: Date.now(),
        version: "1.0",
        username: this.currentUsername,
      };

      localStorage.setItem(this.keyStorageKey, JSON.stringify(keyData));
      console.log(
        "🔐 Keys stored successfully with timestamp:",
        keyData.timestamp
      );
    } catch (error) {
      console.error("❌ Failed to store keys:", error);
      throw error;
    }
  }

  // Initialize encryption service
  async initialize(username) {
    try {
      if (this.isInitialized && this.currentUsername === username) {
        console.log("🔐 Encryption already initialized for user:", username);
        await this.tryUploadPendingKey();
        return true;
      }

      this.setCurrentUsername(username);

      await this.ensureInitialized(); // Will use userPassword internally
      await this.tryUploadPendingKey();

      console.log("🔐 Encryption service initialized successfully");
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize encryption service:", error);
      throw error;
    }
  }

  // Load keys with better consistency
  async loadKeys() {
    try {
      console.log("🔐 Loading encryption keys for user:", this.currentUsername);

      const storedData = localStorage.getItem(this.keyStorageKey);

      if (storedData) {
        const keyData = JSON.parse(storedData);
        console.log("🔐 Found stored keys from timestamp:", keyData.timestamp);

        this.publicKey = await window.crypto.subtle.importKey(
          "jwk",
          keyData.publicKey,
          { name: "RSA-OAEP", hash: "SHA-256" },
          true,
          ["encrypt"]
        );

        this.privateKey = await window.crypto.subtle.importKey(
          "jwk",
          keyData.privateKey,
          { name: "RSA-OAEP", hash: "SHA-256" },
          true,
          ["decrypt"]
        );

        this.keyUploadPending = true;
        this.isInitialized = true;
        return;
      }

      console.log("🔐 No local key found, checking server backup...");

      while (true) {
        const passphrase = await this.getPassphraseFromUser();
        if (!passphrase) {
          console.warn("🔐 User cancelled passphrase prompt — logging out");
          throw new Error("Passphrase prompt cancelled by user");
        }

        try {
          const restored = await this.tryRestorePrivateKeyFromServer(
            passphrase
          );
          if (restored) {
            this.isInitialized = true;
            return;
          }
        } catch (err) {
          if (err.message.includes("Incorrect passphrase")) {
            alert("❌ Incorrect passphrase, please try again.");
            continue; // prompt again
          }

          if (err.message.includes("No server backup")) {
            const confirmed = confirm(
              "🆕 No key found on server. This seems to be your first login. Generate a new encryption key?"
            );
            if (confirmed) {
              await this.generateKeyPair(passphrase);
              this.isInitialized = true;
              return;
            } else {
              throw new Error("User declined key generation");
            }
          }

          console.error("🔐 Key restoration failed:", err);
          throw err;
        }
      }
    } catch (err) {
      console.error("🔐 Key initialization aborted:", err.message);
      throw err;
    }
  }

  async getPassphraseFromUser() {
    if (typeof this.passphraseHandler !== "function") {
      throw new Error("No passphrase handler set");
    }

    return await this.passphraseHandler(); // await the user's input via modal
  }

  // Try to upload pending key (call this after successful authentication)
  async tryUploadPendingKey() {
    if (this.keyUploadPending && this.publicKey && this.currentUsername) {
      // Add a small delay to ensure authentication is fully established
      setTimeout(() => {
        this.uploadPublicKeyToServer().catch((err) => {
          console.warn("🔁 Delayed key upload failed:", err);
        });
      }, 1000);
    }
  }

  // Get public key as JWK for sharing
  async getPublicKeyJwk() {
    await this.ensureInitialized();
    return await window.crypto.subtle.exportKey("jwk", this.publicKey);
  }

  // Generate AES key for symmetric encryption
  async generateAESKey() {
    return await window.crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // Check if message is encrypted JSON
  isEncryptedMessage(message) {
    if (!message || typeof message !== "string") {
      return false;
    }

    if (!message.trim().startsWith("{")) {
      return false;
    }

    try {
      const parsed = JSON.parse(message);
      return (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.encryptedMessage === "string" &&
        typeof parsed.encryptedKeyForRecipient === "string" &&
        typeof parsed.encryptedKeyForSender === "string" &&
        typeof parsed.iv === "string" &&
        parsed.encryptedMessage.length > 0 &&
        parsed.encryptedKeyForRecipient.length > 0 &&
        parsed.encryptedKeyForSender.length > 0 &&
        parsed.iv.length > 0
      );
    } catch (error) {
      return false;
    }
  }

  // Ensure keys are loaded before any operation
  async ensureInitialized() {
    if (this.isInitialized && this.publicKey && this.privateKey) {
      return;
    }

    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    const promiseRef = this.loadKeys();
    this.initPromise = promiseRef;

    try {
      await promiseRef;
    } finally {
      // Only clear if it's the current tracked promise
      if (this.initPromise === promiseRef) {
        this.initPromise = null;
      }
    }
  }

  getSafeContactKeyStore() {
    try {
      const raw = localStorage.getItem("contactPublicKeys");
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.warn("⚠️ Corrupted contactPublicKeys, clearing it.");
      localStorage.removeItem("contactPublicKeys");
      return {};
    }
  }

  // Get contact's public key from server
  async getContactPublicKey(username) {
    try {
      console.log(`🔐 Getting public key for contact: ${username}`);

      // First check in-memory cache
      if (this.contactKeys.has(username)) {
        const publicKeyJwk = this.contactKeys.get(username);
        console.log(`🔐 Found ${username}'s key in memory cache`);

        // Import and return the key
        return await window.crypto.subtle.importKey(
          "jwk",
          publicKeyJwk,
          {
            name: "RSA-OAEP",
            hash: "SHA-256",
          },
          false,
          ["encrypt"]
        );
      }

      // Check localStorage cache
      const stored = this.getSafeContactKeyStore();
      if (stored[username]) {
        console.log(`🔐 Found ${username}'s key in localStorage cache`);
        this.contactKeys.set(username, stored[username]);

        return await window.crypto.subtle.importKey(
          "jwk",
          stored[username],
          {
            name: "RSA-OAEP",
            hash: "SHA-256",
          },
          false,
          ["encrypt"]
        );
      }

      // Fetch from server
      console.log(`🔐 Fetching ${username}'s key from server...`);
      const res = await fetch(
        `${API_BASE_URL}/api/keys/get/${username}`,
        {
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error(`Key not found for user: ${username} (${res.status})`);
      }

      const publicKeyJwk = await res.json();
      console.log(`🔐 Successfully fetched ${username}'s key from server`);

      // Cache the key
      this.contactKeys.set(username, publicKeyJwk);
      stored[username] = publicKeyJwk;
      localStorage.setItem("contactPublicKeys", JSON.stringify(stored));

      return await window.crypto.subtle.importKey(
        "jwk",
        publicKeyJwk,
        {
          name: "RSA-OAEP",
          hash: "SHA-256",
        },
        false,
        ["encrypt"]
      );
    } catch (error) {
      console.error(
        `❌ Failed to get contact public key for ${username}:`,
        error
      );
      throw error;
    }
  }

  async isUserAuthenticated() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/current`, {
        credentials: "include",
      });

      return res.ok;
    } catch (e) {
      return false;
    }
  }

  // Encrypt message using recipient's public key
  async encryptMessage(message, recipientUsername) {
    try {
      await this.ensureInitialized();

      console.log(`🔐 Encrypting message for ${recipientUsername}...`);

      const recipientPublicKey = await this.getContactPublicKey(
        recipientUsername
      );
      if (!recipientPublicKey) {
        console.error(`❌ No public key available for ${recipientUsername}`);
        return null;
      }

      const aesKey = await this.generateAESKey();
      const encoder = new TextEncoder();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const messageData = encoder.encode(message);

      const encryptedMessage = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        aesKey,
        messageData
      );

      const aesKeyRaw = await window.crypto.subtle.exportKey("raw", aesKey);

      const encryptedKeyForRecipient = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        recipientPublicKey,
        aesKeyRaw
      );

      const encryptedKeyForSender = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        this.publicKey,
        aesKeyRaw
      );

      return JSON.stringify({
        encryptedMessage: this.arrayBufferToBase64(encryptedMessage),
        encryptedKeyForRecipient: this.arrayBufferToBase64(
          encryptedKeyForRecipient
        ),
        encryptedKeyForSender: this.arrayBufferToBase64(encryptedKeyForSender),
        iv: this.arrayBufferToBase64(iv),
        encryptedFor: recipientUsername,
        encryptedBy: this.currentUsername,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("❌ Failed to encrypt message:", error);
      return null;
    }
  }

  // Decrypt message
  async decryptMessage(encryptedMessageString) {
    try {
      await this.ensureInitialized();
      if (
        !encryptedMessageString ||
        typeof encryptedMessageString !== "string"
      ) {
        return "[Invalid encrypted message format]";
      }

      const data = JSON.parse(encryptedMessageString);
      const iv = this.base64ToArrayBuffer(data.iv);
      const encryptedMsg = this.base64ToArrayBuffer(data.encryptedMessage);

      let encryptedKeyBase64 =
        data.encryptedFor === this.currentUsername
          ? data.encryptedKeyForRecipient
          : data.encryptedKeyForSender;

      const encryptedAESKey = this.base64ToArrayBuffer(encryptedKeyBase64);

      const aesKeyRaw = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        this.privateKey,
        encryptedAESKey
      );

      const aesKey = await window.crypto.subtle.importKey(
        "raw",
        aesKeyRaw,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        aesKey,
        encryptedMsg
      );

      return new TextDecoder().decode(decrypted);
    } catch (err) {
      console.error("❌ Failed to decrypt:", err);
      return "[Decryption failed]";
    }
  }

  async encryptPrivateKeyWithPassphrase(privateKeyJwk, passphrase) {
    const encoder = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(passphrase),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );

    const privateKeyStr = JSON.stringify(privateKeyJwk);
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      derivedKey,
      encoder.encode(privateKeyStr)
    );

    return {
      encryptedPrivateKey: this.arrayBufferToBase64(encrypted),
      salt: this.arrayBufferToBase64(salt),
      iv: this.arrayBufferToBase64(iv),
    };
  }

  async decryptPrivateKeyWithPassphrase(encryptedData, salt, iv, passphrase) {
    try {
      const encryptedArrayBuffer = this.base64ToArrayBuffer(encryptedData);
      const saltBuffer = this.base64ToArrayBuffer(salt);
      const ivBuffer = this.base64ToArrayBuffer(iv);

      const encoder = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(passphrase),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
      );

      const derivedKey = await window.crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          salt: saltBuffer,
          iterations: 100000,
          hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: ivBuffer },
        derivedKey,
        encryptedArrayBuffer
      );

      const decoded = new TextDecoder().decode(decrypted);
      return JSON.parse(decoded);
    } catch (err) {
      console.error("🔐 Failed to decrypt private key:", err);
      throw new Error("Incorrect passphrase or corrupted key data.");
    }
  }

  async backupEncryptedPrivateKey(password) {
    const privateKeyJwk = await window.crypto.subtle.exportKey(
      "jwk",
      this.privateKey
    );
    const encrypted = await this.encryptPrivateKeyWithPassphrase(
      privateKeyJwk,
      password
    );

    await fetch(`${API_BASE_URL}/api/keys/upload-private`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        username: this.currentUsername,
        ...encrypted,
      }),
    });

    console.log("✅ Encrypted private key uploaded successfully.");
  }

  async tryRestorePrivateKeyFromServer(password) {
    const res = await fetch(
      `${API_BASE_URL}/api/keys/get-private/${this.currentUsername}`,
      { credentials: "include" }
    );

    if (!res.ok) throw new Error("No server backup available");

    const encrypted = await res.json();
    const privateKeyJwk = await this.decryptPrivateKeyWithPassphrase(
      encrypted.encryptedPrivateKey,
      encrypted.salt,
      encrypted.iv,
      password
    );

    this.privateKey = await window.crypto.subtle.importKey(
      "jwk",
      privateKeyJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );

    if (!privateKeyJwk.n || !privateKeyJwk.e) {
      throw new Error("Missing public key params in private key JWK.");
    }

    const publicKeyJwk = {
      kty: "RSA",
      e: privateKeyJwk.e,
      n: privateKeyJwk.n,
      alg: "RSA-OAEP-256",
      ext: true,
    };

    this.publicKey = await window.crypto.subtle.importKey(
      "jwk",
      publicKeyJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"]
    );

    localStorage.setItem(
      this.keyStorageKey,
      JSON.stringify({
        publicKey: publicKeyJwk,
        privateKey: privateKeyJwk,
        timestamp: Date.now(),
        version: "1.0",
        username: this.currentUsername,
      })
    );

    console.log("✅ Restored private key and regenerated public key");
    return true;
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Clear all stored keys (for logout)
  clearKeys() {
    if (this.keyStorageKey) {
      localStorage.removeItem(this.keyStorageKey);
    }
    localStorage.removeItem("contactPublicKeys");

    this.publicKey = null;
    this.privateKey = null;
    this.keyPair = null;
    this.contactKeys.clear();
    this.isInitialized = false;
    this.initPromise = null;
    this.currentUsername = null;
    this.keyUploadPending = false;

    try {
      const store = usePassphraseStore.getState();
      if (store.clearPassphrase) {
        store.clearPassphrase();
      }
    } catch (err) {
      console.warn("⚠️ Failed to clear passphrase from store:", err);
    }

    console.log("🔐 All encryption keys cleared");
  }

  // Check if we have a contact's public key
  hasContactKey(username) {
    return (
      this.contactKeys.has(username) ||
      this.getSafeContactKeyStore()[username] !== undefined
    );
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();
export default encryptionService;
