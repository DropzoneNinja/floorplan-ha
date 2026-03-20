import { create } from "zustand";
import type { EntityState, HaConnectionStatus } from "@floorplan-ha/shared";

interface EntityStateStore {
  states: Map<string, EntityState>;
  connectionStatus: HaConnectionStatus;
  setStates: (states: EntityState[]) => void;
  updateState: (entityState: EntityState) => void;
  setConnectionStatus: (status: HaConnectionStatus) => void;
  getState: (entityId: string) => EntityState | undefined;
}

export const useEntityStateStore = create<EntityStateStore>((set, get) => ({
  states: new Map(),
  connectionStatus: { connected: false, lastConnectedAt: null, error: null },

  setStates: (states) => {
    const map = new Map<string, EntityState>();
    for (const s of states) map.set(s.entityId, s);
    set({ states: map });
  },

  updateState: (entityState) => {
    set((prev) => {
      const next = new Map(prev.states);
      next.set(entityState.entityId, entityState);
      return { states: next };
    });
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  getState: (entityId) => get().states.get(entityId),
}));
