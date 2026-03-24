import { create } from "zustand";

interface HeatmapStore {
  isVisible: boolean;
  toggle: () => void;
  hide: () => void;
}

export const useHeatmapStore = create<HeatmapStore>((set) => ({
  isVisible: false,
  toggle: () => set((s) => ({ isVisible: !s.isVisible })),
  hide: () => set({ isVisible: false }),
}));
