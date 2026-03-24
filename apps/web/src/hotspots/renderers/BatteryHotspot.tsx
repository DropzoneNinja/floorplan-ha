import type { BatteryConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { useEntityStateStore } from "../../store/entity-states.ts";
import { useBatteryStore } from "../../store/battery.ts";
import { ICON_PATHS } from "../icons.ts";

/**
 * Battery overview hotspot.
 *
 * Renders a single battery icon whose colour reflects the aggregate health of
 * all configured battery locations:
 *   green  — all batteries are at or above mediumThreshold
 *   yellow — at least one is below mediumThreshold (but none below lowThreshold)
 *   red    — at least one is below lowThreshold
 *
 * Clicking the icon toggles a floorplan overlay (BatteryOverlayLayer) that
 * shows each individual battery location with its level and colour.
 */
export function BatteryHotspot({ hotspot, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as unknown as BatteryConfig;
  const items = config.items ?? [];
  const lowThreshold = config.lowThreshold ?? 30;
  const mediumThreshold = config.mediumThreshold ?? 50;

  const getEntityState = useEntityStateStore((s) => s.getState);
  const visibleHotspotId = useBatteryStore((s) => s.visibleHotspotId);
  const toggle = useBatteryStore((s) => s.toggle);

  const isExpanded = visibleHotspotId === hotspot.id;

  // Compute aggregate status across all items
  let hasLow = false;
  let hasMedium = false;
  for (const item of items) {
    const state = getEntityState(item.entityId);
    const level = state ? parseFloat(state.state) : NaN;
    if (!isNaN(level)) {
      if (level < lowThreshold) hasLow = true;
      else if (level < mediumThreshold) hasMedium = true;
    }
  }

  const color = hasLow ? "#f87171" : hasMedium ? "#facc15" : "#4ade80";

  const configBg = config.backgroundColor ?? null;
  const resolvedBg =
    configBg === "transparent"
      ? "transparent"
      : configBg != null
        ? configBg
        : isExpanded
          ? "rgba(255,255,255,0.12)"
          : "rgba(255,255,255,0.08)";

  const handleClick = (e: React.MouseEvent) => {
    if (isEditMode) return;
    e.stopPropagation();
    toggle(hotspot.id, hotspot.zIndex);
  };

  return (
    <button
      type="button"
      aria-label={`${hotspot.name} — click to ${isExpanded ? "hide" : "show"} battery levels`}
      disabled={isEditMode}
      onClick={handleClick}
      className={[
        "relative flex h-full w-full select-none flex-col items-center justify-center gap-0.5 rounded-lg",
        "min-h-[44px] min-w-[44px] transition-all duration-100",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
        isEditMode ? "pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: resolvedBg,
        boxShadow: isExpanded ? `0 0 10px 3px ${color}55` : undefined,
      }}
    >
      <svg viewBox="0 0 24 24" className="w-1/2 shrink-0" aria-hidden="true" style={{ color }}>
        <path d={ICON_PATHS["mdi:battery"] ?? ICON_PATHS["default"]} fill="currentColor" />
      </svg>
      {items.length > 0 && (
        <span className="text-[10px] tabular-nums" style={{ color }}>
          {items.length}
        </span>
      )}
    </button>
  );
}
