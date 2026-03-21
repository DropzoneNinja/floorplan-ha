import type { HotspotType } from "@floorplan-ha/shared";
import type { HotspotTypeDefinition } from "./types.ts";
import { ActionHotspot } from "./renderers/ActionHotspot.tsx";
import { TextHotspot } from "./renderers/TextHotspot.tsx";
import { StateImageHotspot } from "./renderers/StateImageHotspot.tsx";
import { StateIconHotspot } from "./renderers/StateIconHotspot.tsx";
import { BadgeHotspot } from "./renderers/BadgeHotspot.tsx";
import { SceneHotspot } from "./renderers/SceneHotspot.tsx";
import { BlindHotspot } from "./renderers/BlindHotspot.tsx";
import { BinsHotspot } from "./renderers/BinsHotspot.tsx";
import { CustomHotspot } from "./renderers/CustomHotspot.tsx";

/**
 * Central registry of hotspot type definitions.
 *
 * Each entry declares the type ID, display metadata, renderer component, and
 * default config. New hotspot types can be added by calling
 * `registerHotspotType` at app bootstrap — no changes to existing code needed.
 *
 * See docs/extending-hotspots.md for a step-by-step guide.
 */
const registry = new Map<HotspotType, HotspotTypeDefinition>();

export function registerHotspotType(def: HotspotTypeDefinition): void {
  registry.set(def.type, def);
}

export function getHotspotType(type: HotspotType): HotspotTypeDefinition | undefined {
  return registry.get(type);
}

export function getAllHotspotTypes(): HotspotTypeDefinition[] {
  return Array.from(registry.values());
}

// ─── Built-in registrations ───────────────────────────────────────────────────

registerHotspotType({
  type: "action",
  label: "Action Button",
  description: "Tap to call a Home Assistant service (toggle light, run script, etc.)",
  icon: "⚡",
  Renderer: ActionHotspot,
  defaultConfig: {
    tapAction: null,
    holdAction: null,
    doubleTapAction: null,
    icon: null,
    label: "Button",
    backgroundColor: null,
    hideLabel: false,
  },
});

registerHotspotType({
  type: "text",
  label: "Text / Value",
  description: "Display a sensor value or entity state with optional formatting",
  icon: "📊",
  Renderer: TextHotspot,
  defaultConfig: {
    template: "{{state}}",
    fontSize: 14,
    color: "#ffffff",
    align: "center",
  },
});

registerHotspotType({
  type: "state_image",
  label: "State Image",
  description: "Show different images depending on entity state (on/off, open/closed)",
  icon: "🖼",
  Renderer: StateImageHotspot,
  defaultConfig: {
    onAssetId: null,
    offAssetId: null,
    animationType: "crossfade",
  },
});

registerHotspotType({
  type: "state_icon",
  label: "State Icon",
  description: "Icon that changes color or glow based on entity state",
  icon: "🔵",
  Renderer: StateIconHotspot,
  defaultConfig: {
    icon: "mdi:power",
    onColor: "#facc15",
    offColor: "#6b7280",
    badgeEnabled: false,
  },
});

registerHotspotType({
  type: "badge",
  label: "Badge / Status",
  description: "Small pill showing a state label like Open, Closed, Armed",
  icon: "🏷",
  Renderer: BadgeHotspot,
  defaultConfig: {
    stateLabels: { on: "On", off: "Off" },
    stateColors: { on: "#16a34a", off: "#374151" },
  },
});

registerHotspotType({
  type: "scene",
  label: "Scene / Group",
  description: "Button that triggers a Home Assistant scene or script",
  icon: "🎬",
  Renderer: SceneHotspot,
  defaultConfig: {
    serviceCall: { domain: "scene", service: "turn_on" },
    icon: null,
    label: "Scene",
  },
});

registerHotspotType({
  type: "blind",
  label: "Blind / Cover",
  description: "Tap to open a position control for roller blinds, shades, or covers",
  icon: "🪟",
  Renderer: BlindHotspot,
  defaultConfig: {
    icon: "mdi:blinds",
    label: null,
    backgroundColor: null,
    groupEntityIds: [],
    batteryEntityId: null,
    lowBatteryThreshold: 40,
  },
});

registerHotspotType({
  type: "bins",
  label: "Bin Day",
  description: "Shows which bin to put out next based on a Home Assistant calendar",
  icon: "🗑️",
  Renderer: BinsHotspot,
  defaultConfig: {
    yellowBinAssetId: null,
    redBinAssetId: null,
    label: null,
  },
});

registerHotspotType({
  type: "custom",
  label: "Custom",
  description: "Extension point — replace this renderer via registerHotspotType()",
  icon: "🔧",
  Renderer: CustomHotspot,
  defaultConfig: {},
});
