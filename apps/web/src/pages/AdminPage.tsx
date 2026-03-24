import React, { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStateStream } from "../hooks/use-state-stream.ts";
import { useAuthStore } from "../store/auth.ts";
import { useEditorStore, applyDraft } from "../store/editor.ts";
import { useBatteryPlacementStore } from "../store/battery-placement.ts";
import { useToastStore } from "../store/toast.ts";
import { api } from "../api/client.ts";
import { EditorHotspotLayer } from "../hotspots/EditorHotspotLayer.tsx";
import { BatteryEditorLayer } from "../hotspots/BatteryEditorLayer.tsx";
import { HotspotLayer } from "../hotspots/HotspotLayer.tsx";
import { HeatmapLayer } from "../hotspots/HeatmapLayer.tsx";
import { BatteryOverlayLayer } from "../hotspots/BatteryOverlayLayer.tsx";
import { useImageFitBounds } from "../hotspots/useImageFitBounds.ts";
import { ConfigPanel } from "../components/editor/ConfigPanel.tsx";
import { HotspotListPanel } from "../components/editor/HotspotListPanel.tsx";
import { TypePickerModal } from "../components/editor/TypePickerModal.tsx";
// Ensure built-in hotspot types are registered; also imports getAllHotspotTypes
import { getAllHotspotTypes } from "../hotspots/registry.ts";
import { useSolarImage } from "../hooks/use-solar-image.ts";
import type { FloorplanWithHotspotsRaw, HotspotRaw, StateRuleRaw } from "../hotspots/types.ts";
import type { HotspotType, CycleImages, BatteryConfig } from "@floorplan-ha/shared";

/**
 * Admin / editor page.
 *
 * Responsibilities:
 * - Load the default floorplan and its hotspots
 * - Allow toggling between edit mode and preview mode
 * - Support adding, selecting, configuring, duplicating, and deleting hotspots
 * - Track unsaved changes via the editor draft store
 * - Save all dirty changes to the backend on demand
 * - Revert discards all drafts and refetches server state
 */
