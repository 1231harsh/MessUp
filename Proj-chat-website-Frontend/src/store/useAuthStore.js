import { create } from "zustand";
import { toast } from "react-hot-toast";
import { getCurrentUser, logout as apiLogout } from "../lib/api";
import encryptionService from "../lib/encryption";

const useAuthStore = create((set, get) => {
  const tryInitEncryption = async (username) => {
    if (!username) return;

    console.log("🔐 Initializing encryption for user:", username);

    try {
      await encryptionService.initialize(username);
      return true;
    } catch (err) {
      console.warn("⚠️ Encryption initialization failed:", err.message);

      if (
        err.message.includes("Passphrase prompt cancelled by user") ||
        err.message.includes("User declined key generation")
      ) {
        toast.error("🔐 Encryption cancelled. You have been logged out.");
        await get().logout();
        throw new Error("User cancelled encryption setup — aborting login.");
      }

      toast.error("⚠️ Encryption failed. Please try again.");
      return false;
    }
  };

  return {
    isAuthenticated: false,
    user: null,
    isLoading: false,

    checkAuthStatus: async () => {
      set({ isLoading: true });

      try {
        const user = await getCurrentUser();

        set({
          isAuthenticated: true,
          user,
          isLoading: false,
        });

        const success = await tryInitEncryption(user?.username);
        if (!success) return false;

        return true;
      } catch (error) {
        if (
          error.message.includes("User cancelled encryption setup") ||
          error.message.includes("Passphrase prompt cancelled by user")
        ) {
          set({ isLoading: false });
          return false;
        }

        console.log("❌ Not authenticated or session expired");
        set({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });

        return false;
      }
    },

    login: async (userData) => {
      try {
        const user = await getCurrentUser();

        set({
          isAuthenticated: true,
          user,
        });

        const success = await tryInitEncryption(user?.username);
        if (!success) return;
      } catch (error) {
        console.warn("⚠️ Fallback: using login data for auth state");

        if (
          error.message.includes("User cancelled encryption setup") ||
          error.message.includes("Passphrase prompt cancelled by user")
        ) {
          return;
        }

        set({
          isAuthenticated: true,
          user: userData || null,
        });

        const success = await tryInitEncryption(userData?.username);
        if (!success) await get().logout();
      }
    },

    handleOAuth2Success: async () => {
      try {
        const user = await getCurrentUser();
        set({ isAuthenticated: true, user });

        const success = await tryInitEncryption(user?.username);
        return success;
      } catch (error) {
        if (
          error.message.includes("User cancelled encryption setup") ||
          error.message.includes("Passphrase prompt cancelled by user")
        ) {
          return false;
        }

        console.error("Failed to handle OAuth2 success:", error);
        return false;
      }
    },

    logout: async () => {
      console.log("🚪 Logging out user...");

      try {
        await apiLogout();
      } catch (error) {
        console.error("Backend logout failed:", error);
      }

      encryptionService.clearKeys();

      set({
        isAuthenticated: false,
        user: null,
      });

      console.log("✅ Logout complete");
      toast.success("👋 Logged out successfully");

      window.location.href = "/login";
    },

    updateUser: (userData) => {
      set({ user: userData });
    },

    refreshUser: async () => {
      try {
        const user = await getCurrentUser();
        set({ user });

        const success = await tryInitEncryption(user?.username);
        if (!success) await get().logout();

        return user;
      } catch (error) {
        console.error("Failed to refresh user data:", error);
        await get().logout();
        return null;
      }
    },
  };
});

export { useAuthStore };
