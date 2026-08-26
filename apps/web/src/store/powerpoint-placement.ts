import { create } from "zustand";
import type { PowerpointOutlet } from "@floorplan-ha/shared";

interface PendingItem {
  id: string;
  name: string;
  outletA: PowerpointOutlet;
  outletB: PowerpointOutlet;
}

interface PlacementState {
  /** ID of the powerpoint hotspot being edited */
  hotspotId: string;
  /** Non-null when repositioning an existing item */
  repositioningItemId: string | null;
  /** Non-null when placing a brand-new item */
  pendingItem: PendingItem | null;
}

interface PowerpointPlacementStore {
  placement: PlacementState | null;
  /** Enter placement mode to drop a new powerpoint item onto the canvas */
  startPlacement: (hotspotId: string, pendingItem: PendingItem) => void;
  /** Enter placement mode to move an existing powerpoint item */
  startReposition: (hotspotId: string, itemId: string) => void;
  cancel: () => void;
}

export const usePowerpointPlacementStore = create<PowerpointPlacementStore>((set) => ({
  placement: null,
  startPlacement: (hotspotId, pendingItem) =>
    set({ placement: { hotspotId, repositioningItemId: null, pendingItem } }),
  startReposition: (hotspotId, itemId) =>
    set({ placement: { hotspotId, repositioningItemId: itemId, pendingItem: null } }),
  cancel: () => set({ placement: null }),
}));
