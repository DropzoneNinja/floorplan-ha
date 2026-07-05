import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { TemperatureGaugeConfig, EntityState } from "@floorplan-ha/shared";
import type { HotspotRaw } from "./types.ts";
import { type ImageFitBounds, FULL_BOUNDS } from "./useImageFitBounds.ts";
import { useHeatmapStore } from "../store/heatmap.ts";
import { useEntityStateStore } from "../store/entity-states.ts";
import { api } from "../api/client.ts";
import { tempToColor, TEMP_STOPS } from "./renderers/TemperatureGaugeHotspot.tsx";

interface HeatmapLayerProps {
  hotspots: HotspotRaw[];
  maskAssetId: string | null;
  /** Bounds of the rendered image within the container (fractions 0–1). */
  imageBounds?: ImageFitBounds;
}

// Canvas resolution — independent of display size for consistent gradient quality.
const CANVAS_W = 1920;
const CANVAS_H = 1080;

/**
 * Canvas overlay that renders a temperature heatmap when the user clicks a
 * temperature gauge hotspot.
 *
 * - Outdoor gauge: fills the exterior region with a solid temperature colour.
 * - Indoor gauges: radiate circular gradients clipped to the interior mask.
 * - Clicking the canvas (outside a gauge) dismisses the heatmap.
 */
