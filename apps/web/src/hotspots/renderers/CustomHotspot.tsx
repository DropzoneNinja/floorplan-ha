import type { HotspotRendererProps } from "../types.ts";

/**
 * Custom hotspot: an extension point for user-defined hotspot types.
 *
 * In presentation mode this renders nothing — custom types are expected to
 * replace this renderer by registering their own definition in the registry
 * via `registerHotspotType()`.
 *
 * In edit mode a clearly labelled placeholder is shown so the hotspot can
 * be selected and configured.
 *
 * See docs/extending-hotspots.md for instructions on creating a custom type.
 */
export function CustomHotspot({ hotspot, isEditMode }: HotspotRendererProps) {
  if (!isEditMode) {
    // Silent in presentation mode — add your own renderer via the registry
    return null;
  }

  return (
    <div
      className={[
        "flex h-full w-full flex-col items-center justify-center gap-0.5 rounded",
        "border border-dashed border-purple-500/50 bg-purple-900/20",
      ].join(" ")}
      aria-label={`Custom hotspot: ${hotspot.name}`}
    >
      <span className="text-[11px] font-semibold text-purple-400">Custom</span>
      <span className="max-w-full truncate px-1 text-[9px] text-gray-500">{hotspot.name}</span>
    </div>
  );
}
