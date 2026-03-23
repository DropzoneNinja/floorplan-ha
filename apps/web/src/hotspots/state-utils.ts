/** States considered "active/on" for icon color and shape selection. */
export const ON_STATES = new Set([
  "on", "open", "active", "playing", "home", "unlocked",
  "detected", "motion", "true", "armed_home", "armed_away",
]);

/**
 * Returns true when the given HA state string should be treated as "on".
 * Comparison is case-insensitive.
 */
export function isOnState(state: string): boolean {
  return ON_STATES.has(state.toLowerCase());
}
