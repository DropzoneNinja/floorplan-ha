import { useRef, useCallback, useState, type RefObject } from "react";
import { HotspotRenderer } from "./HotspotRenderer.tsx";
import { useEditorStore, applyDraft } from "../store/editor.ts";
import type { HotspotRaw } from "./types.ts";

/** Resize handle directions — 8-point compass */
type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface EditorHotspotLayerProps {
  /** The effective hotspots (server data already merged with drafts by the parent) */
  hotspots: HotspotRaw[];
  /** Ref to the floorplan container div — used to convert px deltas to normalized coords */
  containerRef: RefObject<HTMLDivElement | null>;
  /** ID of the hotspot to render with a pulsing highlight outline (from the list panel) */
  highlightedId?: string | null;
}

/**
 * Edit-mode overlay layer.
 *
 * Wraps each hotspot with selection, drag, and resize handles.
 * Changes are written into the editor draft store and persisted by the parent
 * when the user clicks Save.
 */
export function EditorHotspotLayer({ hotspots, containerRef, highlightedId }: EditorHotspotLayerProps) {
  const { selectedId, selectHotspot, isPreviewMode } = useEditorStore();

  const handleLayerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Deselect when clicking on the background (not a child element)
      if (e.target === e.currentTarget) selectHotspot(null);
    },
    [selectHotspot],
  );

  return (
    <div
      className="absolute inset-0"
      // Layer must receive pointer events so clicks on the background deselect
      style={{ pointerEvents: isPreviewMode ? "none" : "auto" }}
      onPointerDown={handleLayerPointerDown}
    >
      {hotspots.map((hotspot) => (
        <EditorHotspotWrapper
          key={hotspot.id}
          hotspot={hotspot}
          isSelected={hotspot.id === selectedId}
          isHighlighted={hotspot.id === highlightedId}
          containerRef={containerRef}
          isPreviewMode={isPreviewMode}
        />
      ))}
    </div>
  );
}

// ─── Individual hotspot wrapper ────────────────────────────────────────────────

interface WrapperProps {
  hotspot: HotspotRaw;
  isSelected: boolean;
  isHighlighted: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  isPreviewMode: boolean;
}

