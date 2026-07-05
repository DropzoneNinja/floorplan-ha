import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { TemperatureGaugeConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { useHeatmapStore } from "../../store/heatmap.ts";
import { api } from "../../api/client.ts";

/**
 * Temperature gauge hotspot.
 *
 * Renders a circular badge showing the current temperature from the linked HA
 * entity. Clicking toggles the heatmap overlay (unless in edit mode).
 *
 * One gauge should be marked `isOutside: true` to represent the exterior sensor.
 * All others are treated as interior gauges whose positions drive the radial
 * heatmap gradients.
 *
 * When the heatmap is active, clicking a gauge opens a 24-hour history dialog.
 */

// ─── Date helper ─────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Temperature History Modal ────────────────────────────────────────────────

interface TempHistoryModalProps {
  entityId: string;
  name: string;
  unit: "celsius" | "fahrenheit";
  currentTempC: number | null;
  onClose: () => void;
}

function TempHistoryModal({ entityId, name, unit, currentTempC, onClose }: TempHistoryModalProps) {
  const today = isoDate(new Date());
  const yesterday = isoDate(new Date(Date.now() - 86_400_000));

  const { data, isLoading } = useQuery({
    queryKey: ["temp-history-24h", entityId],
    queryFn: () => api.ha.historyRange(entityId, yesterday, today),
    staleTime: 5 * 60 * 1000,
  });

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  const readings = (data?.readings ?? [])
    .filter((r) => new Date(r.time).getTime() >= cutoff)
    .map((r) => ({
      time: new Date(r.time).getTime(),
      tempC: unit === "fahrenheit" ? (r.value - 32) * (5 / 9) : r.value,
    }));

  // Chart constants
  const CHART_W = 460;
  const CHART_H = 120;
  const PAD_T = 8;
  const PAD_B = 6;
  const plotH = CHART_H - PAD_T - PAD_B;

  const temps = readings.map((r) => r.tempC);
  const rawMin = temps.length ? Math.min(...temps) : 15;
  const rawMax = temps.length ? Math.max(...temps) : 25;
  const minTemp = rawMin - 2;
  const maxTemp = rawMax + 2;
  const tempRange = maxTemp - minTemp || 1;

  const xStart = cutoff;
  const xRange = 86_400_000;

  function toX(ms: number): number {
    return ((ms - xStart) / xRange) * CHART_W;
  }

  function toY(tempC: number): number {
    return PAD_T + plotH - ((tempC - minTemp) / tempRange) * plotH;
  }

  const linePts = readings.map((r) => `${toX(r.time).toFixed(1)},${toY(r.tempC).toFixed(1)}`).join(" ");
  const firstR = readings[0];
  const lastR = readings[readings.length - 1];
  const areaPts =
    readings.length >= 2 && firstR && lastR
      ? `${linePts} ${toX(lastR.time).toFixed(1)},${CHART_H} ${toX(firstR.time).toFixed(1)},${CHART_H}`
      : "";

  // Y-axis ticks
  const tickStep = tempRange <= 4 ? 1 : tempRange <= 8 ? 2 : 5;
  const firstTick = Math.ceil(minTemp / tickStep) * tickStep;
  const yTicks: number[] = [];
  for (let t = firstTick; t <= maxTemp; t += tickStep) yTicks.push(t);

  // X-axis labels
  const xLabels = [0, 6, 12, 18, 24].map((h) => ({
    label: h === 0 ? "-24h" : h === 24 ? "now" : `${h}h`,
    pct: (h / 24) * 100,
  }));

  // Line color based on current (or mean) temp
  const meanTempC = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : 20;
  const displayTempC = currentTempC ?? meanTempC;
  const lineColor = tempToColor(displayTempC, 1);

  function fmtTemp(tempC: number): string {
    if (unit === "fahrenheit") return `${Math.round(tempC * 9 / 5 + 32)}°F`;
    return `${Math.round(tempC)}°C`;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[50vw] rounded-2xl p-8 mx-auto"
        style={{ backgroundColor: "#1a2744" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, fill: lineColor, flexShrink: 0 }} aria-hidden="true">
              <path d="M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0zm-3 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
            </svg>
            <div>
              <span className="text-2xl font-semibold text-white">{name}</span>
              <span className="block text-sm text-white/50">Last 24 hours</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {currentTempC !== null && (
              <span
                className="px-3 py-1 rounded-full text-sm font-bold"
                style={{
                  backgroundColor: `${lineColor}33`,
                  color: lineColor,
                  border: `1px solid ${lineColor}66`,
                }}
              >
                {fmtTemp(currentTempC)}
              </span>
            )}
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white/80 transition-colors text-3xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ height: 160 }}>
            <span className="text-sm text-gray-400">Loading…</span>
          </div>
        ) : readings.length < 2 ? (
          <div className="flex items-center justify-center" style={{ height: 160 }}>
            <span className="text-sm text-gray-500">No data available</span>
          </div>
        ) : (
          <div className="flex">
            {/* Y-axis labels — CSS, outside SVG */}
            <div
              className="shrink-0 flex flex-col justify-between items-end pr-2"
              style={{ width: 40, height: CHART_H + 20 }}
            >
              {[...yTicks].reverse().map((tick) => (
                <span
                  key={tick}
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.4)",
                    fontFamily: "system-ui, sans-serif",
                    lineHeight: 1,
                  }}
                >
                  {fmtTemp(tick)}
                </span>
              ))}
            </div>

            {/* SVG + X-axis labels */}
            <div className="flex-1 flex flex-col">
              <svg
                width="100%"
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                preserveAspectRatio="none"
                style={{ display: "block", height: CHART_H }}
              >
                {/* Grid lines */}
                {yTicks.map((tick) => (
                  <line
                    key={tick}
                    x1={0} y1={toY(tick)}
                    x2={CHART_W} y2={toY(tick)}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="1"
                  />
                ))}

                {/* Area fill */}
                {areaPts && (
                  <polygon points={areaPts} fill={lineColor} opacity="0.15" />
                )}

                {/* Temperature line */}
                {linePts && (
                  <polyline
                    points={linePts}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
              </svg>

              {/* X-axis labels */}
              <div className="relative" style={{ height: 20 }}>
                {xLabels.map(({ label, pct }) => (
                  <div
                    key={label}
                    style={{
                      position: "absolute",
                      left: `${pct}%`,
                      transform: "translateX(-50%)",
                      fontSize: 11,
                      color: "rgba(255,255,255,0.4)",
                      fontFamily: "system-ui, sans-serif",
                      lineHeight: "20px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Main Hotspot Renderer ────────────────────────────────────────────────────

export function TemperatureGaugeHotspot({ hotspot, entityState, ruleResult, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as TemperatureGaugeConfig;
  const isVisible = useHeatmapStore((s) => s.isVisible);
  const toggle = useHeatmapStore((s) => s.toggle);
  const [showHistory, setShowHistory] = useState(false);

  const rawState = entityState?.state ?? "";
  const tempValue = parseFloat(rawState);
  const isValidTemp = !isNaN(tempValue);

  const displayTemp = isValidTemp
    ? `${Math.round(tempValue)}°${config.unit === "fahrenheit" ? "F" : "C"}`
    : "—";

  const tempC = config.unit === "fahrenheit" && isValidTemp ? (tempValue - 32) * (5 / 9) : tempValue;
  const ringColor = isValidTemp ? tempToColor(tempC, 1) : "#6b7280";

  const stateStyle = ruleResult?.styleOverrides ?? {};
  const opacity = stateStyle.opacity ?? 1;
  const displayMode = config.displayMode ?? "full";
  const label = ruleResult?.textOverride ?? displayTemp;

  const isUnavailable = hotspot.entityId !== null && entityState?.state === "unavailable";

  const handleClick = (e: React.MouseEvent) => {
    if (isEditMode) return;
    e.stopPropagation();
    if (isVisible && hotspot.entityId) {
      setShowHistory(true);
    } else {
      toggle(hotspot.zIndex);
    }
  };

  // ── Minimal mode — temperature text only, visible only when heatmap is active
  if (displayMode === "minimal") {
    if (!isVisible && !isEditMode) return null;
    const textColor = config.textColor ?? stateStyle.color ?? ringColor;
    return (
      <>
        <button
          type="button"
          className="flex h-full w-full items-center justify-center focus:outline-none"
          onClick={handleClick}
          aria-label={`${hotspot.name}: ${isUnavailable ? "unavailable" : displayTemp}`}
          style={{ opacity, cursor: isEditMode ? "default" : "pointer", containerType: "size", position: "relative" }}
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
          {isUnavailable && <UnavailableX />}
        </button>
        {showHistory && hotspot.entityId && (
          <TempHistoryModal
            entityId={hotspot.entityId}
            name={hotspot.name}
            unit={config.unit}
            currentTempC={isValidTemp ? tempC : null}
            onClose={() => setShowHistory(false)}
          />
        )}
      </>
    );
  }

  // ── Full mode — circular badge with icon and colour ring ───────────────────
  const textColor = config.textColor ?? stateStyle.color ?? "#ffffff";
  return (
    <>
      <button
        type="button"
        className="flex h-full w-full items-center justify-center focus:outline-none"
        onClick={handleClick}
        aria-label={`${hotspot.name}: ${isUnavailable ? "unavailable" : displayTemp}`}
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

          {isUnavailable && <UnavailableX />}
        </div>
      </button>
      {showHistory && hotspot.entityId && (
        <TempHistoryModal
          entityId={hotspot.entityId}
          name={hotspot.name}
          unit={config.unit}
          currentTempC={isValidTemp ? tempC : null}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function UnavailableX() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <line x1="20" y1="20" x2="80" y2="80" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
      <line x1="80" y1="20" x2="20" y2="80" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

/** Colour stops for the temperature scale (in °C). */
export const TEMP_STOPS: Array<{ temp: number; r: number; g: number; b: number }> = [
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
