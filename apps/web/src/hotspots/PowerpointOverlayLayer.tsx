import { useState } from "react";
import type { PowerpointConfig, PowerpointItem } from "@floorplan-ha/shared";
import type { HotspotRaw } from "./types.ts";
import { type ImageFitBounds, FULL_BOUNDS } from "./useImageFitBounds.ts";
import { usePowerpointStore } from "../store/powerpoint.ts";
import { useEntityStateStore } from "../store/entity-states.ts";
import { isOnState } from "./state-utils.ts";
import { AustralianSocketIcon } from "./icons/AustralianSocket.tsx";
import { PowerpointControlDialog } from "./PowerpointControlDialog.tsx";

interface PowerpointOverlayLayerProps {
  hotspots: HotspotRaw[];
  /** Bounds of the rendered image within the container (fractions 0–1). */
  imageBounds?: ImageFitBounds;
}

/**
 * Overlay that renders individual powerpoint location icons when a
 * powerpoint hotspot is expanded (clicked). Tapping a pin opens a dialog
 * with independent on/off controls for its two outlets.
 *
 * Each item is positioned using its normalized x/y coords from the config,
 * relative to the image bounds — the same coordinate space as HotspotLayer.
 * Clicking the backdrop (outside an item) dismisses the overlay and dialog.
 */
export function PowerpointOverlayLayer({ hotspots, imageBounds = FULL_BOUNDS }: PowerpointOverlayLayerProps) {
  const visibleHotspotId = usePowerpointStore((s) => s.visibleHotspotId);
  const triggeredByZIndex = usePowerpointStore((s) => s.triggeredByZIndex);
  const hide = usePowerpointStore((s) => s.hide);
  const getEntityState = useEntityStateStore((s) => s.getState);

  const [openItemId, setOpenItemId] = useState<string | null>(null);

  if (!visibleHotspotId) return null;

  const hotspot = hotspots.find((h) => h.id === visibleHotspotId && h.type === "powerpoint");
  if (!hotspot) return null;

  const config = hotspot.configJson as unknown as PowerpointConfig;
  const items = config.items ?? [];
  const openItem = items.find((it) => it.id === openItemId) ?? null;

  return (
    <>
      <div
        className="pointer-events-auto absolute inset-0"
        style={{ zIndex: triggeredByZIndex - 1 }}
        onClick={() => {
          hide();
          setOpenItemId(null);
        }}
        aria-label="Powerpoint overlay — click to dismiss"
      >
        {/* Image-relative positioning sub-div, same as HotspotLayer */}
        <div
          style={{
            position: "absolute",
            left: `${imageBounds.x * 100}%`,
            top: `${imageBounds.y * 100}%`,
            width: `${imageBounds.width * 100}%`,
            height: `${imageBounds.height * 100}%`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <PowerpointItemPin
              key={item.id}
              item={item}
              leftOn={
                !!item.outletA.entityId && isOnState(getEntityState(item.outletA.entityId)?.state ?? "")
              }
              rightOn={
                !!item.outletB.entityId && isOnState(getEntityState(item.outletB.entityId)?.state ?? "")
              }
              onOpen={() => setOpenItemId(item.id)}
            />
          ))}
        </div>
      </div>

      {openItem && <PowerpointControlDialog item={openItem} onClose={() => setOpenItemId(null)} />}
    </>
  );
}

interface PowerpointItemPinProps {
  item: PowerpointItem;
  leftOn: boolean;
  rightOn: boolean;
  onOpen: () => void;
}

function PowerpointItemPin({ item, leftOn, rightOn, onOpen }: PowerpointItemPinProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
      aria-label={`${item.name} — open controls`}
    >
      <AustralianSocketIcon
        leftOn={leftOn}
        rightOn={rightOn}
        size={39}
        className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]"
      />
      <span
        className="mt-0.5 max-w-[80px] truncate text-center text-[9px] font-medium leading-none"
        style={{ color: "#e5e7eb", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
      >
        {item.name}
      </span>
    </button>
  );
}