export function HeatmapLayer({ hotspots, maskAssetId, imageBounds = FULL_BOUNDS }: HeatmapLayerProps) {
  const isVisible = useHeatmapStore((s) => s.isVisible);
  const triggeredByZIndex = useHeatmapStore((s) => s.triggeredByZIndex);
  const hide = useHeatmapStore((s) => s.hide);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<OffscreenCanvas | null>(null);
  const maskAssetIdRef = useRef<string | null>(null);

  const tempGauges = hotspots.filter((h) => h.type === "temperature_gauge");

  // Subscribe to temperature gauge entity states.
  // useShallow does a key-by-key comparison so the component only re-renders
  // when an actual gauge temperature changes, not on every SSE update.
  const gaugeEntityIds = tempGauges.map((h) => h.entityId).filter(Boolean) as string[];
  const entityStates = useEntityStateStore(
    useShallow((s): Record<string, EntityState | undefined> =>
      Object.fromEntries(gaugeEntityIds.map((id) => [id, s.getState(id)])),
    ),
  );

  // ── Load mask image whenever maskAssetId changes ───────────────────────────

  useEffect(() => {
    if (!maskAssetId) {
      maskCanvasRef.current = null;
      maskAssetIdRef.current = null;
      return;
    }
    if (maskAssetId === maskAssetIdRef.current) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Convert the black-and-white mask image into a proper alpha mask.
      // White pixels (interior) become opaque; black/dark pixels (exterior)
      // become transparent.  This lets us use canvas destination-in /
      // destination-out compositing regardless of whether the source PNG
      // already has an alpha channel.
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
      maskCanvasRef.current = offscreen;
      maskAssetIdRef.current = maskAssetId;
      if (isVisible) drawHeatmap(tempGauges, entityStates);
    };
    img.src = api.assets.fileUrl(maskAssetId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maskAssetId]);

  // ── Render heatmap whenever visibility or gauge states change ──────────────

  useEffect(() => {
    if (!isVisible) {
      clearCanvas();
      return;
    }
    drawHeatmap(tempGauges, entityStates);
  // entityStates is a new object each render when states change, so this fires correctly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, entityStates]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function drawHeatmap(
    gauges: HotspotRaw[],
    states: Record<string, EntityState | undefined>,
  ) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const mask = maskCanvasRef.current;

    const indoorGauges = gauges.filter((h) => !(h.configJson as TemperatureGaugeConfig).isOutside);
    const outsideGauge = gauges.find((h) => (h.configJson as TemperatureGaugeConfig).isOutside);

    const outsideTempC = resolveGaugeTempC(outsideGauge, states);

    // ── Outdoor layer ────────────────────────────────────────────────────────
    if (outsideTempC !== null) {
      const outdoorCanvas = new OffscreenCanvas(CANVAS_W, CANVAS_H);
      const oCtx = outdoorCanvas.getContext("2d")!;

      oCtx.fillStyle = tempToColor(outsideTempC, 0.65);
      oCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      if (mask) {
        // Remove the interior area so only the exterior region remains.
        oCtx.globalCompositeOperation = "destination-out";
        oCtx.drawImage(mask, 0, 0, CANVAS_W, CANVAS_H);
      }

      ctx.drawImage(outdoorCanvas, 0, 0);
    }

    // ── Indoor layer ─────────────────────────────────────────────────────────
    // IDW-blended indoor layer: each gauge dominates near its own origin and
    // blends smoothly toward neighbours, instead of later gauges overwriting
    // earlier ones via source-over.  Computed at 1/8 resolution and scaled up —
    // heatmaps are smooth low-frequency signals so the bilinear upsample is fine.
    if (indoorGauges.length > 0) {
      const gaugesWithTemp = indoorGauges
        .map((g) => {
          const tempC = resolveGaugeTempC(g, states);
          if (tempC === null) return null;
          const config = g.configJson as TemperatureGaugeConfig;
          return { x: g.x, y: g.y, radius: config.radius, tempC };
        })
        .filter(Boolean) as Array<{ x: number; y: number; radius: number; tempC: number }>;

      if (gaugesWithTemp.length > 0) {
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

            let weightedTemp = 0;
            let totalWeight = 0;

            for (const g of gaugesWithTemp) {
              const dx = fullX - g.x * CANVAS_W;
              const dy = fullY - g.y * CANVAS_H;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const radius = g.radius * CANVAS_W;
              const t = dist / radius;
              if (t >= 1) continue;

              // Mirror the original gradient stops (0.85 → 0.45 → 0) so the
              // falloff shape is identical to the previous radial-gradient approach.
              const alpha = t <= 0.6
                ? 0.85 - 0.40 * (t / 0.6)
                : 0.45 * (1 - (t - 0.6) / 0.4);

              weightedTemp += alpha * g.tempC;
              totalWeight += alpha;
            }

            const idx = (py * IDW_W + px) * 4;
            if (totalWeight > 0.01) {
              const blendedTemp = weightedTemp / totalWeight;
              const finalAlpha = Math.min(0.85, totalWeight);
              const [cr, cg, cb] = tempToRgb(blendedTemp);
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

        ctx.drawImage(indoorCanvas, 0, 0);
      }
    }
  }

  if (!isVisible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
      style={{ zIndex: triggeredByZIndex - 1 }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          hide();
        }}
        style={{
          position: "absolute",
          left: `${imageBounds.x * 100}%`,
          top: `${imageBounds.y * 100}%`,
          width: `${imageBounds.width * 100}%`,
          height: `${imageBounds.height * 100}%`,
          pointerEvents: "auto",
          cursor: "pointer",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ width: "100%", height: "100%", opacity: 0.8 }}
        />
        <HeatmapLegend />
      </div>
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function HeatmapLegend() {
  // Build a vertical CSS gradient from cold → hot
  const gradientStops = TEMP_STOPS.map(
    (s) => `rgba(${s.r},${s.g},${s.b},0.9)`,
  ).join(", ");

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: "24px",
        right: "24px",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        gap: "9px",
        background: "rgba(15,23,42,0.75)",
        backdropFilter: "blur(6px)",
        borderRadius: "12px",
        padding: "15px 15px 15px 12px",
        cursor: "default",
        pointerEvents: "auto",
      }}
    >
      {/* Gradient bar */}
      <div
        style={{
          width: "18px",
          borderRadius: "6px",
          background: `linear-gradient(to top, ${gradientStops})`,
          flexShrink: 0,
        }}
      />
      {/* Temperature labels — one per stop, evenly spaced */}
      <div
        style={{
          display: "flex",
          flexDirection: "column-reverse",
          justifyContent: "space-between",
        }}
      >
        {TEMP_STOPS.map((s) => (
          <span
            key={s.temp}
            style={{
              color: `rgba(${s.r},${s.g},${s.b},1)`,
              fontSize: "16px",
              fontWeight: 600,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {s.temp}°C
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tempToRgb(tempC: number): [number, number, number] {
  const first = TEMP_STOPS[0]!;
  const last = TEMP_STOPS[TEMP_STOPS.length - 1]!;
  if (tempC <= first.temp) return [first.r, first.g, first.b];
  if (tempC >= last.temp) return [last.r, last.g, last.b];
  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    const lo = TEMP_STOPS[i]!;
    const hi = TEMP_STOPS[i + 1]!;
    if (tempC >= lo.temp && tempC <= hi.temp) {
      const t = (tempC - lo.temp) / (hi.temp - lo.temp);
      return [
        Math.round(lo.r + t * (hi.r - lo.r)),
        Math.round(lo.g + t * (hi.g - lo.g)),
        Math.round(lo.b + t * (hi.b - lo.b)),
      ];
    }
  }
  return [128, 128, 128];
}

function resolveGaugeTempC(
  gauge: HotspotRaw | undefined,
  states: Record<string, EntityState | undefined>,
): number | null {
  if (!gauge?.entityId) return null;
  const entityState = states[gauge.entityId];
  if (!entityState) return null;
  const raw = parseFloat(entityState.state);
  if (isNaN(raw)) return null;
  const config = gauge.configJson as TemperatureGaugeConfig;
  return config.unit === "fahrenheit" ? (raw - 32) * (5 / 9) : raw;
}
