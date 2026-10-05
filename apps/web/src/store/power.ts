import { create } from "zustand";
import { useHeatmapStore } from "./heatmap.ts";

interface PowerStore {
  visibleHotspotId: string | null;
  triggeredByZIndex: number;
  toggle: (id: string, zIndex: number) => void;
  hide: () => void;
}

/**
 * Overlay state for the Power hotspot. The power heatmap replaces the temperature
 * heatmap, so only one heatmap is on screen at a time: showing power hides the
 * temperature heatmap here, and tapping a temperature gauge hides this overlay.
 */
export const usePowerStore = create<PowerStore>((set, get) => ({
  visibleHotspotId: null,
  triggeredByZIndex: 0,
  toggle: (id, zIndex) => {
    if (get().visibleHotspotId === id) {
      set({ visibleHotspotId: null });
      return;
    }
    useHeatmapStore.getState().hide();
    set({ visibleHotspotId: id, triggeredByZIndex: zIndex });
  },
  hide: () => set({ visibleHotspotId: null }),
}));