export default function AdminPage() {
  useStateStream();

  const [searchParams] = useSearchParams();
  const floorplanId = searchParams.get("floorplanId");

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  // Pre-warm the HA entity list so EntityPickers open instantly
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ["ha-entities"],
      queryFn: () => api.ha.entities(),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);

  const {
    selectedId, selectHotspot,
    drafts, discardDraft, discardAllDrafts,
    hasDirtyChanges, getDraft,
    isPreviewMode, setPreviewMode,
    undo, redo, canUndo, canRedo,
  } = useEditorStore();

  // Local hotspot list — kept in sync with the server; optimistically updated on add/delete
  const [localHotspots, setLocalHotspots] = useState<HotspotRaw[] | null>(null);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Ref to the floorplan canvas — passed to EditorHotspotLayer for coordinate math
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const { data: floorplan, isLoading, error } = useQuery({
    queryKey: ["admin-floorplan", floorplanId],
    queryFn: () =>
      floorplanId
        ? (api.floorplans.get(floorplanId) as Promise<FloorplanWithHotspotsRaw>)
        : fetchDefaultFloorplan(),
    staleTime: 30 * 1000,
  });

  // Sync local hotspot list from server whenever floorplan data arrives
  const serverHotspots = floorplan?.hotspots ?? [];
  const hotspots = localHotspots ?? serverHotspots;

  // Effective hotspots = server data merged with any in-progress drafts
  const effectiveHotspots = hotspots.map((h) => applyDraft(h, getDraft(h.id)));

  // ── Navigation guard (browser close / refresh) ─────────────────────────────

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasDirtyChanges()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasDirtyChanges]);

  // ── Edit mode toggle ────────────────────────────────────────────────────────

  const handleEditModeToggle = () => {
    if (isEditMode) {
      // Exiting edit mode — confirm if there are unsaved changes
      if (hasDirtyChanges()) {
        const confirmed = window.confirm("You have unsaved changes. Discard them and exit edit mode?");
        if (!confirmed) return;
        discardAllDrafts();
        setLocalHotspots(null); // re-sync from server
      }
      selectHotspot(null);
      setPreviewMode(false);
    }
    setIsEditMode((v) => !v);
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!hasDirtyChanges()) return;
    setIsSaving(true);
    try {
      // Only save drafts for hotspots that are actually loaded — orphaned draft IDs
      // (e.g. from a DB restore) would 404 and abort the whole save.
      const loadedIds = new Set(hotspots.map((h) => h.id));
      const allDraftIds = Object.keys(drafts);
      const orphanedIds = allDraftIds.filter((id) => !loadedIds.has(id));
      orphanedIds.forEach((id) => discardDraft(id));
      const ids = allDraftIds.filter((id) => loadedIds.has(id));
      await Promise.all(
        ids.map(async (id) => {
          const draft = drafts[id] ?? {};
          const { _pendingRules, configJson, x, y, width, height, rotation, zIndex, name, entityId } = draft;

          // Convert flat draft fields → nested API shape expected by PATCH /api/hotspots/:id
          const positionFields = { x, y, width, height, rotation, zIndex };
          const hasPosition = Object.values(positionFields).some((v) => v !== undefined);
          const patch: Record<string, unknown> = {};
          if (name !== undefined) patch.name = name;
          if (entityId !== undefined) patch.entityId = entityId;
          if (hasPosition) {
            patch.position = Object.fromEntries(
              Object.entries(positionFields).filter(([, v]) => v !== undefined),
            );
          }
          if (configJson !== undefined) patch.config = configJson;

          if (Object.keys(patch).length > 0) {
            await api.hotspots.update(id, patch);
          }

          if (_pendingRules) {
            await api.hotspots.setRules(
              id,
              _pendingRules.map((r: StateRuleRaw, i: number) => ({
                conditionType: r.conditionType,
                conditionJson: r.conditionJson,
                resultJson: r.resultJson,
                priority: i + 1,
              })),
            );
          }
        }),
      );

      discardAllDrafts();
      // Invalidate and refetch to get fresh server state
      await queryClient.invalidateQueries({ queryKey: ["admin-floorplan"] });
      setLocalHotspots(null);
      addToast("Saved successfully", "success");
    } catch (err) {
      addToast(`Save failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setIsSaving(false);
    }
  }, [drafts, hotspots, hasDirtyChanges, discardDraft, discardAllDrafts, queryClient, addToast]);

  // ── Export ────────────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!floorplan) return;
    try {
      const blob = await api.floorplans.export(floorplan.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `floorplan-${floorplan.name.replace(/\s+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast(`Export failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  }, [floorplan, addToast]);

  // ── Import ────────────────────────────────────────────────────────────────────

  const handleImport = useCallback(() => {
    if (!floorplan) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const bundle = JSON.parse(text) as unknown;
        const dashboard = await api.dashboards.getDefault() as { id: string };
        await api.floorplans.import(dashboard.id, bundle);
        await queryClient.invalidateQueries({ queryKey: ["admin-floorplan"] });
        setLocalHotspots(null);
        addToast("Floorplan imported successfully", "success");
      } catch (err) {
        addToast(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
      }
    };
    input.click();
  }, [floorplan, addToast, queryClient]);

  // ── Revert ───────────────────────────────────────────────────────────────────

  const handleRevert = () => {
    if (!hasDirtyChanges()) return;
    discardAllDrafts();
    setLocalHotspots(null);
    selectHotspot(null);
    addToast("Changes reverted", "info");
  };

  // ── Add hotspot ───────────────────────────────────────────────────────────────

  const handleAddHotspot = async (type: HotspotType) => {
    if (!floorplan) return;
    setShowTypePicker(false);

    const def = getAllHotspotTypes().find((d) => d.type === type);
    const defaultConfig = def?.defaultConfig ?? {};

    try {
      const created = await api.hotspots.create({
        floorplanId: floorplan.id,
        name: `New ${type} hotspot`,
        type,
        position: { x: 0.4, y: 0.4, width: 0.1, height: 0.08, rotation: 0, zIndex: 10 },
        entityId: null,
        config: defaultConfig,
      }) as HotspotRaw;

      const newHotspot: HotspotRaw = { ...created, stateRules: [] };
      setLocalHotspots([...hotspots, newHotspot]);
      selectHotspot(newHotspot.id);
      addToast(`Added ${type} hotspot`, "success");
    } catch (err) {
      addToast(`Failed to add hotspot: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  // ── Duplicate hotspot ─────────────────────────────────────────────────────────

  const handleDuplicate = async () => {
    if (!selectedId) return;
    try {
      const duped = await api.hotspots.duplicate(selectedId) as HotspotRaw;
      const newHotspot: HotspotRaw = { ...duped, stateRules: duped.stateRules ?? [] };
      setLocalHotspots([...hotspots, newHotspot]);
      selectHotspot(newHotspot.id);
      addToast("Hotspot duplicated", "success");
    } catch (err) {
      addToast(`Duplicate failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  // ── Delete hotspot ────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!selectedId) return;
    const confirmed = window.confirm("Delete this hotspot? This cannot be undone.");
    if (!confirmed) return;
    try {
      await api.hotspots.delete(selectedId);
      setLocalHotspots(hotspots.filter((h) => h.id !== selectedId));
      selectHotspot(null);
      addToast("Hotspot deleted", "success");
    } catch (err) {
      addToast(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    }
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isEditMode) return;
      // Ignore keypresses when an input/textarea is focused
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Undo: Cmd+Z / Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canUndo()) undo();
        return;
      }
      // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canRedo()) redo();
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        const confirmed = window.confirm("Delete this hotspot? This cannot be undone.");
        if (!confirmed) return;
        const idToDelete = selectedId;
        api.hotspots.delete(idToDelete).then(() => {
          setLocalHotspots((prev) => (prev ?? []).filter((h) => h.id !== idToDelete));
          selectHotspot(null);
          addToast("Hotspot deleted", "success");
        }).catch((err: unknown) => {
          addToast(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
        });
      }
      if (e.key === "Escape") {
        selectHotspot(null);
      }
    },
    [isEditMode, selectedId, selectHotspot, addToast, canUndo, undo, canRedo, redo],
  );

  // ── Selected hotspot ──────────────────────────────────────────────────────────

  const selectedHotspot = selectedId
    ? effectiveHotspots.find((h) => h.id === selectedId) ?? null
    : null;

  // Highlighted hotspot (pulsing outline from the list panel — separate from selection)
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Clear highlight whenever the user selects a hotspot from the canvas
  useEffect(() => {
    if (selectedId) setHighlightedId(null);
  }, [selectedId]);

  const isDirty = hasDirtyChanges();

  // ── Render ────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error || !floorplan) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-surface text-gray-400">
        <p>No floorplan found. Create one in settings first.</p>
        <Link to="/" className="text-sm text-accent hover:underline">← Dashboard</Link>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-screen flex-col bg-surface text-white"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* ── Toolbar ── */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-3">
        <span className="text-sm font-semibold text-gray-300">HomePlan HA</span>
        <span className="text-gray-700">/</span>
        <span className="text-sm text-gray-400 truncate max-w-[160px]">{floorplan.name}</span>

        {/* Edit mode toggle — only for admins */}
        {user?.role === "admin" && (
          <button
            type="button"
            onClick={handleEditModeToggle}
            className={[
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              isEditMode
                ? "bg-yellow-600/60 text-yellow-200 hover:bg-yellow-600/80"
                : "bg-white/10 text-gray-300 hover:bg-white/20",
            ].join(" ")}
          >
            {isEditMode ? "✏️ Editing" : "Edit Mode"}
          </button>
        )}

        {/* Edit mode controls */}
        {isEditMode && (
          <>
            <button
              type="button"
              onClick={() => setShowTypePicker(true)}
              className="rounded-md bg-accent/20 px-2.5 py-1 text-xs text-accent hover:bg-accent/30"
            >
              + Add Hotspot
            </button>

            {/* Undo / Redo */}
            <button
              type="button"
              onClick={() => canUndo() && undo()}
              disabled={!canUndo()}
              title="Undo (Cmd+Z)"
              className="rounded-md bg-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/20 disabled:opacity-30"
            >
              ↩ Undo
            </button>
            <button
              type="button"
              onClick={() => canRedo() && redo()}
              disabled={!canRedo()}
              title="Redo (Cmd+Shift+Z)"
              className="rounded-md bg-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/20 disabled:opacity-30"
            >
              ↪ Redo
            </button>

            {selectedId && (
              <>
                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="rounded-md bg-white/10 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/20"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-md bg-red-900/40 px-2.5 py-1 text-xs text-red-300 hover:bg-red-900/60"
                >
                  Delete
                </button>
              </>
            )}

            {/* Preview toggle */}
            <button
              type="button"
              onClick={() => setPreviewMode(!isPreviewMode)}
              className={[
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                isPreviewMode
                  ? "bg-green-800/40 text-green-300 hover:bg-green-800/60"
                  : "bg-white/10 text-gray-300 hover:bg-white/20",
              ].join(" ")}
            >
              {isPreviewMode ? "▶ Preview" : "Preview"}
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Unsaved indicator */}
          {isDirty && (
            <span className="text-[11px] text-yellow-400">● Unsaved changes</span>
          )}

          {isEditMode && (
            <>
              <button
                type="button"
                onClick={handleRevert}
                disabled={!isDirty}
                className="rounded-md px-2.5 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30"
              >
                Revert
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-40"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </>
          )}

          {/* Export / Import */}
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300"
            title="Export floorplan as JSON"
          >
            Export
          </button>
          <button
            type="button"
            onClick={handleImport}
            className="rounded-md bg-white/5 px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300"
            title="Import floorplan from JSON"
          >
            Import
          </button>

          <Link
            to="/admin/dashboards"
            className="rounded-md px-2.5 py-1 text-xs text-gray-400 hover:text-white"
          >
            Dashboards
          </Link>
          <Link
            to="/"
            className="rounded-md px-2.5 py-1 text-xs text-gray-400 hover:text-white"
          >
            ← Dashboard
          </Link>

          {/* User menu */}
          {user && (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-gray-300 hover:bg-white/10"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold uppercase text-white">
                  {user.email[0]}
                </span>
                {user.email}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-md border border-white/10 bg-surface-raised shadow-lg">
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); navigate("/admin/settings"); }}
                    className="flex w-full items-center px-3 py-2 text-xs text-gray-300 hover:bg-white/10"
                  >
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="flex w-full items-center px-3 py-2 text-xs text-red-400 hover:bg-white/10"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Main area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <main
          className="relative flex flex-1 items-center justify-center overflow-hidden"
          style={{ backgroundColor: floorplan.backgroundColor }}
        >
          <FloorplanCanvas
            floorplan={{ ...floorplan, hotspots: effectiveHotspots }}
            canvasRef={canvasRef}
            isEditMode={isEditMode}
            isPreviewMode={isPreviewMode}
            highlightedId={highlightedId}
          />
        </main>

        {/* Config panel sidebar — visible in edit mode with a hotspot selected */}
        {isEditMode && (
          <aside className="flex w-72 shrink-0 flex-col border-l border-white/10 bg-surface-raised">
            {selectedHotspot ? (
              <ConfigPanel hotspot={selectedHotspot} />
            ) : (
              <HotspotListPanel
                hotspots={effectiveHotspots}
                highlightedId={highlightedId}
                onHighlight={setHighlightedId}
                onEdit={(id) => selectHotspot(id)}
              />
            )}
          </aside>
        )}
      </div>

      {/* Type picker modal */}
      {showTypePicker && (
        <TypePickerModal
          onSelect={handleAddHotspot}
          onClose={() => setShowTypePicker(false)}
        />
      )}
    </div>
  );
}

// ─── Floorplan canvas ──────────────────────────────────────────────────────────

function FloorplanCanvas({
  floorplan,
  canvasRef,
  isEditMode,
  isPreviewMode,
  highlightedId,
}: {
  floorplan: FloorplanWithHotspotsRaw;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  isEditMode: boolean;
  isPreviewMode: boolean;
  highlightedId?: string | null;
}) {
  const cycleImages = (
    floorplan.imageMode === "day_night_cycle" &&
    floorplan.cycleImagesJson &&
    "day" in floorplan.cycleImagesJson
      ? floorplan.cycleImagesJson as CycleImages
      : null
  );
  const cycleAssetId = useSolarImage(cycleImages);

  const imageUrl =
    floorplan.imageMode === "single" && floorplan.imageAssetId
      ? api.assets.fileUrl(floorplan.imageAssetId)
      : floorplan.imageMode === "day_night_cycle" && cycleAssetId
        ? api.assets.fileUrl(cycleAssetId)
        : null;

  const hasValidDimensions = floorplan.width > 0 && floorplan.height > 0;
  const aspectRatio = hasValidDimensions
    ? `${floorplan.width} / ${floorplan.height}`
    : "16 / 9";

  const imageRef = useRef<HTMLImageElement>(null);
  const imageBounds = useImageFitBounds(canvasRef, imageRef, floorplan.imageStretch ?? false);

  const { placement, cancel } = useBatteryPlacementStore();
  const { getDraft, updateDraft } = useEditorStore();
  const isPlacing = isEditMode && placement !== null;

  // Cancel placement on Escape
  useEffect(() => {
    if (!isPlacing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPlacing, cancel]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!placement || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;
      const x = Math.max(0, Math.min(1, (relX - imageBounds.x) / imageBounds.width));
      const y = Math.max(0, Math.min(1, (relY - imageBounds.y) / imageBounds.height));

      // Find the target hotspot and update its config
      const hotspot = floorplan.hotspots.find((h) => h.id === placement.hotspotId);
      if (!hotspot) { cancel(); return; }
      const draft = getDraft(placement.hotspotId);
      const baseConfig = (draft.configJson ?? hotspot.configJson) as unknown as BatteryConfig;
      const items = baseConfig.items ?? [];

      let updatedItems;
      if (placement.repositioningItemId) {
        updatedItems = items.map((it) =>
          it.id === placement.repositioningItemId ? { ...it, x, y } : it,
        );
      } else if (placement.pendingItem) {
        updatedItems = [...items, { ...placement.pendingItem, x, y }];
      } else {
        cancel();
        return;
      }

      updateDraft(placement.hotspotId, { configJson: { ...baseConfig, items: updatedItems } });
      cancel();
    },
    [placement, canvasRef, imageBounds, floorplan.hotspots, getDraft, updateDraft, cancel],
  );

  return (
    <div
      ref={canvasRef as React.RefObject<HTMLDivElement>}
      className="relative overflow-hidden"
      onClick={isPlacing ? handleCanvasClick : undefined}
      style={{
        aspectRatio,
        width: "100%",
        maxWidth: "100%",
        cursor: isPlacing ? "crosshair" : undefined,
        maxHeight: "100%",
        // Subtle grid in edit mode so the canvas is clearly identifiable
        backgroundImage: isEditMode && !isPreviewMode
          ? "radial-gradient(circle, #3b82f620 1px, transparent 1px)"
          : "none",
        backgroundSize: "24px 24px",
      }}
    >
      {/* Placement mode banner */}
      {isPlacing && (
        <div
          className="absolute inset-x-0 top-2 z-50 flex justify-center px-4"
          style={{ pointerEvents: "none" }}
        >
          <div
            className="flex items-center gap-3 rounded-lg bg-amber-500/90 px-4 py-2 text-[12px] font-medium text-black shadow-lg"
            style={{ pointerEvents: "auto" }}
          >
            <span>Click to place battery indicator · Esc to cancel</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); cancel(); }}
              className="rounded px-1.5 py-0.5 hover:bg-black/10"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {imageUrl ? (
        <img
          ref={imageRef}
          src={imageUrl}
          alt={floorplan.name}
          className={`absolute inset-0 h-full w-full select-none ${floorplan.imageStretch ? "object-fill" : "object-contain"}`}
          draggable={false}
          decoding="async"
          loading="eager"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-gray-600">
          <p className="text-sm">No floorplan image — upload one in settings</p>
        </div>
      )}

      {/* Heatmap overlay — only in preview mode, not edit mode */}
      {!isEditMode && (
        <HeatmapLayer
          hotspots={floorplan.hotspots}
          maskAssetId={floorplan.heatmapMaskAssetId ?? null}
          imageBounds={imageBounds}
        />
      )}

      {/* Battery overlay — only in preview mode, not edit mode */}
      {!isEditMode && (
        <BatteryOverlayLayer hotspots={floorplan.hotspots} imageBounds={imageBounds} />
      )}

      {/* Hotspot overlay */}
      {isEditMode ? (
        <>
          <EditorHotspotLayer
            hotspots={floorplan.hotspots}
            containerRef={canvasRef}
            highlightedId={highlightedId ?? null}
            imageBounds={imageBounds}
          />
          <BatteryEditorLayer
            hotspots={floorplan.hotspots}
            containerRef={canvasRef}
            imageBounds={imageBounds}
          />
        </>
      ) : (
        <HotspotLayer hotspots={floorplan.hotspots} imageBounds={imageBounds} />
      )}
    </div>
  );
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function fetchDefaultFloorplan(): Promise<FloorplanWithHotspotsRaw | null> {
  const dashboard = await api.dashboards.getDefault() as { id: string };
  const floorplans = await api.floorplans.list(dashboard.id) as { id: string }[];
  const first = floorplans[0];
  if (!first) return null;
  return api.floorplans.get(first.id) as Promise<FloorplanWithHotspotsRaw>;
}
