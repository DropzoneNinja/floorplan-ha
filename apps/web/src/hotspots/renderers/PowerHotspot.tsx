import type { EntityState, PowerConfig } from "@floorplan-ha/shared";
import { useShallow } from "zustand/react/shallow";
import type { HotspotRendererProps } from "../types.ts";
import { useEntityStateStore } from "../../store/entity-states.ts";
import { usePowerStore } from "../../store/power.ts";
import { ICON_PATHS } from "../icons.ts";
import { fmtWatts, powerToColor, readWatts } from "../power-utils.ts";

/**
 * Power overview hotspot.
 *
 * Renders a lightning icon with the combined live draw of every placed power
 * sensor. The icon is coloured on the power scale (blue at idle, through green
 * and amber, to red at 2 kW and above), so the colour shows how much electricity
 * the home is using right now.
 *
 * Clicking the icon toggles a floorplan overlay (PowerOverlayLayer) with a heatmap
 * radiating from each sensor. Tapping a sensor there opens its usage history.
 */
export function PowerHotspot({ hotspot, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as unknown as PowerConfig;
  const items = config.items ?? [];

  const itemEntityIds = items.map((it) => it.entityId);
  const states = useEntityStateStore(
    useShallow((s): Record<string, EntityState | undefined> =>
      Object.fromEntries(itemEntityIds.map((id) => [id, s.getState(id)])),
    ),
  );
  const visibleHotspotId = usePowerStore((s) => s.visibleHotspotId);
  const toggle = usePowerStore((s) => s.toggle);

  const isExpanded = visibleHotspotId === hotspot.id;

  let totalWatts: number | null = null;
  for (const item of items) {
    const watts = readWatts(states[item.entityId]);
    if (watts !== null) totalWatts = (totalWatts ?? 0) + watts;
  }

  const color = totalWatts !== null ? powerToColor(totalWatts, 1) : "#6b7280";
  const display = totalWatts !== null ? fmtWatts(totalWatts) : "—";

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
      aria-label={`${hotspot.name}: ${display} total — click to ${isExpanded ? "hide" : "show"} power sensors`}
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
        boxShadow: isExpanded ? `0 0 10px 3px ${color}` : undefined,
        containerType: "size",
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: "34cqmin", height: "34cqmin", flexShrink: 0, color }}>
        <path d={ICON_PATHS["mdi:lightning-bolt"] ?? ICON_PATHS["default"]} fill="currentColor" />
      </svg>
      <span style={{ color: "#ffffff", fontSize: "max(9px, 18cqmin)", fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap" }}>
        {display}
      </span>
    </button>
  );
}
