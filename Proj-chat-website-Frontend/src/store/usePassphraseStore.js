import { create } from "zustand";

export const usePassphraseStore = create((set) => ({
  showModal: false,
  callback: null,
  error: null,
  passphrase: null, // ✅ new
  setPassphrase: (passphrase) => set({ passphrase }), // ✅ new
  clearPassphrase: () => set({ passphrase: null }), // ✅ new

  openModal: (callback) => set({ showModal: true, callback, error: null }),
  closeModal: () => set({ showModal: false, callback: null, error: null }),
  setError: (error) => set({ error }),
  submitPassphrase: (passphrase) =>
    set((state) => {
      state.callback?.(passphrase);
      return { showModal: false, callback: null, error: null, passphrase };
    }),
}));
