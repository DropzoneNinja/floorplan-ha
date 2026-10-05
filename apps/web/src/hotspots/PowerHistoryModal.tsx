import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { PowerSensor } from "@floorplan-ha/shared";
import { api } from "../api/client.ts";
import { ICON_PATHS } from "./icons.ts";
import { fmtWatts, powerToColor } from "./power-utils.ts";

/**
 * Usage history for one power sensor: daily bars for the last 14 days, weekly
 * bars for the last 3 months, and monthly bars for the last year.
 *
 * Usage comes from HA long-term statistics, so it survives the history purge.
 * Power sensors (W/kW) store a mean wattage per period, which is converted to
 * energy using the hours covered. Energy sensors (kWh/Wh) store a running total,
 * and each bar is the change over its period.
 */

type Range = "days" | "weeks" | "months";
type Period = "day" | "week" | "month";

const RANGES: Array<{ key: Range; label: string; period: Period; heading: string }> = [
  { key: "days", label: "14 days", period: "day", heading: "Daily usage · last 14 days" },
  { key: "weeks", label: "3 months", period: "week", heading: "Weekly usage · last 3 months" },
  { key: "months", label: "1 year", period: "month", heading: "Monthly usage · last 12 months" },
];

const BUCKET_COUNT: Record<Range, number> = { days: 14, weeks: 13, months: 12 };

/** Half a period, used to match a statistic's start time to its bar. */
const HALF_PERIOD_MS: Record<Period, number> = {
  day: 12 * 3_600_000,
  week: 3.5 * 86_400_000,
  month: 15 * 86_400_000,
};

const PLOT_H = 260;
const LABEL_H = 52;

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addPeriod(d: Date, period: Period): Date {
  if (period === "day") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  if (period === "week") return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

interface Bucket {
  start: Date;
  /** Main axis label, e.g. "4" or "Oct" */
  label: string;
  /** Second row under the label (weekday, month or year), or null when not needed */
  sublabel: string | null;
  /** Full description shown on hover and focus */
  tooltip: string;
}

/** Oldest first. The last bucket is the current day, week or month. */
function buildBuckets(range: Range, now: Date): Bucket[] {
  const count = BUCKET_COUNT[range];
  const y = now.getFullYear();
  const m = now.getMonth();
  const date = now.getDate();
  const mondayOffset = (now.getDay() + 6) % 7;
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(undefined, opts);

  return Array.from({ length: count }, (_, i) => {
    const back = count - 1 - i;

    if (range === "days") {
      const d = new Date(y, m, date - back);
      return {
        start: d,
        label: String(d.getDate()),
        sublabel: fmt(d, { weekday: "narrow" }),
        tooltip: fmt(d, { weekday: "short", day: "numeric", month: "short" }),
      };
    }

    if (range === "weeks") {
      const d = new Date(y, m, date - mondayOffset - 7 * back);
      const prev = new Date(y, m, date - mondayOffset - 7 * (back + 1));
      const monthChanged = i === 0 || prev.getMonth() !== d.getMonth();
      return {
        start: d,
        label: String(d.getDate()),
        sublabel: monthChanged ? fmt(d, { month: "short" }) : null,
        tooltip: `Week of ${fmt(d, { day: "numeric", month: "short" })}`,
      };
    }

    const d = new Date(y, m - back, 1);
    return {
      start: d,
      label: fmt(d, { month: "short" }),
      sublabel: i === 0 || d.getMonth() === 0 ? String(d.getFullYear()) : null,
      tooltip: fmt(d, { month: "short", year: "numeric" }),
    };
  });
}

// ─── Usage calculation ────────────────────────────────────────────────────────

type SensorKind = "power" | "energy";

/** Classifies a sensor by its unit. Null means the sensor can't give usage history. */
function sensorKind(unit: string | undefined): SensorKind | null {
  if (unit === "W" || unit === "kW") return "power";
  if (unit === "kWh" || unit === "Wh") return "energy";
  return null;
}

interface StatRow {
  start: number;
  mean: number | null;
  change: number | null;
}

/** Index of the bucket whose start is closest to `ms`, or -1 if none is within half a period. */
function nearestBucket(ms: number, starts: number[], halfPeriodMs: number): number {
  let best = -1;
  let bestDiff = Infinity;
  starts.forEach((s, i) => {
    const diff = Math.abs(s - ms);
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  });
  return bestDiff <= halfPeriodMs ? best : -1;
}

/** Energy in kWh for each bucket, or null where the bucket has no data. */
function usageKwh(
  stats: StatRow[],
  buckets: Bucket[],
  period: Period,
  kind: SensorKind,
  unit: string,
  now: Date,
): Array<number | null> {
  const starts = buckets.map((b) => b.start.getTime());
  const values: Array<number | null> = buckets.map(() => null);

  for (const stat of stats) {
    const i = nearestBucket(stat.start, starts, HALF_PERIOD_MS[period]);
    if (i < 0) continue;

    if (kind === "energy") {
      if (stat.change === null) continue;
      values[i] = unit === "Wh" ? stat.change / 1000 : stat.change;
      continue;
    }

    // Power: mean watts over the covered part of the bucket × hours = Wh.
    if (stat.mean === null) continue;
    const bucketStart = buckets[i]!.start;
    const bucketEnd = buckets[i + 1]?.start ?? addPeriod(bucketStart, period);
    const hours = (Math.min(bucketEnd.getTime(), now.getTime()) - bucketStart.getTime()) / 3_600_000;
    if (hours <= 0) continue;
    const meanWatts = unit === "kW" ? stat.mean * 1000 : stat.mean;
    values[i] = (meanWatts * hours) / 1000;
  }

  return values;
}

/** Rounds an axis maximum up to a clean value: 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10 × 10ⁿ. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (step * magnitude >= value) return step * magnitude;
  }
  return 10 * magnitude;
}

function fmtKwh(value: number): string {
  return String(value >= 100 ? Math.round(value) : Math.round(value * 10) / 10);
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface PowerHistoryModalProps {
  sensor: PowerSensor;
  /** Unit the sensor reports, e.g. "W", "kW", "kWh". */
  unit: string | undefined;
  /** Live draw in watts, or null when unavailable. */
  currentWatts: number | null;
  onClose: () => void;
}

