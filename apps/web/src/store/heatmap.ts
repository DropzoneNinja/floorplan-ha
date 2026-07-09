import { create } from "zustand";

interface HeatmapStore {
  isVisible: boolean;
  /** zIndex of the hotspot that last triggered the heatmap */
  triggeredByZIndex: number;
  /** Which metric temperature gauges currently display, and colour the heatmap by. */
  metric: "temperature" | "humidity";
  toggle: (zIndex: number) => void;
  hide: () => void;
  setMetric: (metric: "temperature" | "humidity") => void;
}

export const useHeatmapStore = create<HeatmapStore>((set) => ({
  isVisible: false,
  triggeredByZIndex: 0,
  metric: "temperature",
  toggle: (zIndex) => set((s) => ({ isVisible: !s.isVisible, triggeredByZIndex: zIndex })),
  hide: () => set({ isVisible: false }),
  setMetric: (metric) => set({ metric }),
}));
