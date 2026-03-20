import type { StateIconConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { ICON_PATHS } from "../icons.ts";

/** States considered "active/on" for color selection */
const ON_STATES = new Set([
  "on", "open", "active", "playing", "home", "unlocked",
  "detected", "motion", "true", "armed_home", "armed_away",
]);

function isOnState(state: string): boolean {
  return ON_STATES.has(state.toLowerCase());
}

/**
 * State icon hotspot: displays a named icon whose color changes based on entity state.
 * Supports an optional badge dot to indicate binary active/inactive status.
 *
 * Icon rendering uses a small set of built-in SVG paths for common HA domains.
 * Unknown icon names fall back to a generic shape icon.
 * When a full MDI icon library is available, replace `IconShape` with a library lookup.
 */
export function StateIconHotspot({ hotspot, entityState, ruleResult }: HotspotRendererProps) {
  const config = hotspot.configJson as StateIconConfig;
  const stateStyle = ruleResult?.styleOverrides ?? {};

  const state = entityState?.state ?? "";
  const isOn = isOnState(state);

  const color =
    stateStyle.color ??
    (isOn ? config.onColor ?? "#facc15" : config.offColor ?? "#9ca3af");
  const opacity = stateStyle.opacity ?? 1;
  const glowColor = stateStyle.glow;

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      aria-label={hotspot.name}
      role="img"
      style={{
        opacity,
        filter: glowColor ? `drop-shadow(0 0 8px ${glowColor})` : undefined,
      }}
    >
      <IconShape icon={config.icon ?? ""} color={color} />

      {/* Badge dot — small indicator in the top-right corner */}
      {config.badgeEnabled && (
        <span
          className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-black/30"
          style={{ backgroundColor: isOn ? "#22c55e" : "#6b7280" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

// ─── Icon Shape ───────────────────────────────────────────────────────────────

interface IconShapeProps {
  icon: string;
  color: string;
}

/**
 * Renders a small set of common MDI icon names as inline SVGs.
 * Falls back to a generic "power" circle for unrecognised names.
 *
 * To add more icons: insert the MDI icon name and its `d` path into ICON_PATHS.
 * Full MDI SVG paths are available at https://materialdesignicons.com.
 */
function IconShape({ icon, color }: IconShapeProps) {
  const path = ICON_PATHS[icon] ?? ICON_PATHS["default"];
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3/4 w-3/4"
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} fill={color} />
    </svg>
  );
}

