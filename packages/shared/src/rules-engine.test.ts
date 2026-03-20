import { describe, it, expect } from "vitest";
import { evaluateRules } from "./rules-engine.js";
import type { HotspotStateRule } from "./types.js";

function makeRule(
  priority: number,
  condition: HotspotStateRule["condition"],
  result: HotspotStateRule["result"],
): Pick<HotspotStateRule, "priority" | "condition" | "result"> {
  return { priority, condition, result };
}

describe("evaluateRules", () => {
  it("returns null when no rules match", () => {
    const rules = [makeRule(0, { type: "exact_match", value: "on" }, { hidden: false })];
    expect(evaluateRules(rules, "off")).toBeNull();
  });

  it("matches exact_match condition", () => {
    const rules = [makeRule(0, { type: "exact_match", value: "on" }, { hidden: false })];
    expect(evaluateRules(rules, "on")).toEqual({ hidden: false });
  });

  it("matches numeric_range condition", () => {
    const rules = [
      makeRule(0, { type: "numeric_range", min: 20, max: 30 }, { styleOverrides: { color: "blue" } }),
    ];
    expect(evaluateRules(rules, "25")).toEqual({ styleOverrides: { color: "blue" } });
    expect(evaluateRules(rules, "10")).toBeNull();
    expect(evaluateRules(rules, "35")).toBeNull();
  });

  it("matches truthy condition", () => {
    const rules = [makeRule(0, { type: "truthy" }, { styleOverrides: { color: "green" } })];
    expect(evaluateRules(rules, "on")).toEqual({ styleOverrides: { color: "green" } });
    expect(evaluateRules(rules, "off")).toBeNull();
    expect(evaluateRules(rules, "unavailable")).toBeNull();
  });

  it("matches falsy condition", () => {
    const rules = [makeRule(0, { type: "falsy" }, { hidden: true })];
    expect(evaluateRules(rules, "off")).toEqual({ hidden: true });
    expect(evaluateRules(rules, "on")).toBeNull();
  });

  it("fallback always matches", () => {
    const rules = [makeRule(10, { type: "fallback" }, { styleOverrides: { opacity: 0.5 } })];
    expect(evaluateRules(rules, "anything")).toEqual({ styleOverrides: { opacity: 0.5 } });
  });

  it("respects priority order (lower priority number wins)", () => {
    const rules = [
      makeRule(10, { type: "fallback" }, { styleOverrides: { color: "gray" } }),
      makeRule(0, { type: "exact_match", value: "on" }, { styleOverrides: { color: "yellow" } }),
    ];
    expect(evaluateRules(rules, "on")).toEqual({ styleOverrides: { color: "yellow" } });
    expect(evaluateRules(rules, "off")).toEqual({ styleOverrides: { color: "gray" } });
  });

  it("returns null for non-numeric state in numeric_range", () => {
    const rules = [makeRule(0, { type: "numeric_range", min: 0, max: 100 }, {})];
    expect(evaluateRules(rules, "unavailable")).toBeNull();
  });
});
