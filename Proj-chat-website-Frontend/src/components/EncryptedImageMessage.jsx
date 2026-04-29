import { useEffect, useState } from "react";
import encryptionService from "../lib/encryption";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const EncryptedImageMessage = ({ message }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🚫 Do not run for temp or invalid messages
    if (!message?.mediaId || message?.isTemp) {
      setLoading(false);
      return;
    }

    let objectUrl = null;
    let cancelled = false;

    const loadAndDecryptImage = async () => {
      try {
        setLoading(true);
        setError(false);
        setImageUrl(null);

        // ensure keys ready
        await encryptionService.ensureInitialized?.();

        /* ================= DOWNLOAD ================= */
        const response = await fetch(
          `${API_BASE_URL}/api/media/images/${message.mediaId}`,
          { credentials: "include" },
        );

        if (!response.ok) throw new Error("Failed to download encrypted image");

        const encryptedBuffer = await response.arrayBuffer();

        /* ================= PICK AES KEY ================= */
        const currentUser = encryptionService.currentUsername;
        if (!currentUser) throw new Error("Encryption service not initialized");

        const encryptedKey =
          message.receiverId === currentUser
            ? message.encryptedKeyForRecipient
            : message.encryptedKeyForSender;

        if (!encryptedKey || !message.iv)
          throw new Error("Missing encryption metadata");

        /* ================= DECRYPT ================= */
        const decryptedBuffer = await encryptionService.decryptImage(
          encryptedBuffer,
          encryptedKey,
          message.iv,
        );

        if (cancelled) return;

        /* ================= CREATE URL ================= */
        const blob = new Blob([decryptedBuffer], {
          type: message.contentType || "image/jpeg",
        });

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        console.error("❌ Image decryption failed:", err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAndDecryptImage();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };

    // 🔑 Only run when the actual image changes
  }, [message.mediaId]);

  /* ================= RENDER ================= */

  if (loading)
    return (
      <div className="text-xs text-base-content/60 italic">
        Decrypting image…
      </div>
    );

  if (error || !imageUrl)
    return (
      <div className="text-xs text-red-500 italic">Failed to load image</div>
    );

  return (
    <img
      src={imageUrl}
      alt="Encrypted attachment"
      className="max-w-[200px] rounded-lg shadow-sm"
    />
  );
};

export default EncryptedImageMessage;
