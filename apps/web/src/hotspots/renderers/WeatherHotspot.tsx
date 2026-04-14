import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import type { WeatherConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { api } from "../../api/client.ts";
import { useEntityStateStore } from "../../store/entity-states.ts";

// ─── SVG Weather Icons ────────────────────────────────────────────────────────

type IconType =
  | "clear"
  | "mainly-clear"
  | "partly-cloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "heavy-rain"
  | "snow"
  | "thunderstorm";

function wmoToIconType(code: number): IconType {
  if (code === 0)                    return "clear";
  if (code === 1)                    return "mainly-clear";
  if (code === 2)                    return "partly-cloudy";
  if (code === 3)                    return "overcast";
  if (code === 45 || code === 48)    return "fog";
  if (code >= 51 && code <= 55)      return "drizzle";
  if (code >= 61 && code <= 67)      return (code >= 65) ? "heavy-rain" : "rain";
  if (code >= 71 && code <= 77)      return "snow";
  if (code >= 80 && code <= 82)      return (code === 82) ? "heavy-rain" : "rain";
  if (code >= 85 && code <= 86)      return "snow";
  if (code >= 95)                    return "thunderstorm";
  return "overcast";
}

function wmoLabel(code: number): string {
  const labels: Record<number, string> = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Icy fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Light showers", 81: "Showers", 82: "Heavy showers",
    85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
  };
  return labels[code] ?? "Unknown";
}

interface IconProps { size?: number }

function SunIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="5" fill="#FBBF24" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = Math.PI * a / 180;
        return (
          <line key={a}
            x1={14 + 7.5 * Math.cos(r)} y1={14 + 7.5 * Math.sin(r)}
            x2={14 + 10.5 * Math.cos(r)} y2={14 + 10.5 * Math.sin(r)}
            stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function CloudShape({ x = 0, y = 0, scale = 1, color = "#9CA3AF" }: { x?: number; y?: number; scale?: number; color?: string }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="8" cy="11" rx="6" ry="5" fill={color} />
      <ellipse cx="13" cy="10" rx="5" ry="4.5" fill={color} />
      <ellipse cx="18" cy="11" rx="5" ry="4.5" fill={color} />
      <rect x="2" y="11" width="21" height="5" rx="0" fill={color} />
      <rect x="2" y="13" width="21" height="3" rx="1.5" fill={color} />
    </g>
  );
}

function MainlyClearIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Small sun behind, offset top-right */}
      <circle cx="19" cy="9" r="4" fill="#FBBF24" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = Math.PI * a / 180;
        return (
          <line key={a}
            x1={19 + 5.5 * Math.cos(r)} y1={9 + 5.5 * Math.sin(r)}
            x2={19 + 7.5 * Math.cos(r)} y2={9 + 7.5 * Math.sin(r)}
            stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round"
          />
        );
      })}
      <CloudShape x={2} y={12} scale={0.75} color="#D1D5DB" />
    </svg>
  );
}

function PartlyCloudyIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="18" cy="10" r="5" fill="#FBBF24" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = Math.PI * a / 180;
        return (
          <line key={a}
            x1={18 + 6.5 * Math.cos(r)} y1={10 + 6.5 * Math.sin(r)}
            x2={18 + 9 * Math.cos(r)} y2={10 + 9 * Math.sin(r)}
            stroke="#FBBF24" strokeWidth="1.6" strokeLinecap="round"
          />
        );
      })}
      <CloudShape x={1} y={13} scale={0.82} color="#D1D5DB" />
    </svg>
  );
}

function OvercastIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {/* Back cloud, lighter */}
      <CloudShape x={4} y={5} scale={0.85} color="#6B7280" />
      {/* Front cloud */}
      <CloudShape x={1} y={11} scale={0.9} color="#9CA3AF" />
    </svg>
  );
}

function FogIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <CloudShape x={1} y={4} scale={0.85} color="#9CA3AF" />
      <line x1="4" y1="19" x2="24" y2="19" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="23" x2="22" y2="23" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DrizzleIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <CloudShape x={1} y={3} scale={0.85} color="#9CA3AF" />
      {[7, 11, 15, 19].map((x) => (
        <line key={x} x1={x} y1="20" x2={x - 1} y2="24" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function RainIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <CloudShape x={1} y={3} scale={0.85} color="#6B7280" />
      {[6, 10, 14, 18, 8, 12, 16].map((x, i) => (
        <line key={i} x1={x} y1={i < 4 ? 19 : 22} x2={x - 1.5} y2={i < 4 ? 24 : 27}
          stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function HeavyRainIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <CloudShape x={1} y={2} scale={0.85} color="#4B5563" />
      {[5, 9, 13, 17, 21, 7, 11, 15, 19].map((x, i) => (
        <line key={i} x1={x} y1={i < 5 ? 18 : 21} x2={x - 2} y2={i < 5 ? 23 : 27}
          stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function SnowIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <CloudShape x={1} y={3} scale={0.85} color="#9CA3AF" />
      {[7, 12, 17].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={22} r="1.5" fill="#BAE6FD" />
          <circle cx={x} cy={26} r="1.5" fill="#BAE6FD" />
        </g>
      ))}
    </svg>
  );
}

function ThunderstormIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <CloudShape x={1} y={3} scale={0.85} color="#4B5563" />
      {/* Lightning bolt */}
      <path d="M14 18 L11 24 L14 22 L12 28 L17 21 L14 23 Z" fill="#FDE047" />
    </svg>
  );
}

function MoonIcon({ size = 28 }: IconProps) {
  // Crescent: outer circle (14,14) r=7 minus inner circle (17,14) r=7
  // Intersection x=15.5, y=14±6.84 ≈ (15.5, 7.2) and (15.5, 20.8)
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M15.5 7.2 A7 7 0 1 0 15.5 20.8 A7 7 0 0 1 15.5 7.2 Z" fill="#C4B5FD" />
    </svg>
  );
}

function MainlyClearNightIcon({ size = 28 }: IconProps) {
  // Crescent moon at top-right: outer (19,9) r=4, inner (21,9) r=4
  // Intersection x=20, y=9±3.46 ≈ (20, 5.5) and (20, 12.5)
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M20 5.5 A4 4 0 1 0 20 12.5 A4 4 0 0 1 20 5.5 Z" fill="#C4B5FD" />
      <CloudShape x={2} y={12} scale={0.75} color="#D1D5DB" />
    </svg>
  );
}

function PartlyCloudyNightIcon({ size = 28 }: IconProps) {
  // Crescent moon at top-right: outer (18,10) r=5, inner (21,10) r=5
  // Intersection x=19.5, y=10±4.77 ≈ (19.5, 5.2) and (19.5, 14.8)
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M19.5 5.2 A5 5 0 1 0 19.5 14.8 A5 5 0 0 1 19.5 5.2 Z" fill="#C4B5FD" />
      <CloudShape x={1} y={13} scale={0.82} color="#D1D5DB" />
    </svg>
  );
}

