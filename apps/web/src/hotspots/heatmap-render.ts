/**
 * Canvas helpers shared by the floorplan heatmaps (temperature and power).
 *
 * Heatmaps are drawn at a fixed 1920×1080 resolution and scaled to the
 * floorplan, so gradient quality does not depend on the display size.
 */

export const CANVAS_W = 1920;
export const CANVAS_H = 1080;

/** A single sensor contributing to the indoor gradient. */
export interface HeatPoint {
  /** Normalized 0–1 position within the floorplan image. */
  x: number;
  y: number;
  /** Gradient radius as a fraction of the floorplan width. */
  radius: number;
  /** Already converted to the scale the colour stops use. */
  value: number;
}

/** A colour stop on a heatmap scale. */
export interface ColorStop {
  value: number;
  r: number;
  g: number;
  b: number;
}

/**
 * Converts a black/white mask PNG into an alpha mask. White pixels (interior)
 * become opaque; dark pixels (exterior) become transparent. This lets the heatmap
 * use destination-in / destination-out compositing regardless of whether the
 * source PNG already has an alpha channel.
 */
export function buildAlphaMask(img: HTMLImageElement): OffscreenCanvas {
  const offscreen = new OffscreenCanvas(CANVAS_W, CANVAS_H);
  const mCtx = offscreen.getContext("2d")!;
  mCtx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
  const imageData = mCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    // Perceived luminance as alpha; set RGB to white so the mask itself
    // is invisible when drawn (only the alpha matters for compositing).
    const luma = Math.round(d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114);
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    d[i + 3] = luma;
  }
  mCtx.putImageData(imageData, 0, 0);
  return offscreen;
}

/**
 * Renders the indoor layer as an inverse-distance-weighted blend: each point
 * dominates near its own origin and blends smoothly toward its neighbours,
 * instead of later points overwriting earlier ones via source-over.
 *
 * Computed at 1/8 resolution and scaled up — heatmaps are smooth low-frequency
 * signals so the bilinear upsample is fine. Clipped to the mask when one is given.
 * Returns null when there are no points to draw.
 */
export function renderIndoorLayer(
  points: HeatPoint[],
  toRgb: (value: number) => [number, number, number],
  mask: OffscreenCanvas | null,
): OffscreenCanvas | null {
  if (points.length === 0) return null;

  const IDW_W = 240;
  const IDW_H = 135;
  const imgData = new ImageData(IDW_W, IDW_H);
  const d = imgData.data;

  for (let py = 0; py < IDW_H; py++) {
    for (let px = 0; px < IDW_W; px++) {
      // Map IDW pixel → full-canvas pixel space so radius (fraction of CANVAS_W)
      // is in the same units as the distance calculation.
      const fullX = (px + 0.5) / IDW_W * CANVAS_W;
      const fullY = (py + 0.5) / IDW_H * CANVAS_H;

      let weightedValue = 0;
      let totalWeight = 0;

      for (const p of points) {
        const dx = fullX - p.x * CANVAS_W;
        const dy = fullY - p.y * CANVAS_H;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = p.radius * CANVAS_W;
        const t = dist / radius;
        if (t >= 1) continue;

        // Gradient stops (0.85 → 0.45 → 0) give a soft falloff.
        const alpha = t <= 0.6
          ? 0.85 - 0.40 * (t / 0.6)
          : 0.45 * (1 - (t - 0.6) / 0.4);

        weightedValue += alpha * p.value;
        totalWeight += alpha;
      }

      const idx = (py * IDW_W + px) * 4;
      if (totalWeight > 0.01) {
        const blendedValue = weightedValue / totalWeight;
        const finalAlpha = Math.min(0.85, totalWeight);
        const [cr, cg, cb] = toRgb(blendedValue);
        d[idx]     = cr;
        d[idx + 1] = cg;
        d[idx + 2] = cb;
        d[idx + 3] = Math.round(finalAlpha * 255);
      }
    }
  }

  const smallCanvas = new OffscreenCanvas(IDW_W, IDW_H);
  const smallCtx = smallCanvas.getContext("2d")!;
  smallCtx.putImageData(imgData, 0, 0);

  const indoorCanvas = new OffscreenCanvas(CANVAS_W, CANVAS_H);
  const iCtx = indoorCanvas.getContext("2d")!;
  iCtx.imageSmoothingEnabled = true;
  iCtx.imageSmoothingQuality = "high";
  iCtx.drawImage(smallCanvas, 0, 0, CANVAS_W, CANVAS_H);

  // Clip the indoor layer to the house interior using the mask.
  if (mask) {
    iCtx.globalCompositeOperation = "destination-in";
    iCtx.drawImage(mask, 0, 0, CANVAS_W, CANVAS_H);
  }

  return indoorCanvas;
}

/**
 * Maps a value to an RGB triple by interpolating between colour stops.
 * Values outside the stop range clamp to the first or last stop.
 */
export function interpolateStops(value: number, stops: readonly ColorStop[]): [number, number, number] {
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;
  if (value <= first.value) return [first.r, first.g, first.b];
  if (value >= last.value) return [last.r, last.g, last.b];
  for (let i = 0; i < stops.length - 1; i++) {
    const lo = stops[i]!;
    const hi = stops[i + 1]!;
    if (value >= lo.value && value <= hi.value) {
      const t = (value - lo.value) / (hi.value - lo.value);
      return [
        Math.round(lo.r + t * (hi.r - lo.r)),
        Math.round(lo.g + t * (hi.g - lo.g)),
        Math.round(lo.b + t * (hi.b - lo.b)),
      ];
    }
  }
  return [128, 128, 128];
}
