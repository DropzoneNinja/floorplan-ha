import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { RainRateConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { api } from "../../api/client.ts";
import { useEntityStateStore } from "../../store/entity-states.ts";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** ISO week number (Mon-based) */
function isoWeek(d: Date): number {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d.getTime() - startOfWeek1.getTime();
  return Math.floor(diff / (7 * 86400000)) + 1;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function RaindropIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C12 2 4 10 4 15a8 8 0 0 0 16 0C20 10 12 2 12 2z" />
    </svg>
  );
}

function CalendarDayIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <rect x="9" y="14" width="6" height="5" fill="currentColor" stroke="none" rx="1" />
    </svg>
  );
}

function CalendarMonthIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CalendarYearIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <text x="12" y="20" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none" fontWeight="bold">365</text>
    </svg>
  );
}

// ─── Labelled Sparkline ───────────────────────────────────────────────────────

interface Bar {
  value: number;
  label: string;
  labelColor?: string;
}

const BAR_W = 10; // SVG units per column (bars only — labels are CSS)
const BAR_H = 100;
const LABEL_H = 24;
const Y_AXIS_W = 38; // px — wide enough for "1286" at the axis font size
const Y_FONT = 10;  // px

function fmtYMax(v: number): string {
  if (v <= 0) return "0";
  if (v >= 10000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000)  return `${(v / 1000).toFixed(1)}k`;
  if (v >= 100)   return String(Math.round(v));
  if (v >= 10)    return v.toFixed(1);
  return v.toFixed(2);
}

const Y_LABEL_STYLE: React.CSSProperties = {
  fontSize: Y_FONT,
  color: "rgba(255,255,255,0.45)",
  fontFamily: "system-ui, sans-serif",
  lineHeight: 1,
  whiteSpace: "nowrap",
};

