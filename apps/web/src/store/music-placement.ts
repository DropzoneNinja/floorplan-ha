import { create } from "zustand";

interface PendingItem {
  id: string;
  name: string;
  entityId: string | null;
}

interface PlacementState {
  /** ID of the music hotspot being edited */
  hotspotId: string;
  /** Non-null when repositioning an existing speaker */
  repositioningItemId: string | null;
  /** Non-null when placing a brand-new speaker */
  pendingItem: PendingItem | null;
}

interface MusicPlacementStore {
  placement: PlacementState | null;
  /** Enter placement mode to drop a new speaker onto the canvas */
  startPlacement: (hotspotId: string, pendingItem: PendingItem) => void;
  /** Enter placement mode to move an existing speaker */
  startReposition: (hotspotId: string, itemId: string) => void;
  cancel: () => void;
}

export const useMusicPlacementStore = create<MusicPlacementStore>((set) => ({
  placement: null,
  startPlacement: (hotspotId, pendingItem) =>
    set({ placement: { hotspotId, repositioningItemId: null, pendingItem } }),
  startReposition: (hotspotId, itemId) =>
    set({ placement: { hotspotId, repositioningItemId: itemId, pendingItem: null } }),
  cancel: () => set({ placement: null }),
}));
