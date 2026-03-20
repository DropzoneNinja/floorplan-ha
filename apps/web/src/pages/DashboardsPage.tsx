import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.ts";
import { useToastStore } from "../store/toast.ts";
import { AssetManagerModal } from "../components/AssetManagerModal.tsx";
import type { FloorplanImageMode, CycleImages, Asset } from "@floorplan-ha/shared";

interface DashboardRaw {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
}

interface FloorplanRaw {
  id: string;
  dashboardId: string;
  name: string;
  imageMode: FloorplanImageMode;
  imageStretch: boolean;
  imageAssetId: string | null;
  cycleImagesJson: CycleImages | Record<string, never>;
  width: number;
  height: number;
  backgroundColor: string;
  createdAt: string;
}

type CyclePickerSlot = { phase: "day" | "night"; index: number };

const EMPTY_CYCLE: CycleImages = {
  day: Array(12).fill(null) as null[],
  night: Array(12).fill(null) as null[],
};

const DAY_LABELS = [
  "Dawn", "Early morning", "Morning", "Mid-morning",
  "Late morning", "Midday", "Early afternoon", "Afternoon",
  "Late afternoon", "Early evening", "Evening", "Dusk",
];

const NIGHT_LABELS = [
  "After sunset", "Early night", "Night", "Mid-night",
  "Late night", "Midnight", "Post-midnight", "Early pre-dawn",
  "Pre-dawn", "Late pre-dawn", "Before sunrise", "Just before dawn",
];

/**
 * Admin page for managing dashboards and their floorplans.
 * Route: /admin/dashboards
 */
