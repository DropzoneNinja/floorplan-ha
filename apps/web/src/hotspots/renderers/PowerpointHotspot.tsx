import type { PowerpointConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { useEntityStateStore } from "../../store/entity-states.ts";
import { usePowerpointStore } from "../../store/powerpoint.ts";
import { isOnState } from "../state-utils.ts";
import { AustralianSocketIcon } from "../icons/AustralianSocket.tsx";

/**
 * Powerpoint overview hotspot.
 *
 * Renders a single Australian double-socket icon. The left/right halves
 * glow whenever any configured item's outlet A / outlet B (respectively) is
 * currently on, giving an at-a-glance "something's switched on" signal.
 *
 * Clicking the icon toggles a floorplan overlay (PowerpointOverlayLayer)
 * that shows each individual powerpoint location, which can then be tapped
 * to open a control dialog for its two outlets.
 */
export function PowerpointHotspot({ hotspot, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as unknown as PowerpointConfig;
  const items = config.items ?? [];

  const getEntityState = useEntityStateStore((s) => s.getState);
  const visibleHotspotId = usePowerpointStore((s) => s.visibleHotspotId);
  const toggle = usePowerpointStore((s) => s.toggle);

  const isExpanded = visibleHotspotId === hotspot.id;

  let leftOn = false;
  let rightOn = false;
  for (const item of items) {
    if (item.outletA.entityId && isOnState(getEntityState(item.outletA.entityId)?.state ?? "")) leftOn = true;
    if (item.outletB.entityId && isOnState(getEntityState(item.outletB.entityId)?.state ?? "")) rightOn = true;
  }

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
      aria-label={`${hotspot.name} — click to ${isExpanded ? "hide" : "show"} powerpoints`}
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
        boxShadow: isExpanded ? "0 0 10px 3px rgba(250,204,21,0.35)" : undefined,
      }}
    >
      <AustralianSocketIcon leftOn={leftOn} rightOn={rightOn} size={22} className="shrink-0" />
      {items.length > 0 && (
        <span className="text-[10px] tabular-nums text-gray-300">{items.length}</span>
      )}
    </button>
  );
}
