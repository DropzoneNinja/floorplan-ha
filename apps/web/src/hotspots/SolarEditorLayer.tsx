import { useRef, useCallback, useState, type RefObject } from "react";
import type { SolarConfig, SolarPanel } from "@floorplan-ha/shared";
import type { HotspotRaw } from "./types.ts";
import { type ImageFitBounds, FULL_BOUNDS } from "./useImageFitBounds.ts";
import { useEditorStore, type HotspotDraft } from "../store/editor.ts";
import { useSolarPlacementStore } from "../store/solar-placement.ts";
import { snapPanelPosition } from "./solar-snap.ts";
import { ICON_PATHS } from "./icons.ts";

interface SolarEditorLayerProps {
  hotspots: HotspotRaw[];
  containerRef: RefObject<HTMLDivElement | null>;
  imageBounds?: ImageFitBounds;
}

const MIN_PANEL_SIZE = 0.02;

/**
 * Edit-mode overlay for the Solar hotspot. Shows draggable handles for every
 * placed panel (with edge-snapping and a shared resize handle), plus the
 * junction box, house box, and grid box — each a single draggable point.
 * Only visible while a solar hotspot is selected.
 */
export function SolarEditorLayer({ hotspots, containerRef, imageBounds = FULL_BOUNDS }: SolarEditorLayerProps) {
  const { selectedId, getDraft, updateDraftSilent, pushUndo } = useEditorStore();
  const isPlacing = useSolarPlacementStore((s) => s.placement !== null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const hotspot = selectedId ? hotspots.find((h) => h.id === selectedId) : null;
  if (!hotspot || hotspot.type !== "solar") return null;

  const draft = getDraft(hotspot.id);
  const config = (draft.configJson ?? hotspot.configJson) as unknown as SolarConfig;
  const panels = config.panels ?? [];
  const panelWidth = config.panelWidth ?? 0.05;
  const panelHeight = config.panelHeight ?? 0.08;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: hotspot.zIndex }}>
      <div
        style={{
          position: "absolute",
          left: `${imageBounds.x * 100}%`,
          top: `${imageBounds.y * 100}%`,
          width: `${imageBounds.width * 100}%`,
          height: `${imageBounds.height * 100}%`,
        }}
      >
        {panels.map((panel) => (
          <PanelHandle
            key={panel.id}
            panel={panel}
            panelWidth={panelWidth}
            panelHeight={panelHeight}
            allPanels={panels}
            hotspotId={hotspot.id}
            isSelected={selectedItemId === panel.id}
            isPlacing={isPlacing}
            containerRef={containerRef}
            imageBounds={imageBounds}
            onSelect={() => setSelectedItemId((prev) => (prev === panel.id ? null : panel.id))}
            getDraft={getDraft}
            updateDraftSilent={updateDraftSilent}
            pushUndo={pushUndo}
          />
        ))}

        {config.junctionBox && (
          <BoxHandle
            kind="junctionBox"
            label="Junction"
            point={config.junctionBox}
            color="#fbbf24"
            hotspotId={hotspot.id}
            isPlacing={isPlacing}
            containerRef={containerRef}
            imageBounds={imageBounds}
            getDraft={getDraft}
            updateDraftSilent={updateDraftSilent}
            pushUndo={pushUndo}
          />
        )}
        {config.houseBox && (
          <BoxHandle
            kind="houseBox"
            label="House"
            point={config.houseBox}
            color="#4ade80"
            hotspotId={hotspot.id}
            isPlacing={isPlacing}
            containerRef={containerRef}
            imageBounds={imageBounds}
            getDraft={getDraft}
            updateDraftSilent={updateDraftSilent}
            pushUndo={pushUndo}
          />
        )}
        {config.gridBox && (
          <BoxHandle
            kind="gridBox"
            label="Grid"
            point={config.gridBox}
            color="#3b82f6"
            hotspotId={hotspot.id}
            isPlacing={isPlacing}
            containerRef={containerRef}
            imageBounds={imageBounds}
            getDraft={getDraft}
            updateDraftSilent={updateDraftSilent}
            pushUndo={pushUndo}
          />
        )}
      </div>
    </div>
  );
}

// ─── Panel handle (drag + snap + uniform resize) ───────────────────────────────

