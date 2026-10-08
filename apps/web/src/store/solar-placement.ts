import { create } from "zustand";

export type SolarBoxKind = "junction" | "house" | "grid";

interface PendingPanel {
  id: string;
  name: string;
  entityId: string;
}

interface PlacementState {
  /** ID of the solar hotspot being edited */
  hotspotId: string;
  /** "panel" places/repositions a panel tile; the others place/move a single box */
  kind: "panel" | SolarBoxKind;
  /** Non-null when repositioning an existing panel */
  repositioningPanelId: string | null;
  /** Non-null when placing a brand-new panel */
  pendingPanel: PendingPanel | null;
}

interface SolarPlacementStore {
  placement: PlacementState | null;
  /** Enter placement mode to drop a new panel onto the canvas */
  startPlacePanel: (hotspotId: string, pendingPanel: PendingPanel) => void;
  /** Enter placement mode to move an existing panel */
  startRepositionPanel: (hotspotId: string, panelId: string) => void;
  /** Enter placement mode to place or move the junction/house/grid box (single instance) */
  startPlaceBox: (hotspotId: string, kind: SolarBoxKind) => void;
  cancel: () => void;
}

export const useSolarPlacementStore = create<SolarPlacementStore>((set) => ({
  placement: null,
  startPlacePanel: (hotspotId, pendingPanel) =>
    set({ placement: { hotspotId, kind: "panel", repositioningPanelId: null, pendingPanel } }),
  startRepositionPanel: (hotspotId, panelId) =>
    set({ placement: { hotspotId, kind: "panel", repositioningPanelId: panelId, pendingPanel: null } }),
  startPlaceBox: (hotspotId, kind) =>
    set({ placement: { hotspotId, kind, repositioningPanelId: null, pendingPanel: null } }),
  cancel: () => set({ placement: null }),
}));
