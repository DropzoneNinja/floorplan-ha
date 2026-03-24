import { create } from "zustand";

interface PendingItem {
  id: string;
  name: string;
  entityId: string;
}

interface PlacementState {
  /** ID of the battery hotspot being edited */
  hotspotId: string;
  /** Non-null when repositioning an existing item */
  repositioningItemId: string | null;
  /** Non-null when placing a brand-new item */
  pendingItem: PendingItem | null;
}

interface BatteryPlacementStore {
  placement: PlacementState | null;
  /** Enter placement mode to drop a new battery item onto the canvas */
  startPlacement: (hotspotId: string, pendingItem: PendingItem) => void;
  /** Enter placement mode to move an existing battery item */
  startReposition: (hotspotId: string, itemId: string) => void;
  cancel: () => void;
}

export const useBatteryPlacementStore = create<BatteryPlacementStore>((set) => ({
  placement: null,
  startPlacement: (hotspotId, pendingItem) =>
    set({ placement: { hotspotId, repositioningItemId: null, pendingItem } }),
  startReposition: (hotspotId, itemId) =>
    set({ placement: { hotspotId, repositioningItemId: itemId, pendingItem: null } }),
  cancel: () => set({ placement: null }),
}));
