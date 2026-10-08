import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { EntityState, PowerConfig, PowerSensor, SolarConfig } from "@floorplan-ha/shared";
import type { HotspotRaw } from "./types.ts";
import { type ImageFitBounds, FULL_BOUNDS } from "./useImageFitBounds.ts";
import { usePowerStore } from "../store/power.ts";
import { useEntityStateStore } from "../store/entity-states.ts";
import { CANVAS_W, CANVAS_H, renderIndoorLayer, type HeatPoint } from "./heatmap-render.ts";
import { HeatmapLegend } from "./HeatmapLayer.tsx";
import { useHeatmapMask } from "./useHeatmapMask.ts";
import { POWER_STOPS, fmtWatts, powerToColor, powerToRgb, readWatts } from "./power-utils.ts";
import { IDLE_COLOR, computeHouseConsumption } from "./solar-utils.ts";
import { PowerHistoryModal } from "./PowerHistoryModal.tsx";
import { PowerAggregateHistoryModal } from "./PowerAggregateHistoryModal.tsx";

/** Scales each sensor's configured heat radius when drawing the blooms. 0.5 = half the radius. */
const BLOOM_RADIUS_SCALE = 0.5;
/** Minimum watts before a house-to-sensor connector line is treated as "active" and animates. */
const CONNECTOR_FLOW_THRESHOLD = 5;

interface PowerOverlayLayerProps {
  hotspots: HotspotRaw[];
  /** Asset ID of the floorplan's heatmap mask (white = interior). */
  maskAssetId: string | null;
  /** Bounds of the rendered image within the container (fractions 0–1). */
  imageBounds?: ImageFitBounds;
}

/**
 * Overlay shown when a power hotspot is tapped. First click: draws a heatmap
 * radiating from each placed power sensor, clipped to the interior mask, and a
 * pin per sensor with its live draw; tapping a pin opens that sensor's usage
 * history. Second click: replaces the heatmap with a combined usage graph
 * across every sensor. Clicking the floorplan or closing the graph dismisses
 * the overlay.
 */
