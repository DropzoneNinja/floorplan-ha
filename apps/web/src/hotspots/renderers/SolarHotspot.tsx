import type { HotspotRendererProps } from "../types.ts";

/**
 * Solar hotspot's own anchor box.
 *
 * Unlike the Power/Powerpoint/Music hotspots, Solar has no master icon or
 * show/hide toggle — every panel, the junction box, the house box, and the
 * grid box are always drawn directly by SolarOverlayLayer at their own
 * placed positions. This renderer only gives the admin something to select
 * in edit mode; it draws nothing in presentation mode.
 */
export function SolarHotspot({ isEditMode }: HotspotRendererProps) {
  if (!isEditMode) return null;

  return (
    <div className="flex h-full w-full select-none items-center justify-center rounded-lg border border-dashed border-amber-400/40 bg-amber-400/10 px-1 text-center">
      <span className="text-[10px] font-medium leading-tight text-amber-300">
        ☀ Solar Energy — configure in Actions tab
      </span>
    </div>
  );
}
