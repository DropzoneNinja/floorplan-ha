import { useRef, useCallback, useState, type RefObject } from "react";
import type { PowerpointConfig, PowerpointItem } from "@floorplan-ha/shared";
import type { HotspotRaw } from "./types.ts";
import { type ImageFitBounds, FULL_BOUNDS } from "./useImageFitBounds.ts";
import { useEditorStore, type HotspotDraft } from "../store/editor.ts";
import { usePowerpointPlacementStore } from "../store/powerpoint-placement.ts";
import { AustralianSocketIcon } from "./icons/AustralianSocket.tsx";

interface PowerpointEditorLayerProps {
  hotspots: HotspotRaw[];
  containerRef: RefObject<HTMLDivElement | null>;
  imageBounds?: ImageFitBounds;
}

/**
 * Edit-mode overlay that renders draggable powerpoint item pins when a
 * powerpoint hotspot is selected. Pins disappear when the powerpoint
 * hotspot is deselected.
 *
 * Drag updates the item's x/y in the hotspot's configJson draft.
 */
export function PowerpointEditorLayer({
  hotspots,
  containerRef,
  imageBounds = FULL_BOUNDS,
}: PowerpointEditorLayerProps) {
  const { selectedId, getDraft, updateDraftSilent, pushUndo } = useEditorStore();
  const isPlacing = usePowerpointPlacementStore((s) => s.placement !== null);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Find selected hotspot; bail if it's not a powerpoint type
  const hotspot = selectedId ? hotspots.find((h) => h.id === selectedId) : null;
  if (!hotspot || hotspot.type !== "powerpoint") return null;

  const draft = getDraft(hotspot.id);
  const config = (draft.configJson ?? hotspot.configJson) as unknown as PowerpointConfig;
  const items = config.items ?? [];

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
        {items.map((item) => (
          <PowerpointItemHandle
            key={item.id}
            item={item}
            hotspotId={hotspot.id}
            config={config}
            isSelected={selectedItemId === item.id}
            isPlacing={isPlacing}
            containerRef={containerRef}
            imageBounds={imageBounds}
            onSelect={() => setSelectedItemId((prev) => (prev === item.id ? null : item.id))}
            getDraft={getDraft}
            updateDraftSilent={updateDraftSilent}
            pushUndo={pushUndo}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Item handle ──────────────────────────────────────────────────────────────

interface PowerpointItemHandleProps {
  item: PowerpointItem;
  hotspotId: string;
  config: PowerpointConfig;
  isSelected: boolean;
  isPlacing: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  imageBounds: ImageFitBounds;
  onSelect: () => void;
  getDraft: (id: string) => HotspotDraft;
  updateDraftSilent: (id: string, changes: HotspotDraft) => void;
  pushUndo: () => void;
}

function PowerpointItemHandle({
  item,
  hotspotId,
  config,
  isSelected,
  isPlacing,
  containerRef,
  imageBounds,
  onSelect,
  getDraft,
  updateDraftSilent,
  pushUndo,
}: PowerpointItemHandleProps) {
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isPlacing) return;
      e.stopPropagation();
      pushUndo();
      didDrag.current = false;

      // Read current position from live draft
      const draft = getDraft(hotspotId);
      const liveConfig = (draft.configJson ?? config) as unknown as PowerpointConfig;
      const liveItem = liveConfig.items?.find((it) => it.id === item.id);

      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: liveItem?.x ?? item.x,
        origY: liveItem?.y ?? item.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isPlacing, pushUndo, getDraft, hotspotId, config, item],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState.current) return;
      const dx = toNorm(e.clientX - dragState.current.startX, "x");
      const dy = toNorm(e.clientY - dragState.current.startY, "y");
      if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) didDrag.current = true;

      const newX = Math.max(0, Math.min(1, dragState.current.origX + dx));
      const newY = Math.max(0, Math.min(1, dragState.current.origY + dy));

      const draft = getDraft(hotspotId);
      const liveConfig = (draft.configJson ?? config) as unknown as PowerpointConfig;
      const updatedItems = (liveConfig.items ?? []).map((it) =>
        it.id === item.id ? { ...it, x: newX, y: newY } : it,
      );
      updateDraftSilent(hotspotId, { configJson: { ...liveConfig, items: updatedItems } });
    },
    [toNorm, getDraft, hotspotId, config, item.id, updateDraftSilent],
  );

  const handlePointerUp = useCallback(() => {
    if (!didDrag.current) onSelect();
    dragState.current = null;
    didDrag.current = false;
  }, [onSelect]);

  // Read current position from draft for rendering
  const draft = getDraft(hotspotId);
  const liveConfig = (draft.configJson ?? config) as unknown as PowerpointConfig;
  const liveItem = liveConfig.items?.find((it) => it.id === item.id) ?? item;

  return (
    <div
      style={{
        position: "absolute",
        left: `${liveItem.x * 100}%`,
        top: `${liveItem.y * 100}%`,
        transform: "translate(-50%, -50%)",
        pointerEvents: isPlacing ? "none" : "auto",
        cursor: "grab",
        zIndex: 1,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => { dragState.current = null; }}
    >
      <div
        className="flex flex-col items-center"
        style={{
          outline: isSelected ? "2px solid #3b82f6" : undefined,
          outlineOffset: 3,
          borderRadius: 4,
        }}
      >
        <AustralianSocketIcon
          size={36}
          className={isSelected ? "drop-shadow-[0_0_4px_#3b82f6]" : undefined}
        />
        <span
          style={{
            fontSize: 9,
            color: "#e5e7eb",
            textShadow: "0 1px 3px rgba(0,0,0,0.9)",
            maxWidth: 64,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: 1.2,
          }}
        >
          {liveItem.name}
        </span>
      </div>
    </div>
  );
}
