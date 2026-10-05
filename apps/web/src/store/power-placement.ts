import { create } from "zustand";

interface PendingItem {
  id: string;
  name: string;
  entityId: string;
}

interface PlacementState {
  /** ID of the power hotspot being edited */
  hotspotId: string;
  /** Non-null when repositioning an existing sensor */
  repositioningItemId: string | null;
  /** Non-null when placing a brand-new sensor */
  pendingItem: PendingItem | null;
}

interface PowerPlacementStore {
  placement: PlacementState | null;
  /** Enter placement mode to drop a new power sensor onto the canvas */
  startPlacement: (hotspotId: string, pendingItem: PendingItem) => void;
  /** Enter placement mode to move an existing power sensor */
  startReposition: (hotspotId: string, itemId: string) => void;
  cancel: () => void;
}

export const usePowerPlacementStore = create<PowerPlacementStore>((set) => ({
  placement: null,
  startPlacement: (hotspotId, pendingItem) =>
    set({ placement: { hotspotId, repositioningItemId: null, pendingItem } }),
  startReposition: (hotspotId, itemId) =>
    set({ placement: { hotspotId, repositioningItemId: itemId, pendingItem: null } }),
  cancel: () => set({ placement: null }),
}));
