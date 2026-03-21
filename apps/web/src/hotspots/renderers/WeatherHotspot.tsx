import { useState } from "react";
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

// ─── Main Weather Hotspot ─────────────────────────────────────────────────────

export function WeatherHotspot({ hotspot, isEditMode }: HotspotRendererProps) {
  const config = hotspot.configJson as WeatherConfig;
  const unit = config.temperatureUnit ?? "celsius";
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
          {/* Left: temperature + precipitation */}
          <div className="flex w-0 flex-1 flex-col">
            <span className="text-xl font-bold leading-tight text-white">
              {fmtTemp(current.temperature, unit)}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-blue-300">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1 C3 1 2 2.5 2 4 C2 5.5 3 6 4 6.5 L4 8.5 C4 9 4.4 9.5 5 9.5 C5.6 9.5 6 9 6 8.5 L6 6.5 C7 6 8 5.5 8 4 C8 2.5 7 1 5 1Z" fill="#60A5FA" />
              </svg>
              {todayPrecip} mm
            </span>
          </div>

          {/* Centre: icon + condition */}
          <div className="flex flex-col items-center gap-1">
            <WeatherIcon code={current.weathercode} size={40} />
            <span className="text-xs font-semibold text-white">{wmoLabel(current.weathercode)}</span>
          </div>

          {/* Right: UV index + risk label */}
          <div className="flex w-0 flex-1 flex-col items-end">
            {uvValid ? (
              <>
                <span className="text-xl font-bold leading-tight text-amber-300">UV {uvValue}</span>
                <span className="text-[11px] text-amber-400">{uvRiskLabel(uvValue!)}</span>
              </>
            ) : (
              <span className="text-[11px] text-gray-600">UV not configured</span>
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
              className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 transition-colors hover:bg-white/10 active:bg-white/15 disabled:cursor-default"
            >
              <span className="text-[11px] font-semibold text-gray-300">{weekday(day.date)}</span>
              <div className="flex items-center gap-1">
                <WeatherIcon code={day.code} size={24} />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold leading-tight text-white">{fmtTempShort(day.high, unit)}</span>
                  <span className="text-xs leading-tight text-gray-400">{fmtTempShort(day.low, unit)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedDate && (
        <HourlyModal
          date={selectedDate}
          unit={unit}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  );
}
