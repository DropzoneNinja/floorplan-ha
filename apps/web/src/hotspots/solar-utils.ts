import type { EntityState, SolarConfig } from "@floorplan-ha/shared";
import { readWatts } from "./power-utils.ts";

export { fmtWatts, readWatts } from "./power-utils.ts";

/** Fixed amber/yellow used for solar production, regardless of magnitude. */
export const SOLAR_COLOR = "#fbbf24";
/** Used for grid import (drawing power from the street). */
export const GRID_IMPORT_COLOR = "#3b82f6";
/** Used for grid export (feeding excess solar back to the street). */
export const GRID_EXPORT_COLOR = "#a855f7";
/** Used for the house's combined consumption. */
export const CONSUMPTION_COLOR = "#4ade80";
/** Neutral color for an unconfigured/idle box. */
export const IDLE_COLOR = "#6b7280";

export interface HouseConsumption {
  /** Sum of every panel's current reading, or null if none have one. */
  solarTotal: number | null;
  /** Signed grid reading (+import / −export), or null if no grid sensor is configured. */
  gridWatts: number | null;
  /** solarTotal + gridWatts — the actual total power entering the house. Null if both are unknown. */
  consumption: number | null;
}

/**
 * Computes a Solar hotspot's house consumption (solar produced + grid import −
 * grid export) from live entity state. Shared by the Solar house box badge and
 * by anything elsewhere (e.g. the Power hotspot's house connector line) that
 * wants the same "total power entering the house" figure.
 */
export function computeHouseConsumption(
  config: SolarConfig,
  getState: (entityId: string) => EntityState | undefined,
): HouseConsumption {
  let solarTotal: number | null = null;
  for (const panel of config.panels ?? []) {
    const watts = readWatts(getState(panel.entityId));
    if (watts !== null) solarTotal = (solarTotal ?? 0) + watts;
  }
  const gridWatts = config.gridBox?.entityId ? readWatts(getState(config.gridBox.entityId)) : null;
  const consumption = solarTotal !== null || gridWatts !== null ? (solarTotal ?? 0) + (gridWatts ?? 0) : null;
  return { solarTotal, gridWatts, consumption };
}
