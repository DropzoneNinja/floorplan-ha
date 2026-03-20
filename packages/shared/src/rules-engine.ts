import type { Condition, HotspotStateRule, RuleResult } from "./types.js";

/**
 * Evaluate a single condition against an entity state string.
 * Returns true if the condition matches.
 */
function evaluateCondition(condition: Condition, state: string): boolean {
  switch (condition.type) {
    case "exact_match":
      return state === condition.value;

    case "numeric_range": {
      const num = parseFloat(state);
      if (isNaN(num)) return false;
      if (condition.min !== undefined && num < condition.min) return false;
      if (condition.max !== undefined && num > condition.max) return false;
      return true;
    }

    case "truthy":
      return (
        state !== "" &&
        state !== "0" &&
        state !== "off" &&
        state !== "closed" &&
        state !== "false" &&
        state !== "unavailable" &&
        state !== "unknown"
      );

    case "falsy":
      return (
        state === "" ||
        state === "0" ||
        state === "off" ||
        state === "closed" ||
        state === "false" ||
        state === "unavailable" ||
        state === "unknown"
      );

    case "fallback":
      return true;
  }
}

/**
 * Evaluate a list of state rules against an entity state.
 * Rules must be sorted by priority (lower number = higher priority) before calling.
 * Returns the RuleResult of the first matching rule, or null if none match.
 */
export function evaluateRules(
  rules: Pick<HotspotStateRule, "priority" | "condition" | "result">[],
  state: string,
): RuleResult | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    if (evaluateCondition(rule.condition, state)) {
      return rule.result;
    }
  }

  return null;
}

/**
 * Merge a base style with rule result style overrides.
 * Useful for applying conditional styling to hotspot renderers.
 */
export function mergeRuleResult(
  base: Partial<RuleResult>,
  override: RuleResult | null,
): Partial<RuleResult> {
  if (!override) return base;
  return {
    ...base,
    ...override,
    styleOverrides: {
      ...base.styleOverrides,
      ...override.styleOverrides,
    },
  };
}