function EditorHotspotWrapper({ hotspot, isSelected, isHighlighted, containerRef, isPreviewMode }: WrapperProps) {
  const { selectHotspot, updateDraft, updateDraftSilent, pushUndo, getDraft } = useEditorStore();
  const [isHovered, setIsHovered] = useState(false);

  // Drag state tracked in refs to avoid re-render during drag
  const dragState = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Resize state
  const resizeState = useRef<{
    dir: ResizeDir;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Convert a pixel rect offset to a normalized 0–1 value */
  const toNorm = useCallback(
    (pxDelta: number, axis: "x" | "y"): number => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      return pxDelta / (axis === "x" ? rect.width : rect.height);
    },
    [containerRef],
  );

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  // ── Drag ───────────────────────────────────────────────────────────────────

  const handleBodyPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (isPreviewMode) return;
      e.stopPropagation();
      selectHotspot(hotspot.id);
      pushUndo();

      const draft = getDraft(hotspot.id);
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: draft.x ?? hotspot.x,
        origY: draft.y ?? hotspot.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isPreviewMode, hotspot.id, hotspot.x, hotspot.y, selectHotspot, pushUndo, getDraft],
  );

  const handleBodyPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current) return;
      const dx = toNorm(e.clientX - dragState.current.startX, "x");
      const dy = toNorm(e.clientY - dragState.current.startY, "y");

      const draft = getDraft(hotspot.id);
      const w = draft.width ?? hotspot.width;
      const h = draft.height ?? hotspot.height;

      updateDraftSilent(hotspot.id, {
        x: clamp(dragState.current.origX + dx, 0, 1 - w),
        y: clamp(dragState.current.origY + dy, 0, 1 - h),
      });
    },
    [toNorm, hotspot.id, hotspot.width, hotspot.height, getDraft, updateDraftSilent],
  );

  const handleBodyPointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  // ── Resize ─────────────────────────────────────────────────────────────────

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, dir: ResizeDir) => {
      e.stopPropagation();
      pushUndo();
      const draft = getDraft(hotspot.id);
      resizeState.current = {
        dir,
        startX: e.clientX,
        startY: e.clientY,
        origX: draft.x ?? hotspot.x,
        origY: draft.y ?? hotspot.y,
        origW: draft.width ?? hotspot.width,
        origH: draft.height ?? hotspot.height,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pushUndo, getDraft, hotspot.id, hotspot.x, hotspot.y, hotspot.width, hotspot.height],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeState.current) return;
      const rs = resizeState.current;
      const dx = toNorm(e.clientX - rs.startX, "x");
      const dy = toNorm(e.clientY - rs.startY, "y");

      const MIN = 0.02;
      let { origX: x, origY: y, origW: w, origH: h } = rs;

      switch (rs.dir) {
        case "e":  w = Math.max(MIN, w + dx); break;
        case "w":  w = Math.max(MIN, w - dx); x = clamp(x + dx, 0, x + w - MIN); break;
        case "s":  h = Math.max(MIN, h + dy); break;
        case "n":  h = Math.max(MIN, h - dy); y = clamp(y + dy, 0, y + h - MIN); break;
        case "se": w = Math.max(MIN, w + dx); h = Math.max(MIN, h + dy); break;
        case "sw": w = Math.max(MIN, w - dx); x = clamp(x + dx, 0, x + w - MIN); h = Math.max(MIN, h + dy); break;
        case "ne": w = Math.max(MIN, w + dx); h = Math.max(MIN, h - dy); y = clamp(y + dy, 0, y + h - MIN); break;
        case "nw": w = Math.max(MIN, w - dx); x = clamp(x + dx, 0, x + w - MIN); h = Math.max(MIN, h - dy); y = clamp(y + dy, 0, y + h - MIN); break;
      }

      // Clamp dimensions to the valid API range (schema requires 0–1)
      w = clamp(w, MIN, 1);
      h = clamp(h, MIN, 1);

      updateDraftSilent(hotspot.id, { x, y, width: w, height: h });
    },
    [toNorm, hotspot.id, updateDraftSilent],
  );

  const handleResizePointerUp = useCallback(() => {
    resizeState.current = null;
  }, []);

  // ── Z-index controls ───────────────────────────────────────────────────────

  const handleZUp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const draft = getDraft(hotspot.id);
      updateDraft(hotspot.id, { zIndex: (draft.zIndex ?? hotspot.zIndex) + 1 });
    },
    [getDraft, hotspot.id, hotspot.zIndex, updateDraft],
  );

  const handleZDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const draft = getDraft(hotspot.id);
      updateDraft(hotspot.id, { zIndex: Math.max(0, (draft.zIndex ?? hotspot.zIndex) - 1) });
    },
    [getDraft, hotspot.id, hotspot.zIndex, updateDraft],
  );

  // ── Current effective values ───────────────────────────────────────────────

  const draft = getDraft(hotspot.id);
  const eff = applyDraft(hotspot, draft);

  return (
    <div
      style={{
        position: "absolute",
        left: `${eff.x * 100}%`,
        top: `${eff.y * 100}%`,
        width: `${eff.width * 100}%`,
        height: `${eff.height * 100}%`,
        transform: eff.rotation !== 0 ? `rotate(${eff.rotation}deg)` : undefined,
        zIndex: eff.zIndex,
        pointerEvents: "auto",
        cursor: isPreviewMode ? "default" : "move",
        boxSizing: "border-box",
      }}
      onPointerDown={handleBodyPointerDown}
      onPointerMove={handleBodyPointerMove}
      onPointerUp={handleBodyPointerUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Edit-mode element boundary — uses border (not outline) so it isn't
          clipped by the canvas's overflow:hidden ancestor */}
      {!isPreviewMode && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            border: isSelected
              ? "2px solid #3b82f6"
              : isHovered
                ? "1.5px dashed rgba(148, 163, 184, 0.8)"
                : "1px dashed rgba(148, 163, 184, 0.45)",
            borderRadius: 2,
            zIndex: 50,
          }}
        />
      )}

      {/* Pulsing amber outline when highlighted from the hotspot list */}
      {isHighlighted && !isSelected && !isPreviewMode && (
        <div
          className="hotspot-highlight pointer-events-none absolute inset-0"
          style={{ borderRadius: 2, zIndex: 49 }}
        />
      )}

      {/* Hotspot content (pointer events blocked in edit mode so drag/resize work) */}
      <div className={isPreviewMode ? "" : "pointer-events-none"} style={{ height: "100%", width: "100%" }}>
        <HotspotRenderer hotspot={eff} isEditMode={!isPreviewMode} />
      </div>

      {/* Resize handles (only when selected and not in preview mode) */}
      {isSelected && !isPreviewMode && (
        <>
          {(
            [
              { dir: "nw", style: { top: -4, left: -4, cursor: "nw-resize" } },
              { dir: "n",  style: { top: -4, left: "calc(50% - 4px)", cursor: "n-resize" } },
              { dir: "ne", style: { top: -4, right: -4, cursor: "ne-resize" } },
              { dir: "e",  style: { top: "calc(50% - 4px)", right: -4, cursor: "e-resize" } },
              { dir: "se", style: { bottom: -4, right: -4, cursor: "se-resize" } },
              { dir: "s",  style: { bottom: -4, left: "calc(50% - 4px)", cursor: "s-resize" } },
              { dir: "sw", style: { bottom: -4, left: -4, cursor: "sw-resize" } },
              { dir: "w",  style: { top: "calc(50% - 4px)", left: -4, cursor: "w-resize" } },
            ] as { dir: ResizeDir; style: React.CSSProperties }[]
          ).map(({ dir, style }) => (
            <div
              key={dir}
              style={{
                position: "absolute",
                width: 8,
                height: 8,
                borderRadius: 2,
                background: "#fff",
                border: "1.5px solid #3b82f6",
                boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                zIndex: 51,
                pointerEvents: "auto",
                touchAction: "none",
                ...style,
              }}
              onPointerDown={(e) => handleResizePointerDown(e, dir)}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
            />
          ))}

          {/* Z-index controls */}
          <div
            className="absolute flex gap-px"
            style={{ top: -22, right: 0, zIndex: 52, pointerEvents: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              title="Bring forward"
              onClick={handleZUp}
              className="flex h-5 w-5 items-center justify-center rounded bg-surface-raised text-xs text-gray-300 hover:bg-surface-overlay hover:text-white"
            >
              ↑
            </button>
            <button
              type="button"
              title="Send backward"
              onClick={handleZDown}
              className="flex h-5 w-5 items-center justify-center rounded bg-surface-raised text-xs text-gray-300 hover:bg-surface-overlay hover:text-white"
            >
              ↓
            </button>
          </div>
        </>
      )}
    </div>
  );
}
