import type { CSSProperties } from "react";

const CHECKERBOARD: CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,#555 25%,transparent 25%),linear-gradient(-45deg,#555 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#555 75%),linear-gradient(-45deg,transparent 75%,#555 75%)",
  backgroundSize: "6px 6px",
  backgroundPosition: "0 0,0 3px,3px -3px,-3px 0",
  backgroundColor: "#333",
};

/**
 * Color picker with transparent and optional "default" (null) support.
 *
 * - `value: string`        — always-a-color mode (hex or "transparent")
 * - `value: string | null` — with `nullable`, null means "use default styling"
 */
export function ColorPicker({
  value,
  onChange,
  nullable = false,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  nullable?: boolean;
}) {
  const isDefault = value === null;
  const isTransparent = value === "transparent";
  const colorValue = isDefault || isTransparent ? "#ffffff" : value;

  function handleSwatchChange(hex: string) {
    onChange(hex);
  }

  function handleTransparentClick() {
    if (isTransparent) {
      onChange(colorValue);
    } else {
      onChange("transparent");
    }
  }

  function handleDefaultClick() {
    onChange(isDefault ? colorValue : null);
  }

  return (
    <div className="flex gap-1">
      {/* Native color swatch */}
      <input
        type="color"
        value={colorValue}
        disabled={isTransparent || isDefault}
        onChange={(e) => handleSwatchChange(e.target.value)}
        className="h-8 flex-1 min-w-0 cursor-pointer rounded border border-white/10 bg-surface disabled:cursor-default disabled:opacity-30"
      />

      {/* Transparent toggle — checkerboard */}
      <button
        type="button"
        title={isTransparent ? "Remove transparent" : "Set transparent"}
        onClick={handleTransparentClick}
        className={[
          "h-8 w-8 shrink-0 overflow-hidden rounded border text-[11px] font-bold",
          isTransparent
            ? "border-accent bg-accent/20 text-accent"
            : "border-white/20 hover:border-white/40",
        ].join(" ")}
        style={!isTransparent ? CHECKERBOARD : undefined}
      >
        {isTransparent ? "✕" : ""}
      </button>

      {/* Default toggle — only when nullable */}
      {nullable && (
        <button
          type="button"
          title={isDefault ? "Remove default" : "Use default style"}
          onClick={handleDefaultClick}
          className={[
            "h-8 w-8 shrink-0 rounded border text-[11px] font-medium",
            isDefault
              ? "border-accent bg-accent/20 text-accent"
              : "border-white/20 text-gray-500 hover:border-white/40 hover:text-white",
          ].join(" ")}
        >
          auto
        </button>
      )}
    </div>
  );
}
