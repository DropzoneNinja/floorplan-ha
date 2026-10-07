import type { CSSProperties } from "react";

/** Matches the `accent` colour in tailwind.config.ts. */
const FILL_COLOR = "#3b82f6";
const TRACK_COLOR = "rgba(255, 255, 255, 0.2)";

/**
 * Track background for a range input, painting the portion left of the knob in
 * the accent colour. Native `accent-color` only tints the knob once the track is
 * styled with `appearance-none`, so the fill has to be drawn by the track itself.
 */
export function sliderFillStyle(value: number, min: number, max: number): CSSProperties {
  const span = max - min;
  const percent = span > 0 ? Math.max(0, Math.min(100, ((value - min) / span) * 100)) : 0;
  return {
    background: `linear-gradient(to right, ${FILL_COLOR} ${percent}%, ${TRACK_COLOR} ${percent}%)`,
  };
}
