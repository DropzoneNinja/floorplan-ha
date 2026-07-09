import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { TemperatureGaugeConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { useHeatmapStore } from "../../store/heatmap.ts";
import { useEntityStateStore } from "../../store/entity-states.ts";
import { api } from "../../api/client.ts";

/**
 * Temperature gauge hotspot.
 *
 * Renders a circular badge showing the current temperature (or humidity, when
 * the floorplan-wide display metric is switched) from the linked HA entity.
 * Clicking toggles the heatmap overlay (unless in edit mode).
 *
 * One gauge should be marked `isOutside: true` to represent the exterior sensor.
 * All others are treated as interior gauges whose positions drive the radial
 * heatmap gradients.
 *
 * When the heatmap is active, clicking a gauge opens a 24-hour history dialog
 * for whichever metric (temperature or humidity) is currently displayed.
 * The full-mode badge also shows a temperature/humidity rocker switch that
 * changes the metric for every gauge on the floorplan.
 */

// ─── Icon paths ──────────────────────────────────────────────────────────────

const THERMOMETER_ICON_PATH = "M15 13V5a3 3 0 0 0-6 0v8a5 5 0 1 0 6 0zm-3 7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z";
const DROPLET_ICON_PATH = "M12,20A6,6 0 0,1 6,14C6,10 12,3.25 12,3.25C12,3.25 18,10 18,14A6,6 0 0,1 12,20Z";

// ─── Date helper ─────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Temperature History Modal ────────────────────────────────────────────────

interface TempHistoryModalProps {
  entityId: string;
  name: string;
  metric: "temperature" | "humidity";
  unit: "celsius" | "fahrenheit";
  currentValue: number | null;
  onClose: () => void;
}

function TempHistoryModal({ entityId, name, metric, unit, currentValue, onClose }: TempHistoryModalProps) {
  const isHumidity = metric === "humidity";
  const today = isoDate(new Date());
  const yesterday = isoDate(new Date(Date.now() - 86_400_000));

  const { data, isLoading } = useQuery({
    queryKey: ["entity-history-24h", metric, entityId],
    queryFn: () => api.ha.historyRange(entityId, yesterday, today),
    staleTime: 5 * 60 * 1000,
  });

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  const readings = (data?.readings ?? [])
    .filter((r) => new Date(r.time).getTime() >= cutoff)
    .map((r) => ({
      time: new Date(r.time).getTime(),
      value: !isHumidity && unit === "fahrenheit" ? (r.value - 32) * (5 / 9) : r.value,
    }));

  // Chart constants
  const CHART_W = 460;
  const CHART_H = 180;
  const PAD_T = 8;
  const PAD_B = 10;
  const plotH = CHART_H - PAD_T - PAD_B;

  const values = readings.map((r) => r.value);
  const rawMin = values.length ? Math.min(...values) : isHumidity ? 30 : 15;
  const rawMax = values.length ? Math.max(...values) : isHumidity ? 60 : 25;
  const minVal = isHumidity ? Math.max(0, rawMin - 2) : rawMin - 2;
  const maxVal = isHumidity ? Math.min(100, rawMax + 2) : rawMax + 2;
  const valRange = maxVal - minVal || 1;

  const xStart = cutoff;
  const xRange = 86_400_000;

  function toX(ms: number): number {
    return ((ms - xStart) / xRange) * CHART_W;
  }

  function toY(value: number): number {
    return PAD_T + plotH - ((value - minVal) / valRange) * plotH;
  }

  const linePts = readings.map((r) => `${toX(r.time).toFixed(1)},${toY(r.value).toFixed(1)}`).join(" ");
  const firstR = readings[0];
  const lastR = readings[readings.length - 1];
  const areaPts =
    readings.length >= 2 && firstR && lastR
      ? `${linePts} ${toX(lastR.time).toFixed(1)},${CHART_H - PAD_B} ${toX(firstR.time).toFixed(1)},${CHART_H - PAD_B}`
      : "";

  // Y-axis ticks
  const tickStep = valRange <= 4 ? 1 : valRange <= 8 ? 2 : 5;
  const firstTick = Math.ceil(minVal / tickStep) * tickStep;
  const yTicks: number[] = [];
  for (let t = firstTick; t <= maxVal; t += tickStep) yTicks.push(t);

  // X-axis: labels at 12am/6am/12pm/6pm, minor ticks every hour — all at actual clock positions
  const HOUR_LABEL: Record<number, string> = { 0: "12am", 6: "6am", 12: "12pm", 18: "6pm" };
  const firstHourMs = Math.ceil(cutoff / 3_600_000) * 3_600_000;
  const xTicks: Array<{ pct: number; isMajor: boolean }> = [];
  const xLabels: Array<{ label: string; pct: number }> = [];
  for (let t = firstHourMs; t <= cutoff + xRange; t += 3_600_000) {
    const pct = (t - cutoff) / xRange * 100;
    const h = new Date(t).getHours();
    const isMajor = h % 6 === 0;
    xTicks.push({ pct, isMajor });
    if (isMajor) xLabels.push({ label: HOUR_LABEL[h] ?? "", pct });
  }

  // Line color based on current (or mean) value
  const meanVal = values.length ? values.reduce((a, b) => a + b, 0) / values.length : isHumidity ? 45 : 20;
  const displayVal = currentValue ?? meanVal;
  const lineColor = isHumidity ? humidityToColor(displayVal, 1) : tempToColor(displayVal, 1);

  function fmtValue(value: number): string {
    if (isHumidity) return `${Math.round(value)}%`;
    if (unit === "fahrenheit") return `${Math.round(value * 9 / 5 + 32)}°F`;
    return `${Math.round(value)}°C`;
  }

  function fmtTime(ms: number): string {
    const d = new Date(ms);
    const h = d.getHours();
    const m = d.getMinutes();
    const base = h === 0 || h === 12 ? "12" : h < 12 ? String(h) : String(h - 12);
    const suffix = h < 12 ? "am" : "pm";
    return m === 0 ? `${base}${suffix}` : `${base}:${String(m).padStart(2, "0")}${suffix}`;
  }

  const maxReading = readings.length > 0
    ? readings.reduce((best, r) => r.value > best.value ? r : best)
    : null;
  const minReading = readings.length > 0
    ? readings.reduce((best, r) => r.value < best.value ? r : best)
    : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-[75vw] rounded-2xl p-12 mx-auto"
        style={{ backgroundColor: "#1a2744" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-9">
          <div className="flex items-center gap-5">
            <svg viewBox="0 0 24 24" style={{ width: 48, height: 48, fill: lineColor, flexShrink: 0 }} aria-hidden="true">
              <path d={isHumidity ? DROPLET_ICON_PATH : THERMOMETER_ICON_PATH} />
            </svg>
            <div>
              <span className="text-4xl font-semibold text-white">{name}</span>
              <span className="block text-xl text-white/50">
                {isHumidity ? "Humidity" : "Temperature"} · Last 24 hours
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="text-white/50 hover:text-white/80 transition-colors text-5xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ height: 240 }}>
            <span className="text-xl text-gray-400">Loading…</span>
          </div>
        ) : readings.length < 2 ? (
          <div className="flex items-center justify-center" style={{ height: 240 }}>
            <span className="text-xl text-gray-500">No data available</span>
          </div>
        ) : (
          <div className="flex gap-6 items-start">
            {/* Chart: Y-axis + SVG + X-labels */}
            <div className="flex flex-1 min-w-0">
            {/* Y-axis labels — CSS, outside SVG */}
            <div
              className="shrink-0 flex flex-col justify-between items-end pr-2"
              style={{ width: 60, height: CHART_H + 30 }}
            >
              {[...yTicks].reverse().map((tick) => (
                <span
                  key={tick}
                  style={{
                    fontSize: 17,
                    color: "rgba(255,255,255,0.4)",
                    fontFamily: "system-ui, sans-serif",
                    lineHeight: 1,
                  }}
                >
                  {fmtValue(tick)}
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

                {/* X-axis baseline */}
                <line
                  x1={0} y1={CHART_H - PAD_B}
                  x2={CHART_W} y2={CHART_H - PAD_B}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1"
                />

                {/* Hourly tick marks — minor every 1h, major at 12/6 clock boundaries */}
                {xTicks.map(({ pct, isMajor }) => {
                  const x = (pct / 100) * CHART_W;
                  return (
                    <line
                      key={pct}
                      x1={x} y1={CHART_H - PAD_B}
                      x2={x} y2={CHART_H - PAD_B + (isMajor ? 8 : 4)}
                      stroke={isMajor ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)"}
                      strokeWidth="1"
                    />
                  );
                })}
              </svg>

              {/* X-axis labels */}
              <div className="relative" style={{ height: 30 }}>
                {xLabels.map(({ label, pct }) => (
                  <div
                    key={label}
                    style={{
                      position: "absolute",
                      left: `${pct}%`,
                      transform: pct < 5 ? "translateX(0)" : pct > 95 ? "translateX(-100%)" : "translateX(-50%)",
                      fontSize: 17,
                      color: "rgba(255,255,255,0.4)",
                      fontFamily: "system-ui, sans-serif",
                      lineHeight: "30px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
            </div>{/* end chart wrapper */}

            {/* Stats box */}
            <div
              className="shrink-0 rounded-xl flex flex-col p-5"
              style={{
                width: 220,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                gap: 0,
              }}
            >
              {/* Current */}
              <div className="flex flex-col" style={{ paddingBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Current</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: lineColor, lineHeight: 1 }}>{currentValue !== null ? fmtValue(currentValue) : "—"}</span>
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }} />
              {/* High */}
              <div className="flex flex-col" style={{ paddingBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>High</span>
                <div className="flex items-baseline gap-2">
                  <span style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", lineHeight: 1 }}>{maxReading ? fmtValue(maxReading.value) : "—"}</span>
                  {maxReading && <span style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>at {fmtTime(maxReading.time)}</span>}
                </div>
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }} />
              {/* Low */}
              <div className="flex flex-col">
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>Low</span>
                <div className="flex items-baseline gap-2">
                  <span style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", lineHeight: 1 }}>{minReading ? fmtValue(minReading.value) : "—"}</span>
                  {minReading && <span style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>at {fmtTime(minReading.time)}</span>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Metric Switch (rocker) ────────────────────────────────────────────────────

const METRIC_SWITCH_SEGMENTS = [
  { metric: "temperature" as const, path: THERMOMETER_ICON_PATH, title: "Show temperature" },
  { metric: "humidity" as const, path: DROPLET_ICON_PATH, title: "Show humidity" },
];

/**
 * Two-position rocker switch shown on full-mode gauges. Selecting a side
 * changes the display metric for every temperature gauge on the floorplan.
 */
function MetricSwitch({
  metric,
  onSelect,
}: {
  metric: "temperature" | "humidity";
  onSelect: (metric: "temperature" | "humidity") => void;
}) {
  return (
    <div
      className="flex shrink-0 overflow-hidden rounded-full"
      style={{ border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(15,23,42,0.9)" }}
    >
      {METRIC_SWITCH_SEGMENTS.map((seg) => {
        const active = metric === seg.metric;
        return (
          <button
            key={seg.metric}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(seg.metric);
            }}
            aria-pressed={active}
            title={seg.title}
            className="flex items-center justify-center transition-colors"
            style={{
              width: "34cqmin",
              height: "28cqmin",
              minWidth: 30,
              minHeight: 26,
              background: active ? "rgba(255,255,255,0.22)" : "transparent",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              style={{ width: "65%", height: "65%", fill: active ? "#ffffff" : "rgba(255,255,255,0.4)" }}
              aria-hidden="true"
            >
              <path d={seg.path} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Hotspot Renderer ────────────────────────────────────────────────────

export function TemperatureGaugeHotspot({ hotspot, entityState, ruleResult, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as TemperatureGaugeConfig;
  const isVisible = useHeatmapStore((s) => s.isVisible);
  const toggle = useHeatmapStore((s) => s.toggle);
  const metric = useHeatmapStore((s) => s.metric);
  const setMetric = useHeatmapStore((s) => s.setMetric);
  const [showHistory, setShowHistory] = useState(false);

  const humidityEntityId = config.humidityEntityId ?? null;
  const humidityState = useEntityStateStore((s) => (humidityEntityId ? s.getState(humidityEntityId) : undefined));

  const rawState = entityState?.state ?? "";
  const tempValue = parseFloat(rawState);
  const isValidTemp = !isNaN(tempValue);

  const displayTemp = isValidTemp
    ? `${Math.round(tempValue)}°${config.unit === "fahrenheit" ? "F" : "C"}`
    : "—";

  const tempC = config.unit === "fahrenheit" && isValidTemp ? (tempValue - 32) * (5 / 9) : tempValue;
  const tempColor = isValidTemp ? tempToColor(tempC, 1) : "#6b7280";

  const humidityValue = parseFloat(humidityState?.state ?? "");
  const isValidHumidity = humidityEntityId !== null && !isNaN(humidityValue);
  const displayHumidity = isValidHumidity ? `${Math.round(humidityValue)}%` : "—";
  const humidityColor = isValidHumidity ? humidityToColor(humidityValue, 1) : "#6b7280";

  const showHumidity = metric === "humidity";
  const displayValue = showHumidity ? displayHumidity : displayTemp;
  const ringColor = showHumidity ? humidityColor : tempColor;

  const stateStyle = ruleResult?.styleOverrides ?? {};
  const opacity = stateStyle.opacity ?? 1;
  const displayMode = config.displayMode ?? "full";
  const label = ruleResult?.textOverride ?? displayValue;

  const activeEntityId = showHumidity ? humidityEntityId : hotspot.entityId;
  const activeState = showHumidity ? humidityState : entityState;
  const isUnavailable = activeEntityId !== null && activeState?.state === "unavailable";

  const performTap = useCallback(() => {
    if (isVisible && activeEntityId) {
      setShowHistory(true);
    } else {
      toggle(hotspot.zIndex);
    }
  }, [isVisible, activeEntityId, hotspot.zIndex, toggle]);

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (isEditMode) return;
    e.stopPropagation();
    performTap();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditMode) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e);
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
          aria-label={`${hotspot.name}: ${isUnavailable ? "unavailable" : displayValue}`}
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
        {showHistory && activeEntityId && (
          <TempHistoryModal
            entityId={activeEntityId}
            name={hotspot.name}
            metric={metric}
            unit={config.unit}
            currentValue={showHumidity ? (isValidHumidity ? humidityValue : null) : (isValidTemp ? tempC : null)}
            onClose={() => setShowHistory(false)}
          />
        )}
      </>
    );
  }

  // ── Full mode — circular badge with icon, colour ring, and metric switch ───
  const textColor = config.textColor ?? stateStyle.color ?? "#ffffff";
  return (
    <>
      <div
        role="button"
        tabIndex={isEditMode ? -1 : 0}
        className="flex h-full w-full items-center justify-center focus:outline-none"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={`${hotspot.name}: ${isUnavailable ? "unavailable" : displayValue}`}
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
          {/* Thermometer / droplet icon */}
          <svg
            viewBox="0 0 24 24"
            className="mb-0.5"
            style={{ width: "28cqmin", height: "28cqmin", fill: ringColor, flexShrink: 0 }}
            aria-hidden="true"
          >
            <path d={showHumidity ? DROPLET_ICON_PATH : THERMOMETER_ICON_PATH} />
          </svg>

          {/* Temperature / humidity value */}
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

          {/* Temperature/humidity rocker switch — sits below the badge, not inside it */}
          {!isEditMode && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                marginTop: "6cqmin",
              }}
            >
              <MetricSwitch metric={metric} onSelect={setMetric} />
            </div>
          )}

          {/* Active pulse ring for indoor gauges when heatmap is visible */}
          {isVisible && !config.isOutside && (
            <span
              className="absolute inset-0 rounded-full animate-ping"
              style={{
                border: `2px solid ${ringColor}`,
                opacity: 0.4,
                pointerEvents: "none",
              }}
            />
          )}

          {isUnavailable && <UnavailableX />}
        </div>
      </div>
      {showHistory && activeEntityId && (
        <TempHistoryModal
          entityId={activeEntityId}
          name={hotspot.name}
          metric={metric}
          unit={config.unit}
          currentValue={showHumidity ? (isValidHumidity ? humidityValue : null) : (isValidTemp ? tempC : null)}
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

/** Colour stops for the relative-humidity scale (in %RH), dry → humid. */
export const HUMIDITY_STOPS: Array<{ humidity: number; r: number; g: number; b: number }> = [
  { humidity: 20, r: 217, g: 119, b: 6   }, // amber — dry
  { humidity: 35, r: 163, g: 183, b: 31  }, // yellow-green
  { humidity: 50, r: 76,  g: 175, b: 80  }, // green — comfortable
  { humidity: 65, r: 0,   g: 188, b: 212 }, // cyan
  { humidity: 85, r: 33,  g: 150, b: 243 }, // blue — humid
];

/**
 * Maps a relative-humidity percentage to an rgba colour string by
 * interpolating between the defined humidity colour stops.
 */
export function humidityToColor(humidity: number, alpha: number): string {
  const first = HUMIDITY_STOPS[0];
  const last = HUMIDITY_STOPS[HUMIDITY_STOPS.length - 1];
  if (!first || !last) return `rgba(128,128,128,${alpha})`;

  if (humidity <= first.humidity) return `rgba(${first.r},${first.g},${first.b},${alpha})`;
  if (humidity >= last.humidity) return `rgba(${last.r},${last.g},${last.b},${alpha})`;

  for (let i = 0; i < HUMIDITY_STOPS.length - 1; i++) {
    const lo = HUMIDITY_STOPS[i]!;
    const hi = HUMIDITY_STOPS[i + 1]!;
    if (humidity >= lo.humidity && humidity <= hi.humidity) {
      const t = (humidity - lo.humidity) / (hi.humidity - lo.humidity);
      const r = Math.round(lo.r + t * (hi.r - lo.r));
      const g = Math.round(lo.g + t * (hi.g - lo.g));
      const b = Math.round(lo.b + t * (hi.b - lo.b));
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  return `rgba(128,128,128,${alpha})`;
}