export default function DashboardsPage() {
  const qc = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();

  const [expandedDashboardId, setExpandedDashboardId] = useState<string | null>(null);
  const [newDashboardName, setNewDashboardName] = useState("");
  const [editingDashboard, setEditingDashboard] = useState<DashboardRaw | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [newFloorplanName, setNewFloorplanName] = useState<Record<string, string>>({});
  const [editingFloorplan, setEditingFloorplan] = useState<FloorplanRaw | null>(null);
  const [editFpName, setEditFpName] = useState("");
  const [editFpBg, setEditFpBg] = useState("#1a1a1a");
  const [editFpWidth, setEditFpWidth] = useState(1920);
  const [editFpHeight, setEditFpHeight] = useState(1080);
  const [editFpMode, setEditFpMode] = useState<FloorplanImageMode>("single");
  const [editFpStretch, setEditFpStretch] = useState(true);
  const [editFpImageId, setEditFpImageId] = useState<string | null>(null);
  const [editFpCycleImages, setEditFpCycleImages] = useState<CycleImages>(EMPTY_CYCLE);

  // Asset picker state
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetPickerTarget, setAssetPickerTarget] = useState<"single" | CyclePickerSlot>("single");

  // Fetch metadata for the currently selected single image (for thumbnail + dimension hint)
  const { data: selectedAsset } = useQuery<Asset>({
    queryKey: ["asset", editFpImageId],
    queryFn: () => api.assets.get(editFpImageId!) as Promise<Asset>,
    enabled: editFpImageId !== null && editFpMode === "single",
  });

  // ── Dashboards ──────────────────────────────────────────────────────────────

  const { data: dashboards = [], isLoading } = useQuery<DashboardRaw[]>({
    queryKey: ["dashboards"],
    queryFn: () => api.dashboards.list() as Promise<DashboardRaw[]>,
  });

  const createDashboard = useMutation({
    mutationFn: (name: string) =>
      api.dashboards.create({ name, slug: slugify(name), description: null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      setNewDashboardName("");
      addToast("Dashboard created", "success");
    },
    onError: (err) => addToast(`Failed: ${(err as Error).message}`, "error"),
  });

  const updateDashboard = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => api.dashboards.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      setEditingDashboard(null);
      addToast("Dashboard updated", "success");
    },
    onError: (err) => addToast(`Failed: ${(err as Error).message}`, "error"),
  });

  const setDefaultDashboard = useMutation({
    mutationFn: (id: string) => api.dashboards.update(id, { isDefault: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      addToast("Default dashboard updated", "success");
    },
    onError: (err) => addToast(`Failed: ${(err as Error).message}`, "error"),
  });

  const deleteDashboard = useMutation({
    mutationFn: (id: string) => api.dashboards.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboards"] });
      addToast("Dashboard deleted", "success");
    },
    onError: (err) => addToast(`Failed: ${(err as Error).message}`, "error"),
  });

  // ── Floorplans ──────────────────────────────────────────────────────────────

  const { data: allFloorplans = [] } = useQuery<FloorplanRaw[]>({
    queryKey: ["all-floorplans"],
    queryFn: () => api.floorplans.list() as Promise<FloorplanRaw[]>,
  });

  const createFloorplan = useMutation({
    mutationFn: ({ dashboardId, name }: { dashboardId: string; name: string }) =>
      api.floorplans.create({
        dashboardId,
        name,
        width: 1920,
        height: 1080,
        backgroundColor: "#1a1a1a",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-floorplans"] });
      addToast("Floorplan created", "success");
    },
    onError: (err) => addToast(`Failed: ${(err as Error).message}`, "error"),
  });

  const updateFloorplan = useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => api.floorplans.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-floorplans"] });
      setEditingFloorplan(null);
      addToast("Floorplan updated", "success");
    },
    onError: (err) => addToast(`Failed: ${(err as Error).message}`, "error"),
  });

  const deleteFloorplan = useMutation({
    mutationFn: (id: string) => api.floorplans.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-floorplans"] });
      addToast("Floorplan deleted", "success");
    },
    onError: (err) => addToast(`Failed: ${(err as Error).message}`, "error"),
  });

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleCreateDashboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDashboardName.trim()) return;
    createDashboard.mutate(newDashboardName.trim());
  };

  const handleSaveDashboard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDashboard) return;
    updateDashboard.mutate({
      id: editingDashboard.id,
      data: { name: editName, slug: slugify(editName), description: editDescription || null },
    });
  };

  const handleCreateFloorplan = (dashboardId: string, e: React.FormEvent) => {
    e.preventDefault();
    const name = newFloorplanName[dashboardId]?.trim();
    if (!name) return;
    createFloorplan.mutate({ dashboardId, name });
    setNewFloorplanName((prev) => ({ ...prev, [dashboardId]: "" }));
  };

  const handleSaveFloorplan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFloorplan) return;
    updateFloorplan.mutate({
      id: editingFloorplan.id,
      data: {
        name: editFpName,
        width: editFpWidth,
        height: editFpHeight,
        backgroundColor: editFpBg,
        imageMode: editFpMode,
        imageStretch: editFpStretch,
        imageAssetId: editFpMode === "single" ? editFpImageId : null,
        cycleImagesJson: editFpMode === "day_night_cycle" ? editFpCycleImages : EMPTY_CYCLE,
      },
    });
  };

  const startEditFloorplan = (fp: FloorplanRaw) => {
    setEditingFloorplan(fp);
    setEditFpName(fp.name);
    setEditFpBg(fp.backgroundColor);
    setEditFpWidth(fp.width);
    setEditFpHeight(fp.height);
    setEditFpMode(fp.imageMode ?? "single");
    setEditFpStretch(fp.imageStretch ?? true);
    setEditFpImageId(fp.imageAssetId);
    setEditFpCycleImages(
      fp.cycleImagesJson && "day" in fp.cycleImagesJson
        ? fp.cycleImagesJson as CycleImages
        : EMPTY_CYCLE,
    );
  };

  const handleExport = async (floorplanId: string, floorplanName: string) => {
    try {
      const blob = await api.floorplans.export(floorplanId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `floorplan-${floorplanName.replace(/\s+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast(`Export failed: ${(err as Error).message}`, "error");
    }
  };

  // Open asset picker for single image or a specific cycle slot
  const openPicker = (target: "single" | CyclePickerSlot) => {
    setAssetPickerTarget(target);
    setShowAssetPicker(true);
  };

  const handleAssetSelected = (assetId: string) => {
    if (assetPickerTarget === "single") {
      setEditFpImageId(assetId);
    } else {
      const { phase, index } = assetPickerTarget;
      setEditFpCycleImages((prev) => {
        const next = { day: [...prev.day], night: [...prev.night] };
        next[phase][index] = assetId;
        return next;
      });
    }
    setShowAssetPicker(false);
  };

  const clearCycleSlot = (phase: "day" | "night", index: number) => {
    setEditFpCycleImages((prev) => {
      const next = { day: [...prev.day], night: [...prev.night] };
      next[phase][index] = null;
      return next;
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface p-8 text-white">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link to="/admin" className="text-xs text-gray-500 hover:text-gray-300">← Admin</Link>
          <h1 className="text-2xl font-semibold">Dashboards</h1>
        </div>

        {/* Create Dashboard */}
        <form onSubmit={handleCreateDashboard} className="mb-8 flex gap-2">
          <input
            value={newDashboardName}
            onChange={(e) => setNewDashboardName(e.target.value)}
            placeholder="New dashboard name…"
            className="input-field flex-1"
          />
          <button
            type="submit"
            disabled={!newDashboardName.trim() || createDashboard.isPending}
            className="rounded-md bg-accent px-3 py-1 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            Create
          </button>
        </form>

        {/* Dashboard List */}
        <div className="space-y-4">
          {dashboards.map((dashboard) => {
            const floorplans = allFloorplans.filter((fp) => fp.dashboardId === dashboard.id);
            const isExpanded = expandedDashboardId === dashboard.id;

            return (
              <div key={dashboard.id} className="rounded-xl bg-surface-raised">
                {/* Dashboard row */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedDashboardId(isExpanded ? null : dashboard.id)}
                    className="text-sm font-medium text-gray-200 hover:text-white flex-1 text-left flex items-center gap-2"
                  >
                    <span className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                    {dashboard.name}
                    {dashboard.isDefault && (
                      <span className="ml-2 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">default</span>
                    )}
                    <span className="text-xs text-gray-600">({floorplans.length} floorplan{floorplans.length !== 1 ? "s" : ""})</span>
                  </button>

                  <div className="flex gap-1.5 shrink-0">
                    {!dashboard.isDefault && (
                      <button
                        type="button"
                        onClick={() => setDefaultDashboard.mutate(dashboard.id)}
                        className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-gray-400 hover:bg-white/10"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDashboard(dashboard);
                        setEditName(dashboard.name);
                        setEditDescription(dashboard.description ?? "");
                      }}
                      className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-gray-400 hover:bg-white/10"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm(`Delete dashboard "${dashboard.name}"? This will also delete all its floorplans and hotspots.`)) return;
                        deleteDashboard.mutate(dashboard.id);
                      }}
                      className="rounded bg-red-900/30 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-900/50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Floorplans (expanded) */}
                {isExpanded && (
                  <div className="border-t border-white/5 px-4 pb-4 pt-3">
                    {floorplans.length > 0 ? (
                      <div className="mb-3 space-y-2">
                        {floorplans.map((fp) => (
                          <div key={fp.id} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
                            <button
                              type="button"
                              onClick={() => startEditFloorplan(fp)}
                              className="flex-1 text-left text-gray-300 hover:text-white"
                            >
                              {fp.name}
                            </button>
                            <span className="text-xs text-gray-600">{fp.width}×{fp.height}</span>
                            <ImageModeBadge mode={fp.imageMode ?? "single"} />
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => navigate(`/admin?floorplanId=${fp.id}`)}
                                className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-white/10"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleExport(fp.id, fp.name)}
                                className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-400 hover:bg-white/10"
                              >
                                Export
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm(`Delete floorplan "${fp.name}"?`)) return;
                                  deleteFloorplan.mutate(fp.id);
                                }}
                                className="rounded bg-red-900/20 px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-900/40"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mb-3 text-xs text-gray-600">No floorplans yet.</p>
                    )}

                    {/* Create floorplan in this dashboard */}
                    <form onSubmit={(e) => handleCreateFloorplan(dashboard.id, e)} className="flex gap-2">
                      <input
                        value={newFloorplanName[dashboard.id] ?? ""}
                        onChange={(e) =>
                          setNewFloorplanName((prev) => ({ ...prev, [dashboard.id]: e.target.value }))
                        }
                        placeholder="New floorplan name…"
                        className="input-field flex-1 text-xs"
                      />
                      <button
                        type="submit"
                        disabled={!newFloorplanName[dashboard.id]?.trim() || createFloorplan.isPending}
                        className="rounded bg-accent/20 px-2.5 py-1 text-xs text-accent hover:bg-accent/30 disabled:opacity-40"
                      >
                        + Add
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}

          {dashboards.length === 0 && (
            <p className="text-center text-sm text-gray-600">No dashboards yet. Create one above.</p>
          )}
        </div>
      </div>

      {/* Edit Dashboard Modal */}
      {editingDashboard && (
        <Modal title="Edit Dashboard" onClose={() => setEditingDashboard(null)}>
          <form onSubmit={handleSaveDashboard} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              Name
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input-field"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              Description (optional)
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="input-field"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingDashboard(null)}
                className="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateDashboard.isPending}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Floorplan Modal */}
      {editingFloorplan && (
        <Modal title="Edit Floorplan" onClose={() => setEditingFloorplan(null)} wide>
          <form onSubmit={handleSaveFloorplan} className="flex flex-col gap-5">
            {/* Name */}
            <label className="flex flex-col gap-1 text-xs text-gray-400">
              Name
              <input
                value={editFpName}
                onChange={(e) => setEditFpName(e.target.value)}
                className="input-field"
                required
              />
            </label>

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-gray-400">
                Width (px)
                <input
                  type="number"
                  value={editFpWidth}
                  onChange={(e) => setEditFpWidth(Number(e.target.value))}
                  className="input-field"
                  min={1}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-400">
                Height (px)
                <input
                  type="number"
                  value={editFpHeight}
                  onChange={(e) => setEditFpHeight(Number(e.target.value))}
                  className="input-field"
                  min={1}
                />
              </label>
            </div>

            {/* Image Mode — card selector */}
            <div className="flex flex-col gap-2">
              <span className="text-xs text-gray-400">Background Mode</span>
              <div className="grid grid-cols-3 gap-2">
                <ModeCard
                  mode="single"
                  selected={editFpMode === "single"}
                  onClick={() => setEditFpMode("single")}
                  icon="🖼"
                  label="Single Image"
                  description="One static background"
                />
                <ModeCard
                  mode="day_night_cycle"
                  selected={editFpMode === "day_night_cycle"}
                  onClick={() => setEditFpMode("day_night_cycle")}
                  icon="☀︎☾"
                  label="Day / Night"
                  description="24 images follow the sun"
                />
                <ModeCard
                  mode="none"
                  selected={editFpMode === "none"}
                  onClick={() => setEditFpMode("none")}
                  icon="⬛"
                  label="Color Only"
                  description="Solid background, no image"
                />
              </div>
            </div>

            {/* Stretch toggle — shown for image modes only */}
            {editFpMode !== "none" && (
              <button
                type="button"
                onClick={() => setEditFpStretch((v) => !v)}
                className={[
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  editFpStretch
                    ? "border-accent/40 bg-accent/10 text-white"
                    : "border-white/10 bg-surface text-gray-400 hover:border-white/20",
                ].join(" ")}
              >
                <span className={[
                  "flex h-4 w-8 shrink-0 items-center rounded-full transition-colors",
                  editFpStretch ? "bg-accent" : "bg-white/20",
                ].join(" ")}>
                  <span className={[
                    "h-3 w-3 rounded-full bg-white shadow transition-transform",
                    editFpStretch ? "translate-x-4" : "translate-x-0.5",
                  ].join(" ")} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">Stretch to fill</span>
                  <span className="text-[10px] text-gray-500">
                    {editFpStretch
                      ? "Image scales to fill the entire canvas"
                      : "Image shown at its actual proportions, letterboxed"}
                  </span>
                </span>
              </button>
            )}

            {/* Single image picker */}
            {editFpMode === "single" && (
              <div className="flex flex-col gap-2">
                <span className="text-xs text-gray-400">Floorplan Image</span>
                {editFpImageId ? (
                  <div className="flex flex-col gap-2">
                    {/* Thumbnail */}
                    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-surface">
                      <img
                        src={api.assets.fileUrl(editFpImageId)}
                        alt="Selected floorplan"
                        className="h-36 w-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                    {/* Dimension hint */}
                    {selectedAsset?.width && selectedAsset?.height &&
                      (selectedAsset.width !== editFpWidth || selectedAsset.height !== editFpHeight) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditFpWidth(selectedAsset.width!);
                          setEditFpHeight(selectedAsset.height!);
                        }}
                        className="self-start rounded bg-accent/15 px-2.5 py-1 text-[11px] text-accent hover:bg-accent/25"
                      >
                        Use image dimensions ({selectedAsset.width}×{selectedAsset.height})
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openPicker("single")}
                        className="flex-1 rounded bg-white/10 py-1.5 text-xs text-gray-300 hover:bg-white/20"
                      >
                        Change Image
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditFpImageId(null)}
                        className="rounded bg-red-900/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openPicker("single")}
                    className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/15 text-gray-500 transition-colors hover:border-accent/50 hover:text-accent"
                  >
                    <span className="text-2xl">+</span>
                    <span className="text-xs">Browse or upload image</span>
                  </button>
                )}

                {/* Background / letterbox color (secondary) */}
                <details className="group">
                  <summary className="cursor-pointer list-none text-[11px] text-gray-600 hover:text-gray-400 select-none">
                    <span>▸ Background / letterbox color</span>
                  </summary>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="color"
                      value={editFpBg}
                      onChange={(e) => setEditFpBg(e.target.value)}
                      className="h-8 w-10 rounded border border-white/10 bg-transparent cursor-pointer"
                    />
                    <input
                      value={editFpBg}
                      onChange={(e) => setEditFpBg(e.target.value)}
                      className="input-field flex-1 text-xs"
                      placeholder="#1a1a1a"
                    />
                  </div>
                </details>
              </div>
            )}

            {/* Day/Night Cycle image grids */}
            {editFpMode === "day_night_cycle" && (
              <div className="flex flex-col gap-4">
                <CycleImageGrid
                  phase="day"
                  images={editFpCycleImages.day}
                  labels={DAY_LABELS}
                  onPick={(index) => openPicker({ phase: "day", index })}
                  onClear={(index) => clearCycleSlot("day", index)}
                />
                <CycleImageGrid
                  phase="night"
                  images={editFpCycleImages.night}
                  labels={NIGHT_LABELS}
                  onPick={(index) => openPicker({ phase: "night", index })}
                  onClear={(index) => clearCycleSlot("night", index)}
                />
                <p className="text-[10px] text-gray-600">
                  Sunrise/sunset times are pulled automatically from your Home Assistant configuration.
                </p>

                {/* Background / letterbox color (secondary) */}
                <details className="group">
                  <summary className="cursor-pointer list-none text-[11px] text-gray-600 hover:text-gray-400 select-none">
                    <span>▸ Background / letterbox color</span>
                  </summary>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="color"
                      value={editFpBg}
                      onChange={(e) => setEditFpBg(e.target.value)}
                      className="h-8 w-10 rounded border border-white/10 bg-transparent cursor-pointer"
                    />
                    <input
                      value={editFpBg}
                      onChange={(e) => setEditFpBg(e.target.value)}
                      className="input-field flex-1 text-xs"
                      placeholder="#1a1a1a"
                    />
                  </div>
                </details>
              </div>
            )}

            {/* None mode — color picker is the focus */}
            {editFpMode === "none" && (
              <div className="flex flex-col gap-3">
                <span className="text-xs text-gray-400">Background Color</span>
                {/* Large color swatch preview */}
                <div
                  className="h-24 w-full rounded-lg border border-white/10 transition-colors"
                  style={{ backgroundColor: editFpBg }}
                />
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={editFpBg}
                    onChange={(e) => setEditFpBg(e.target.value)}
                    className="h-9 w-12 rounded border border-white/10 bg-transparent cursor-pointer"
                  />
                  <input
                    value={editFpBg}
                    onChange={(e) => setEditFpBg(e.target.value)}
                    className="input-field flex-1"
                    placeholder="#1a1a1a"
                  />
                </div>
                <p className="text-[11px] text-gray-600">
                  No image will be shown — only this color fills the background.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-white/5 pt-2">
              <button
                type="button"
                onClick={() => setEditingFloorplan(null)}
                className="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateFloorplan.isPending}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Asset picker */}
      {showAssetPicker && (
        <AssetManagerModal
          selectMode
          onSelect={handleAssetSelected}
          onClose={() => setShowAssetPicker(false)}
        />
      )}
    </div>
  );
}

// ─── Mode Card ────────────────────────────────────────────────────────────────

function ModeCard({
  selected,
  onClick,
  icon,
  label,
  description,
}: {
  mode: FloorplanImageMode;
  selected: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center transition-colors",
        selected
          ? "border-accent bg-accent/15 text-white"
          : "border-white/10 bg-surface text-gray-400 hover:border-white/25 hover:text-gray-200",
      ].join(" ")}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
      <span className={`text-[10px] leading-snug ${selected ? "text-accent/80" : "text-gray-600"}`}>
        {description}
      </span>
    </button>
  );
}

// ─── Cycle Image Grid ─────────────────────────────────────────────────────────

function CycleImageGrid({
  phase,
  images,
  labels,
  onPick,
  onClear,
}: {
  phase: "day" | "night";
  images: (string | null)[];
  labels: string[];
  onPick: (index: number) => void;
  onClear: (index: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-gray-300">
        {phase === "day" ? "☀︎  Daytime — Dawn → Dusk" : "☾  Nighttime — Dusk → Dawn"}
      </span>
      <div className="grid grid-cols-4 gap-1.5">
        {images.map((assetId, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onPick(i)}
              className={[
                "relative flex h-14 w-full items-center justify-center rounded border text-[11px] transition-colors",
                assetId
                  ? "border-accent/40 bg-accent/10 hover:bg-accent/20"
                  : "border-white/10 bg-surface text-gray-600 hover:border-white/25 hover:text-gray-400",
              ].join(" ")}
              title={labels[i]}
            >
              {assetId ? (
                <img
                  src={`/api/assets/${assetId}/file`}
                  alt={labels[i]}
                  className="h-full w-full rounded object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <span className="text-lg leading-none">+</span>
              )}
            </button>
            <div className="flex items-center justify-between px-0.5">
              <span className="truncate text-[9px] text-gray-600">{labels[i]}</span>
              {assetId && (
                <button
                  type="button"
                  onClick={() => onClear(i)}
                  className="text-[9px] text-red-500 hover:text-red-400 leading-none"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Image Mode Badge ─────────────────────────────────────────────────────────

function ImageModeBadge({ mode }: { mode: FloorplanImageMode }) {
  if (mode === "single") return null;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
      mode === "day_night_cycle"
        ? "bg-amber-900/30 text-amber-400"
        : "bg-white/5 text-gray-600"
    }`}>
      {mode === "day_night_cycle" ? "cycle" : "no image"}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function Modal({ title, children, onClose, wide }: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 overflow-y-auto py-8"
      onClick={onClose}
    >
      <div
        className={`w-full rounded-2xl bg-surface-raised p-6 shadow-2xl ${wide ? "max-w-2xl" : "max-w-sm"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-white">{title}</h2>
        {children}
      </div>
    </div>
  );
}
