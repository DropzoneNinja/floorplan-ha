import { create } from "zustand";
import { useHeatmapStore } from "./heatmap.ts";

export type PowerViewMode = "heatmap" | "aggregate";

interface PowerStore {
  visibleHotspotId: string | null;
  mode: PowerViewMode;
  triggeredByZIndex: number;
  cycle: (id: string, zIndex: number) => void;
  hide: () => void;
}

/**
 * Overlay state for the Power hotspot. The power heatmap replaces the temperature
 * heatmap, so only one heatmap is on screen at a time: showing power hides the
 * temperature heatmap here, and tapping a temperature gauge hides this overlay.
 *
 * Clicking the icon cycles collapsed -> heatmap (individual sensors) -> aggregate
 * (combined usage graph) -> collapsed.
 */
export const usePowerStore = create<PowerStore>((set, get) => ({
  visibleHotspotId: null,
  mode: "heatmap",
  triggeredByZIndex: 0,
  cycle: (id, zIndex) => {
    const { visibleHotspotId, mode } = get();
    if (visibleHotspotId !== id) {
      useHeatmapStore.getState().hide();
      set({ visibleHotspotId: id, mode: "heatmap", triggeredByZIndex: zIndex });
      return;
    }
    if (mode === "heatmap") {
      set({ mode: "aggregate" });
      return;
    }
    set({ visibleHotspotId: null, mode: "heatmap" });
  },
  hide: () => set({ visibleHotspotId: null, mode: "heatmap" }),
}));
