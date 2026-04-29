const API_BASE_URL = import.meta.env.VITE_BASE_URL;

class EncryptionService {
  constructor() {
    this.currentUsername = null;
    this.publicKey = null;
    this.privateKey = null;

    this.contactKeys = new Map(); // username -> { key, time }
    this.isInitialized = false;
    this.keyStorageKey = null;

    this.initPromise = null;
    this.keyUploadPending = false;
    this.uploadInProgress = false;

    this.passphraseHandler = null;
  }

  /* ================= USER SWITCH SAFETY ================= */

  clearRuntimeState() {
    this.publicKey = null;
    this.privateKey = null;
    this.contactKeys.clear();
    this.isInitialized = false;
    this.initPromise = null;
  }

  setCurrentUsername(username) {
    this.currentUsername = username;
    this.keyStorageKey = `messup_encryption_keys_${username}`;
  }

  setPassphraseHandler(handler) {
    this.passphraseHandler = handler;
  }

  /* ================= INITIALIZATION ================= */

  async initialize(username) {
    if (this.currentUsername && this.currentUsername !== username) {
      this.clearRuntimeState();
    }

    this.setCurrentUsername(username);

    if (this.isInitialized && this.publicKey && this.privateKey) {
      await this.tryUploadPendingKey();
      return true;
    }

    await this.ensureInitialized();
    await this.tryUploadPendingKey();
    return true;
  }

  async ensureInitialized() {
    if (this.publicKey && this.privateKey) {
      this.isInitialized = true;
      return;
    }

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.loadKeys().catch((err) => {
      this.initPromise = null;
      throw err;
    });

    await this.initPromise;
    this.isInitialized = true;
  }

  /* ================= KEY LOADING ================= */

  async loadKeys() {
    const stored = localStorage.getItem(this.keyStorageKey);

    if (stored) {
      const data = JSON.parse(stored);

      this.publicKey = await crypto.subtle.importKey(
        "jwk",
        data.publicKey,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"],
      );

      this.privateKey = await crypto.subtle.importKey(
        "jwk",
        data.privateKey,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"],
      );

      this.keyUploadPending = true;
      return;
    }

    if (!this.passphraseHandler) throw new Error("No passphrase handler");

    const passphrase = await this.passphraseHandler();
    if (!passphrase) throw new Error("Passphrase required");

    await this.restorePrivateKeyFromServer(passphrase);
  }

  /* ================= PUBLIC KEY UPLOAD ================= */

