const ON_COLOR = "#facc15"; // yellow-400 — matches the on-state color used by LightHotspot/BatteryHotspot
const OFF_COLOR = "#6b7280"; // gray-500
const PIN_ON_COLOR = "#111827"; // near-black — keeps the pins readable against the highlighted "on" circle

/**
 * A single AS/NZS 3112 pin recess: two angled active/neutral pins forming an
 * inverted V, plus a vertical earth pin below. When `on`, the circle itself
 * is highlighted amber while the pins stay near-black for contrast; when
 * off, everything is neutral gray.
 */
function SocketPins({ cx, cy, r, on }: { cx: number; cy: number; r: number; on: boolean }) {
  const ringColor = on ? ON_COLOR : OFF_COLOR;
  const pinColor = on ? PIN_ON_COLOR : OFF_COLOR;
  const strokeWidth = r * 0.15;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={on ? ON_COLOR : "#374151"} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={ringColor} strokeWidth={r * 0.14} />
      {/* Earth pin — vertical, below center, clear of the two angled pins above it */}
      <line
        x1={cx}
        y1={cy + r * 0.22}
        x2={cx}
        y2={cy + r * 0.72}
        stroke={pinColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Neutral pin — angled, upper-left quadrant, stays clear of center and the active pin */}
      <line
        x1={cx - r * 0.5}
        y1={cy - r * 0.07}
        x2={cx - r * 0.21}
        y2={cy - r * 0.57}
        stroke={pinColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Active pin — mirrored in the upper-right quadrant */}
      <line
        x1={cx + r * 0.5}
        y1={cy - r * 0.07}
        x2={cx + r * 0.21}
        y2={cy - r * 0.57}
        stroke={pinColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </g>
  );
}

interface AustralianSocketIconProps {
  /** Whether the left socket is currently on */
  leftOn?: boolean;
  /** Whether the right socket is currently on */
  rightOn?: boolean;
  /** Rendered width in px — height follows the icon's fixed aspect ratio */
  size?: number;
  className?: string | undefined;
}

/**
 * A tiny Australian double power point (GPO) — a rounded faceplate with two
 * side-by-side socket recesses, each showing the AS/NZS 3112 pin pattern.
 * Used for the floorplan pin and the aggregate hotspot icon.
 */
export function AustralianSocketIcon({
  leftOn = false,
  rightOn = false,
  size = 28,
  className,
}: AustralianSocketIconProps) {
  const viewW = 48;
  const viewH = 32;
  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      width={size}
      height={(size * viewH) / viewW}
      className={className}
      aria-hidden="true"
    >
      <rect x="1" y="1" width={viewW - 2} height={viewH - 2} rx="5" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1.25" />
      <line x1={viewW / 2} y1="4" x2={viewW / 2} y2={viewH - 4} stroke="#9ca3af" strokeWidth="1" />
      <SocketPins cx={viewW * 0.27} cy={viewH / 2} r={10} on={leftOn} />
      <SocketPins cx={viewW * 0.73} cy={viewH / 2} r={10} on={rightOn} />
    </svg>
  );
}

interface AustralianSocketOutletProps {
  /** Whether this outlet is currently on */
  on: boolean;
  /** Rendered width in px — height follows the icon's fixed aspect ratio */
  size?: number;
  className?: string | undefined;
}

/**
 * A single Australian socket recess with no surrounding faceplate — meant to
 * be placed inside its own tappable control (e.g. two side-by-side buttons
 * in the powerpoint dialog, with the shared faceplate drawn by the caller).
 */
export function AustralianSocketOutlet({ on, size = 56, className }: AustralianSocketOutletProps) {
  const viewSize = 32;
  return (
    <svg viewBox={`0 0 ${viewSize} ${viewSize}`} width={size} height={size} className={className} aria-hidden="true">
      <SocketPins cx={viewSize / 2} cy={viewSize / 2} r={14} on={on} />
    </svg>
  );
}