interface PanelHandleProps {
  panel: SolarPanel;
  panelWidth: number;
  panelHeight: number;
  allPanels: SolarPanel[];
  hotspotId: string;
  isSelected: boolean;
  isPlacing: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  imageBounds: ImageFitBounds;
  onSelect: () => void;
  getDraft: (id: string) => HotspotDraft;
  updateDraftSilent: (id: string, changes: HotspotDraft) => void;
  pushUndo: () => void;
}

function PanelHandle({
  panel,
  panelWidth,
  panelHeight,
  allPanels,
  hotspotId,
  isSelected,
  isPlacing,
  containerRef,
  imageBounds,
  onSelect,
  getDraft,
  updateDraftSilent,
  pushUndo,
}: PanelHandleProps) {
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeState = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const didDrag = useRef(false);

  const toNorm = useCallback(
    (pxDelta: number, axis: "x" | "y"): number => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const containerSize = axis === "x" ? rect.width : rect.height;
      const imageFraction = axis === "x" ? imageBounds.width : imageBounds.height;
      return pxDelta / (containerSize * imageFraction);
    },
    [containerRef, imageBounds],
  );

  const liveConfig = () => (getDraft(hotspotId).configJson as unknown as SolarConfig | undefined);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isPlacing) return;
      e.stopPropagation();
      pushUndo();
      didDrag.current = false;
      const config = liveConfig();
      const liveItem = config?.panels?.find((p) => p.id === panel.id);
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: liveItem?.x ?? panel.x,
        origY: liveItem?.y ?? panel.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPlacing, pushUndo, hotspotId, panel.id, panel.x, panel.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState.current) return;
      const dx = toNorm(e.clientX - dragState.current.startX, "x");
      const dy = toNorm(e.clientY - dragState.current.startY, "y");
      if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) didDrag.current = true;

      const config = liveConfig();
      const w = config?.panelWidth ?? panelWidth;
      const h = config?.panelHeight ?? panelHeight;
      const rawX = Math.max(0, Math.min(1 - w, dragState.current.origX + dx));
      const rawY = Math.max(0, Math.min(1 - h, dragState.current.origY + dy));

      const others = (config?.panels ?? allPanels).map((p) => ({ id: p.id, x: p.x, y: p.y }));
      const { x, y } = snapPanelPosition({ x: rawX, y: rawY }, panel.id, others, w, h);

      const panels = (config?.panels ?? allPanels).map((p) => (p.id === panel.id ? { ...p, x, y } : p));
      updateDraftSilent(hotspotId, { configJson: { ...(config ?? { panels: allPanels, panelWidth, panelHeight, junctionBox: null, houseBox: null, gridBox: null }), panels } });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toNorm, hotspotId, panel.id, panelWidth, panelHeight, allPanels, updateDraftSilent],
  );

  const handlePointerUp = useCallback(() => {
    if (!didDrag.current) onSelect();
    dragState.current = null;
    didDrag.current = false;
  }, [onSelect]);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      pushUndo();
      const config = liveConfig();
      resizeState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: config?.panelWidth ?? panelWidth,
        origH: config?.panelHeight ?? panelHeight,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pushUndo, panelWidth, panelHeight],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!resizeState.current) return;
      const dw = toNorm(e.clientX - resizeState.current.startX, "x");
      const dh = toNorm(e.clientY - resizeState.current.startY, "y");
      const newW = Math.max(MIN_PANEL_SIZE, Math.min(0.5, resizeState.current.origW + dw));
      const newH = Math.max(MIN_PANEL_SIZE, Math.min(0.5, resizeState.current.origH + dh));

      const config = liveConfig();
      updateDraftSilent(hotspotId, {
        configJson: { ...(config ?? { panels: allPanels, panelWidth, panelHeight, junctionBox: null, houseBox: null, gridBox: null }), panelWidth: newW, panelHeight: newH },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toNorm, hotspotId, allPanels, panelWidth, panelHeight, updateDraftSilent],
  );

  const handleResizePointerUp = useCallback(() => {
    resizeState.current = null;
  }, []);

  const config = liveConfig();
  const liveItem = config?.panels?.find((p) => p.id === panel.id) ?? panel;
  const w = config?.panelWidth ?? panelWidth;
  const h = config?.panelHeight ?? panelHeight;

  return (
    <div
      style={{
        position: "absolute",
        left: `${liveItem.x * 100}%`,
        top: `${liveItem.y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        pointerEvents: isPlacing ? "none" : "auto",
        cursor: "grab",
        outline: isSelected ? "2px solid #3b82f6" : "1px dashed rgba(255,255,255,0.4)",
        outlineOffset: 2,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { dragState.current = null; }}
    >
      <span
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[9px] text-gray-200"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
      >
        {liveItem.name}
      </span>

      {/* Uniform resize handle — resizing any panel resizes them all */}
      <div
        title="Resize all panels"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={() => { resizeState.current = null; }}
        style={{
          position: "absolute",
          right: -5,
          bottom: -5,
          width: 10,
          height: 10,
          borderRadius: 2,
          background: "#3b82f6",
          border: "1px solid white",
          cursor: "nwse-resize",
          pointerEvents: isPlacing ? "none" : "auto",
        }}
      />
    </div>
  );
}

// ─── Single box handle (junction / house / grid) ───────────────────────────────

interface BoxHandleProps {
  kind: "junctionBox" | "houseBox" | "gridBox";
  label: string;
  point: { x: number; y: number };
  color: string;
  hotspotId: string;
  isPlacing: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  imageBounds: ImageFitBounds;
  getDraft: (id: string) => HotspotDraft;
  updateDraftSilent: (id: string, changes: HotspotDraft) => void;
  pushUndo: () => void;
}

function BoxHandle({
  kind,
  label,
  point,
  color,
  hotspotId,
  isPlacing,
  containerRef,
  imageBounds,
  getDraft,
  updateDraftSilent,
  pushUndo,
}: BoxHandleProps) {
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const toNorm = useCallback(
    (pxDelta: number, axis: "x" | "y"): number => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      const containerSize = axis === "x" ? rect.width : rect.height;
      const imageFraction = axis === "x" ? imageBounds.width : imageBounds.height;
      return pxDelta / (containerSize * imageFraction);
    },
    [containerRef, imageBounds],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isPlacing) return;
      e.stopPropagation();
      pushUndo();
      const config = getDraft(hotspotId).configJson as unknown as SolarConfig | undefined;
      const liveBox = config?.[kind] ?? point;
      dragState.current = { startX: e.clientX, startY: e.clientY, origX: liveBox.x, origY: liveBox.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPlacing, pushUndo, hotspotId, kind, point.x, point.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState.current) return;
      const dx = toNorm(e.clientX - dragState.current.startX, "x");
      const dy = toNorm(e.clientY - dragState.current.startY, "y");
      const x = Math.max(0, Math.min(1, dragState.current.origX + dx));
      const y = Math.max(0, Math.min(1, dragState.current.origY + dy));

      const config = getDraft(hotspotId).configJson as unknown as SolarConfig | undefined;
      const base = config ?? { panels: [], panelWidth: 0.05, panelHeight: 0.08, junctionBox: null, houseBox: null, gridBox: null };
      const existing = base[kind];
      updateDraftSilent(hotspotId, {
        configJson: { ...base, [kind]: existing ? { ...existing, x, y } : { x, y } },
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toNorm, hotspotId, kind, updateDraftSilent],
  );

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  const config = getDraft(hotspotId).configJson as unknown as SolarConfig | undefined;
  const liveBox = config?.[kind] ?? point;

  return (
    <div
      style={{
        position: "absolute",
        left: `${liveBox.x * 100}%`,
        top: `${liveBox.y * 100}%`,
        transform: "translate(-50%, -50%)",
        pointerEvents: isPlacing ? "none" : "auto",
        cursor: "grab",
        zIndex: 2,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { dragState.current = null; }}
    >
      <div
        className="flex flex-col items-center"
        style={{ outline: `2px solid ${color}`, outlineOffset: 3, borderRadius: 4, padding: 2 }}
      >
        <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, color }} aria-hidden="true">
          <path d={ICON_PATHS["mdi:lightning-bolt"] ?? ICON_PATHS["default"]} fill="currentColor" />
        </svg>
        <span style={{ fontSize: 9, color: "#e5e7eb", textShadow: "0 1px 3px rgba(0,0,0,0.9)", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </div>
    </div>
  );
}