// Labels are rendered in a CSS flex row, NOT in the SVG, so they are
// never affected by preserveAspectRatio="none" horizontal stretching.
function LabelledSparkline({
  bars,
  color,
  labelFontSize = 13,
}: {
  bars: Bar[];
  color: string;
  labelFontSize?: number;
}) {
  const n = bars.length;

  if (n === 0) {
    return (
      <div className="flex flex-col">
        <div className="flex" style={{ height: BAR_H }}>
          <div className="shrink-0 flex flex-col justify-between items-end pr-1" style={{ width: Y_AXIS_W }}>
            <span style={Y_LABEL_STYLE}>—</span>
            <span style={Y_LABEL_STYLE}>0</span>
          </div>
          <div className="flex-1 flex items-end gap-px opacity-20">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex-1 rounded-sm" style={{ backgroundColor: color, height: "20%" }} />
            ))}
          </div>
        </div>
        <div style={{ height: LABEL_H }} />
      </div>
    );
  }

  const maxVal = Math.max(...bars.map((b) => b.value), 0.001);
  const hasData = bars.some((b) => b.value > 0);
  const viewW = n * BAR_W;
  const GAP = 1.5;

  return (
    <div className="flex flex-col">
      {/* Chart row: Y-axis + bars */}
      <div className="flex" style={{ height: BAR_H }}>
        {/* Y-axis: max label top, zero bottom */}
        <div
          className="shrink-0 flex flex-col justify-between items-end pr-1.5"
          style={{ width: Y_AXIS_W }}
        >
          <span style={Y_LABEL_STYLE}>{hasData ? fmtYMax(maxVal) : "—"}</span>
          <span style={Y_LABEL_STYLE}>0</span>
        </div>
        {/* Bars SVG — stretched horizontally, no text inside */}
        <svg className="flex-1" height={BAR_H} viewBox={`0 0 ${viewW} ${BAR_H}`} preserveAspectRatio="none">
          {bars.map((bar, i) => {
            const barH = Math.max(1, (bar.value / maxVal) * BAR_H);
            return (
              <rect
                key={i}
                x={i * BAR_W}
                y={BAR_H - barH}
                width={BAR_W - GAP}
                height={barH}
                rx="0.8"
                fill={color}
                opacity="0.85"
              />
            );
          })}
        </svg>
      </div>
      {/* X-axis label row — labels are absolutely positioned so they can overflow adjacent empty bars */}
      <div className="flex" style={{ height: LABEL_H }}>
        <div className="shrink-0" style={{ width: Y_AXIS_W }} />
        <div className="flex flex-1 relative">
          {bars.map((bar, i) => (
            <div key={i} style={{ flex: 1, minWidth: 0, position: "relative" }}>
              {bar.label && (
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: labelFontSize,
                    color: bar.labelColor ?? "rgba(255,255,255,0.65)",
                    fontFamily: "system-ui, sans-serif",
                    lineHeight: `${LABEL_H}px`,
                    whiteSpace: "nowrap",
                  }}
                >
                  {bar.label}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Per-metric sparkline fetchers ────────────────────────────────────────────

/** Hourly: 24 bars midnight→now, one per clock hour, label every 3rd hour */
function HourlySparkline({ entityId, color }: { entityId: string | null; color: string }) {
  const today = isoDate(new Date());
  const { data } = useQuery({
    queryKey: ["rain-hourly", entityId, today],
    queryFn: () => api.ha.history(entityId!, today),
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000,
  });
  // Last reading per hour (24 fixed slots 0–23)
  const byHour = new Map<number, number>();
  for (const r of data?.readings ?? []) {
    const h = new Date(r.time).getHours();
    byHour.set(h, r.value);
  }
  const bars: Bar[] = Array.from({ length: 24 }, (_, h) => ({
    value: byHour.get(h) ?? 0,
    label: h % 3 === 0 ? (h === 0 ? "0am" : h === 12 ? "12pm" : String(h)) : "",
  }));
  return <LabelledSparkline bars={bars} color={color} labelFontSize={12} />;
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/** Daily: last 14 days, label = first letter of weekday */
function DailySparkline({ entityId, color }: { entityId: string | null; color: string }) {
  const today = new Date();
  const start = isoDate(addDays(today, -13));
  const end = isoDate(today);
  const { data } = useQuery({
    queryKey: ["rain-daily", entityId, start],
    queryFn: () => api.ha.historyRange(entityId!, start, end),
    enabled: !!entityId,
    staleTime: 10 * 60 * 1000,
  });
  const byDay = new Map<string, number>();
  for (const r of data?.readings ?? []) {
    byDay.set(isoDate(new Date(r.time)), r.value);
  }
  const WEEK_COLORS = ["rgba(255,255,255,0.75)", "rgba(96,165,250,0.9)"];
  const bars: Bar[] = [];
  let weekColorIdx = 0;
  let lastWeekDay = -1;
  for (let i = 13; i >= 0; i--) {
    const d = addDays(today, -i);
    // Flip color on each Monday (start of calendar week)
    if (d.getDay() === 1 && lastWeekDay !== 1) weekColorIdx = (weekColorIdx + 1) % WEEK_COLORS.length;
    lastWeekDay = d.getDay();
    bars.push({
      value: byDay.get(isoDate(d)) ?? 0,
      label: DAY_LETTERS[d.getDay()] ?? "",
      labelColor: WEEK_COLORS[weekColorIdx]!,
    });
  }
  return <LabelledSparkline bars={bars} color={color} labelFontSize={13} />;
}

const MONTH_LETTERS = "JFMAMJJASOND";

/** Monthly: always 12 bars (oldest→newest), zero if no data. Label = first letter of month */
function MonthlySparkline({ entityId, color }: { entityId: string | null; color: string }) {
  const today = new Date();
  const startD = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const start = isoDate(startD);
  const end = isoDate(today);
  const { data } = useQuery({
    queryKey: ["rain-monthly", entityId, start],
    queryFn: () => api.ha.historyRange(entityId!, start, end),
    enabled: !!entityId,
    staleTime: 30 * 60 * 1000,
  });

  // Build 12 fixed month slots
  const slots = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, year: d.getFullYear(), month: d.getMonth(), value: 0 };
  });
  for (const r of data?.readings ?? []) {
    const d = new Date(r.time);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const slot = slots.find((s) => s.key === key);
    if (slot) slot.value = r.value;
  }
  const YEAR_COLORS = ["rgba(255,255,255,0.75)", "rgba(96,165,250,0.9)"];
  let yearColorIdx = 0;
  let lastYear = slots[0]?.year ?? -1;
  const bars: Bar[] = slots.map((s) => {
    if (s.year !== lastYear) {
      yearColorIdx = (yearColorIdx + 1) % YEAR_COLORS.length;
      lastYear = s.year;
    }
    return { value: s.value, label: MONTH_LETTERS[s.month] ?? "", labelColor: YEAR_COLORS[yearColorIdx]! };
  });
  return <LabelledSparkline bars={bars} color={color} labelFontSize={13} />;
}

/** Yearly: line chart of cumulative rain Jan 1 → today for the current year. */
function YearlySparkline({ entityId, color }: { entityId: string | null; color: string }) {
  const today = new Date();
  const year = today.getFullYear();
  const start = `${year}-01-01`;
  const end = isoDate(today);

  const { data } = useQuery({
    queryKey: ["rain-yearly-accum", entityId, year],
    queryFn: () => api.ha.historyRange(entityId!, start, end),
    enabled: !!entityId,
    staleTime: 60 * 60 * 1000,
  });

  // Last reading per calendar day
  const byDay = new Map<string, number>();
  for (const r of data?.readings ?? []) {
    byDay.set(isoDate(new Date(r.time)), r.value);
  }

  // Build forward-filled daily points Jan 1 → today
  const jan1 = new Date(year, 0, 1);
  const todayDay = Math.floor((today.getTime() - jan1.getTime()) / 86400000);
  const TOTAL_DAYS = 365;

  const pts: { day: number; val: number }[] = [];
  let lastVal = 0;
  for (let i = 0; i <= todayDay; i++) {
    const key = isoDate(new Date(year, 0, 1 + i));
    if (byDay.has(key)) lastVal = byDay.get(key)!;
    pts.push({ day: i, val: lastVal });
  }

  const maxVal = Math.max(...pts.map((p) => p.val), 0.001);
  const hasData = pts.some((p) => p.val > 0);

  // SVG coordinates within viewBox "0 0 365 100"
  const toX = (day: number) => (day / (TOTAL_DAYS - 1)) * 365;
  const toY = (val: number) => BAR_H - (val / maxVal) * BAR_H;

  const linePts = pts.map((p) => `${toX(p.day)},${toY(p.val)}`).join(" ");
  const lastPt = pts[pts.length - 1];
  const areaPts = lastPt
    ? `${linePts} ${toX(lastPt.day)},${BAR_H} 0,${BAR_H}`
    : "";

  // Month label positions as fractions of the chart width
  const monthMarkers = Array.from({ length: 12 }, (_, m) => {
    const d = new Date(year, m, 1);
    const day = Math.floor((d.getTime() - jan1.getTime()) / 86400000);
    return { pct: (day / (TOTAL_DAYS - 1)) * 100, letter: MONTH_LETTERS[m] ?? "" };
  });

  return (
    <div className="flex flex-col">
      <div className="flex" style={{ height: BAR_H }}>
        <div className="shrink-0 flex flex-col justify-between items-end pr-1.5" style={{ width: Y_AXIS_W }}>
          <span style={Y_LABEL_STYLE}>{hasData ? fmtYMax(maxVal) : "—"}</span>
          <span style={Y_LABEL_STYLE}>0</span>
        </div>
        <svg className="flex-1" height={BAR_H} viewBox={`0 0 365 ${BAR_H}`} preserveAspectRatio="none">
          {pts.length > 1 && (
            <>
              <polygon points={areaPts} fill={color} opacity="0.18" />
              <polyline
                points={linePts}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </>
          )}
        </svg>
      </div>
      <div className="flex" style={{ height: LABEL_H }}>
        <div className="shrink-0" style={{ width: Y_AXIS_W }} />
        <div className="flex-1 relative">
          {monthMarkers.map(({ pct, letter }, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${pct}%`,
                transform: "translateX(-50%)",
                fontSize: 13,
                color: "rgba(255,255,255,0.65)",
                fontFamily: "system-ui, sans-serif",
                lineHeight: `${LABEL_H}px`,
                whiteSpace: "nowrap",
              }}
            >
              {letter}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  color: string;
  sparkline: React.ReactNode;
}

function MetricCard({ label, value, unit, icon, color, sparkline }: MetricCardProps) {
  return (
    <div
      className="flex flex-col rounded-2xl p-5 gap-2"
      style={{ backgroundColor: `${color}22`, border: `1px solid ${color}44` }}
    >
      <div className="flex items-center gap-2" style={{ color }}>
        {icon}
        <span className="text-sm font-semibold uppercase tracking-wide opacity-90 leading-tight">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-4xl font-bold text-white leading-none">{value}</span>
        <span className="text-base text-white/50">{unit}</span>
      </div>
      <div className="mt-3">
        {sparkline}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface RainRateModalProps {
  config: RainRateConfig;
  onClose: () => void;
}

function RainRateModal({ config, onClose }: RainRateModalProps) {
  const getState = useEntityStateStore((s) => s.getState);
  const unit = config.unit || "mm";

  function getValue(entityId: string | null): string {
    if (!entityId) return "—";
    const s = getState(entityId);
    if (!s) return "—";
    const n = parseFloat(s.state);
    return isNaN(n) ? "—" : n.toFixed(1);
  }

  const metrics = [
    {
      label: "Hourly Rain Rate",
      value: getValue(config.hourlyRainRateEntityId),
      unit: `${unit}/hr`,
      icon: <CalendarDayIcon size={22} />,
      color: "#6366f1",
      sparkline: <HourlySparkline entityId={config.hourlyRainRateEntityId} color="#6366f1" />,
    },
    {
      label: "Daily Rain Rate",
      value: getValue(config.dailyRainRateEntityId),
      unit: `${unit}/day`,
      icon: <CalendarDayIcon size={22} />,
      color: "#1e40af",
      sparkline: <DailySparkline entityId={config.dailyRainRateEntityId} color="#1e40af" />,
    },
    {
      label: "Monthly Rain Rate",
      value: getValue(config.monthlyRainRateEntityId),
      unit: `${unit}/mo`,
      icon: <CalendarMonthIcon size={22} />,
      color: "#0891b2",
      sparkline: <MonthlySparkline entityId={config.monthlyRainRateEntityId} color="#0891b2" />,
    },
    {
      label: "Yearly Rain Rate",
      value: getValue(config.yearlyRainRateEntityId),
      unit: `${unit}/yr`,
      icon: <CalendarYearIcon size={22} />,
      color: "#ca8a04",
      sparkline: <YearlySparkline entityId={config.yearlyRainRateEntityId} color="#ca8a04" />,
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[63vw] rounded-2xl p-10 mx-auto" style={{ backgroundColor: "#1a2744" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 text-blue-400">
            <RaindropIcon size={36} />
            <span className="text-3xl font-semibold text-white">Rain Rates</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white/80 transition-colors text-3xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Grid of metric cards */}
        <div className="grid grid-cols-2 gap-5">
          {metrics.map(({ label, value, unit: u, icon, color, sparkline }) => (
            <MetricCard
              key={label}
              label={label}
              value={value}
              unit={u}
              icon={icon}
              color={color}
              sparkline={sparkline}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main Hotspot Renderer ────────────────────────────────────────────────────

export function RainRateHotspot({ hotspot, isEditMode }: HotspotRendererProps) {
  const [showModal, setShowModal] = useState(false);
  const config = hotspot.configJson as RainRateConfig;
  const getState = useEntityStateStore((s) => s.getState);

  const dailyMax = config.dailyMaxMm ?? 50;
  const unit = config.unit || "mm";

  const dailyState = config.dailyRainRateEntityId ? getState(config.dailyRainRateEntityId) : undefined;
  const rawValue = dailyState?.state ?? "";
  const dailyValue = parseFloat(rawValue);
  const hasDailyValue = !isNaN(dailyValue);
  const displayValue = hasDailyValue ? dailyValue.toFixed(1) : "—";

  const fillFraction = hasDailyValue ? Math.min(1, Math.max(0, dailyValue / dailyMax)) : 0;

  const DROP_TOP = 10;
  const DROP_BOTTOM = 122;
  const dropInteriorH = DROP_BOTTOM - DROP_TOP;
  const fillY = DROP_BOTTOM - fillFraction * dropInteriorH;

  const clipId = `drop-clip-${hotspot.id}`;
  const gradId = `drop-grad-${hotspot.id}`;

  return (
    <>
      <div
        className="w-full h-full flex items-center justify-center cursor-pointer select-none"
        onClick={() => { if (!isEditMode) setShowModal(true); }}
        aria-label={hotspot.name}
      >
        <svg
          viewBox="0 0 100 130"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
            <clipPath id={clipId}>
              <path d="M 50 8 C 35 30, 12 60, 12 82 C 12 106, 29 122, 50 122 C 71 122, 88 106, 88 82 C 88 60, 65 30, 50 8 Z" />
            </clipPath>
          </defs>

          <path
            d="M 50 8 C 35 30, 12 60, 12 82 C 12 106, 29 122, 50 122 C 71 122, 88 106, 88 82 C 88 60, 65 30, 50 8 Z"
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1.5"
          />

          {hasDailyValue && fillFraction > 0 && (
            <rect
              x="0"
              y={fillY}
              width="100"
              height={130 - fillY}
              fill={`url(#${gradId})`}
              clipPath={`url(#${clipId})`}
              opacity="0.85"
            />
          )}

          <path
            d="M 50 8 C 35 30, 12 60, 12 82 C 12 106, 29 122, 50 122 C 71 122, 88 106, 88 82 C 88 60, 65 30, 50 8 Z"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="1.5"
          />

          <text
            x="50"
            y={fillFraction > 0.5 ? "74" : "80"}
            textAnchor="middle"
            fill="white"
            fontSize="18"
            fontWeight="bold"
            fontFamily="system-ui, sans-serif"
          >
            {displayValue}
          </text>
          <text
            x="50"
            y={fillFraction > 0.5 ? "89" : "95"}
            textAnchor="middle"
            fill="rgba(255,255,255,0.65)"
            fontSize="9"
            fontFamily="system-ui, sans-serif"
          >
            {unit}/day
          </text>
        </svg>
      </div>

      {showModal && (
        <RainRateModal config={config} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