export function PowerOverlayLayer({ hotspots, maskAssetId, imageBounds = FULL_BOUNDS }: PowerOverlayLayerProps) {
  const visibleHotspotId = usePowerStore((s) => s.visibleHotspotId);
  const mode = usePowerStore((s) => s.mode);
  const triggeredByZIndex = usePowerStore((s) => s.triggeredByZIndex);
  const hide = usePowerStore((s) => s.hide);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mask = useHeatmapMask(maskAssetId);
  const [openSensorId, setOpenSensorId] = useState<string | null>(null);

  const hotspot = visibleHotspotId
    ? hotspots.find((h) => h.id === visibleHotspotId && h.type === "power")
    : undefined;
  const config = hotspot ? (hotspot.configJson as unknown as PowerConfig) : undefined;
  const sensors = config?.items ?? [];
  const radius = (config?.radius ?? 0.25) * BLOOM_RADIUS_SCALE;

  // House box from a Solar hotspot on the same floorplan, if one is configured —
  // draws a bus line (trunk + one vertical branch per sensor) while the heatmap is open.
  // The trunk is coloured by the house's actual total consumption (solar + grid
  // import − export), not by the sum of this Power hotspot's own sensors.
  const solarHotspot = hotspots.find((h) => h.type === "solar" && (h.configJson as unknown as SolarConfig).houseBox);
  const solarConfig = solarHotspot ? (solarHotspot.configJson as unknown as SolarConfig) : null;
  const houseBox = solarConfig?.houseBox ?? null;

  const sensorEntityIds = sensors.map((s) => s.entityId);
  const solarEntityIds = solarConfig
    ? [...solarConfig.panels.map((p) => p.entityId), ...(solarConfig.gridBox?.entityId ? [solarConfig.gridBox.entityId] : [])]
    : [];
  const allEntityIds = [...sensorEntityIds, ...solarEntityIds];
  const states = useEntityStateStore(
    useShallow((s): Record<string, EntityState | undefined> =>
      Object.fromEntries(allEntityIds.map((id) => [id, s.getState(id)])),
    ),
  );

  const points: HeatPoint[] = [];
  for (const sensor of sensors) {
    const watts = readWatts(states[sensor.entityId]);
    if (watts !== null) points.push({ x: sensor.x, y: sensor.y, radius, value: watts });
  }
  const pointsKey = points.map((p) => `${p.x},${p.y},${p.radius},${p.value}`).join("|");
  const isShown = hotspot !== undefined;

  const houseResult = solarConfig ? computeHouseConsumption(solarConfig, (id) => states[id]) : null;
  const houseConsumption = houseResult?.consumption ?? null;
  const gridWatts = houseResult?.gridWatts ?? null;
  const trunkColor = houseConsumption !== null ? powerToColor(houseConsumption, 0.9) : IDLE_COLOR;
  const trunkActive = houseConsumption !== null && Math.abs(houseConsumption) >= CONNECTOR_FLOW_THRESHOLD;

  // Percentage shown under each pin's watts: of the house's total incoming power
  // (grid + solar − export) when the grid sensor has a real, non-zero reading;
  // otherwise of this Power hotspot's own total (the number on its main icon),
  // since "grid + solar − export" isn't meaningful without a live grid reading.
  let powerIconTotal: number | null = null;
  for (const p of points) powerIconTotal = (powerIconTotal ?? 0) + p.value;
  const percentOf = gridWatts !== null && gridWatts !== 0 ? houseConsumption : powerIconTotal;

  const leftXs = houseBox ? sensors.filter((s) => s.x < houseBox.x).map((s) => s.x) : [];
  const rightXs = houseBox ? sensors.filter((s) => s.x >= houseBox.x).map((s) => s.x) : [];
  const leftMinX = leftXs.length ? Math.min(...leftXs) : null;
  const rightMaxX = rightXs.length ? Math.max(...rightXs) : null;

  // Forget the open sensor once the overlay is dismissed or leaves heatmap mode,
  // so its history doesn't reopen on the next show.
  useEffect(() => {
    if (!isShown || mode !== "heatmap") setOpenSensorId(null);
  }, [isShown, mode]);

  // ── Redraw the heatmap whenever the sensors, their readings, or the mask change ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const indoor = renderIndoorLayer(points, powerToRgb, mask);
    if (indoor) ctx.drawImage(indoor, 0, 0);
  // points is rebuilt each render; pointsKey captures its contents.
  }, [isShown, pointsKey, mask]);

  if (!hotspot) return null;

  const openSensor = sensors.find((s) => s.id === openSensorId) ?? null;
  const openUnit = openSensor?.entityId ? states[openSensor.entityId]?.attributes.unit_of_measurement : undefined;

  return (
    <>
      {mode === "heatmap" && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ zIndex: triggeredByZIndex - 1 }}
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              hide();
              setOpenSensorId(null);
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

            {houseBox && (
              <svg
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full overflow-visible"
                style={{ pointerEvents: "none" }}
              >
                {/* Trunk — a bus line out from the house box, one segment per side that
                    actually has a sensor on it. Coloured and animated from the house's
                    actual total consumption, flowing outward on both segments. */}
                {rightMaxX !== null && (
                  <line
                    x1={houseBox.x} y1={houseBox.y} x2={rightMaxX} y2={houseBox.y}
                    stroke={trunkColor} strokeWidth={3} vectorEffect="non-scaling-stroke"
                    opacity={trunkActive ? 0.9 : 0.35}
                    className={trunkActive ? "wire-flow" : undefined}
                  />
                )}
                {leftMinX !== null && (
                  <line
                    x1={houseBox.x} y1={houseBox.y} x2={leftMinX} y2={houseBox.y}
                    stroke={trunkColor} strokeWidth={3} vectorEffect="non-scaling-stroke"
                    opacity={trunkActive ? 0.9 : 0.35}
                    className={trunkActive ? "wire-flow" : undefined}
                  />
                )}

                {/* Branches — one vertical drop from the trunk to each sensor, animated
                    and colour-coded on the same blue→red scale as the heatmap. */}
                {sensors.map((sensor) => {
                  const watts = readWatts(states[sensor.entityId]);
                  const isActive = watts !== null && watts >= CONNECTOR_FLOW_THRESHOLD;
                  const color = watts !== null ? powerToColor(watts, 1) : IDLE_COLOR;
                  return (
                    <path
                      key={sensor.id}
                      d={`M ${sensor.x} ${houseBox.y} L ${sensor.x} ${sensor.y}`}
                      fill="none"
                      stroke={color}
                      strokeWidth={2.5}
                      vectorEffect="non-scaling-stroke"
                      opacity={isActive ? 0.9 : 0.35}
                      className={isActive ? "wire-flow" : undefined}
                    />
                  );
                })}
              </svg>
            )}

            {sensors.map((sensor) => {
              const watts = readWatts(states[sensor.entityId]);
              const pct = watts !== null && percentOf !== null && percentOf > 0 ? (watts / percentOf) * 100 : null;
              return (
                <SensorPin
                  key={sensor.id}
                  sensor={sensor}
                  watts={watts}
                  pct={pct}
                  onOpen={() => setOpenSensorId(sensor.id)}
                />
              );
            })}

            <HeatmapLegend stops={POWER_STOPS} unitSuffix=" W" />
          </div>
        </div>
      )}

      {mode === "aggregate" && (
        <PowerAggregateHistoryModal sensors={sensors} states={states} onClose={hide} />
      )}

      {openSensor && mode === "heatmap" && (
        <PowerHistoryModal
          sensor={openSensor}
          unit={typeof openUnit === "string" ? openUnit : undefined}
          currentWatts={readWatts(states[openSensor.entityId])}
          onClose={() => setOpenSensorId(null)}
        />
      )}
    </>
  );
}

// ─── Sensor pin ───────────────────────────────────────────────────────────────

interface SensorPinProps {
  sensor: PowerSensor;
  watts: number | null;
  /** This sensor's share of the house's total incoming power, 0–100. Null if it can't be computed. */
  pct: number | null;
  onOpen: () => void;
}

function SensorPin({ sensor, watts, pct, onOpen }: SensorPinProps) {
  const color = watts !== null ? powerToColor(watts, 1) : "#9ca3af";
  const label = watts !== null ? fmtWatts(watts) : "—";

  return (
    <button
      type="button"
      aria-label={`${sensor.name}: ${label} — show usage history`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center rounded-lg px-2 py-1 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      style={{
        left: `${sensor.x * 100}%`,
        top: `${sensor.y * 100}%`,
        background: "rgba(15,23,42,0.8)",
        border: `2px solid ${color}`,
        backdropFilter: "blur(4px)",
        minWidth: 44,
        minHeight: 44,
      }}
    >
      <span
        className="max-w-[96px] truncate text-[10px] font-medium leading-none"
        style={{ color: "#e5e7eb" }}
      >
        {sensor.name}
      </span>
      <span className="mt-0.5 text-[13px] font-bold leading-none" style={{ color: "#ffffff" }}>
        {label}
      </span>
      {pct !== null && (
        <span className="mt-0.5 text-[15px] leading-none" style={{ color: "#9ca3af" }}>
          {Math.round(pct)}%
        </span>
      )}
    </button>
  );
}
