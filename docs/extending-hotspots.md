# Extending Hotspots

This guide explains how to add a new hotspot type to floorplan-ha.
The system uses a **registry pattern** — each hotspot type self-registers and
requires no changes to the core rendering or editor infrastructure.

---

## Overview

A hotspot type consists of:

| Part | Purpose |
|---|---|
| `Renderer` | React component that renders the hotspot in the dashboard |
| `defaultConfig` | Initial `configJson` stored in the database for new hotspots of this type |
| `label`, `description`, `icon` | Metadata shown in the type picker when adding a hotspot |
| `migrate` (optional) | Upgrade function called when loading an older config schema |

All types live in `apps/web/src/hotspots/renderers/` and are registered in
`apps/web/src/hotspots/registry.ts`.

---

## Step-by-step: Adding a new hotspot type

This example adds a hypothetical `energy_meter` type that displays current power draw from a sensor entity.

### 1. Define a config interface in `packages/shared`

Open `packages/shared/src/types.ts` and add a typed interface for your
hotspot's configuration:

```ts
// packages/shared/src/types.ts
export interface EnergyMeterConfig {
  unit: "W" | "kW";
  showIcon: boolean;
  warningThreshold: number | null; // watts — null means no warning
}
```

Then add the type name to the `HotspotType` union:

```ts
export type HotspotType =
  | "action"
  | "text"
  | "state_image"
  | "state_icon"
  | "badge"
  | "scene"
  | "blind"
  | "bins"
  | "custom"
  | "weather"
  | "temperature_gauge"
  | "windrose"
  | "battery"
  | "clock"
  | "energy_meter";  // ← add here
```

And include it in the `HotspotConfig` union:

```ts
export type HotspotConfig =
  | ActionConfig
  | TextConfig
  | StateImageConfig
  | StateIconConfig
  | BadgeConfig
  | SceneConfig
  | BlindConfig
  | BinsConfig
  | WeatherConfig
  | TemperatureGaugeConfig
  | WindroseConfig
  | ClockConfig
  | EnergyMeterConfig  // ← add here
  | Record<string, unknown>;
```

### 2. Create a Renderer component

Create `apps/web/src/hotspots/renderers/EnergyMeterHotspot.tsx`:

```tsx
import type { EnergyMeterConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";

export function EnergyMeterHotspot({ hotspot, entityState, ruleResult }: HotspotRendererProps) {
  const config = hotspot.configJson as EnergyMeterConfig;
  const stateStyle = ruleResult?.styleOverrides ?? {};

  const watts = entityState ? parseFloat(entityState.state) : null;
  const display = watts === null
    ? "—"
    : config.unit === "kW"
      ? `${(watts / 1000).toFixed(2)} kW`
      : `${watts.toFixed(0)} W`;

  const isWarning = config.warningThreshold !== null && watts !== null && watts > config.warningThreshold;

  return (
    <div
      className="flex h-full w-full items-center justify-center gap-1"
      style={{ color: stateStyle.color ?? (isWarning ? "#f87171" : "#ffffff") }}
      aria-label={hotspot.name}
    >
      {config.showIcon && <span aria-hidden="true">⚡</span>}
      <span className="text-sm font-medium tabular-nums">{display}</span>
    </div>
  );
}
```

**Renderer contract** — your component receives:

| Prop | Type | Description |
|---|---|---|
| `hotspot` | `HotspotRaw` | Full hotspot record including `configJson` and `stateRules` |
| `entityState` | `EntityState \| undefined` | Live HA entity state (undefined if no entity bound or not yet received) |
| `ruleResult` | `RuleResult \| null` | Result of evaluating state rules against current entity state |
| `isEditMode` | `boolean` | `true` when the editor canvas is active |

### 3. Register the type

Open `apps/web/src/hotspots/registry.ts` and add:

```ts
import { EnergyMeterHotspot } from "./renderers/EnergyMeterHotspot.tsx";

// ... at the bottom of the built-in registrations:

registerHotspotType({
  type: "energy_meter",
  label: "Energy Meter",
  description: "Display live power draw from a sensor entity",
  icon: "⚡",
  Renderer: EnergyMeterHotspot,
  defaultConfig: {
    unit: "W",
    showIcon: true,
    warningThreshold: null,
  } satisfies EnergyMeterConfig,
});
```

That's it — the new type will now appear in the type picker and render on the
dashboard.

