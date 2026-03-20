import type { StateImageConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { api } from "../../api/client.ts";

/** States considered "active/on" for image selection */
const ON_STATES = new Set([
  "on", "open", "active", "playing", "home", "unlocked",
  "detected", "motion", "true", "armed_home", "armed_away",
]);

function isOnState(state: string): boolean {
  return ON_STATES.has(state.toLowerCase());
}

/**
 * State image hotspot: shows one image when entity state is "on/open/active"
 * and another when the state is "off/closed/inactive".
 *
 * Supports CSS fade and crossfade transitions between images.
 * Both image layers are always mounted so the crossfade uses opacity transitions only.
 */
export function StateImageHotspot({ hotspot, entityState, ruleResult, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as StateImageConfig;
  const stateStyle = ruleResult?.styleOverrides ?? {};

  const state = entityState?.state ?? "off";
  const isOn = isOnState(state);

  // A state rule can override which asset is shown
  const overrideAssetId = ruleResult?.imageAssetId;

  const onAssetId = config.onAssetId;
  const offAssetId = config.offAssetId;

  const animType = config.animationType ?? "none";
  const transitionCss = animType !== "none" ? "opacity 0.4s ease" : "none";

  // If there's an override from a state rule, show only that image
  if (overrideAssetId) {
    return (
      <div
        className="relative h-full w-full overflow-hidden"
        style={{ opacity: stateStyle.opacity }}
      >
        <img
          src={api.assets.fileUrl(overrideAssetId)}
          alt={hotspot.name}
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  if (!onAssetId && !offAssetId) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-white/20">
        <span className="text-[10px] text-gray-500">No images configured</span>
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      aria-label={hotspot.name}
      style={{ opacity: stateStyle.opacity }}
    >
      {/*
        Two layers always mounted. Opacity drives visibility so CSS transitions
        produce a smooth crossfade as state toggles between on/off.
        For "fade" vs "crossfade", both use the same opacity approach here —
        the difference is subtle and a full staggered fade would require JS timers.
      */}
      {onAssetId && (
        <img
          src={api.assets.fileUrl(onAssetId)}
          alt={isOn ? hotspot.name : ""}
          aria-hidden={!isOn}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ opacity: isEditMode ? 1 : (isOn ? 1 : 0), transition: isEditMode ? "none" : transitionCss }}
          draggable={false}
        />
      )}
      {offAssetId && (
        <img
          src={api.assets.fileUrl(offAssetId)}
          alt={!isOn ? hotspot.name : ""}
          aria-hidden={isOn}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ opacity: isEditMode ? (onAssetId ? 0 : 1) : (isOn ? 0 : 1), transition: isEditMode ? "none" : transitionCss }}
          draggable={false}
        />
      )}
    </div>
  );
}
