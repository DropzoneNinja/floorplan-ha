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

function WeatherIcon({ code, size = 28 }: { code: number; size?: number }) {
  const type = wmoToIconType(code);
  const props = { size };
  switch (type) {
    case "clear":         return <SunIcon {...props} />;
    case "mainly-clear":  return <MainlyClearIcon {...props} />;
    case "partly-cloudy": return <PartlyCloudyIcon {...props} />;
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
  const COL_W = 58;                 // px per hour column
  const Y_AXIS_W = 32;              // px for y-axis label area (left of plot)
  const CHART_H = 110;
  const PAD_T = 8;
  const PAD_B = 4;                  // just enough for bottom edge
  const plotH = CHART_H - PAD_T - PAD_B;

  const hours = data?.hourly?.time ?? [];
  const numHours = hours.length;
  const totalW = Y_AXIS_W + numHours * COL_W;
  const forecastTemps = data?.hourly?.temperature_2m ?? [];

  const allTemps = [
    ...forecastTemps,
    ...historyReadings.map((r) => r.value),
  ];
  const minTemp = allTemps.length ? Math.min(...allTemps) - 2 : 0;
  const maxTemp = allTemps.length ? Math.max(...allTemps) + 2 : 30;
  const tempRange = maxTemp - minTemp || 1;

  // x: centers the data point in its column (aligned with strip icon above)
  function toX(hourIndex: number) {
    return Y_AXIS_W + hourIndex * COL_W + COL_W / 2;
  }
  // x for arbitrary decimal hour (historical readings)
  function toXTime(decimalHour: number) {
    return Y_AXIS_W + decimalHour * COL_W;
  }
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
      <div className="w-full max-w-lg rounded-t-2xl border border-white/10 bg-surface-raised shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-semibold text-white">Today&apos;s Forecast</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
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
            {/* ── Single shared scroll container: strip + chart scroll together ── */}
            <div className="overflow-x-auto" ref={scrollRef}>
              <div style={{ width: totalW }}>

                {/* Row 1: Hourly strip */}
                <div className="flex flex-row border-b border-white/10 py-2">
                  {/* Y-axis spacer so strip columns align with chart plot area */}
                  <div style={{ width: Y_AXIS_W, flexShrink: 0 }} />
                  {hours.map((t, i) => {
                    const code = data!.hourly.weathercode[i] ?? 0;
                    const temp = data!.hourly.temperature_2m[i] ?? 0;
                    const precip = data!.hourly.precipitation_probability[i] ?? 0;
                    const hour = new Date(t).getHours();
                    const isCurrent = hour === currentHour;
                    return (
                      <div
                        key={t}
                        style={{ width: COL_W }}
                        className={[
                          "flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5",
                          isCurrent ? "bg-white/10" : "",
                        ].join(" ")}
                      >
                        <span className={["text-[10px] font-medium tabular-nums", isCurrent ? "text-white" : "text-gray-500"].join(" ")}>
                          {hour.toString().padStart(2, "0")}:00
                        </span>
                        <WeatherIcon code={code} size={20} />
                        <span className="line-clamp-2 text-center text-[9px] leading-tight text-gray-400">
                          {wmoLabel(code)}
                        </span>
                        <span className={["text-xs font-semibold", isCurrent ? "text-white" : "text-gray-200"].join(" ")}>
                          {fmtTempShort(temp, unit)}
                        </span>
                        <span className="text-[9px] text-blue-300">{precip}%</span>
                      </div>
                    );
                  })}
                </div>

                {/* Row 2: Temperature chart — x positions match strip columns exactly */}
                <svg width={totalW} height={CHART_H}>
                  {/* Y-axis labels + horizontal grid lines */}
                  {ticks.map((tick) => {
                    const y = toY(tick);
                    const label = unit === "fahrenheit"
                      ? `${Math.round(tick * 9 / 5 + 32)}°`
                      : `${tick}°`;
                    return (
                      <g key={tick}>
                        <line
                          x1={Y_AXIS_W} y1={y} x2={totalW} y2={y}
                          stroke="rgba(255,255,255,0.08)" strokeWidth="1"
                        />
                        <text x={Y_AXIS_W - 4} y={y + 3.5} textAnchor="end" fill="#6B7280" fontSize="9">
                          {label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Vertical column separators (subtle) */}
                  {hours.map((_, i) => (
                    <line
                      key={i}
                      x1={Y_AXIS_W + i * COL_W} y1={PAD_T}
                      x2={Y_AXIS_W + i * COL_W} y2={CHART_H - PAD_B}
                      stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                    />
                  ))}

                  {/* Current hour highlight band */}
                  <rect
                    x={Y_AXIS_W + currentHour * COL_W} y={PAD_T}
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
                </svg>

              </div>
            </div>

            {/* Legend (outside scroll, always visible) */}
            <div className="flex items-center gap-4 border-t border-white/10 px-4 py-2">
              <div className="flex items-center gap-1.5">
                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#60A5FA" strokeWidth="2" /></svg>
                <span className="text-[10px] text-gray-400">Forecast</span>
              </div>
              {outsideTempEntityId && (
                <div className="flex items-center gap-1.5">
                  <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#FB923C" strokeWidth="1.5" /></svg>
                  <span className="text-[10px] text-gray-400">
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
      <div className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-surface-raised shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-semibold text-white">{label}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <span className="text-sm text-gray-400">Loading…</span>
            </div>
          ) : !data?.hourly?.time?.length ? (
            <div className="py-10 text-center text-sm text-gray-500">No data available</div>
          ) : (
            <div className="flex flex-col gap-1">
              {data.hourly.time.map((t, i) => {
                const code = data.hourly.weathercode[i] ?? 0;
                const temp = data.hourly.temperature_2m[i] ?? 0;
                const precip = data.hourly.precipitation_probability[i] ?? 0;
                const wind = data.hourly.windspeed_10m[i] ?? 0;
                return (
                  <div key={t} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5">
                    <span className="w-12 shrink-0 text-xs font-medium text-gray-400">{hhmm(t)}</span>
                    <WeatherIcon code={code} size={20} />
                    <span className="flex-1 text-xs text-gray-300">{wmoLabel(code)}</span>
                    <span className="w-12 text-right text-xs font-semibold text-white">{fmtTemp(temp, unit)}</span>
                    {precip > 0 && (
                      <span className="w-10 text-right text-[10px] text-blue-300">💧{precip}%</span>
                    )}
                    <span className="w-14 text-right text-[10px] text-gray-500">{Math.round(wind)} km/h</span>
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
      <div className="w-full max-w-sm rounded-t-2xl border border-white/10 bg-surface-raised shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-semibold text-white">
            UV Index{uvValue !== null ? ` — ${uvValue}` : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="p-3">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2 pr-3 font-medium">Index</th>
                <th className="pb-2 pr-3 font-medium">Risk</th>
                <th className="pb-2 pr-3 font-medium">Guidance</th>
                <th className="pb-2 font-medium whitespace-nowrap">Unprotected</th>
              </tr>
            </thead>
            <tbody>
              {UV_LEVELS.map(({ range, label, desc, exposure }) => {
                const isActive = label === currentLabel;
                const activeBase = "border-y border-white/20 bg-white/5";
                const inactiveTop = "border-t border-white/5";
                return (
                  <tr key={range}>
                    <td className={`py-2 pr-3 font-mono text-gray-300 align-top ${isActive ? `${activeBase} border-l border-white/20 rounded-l-lg pl-2` : inactiveTop}`}>
                      {range}
                    </td>
                    <td className={`py-2 pr-3 font-semibold whitespace-nowrap align-top ${UV_COLORS[label] ?? "text-white"} ${isActive ? activeBase : inactiveTop}`}>
                      {label}
                    </td>
                    <td className={`py-2 pr-3 text-gray-400 leading-relaxed ${isActive ? activeBase : inactiveTop}`}>
                      {desc}
                    </td>
                    <td className={`py-2 text-gray-400 whitespace-nowrap align-top ${isActive ? `${activeBase} border-r border-white/20 rounded-r-lg pr-2` : inactiveTop}`}>
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
            <div className="flex items-center justify-center gap-2">
              <WeatherIcon code={current.weathercode} size={52} />
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
                <span className="text-xs text-amber-400">{uvRiskLabel(uvValue!)}</span>
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
