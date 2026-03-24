import { useState, useEffect, useMemo, useRef } from "react";
import type {
  ActionConfig,
  TextConfig,
  StateImageConfig,
  StateIconConfig,
  BadgeConfig,
  SceneConfig,
  BlindConfig,
  BinsConfig,
  WeatherConfig,
  TemperatureGaugeConfig,
  WindroseConfig,
  BatteryConfig,
  ClockConfig,
  ServiceCall,
  RuleResult,
} from "@floorplan-ha/shared";
import { useBatteryPlacementStore } from "../../store/battery-placement.ts";
import { evaluateRules } from "@floorplan-ha/shared";
import type { HotspotRaw, StateRuleRaw } from "../../hotspots/types.ts";
import { useEditorStore, type HotspotDraft } from "../../store/editor.ts";
import { useEntityStateStore } from "../../store/entity-states.ts";
import { EntityPicker } from "./EntityPicker.tsx";
import { ServicePicker } from "./ServicePicker.tsx";
import { StateRulesForm } from "./StateRulesForm.tsx";
import { IconPicker } from "./IconPicker.tsx";
import { ColorPicker } from "./ColorPicker.tsx";
import { RevisionHistoryModal } from "../RevisionHistoryModal.tsx";
import { AssetManagerModal } from "../AssetManagerModal.tsx";

type Tab = "general" | "entity" | "actions" | "style" | "rules";

interface ConfigPanelProps {
  hotspot: HotspotRaw;
}

/**
 * Side panel that shows when a hotspot is selected in edit mode.
 * Provides tabbed editing for all hotspot properties.
 * Changes are written immediately to the editor draft store.
 */
export function ConfigPanel({ hotspot }: ConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [showHistory, setShowHistory] = useState(false);
  const { updateDraft, getDraft } = useEditorStore();

  // Reset tab when a different hotspot is selected
  useEffect(() => {
    setActiveTab("general");
  }, [hotspot.id]);

  const draft = getDraft(hotspot.id);

  // Effective values: draft overrides server data
  const name = draft.name ?? hotspot.name;
  const entityId = "entityId" in draft ? draft.entityId : hotspot.entityId;
  const configJson = draft.configJson ?? hotspot.configJson;
  const x = draft.x ?? hotspot.x;
  const y = draft.y ?? hotspot.y;
  const width = draft.width ?? hotspot.width;
  const height = draft.height ?? hotspot.height;
  const rotation = draft.rotation ?? hotspot.rotation;
  const zIndex = draft.zIndex ?? hotspot.zIndex;

  const TABS: { id: Tab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "entity",  label: "Entity" },
    { id: "actions", label: "Actions" },
    { id: "style",   label: "Style" },
    { id: "rules",   label: "Rules" },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Hotspot type badge */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-[11px] font-medium text-white truncate">{name}</span>
        <span className="ml-auto shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
          {hotspot.type}
        </span>
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          title="Revision history"
          className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-white/10 hover:text-gray-300"
        >
          History
        </button>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-white/10 px-2 pt-2 scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "shrink-0 rounded-t-md px-3 py-1.5 text-[11px] transition-colors",
              activeTab === tab.id
                ? "bg-surface text-white"
                : "text-gray-500 hover:text-gray-300",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === "general" && (
          <GeneralTab
            name={name}
            x={x} y={y} width={width} height={height}
            rotation={rotation} zIndex={zIndex}
            onChange={(patch) => updateDraft(hotspot.id, patch)}
          />
        )}

        {activeTab === "entity" && (
          <EntityTab
            hotspotType={hotspot.type}
            entityId={entityId ?? null}
            onChange={(id) => updateDraft(hotspot.id, { entityId: id })}
          />
        )}

        {activeTab === "actions" && (
          <ActionsTab
            hotspotType={hotspot.type}
            hotspotId={hotspot.id}
            config={configJson}
            entityId={entityId ?? null}
            onChange={(config) => updateDraft(hotspot.id, { configJson: config })}
          />
        )}

        {activeTab === "style" && (
          <StyleTab
            hotspotType={hotspot.type}
            config={configJson}
            onChange={(config) => updateDraft(hotspot.id, { configJson: config })}
          />
        )}

        {activeTab === "rules" && (
          <RulesTab
            hotspot={hotspot}
            entityId={entityId ?? null}
            draft={draft}
            onDraftChange={(rules) => updateDraft(hotspot.id, { _pendingRules: rules })}
          />
        )}
      </div>

      {showHistory && (
        <RevisionHistoryModal
          entityType="hotspot"
          entityId={hotspot.id}
          entityName={hotspot.name}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}

// ─── Rules Tab ─────────────────────────────────────────────────────────────────

interface RulesTabProps {
  hotspot: HotspotRaw;
  entityId: string | null;
  draft: HotspotDraft;
  onDraftChange: (rules: StateRuleRaw[]) => void;
}

function RulesTab({ hotspot, entityId, draft, onDraftChange }: RulesTabProps) {
  const effectiveRules: StateRuleRaw[] = draft._pendingRules ?? hotspot.stateRules;
  const entityState = useEntityStateStore((s) => (entityId ? s.getState(entityId) : undefined));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-gray-500">
        Rules override style, text, and visibility based on entity state.
        Rules are evaluated in order — first match wins.
      </p>

      {entityId && (
        <LiveStatePreview
          entityId={entityId}
          currentState={entityState?.state}
          rules={effectiveRules}
        />
      )}

      <StateTestTool rules={effectiveRules} />

      <StateRulesForm
        rules={hotspot.stateRules}
        onChange={onDraftChange}
      />
    </div>
  );
}

// ─── Live State Preview ─────────────────────────────────────────────────────────

interface LiveStatePreviewProps {
  entityId: string;
  currentState: string | undefined;
  rules: StateRuleRaw[];
}