function WeatherIcon({ code, size = 28, isNight = false }: { code: number; size?: number; isNight?: boolean }) {
  const type = wmoToIconType(code);
  const props = { size };
  switch (type) {
    case "clear":         return isNight ? <MoonIcon {...props} /> : <SunIcon {...props} />;
    case "mainly-clear":  return isNight ? <MainlyClearNightIcon {...props} /> : <MainlyClearIcon {...props} />;
    case "partly-cloudy": return isNight ? <PartlyCloudyNightIcon {...props} /> : <PartlyCloudyIcon {...props} />;
    case "overcast":      return <OvercastIcon {...props} />;
    case "fog":           return <FogIcon {...props} />;
    case "drizzle":       return <DrizzleIcon {...props} />;
    case "rain":          return <RainIcon {...props} />;
    case "heavy-rain":    return <HeavyRainIcon {...props} />;
    case "snow":          return <SnowIcon {...props} />;
    case "thunderstorm":  return <ThunderstormIcon {...props} />;
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function uvRiskLabel(uv: number): string {
  if (uv <= 2)  return "Low";
  if (uv <= 5)  return "Moderate";
  if (uv <= 7)  return "High";
  if (uv <= 10) return "Very High";
  return "Extreme";
}

function fmtTemp(celsius: number, unit: "celsius" | "fahrenheit"): string {
  if (unit === "fahrenheit") return `${Math.round(celsius * 9 / 5 + 32)}°F`;
  return `${Math.round(celsius)}°C`;
}

function fmtTempShort(celsius: number, unit: "celsius" | "fahrenheit"): string {
  if (unit === "fahrenheit") return `${Math.round(celsius * 9 / 5 + 32)}°`;
  return `${Math.round(celsius)}°`;
}

function weekday(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
}

function hhmm(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── Today Detail Modal ───────────────────────────────────────────────────────

interface TodayDetailModalProps {
  date: string;
  unit: "celsius" | "fahrenheit";
  outsideTempEntityId: string | null;
  onClose: () => void;
}

function TodayDetailModal({ date, unit, outsideTempEntityId, onClose }: TodayDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["weather-hourly", date],
    queryFn: () => api.weather.hourly(date),
    staleTime: 60 * 60 * 1000,
  });

  const { data: historyData } = useQuery({
    queryKey: ["ha-history", outsideTempEntityId, date],
    queryFn: () => api.ha.history(outsideTempEntityId!, date),
    enabled: !!outsideTempEntityId,
    staleTime: 5 * 60 * 1000,
  });

  const getEntityState = useEntityStateStore((s) => s.getState);
  const outsideTempEntity = outsideTempEntityId ? getEntityState(outsideTempEntityId) : undefined;
  const entityLabel = outsideTempEntity?.attributes?.friendly_name as string | undefined
    ?? outsideTempEntityId
    ?? "";

  const now = new Date();
  const currentHour = now.getHours();
  const historyReadings = historyData?.readings ?? [];

  // Column layout — strip and chart share the same column widths
  const COL_W = 68;                 // px per hour column
  const Y_AXIS_W = 36;              // px for fixed y-axis panel (outside scroll)
  const CHART_H = 140;
  const PAD_T = 10;
  const PAD_B = 6;
  const plotH = CHART_H - PAD_T - PAD_B;

  const hours = data?.hourly?.time ?? [];
  const numHours = hours.length;
  const chartW = numHours * COL_W;   // SVG width — no Y_AXIS_W, chart starts at x=0
  const forecastTemps = data?.hourly?.temperature_2m ?? [];

  const allTemps = [
    ...forecastTemps,
    ...historyReadings.map((r) => r.value),
  ];
  const minTemp = allTemps.length ? Math.min(...allTemps) - 2 : 0;
  const maxTemp = allTemps.length ? Math.max(...allTemps) + 2 : 30;
  const tempRange = maxTemp - minTemp || 1;

  // x: center of column hourIndex (aligns with strip icon above)
  function toX(hourIndex: number) { return hourIndex * COL_W + COL_W / 2; }
  // x for arbitrary decimal hour (historical readings)
  function toXTime(decimalHour: number) { return decimalHour * COL_W; }
  function toY(temp: number) {
    return PAD_T + plotH - ((temp - minTemp) / tempRange) * plotH;
  }

  const forecastPolyline = forecastTemps
    .map((t, i) => `${toX(i)},${toY(t)}`)
    .join(" ");

  const historyPolyline = historyReadings
    .map((r) => {
      const d = new Date(r.time);
      return `${toXTime(d.getHours() + d.getMinutes() / 60)},${toY(r.value)}`;
    })
    .join(" ");

  // Highest actual reading within the current hour
  const currentHourPeak = historyReadings.reduce<{ value: number; x: number } | null>((best, r) => {
    const d = new Date(r.time);
    if (d.getHours() !== currentHour) return best;
    if (!best || r.value > best.value) {
      return { value: r.value, x: toXTime(d.getHours() + d.getMinutes() / 60) };
    }
    return best;
  }, null);

  // Y-axis tick labels (every 5°C)
  const tickStep = 5;
  const firstTick = Math.ceil(minTemp / tickStep) * tickStep;
  const ticks: number[] = [];
  for (let t = firstTick; t <= maxTemp; t += tickStep) ticks.push(t);

  // Shared scroll container — scroll to show current hour on open
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current && currentHour > 2) {
      scrollRef.current.scrollLeft = (currentHour - 2) * COL_W;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-t-2xl border border-white/10 bg-surface-raised shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <span className="text-base font-semibold text-white">Today&apos;s Forecast</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <span className="text-sm text-gray-400">Loading…</span>
          </div>
        ) : !numHours ? (
          <div className="py-10 text-center text-sm text-gray-500">No data available</div>
        ) : (
          <>
            {/* ── Fixed y-axis | scrollable strip + chart ── */}
            <div className="flex items-stretch">

              {/* Left: fixed y-axis column — never scrolls */}
              <div style={{ width: Y_AXIS_W, flexShrink: 0 }} className="flex flex-col">
                {/* Spacer that stretches to match the strip row height */}
                <div className="flex-1 border-b border-white/10" />
                {/* Y-axis labels aligned to chart */}
                <svg width={Y_AXIS_W} height={CHART_H}>
                  {ticks.map((tick) => {
                    const label = unit === "fahrenheit"
                      ? `${Math.round(tick * 9 / 5 + 32)}°`
                      : `${tick}°`;
                    return (
                      <text key={tick} x={Y_AXIS_W - 4} y={toY(tick) + 3.5} textAnchor="end" fill="#6B7280" fontSize="11">
                        {label}
                      </text>
                    );
                  })}
                </svg>
              </div>

              {/* Right: scrollable strip + chart */}
              <div className="overflow-x-auto flex-1" ref={scrollRef}>
                <div style={{ width: chartW }}>

                  {/* Row 1: Hourly strip */}
                  <div className="flex flex-row border-b border-white/10 py-2">
                    {hours.map((t, i) => {
                      const code = data!.hourly.weathercode[i] ?? 0;
                      const temp = data!.hourly.temperature_2m[i] ?? 0;
                      const precip = data!.hourly.precipitation_probability[i] ?? 0;
                      const isNight = (data!.hourly.is_day[i] ?? 1) === 0;
                      const hour = new Date(t).getHours();
                      const isCurrent = hour === currentHour;
                      return (
                        <div
                          key={t}
                          style={{ width: COL_W }}
                          className={[
                            "flex shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-2",
                            isCurrent ? "bg-white/10" : "",
                          ].join(" ")}
                        >
                          <span className={["text-xs font-medium tabular-nums", isCurrent ? "text-white" : "text-gray-500"].join(" ")}>
                            {hour.toString().padStart(2, "0")}:00
                          </span>
                          <WeatherIcon code={code} size={24} isNight={isNight} />
                          <span className="line-clamp-2 text-center text-[10px] leading-tight text-gray-400">
                            {wmoLabel(code)}
                          </span>
                          <span className={["text-sm font-semibold", isCurrent ? "text-white" : "text-gray-200"].join(" ")}>
                            {fmtTempShort(temp, unit)}
                          </span>
                          <span className="text-[10px] text-blue-300">{precip}%</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Row 2: Temperature chart — x=0 is the start of hour 0 */}
                  <svg width={chartW} height={CHART_H}>
                    {/* Horizontal grid lines */}
                    {ticks.map((tick) => (
                      <line
                        key={tick}
                        x1={0} y1={toY(tick)} x2={chartW} y2={toY(tick)}
                        stroke="rgba(255,255,255,0.08)" strokeWidth="1"
                      />
                    ))}

                    {/* Vertical column separators (subtle) */}
                    {hours.map((_, i) => (
                      <line
                        key={i}
                        x1={i * COL_W} y1={PAD_T}
                        x2={i * COL_W} y2={CHART_H - PAD_B}
                        stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                      />
                    ))}

                    {/* Current hour highlight band */}
                    <rect
                      x={currentHour * COL_W} y={PAD_T}
                      width={COL_W} height={plotH}
                      fill="rgba(255,255,255,0.05)"
                    />

                    {/* Historical actual temp polyline */}
                    {historyPolyline && (
                      <polyline
                        points={historyPolyline}
                        fill="none"
                        stroke="#FB923C"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                    )}

                    {/* Forecast polyline (on top) */}
                    {forecastPolyline && (
                      <polyline
                        points={forecastPolyline}
                        fill="none"
                        stroke="#60A5FA"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Peak actual temp in current hour */}
                    {currentHourPeak && (() => {
                      const px = currentHourPeak.x;
                      const py = toY(currentHourPeak.value);
                      return (
                        <g>
                          <circle cx={px} cy={py} r="3" fill="#FB923C" />
                          <text x={px} y={py - 8} textAnchor="middle" fill="#FB923C" fontSize="11" fontWeight="600">
                            {fmtTempShort(currentHourPeak.value, unit)}
                          </text>
                        </g>
                      );
                    })()}
                  </svg>

                </div>
              </div>
            </div>

            {/* Legend (outside scroll, always visible) */}
            <div className="flex items-center gap-5 border-t border-white/10 px-5 py-3">
              <div className="flex items-center gap-2">
                <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#60A5FA" strokeWidth="2.5" /></svg>
                <span className="text-xs text-gray-400">Forecast</span>
              </div>
              {outsideTempEntityId && (
                <div className="flex items-center gap-2">
                  <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#FB923C" strokeWidth="2" /></svg>
                  <span className="text-xs text-gray-400">
                    Actual{entityLabel ? ` · ${entityLabel}` : ""}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ─── Hourly Detail Modal ──────────────────────────────────────────────────────

interface HourlyModalProps {
  date: string;
  unit: "celsius" | "fahrenheit";
  onClose: () => void;
}

function HourlyModal({ date, unit, onClose }: HourlyModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["weather-hourly", date],
    queryFn: () => api.weather.hourly(date),
    staleTime: 60 * 60 * 1000,
  });

  const label = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-t-2xl border border-white/10 bg-surface-raised shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <span className="text-base font-semibold text-white">{label}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <span className="text-sm text-gray-400">Loading…</span>
            </div>
          ) : !data?.hourly?.time?.length ? (
            <div className="py-10 text-center text-sm text-gray-500">No data available</div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {data.hourly.time.map((t, i) => {
                const code = data.hourly.weathercode[i] ?? 0;
                const temp = data.hourly.temperature_2m[i] ?? 0;
                const precip = data.hourly.precipitation_probability[i] ?? 0;
                const wind = data.hourly.windspeed_10m[i] ?? 0;
                const isNight = (data.hourly.is_day[i] ?? 1) === 0;
                return (
                  <div key={t} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5">
                    <span className="w-14 shrink-0 text-sm font-medium text-gray-400">{hhmm(t)}</span>
                    <WeatherIcon code={code} size={24} isNight={isNight} />
                    <span className="flex-1 text-sm text-gray-300">{wmoLabel(code)}</span>
                    <span className="w-14 text-right text-sm font-semibold text-white">{fmtTemp(temp, unit)}</span>
                    {precip > 0 && (
                      <span className="w-12 text-right text-xs text-blue-300">💧{precip}%</span>
                    )}
                    <span className="w-16 text-right text-xs text-gray-500">{Math.round(wind)} km/h</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── UV Info Modal ────────────────────────────────────────────────────────────

const UV_LEVELS = [
  { range: "0–2",  label: "Low",       desc: "Minimal risk for most people. Basic sun protection is usually enough.",                             exposure: "60+ min" },
  { range: "3–5",  label: "Moderate",  desc: "Some risk of harm from sun exposure. Hat, sunglasses, and sunscreen are a good idea.",              exposure: "45–60 min" },
  { range: "6–7",  label: "High",      desc: "High risk of damage. Reduce time in direct sun, especially around midday.",                        exposure: "25–40 min" },
  { range: "8–10", label: "Very High", desc: "Very strong UV. Skin can burn quickly, so full sun protection is important.",                       exposure: "15–25 min" },
  { range: "11+",  label: "Extreme",   desc: "Extreme UV exposure. Unprotected skin can burn in minutes; avoid direct sun where possible.",       exposure: "< 15 min" },
];

const UV_COLORS: Record<string, string> = {
  Low: "text-green-400",
  Moderate: "text-yellow-400",
  High: "text-orange-400",
  "Very High": "text-red-400",
  Extreme: "text-purple-400",
};

function UvInfoModal({ uvValue, onClose }: { uvValue: number | null; onClose: () => void }) {
  const currentLabel = uvValue !== null ? uvRiskLabel(uvValue) : null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl rounded-t-2xl border border-white/10 bg-surface-raised shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <span className="text-lg font-semibold text-white">
            UV Index{uvValue !== null ? ` — ${uvValue}` : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-3 pr-4 font-medium">Index</th>
                <th className="pb-3 pr-4 font-medium">Risk</th>
                <th className="pb-3 pr-4 font-medium">Guidance</th>
                <th className="pb-3 font-medium whitespace-nowrap">Unprotected</th>
              </tr>
            </thead>
            <tbody>
              {UV_LEVELS.map(({ range, label, desc, exposure }) => {
                const isActive = label === currentLabel;
                const activeBase = "border-y border-white/20 bg-white/5";
                const inactiveTop = "border-t border-white/5";
                return (
                  <tr key={range}>
                    <td className={`py-3 pr-4 font-mono text-gray-300 align-top ${isActive ? `${activeBase} border-l border-white/20 rounded-l-lg pl-3` : inactiveTop}`}>
                      {range}
                    </td>
                    <td className={`py-3 pr-4 font-semibold whitespace-nowrap align-top ${UV_COLORS[label] ?? "text-white"} ${isActive ? activeBase : inactiveTop}`}>
                      {label}
                    </td>
                    <td className={`py-3 pr-4 text-gray-400 leading-relaxed ${isActive ? activeBase : inactiveTop}`}>
                      {desc}
                    </td>
                    <td className={`py-3 text-gray-400 whitespace-nowrap align-top ${isActive ? `${activeBase} border-r border-white/20 rounded-r-lg pr-3` : inactiveTop}`}>
                      {exposure}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Main Weather Hotspot ─────────────────────────────────────────────────────

export function WeatherHotspot({ hotspot, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as WeatherConfig;
  const unit = config.temperatureUnit ?? "celsius";
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showUvInfo, setShowUvInfo] = useState(false);
  const [showTodayDetail, setShowTodayDetail] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["weather-forecast"],
    queryFn: () => api.weather.forecast(),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const getEntityState = useEntityStateStore((s) => s.getState);
  const uvEntity = config.uvEntityId ? getEntityState(config.uvEntityId) : undefined;
  const uvValue = uvEntity ? Math.round(parseFloat(uvEntity.state)) : null;
  const uvValid = uvValue !== null && !isNaN(uvValue);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-black/40">
        <span className="text-xs text-gray-400">Loading weather…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-black/40">
        <span className="text-xs text-gray-500">Weather unavailable</span>
      </div>
    );
  }

  const current = data.current_weather;
  const daily = data.daily;
  const todayPrecip = (daily.precipitation_sum[0] ?? 0).toFixed(1);
  const todayHigh = daily.temperature_2m_max[0] ?? 0;
  const todayLow = daily.temperature_2m_min[0] ?? 0;

  // Next 5 days (skip today at index 0)
  const forecastDays = [1, 2, 3, 4, 5].map((i) => ({
    date: daily.time[i] ?? "",
    code: daily.weathercode[i] ?? 0,
    high: daily.temperature_2m_max[i] ?? 0,
    low: daily.temperature_2m_min[i] ?? 0,
  })).filter((d) => d.date);

  return (
    <>
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl"
        style={{ background: "rgba(22, 27, 42, 0.90)", backdropFilter: "blur(8px)" }}
        aria-label={hotspot.name}
      >
        {/* ── Current conditions ── */}
        <div className="flex shrink-0 items-center px-4 py-3">
          {/* Left + Centre: clickable area opens today's detail */}
          <button
            type="button"
            disabled={isEditMode}
            onClick={() => !isEditMode && setShowTodayDetail(true)}
            className="flex w-0 flex-1 items-center gap-4 rounded-xl py-1 text-left transition-colors hover:bg-white/10 active:bg-white/15 disabled:cursor-default"
          >
            {/* Left: today high/low + precipitation */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-xl font-bold leading-tight text-white">{fmtTempShort(todayHigh, unit)}</span>
                <span className="text-sm leading-tight text-gray-400">{fmtTempShort(todayLow, unit)}</span>
              </div>
              <span className="flex items-center gap-1 text-xs text-blue-300">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 1 C3 1 2 2.5 2 4 C2 5.5 3 6 4 6.5 L4 8.5 C4 9 4.4 9.5 5 9.5 C5.6 9.5 6 9 6 8.5 L6 6.5 C7 6 8 5.5 8 4 C8 2.5 7 1 5 1Z" fill="#60A5FA" />
                </svg>
                {todayPrecip} mm
              </span>
            </div>

            {/* Centre: icon + condition */}
            <div className="flex flex-1 items-center justify-center gap-2">
              <WeatherIcon code={current.weathercode} size={52} isNight={current.is_day === 0} />
              <span className="text-xs font-semibold text-white">{wmoLabel(current.weathercode)}</span>
            </div>
          </button>

          {/* Right: UV index + risk label (separate, does not trigger today modal) */}
          <div className="flex shrink-0 flex-col items-end">
            {uvValid ? (
              <button
                type="button"
                disabled={isEditMode}
                onClick={(e) => { e.stopPropagation(); !isEditMode && setShowUvInfo(true); }}
                className="flex flex-col items-end rounded-lg px-1 py-0.5 transition-colors hover:bg-white/10 active:bg-white/15 disabled:cursor-default"
              >
                <span className="text-xl font-bold leading-tight text-amber-300">UV {uvValue}</span>
                <span className="text-sm text-amber-400">{uvRiskLabel(uvValue!)}</span>
              </button>
            ) : (
              <span className="text-xs text-gray-600">UV not configured</span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-3 shrink-0 border-t border-white/10" />

        {/* ── 5-day forecast strip ── */}
        <div className="flex min-h-0 flex-1 items-stretch px-1 py-1">
          {forecastDays.map((day) => (
            <button
              key={day.date}
              type="button"
              disabled={isEditMode}
              onClick={() => !isEditMode && setSelectedDate(day.date)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-1 py-1 transition-colors hover:bg-white/10 active:bg-white/15 disabled:cursor-default"
            >
              <WeatherIcon code={day.code} size={36} />
              <div className="flex flex-col justify-between self-stretch py-0.5">
                <span className="text-xs font-semibold text-gray-400">{weekday(day.date)}</span>
                <span className="text-sm font-bold leading-tight text-white">{fmtTempShort(day.high, unit)}</span>
                <span className="text-xs leading-tight text-gray-400">{fmtTempShort(day.low, unit)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {showTodayDetail && (
        <TodayDetailModal
          date={daily.time[0] ?? ""}
          unit={unit}
          outsideTempEntityId={config.outsideTempEntityId ?? null}
          onClose={() => setShowTodayDetail(false)}
        />
      )}

      {selectedDate && (
        <HourlyModal
          date={selectedDate}
          unit={unit}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {showUvInfo && (
        <UvInfoModal
          uvValue={uvValid ? uvValue : null}
          onClose={() => setShowUvInfo(false)}
        />
      )}
    </>
  );
}
