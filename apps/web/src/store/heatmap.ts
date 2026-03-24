import { create } from "zustand";

interface HeatmapStore {
  isVisible: boolean;
  /** zIndex of the hotspot that last triggered the heatmap */
  triggeredByZIndex: number;
  toggle: (zIndex: number) => void;
  hide: () => void;
}

export const useHeatmapStore = create<HeatmapStore>((set) => ({
  isVisible: false,
  triggeredByZIndex: 0,
  toggle: (zIndex) => set((s) => ({ isVisible: !s.isVisible, triggeredByZIndex: zIndex })),
  hide: () => set({ isVisible: false }),
}));
