import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import type { UserRecord, AllowedEmailRecord } from "../api/client.ts";
import { useEntityStateStore } from "../store/entity-states.ts";
import { useThemeStore, type Theme } from "../store/theme.ts";
import { useToastStore } from "../store/toast.ts";
import { useAuthStore } from "../store/auth.ts";

export default function SettingsPage() {
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const haStatus = useEntityStateStore((s) => s.connectionStatus);
  const { theme, setTheme } = useThemeStore();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.settings.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.list(),
  });

  const { data: allowedEmails = [] } = useQuery({
    queryKey: ["allowed-emails"],
    queryFn: () => api.allowedEmails.list(),
  });

  // Local state for PIN editing
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  // Local state for new allowed email form
  const [newEmail, setNewEmail] = useState("");
  const [newEmailRole, setNewEmailRole] = useState<"admin" | "viewer">("viewer");

  const currentPin = settings?.["kiosk_pin"] as string | null ?? null;

  const saveSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      api.settings.set(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
    onError: (err) => addToast(`Save failed: ${(err as Error).message}`, "error"),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isEnabled?: boolean; resetLock?: boolean } }) =>
      api.users.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (err) => addToast(`Update failed: ${(err as Error).message}`, "error"),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.users.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (err) => addToast(`Delete failed: ${(err as Error).message}`, "error"),
  });

  const addAllowedEmail = useMutation({
    mutationFn: ({ email, role }: { email: string; role: "admin" | "viewer" }) =>
      api.allowedEmails.create(email, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["allowed-emails"] });
      setNewEmail("");
      setNewEmailRole("viewer");
      addToast("Email added to whitelist", "success");
    },
    onError: (err) => addToast(`Failed: ${(err as Error).message}`, "error"),
  });

  const removeAllowedEmail = useMutation({
    mutationFn: (id: string) => api.allowedEmails.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["allowed-emails"] }),
    onError: (err) => addToast(`Delete failed: ${(err as Error).message}`, "error"),
  });

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      addToast("PIN must be at least 4 digits", "error");
      return;
    }
    if (newPin !== confirmPin) {
      addToast("PINs do not match", "error");
      return;
    }
    saveSetting.mutate({ key: "kiosk_pin", value: newPin });
    setNewPin("");
    setConfirmPin("");
    addToast("PIN saved", "success");
  };

  const handleClearPin = () => {
    saveSetting.mutate({ key: "kiosk_pin", value: null });
    addToast("PIN cleared", "success");
  };

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    addAllowedEmail.mutate({ email: newEmail, role: newEmailRole });
  };

  return (
    <div className="min-h-screen bg-surface p-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin" className="text-xs text-gray-500 hover:text-gray-300">← Admin</Link>
          <h1 className="text-2xl font-semibold">Settings</h1>
        </div>

        {/* HA Connection Status */}
        <section className="mb-6 rounded-xl bg-surface-raised p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-gray-400">
            Home Assistant
          </h2>
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${haStatus.connected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-sm">
              {haStatus.connected
                ? `Connected — last updated ${haStatus.lastConnectedAt ?? "never"}`
                : `Disconnected${haStatus.error ? `: ${haStatus.error}` : ""}`}
            </span>
          </div>
        </section>

        {/* Theme */}
        <section className="mb-6 rounded-xl bg-surface-raised p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-gray-400">
            Appearance
          </h2>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Theme</span>
            <div className="flex gap-2">
              {(["dark", "light"] as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={[
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors capitalize",
                    theme === t
                      ? "bg-accent text-white"
                      : "bg-white/10 text-gray-400 hover:bg-white/20",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Kiosk PIN */}
        <section className="mb-6 rounded-xl bg-surface-raised p-6">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-widest text-gray-400">
            Kiosk PIN
          </h2>
          <p className="mb-4 text-xs text-gray-600">
            When set, a PIN overlay is required to access admin mode from the dashboard screen.
          </p>

          {currentPin ? (
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm text-green-400">PIN is set ({currentPin.length} digits)</span>
              <button
                type="button"
                onClick={handleClearPin}
                className="rounded bg-red-900/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-900/50"
              >
                Clear PIN
              </button>
            </div>
          ) : (
            <p className="mb-4 text-xs text-gray-500">No PIN set — admin is accessible without PIN from dashboard.</p>
          )}

          <form onSubmit={handleSavePin} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-gray-400">
                New PIN (digits only)
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 1234"
                  className="input-field"
                  minLength={4}
                  maxLength={8}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-400">
                Confirm PIN
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="repeat PIN"
                  className="input-field"
                />
              </label>
            </div>
            <div>
              <button
                type="submit"
                disabled={!newPin || saveSetting.isPending}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
              >
                Set PIN
              </button>
            </div>
          </form>
        </section>

        {/* User Accounts */}
        <section className="mb-6 rounded-xl bg-surface-raised p-6">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-widest text-gray-400">
            User Accounts
          </h2>
          <p className="mb-4 text-xs text-gray-600">
            Manage registered users. Locked accounts have exceeded the failed login attempt limit.
          </p>

          {users.length === 0 ? (
            <p className="text-xs text-gray-500">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Role</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Lock</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((user: UserRecord) => (
                    <tr key={user.id} className="py-2">
                      <td className="py-2 pr-4 text-gray-200">
                        {user.email}
                        {user.id === currentUserId && (
                          <span className="ml-2 text-xs text-gray-500">(you)</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={[
                          "rounded px-1.5 py-0.5 text-xs",
                          user.role === "admin"
                            ? "bg-purple-900/40 text-purple-300"
                            : "bg-white/10 text-gray-400",
                        ].join(" ")}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={[
                          "rounded px-1.5 py-0.5 text-xs",
                          user.isEnabled
                            ? "bg-green-900/40 text-green-400"
                            : "bg-gray-700 text-gray-400",
                        ].join(" ")}>
                          {user.isEnabled ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        {user.lockedAt ? (
                          <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-xs text-red-400">
                            Locked ({user.failedLoginAttempts} attempts)
                          </span>
                        ) : (
                          <span className="text-xs text-gray-600">—</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {user.lockedAt && (
                            <button
                              type="button"
                              onClick={() => {
                                updateUser.mutate({ id: user.id, data: { resetLock: true } });
                                addToast("Account unlocked", "success");
                              }}
                              className="rounded bg-yellow-900/30 px-2 py-0.5 text-xs text-yellow-400 hover:bg-yellow-900/50"
                            >
                              Unlock
                            </button>
                          )}
                          {user.id !== currentUserId && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  updateUser.mutate({ id: user.id, data: { isEnabled: !user.isEnabled } });
                                  addToast(user.isEnabled ? "User disabled" : "User enabled", "success");
                                }}
                                className={[
                                  "rounded px-2 py-0.5 text-xs",
                                  user.isEnabled
                                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                                    : "bg-green-900/30 text-green-400 hover:bg-green-900/50",
                                ].join(" ")}
                              >
                                {user.isEnabled ? "Disable" : "Enable"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Delete user ${user.email}?`)) {
                                    deleteUser.mutate(user.id);
                                    addToast("User deleted", "success");
                                  }
                                }}
                                className="rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/50"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pre-authorized Emails */}
        <section className="mb-6 rounded-xl bg-surface-raised p-6">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-widest text-gray-400">
            Pre-authorized Emails
          </h2>
          <p className="mb-4 text-xs text-gray-600">
            Only emails on this list can register. The assigned role is granted at registration.
          </p>

          {/* Add form */}
          <form onSubmit={handleAddEmail} className="mb-4 flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              className="flex-1 rounded-lg bg-surface-overlay px-3 py-1.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-accent"
              required
            />
            <select
              value={newEmailRole}
              onChange={(e) => setNewEmailRole(e.target.value as "admin" | "viewer")}
              className="rounded-lg bg-surface-overlay px-2 py-1.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-accent"
            >
              <option value="viewer">viewer</option>
              <option value="admin">admin</option>
            </select>
            <button
              type="submit"
              disabled={!newEmail || addAllowedEmail.isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
            >
              Add
            </button>
          </form>

          {allowedEmails.length === 0 ? (
            <p className="text-xs text-gray-500">No pre-authorized emails.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Role</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {allowedEmails.map((entry: AllowedEmailRecord) => (
                    <tr key={entry.id}>
                      <td className="py-2 pr-4 text-gray-200">{entry.email}</td>
                      <td className="py-2 pr-4">
                        <span className={[
                          "rounded px-1.5 py-0.5 text-xs",
                          entry.role === "admin"
                            ? "bg-purple-900/40 text-purple-300"
                            : "bg-white/10 text-gray-400",
                        ].join(" ")}>
                          {entry.role}
                        </span>
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => removeAllowedEmail.mutate(entry.id)}
                          className="rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Navigation links */}
        <section className="rounded-xl bg-surface-raised p-6">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-gray-400">
            Management
          </h2>
          <div className="flex flex-col gap-2">
            <Link to="/admin/dashboards" className="text-sm text-accent hover:underline">
              Manage Dashboards &amp; Floorplans →
            </Link>
            <Link to="/admin/assets" className="text-sm text-accent hover:underline">
              Asset Manager →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
