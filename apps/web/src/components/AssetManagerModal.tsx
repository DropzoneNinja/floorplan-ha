import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import { useToastStore } from "../store/toast.ts";
import type { Asset } from "@floorplan-ha/shared";

interface AssetManagerModalProps {
  /** Called with the selected asset ID when the user picks an asset. */
  onSelect?: (assetId: string) => void;
  /** Called when the modal should close without a selection. */
  onClose: () => void;
  /** When true the modal is in selection mode (shows a "Use this" button). */
  selectMode?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Modal for browsing, uploading, and deleting uploaded assets.
 * Can operate in read-only browsing mode or selection mode (selectMode=true).
 */
export function AssetManagerModal({ onSelect, onClose, selectMode = false }: AssetManagerModalProps) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
      // Simulate progress for UX feedback since fetch doesn't expose upload progress easily
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

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-white/10 bg-surface-raised shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">
            {selectMode ? "Select Asset" : "Asset Manager"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Upload drop zone */}
        <div
          className={`mx-5 mt-4 shrink-0 cursor-pointer rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
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
          aria-label="Upload area"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            className="hidden"
            onChange={handleFileInputChange}
          />
          {uploadProgress !== null ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Uploading…</p>
              <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-xs">
              Drop an image here or <span className="text-accent underline">click to browse</span>
              <br />
              <span className="text-[11px] text-gray-600">PNG · JPEG · WebP · GIF · SVG · max 20 MB</span>
            </p>
          )}
        </div>

        {/* Asset grid */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <p className="text-center text-xs text-gray-500">Loading…</p>
          ) : assets.length === 0 ? (
            <p className="text-center text-xs text-gray-500">No assets yet. Upload one above.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {assets.map((asset) => (
                <AssetTile
                  key={asset.id}
                  asset={asset}
                  selectMode={selectMode}
                  confirmingDelete={confirmDeleteId === asset.id}
                  onSelect={onSelect}
                  onDeleteRequest={() => setConfirmDeleteId(asset.id)}
                  onDeleteConfirm={() => deleteMutation.mutate(asset.id)}
                  onDeleteCancel={() => setConfirmDeleteId(null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tile sub-component ────────────────────────────────────────────────────────

interface AssetTileProps {
  asset: Asset;
  selectMode: boolean;
  confirmingDelete: boolean;
  onSelect: ((id: string) => void) | undefined;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

function AssetTile({
  asset,
  selectMode,
  confirmingDelete,
  onSelect,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: AssetTileProps) {
  const fileUrl = api.assets.fileUrl(asset.id);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-white/10 bg-surface">
      {/* Thumbnail */}
      <div className="relative flex h-24 items-center justify-center overflow-hidden bg-white/5">
        <img
          src={fileUrl}
          alt={asset.originalName}
          className="h-full w-full object-contain"
          loading="lazy"
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          {selectMode && onSelect && (
            <button
              type="button"
              onClick={() => onSelect(asset.id)}
              className="rounded bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:bg-accent-hover"
            >
              Use this
            </button>
          )}
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={onDeleteRequest}
              className="rounded bg-red-600/80 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-600"
            >
              Delete
            </button>
          ) : (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={onDeleteConfirm}
                className="rounded bg-red-600 px-2 py-0.5 text-[11px] text-white hover:bg-red-700"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={onDeleteCancel}
                className="rounded bg-white/20 px-2 py-0.5 text-[11px] text-white hover:bg-white/30"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="px-2 py-1.5">
        <p className="truncate text-[11px] text-gray-300" title={asset.originalName}>
          {asset.originalName}
        </p>
        <p className="text-[10px] text-gray-600">
          {formatBytes(asset.sizeBytes)}
          {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
        </p>
      </div>
    </div>
  );
}
