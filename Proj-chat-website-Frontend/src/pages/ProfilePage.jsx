import { useEffect, useState } from "react";
import { Mail, User } from "lucide-react";
import ProfileAvatar from "../components/ProfileAvatar";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const ProfilePage = () => {
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD PROFILE ================= */
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/profile/get/me`, {
          credentials: "include",
        });

        const data = await res.json();
        setAuthUser(data);
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="h-screen pt-20 flex items-center justify-center">
        <p className="text-lg">Loading profile...</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="h-screen pt-20 flex items-center justify-center">
        <p className="text-red-500">Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="h-screen pt-20">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <div className="bg-base-300 rounded-xl p-6 space-y-8">
          {/* HEADER */}
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Profile</h1>
            <p className="mt-2">Your profile information</p>
          </div>

          {/* AVATAR */}
          <div className="flex flex-col items-center gap-4">
            <ProfileAvatar username={authUser.username} editable size={128} />
            <p className="text-sm text-zinc-400">
              Click camera to change photo
            </p>
          </div>

          {/* USER INFO */}
          <div className="space-y-6">
            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </div>
              <p className="px-4 py-2.5 bg-base-200 rounded-lg border">
                {authUser.firstName} {authUser.lastName}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </div>
              <p className="px-4 py-2.5 bg-base-200 rounded-lg border">
                {authUser.email}
              </p>
            </div>
          </div>

          {/* ACCOUNT INFO */}
          <div className="mt-6 bg-base-300 rounded-xl p-6">
            <h2 className="text-lg font-medium mb-4">Account Information</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                <span>Username</span>
                <span>{authUser.username}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-zinc-700">
                <span>Member Since</span>
                <span>{authUser.createdAt?.split("T")[0]}</span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span>Account Status</span>
                <span className="text-green-500">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
