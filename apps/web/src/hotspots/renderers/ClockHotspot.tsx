import { useEffect, useState } from "react";
import type { ClockConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_COLOR = "#ffffff";

// ─── Timezone helpers ─────────────────────────────────────────────────────────

/** Returns the hour (0–23) in the given IANA timezone. Falls back to local. */
function getHourInTz(date: Date, tz: string | null): number {
  try {
    const fmt = new Intl.DateTimeFormat("en", {
      hour: "numeric",
      hour12: false,
      timeZone: tz ?? undefined,
    });
    const h = parseInt(fmt.format(date), 10);
    return isNaN(h) ? date.getHours() : h === 24 ? 0 : h;
  } catch {
    return date.getHours();
  }
}

/** Returns the short timezone label, e.g. "EST", "CEST", "UTC+5". */
function getTzAbbr(date: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZoneName: "short",
      timeZone: tz,
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

// ─── Time / date formatting ───────────────────────────────────────────────────

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Returns a formatted time string in the target timezone.
 * Uses Intl for timezone-aware field extraction, then assembles manually
 * so the output is consistent regardless of browser locale.
 */
function formatTime(
  date: Date,
  hourFormat: "12" | "24",
  showSeconds: boolean,
  tz: string | null,
): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    second: showSeconds ? "2-digit" : undefined,
    hour12: hourFormat === "12",
    timeZone: tz ?? undefined,
  };

  try {
    const parts = new Intl.DateTimeFormat("en", opts).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const h = get("hour");
    const m = get("minute");
    const s = get("second");
    const ampm = get("dayPeriod"); // "AM" / "PM" or ""

    if (hourFormat === "12") {
      return showSeconds ? `${h}:${m}:${s} ${ampm}` : `${h}:${m} ${ampm}`;
    }
    return showSeconds ? `${h}:${m}:${s}` : `${h}:${m}`;
  } catch {
    // Fallback: local time, no Intl
    const h = date.getHours();
    const m = pad2(date.getMinutes());
    const s = pad2(date.getSeconds());
    if (hourFormat === "12") {
      const h12 = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      return showSeconds ? `${pad2(h12)}:${m}:${s} ${ampm}` : `${pad2(h12)}:${m} ${ampm}`;
    }
    return showSeconds ? `${pad2(h)}:${m}:${s}` : `${pad2(h)}:${m}`;
  }
}

