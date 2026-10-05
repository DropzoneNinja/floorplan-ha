import type { EntityState } from "@floorplan-ha/shared";
import { interpolateStops, type ColorStop } from "./heatmap-render.ts";

/**
 * Colour scale for live power draw, in watts. Shared by the Power hotspot icon,
 * the floorplan heatmap, and the pins. Fixed across all power hotspots.
 */
export const POWER_STOPS: ColorStop[] = [
  { value: 0,    r: 33,  g: 150, b: 243 }, // blue — idle
  { value: 300,  r: 76,  g: 175, b: 80  }, // green
  { value: 1000, r: 255, g: 193, b: 7   }, // amber
  { value: 2000, r: 244, g: 67,  b: 54  }, // red — 2 kW and above
];

/** Maps a wattage to an RGB triple on the power scale. */
export function powerToRgb(watts: number): [number, number, number] {
  return interpolateStops(watts, POWER_STOPS);
}

/** Maps a wattage to an rgba colour string on the power scale. */
export function powerToColor(watts: number, alpha: number): string {
  const [r, g, b] = powerToRgb(watts);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Reads a sensor's current draw in watts. Accepts W and kW sensors.
 * Returns null for anything else (e.g. an energy sensor in kWh), since
 * its state is a running total, not a live power reading.
 */
export function readWatts(state: EntityState | undefined): number | null {
  if (!state) return null;
  const value = parseFloat(state.state);
  if (isNaN(value)) return null;
  const unit = String(state.attributes.unit_of_measurement ?? "W");
  if (unit === "kW") return value * 1000;
  if (unit === "W") return value;
  return null;
}

/** Formats watts for display: "850 W" below 1 kW, "1.2 kW" above. */
export function fmtWatts(watts: number): string {
  if (Math.abs(watts) >= 1000) return `${(watts / 1000).toFixed(1)} kW`;
  return `${Math.round(watts)} W`;
}
