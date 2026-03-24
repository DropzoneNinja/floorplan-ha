import type { WindroseConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";
import { useEntityStateStore } from "../../store/entity-states.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

const CARDINALS = [
  { angle: 0, label: "N" },
  { angle: 90, label: "E" },
  { angle: 180, label: "S" },
  { angle: 270, label: "W" },
] as const;

const INTERCARDINALS = [
  { angle: 45, label: "NE" },
  { angle: 135, label: "SE" },
  { angle: 225, label: "SW" },
  { angle: 315, label: "NW" },
] as const;

const DEFAULT_ROSE_COLOR = "#60a5fa";
const DEFAULT_LABEL_COLOR = "rgba(255,255,255,0.85)";
const DEFAULT_LABEL_SIZE = 8;

// ─── Component ────────────────────────────────────────────────────────────────

export function WindroseHotspot({
  hotspot,
  entityState,
  ruleResult,
  isEditMode,
}: HotspotRendererProps) {
  const config = hotspot.configJson as WindroseConfig;
  const getState = useEntityStateStore((s) => s.getState);

  // ── Bearing (primary entity) ──────────────────────────────────────────────
  // Meteorological convention: bearing = direction wind comes FROM.
  // 0° = wind from north (blowing south), 90° = from east, etc.
  const rawBearing = entityState?.state ?? "";
  const bearing = parseFloat(rawBearing);
  const hasBearing = !isNaN(bearing);

  // ── Speed (secondary entity from config) ─────────────────────────────────
  const speedEntityId = config.speedEntityId ?? null;
  const speedState = speedEntityId ? getState(speedEntityId) : undefined;
  const speedValue = parseFloat(speedState?.state ?? "");
  const hasSpeed = !isNaN(speedValue);

  // ── Config ────────────────────────────────────────────────────────────────
  const northOffset = config.northOffset ?? 0;
  const showCardinals = config.showCardinals ?? true;
  const showIntercardinals = config.showIntercardinals ?? false;
  const bearingMode = config.bearingMode ?? "from";
  const speedUnit = config.speedUnit ?? "";
  const roseColor = config.roseColor ?? DEFAULT_ROSE_COLOR;
  const labelColor = config.labelColor ?? DEFAULT_LABEL_COLOR;
  const labelSize = config.labelSize ?? DEFAULT_LABEL_SIZE;

  // ── Derived angles ────────────────────────────────────────────────────────
  // Arrow points where wind blows into, offset by northOffset for the rotated ring.
  // "from" mode: entity is direction wind comes FROM, so flip 180° to get "into".
  // "into" mode: entity is already the destination direction, use directly.
  const flip = bearingMode === "from" ? 180 : 0;
  const arrowAngle = hasBearing ? ((bearing + flip + northOffset) % 360) : 0;

  // ── Display strings ───────────────────────────────────────────────────────
  const speedText = hasSpeed
    ? `${Math.round(speedValue * 10) / 10}${speedUnit ? ` ${speedUnit}` : ""}`
    : speedEntityId
      ? "—"
      : null;

  const opacity = ruleResult?.styleOverrides?.opacity ?? 1;

  // Muted versions for unavailable state
  const roseFaded = "rgba(255,255,255,0.12)";
  const labelFaded = "rgba(255,255,255,0.15)";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        opacity,
        cursor: isEditMode ? "default" : "default",
      }}
      aria-label={
        `${hotspot.name}: bearing ${hasBearing ? `${Math.round(bearing)}°` : "unavailable"}`
      }
    >
      <svg
        viewBox="0 0 100 100"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
        aria-hidden="true"
      >
        {/* ── Compass ring + labels (rotated by northOffset to align with map north) ── */}
        <g transform={`rotate(${northOffset}, 50, 50)`}>
          {/* Outer ring */}
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke={!hasBearing ? roseFaded : `${roseColor}60`}
            strokeWidth="1"
          />

          {/* Cardinal ticks and labels (N/S/E/W) */}
          {showCardinals &&
            CARDINALS.map(({ angle, label }) => (
              <CompassLabel
                key={label}
                angle={angle}
                label={label}
                isCardinal
                unavailable={!hasBearing}
                roseColor={roseColor}
                labelColor={labelColor}
                labelSize={labelSize}
              />
            ))}

          {/* Intercardinal ticks and labels (NE/SE/SW/NW) */}
          {showIntercardinals &&
            INTERCARDINALS.map(({ angle, label }) => (
              <CompassLabel
                key={label}
                angle={angle}
                label={label}
                isCardinal={false}
                unavailable={!hasBearing}
                roseColor={roseColor}
                labelColor={labelColor}
                labelSize={labelSize}
              />
            ))}
        </g>

        {/* ── Arrow (absolute bearing space, NOT rotated by northOffset) ── */}
        {/* Full-diameter: shaft runs from the tail edge through centre to the tip. */}
        <g
          transform={`rotate(${arrowAngle}, 50, 50)`}
          opacity={!hasBearing ? 0.15 : 1}
        >
          {/* Shaft — tail (y=90) to just below arrowhead base (y=21) */}
          <line
            x1="50"
            y1="90"
            x2="50"
            y2="21"
            stroke={roseColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Arrowhead */}
          <polygon
            points="50,10 45.5,21 54.5,21"
            fill={roseColor}
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        </g>

        {/* ── Speed text (always centred, never rotated) ── */}
        {speedText !== null && (
          <text
            x="50"
            y="67"
            textAnchor="middle"
            dominantBaseline="middle"
            fill={!hasBearing ? labelFaded : labelColor}
            fontSize={labelSize}
            fontWeight="600"
            fontFamily="system-ui, sans-serif"
          >
            {speedText}
          </text>
        )}
      </svg>
    </div>
  );
}

// ─── CompassLabel ─────────────────────────────────────────────────────────────

/**
 * Renders a tick mark and text label at the given compass angle.
 * Angle 0 = north (SVG up). The parent <g> applies the northOffset rotation.
 */
function CompassLabel({
  angle,
  label,
  isCardinal,
  unavailable,
  roseColor,
  labelColor,
  labelSize,
}: {
  angle: number;
  label: string;
  isCardinal: boolean;
  unavailable: boolean;
  roseColor: string;
  labelColor: string;
  labelSize: number;
}) {
  // Convert SVG degrees (0 = up/north, clockwise) to standard math radians.
  const rad = ((angle - 90) * Math.PI) / 180;

  const ringR = 44;
  const tickLength = isCardinal ? 5 : 3;
  const labelR = 49.5;

  const ox = 50 + ringR * Math.cos(rad);
  const oy = 50 + ringR * Math.sin(rad);
  const ix = 50 + (ringR - tickLength) * Math.cos(rad);
  const iy = 50 + (ringR - tickLength) * Math.sin(rad);
  const lx = 50 + labelR * Math.cos(rad);
  const ly = 50 + labelR * Math.sin(rad);

  const fontSize = isCardinal ? labelSize : labelSize * 0.75;
  // Intercardinal labels are slightly dimmed relative to the chosen color
  const textFill = unavailable
    ? "rgba(255,255,255,0.15)"
    : isCardinal
      ? labelColor
      : `${labelColor}80`;

  return (
    <g>
      <line
        x1={ix}
        y1={iy}
        x2={ox}
        y2={oy}
        stroke={unavailable ? "rgba(255,255,255,0.10)" : `${roseColor}80`}
        strokeWidth={isCardinal ? 1.5 : 1}
      />
      <text
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight={isCardinal ? "700" : "500"}
        fontFamily="system-ui, sans-serif"
        fill={textFill}
      >
        {label}
      </text>
    </g>
  );
}
