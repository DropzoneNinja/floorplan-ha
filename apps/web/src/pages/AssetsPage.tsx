import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.ts";
import { useToastStore } from "../store/toast.ts";
import type { Asset } from "@floorplan-ha/shared";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Standalone asset manager page at /admin/assets.
 * Allows admins to upload, preview, and delete uploaded image assets.
 */
export default function AssetsPage() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  const { data: assets = [], isLoading } = useQuery<Asset[]>({
    queryKey: ["assets"],
    queryFn: () => api.assets.list() as Promise<Asset[]>,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.assets.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["assets"] });
      addToast("Asset deleted", "success");
      setConfirmDeleteId(null);
    },
    onError: (err: Error) => {
      addToast(err.message ?? "Delete failed", "error");
      setConfirmDeleteId(null);
    },
  });

  async function uploadFile(file: File) {
    setUploadProgress(0);
    try {
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => (p !== null && p < 85 ? p + 15 : p));
      }, 200);

      await api.assets.upload(file);

      clearInterval(progressInterval);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 600);

      void queryClient.invalidateQueries({ queryKey: ["assets"] });
      addToast("Asset uploaded", "success");
    } catch (err) {
      setUploadProgress(null);
      addToast((err as Error).message ?? "Upload failed", "error");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  return (
    <div className="min-h-screen bg-surface text-white">
      {/* Top nav */}
      <header className="flex items-center gap-4 border-b border-white/10 px-6 py-4">
        <Link
          to="/admin"
          className="text-xs text-gray-500 hover:text-white"
        >
          ← Admin
        </Link>
        <h1 className="text-sm font-semibold">Asset Manager</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`rounded px-2.5 py-1 text-xs ${view === "grid" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"}`}
          >
            Grid
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded px-2.5 py-1 text-xs ${view === "list" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"}`}
          >
            List
          </button>
          {/* Upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover"
          >
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </header>

      <main className="p-6">
        {/* Drop zone */}
        <div
          className={`mb-6 cursor-pointer rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragOver
              ? "border-accent bg-accent/10 text-white"
              : "border-white/20 text-gray-500 hover:border-white/40 hover:text-gray-300"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
          aria-label="Upload drop zone"
        >
          {uploadProgress !== null ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Uploading…</p>
              <div className="mx-auto h-2 w-64 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm">
              Drop an image here or{" "}
              <span className="text-accent underline">click to browse</span>
              <br />
              <span className="text-xs text-gray-600">
                PNG · JPEG · WebP · GIF · SVG — max 20 MB
              </span>
            </p>
          )}
        </div>

        {/* Asset count */}
        {!isLoading && (
          <p className="mb-4 text-xs text-gray-500">
            {assets.length} {assets.length === 1 ? "asset" : "assets"}
          </p>
        )}

        {isLoading ? (
          <p className="text-center text-sm text-gray-500">Loading…</p>
        ) : assets.length === 0 ? (
          <p className="text-center text-sm text-gray-500">No assets yet.</p>
        ) : view === "grid" ? (
          <GridView
            assets={assets}
            confirmDeleteId={confirmDeleteId}
            onDeleteRequest={setConfirmDeleteId}
            onDeleteConfirm={(id) => deleteMutation.mutate(id)}
            onDeleteCancel={() => setConfirmDeleteId(null)}
          />
        ) : (
          <ListView
            assets={assets}
            confirmDeleteId={confirmDeleteId}
            onDeleteRequest={setConfirmDeleteId}
            onDeleteConfirm={(id) => deleteMutation.mutate(id)}
            onDeleteCancel={() => setConfirmDeleteId(null)}
          />
        )}
      </main>
    </div>
  );
}

// ─── Grid view ─────────────────────────────────────────────────────────────────

interface ViewProps {
  assets: Asset[];
  confirmDeleteId: string | null;
  onDeleteRequest: (id: string) => void;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}

function GridView({ assets, confirmDeleteId, onDeleteRequest, onDeleteConfirm, onDeleteCancel }: ViewProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {assets.map((asset) => {
        const fileUrl = api.assets.fileUrl(asset.id);
        const confirming = confirmDeleteId === asset.id;

        return (
          <div
            key={asset.id}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-surface-raised"
          >
            {/* Thumbnail */}
            <div className="relative flex h-32 items-center justify-center overflow-hidden bg-white/5">
              <img
                src={fileUrl}
                alt={asset.originalName}
                className="h-full w-full object-contain"
                loading="lazy"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-end justify-center bg-black/60 pb-3 opacity-0 transition-opacity group-hover:opacity-100">
                {!confirming ? (
                  <button
                    type="button"
                    onClick={() => onDeleteRequest(asset.id)}
                    className="rounded bg-red-600/80 px-2.5 py-1 text-xs text-white hover:bg-red-600"
                  >
                    Delete
                  </button>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDeleteConfirm(asset.id)}
                      className="rounded bg-red-600 px-2.5 py-1 text-xs text-white hover:bg-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={onDeleteCancel}
                      className="rounded bg-white/20 px-2.5 py-1 text-xs text-white hover:bg-white/30"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="px-2.5 py-2">
              <p className="truncate text-xs text-gray-300" title={asset.originalName}>
                {asset.originalName}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-600">
                {formatBytes(asset.sizeBytes)}
                {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List view ─────────────────────────────────────────────────────────────────

function ListView({ assets, confirmDeleteId, onDeleteRequest, onDeleteConfirm, onDeleteCancel }: ViewProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 bg-surface-raised text-gray-500">
            <th className="px-4 py-2.5 font-medium">Preview</th>
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Size</th>
            <th className="px-4 py-2.5 font-medium">Dimensions</th>
            <th className="px-4 py-2.5 font-medium">Uploaded</th>
            <th className="px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => {
            const fileUrl = api.assets.fileUrl(asset.id);
            const confirming = confirmDeleteId === asset.id;

            return (
              <tr key={asset.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-2">
                  <img
                    src={fileUrl}
                    alt={asset.originalName}
                    className="h-10 w-16 rounded object-contain bg-white/5"
                    loading="lazy"
                  />
                </td>
                <td className="max-w-xs truncate px-4 py-2 text-gray-200" title={asset.originalName}>
                  {asset.originalName}
                </td>
                <td className="px-4 py-2 text-gray-500">{asset.mimeType.replace("image/", "")}</td>
                <td className="px-4 py-2 text-gray-500">{formatBytes(asset.sizeBytes)}</td>
                <td className="px-4 py-2 text-gray-500">
                  {asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"}
                </td>
                <td className="px-4 py-2 text-gray-500">{formatDate(asset.createdAt)}</td>
                <td className="px-4 py-2">
                  {!confirming ? (
                    <button
                      type="button"
                      onClick={() => onDeleteRequest(asset.id)}
                      className="rounded bg-red-600/70 px-2 py-0.5 text-xs text-white hover:bg-red-600"
                    >
                      Delete
                    </button>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => onDeleteConfirm(asset.id)}
                        className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={onDeleteCancel}
                        className="rounded bg-white/20 px-2 py-0.5 text-xs text-white hover:bg-white/30"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
