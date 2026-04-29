import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const ProfileAvatar = ({ username, editable = false, size = 32 }) => {
  const fileRef = useRef(null);

  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  /* ================= LOAD IMAGE ================= */

  useEffect(() => {
    if (!username) return;
    refreshImage();
  }, [username]);

  const refreshImage = () => {
    // cache buster so browser always reloads new avatar
    setImageUrl(
      `${API_BASE_URL}/user/profile/picture/${username}?t=${Date.now()}`,
    );
  };

  /* ================= UPLOAD ================= */

  const uploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // optional: prevent huge uploads
    if (file.size > 5 * 1024 * 1024) {
      alert("Image too large (max 5MB)");
      return;
    }

    try {
      setUploading(true);

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${API_BASE_URL}/user/profile/picture`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      refreshImage();
    } catch (err) {
      console.error("Avatar upload failed:", err);
      alert("Failed to upload image");
    } finally {
      setUploading(false);
      e.target.value = ""; // allow re-upload same file
    }
  };

  /* ================= UI ================= */

  return (
    <div className="relative inline-block">
      <img
        src={imageUrl}
        onError={(e) => (e.currentTarget.src = "/avatar.png")}
        alt="Profile"
        style={{ width: size, height: size }}
        className={`rounded-full object-cover border transition ${
          uploading ? "opacity-50" : ""
        }`}
      />

      {editable && (
        <>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-0 right-0 bg-primary text-white p-1 rounded-full hover:scale-105 transition"
          >
            <Camera size={14} />
          </button>

          <input
            type="file"
            accept="image/*"
            hidden
            ref={fileRef}
            onChange={uploadImage}
          />
        </>
      )}
    </div>
  );
};

export default ProfileAvatar;