  async uploadPublicKeyToServer() {
    if (this.uploadInProgress || !this.publicKey) return;
    this.uploadInProgress = true;

    try {
      const auth = await this.isUserAuthenticated();
      if (!auth) {
        this.keyUploadPending = true;
        return;
      }

      const jwk = await crypto.subtle.exportKey("jwk", this.publicKey);

      const res = await fetch(`${API_BASE_URL}/api/keys/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: this.currentUsername,
          publicKeyJwk: jwk,
        }),
      });

      if (!res.ok) throw new Error("Public key upload failed");

      this.keyUploadPending = false;
    } finally {
      this.uploadInProgress = false;
    }
  }
  /* ================= MESSAGE TYPE CHECK ================= */

  isEncryptedMessage(message) {
    if (!message || typeof message !== "string") return false;

    // quick rejection
    if (message[0] !== "{") return false;

    try {
      const parsed = JSON.parse(message);

      return (
        typeof parsed === "object" &&
        typeof parsed.encryptedMessage === "string" &&
        typeof parsed.iv === "string" &&
        typeof parsed.encryptedKeyForRecipient === "string" &&
        typeof parsed.encryptedKeyForSender === "string"
      );
    } catch {
      return false;
    }
  }

  async tryUploadPendingKey(retry = 1) {
    if (!this.keyUploadPending) return;

    try {
      await this.uploadPublicKeyToServer();
    } catch {
      setTimeout(
        () => this.tryUploadPendingKey(Math.min(retry * 2, 30)),
        retry * 1000,
      );
    }
  }

  /* ================= CONTACT KEYS ================= */

  async getContactPublicKey(username) {
    const cached = this.contactKeys.get(username);

    if (cached && Date.now() - cached.time < 10 * 60 * 1000) {
      return cached.key;
    }

    const res = await fetch(`${API_BASE_URL}/api/keys/get/${username}`, {
      credentials: "include",
    });

    if (!res.ok) throw new Error(`Public key not found for ${username}`);

    const jwk = await res.json();

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"],
    );

    this.contactKeys.set(username, { key, time: Date.now() });
    return key;
  }

  /* ================= MESSAGE ENCRYPTION ================= */

  async encryptMessage(message, recipientUsername) {
    await this.ensureInitialized();
    const recipientKey = await this.getContactPublicKey(recipientUsername);

    const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(message);

    const encryptedMessage = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encoded,
    );

    const aesRaw = await crypto.subtle.exportKey("raw", aesKey);

    const encryptedKeyForRecipient = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      recipientKey,
      aesRaw,
    );

    const encryptedKeyForSender = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      this.publicKey,
      aesRaw,
    );

    return JSON.stringify({
      encryptedMessage: this.arrayBufferToBase64(encryptedMessage),
      encryptedKeyForRecipient: this.arrayBufferToBase64(
        encryptedKeyForRecipient,
      ),
      encryptedKeyForSender: this.arrayBufferToBase64(encryptedKeyForSender),
      iv: this.arrayBufferToBase64(iv),
      encryptedFor: recipientUsername,
      encryptedBy: this.currentUsername,
      timestamp: Date.now(),
    });
  }

  async decryptMessage(payload) {
    await this.ensureInitialized();

    const data = JSON.parse(payload);
    if (!data.iv) throw new Error("Missing IV");

    const encryptedKey =
      data.encryptedFor === this.currentUsername
        ? data.encryptedKeyForRecipient
        : data.encryptedKeyForSender;

    const aesRaw = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      this.privateKey,
      this.base64ToArrayBuffer(encryptedKey),
    );

    const aesKey = await crypto.subtle.importKey(
      "raw",
      aesRaw,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: this.base64ToArrayBuffer(data.iv) },
      aesKey,
      this.base64ToArrayBuffer(data.encryptedMessage),
    );

    return new TextDecoder().decode(decrypted);
  }

  /* ================= IMAGE ENCRYPTION ================= */

  async encryptImage(file, recipientUsername) {
    await this.ensureInitialized();
    const recipientKey = await this.getContactPublicKey(recipientUsername);

    const buffer = await file.arrayBuffer();

    const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedImage = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      buffer,
    );

    const aesRaw = await crypto.subtle.exportKey("raw", aesKey);

    return {
      encryptedBlob: new Blob([encryptedImage]),
      encryptedKeyForRecipient: this.arrayBufferToBase64(
        await crypto.subtle.encrypt({ name: "RSA-OAEP" }, recipientKey, aesRaw),
      ),
      encryptedKeyForSender: this.arrayBufferToBase64(
        await crypto.subtle.encrypt(
          { name: "RSA-OAEP" },
          this.publicKey,
          aesRaw,
        ),
      ),
      iv: this.arrayBufferToBase64(iv),
      originalContentType: file.type,
      originalSize: file.size,
    };
  }

  async decryptImage(encryptedBuffer, encryptedKeyBase64, ivBase64) {
    await this.ensureInitialized();
    if (!ivBase64) throw new Error("Missing IV");

    const aesRaw = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      this.privateKey,
      this.base64ToArrayBuffer(encryptedKeyBase64),
    );

    const aesKey = await crypto.subtle.importKey(
      "raw",
      aesRaw,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    return await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: this.base64ToArrayBuffer(ivBase64) },
      aesKey,
      encryptedBuffer,
    );
  }

  /* ================= HELPERS ================= */

  async isUserAuthenticated() {
    try {
      const r = await fetch(`${API_BASE_URL}/api/users/current`, {
        credentials: "include",
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  // SAFE for large buffers
  arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export default new EncryptionService();
