import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import type { UserRecord, AllowedEmailRecord, BackupFile } from "../api/client.ts";
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
    mutationFn: ({ id, data }: { id: string; data: { isEnabled?: boolean; resetLock?: boolean; resetPassword?: boolean } }) =>
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

  // ── Backup & Restore ───────────────────────────────────────────────────────

  const restoreInputRef = useRef<HTMLInputElement>(null);

  const { data: backupList = [], refetch: refetchBackups } = useQuery({
    queryKey: ["backups"],
    queryFn: () => api.backup.list(),
  });

  const backupSchedule = (settings?.["backup_schedule"] as string) ?? "off";
  const backupLastRunAt = (settings?.["backup_last_run_at"] as string) ?? null;

  const createBackupMutation = useMutation({
    mutationFn: () => api.backup.create(),
    onSuccess: () => {
      void refetchBackups();
      qc.invalidateQueries({ queryKey: ["settings"] });
      addToast("Backup created successfully", "success");
    },
    onError: (err) => addToast(`Backup failed: ${(err as Error).message}`, "error"),
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (filename: string) => api.backup.delete(filename),
    onSuccess: () => {
      void refetchBackups();
      addToast("Backup deleted", "success");
    },
    onError: (err) => addToast(`Delete failed: ${(err as Error).message}`, "error"),
  });

  const restoreMutation = useMutation({
    mutationFn: (file: File) => api.backup.restore(file),
    onSuccess: (res) => addToast(res.message, "success"),
    onError: (err) => addToast(`Restore failed: ${(err as Error).message}`, "error"),
  });

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("⚠️ This will overwrite ALL current data (settings, floorplans, images). Are you sure you want to restore from this backup?")) {
      e.target.value = "";
      return;
    }
    restoreMutation.mutate(file);
    e.target.value = "";
  };

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  return (
    <div className="h-full overflow-y-auto bg-surface p-8 text-white">
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

        {/* Screensaver */}
        <section className="mb-6 rounded-xl bg-surface-raised p-6">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-widest text-gray-400">
            Screensaver
          </h2>
          <p className="mb-4 text-xs text-gray-600">
            Dim the display after a period of inactivity. Set to 0 to disable.
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-400">
              Timeout
              <input
                type="number"
                min={0}
                max={20}
                value={(settings?.["screensaver_timeout"] as number | null) ?? 5}
                onChange={(e) => {
                  const val = Math.min(20, Math.max(0, parseInt(e.target.value, 10) || 0));
                  saveSetting.mutate({ key: "screensaver_timeout", value: val });
                }}
                className="input-field w-20"
              />
              minutes
            </label>
            <span className="text-xs text-gray-600">
              {((settings?.["screensaver_timeout"] as number | null) ?? 5) === 0
                ? "Screensaver disabled"
                : `Activates after ${(settings?.["screensaver_timeout"] as number | null) ?? 5} min of inactivity`}
            </span>
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
                                  updateUser.mutate(
                                    { id: user.id, data: { resetPassword: true } },
                                    { onSuccess: () => addToast(`Password reset flagged for ${user.email}`, "success") },
                                  );
                                }}
                                disabled={updateUser.isPending}
                                className="rounded bg-blue-900/30 px-2 py-0.5 text-xs text-blue-400 hover:bg-blue-900/50 disabled:opacity-40"
                              >
                                Reset Password
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

        {/* Backup & Restore */}
        <section className="mb-6 rounded-xl bg-surface-raised p-6">
          <h2 className="mb-1 text-sm font-medium uppercase tracking-widest text-gray-400">
            Backup &amp; Restore
          </h2>
          <p className="mb-4 text-xs text-gray-600">
            Backups include the database, settings, and all uploaded images in a single zip file.
          </p>

          {/* Schedule + manual trigger */}
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-400">
              Automatic backups
              <select
                value={backupSchedule}
                onChange={(e) => saveSetting.mutate({ key: "backup_schedule", value: e.target.value })}
                className="rounded-lg bg-surface-overlay px-2 py-1.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-accent"
              >
                <option value="off">Off</option>
                <option value="on_change">On change</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => createBackupMutation.mutate()}
              disabled={createBackupMutation.isPending}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
            >
              {createBackupMutation.isPending ? "Creating…" : "Create Backup Now"}
            </button>
          </div>

          {backupLastRunAt && (
            <p className="mb-3 text-xs text-gray-500">
              Last backup: {formatDate(backupLastRunAt)}
            </p>
          )}

          {/* Backup list */}
          {backupList.length === 0 ? (
            <p className="mb-4 text-xs text-gray-500">No backups found.</p>
          ) : (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-gray-500">
                    <th className="pb-2 pr-4 font-medium">File</th>
                    <th className="pb-2 pr-4 font-medium">Size</th>
                    <th className="pb-2 pr-4 font-medium">Created</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {backupList.map((b: BackupFile) => (
                    <tr key={b.filename}>
                      <td className="py-2 pr-4 font-mono text-xs text-gray-300">{b.filename}</td>
                      <td className="py-2 pr-4 text-xs text-gray-400">{formatBytes(b.sizeBytes)}</td>
                      <td className="py-2 pr-4 text-xs text-gray-400">{formatDate(b.createdAt)}</td>
                      <td className="py-2">
                        <div className="flex gap-1.5">
                          <a
                            href={api.backup.downloadUrl(b.filename)}
                            download={b.filename}
                            className="rounded bg-white/10 px-2 py-0.5 text-xs text-gray-300 hover:bg-white/20"
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete backup ${b.filename}?`)) {
                                deleteBackupMutation.mutate(b.filename);
                              }
                            }}
                            className="rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Restore */}
          <div className="border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-medium text-yellow-400">
              ⚠️ Restore — overwrites all current data
            </p>
            <p className="mb-3 text-xs text-gray-600">
              Upload a previously downloaded backup zip to restore all data and images.
            </p>
            <div className="flex items-center gap-3">
              <input
                ref={restoreInputRef}
                type="file"
                accept=".zip"
                onChange={handleRestoreFile}
                className="hidden"
                id="restore-file-input"
              />
              <label
                htmlFor="restore-file-input"
                className={[
                  "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium",
                  restoreMutation.isPending
                    ? "bg-yellow-900/40 text-yellow-300 opacity-60 cursor-not-allowed"
                    : "bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50",
                ].join(" ")}
              >
                {restoreMutation.isPending ? "Restoring…" : "Restore from Backup…"}
              </label>
            </div>
          </div>
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