function LiveStatePreview({ entityId, currentState, rules }: LiveStatePreviewProps) {
  if (currentState === undefined) {
    return (
      <div className="rounded border border-white/10 bg-surface p-2">
        <p className="text-[10px] text-gray-500">
          Live preview: <span className="text-gray-400">{entityId}</span> — state not yet received
        </p>
      </div>
    );
  }

  const engineRules = rules.map((r) => ({
    priority: r.priority,
    condition: r.conditionJson,
    result: r.resultJson,
  }));
  const result = evaluateRules(engineRules, currentState);

  return (
    <div className="rounded border border-accent/30 bg-accent/5 p-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-accent">Live state</span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white">
          {currentState}
        </span>
      </div>

      {result === null ? (
        <p className="text-[10px] text-gray-500">No rule matched — default rendering applies.</p>
      ) : (
        <RuleResultPreview result={result} />
      )}
    </div>
  );
}

// ─── State Test Tool ────────────────────────────────────────────────────────────

function StateTestTool({ rules }: { rules: StateRuleRaw[] }) {
  const [testState, setTestState] = useState("");
  const [testResult, setTestResult] = useState<RuleResult | null | undefined>(undefined);

  const runTest = () => {
    if (!testState.trim()) return;
    const engineRules = rules.map((r) => ({
      priority: r.priority,
      condition: r.conditionJson,
      result: r.resultJson,
    }));
    setTestResult(evaluateRules(engineRules, testState.trim()));
  };

  return (
    <div className="rounded border border-white/10 bg-surface p-2 flex flex-col gap-2">
      <span className="text-[10px] font-medium text-gray-400">Test a state value</span>
      <div className="flex gap-1.5">
        <input
          type="text"
          placeholder='e.g. "on", "off", "24.5"'
          value={testState}
          onChange={(e) => {
            setTestState(e.target.value);
            setTestResult(undefined); // clear previous result on input change
          }}
          onKeyDown={(e) => e.key === "Enter" && runTest()}
          className="flex-1 rounded border border-white/10 bg-bg px-2 py-1 text-xs text-white placeholder:text-gray-600 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={runTest}
          disabled={!testState.trim()}
          className="rounded bg-accent/20 px-2 py-1 text-[11px] text-accent hover:bg-accent/30 disabled:opacity-40"
        >
          Test
        </button>
      </div>

      {testResult !== undefined && (
        <div className="flex flex-col gap-1">
          {testResult === null ? (
            <p className="text-[10px] text-gray-500">No rule matched for "{testState}".</p>
          ) : (
            <>
              <p className="text-[10px] text-green-400">Rule matched for "{testState}":</p>
              <RuleResultPreview result={testResult} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Rule Result Preview ────────────────────────────────────────────────────────

function RuleResultPreview({ result }: { result: RuleResult }) {
  const overrides = result.styleOverrides ?? {};
  return (
    <div className="flex flex-wrap gap-2">
      {result.hidden && (
        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">hidden</span>
      )}
      {result.textOverride && (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">
          text: "{result.textOverride}"
        </span>
      )}
      {overrides.color && (
        <span className="flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">
          <span
            className="inline-block h-3 w-3 rounded-full border border-white/20"
            style={{ backgroundColor: overrides.color }}
          />
          color
        </span>
      )}
      {overrides.backgroundColor && (
        <span className="flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">
          <span
            className="inline-block h-3 w-3 rounded-full border border-white/20"
            style={{ backgroundColor: overrides.backgroundColor }}
          />
          bg
        </span>
      )}
      {overrides.opacity !== undefined && (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">
          opacity: {overrides.opacity}
        </span>
      )}
      {overrides.glow && (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">glow</span>
      )}
      {result.animationType && (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">
          anim: {result.animationType}
        </span>
      )}
      {result.imageAssetId && (
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">
          image override
        </span>
      )}
    </div>
  );
}

// ─── General Tab ───────────────────────────────────────────────────────────────

interface GeneralTabProps {
  name: string;
  x: number; y: number; width: number; height: number;
  rotation: number; zIndex: number;
  onChange: (patch: Record<string, number | string>) => void;
}

function GeneralTab({ name, x, y, width, height, rotation, zIndex, onChange }: GeneralTabProps) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Name">
        <input
          type="text"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="input-field"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="X (0–1)">
          <input
            type="number" step={0.01} min={0} max={1}
            value={x.toFixed(4)}
            onChange={(e) => onChange({ x: clamp01(Number(e.target.value)) })}
            className="input-field"
          />
        </Field>
        <Field label="Y (0–1)">
          <input
            type="number" step={0.01} min={0} max={1}
            value={y.toFixed(4)}
            onChange={(e) => onChange({ y: clamp01(Number(e.target.value)) })}
            className="input-field"
          />
        </Field>
        <Field label="Width (0–1)">
          <input
            type="number" step={0.01} min={0.01} max={1}
            value={width.toFixed(4)}
            onChange={(e) => onChange({ width: clamp(Number(e.target.value), 0.01, 1) })}
            className="input-field"
          />
        </Field>
        <Field label="Height (0–1)">
          <input
            type="number" step={0.01} min={0.01} max={1}
            value={height.toFixed(4)}
            onChange={(e) => onChange({ height: clamp(Number(e.target.value), 0.01, 1) })}
            className="input-field"
          />
        </Field>
        <Field label="Rotation (°)">
          <input
            type="number" step={1} min={-360} max={360}
            value={rotation}
            onChange={(e) => onChange({ rotation: Number(e.target.value) })}
            className="input-field"
          />
        </Field>
        <Field label="Z-Index">
          <input
            type="number" step={1} min={0}
            value={zIndex}
            onChange={(e) => onChange({ zIndex: Math.max(0, Number(e.target.value)) })}
            className="input-field"
          />
        </Field>
      </div>
    </div>
  );
}

// ─── Entity Tab ────────────────────────────────────────────────────────────────

function EntityTab({
  hotspotType,
  entityId,
  onChange,
}: {
  hotspotType: string;
  entityId: string | null;
  onChange: (id: string | null) => void;
}) {
  if (hotspotType === "clock") {
    return (
      <p className="text-[11px] text-gray-500">
        The clock reads the browser&apos;s local time — no Home Assistant entity is needed.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-gray-500">
        Bind this hotspot to a Home Assistant entity for live state updates.
      </p>
      <EntityPicker value={entityId} onChange={onChange} label="Home Assistant entity" />
    </div>
  );
}

// ─── Battery Actions Tab ───────────────────────────────────────────────────────

function BatteryActionsTab({
  hotspotId,
  config,
  onChange,
}: {
  hotspotId: string;
  config: HotspotRaw["configJson"];
  onChange: (c: HotspotRaw["configJson"]) => void;
}) {
  const c = config as unknown as BatteryConfig;
  const items = c.items ?? [];
  const [addingItem, setAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemEntityId, setNewItemEntityId] = useState<string | null>(null);

  const { placement, startPlacement, startReposition, cancel } = useBatteryPlacementStore();
  const isPlacingForThis = placement?.hotspotId === hotspotId;

  function addAtCenter() {
    if (!newItemEntityId) return;
    onChange({
      ...c,
      items: [
        ...items,
        { id: crypto.randomUUID(), name: newItemName || newItemEntityId, entityId: newItemEntityId, x: 0.5, y: 0.5 },
      ],
    });
    resetForm();
  }

  function placeOnCanvas() {
    if (!newItemEntityId) return;
    startPlacement(hotspotId, {
      id: crypto.randomUUID(),
      name: newItemName || newItemEntityId,
      entityId: newItemEntityId,
    });
    resetForm();
  }

  function resetForm() {
    setAddingItem(false);
    setNewItemName("");
    setNewItemEntityId(null);
  }

  function removeItem(id: string) {
    onChange({ ...c, items: items.filter((it) => it.id !== id) });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Placement mode banner */}
      {isPlacingForThis && (
        <div className="flex items-center justify-between rounded-lg bg-amber-500/15 px-3 py-2 text-[11px] text-amber-300">
          <span>Click on the floorplan to place · Esc to cancel</span>
          <button type="button" onClick={cancel} className="ml-2 shrink-0 hover:text-white">
            ✕
          </button>
        </div>
      )}

      <p className="text-[11px] text-gray-500">
        Add battery locations and click them onto the floorplan. Set thresholds in the Style tab.
      </p>

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const isMoving = placement?.hotspotId === hotspotId && placement.repositioningItemId === item.id;
            return (
              <div
                key={item.id}
                className={[
                  "flex flex-col gap-1 rounded-lg p-2.5 transition-colors",
                  isMoving ? "border border-amber-500/40 bg-amber-500/10" : "bg-white/5",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="min-w-0 truncate text-[11px] font-medium text-gray-300">{item.name}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      title="Move on canvas"
                      onClick={() => isMoving ? cancel() : startReposition(hotspotId, item.id)}
                      className={[
                        "text-[11px] transition-colors",
                        isMoving ? "text-amber-400 hover:text-amber-300" : "text-gray-500 hover:text-gray-300",
                      ].join(" ")}
                    >
                      {isMoving ? "Cancel" : "Move"}
                    </button>
                    <span className="text-gray-700">·</span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-[11px] text-gray-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500">{item.entityId}</span>
                <span className="text-[10px] text-gray-600">
                  {Math.round(item.x * 100)}% × {Math.round(item.y * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {addingItem ? (
        <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] font-medium text-gray-300">New battery location</p>
          <Field label="Display name">
            <input
              type="text"
              value={newItemName}
              placeholder="e.g. Living Room Motion"
              onChange={(e) => setNewItemName(e.target.value)}
              className="input-field"
            />
          </Field>
          <Field label="Battery entity">
            <EntityPicker
              value={newItemEntityId}
              label="Select battery sensor"
              onChange={(id) => setNewItemEntityId(id)}
            />
          </Field>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={placeOnCanvas}
              disabled={!newItemEntityId}
              className="flex-1 rounded-lg bg-accent/80 py-1.5 text-[11px] font-medium text-white hover:bg-accent disabled:opacity-40"
            >
              Place on canvas
            </button>
            <button
              type="button"
              onClick={addAtCenter}
              disabled={!newItemEntityId}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] text-gray-400 hover:bg-white/20 disabled:opacity-40"
              title="Add at center (50%, 50%)"
            >
              Center
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] text-gray-400 hover:bg-white/20"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingItem(true)}
          className="rounded-lg border border-dashed border-white/20 py-2 text-[11px] text-gray-500 hover:border-white/40 hover:text-gray-300"
        >
          + Add battery location
        </button>
      )}
    </div>
  );
}

// ─── Blind Actions Tab ─────────────────────────────────────────────────────────

function BlindActionsTab({
  config,
  onChange,
}: {
  config: HotspotRaw["configJson"];
  onChange: (c: HotspotRaw["configJson"]) => void;
}) {
  const c = config as BlindConfig;
  const groupEntityIds: string[] = c.groupEntityIds ?? [];
  const [addingEntity, setAddingEntity] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] text-gray-500">
        Blind hotspots use built-in cover controls (open, close, set position).
        Bind to a Home Assistant cover entity in the Entity tab.
      </p>
      <div>
        <p className="mb-2 text-[11px] font-medium text-gray-400">Blind Group</p>
        <p className="mb-3 text-[11px] text-gray-500">
          Long-press this hotspot to control multiple covers simultaneously.
        </p>
        {groupEntityIds.length > 0 && (
          <div className="mb-2 flex flex-col gap-1">
            {groupEntityIds.map((id) => (
              <div key={id} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-1.5">
                <span className="truncate text-[11px] text-gray-300">{id}</span>
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...c, groupEntityIds: groupEntityIds.filter((x) => x !== id) })
                  }
                  className="ml-2 shrink-0 text-[11px] text-gray-500 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        {addingEntity ? (
          <EntityPicker
            value={null}
            label="Select cover entity"
            onChange={(entityId) => {
              setAddingEntity(false);
              if (entityId && !groupEntityIds.includes(entityId)) {
                onChange({ ...c, groupEntityIds: [...groupEntityIds, entityId] });
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingEntity(true)}
            className="w-full rounded-md border border-dashed border-white/20 py-1.5 text-[11px] text-gray-400 hover:border-white/40 hover:text-white"
          >
            + Add Cover Entity
          </button>
        )}
      </div>
      <div>
        <p className="mb-2 text-[11px] font-medium text-gray-400">Battery</p>
        <p className="mb-3 text-[11px] text-gray-500">
          Link a battery sensor to show a low-battery warning icon on the hotspot.
        </p>
        <EntityPicker
          value={c.batteryEntityId ?? null}
          label="Battery sensor entity"
          onChange={(v) => onChange({ ...c, batteryEntityId: v })}
        />
      </div>
    </div>
  );
}

// ─── Actions Tab ───────────────────────────────────────────────────────────────

function ActionsTab({
  hotspotType,
  hotspotId,
  config,
  entityId,
  onChange,
}: {
  hotspotType: string;
  hotspotId: string;
  config: HotspotRaw["configJson"];
  entityId: string | null;
  onChange: (c: HotspotRaw["configJson"]) => void;
}) {
  if (hotspotType === "action") {
    const c = config as ActionConfig;
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-[11px] text-gray-500 font-medium">Tap action</p>
          <ServicePicker
            label="Service"
            value={c.tapAction}
            entityId={entityId}
            onChange={(call) => onChange({ ...c, tapAction: call } as ActionConfig)}
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] text-gray-500 font-medium">Hold action</p>
          <ServicePicker
            label="Service"
            value={c.holdAction}
            entityId={entityId}
            onChange={(call) => onChange({ ...c, holdAction: call } as ActionConfig)}
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] text-gray-500 font-medium">Double-tap action</p>
          <ServicePicker
            label="Service"
            value={c.doubleTapAction}
            entityId={entityId}
            onChange={(call) => onChange({ ...c, doubleTapAction: call } as ActionConfig)}
          />
        </div>
      </div>
    );
  }

  if (hotspotType === "scene") {
    const c = config as { serviceCall: ServiceCall | null; icon: string | null; label: string | null };
    return (
      <ServicePicker
        label="Scene / Script service"
        value={c.serviceCall}
        entityId={entityId}
        onChange={(call) => onChange({ ...c, serviceCall: call })}
      />
    );
  }

  if (hotspotType === "blind") {
    return (
      <BlindActionsTab
        config={config}
        onChange={onChange}
      />
    );
  }

  if (hotspotType === "weather") {
    const c = config as WeatherConfig;
    return (
      <div className="flex flex-col gap-3">
        <Field label="UV index entity (optional)">
          <EntityPicker
            value={c.uvEntityId ?? null}
            onChange={(id) => onChange({ ...c, uvEntityId: id })}
          />
        </Field>
        <p className="text-[11px] text-gray-500">
          Select a HA sensor that reports the current UV index (e.g.{" "}
          <code className="rounded bg-white/10 px-1 text-white">sensor.uv_index</code>).
          It will appear in the card&apos;s current conditions header.
        </p>
        <Field label="Outside temperature entity (optional)">
          <EntityPicker
            value={c.outsideTempEntityId ?? null}
            onChange={(id) => onChange({ ...c, outsideTempEntityId: id })}
          />
        </Field>
        <p className="text-[11px] text-gray-500">
          Select a HA sensor for actual outside temperature (e.g.{" "}
          <code className="rounded bg-white/10 px-1 text-white">sensor.outside_temperature</code>).
          Shown as a reference line on the today&apos;s forecast chart.
        </p>
        <Field label="Temperature unit">
          <div className="flex gap-2">
            {(["celsius", "fahrenheit"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => onChange({ ...c, temperatureUnit: u })}
                className={[
                  "flex-1 rounded border py-1 text-xs transition-colors",
                  c.temperatureUnit === u
                    ? "border-accent bg-accent/20 text-white"
                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-300",
                ].join(" ")}
              >
                {u === "celsius" ? "°C Celsius" : "°F Fahrenheit"}
              </button>
            ))}
          </div>
        </Field>
      </div>
    );
  }

  if (hotspotType === "temperature_gauge") {
    const c = config as TemperatureGaugeConfig;
    const radius = c.radius ?? 0.25;
    return (
      <div className="flex flex-col gap-3">
        <Field label="Sensor type">
          <div className="flex gap-2">
            {([false, true] as const).map((outside) => (
              <button
                key={String(outside)}
                type="button"
                onClick={() => onChange({ ...c, isOutside: outside })}
                className={[
                  "flex-1 rounded border py-1 text-xs transition-colors",
                  c.isOutside === outside
                    ? "border-accent bg-accent/20 text-white"
                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-300",
                ].join(" ")}
              >
                {outside ? "🏠 Outside" : "🛋 Inside"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            {c.isOutside
              ? "Outside gauge fills the exterior region with a solid colour. Only one outside gauge per floorplan is used."
              : "Inside gauge radiates a heat gradient from its position. Clipped to the interior mask."}
          </p>
        </Field>

        <Field label="Temperature unit">
          <div className="flex gap-2">
            {(["celsius", "fahrenheit"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => onChange({ ...c, unit: u })}
                className={[
                  "flex-1 rounded border py-1 text-xs transition-colors",
                  c.unit === u
                    ? "border-accent bg-accent/20 text-white"
                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-300",
                ].join(" ")}
              >
                {u === "celsius" ? "°C Celsius" : "°F Fahrenheit"}
              </button>
            ))}
          </div>
        </Field>

        {!c.isOutside && (
          <Field label={`Heat radius — ${Math.round(radius * 100)}% of width`}>
            <input
              type="range"
              min={5}
              max={60}
              step={1}
              value={Math.round(radius * 100)}
              onChange={(e) => onChange({ ...c, radius: Number(e.target.value) / 100 })}
              className="w-full accent-accent"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Controls how far the gradient spreads from this gauge. Larger values
              cover more of the floor. Overlapping gradients blend together.
            </p>
          </Field>
        )}
      </div>
    );
  }

  if (hotspotType === "windrose") {
    const c = config as WindroseConfig;
    const northOffset = c.northOffset ?? 0;
    return (
      <div className="flex flex-col gap-4">
        <Field label="Wind speed entity (optional)">
          <EntityPicker
            value={c.speedEntityId ?? null}
            onChange={(id) => onChange({ ...c, speedEntityId: id })}
          />
          <p className="mt-1 text-[11px] text-gray-500">
            A sensor reporting wind speed. Its value is displayed below the arrow.
          </p>
        </Field>

        <Field label="Speed unit label">
          <input
            type="text"
            value={c.speedUnit ?? ""}
            placeholder="e.g. km/h, mph, m/s"
            onChange={(e) => onChange({ ...c, speedUnit: e.target.value || null })}
            className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder-gray-600 focus:border-accent focus:outline-none"
          />
        </Field>

        <Field label={`North offset — ${northOffset}°`}>
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={northOffset}
            onChange={(e) => onChange({ ...c, northOffset: Number(e.target.value) })}
            className="w-full accent-accent"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Rotates the compass ring so "N" aligns with map north on your floorplan.
            The arrow always shows the true wind direction regardless of this setting.
          </p>
        </Field>

        <Field label="Bearing convention">
          <div className="flex gap-2">
            {(["from", "into"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChange({ ...c, bearingMode: mode })}
                className={[
                  "flex-1 rounded border py-1 text-xs transition-colors",
                  (c.bearingMode ?? "from") === mode
                    ? "border-accent bg-accent/20 text-white"
                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-300",
                ].join(" ")}
              >
                {mode === "from" ? "Wind from (met.)" : "Wind into"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            {(c.bearingMode ?? "from") === "from"
              ? "Entity reports where wind comes FROM (standard HA wind_bearing). Arrow is flipped to show destination."
              : "Entity reports where wind is blowing TO. Arrow used as-is."}
          </p>
        </Field>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium text-gray-400">Labels</p>
          <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={c.showCardinals ?? true}
              onChange={(e) => onChange({ ...c, showCardinals: e.target.checked })}
              className="rounded accent-accent"
            />
            Show cardinal directions (N, S, E, W)
          </label>
          <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={c.showIntercardinals ?? false}
              onChange={(e) => onChange({ ...c, showIntercardinals: e.target.checked })}
              className="rounded accent-accent"
            />
            Show intercardinal directions (NE, SE, SW, NW)
          </label>
        </div>
      </div>
    );
  }

  if (hotspotType === "battery") {
    return (
      <BatteryActionsTab hotspotId={hotspotId} config={config} onChange={onChange} />
    );
  }

  return (
    <p className="text-[11px] text-gray-500">
      This hotspot type ({hotspotType}) does not support actions.
    </p>
  );
}

// ─── Style Tab ─────────────────────────────────────────────────────────────────

function StyleTab({
  hotspotType,
  config,
  onChange,
}: {
  hotspotType: string;
  config: HotspotRaw["configJson"];
  onChange: (c: HotspotRaw["configJson"]) => void;
}) {
  if (hotspotType === "action") {
    const c = config as ActionConfig;
    // Derive which background mode is active
    return (
      <div className="flex flex-col gap-3">
        <Field label="Icon">
          <IconPicker
            value={c.icon ?? ""}
            onChange={(icon) => onChange({ ...c, icon: icon || null })}
          />
        </Field>
        <div>
          <p className="mb-2 text-[11px] font-medium text-gray-400">State icons (optional)</p>
          <p className="mb-3 text-[11px] text-gray-500">
            Override the icon and its color based on entity on/off state. Leave blank to use the icon above for both states.
          </p>
          <div className="flex flex-col gap-3">
            <Field label="On-state icon (on / open / active)">
              <IconPicker
                value={c.onIcon ?? ""}
                onChange={(icon) => onChange({ ...c, onIcon: icon || null })}
              />
            </Field>
            <Field label="Off-state icon (off / closed)">
              <IconPicker
                value={c.offIcon ?? ""}
                onChange={(icon) => onChange({ ...c, offIcon: icon || null })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="On color">
                <ColorPicker
                  value={c.onColor ?? null}
                  onChange={(v) => onChange({ ...c, onColor: v })}
                  nullable
                />
              </Field>
              <Field label="Off color">
                <ColorPicker
                  value={c.offColor ?? null}
                  onChange={(v) => onChange({ ...c, offColor: v })}
                  nullable
                />
              </Field>
            </div>
          </div>
        </div>
        <Field label="Label">
          <input
            type="text"
            value={c.label ?? ""}
            onChange={(e) => onChange({ ...c, label: e.target.value || null })}
            className="input-field"
          />
        </Field>
        <Field label="Background">
          <ColorPicker
            value={c.backgroundColor}
            onChange={(v) => onChange({ ...c, backgroundColor: v })}
            nullable
          />
        </Field>
        <label className="flex items-center gap-2 text-[11px] text-gray-400">
          <input
            type="checkbox"
            checked={c.hideLabel ?? false}
            onChange={(e) => onChange({ ...c, hideLabel: e.target.checked })}
            className="rounded"
          />
          Hide label (invisible overlay)
        </label>
      </div>
    );
  }

  if (hotspotType === "text") {
    const c = config as TextConfig;
    return (
      <div className="flex flex-col gap-3">
        <Field label="Template">
          <input
            type="text"
            value={c.template}
            placeholder="{{state}} °C"
            onChange={(e) => onChange({ ...c, template: e.target.value })}
            className="input-field"
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Font size (px)">
            <input
              type="number" min={6} max={200}
              value={c.fontSize}
              onChange={(e) => onChange({ ...c, fontSize: Number(e.target.value) })}
              className="input-field"
            />
          </Field>
          <Field label="Color">
            <ColorPicker value={c.color} onChange={(v) => onChange({ ...c, color: v })} />
          </Field>
          <Field label="Alignment">
            <select
              value={c.align}
              onChange={(e) => onChange({ ...c, align: e.target.value as TextConfig["align"] })}
              className="input-field"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </Field>
        </div>
      </div>
    );
  }

  if (hotspotType === "state_image") {
    const c = config as StateImageConfig;
    return (
      <div className="flex flex-col gap-3">
        <AssetPickerField
          label="On-state image (on / open / active)"
          assetId={c.onAssetId ?? null}
          onChange={(id) => onChange({ ...c, onAssetId: id })}
        />
        <AssetPickerField
          label="Off-state image (off / closed)"
          assetId={c.offAssetId ?? null}
          onChange={(id) => onChange({ ...c, offAssetId: id })}
        />
        <Field label="Transition animation">
          <select
            value={c.animationType ?? "none"}
            onChange={(e) =>
              onChange({ ...c, animationType: e.target.value as StateImageConfig["animationType"] })
            }
            className="input-field"
          >
            <option value="none">None (instant)</option>
            <option value="fade">Fade</option>
            <option value="crossfade">Crossfade</option>
          </select>
        </Field>
        <Field label="Size">
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="stretchToFit"
                checked={!(c.stretchToFit ?? false)}
                onChange={() => onChange({ ...c, stretchToFit: false })}
                className="accent-blue-500"
              />
              <span className="text-sm text-gray-300">Actual size (letterboxed)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="stretchToFit"
                checked={c.stretchToFit ?? false}
                onChange={() => onChange({ ...c, stretchToFit: true })}
                className="accent-blue-500"
              />
              <span className="text-sm text-gray-300">Stretch to fit bounds</span>
            </label>
          </div>
        </Field>
      </div>
    );
  }

  if (hotspotType === "state_icon") {
    const c = config as StateIconConfig;
    return (
      <div className="flex flex-col gap-3">
        <Field label="Icon">
          <IconPicker
            value={c.icon ?? ""}
            onChange={(icon) => onChange({ ...c, icon })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="On color">
            <ColorPicker value={c.onColor ?? "#facc15"} onChange={(v) => onChange({ ...c, onColor: v })} />
          </Field>
          <Field label="Off color">
            <ColorPicker value={c.offColor ?? "#6b7280"} onChange={(v) => onChange({ ...c, offColor: v })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-gray-400">
          <input
            type="checkbox"
            checked={c.badgeEnabled ?? false}
            onChange={(e) => onChange({ ...c, badgeEnabled: e.target.checked })}
            className="rounded"
          />
          Show badge dot in corner
        </label>
        <div>
          <p className="mb-2 text-[11px] font-medium text-gray-400">Battery</p>
          <p className="mb-3 text-[11px] text-gray-500">
            Link a battery sensor to show a low-battery warning icon on the hotspot.
          </p>
          <EntityPicker
            value={c.batteryEntityId ?? null}
            label="Battery sensor entity"
            onChange={(v) => onChange({ ...c, batteryEntityId: v })}
          />
        </div>
        <Field label="Low battery threshold %">
          <input
            type="number"
            min={0}
            max={100}
            value={c.lowBatteryThreshold ?? 40}
            placeholder="40"
            onChange={(e) =>
              onChange({ ...c, lowBatteryThreshold: e.target.value ? Number(e.target.value) : null })
            }
            className="input-field"
          />
        </Field>
      </div>
    );
  }

  if (hotspotType === "badge") {
    const c = config as BadgeConfig;
    // Edit state labels/colors as JSON for flexibility
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[11px] text-gray-500">
          Map raw HA state values to display labels and background colors.
        </p>
        <Field label="State labels (JSON)">
          <textarea
            value={JSON.stringify(c.stateLabels ?? {}, null, 2)}
            rows={4}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value) as Record<string, string>;
                onChange({ ...c, stateLabels: parsed });
              } catch {
                // ignore parse errors while user is typing
              }
            }}
            className="input-field resize-y font-mono text-[11px]"
            placeholder='{"on": "Open", "off": "Closed"}'
          />
        </Field>
        <Field label="State colors (JSON)">
          <textarea
            value={JSON.stringify(c.stateColors ?? {}, null, 2)}
            rows={4}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value) as Record<string, string>;
                onChange({ ...c, stateColors: parsed });
              } catch {
                // ignore parse errors while user is typing
              }
            }}
            className="input-field resize-y font-mono text-[11px]"
            placeholder='{"on": "#16a34a", "off": "#374151"}'
          />
        </Field>
      </div>
    );
  }

  if (hotspotType === "scene") {
    const c = config as SceneConfig;
    return (
      <div className="flex flex-col gap-3">
        <Field label="Label">
          <input
            type="text"
            value={c.label ?? ""}
            placeholder="Button label"
            onChange={(e) => onChange({ ...c, label: e.target.value || null })}
            className="input-field"
          />
        </Field>
        <Field label="Icon (emoji or MDI name)">
          <input
            type="text"
            value={c.icon ?? ""}
            placeholder="e.g. 🎬 or mdi:movie"
            onChange={(e) => onChange({ ...c, icon: e.target.value || null })}
            className="input-field"
          />
        </Field>
      </div>
    );
  }

  if (hotspotType === "blind") {
    const c = config as BlindConfig;
    return (
      <div className="flex flex-col gap-3">
        <Field label="Icon">
          <IconPicker
            value={c.icon ?? "mdi:blinds"}
            onChange={(icon) => onChange({ ...c, icon })}
          />
        </Field>
        <Field label="Label">
          <input
            type="text"
            value={c.label ?? ""}
            placeholder="e.g. Living Room Blind"
            onChange={(e) => onChange({ ...c, label: e.target.value || null })}
            className="input-field"
          />
        </Field>
        <Field label="Background">
          <ColorPicker
            value={c.backgroundColor}
            onChange={(v) => onChange({ ...c, backgroundColor: v })}
            nullable
          />
        </Field>
        <Field label="Low battery threshold %">
          <input
            type="number"
            min={0}
            max={100}
            value={c.lowBatteryThreshold ?? 40}
            placeholder="40"
            onChange={(e) =>
              onChange({
                ...c,
                lowBatteryThreshold: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="input-field"
          />
        </Field>
        <p className="text-[11px] text-gray-500">
          Bind this hotspot to a cover entity in the Entity tab.
        </p>
      </div>
    );
  }

  if (hotspotType === "bins") {
    const c = config as BinsConfig;
    return (
      <div className="flex flex-col gap-3">
        <AssetPickerField
          label="Yellow bin image"
          assetId={c.yellowBinAssetId ?? null}
          onChange={(id) => onChange({ ...c, yellowBinAssetId: id })}
        />
        <AssetPickerField
          label="Red bin image"
          assetId={c.redBinAssetId ?? null}
          onChange={(id) => onChange({ ...c, redBinAssetId: id })}
        />
        <p className="text-[11px] text-gray-500">
          Bind this hotspot to a calendar entity in the Entity tab. The next event named
          &quot;Yellow Bin&quot; or &quot;Red Bin&quot; determines which image is shown.
        </p>
      </div>
    );
  }

  if (hotspotType === "weather") {
    return (
      <p className="text-[11px] text-gray-500">
        The weather card uses its own built-in dark styling. Resize and position it freely
        on the floorplan using the General tab. UV index and temperature unit can be configured
        in the Actions tab.
      </p>
    );
  }

  if (hotspotType === "temperature_gauge") {
    const c = config as TemperatureGaugeConfig;
    const displayMode = c.displayMode ?? "full";
    return (
      <div className="flex flex-col gap-3">
        <Field label="Display mode">
          <div className="flex gap-2">
            {(["full", "minimal"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChange({ ...c, displayMode: mode })}
                className={[
                  "flex-1 rounded border py-1 text-xs transition-colors",
                  displayMode === mode
                    ? "border-accent bg-accent/20 text-white"
                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-300",
                ].join(" ")}
              >
                {mode === "full" ? "🌡 Full" : "Aa Minimal"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            {displayMode === "minimal"
              ? "Shows only the temperature value. Ideal for compact placements."
              : "Shows the circular badge with icon, colour ring, and temperature."}
          </p>
        </Field>
        <Field label="Text color">
          <div className="flex items-center gap-2">
            <ColorPicker
              value={c.textColor ?? null}
              onChange={(v) => onChange({ ...c, textColor: v })}
              nullable
            />
            <span className="text-[11px] text-gray-500">
              {c.textColor
                ? "Custom colour"
                : displayMode === "minimal"
                  ? "Auto (temperature colour)"
                  : "Auto (white)"}
            </span>
          </div>
        </Field>
      </div>
    );
  }

  if (hotspotType === "windrose") {
    const c = config as WindroseConfig;
    const labelSize = c.labelSize ?? 8;
    return (
      <div className="flex flex-col gap-3">
        <Field label="Rose color">
          <div className="flex items-center gap-2">
            <ColorPicker
              value={c.roseColor ?? null}
              onChange={(v) => onChange({ ...c, roseColor: v })}
              nullable
            />
            <span className="text-[11px] text-gray-500">
              {c.roseColor ? "Custom" : "Default (blue)"}
            </span>
          </div>
        </Field>

        <Field label="Label color">
          <div className="flex items-center gap-2">
            <ColorPicker
              value={c.labelColor ?? null}
              onChange={(v) => onChange({ ...c, labelColor: v })}
              nullable
            />
            <span className="text-[11px] text-gray-500">
              {c.labelColor ? "Custom" : "Default (white)"}
            </span>
          </div>
        </Field>

        <Field label={`Label size — ${labelSize}px`}>
          <input
            type="range"
            min={4}
            max={16}
            step={1}
            value={labelSize}
            onChange={(e) => onChange({ ...c, labelSize: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </Field>
      </div>
    );
  }

  if (hotspotType === "battery") {
    const c = config as unknown as BatteryConfig;
    return (
      <div className="flex flex-col gap-3">
        <Field label="Low battery threshold %">
          <input
            type="number"
            min={0}
            max={100}
            value={c.lowThreshold ?? 30}
            placeholder="30"
            onChange={(e) => onChange({ ...c, lowThreshold: e.target.value ? Number(e.target.value) : 30 })}
            className="input-field"
          />
        </Field>
        <p className="text-[11px] text-gray-500">
          Items below this level are shown in red.
        </p>
        <Field label="Medium battery threshold %">
          <input
            type="number"
            min={0}
            max={100}
            value={c.mediumThreshold ?? 50}
            placeholder="50"
            onChange={(e) => onChange({ ...c, mediumThreshold: e.target.value ? Number(e.target.value) : 50 })}
            className="input-field"
          />
        </Field>
        <p className="text-[11px] text-gray-500">
          Items below this level (but above low) are shown in yellow. All others are green.
        </p>
        <Field label="Background">
          <ColorPicker
            value={c.backgroundColor ?? null}
            onChange={(v) => onChange({ ...c, backgroundColor: v })}
            nullable
          />
        </Field>
      </div>
    );
  }

  if (hotspotType === "clock") {
    const c = config as unknown as ClockConfig;
    const clockStyle = c.clockStyle ?? "digital";
    return (
      <div className="flex flex-col gap-3">
        <Field label="Clock style">
          <div className="flex gap-2">
            {(["digital", "analog"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ ...c, clockStyle: s })}
                className={[
                  "flex-1 rounded border py-1 text-xs capitalize transition-colors",
                  clockStyle === s
                    ? "border-accent bg-accent/20 text-white"
                    : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-300",
                ].join(" ")}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Show seconds">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={c.showSeconds ?? false}
              onChange={(e) => onChange({ ...c, showSeconds: e.target.checked })}
              className="accent-accent"
            />
            <span className="text-[11px] text-gray-400">
              {clockStyle === "analog" ? "Show seconds hand" : "Show :SS digits"}
            </span>
          </label>
        </Field>
        {clockStyle === "digital" && (
          <Field label="Hour format">
            <div className="flex gap-2">
              {(["24", "12"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onChange({ ...c, hourFormat: f })}
                  className={[
                    "flex-1 rounded border py-1 text-xs transition-colors",
                    (c.hourFormat ?? "24") === f
                      ? "border-accent bg-accent/20 text-white"
                      : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-gray-300",
                  ].join(" ")}
                >
                  {f === "24" ? "24-hour" : "12-hour (AM/PM)"}
                </button>
              ))}
            </div>
          </Field>
        )}
        <Field label="Show date">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={c.showDate ?? false}
              onChange={(e) => onChange({ ...c, showDate: e.target.checked })}
              className="accent-accent"
            />
            <span className="text-[11px] text-gray-400">Show day and date (e.g. Mon, 24 Mar)</span>
          </label>
        </Field>
        <Field label="Timezone">
          <TimezonePicker
            value={c.timezone ?? null}
            onChange={(tz) => onChange({ ...c, timezone: tz })}
          />
        </Field>
        <Field label="Timezone label">
          <input
            type="text"
            placeholder={c.timezone ? "e.g. New York, Home, Office" : "e.g. Home"}
            value={c.timezoneLabel ?? ""}
            onChange={(e) => onChange({ ...c, timezoneLabel: e.target.value || null })}
            className="input-field"
          />
          <p className="text-[11px] text-gray-500">
            Shown below the clock. Overrides the auto abbreviation (e.g. GMT+2).
          </p>
        </Field>
        <Field label="Font size (px)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={8}
              max={200}
              placeholder="Auto"
              value={c.fontSize ?? ""}
              onChange={(e) =>
                onChange({ ...c, fontSize: e.target.value ? Number(e.target.value) : null })
              }
              className="input-field"
            />
            {c.fontSize != null && (
              <button
                type="button"
                onClick={() => onChange({ ...c, fontSize: null })}
                className="shrink-0 rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-400 hover:border-white/20 hover:text-gray-300"
              >
                Auto
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-500">
            Leave blank to auto-scale with the hotspot size.
          </p>
        </Field>
        <Field label="Color">
          <ColorPicker
            value={c.color ?? null}
            onChange={(v) => onChange({ ...c, color: v })}
            nullable
          />
        </Field>
        <Field label="Background">
          <ColorPicker
            value={c.backgroundColor ?? null}
            onChange={(v) => onChange({ ...c, backgroundColor: v })}
            nullable
          />
        </Field>
      </div>
    );
  }

  if (hotspotType === "custom") {
    return (
      <p className="text-[11px] text-gray-500">
        Custom hotspots have no built-in style options. Replace this type&apos;s renderer by
        calling <code className="rounded bg-white/10 px-1 text-white">registerHotspotType()</code>{" "}
        at app bootstrap. See{" "}
        <code className="rounded bg-white/10 px-1 text-white">docs/extending-hotspots.md</code>.
      </p>
    );
  }

  return (
    <p className="text-[11px] text-gray-500">
      No style options available for <strong className="text-white">{hotspotType}</strong>.
    </p>
  );
}

// ─── Timezone Picker ───────────────────────────────────────────────────────────

const ALL_TIMEZONES: string[] = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [];
  }
})();

function TimezonePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (tz: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q
      ? ALL_TIMEZONES.filter((tz) => tz.toLowerCase().includes(q)).slice(0, 80)
      : ALL_TIMEZONES.slice(0, 80);
  }, [search]);

  function open() {
    setSearch("");
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function select(tz: string | null) {
    onChange(tz);
    setIsOpen(false);
    setSearch("");
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={open}
        className="input-field w-full text-left truncate"
      >
        {value ?? <span className="text-gray-500">Local (browser default)</span>}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs"
          aria-label="Clear timezone"
        >
          ✕
        </button>
      )}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-1 w-full rounded border border-white/10 bg-gray-900 shadow-xl">
            <div className="p-1.5 border-b border-white/10">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search timezone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field w-full text-xs"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              <li>
                <button
                  type="button"
                  onClick={() => select(null)}
                  className={[
                    "w-full px-3 py-1.5 text-left text-xs transition-colors",
                    value === null
                      ? "bg-accent/20 text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200",
                  ].join(" ")}
                >
                  Local (browser default)
                </button>
              </li>
              {filtered.map((tz) => (
                <li key={tz}>
                  <button
                    type="button"
                    onClick={() => select(tz)}
                    className={[
                      "w-full px-3 py-1.5 text-left text-xs transition-colors",
                      value === tz
                        ? "bg-accent/20 text-white"
                        : "text-gray-400 hover:bg-white/5 hover:text-gray-200",
                    ].join(" ")}
                  >
                    {tz}
                  </button>
                </li>
              ))}
              {search && filtered.length === 0 && (
                <li className="px-3 py-2 text-xs text-gray-500">No matches</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[11px] text-gray-400">{label}</label>
      {children}
    </div>
  );
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// ─── Asset Picker Field ────────────────────────────────────────────────────────

/**
 * A labelled field that shows the currently selected asset thumbnail (if any),
 * a "Browse" button that opens the AssetManagerModal in select mode, and a
 * "Clear" button to remove the selection.  Supports drag-and-drop upload via
 * the modal's built-in uploader.
 */
function AssetPickerField({
  label,
  assetId,
  onChange,
}: {
  label: string;
  assetId: string | null;
  onChange: (id: string | null) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const previewUrl = assetId ? `/api/assets/${assetId}/file` : null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-gray-400">{label}</span>

      {/* Thumbnail preview */}
      {previewUrl ? (
        <div className="relative h-20 w-full overflow-hidden rounded-md border border-white/10 bg-surface">
          <img
            src={previewUrl}
            alt="selected asset"
            className="h-full w-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-black/80"
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="flex h-16 w-full items-center justify-center rounded-md border border-dashed border-white/10 bg-surface text-xs text-gray-600">
          No image selected
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="rounded bg-white/10 px-2.5 py-1 text-xs text-gray-300 hover:bg-white/20"
      >
        {assetId ? "Change image…" : "Browse / upload…"}
      </button>

      {showModal && (
        <AssetManagerModal
          selectMode
          onSelect={(id) => {
            onChange(id);
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
const clamp01 = (v: number) => clamp(v, 0, 1);
