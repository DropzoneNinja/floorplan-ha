import type { EntityState } from "@floorplan-ha/shared";
import type { HaStateResponse } from "./types.js";

/**
 * Convert a raw HA state API response to an internal EntityState.
 * This ensures our app never directly depends on HA's raw shape.
 */
export function normalizeState(raw: HaStateResponse): EntityState {
  return {
    entityId: raw.entity_id,
    state: raw.state,
    attributes: raw.attributes,
    lastChanged: raw.last_changed,
    lastUpdated: raw.last_updated,
  };
}

export function normalizeStates(raw: HaStateResponse[]): EntityState[] {
  return raw.map(normalizeState);
}
