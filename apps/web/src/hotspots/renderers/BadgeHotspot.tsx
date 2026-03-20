import type { BadgeConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";

/**
 * Badge/status hotspot: displays a small pill showing a human-readable label
 * derived from entity state (e.g. "Open", "Armed", "Motion Detected").
 *
 * stateLabels and stateColors are keyed on the raw HA state string.
 * Missing keys fall back to showing the raw state value.
 */
export function BadgeHotspot({ hotspot, entityState, ruleResult }: HotspotRendererProps) {
  const config = hotspot.configJson as BadgeConfig;
  const stateStyle = ruleResult?.styleOverrides ?? {};

  const state = entityState?.state ?? "";

  // Rule text override takes priority, then config label map, then raw state
  const label = ruleResult?.textOverride ?? config.stateLabels?.[state] ?? (state || hotspot.name);

  const bgColor =
    stateStyle.backgroundColor ?? config.stateColors?.[state] ?? "rgba(55,65,81,0.85)";
  const textColor = stateStyle.color ?? "#ffffff";
  const opacity = stateStyle.opacity ?? 1;
  const glowColor = stateStyle.glow;

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      aria-label={hotspot.name}
      role="status"
      aria-live="polite"
      style={{ opacity }}
    >
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold leading-tight tracking-wide"
        style={{
          backgroundColor: bgColor,
          color: textColor,
          boxShadow: glowColor ? `0 0 10px 2px ${glowColor}` : undefined,
          // Clamp to avoid overflowing tiny hotspot areas
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}