/** Returns "Mon, 24 Mar" in the target timezone. */
function formatDate(date: Date, tz: string | null): string {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: tz ?? undefined,
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("weekday")}, ${get("day")} ${get("month")}`;
  } catch {
    return date.toDateString().slice(0, 10);
  }
}

// ─── Analog Face ──────────────────────────────────────────────────────────────

function AnalogFace({
  date,
  showSeconds,
  color,
  tz,
}: {
  date: Date;
  showSeconds: boolean;
  color: string;
  tz: string | null;
}) {
  const cx = 50;
  const cy = 50;
  const r = 46;

  // Extract h/m/s in the target timezone
  let hours = 0, minutes = 0, seconds = 0;
  try {
    const parts = new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
      timeZone: tz ?? undefined,
    }).formatToParts(date);
    const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
    hours = get("hour") % 12;
    minutes = get("minute");
    seconds = get("second");
  } catch {
    hours = date.getHours() % 12;
    minutes = date.getMinutes();
    seconds = date.getSeconds();
  }

  const secAngle = (seconds / 60) * 360;
  const minAngle = (minutes / 60) * 360 + (seconds / 60) * 6;
  const hrAngle = (hours / 12) * 360 + (minutes / 60) * 30;

  const hrLen = r * 0.5;
  const minLen = r * 0.72;
  const secLen = r * 0.8;

  function handEnd(angle: number, length: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + length * Math.cos(rad), y: cy + length * Math.sin(rad) };
  }

  const hrEnd = handEnd(hrAngle, hrLen);
  const minEnd = handEnd(minAngle, minLen);
  const secEnd = handEnd(secAngle, secLen);

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 360;
    const rad = ((angle - 90) * Math.PI) / 180;
    const isHour = i % 3 === 0;
    const innerR = isHour ? r * 0.8 : r * 0.88;
    return {
      x1: cx + innerR * Math.cos(rad),
      y1: cy + innerR * Math.sin(rad),
      x2: cx + r * Math.cos(rad),
      y2: cy + r * Math.sin(rad),
      isHour,
    };
  });

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="1.5" opacity="0.4" />
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1} y1={t.y1}
          x2={t.x2} y2={t.y2}
          stroke={color}
          strokeWidth={t.isHour ? 2 : 1}
          opacity={t.isHour ? 0.8 : 0.4}
        />
      ))}
      <line x1={cx} y1={cy} x2={hrEnd.x} y2={hrEnd.y} stroke={color} strokeWidth="4" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={minEnd.x} y2={minEnd.y} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {showSeconds && (
        <line x1={cx} y1={cy} x2={secEnd.x} y2={secEnd.y} stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
      )}
      <circle cx={cx} cy={cy} r="2.5" fill={color} />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClockHotspot({ hotspot }: HotspotRendererProps) {
  const config = hotspot.configJson as unknown as ClockConfig;
  const clockStyle = config.clockStyle ?? "digital";
  const showSeconds = config.showSeconds ?? false;
  const hourFormat = config.hourFormat ?? "24";
  const showDate = config.showDate ?? false;
  const color = config.color ?? DEFAULT_COLOR;
  const fontSize = config.fontSize ?? null;
  const timezone = config.timezone ?? null;
  const timezoneLabel = config.timezoneLabel?.trim() || null;
  const configBg = config.backgroundColor ?? null;
  const bg =
    configBg === "transparent"
      ? "transparent"
      : configBg != null
        ? configBg
        : "rgba(255,255,255,0.08)";

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Day (6–20) or night in the target timezone
  const hour = getHourInTz(now, timezone);
  const isDaytime = hour >= 6 && hour < 20;
  const dayNightIcon = isDaytime ? "☀️" : "🌙";

  const tzAbbr = timezoneLabel ?? (timezone ? getTzAbbr(now, timezone) : null);

  return (
    <div
      className="relative flex h-full w-full select-none flex-col items-center justify-center gap-0.5 rounded-lg overflow-hidden"
      style={{ backgroundColor: bg, color }}
    >
      {clockStyle === "analog" ? (
        <>
          {/* Sun/moon badge in the top-right corner of the face */}
          <div className="relative flex-1 w-full min-h-0 p-2">
            <AnalogFace date={now} showSeconds={showSeconds} color={color} tz={timezone} />
            <span
              className="absolute top-1 right-1 leading-none select-none"
              style={{ fontSize: "clamp(8px, 18%, 18px)" }}
              aria-label={isDaytime ? "daytime" : "night"}
            >
              {dayNightIcon}
            </span>
          </div>
          {showDate && (
            <span
              className="shrink-0 text-center leading-none"
              style={{
                fontSize: fontSize != null ? `${Math.round(fontSize * 0.45)}px` : "clamp(8px, 15%, 14px)",
                opacity: 0.8,
              }}
            >
              {formatDate(now, timezone)}
            </span>
          )}
          {tzAbbr && (
            <span
              className="shrink-0 pb-1 text-center leading-none font-mono"
              style={{
                fontSize: fontSize != null ? `${Math.round(fontSize * 0.38)}px` : "clamp(7px, 12%, 12px)",
                opacity: 0.6,
              }}
            >
              {tzAbbr}
            </span>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 leading-none">
            <span
              aria-label={isDaytime ? "daytime" : "night"}
              style={{ fontSize: fontSize != null ? `${Math.round(fontSize * 0.7)}px` : "clamp(10px, 22%, 28px)" }}
            >
              {dayNightIcon}
            </span>
            <span
              className="font-mono tabular-nums font-semibold"
              style={{ fontSize: fontSize != null ? `${fontSize}px` : "clamp(10px, 30%, 36px)" }}
            >
              {formatTime(now, hourFormat, showSeconds, timezone)}
            </span>
          </div>
          {showDate && (
            <span
              className="font-mono tabular-nums leading-none"
              style={{
                fontSize: fontSize != null ? `${Math.round(fontSize * 0.55)}px` : "clamp(8px, 15%, 18px)",
                opacity: 0.75,
              }}
            >
              {formatDate(now, timezone)}
            </span>
          )}
          {tzAbbr && (
            <span
              className="font-mono leading-none"
              style={{
                fontSize: fontSize != null ? `${Math.round(fontSize * 0.45)}px` : "clamp(7px, 12%, 14px)",
                opacity: 0.6,
              }}
            >
              {tzAbbr}
            </span>
          )}
        </>
      )}
    </div>
  );
}