export function PowerHistoryModal({ sensor, unit, currentWatts, onClose }: PowerHistoryModalProps) {
  const [range, setRange] = useState<Range>("days");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const now = new Date();
  const rangeDef = RANGES.find((r) => r.key === range)!;
  const kind = sensorKind(unit);
  const buckets = buildBuckets(range, now);

  const { data, isLoading } = useQuery({
    queryKey: ["power-usage", sensor.entityId, range, isoDate(now)],
    queryFn: () =>
      api.ha.statistics(
        sensor.entityId,
        `${isoDate(buckets[0]!.start)}T00:00:00`,
        `${isoDate(now)}T23:59:59`,
        rangeDef.period,
        "mean,change",
      ),
    enabled: kind !== null,
    staleTime: 5 * 60 * 1000,
  });

  const values =
    kind === null
      ? null
      : usageKwh(data?.statistics ?? [], buckets, rangeDef.period, kind, unit ?? "", now);

  const present = (values ?? []).filter((v): v is number => v !== null);
  const hasData = present.length > 0;
  const total = present.reduce((sum, v) => sum + v, 0);

  let peakIdx = -1;
  let peak = 0;
  (values ?? []).forEach((v, i) => {
    if (v !== null && v > peak) {
      peak = v;
      peakIdx = i;
    }
  });
  const axisMax = niceMax(peak);
  const peakBucket = peakIdx >= 0 ? buckets[peakIdx] : undefined;

  const accent = currentWatts !== null ? powerToColor(currentWatts, 1) : "#60a5fa";
  const hovered = hoverIdx !== null && values?.[hoverIdx] != null ? hoverIdx : null;

  function renderChart() {
    const count = buckets.length;
    return (
      <div className="flex gap-6 items-start">
        <div className="flex flex-1 min-w-0" style={{ height: PLOT_H + LABEL_H }}>
          {/* Y-axis labels */}
          <div className="relative shrink-0" style={{ width: 64, height: PLOT_H }}>
            {[0, 0.5, 1].map((f) => (
              <span
                key={f}
                className="absolute right-2"
                style={{
                  bottom: f * PLOT_H,
                  transform: "translateY(50%)",
                  fontSize: 17,
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "system-ui, sans-serif",
                  lineHeight: 1,
                }}
              >
                {fmtKwh(axisMax * f)}
              </span>
            ))}
          </div>

          {/* Plot: gridlines, bars, labels */}
          <div className="relative flex-1 min-w-0" style={{ height: PLOT_H + LABEL_H }}>
            {[0, 0.5, 1].map((f) => (
              <div
                key={f}
                className="absolute inset-x-0"
                style={{
                  top: PLOT_H - f * PLOT_H,
                  borderTop: f === 0 ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(255,255,255,0.08)",
                }}
              />
            ))}

            <div className="absolute inset-x-0 top-0 flex items-end" style={{ height: PLOT_H }}>
              {buckets.map((bucket, i) => {
                const value = values?.[i] ?? null;
                const pct = value !== null ? (value / axisMax) * 100 : 0;
                const isHovered = hovered === i;
                const isDimmed = hovered !== null && !isHovered;
                return (
                  <div
                    key={bucket.start.getTime()}
                    className="relative flex h-full flex-1 items-end justify-center outline-none"
                    tabIndex={value !== null ? 0 : -1}
                    aria-label={value !== null ? `${bucket.tooltip}: ${fmtKwh(value)} kWh` : `${bucket.tooltip}: no data`}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    onFocus={() => setHoverIdx(i)}
                    onBlur={() => setHoverIdx(null)}
                  >
                    {value !== null && (
                      <div
                        style={{
                          width: "60%",
                          maxWidth: 24,
                          height: `${pct}%`,
                          minHeight: value > 0 ? 3 : 0,
                          background: accent,
                          borderRadius: "4px 4px 0 0",
                          opacity: isDimmed ? 0.55 : 1,
                          transition: "opacity 0.15s",
                        }}
                      />
                    )}

                    {/* Value on the peak bar only: label selectively */}
                    {i === peakIdx && value !== null && !isHovered && (
                      <span
                        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap"
                        style={{ bottom: `calc(${pct}% + 6px)`, fontSize: 17, fontWeight: 600, color: "#ffffff" }}
                      >
                        {fmtKwh(value)}
                      </span>
                    )}

                    {/* Hover tooltip */}
                    {isHovered && value !== null && (
                      <div
                        className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg px-3 py-2"
                        style={{
                          bottom: `calc(${pct}% + 10px)`,
                          background: "rgba(15,23,42,0.95)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          zIndex: 1,
                        }}
                      >
                        <span className="block text-xl font-semibold text-white">{fmtKwh(value)} kWh</span>
                        <span className="block text-base text-white/50">{bucket.tooltip}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bar labels */}
            <div className="absolute inset-x-0 flex" style={{ top: PLOT_H, height: LABEL_H }}>
              {buckets.map((bucket, i) => (
                <div
                  key={`label-${bucket.start.getTime()}`}
                  className="flex flex-1 flex-col items-center justify-start overflow-visible text-center"
                  style={{ color: hovered === i ? "#ffffff" : "rgba(255,255,255,0.4)", fontFamily: "system-ui, sans-serif" }}
                >
                  <span style={{ fontSize: count > 13 ? 15 : 17, lineHeight: "26px", whiteSpace: "nowrap" }}>
                    {bucket.label}
                  </span>
                  {bucket.sublabel && (
                    <span style={{ fontSize: 14, lineHeight: "20px", whiteSpace: "nowrap", color: "rgba(255,255,255,0.3)" }}>
                      {bucket.sublabel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderBody() {
    if (kind === null) {
      return (
        <div className="flex items-center justify-center" style={{ height: PLOT_H + LABEL_H }}>
          <span className="max-w-[60ch] text-center text-xl text-gray-500">
            This sensor reports {unit ? `"${unit}"` : "no unit"}. Usage history needs a power (W or kW) or energy (kWh or Wh) sensor.
          </span>
        </div>
      );
    }
    if (isLoading) {
      return (
        <div className="flex items-center justify-center" style={{ height: PLOT_H + LABEL_H }}>
          <span className="text-xl text-gray-400">Loading…</span>
        </div>
      );
    }
    if (!hasData) {
      return (
        <div className="flex items-center justify-center" style={{ height: PLOT_H + LABEL_H }}>
          <span className="max-w-[60ch] text-center text-xl text-gray-500">
            No usage recorded for this period. HA only keeps long-term statistics for sensors with a state class.
          </span>
        </div>
      );
    }
    return renderChart();
  }

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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <svg viewBox="0 0 24 24" style={{ width: 48, height: 48, fill: accent, flexShrink: 0 }} aria-hidden="true">
              <path d={ICON_PATHS["mdi:lightning-bolt"] ?? ICON_PATHS["default"]} />
            </svg>
            <div>
              <span className="text-4xl font-semibold text-white">{sensor.name}</span>
              <span className="block text-xl text-white/50">{rangeDef.heading}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/50 hover:text-white/80 transition-colors text-5xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Range tabs */}
        <div className="flex gap-3 mb-8" role="group" aria-label="Time range">
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setRange(r.key);
                  setHoverIdx(null);
                }}
                className="rounded-full px-6 py-2 text-xl transition-colors"
                style={{
                  background: active ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.05)",
                  color: active ? "#ffffff" : "rgba(255,255,255,0.5)",
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Chart + stats */}
        <div className="flex gap-6 items-start">
          <div className="flex-1 min-w-0">{renderBody()}</div>

          {kind !== null && hasData && (
            <div
              className="shrink-0 rounded-xl flex flex-col p-5"
              style={{
                width: 240,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <StatItem label="Now" value={currentWatts !== null ? fmtWatts(currentWatts) : "—"} />
              <Divider />
              <StatItem label="Total" value={`${fmtKwh(total)} kWh`} />
              <Divider />
              <StatItem
                label="Peak"
                value={peakBucket ? `${fmtKwh(peak)} kWh` : "—"}
                sub={peakBucket?.tooltip}
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function StatItem({ label, value, sub }: { label: string; value: string; sub?: string | undefined }) {
  return (
    <div className="flex flex-col" style={{ paddingBottom: 16 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
        {label}
      </span>
      <span style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{sub}</span>}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginBottom: 16 }} />;
}
