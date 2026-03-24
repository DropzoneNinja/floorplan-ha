import type { BatteryConfig, BatteryItem } from "@floorplan-ha/shared";
import type { HotspotRaw } from "./types.ts";
import { type ImageFitBounds, FULL_BOUNDS } from "./useImageFitBounds.ts";
import { useBatteryStore } from "../store/battery.ts";
import { useEntityStateStore } from "../store/entity-states.ts";
import { ICON_PATHS } from "./icons.ts";

interface BatteryOverlayLayerProps {
  hotspots: HotspotRaw[];
  /** Bounds of the rendered image within the container (fractions 0–1). */
  imageBounds?: ImageFitBounds;
}

/**
 * Overlay that renders individual battery location icons when a battery
 * hotspot is expanded (clicked).
 *
 * Each item is positioned using its normalized x/y coords from the config,
 * relative to the image bounds — the same coordinate space as HotspotLayer.
 * Clicking the backdrop (outside an item) dismisses the overlay.
 */
export function BatteryOverlayLayer({ hotspots, imageBounds = FULL_BOUNDS }: BatteryOverlayLayerProps) {
  const visibleHotspotId = useBatteryStore((s) => s.visibleHotspotId);
  const triggeredByZIndex = useBatteryStore((s) => s.triggeredByZIndex);
  const hide = useBatteryStore((s) => s.hide);
  const getEntityState = useEntityStateStore((s) => s.getState);

  if (!visibleHotspotId) return null;

  const hotspot = hotspots.find((h) => h.id === visibleHotspotId && h.type === "battery");
  if (!hotspot) return null;

  const config = hotspot.configJson as unknown as BatteryConfig;
  const items = config.items ?? [];
  const lowThreshold = config.lowThreshold ?? 30;
  const mediumThreshold = config.mediumThreshold ?? 50;

  return (
    <div
      className="pointer-events-auto absolute inset-0"
      style={{ zIndex: triggeredByZIndex - 1 }}
      onClick={hide}
      aria-label="Battery overlay — click to dismiss"
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
          <BatteryItemPin
            key={item.id}
            item={item}
            lowThreshold={lowThreshold}
            mediumThreshold={mediumThreshold}
            level={parseBatteryLevel(getEntityState(item.entityId)?.state)}
          />
        ))}
      </div>
    </div>
  );
}

function parseBatteryLevel(state: string | undefined): number | null {
  if (state == null) return null;
  const n = parseFloat(state);
  return isNaN(n) ? null : n;
}

function batteryColor(level: number | null, lowThreshold: number, mediumThreshold: number): string {
  if (level === null) return "#9ca3af"; // gray-400
  if (level < lowThreshold) return "#f87171"; // red-400
  if (level < mediumThreshold) return "#facc15"; // yellow-400
  return "#4ade80"; // green-400
}

interface BatteryItemPinProps {
  item: BatteryItem;
  lowThreshold: number;
  mediumThreshold: number;
  level: number | null;
}

function BatteryItemPin({ item, lowThreshold, mediumThreshold, level }: BatteryItemPinProps) {
  const color = batteryColor(level, lowThreshold, mediumThreshold);
  const label = level !== null ? `${Math.round(level)}%` : "—";

  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
    >
      {/* Battery icon */}
      <svg
        viewBox="0 0 24 24"
        style={{ width: 24, height: 24, color, filter: `drop-shadow(0 0 4px ${color}88)` }}
        aria-hidden="true"
      >
        <path d={ICON_PATHS["mdi:battery"] ?? ICON_PATHS["default"]} fill="currentColor" />
      </svg>
      {/* Name */}
      <span
        className="mt-0.5 max-w-[72px] truncate text-center text-[9px] font-medium leading-none"
        style={{ color: "#e5e7eb", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
      >
        {item.name}
      </span>
      {/* Level */}
      <span
        className="mt-0.5 text-[10px] font-bold tabular-nums leading-none"
        style={{ color, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
      >
        {label}
      </span>
    </div>
  );
}