### 4. Add editor config UI (optional)

Open `apps/web/src/components/editor/ConfigPanel.tsx` and add a branch to the
`StyleTab` component:

```tsx
if (hotspotType === "energy_meter") {
  const c = config as EnergyMeterConfig;
  return (
    <div className="flex flex-col gap-3">
      <Field label="Unit">
        <select
          value={c.unit}
          onChange={(e) => onChange({ ...c, unit: e.target.value as EnergyMeterConfig["unit"] })}
          className="input-field"
        >
          <option value="W">Watts (W)</option>
          <option value="kW">Kilowatts (kW)</option>
        </select>
      </Field>
      <Field label="Warning threshold (W)">
        <input
          type="number"
          value={c.warningThreshold ?? ""}
          onChange={(e) => onChange({ ...c, warningThreshold: e.target.value ? Number(e.target.value) : null })}
          className="input-field"
          placeholder="None"
        />
      </Field>
      <label className="flex items-center gap-2 text-[11px] text-gray-400">
        <input
          type="checkbox"
          checked={c.showIcon}
          onChange={(e) => onChange({ ...c, showIcon: e.target.checked })}
          className="rounded"
        />
        Show icon
      </label>
    </div>
  );
}
```

### 5. Add a migration function (if schema changes later)

If you later change the shape of `EnergyMeterConfig`, provide a `migrate` function
in the registry entry to upgrade persisted records:

```ts
registerHotspotType({
  type: "energy_meter",
  // ...
  migrate(raw) {
    return {
      unit: (raw.unit as string) ?? "W",
      showIcon: (raw.showIcon as boolean) ?? true,
      warningThreshold: (raw.warningThreshold as number | null) ?? null,
    };
  },
});
```

The `migrate` function is called lazily when loading hotspot data that does
not already match the current default config shape.

---

## Built-in types reference

| Type | File | Description |
|---|---|---|
| `action` | `ActionHotspot.tsx` | Tap/hold/double-tap to call HA services |
| `text` | `TextHotspot.tsx` | Display entity state value with `{{state}}` template |
| `state_image` | `StateImageHotspot.tsx` | Show different images based on on/off state |
| `state_icon` | `StateIconHotspot.tsx` | MDI icon with state-driven color and optional battery badge |
| `badge` | `BadgeHotspot.tsx` | Pill label with configurable state-to-text and state-to-color mapping |
| `scene` | `SceneHotspot.tsx` | Single-tap button for HA scene or script |
| `blind` | `BlindHotspot.tsx` | Cover/blind position control with drag slider; long-press for group control |
| `bins` | `BinsHotspot.tsx` | Bin day reminder driven by a HA calendar entity |
| `weather` | `WeatherHotspot.tsx` | Full weather card with 5-day forecast, UV index, hourly breakdown |
| `temperature_gauge` | `TemperatureGaugeHotspot.tsx` | Circular temperature badge; drives the floorplan heatmap overlay |
| `windrose` | `WindroseHotspot.tsx` | Compass rose showing live wind direction and speed |
| `battery` | `BatteryHotspot.tsx` | Aggregate battery health indicator; tap to show individual levels on floorplan |
| `clock` | `ClockHotspot.tsx` | Analog or digital clock with timezone and date support |
| `custom` | `CustomHotspot.tsx` | Silent placeholder in presentation mode; visible dashed outline in edit mode |

---

## Tips

- **Keep renderers pure**: read from `hotspot.configJson`, `entityState`, and
  `ruleResult`. Do not directly call the HA API from a renderer — use
  `api.ha.callService()` from the API client only for user-initiated actions.
- **Respect rule results**: always check `ruleResult?.styleOverrides` and apply
  them so the state rules system works for your type.
- **Accessibility**: include `aria-label={hotspot.name}` on the root element
  and appropriate ARIA roles where applicable.
- **Touch targets**: in presentation mode, ensure interactive elements are at
  least 44 × 44 CSS pixels (`min-h-[44px] min-w-[44px]` in Tailwind).
- **Edit mode placeholder**: if your renderer has no visible UI in presentation
  mode (e.g. a pure overlay), render a visible placeholder when `isEditMode`
  is `true` so the hotspot can be selected and configured.
- **Type safety**: use `satisfies YourConfig` on the `defaultConfig` object to
  catch typos and missing fields at build time.
