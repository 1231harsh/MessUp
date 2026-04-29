const API_BASE_URL = import.meta.env.VITE_BASE_URL;
import encryption from "./encryption";

class GroupEncryptionService {
  constructor() {
    this.groupKeys = new Map(); // groupId -> CryptoKey
  }

  /* ================= LOAD GROUP KEY ================= */

  async loadGroupKey(groupId, { forceReload = false } = {}) {
    if (forceReload) {
      this.clearGroup(groupId);
    }

    if (this.groupKeys.has(groupId)) return;

    if (!encryption.privateKey) throw new Error("Private key not initialized");

    const res = await fetch(`${API_BASE_URL}/groupChat/keys/${groupId}`, {
      credentials: "include",
    });

    if (!res.ok) throw new Error("Failed to fetch group key");

    let encryptedKeyBase64 = await res.text();

    // normalize base64 (Java URL-safe → standard)
    encryptedKeyBase64 = encryptedKeyBase64
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .trim();

    const encryptedKey = encryption.base64ToArrayBuffer(encryptedKeyBase64);

    // RSA-OAEP SHA-256 must exactly match the backend OAEPParameterSpec.
    const rawKey = await crypto.subtle.decrypt(
      { name: "RSA-OAEP", hash: "SHA-256" },
      encryption.privateKey,
      encryptedKey,
    );

    const aesKey = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );

    this.groupKeys.set(groupId, aesKey);
  }

  /* ================= ENCRYPT ================= */

  async encryptMessage(groupId, text) {
    const key = this.groupKeys.get(groupId);
    if (!key) throw new Error("Group key missing");

    const iv = crypto.getRandomValues(new Uint8Array(12));

    // IMPORTANT: ensure IV is Uint8Array
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      key,
      new TextEncoder().encode(text),
    );

    return {
      message: encryption.arrayBufferToBase64(encrypted),
      iv: encryption.arrayBufferToBase64(iv),
    };
  }

  /* ================= DECRYPT ================= */

  async decryptMessage(groupId, payload, ivBase64) {
    const key = this.groupKeys.get(groupId);
    if (!key) throw new Error("Group key missing");

    try {
      // 🔴 CRITICAL FIX: WebCrypto needs Uint8Array not ArrayBuffer
      const iv = new Uint8Array(encryption.base64ToArrayBuffer(ivBase64));
      const data = new Uint8Array(encryption.base64ToArrayBuffer(payload));

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data,
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.warn("Group decrypt failed:", e);
      return "🔒 Unable to decrypt";
    }
  }

  /* ================= CLEANUP ================= */

  clearGroup(groupId) {
    this.groupKeys.delete(groupId);
  }

  clearAll() {
    this.groupKeys.clear();
  }
}

export default new GroupEncryptionService();
