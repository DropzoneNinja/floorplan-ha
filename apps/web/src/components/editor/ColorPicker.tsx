/**
 * A color picker that also supports "transparent" as a value.
 * Renders a native color swatch alongside a checkerboard transparent toggle.
 */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isTransparent = value === "transparent";
  // Keep last hex color so toggling transparent → color restores the previous pick
  const colorValue = isTransparent ? "#ffffff" : value;

  return (
    <div className="flex gap-1">
      <input
        type="color"
        value={colorValue}
        disabled={isTransparent}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 flex-1 min-w-0 cursor-pointer rounded border border-white/10 bg-surface disabled:cursor-default disabled:opacity-30"
      />
      <button
        type="button"
        title={isTransparent ? "Remove transparent" : "Set transparent"}
        onClick={() => onChange(isTransparent ? colorValue : "transparent")}
        className={[
          "h-8 w-8 shrink-0 overflow-hidden rounded border text-[11px] font-bold",
          isTransparent
            ? "border-accent bg-accent/20 text-accent"
            : "border-white/20 hover:border-white/40",
        ].join(" ")}
        style={
          !isTransparent
            ? {
                backgroundImage:
                  "linear-gradient(45deg,#555 25%,transparent 25%),linear-gradient(-45deg,#555 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#555 75%),linear-gradient(-45deg,transparent 75%,#555 75%)",
                backgroundSize: "6px 6px",
                backgroundPosition: "0 0,0 3px,3px -3px,-3px 0",
                backgroundColor: "#333",
              }
            : undefined
        }
      >
        {isTransparent ? "✕" : ""}
      </button>
    </div>
  );
}
