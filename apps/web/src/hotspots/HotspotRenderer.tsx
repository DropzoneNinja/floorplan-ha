import { memo } from "react";
import { evaluateRules } from "@floorplan-ha/shared";
import type { HotspotRaw } from "./types.ts";
import { getHotspotType } from "./registry.ts";
import { useEntityStateStore } from "../store/entity-states.ts";

interface HotspotRendererProps {
  hotspot: HotspotRaw;
  isEditMode?: boolean;
}

/**
 * Resolves the correct type-specific renderer for a hotspot, evaluates its
 * state rules against live entity state, and renders accordingly.
 *
 * Memoized per hotspot id — only re-renders when entity state for this
 * hotspot's entity changes, or when the hotspot definition itself changes.
 */
export const HotspotRenderer = memo(function HotspotRenderer({
  hotspot,
  isEditMode = false,
}: HotspotRendererProps) {
  const entityState = useEntityStateStore((s) =>
    hotspot.entityId ? s.getState(hotspot.entityId) : undefined,
  );

  const def = getHotspotType(hotspot.type);

  if (!def) {
    // Unknown type — show placeholder in edit mode only
    if (!isEditMode) return null;
    return (
      <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-gray-600 text-xs text-gray-500">
        {hotspot.type}
      </div>
    );
  }

  // Evaluate state rules (sorted by priority; first match wins)
  // In edit mode, always evaluate against "on" so hotspots show their active state.
  const stateValue = isEditMode ? "on" : (entityState?.state ?? "");
  const ruleResult =
    hotspot.stateRules.length > 0
      ? evaluateRules(
          hotspot.stateRules.map((r) => ({
            priority: r.priority,
            condition: r.conditionJson,
            result: r.resultJson,
          })),
          stateValue,
        )
      : null;

  // Hidden by state rule — render nothing in presentation mode
  if (ruleResult?.hidden && !isEditMode) return null;

  // Map animationType from rule result to CSS class
  const animClass =
    ruleResult?.animationType === "pulse" ? "anim-pulse"
    : ruleResult?.animationType === "blink" ? "anim-blink"
    : ruleResult?.animationType === "fade" ? "anim-fade"
    : "";

  const { Renderer } = def;
  const renderer = (
    <Renderer
      hotspot={hotspot}
      entityState={entityState}
      ruleResult={ruleResult}
      isEditMode={isEditMode}
    />
  );

  if (animClass) {
    return <div className={`${animClass} h-full w-full`}>{renderer}</div>;
  }

  return renderer;
});
