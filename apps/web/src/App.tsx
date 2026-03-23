import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth.ts";
import { useThemeStore } from "./store/theme.ts";
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import { Toaster } from "./components/Toaster.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ChangePasswordPage from "./pages/ChangePasswordPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import AssetsPage from "./pages/AssetsPage.tsx";
import DashboardsPage from "./pages/DashboardsPage.tsx";

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);

  // Check if we have a valid session and load persisted settings on app load
  useEffect(() => {
    hydrate();
    hydrateTheme();
  }, [hydrate, hydrateTheme]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute requireAdmin>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/assets"
          element={
            <ProtectedRoute requireAdmin>
              <AssetsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboards"
          element={
            <ProtectedRoute requireAdmin>
              <DashboardsPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
