import { create } from "zustand";

interface PowerpointStore {
  visibleHotspotId: string | null;
  triggeredByZIndex: number;
  toggle: (id: string, zIndex: number) => void;
  hide: () => void;
}

export const usePowerpointStore = create<PowerpointStore>((set) => ({
  visibleHotspotId: null,
  triggeredByZIndex: 0,
  toggle: (id, zIndex) =>
    set((s) => ({
      visibleHotspotId: s.visibleHotspotId === id ? null : id,
      triggeredByZIndex: zIndex,
    })),
  hide: () => set({ visibleHotspotId: null }),
}));
