import { useState } from "react";
import type { Condition, ConditionType, RuleResult } from "@floorplan-ha/shared";
import type { StateRuleRaw } from "../../hotspots/types.ts";
import { ColorPicker } from "./ColorPicker.tsx";

type DraftRule = {
  id: string; // local draft id (may be "new-xxx" for unsaved rules)
  priority: number;
  conditionType: ConditionType;
  conditionJson: Condition;
  resultJson: RuleResult;
};

function ruleFromRaw(r: StateRuleRaw): DraftRule {
  return {
    id: r.id,
    priority: r.priority,
    conditionType: r.conditionType as ConditionType,
    conditionJson: r.conditionJson,
    resultJson: r.resultJson,
  };
}

function defaultCondition(type: ConditionType): Condition {
  switch (type) {
    case "exact_match":   return { type: "exact_match", value: "" };
    case "numeric_range": return { type: "numeric_range", min: 0, max: 100 };
    case "truthy":        return { type: "truthy" };
    case "falsy":         return { type: "falsy" };
    case "fallback":      return { type: "fallback" };
  }
}

function defaultResult(): RuleResult {
  return { styleOverrides: { color: "#ffffff" } };
}

interface StateRulesFormProps {
  rules: StateRuleRaw[];
  onChange: (rules: StateRuleRaw[]) => void;
}

/**
 * Editor for the list of state rules on a hotspot.
 * Supports add, edit, delete, and priority reordering.
 */
export function StateRulesForm({ rules, onChange }: StateRulesFormProps) {
  const [drafts, setDrafts] = useState<DraftRule[]>(() => rules.map(ruleFromRaw));
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const commit = (next: DraftRule[]) => {
    setDrafts(next);
    // Convert back to StateRuleRaw format (best-effort — new rules get placeholder IDs)
    onChange(
      next.map((d, i) => ({
        id: d.id,
        hotspotId: rules[0]?.hotspotId ?? "",
        priority: i + 1,
        conditionType: d.conditionType,
        conditionJson: d.conditionJson,
        resultJson: d.resultJson,
        createdAt: "",
        updatedAt: "",
      })),
    );
  };

  const addRule = () => {
    const id = `new-${Date.now()}`;
    const next: DraftRule = {
      id,
      priority: drafts.length + 1,
      conditionType: "exact_match",
      conditionJson: defaultCondition("exact_match"),
      resultJson: defaultResult(),
    };
    const updated = [...drafts, next];
    setDrafts(updated);
    setExpandedId(id);
    commit(updated);
  };

  const removeRule = (id: string) => {
    const updated = drafts.filter((d) => d.id !== id);
    if (expandedId === id) setExpandedId(null);
    commit(updated);
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...drafts];
    const tmp = next[idx - 1]!;
    next[idx - 1] = next[idx]!;
    next[idx] = tmp;
    commit(next);
  };

  const moveDown = (idx: number) => {
    if (idx === drafts.length - 1) return;
    const next = [...drafts];
    const tmp = next[idx]!;
    next[idx] = next[idx + 1]!;
    next[idx + 1] = tmp;
    commit(next);
  };

  const updateRule = (id: string, patch: Partial<DraftRule>) => {
    const next = drafts.map((d) => (d.id === id ? { ...d, ...patch } : d));
    commit(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">State Rules</span>
        <button
          type="button"
          onClick={addRule}
          className="rounded bg-accent/20 px-2 py-0.5 text-[11px] text-accent hover:bg-accent/30"
        >
          + Add Rule
        </button>
      </div>

      {drafts.length === 0 && (
        <p className="text-[11px] text-gray-600">No rules — hotspot will show its default state.</p>
      )}

      {drafts.map((rule, idx) => (
        <RuleCard
          key={rule.id}
          rule={rule}
          isFirst={idx === 0}
          isLast={idx === drafts.length - 1}
          isExpanded={expandedId === rule.id}
          onToggleExpand={() => setExpandedId(expandedId === rule.id ? null : rule.id)}
          onMoveUp={() => moveUp(idx)}
          onMoveDown={() => moveDown(idx)}
          onRemove={() => removeRule(rule.id)}
          onChange={(patch) => updateRule(rule.id, patch)}
        />
      ))}
    </div>
  );
}

// ─── Rule card ─────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule: DraftRule;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onChange: (patch: Partial<DraftRule>) => void;
}

function RuleCard({
  rule, isFirst, isLast, isExpanded,
  onToggleExpand, onMoveUp, onMoveDown, onRemove, onChange,
}: RuleCardProps) {
  const conditionLabel = conditionSummary(rule.conditionJson);
  const resultLabel = resultSummary(rule.resultJson);

  return (
    <div className="rounded border border-white/10 bg-surface">
      {/* Header row */}
      <div className="flex items-center gap-1 p-2">
        {/* Priority reorder */}
        <div className="flex flex-col">
          <button
            type="button"
            disabled={isFirst}
            onClick={onMoveUp}
            className="h-3.5 text-[10px] text-gray-600 hover:text-white disabled:opacity-20"
          >▲</button>
          <button
            type="button"
            disabled={isLast}
            onClick={onMoveDown}
            className="h-3.5 text-[10px] text-gray-600 hover:text-white disabled:opacity-20"
          >▼</button>
        </div>

        {/* Summary */}
        <button
          type="button"
          className="flex flex-1 flex-col text-left"
          onClick={onToggleExpand}
        >
          <span className="text-[11px] font-medium text-white">{conditionLabel}</span>
          <span className="text-[10px] text-gray-500">{resultLabel}</span>
        </button>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 text-xs text-gray-600 hover:text-red-400"
          aria-label="Remove rule"
        >
          ✕
        </button>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="border-t border-white/10 p-2 flex flex-col gap-3">
          <ConditionEditor
            condition={rule.conditionJson}
            onChange={(conditionJson) =>
              onChange({ conditionJson, conditionType: conditionJson.type })
            }
          />
          <ResultEditor
            result={rule.resultJson}
            onChange={(resultJson) => onChange({ resultJson })}
          />
        </div>
      )}
    </div>
  );
}

