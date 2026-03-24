import type { TemperatureGaugeConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { useHeatmapStore } from "../../store/heatmap.ts";

/**
 * Temperature gauge hotspot.
 *
 * Renders a circular badge showing the current temperature from the linked HA
 * entity. Clicking toggles the heatmap overlay (unless in edit mode).
 *
 * One gauge should be marked `isOutside: true` to represent the exterior sensor.
 * All others are treated as interior gauges whose positions drive the radial
 * heatmap gradients.
 */
export function TemperatureGaugeHotspot({ hotspot, entityState, ruleResult, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as TemperatureGaugeConfig;
  const isVisible = useHeatmapStore((s) => s.isVisible);
  const toggle = useHeatmapStore((s) => s.toggle);

  const rawState = entityState?.state ?? "";
  const tempValue = parseFloat(rawState);
  const isValidTemp = !isNaN(tempValue);

  const displayTemp = isValidTemp
    ? `${Math.round(tempValue)}°${config.unit === "fahrenheit" ? "F" : "C"}`
    : "—";

  // Colour of the gauge ring — maps temp to a heat colour
  const tempC = config.unit === "fahrenheit" && isValidTemp ? (tempValue - 32) * (5 / 9) : tempValue;
  const ringColor = isValidTemp ? tempToColor(tempC, 1) : "#6b7280";

  const stateStyle = ruleResult?.styleOverrides ?? {};
  const opacity = stateStyle.opacity ?? 1;
  const displayMode = config.displayMode ?? "full";
  const label = ruleResult?.textOverride ?? displayTemp;

  const handleClick = (e: React.MouseEvent) => {
    if (isEditMode) return;
    e.stopPropagation();
    toggle();
  };

  // ── Minimal mode — temperature text only ───────────────────────────────────
  if (displayMode === "minimal") {
    const textColor = config.textColor ?? stateStyle.color ?? ringColor;
    return (
      <button
        type="button"
        className="flex h-full w-full items-center justify-center focus:outline-none"
        onClick={handleClick}
        aria-label={`${hotspot.name}: ${displayTemp}`}
        style={{ opacity, cursor: isEditMode ? "default" : "pointer", containerType: "size" }}
      >
        <span
          style={{
            color: textColor,
            fontSize: "max(9px, 40cqmin)",
            fontWeight: 700,
            letterSpacing: "0.01em",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </button>
    );
  }

  // ── Full mode — circular badge with icon and colour ring ───────────────────
  const textColor = config.textColor ?? stateStyle.color ?? "#ffffff";
  return (
    <button
      type="button"
      className="flex h-full w-full items-center justify-center focus:outline-none"
      onClick={handleClick}
      aria-label={`${hotspot.name}: ${displayTemp}`}
      style={{ opacity, cursor: isEditMode ? "default" : "pointer", containerType: "size" }}
    >
      <div
        className="relative flex flex-col items-center justify-center rounded-full"
        style={{
          width: "100%",
          height: "100%",
          background: "rgba(15,23,42,0.75)",
          border: `3px solid ${ringColor}`,
          boxShadow: isVisible && !config.isOutside
            ? `0 0 12px 3px ${ringColor}60, inset 0 0 8px 2px ${ringColor}30`
            : `0 0 6px 1px ${ringColor}40`,
          backdropFilter: "blur(4px)",
          transition: "box-shadow 0.3s ease",
        }}
      >
        {/* Thermometer icon */}
        <svg
          viewBox="0 0 24 24"
          className="mb-0.5"
          style={{ width: "28cqmin", height: "28cqmin", fill: ringColor, flexShrink: 0 }}
          aria-hidden="true"
        >
          <path d="M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0zm-3 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
        </svg>

        {/* Temperature value */}
        <span
          style={{
            color: textColor,
            fontSize: "max(9px, 20cqmin)",
            fontWeight: 700,
            letterSpacing: "0.01em",
            lineHeight: 1,
          }}
        >
          {label}
        </span>

        {/* Outside label */}
        {config.isOutside && (
          <span
            style={{
              color: "#94a3b8",
              fontSize: "max(7px, 12cqmin)",
              marginTop: "2cqmin",
              lineHeight: 1,
            }}
          >
            Outside
          </span>
        )}

        {/* Active pulse ring for indoor gauges when heatmap is visible */}
        {isVisible && !config.isOutside && (
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{
              border: `2px solid ${ringColor}`,
              opacity: 0.4,
            }}
          />
        )}
      </div>
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Colour stops for the temperature scale (in °C). */
const TEMP_STOPS: Array<{ temp: number; r: number; g: number; b: number }> = [
  { temp: 0,  r: 33,  g: 150, b: 243 }, // blue
  { temp: 15, r: 0,   g: 188, b: 212 }, // cyan
  { temp: 20, r: 76,  g: 175, b: 80  }, // green
  { temp: 25, r: 255, g: 193, b: 7   }, // amber
  { temp: 32, r: 244, g: 67,  b: 54  }, // red
];

/**
 * Maps a Celsius temperature to an rgba colour string by interpolating between
 * the defined colour stops.
 */
export function tempToColor(tempC: number, alpha: number): string {
  const first = TEMP_STOPS[0];
  const last = TEMP_STOPS[TEMP_STOPS.length - 1];
  if (!first || !last) return `rgba(128,128,128,${alpha})`;

  if (tempC <= first.temp) return `rgba(${first.r},${first.g},${first.b},${alpha})`;
  if (tempC >= last.temp) return `rgba(${last.r},${last.g},${last.b},${alpha})`;

  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    const lo = TEMP_STOPS[i]!;
    const hi = TEMP_STOPS[i + 1]!;
    if (tempC >= lo.temp && tempC <= hi.temp) {
      const t = (tempC - lo.temp) / (hi.temp - lo.temp);
      const r = Math.round(lo.r + t * (hi.r - lo.r));
      const g = Math.round(lo.g + t * (hi.g - lo.g));
      const b = Math.round(lo.b + t * (hi.b - lo.b));
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  return `rgba(128,128,128,${alpha})`;
}
