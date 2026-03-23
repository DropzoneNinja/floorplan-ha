import type { HotspotRaw } from "../../hotspots/types.ts";

interface HotspotListPanelProps {
  hotspots: HotspotRaw[];
  highlightedId: string | null;
  onHighlight: (id: string | null) => void;
  onEdit: (id: string) => void;
}

/**
 * Sidebar panel shown when no hotspot is selected in edit mode.
 * Hotspots are grouped by z-index layer. Hovering a row pulses the canvas
 * outline; clicking opens the inspector.
 */
export function HotspotListPanel({ hotspots, highlightedId, onHighlight, onEdit }: HotspotListPanelProps) {
  // Group by zIndex, sorted layer ascending, hotspots within each layer by name
  const layers = buildLayers(hotspots);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center border-b border-white/10 px-3 py-2">
        <span className="text-[11px] font-medium text-white">Hotspots</span>
        <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
          {hotspots.length}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {hotspots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-gray-600">
            <p className="text-xs">No hotspots yet</p>
            <p className="text-xs">Click "+ Add Hotspot" to place one</p>
          </div>
        ) : (
          <div className="py-1">
            {layers.map(({ zIndex, items }) => (
              <div key={zIndex}>
                {/* Layer group header */}
                <div className="px-3 pb-0.5 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                  Layer {zIndex}
                </div>

                <ul>
                  {items.map((hotspot) => {
                    const isHighlighted = hotspot.id === highlightedId;
                    return (
                      <li
                        key={hotspot.id}
                        className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-white/5 ${isHighlighted ? "bg-amber-500/10" : ""}`}
                        onMouseEnter={() => onHighlight(hotspot.id)}
                        onMouseLeave={() => onHighlight(null)}
                        onClick={() => onEdit(hotspot.id)}
                      >
                        {/* Highlight indicator dot */}
                        <span
                          className={`shrink-0 h-1.5 w-1.5 rounded-full ${isHighlighted ? "bg-amber-400" : "bg-white/20"}`}
                        />

                        {/* Name */}
                        <span
                          className={`min-w-0 flex-1 truncate text-xs ${isHighlighted ? "text-amber-300" : "text-gray-300"}`}
                          title={hotspot.name}
                        >
                          {hotspot.name}
                        </span>

                        {/* Type badge */}
                        <span className="shrink-0 rounded bg-white/10 px-1 py-0.5 text-[9px] text-gray-500">
                          {hotspot.type}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-white/10 px-3 py-2 text-[10px] text-gray-700">
        Hover to locate · Click to edit
      </div>
    </div>
  );
}

function buildLayers(hotspots: HotspotRaw[]): { zIndex: number; items: HotspotRaw[] }[] {
  const map = new Map<number, HotspotRaw[]>();
  for (const h of hotspots) {
    const bucket = map.get(h.zIndex) ?? [];
    bucket.push(h);
    map.set(h.zIndex, bucket);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b - a)
    .map(([zIndex, items]) => ({
      zIndex,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