// ─── Condition editor ──────────────────────────────────────────────────────────

function ConditionEditor({
  condition,
  onChange,
}: {
  condition: Condition;
  onChange: (c: Condition) => void;
}) {
  const types: ConditionType[] = ["exact_match", "numeric_range", "truthy", "falsy", "fallback"];

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-gray-400">Condition</label>
      <select
        value={condition.type}
        onChange={(e) => onChange(defaultCondition(e.target.value as ConditionType))}
        className="w-full rounded border border-white/10 bg-surface px-2 py-1 text-xs text-white focus:border-accent focus:outline-none"
      >
        {types.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {condition.type === "exact_match" && (
        <input
          type="text"
          placeholder="Value to match"
          value={condition.value}
          onChange={(e) => onChange({ type: "exact_match", value: e.target.value })}
          className="w-full rounded border border-white/10 bg-surface px-2 py-1 text-xs text-white focus:border-accent focus:outline-none"
        />
      )}

      {condition.type === "numeric_range" && (
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            value={condition.min ?? ""}
            onChange={(e) => {
              const { min: _m, ...rest } = condition;
              onChange(e.target.value ? { ...rest, min: Number(e.target.value) } : rest);
            }}
            className="w-1/2 rounded border border-white/10 bg-surface px-2 py-1 text-xs text-white focus:border-accent focus:outline-none"
          />
          <input
            type="number"
            placeholder="Max"
            value={condition.max ?? ""}
            onChange={(e) => {
              const { max: _m, ...rest } = condition;
              onChange(e.target.value ? { ...rest, max: Number(e.target.value) } : rest);
            }}
            className="w-1/2 rounded border border-white/10 bg-surface px-2 py-1 text-xs text-white focus:border-accent focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}

// ─── Result editor ─────────────────────────────────────────────────────────────

function ResultEditor({
  result,
  onChange,
}: {
  result: RuleResult;
  onChange: (r: RuleResult) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] text-gray-400">Result</label>

      {/* Text override */}
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] text-gray-500">Text override (leave blank to use default)</label>
        <input
          type="text"
          placeholder="e.g. {{state}} °C"
          value={result.textOverride ?? ""}
          onChange={(e) => {
            const { textOverride: _t, ...rest } = result;
            onChange(e.target.value ? { ...rest, textOverride: e.target.value } : rest);
          }}
          className="w-full rounded border border-white/10 bg-surface px-2 py-1 text-xs text-white focus:border-accent focus:outline-none"
        />
      </div>

      {/* Style overrides */}
      <div className="flex gap-2">
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">Color</label>
          <ColorPicker
            value={result.styleOverrides?.color ?? "#ffffff"}
            onChange={(v) =>
              onChange({ ...result, styleOverrides: { ...result.styleOverrides, color: v } })
            }
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">Background</label>
          <ColorPicker
            value={result.styleOverrides?.backgroundColor ?? "#000000"}
            onChange={(v) =>
              onChange({
                ...result,
                styleOverrides: { ...result.styleOverrides, backgroundColor: v },
              })
            }
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] text-gray-500">Opacity</label>
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={result.styleOverrides?.opacity ?? 1}
            onChange={(e) =>
              onChange({
                ...result,
                styleOverrides: { ...result.styleOverrides, opacity: Number(e.target.value) },
              })
            }
            className="w-14 rounded border border-white/10 bg-surface px-1 py-1 text-xs text-white focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Hidden toggle */}
      <label className="flex items-center gap-2 text-[11px] text-gray-400">
        <input
          type="checkbox"
          checked={result.hidden ?? false}
          onChange={(e) => {
            const { hidden: _h, ...rest } = result;
            onChange(e.target.checked ? { ...rest, hidden: true } : rest);
          }}
          className="accent-accent"
        />
        Hide hotspot when this rule matches
      </label>
    </div>
  );
}

// ─── Summary helpers ───────────────────────────────────────────────────────────

function conditionSummary(c: Condition): string {
  switch (c.type) {
    case "exact_match":   return `state = "${c.value}"`;
    case "numeric_range": {
      const parts = [];
      if (c.min !== undefined) parts.push(`≥ ${c.min}`);
      if (c.max !== undefined) parts.push(`≤ ${c.max}`);
      return parts.length ? parts.join(" & ") : "numeric range";
    }
    case "truthy":   return "is truthy";
    case "falsy":    return "is falsy";
    case "fallback": return "fallback (always)";
  }
}

function resultSummary(r: RuleResult): string {
  const parts: string[] = [];
  if (r.hidden) parts.push("hidden");
  if (r.textOverride) parts.push(`text: "${r.textOverride}"`);
  if (r.styleOverrides?.color) parts.push(`color: ${r.styleOverrides.color}`);
  return parts.length ? parts.join(", ") : "no overrides";
}
