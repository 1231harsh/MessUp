import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import { useThemeStore } from "./store/useThemeStore";
import ProfilePage from "./pages/ProfilePage";
import { Toaster } from "react-hot-toast";
import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuthStore } from "./store/useAuthStore";
import PassphraseModal from "./components/PassphraseModal";
import encryptionService from "./lib/encryption";

const App = () => {
  const { theme } = useThemeStore();
  const { isAuthenticated, isLoading, checkAuthStatus } = useAuthStore();
  const location = useLocation();

  const [showModal, setShowModal] = useState(false);
  const [modalResolve, setModalResolve] = useState(null);

  // Run auth check only if not on login/signup
  useEffect(() => {
    if (location.pathname !== "/login" && location.pathname !== "/signup") {
      checkAuthStatus();
    }
  }, [location.pathname]);

  useEffect(() => {
    encryptionService.setPassphraseHandler(() => {
      return new Promise((resolve) => {
        setModalResolve(() => resolve);
        setShowModal(true);
      });
    });
  }, []);

  const handlePassphraseSubmit = (passphrase) => {
    if (modalResolve) modalResolve(passphrase);
    setModalResolve(null);
    setShowModal(false);
  };

  const handlePassphraseCancel = () => {
    if (modalResolve) modalResolve(null);
    setModalResolve(null);
    setShowModal(false);
  };

  // Only show loading screen for protected routes
  const isProtectedRoute =
    location.pathname !== "/login" && location.pathname !== "/signup";

  if (isLoading && isProtectedRoute) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-lg text-gray-600">🔄 Checking authentication...</p>
      </div>
    );
  }

  return (
    <div data-theme={theme}>
      <Toaster position="top-right" />
      <Navbar />

      <PassphraseModal
        visible={showModal}
        onSubmit={handlePassphraseSubmit}
        onCancel={handlePassphraseCancel}
      />

      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/" /> : <SignUpPage />}
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
};

export default App;
