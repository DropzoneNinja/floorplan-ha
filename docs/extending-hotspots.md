# Extending Hotspots

This guide explains how to add a new hotspot type to HomePlan HA Dashboard.
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

### 1. Define a config interface in `packages/shared`

Open `packages/shared/src/types.ts` and add a typed interface for your
hotspot's configuration:

```ts
// packages/shared/src/types.ts
export interface WeatherConfig {
  unit: "celsius" | "fahrenheit";
  showIcon: boolean;
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
  | "custom"
  | "weather";  // ← add here
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
  | WeatherConfig  // ← add here
  | Record<string, unknown>;
```

### 2. Create a Renderer component

Create `apps/web/src/hotspots/renderers/WeatherHotspot.tsx`:

```tsx
import type { WeatherConfig } from "@floorplan-ha/shared";
import type { HotspotRendererProps } from "../types.ts";

export function WeatherHotspot({ hotspot, entityState, ruleResult }: HotspotRendererProps) {
  const config = hotspot.configJson as WeatherConfig;
  const stateStyle = ruleResult?.styleOverrides ?? {};

  const temperature = entityState?.attributes["temperature"] as number | undefined;
  const unit = config.unit === "fahrenheit"
    ? `${temperature ? (temperature * 9/5 + 32).toFixed(1) : "—"} °F`
    : `${temperature?.toFixed(1) ?? "—"} °C`;

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ color: stateStyle.color ?? "#ffffff" }}
    >
      {config.showIcon && <span aria-hidden="true">🌡 </span>}
      <span className="text-sm font-medium">{unit}</span>
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
import { WeatherHotspot } from "./renderers/WeatherHotspot.tsx";

// ... at the bottom of the built-in registrations:

registerHotspotType({
  type: "weather",
  label: "Weather / Temperature",
  description: "Display temperature or weather condition from a climate or sensor entity",
  icon: "🌡",
  Renderer: WeatherHotspot,
  defaultConfig: {
    unit: "celsius",
    showIcon: true,
  },
});
```

That's it — the new type will now appear in the type picker and render on the
dashboard.

### 4. Add editor config UI (optional)

Open `apps/web/src/components/editor/ConfigPanel.tsx` and add a branch to the
`StyleTab` component:

```tsx
if (hotspotType === "weather") {
  const c = config as WeatherConfig;
  return (
    <div className="flex flex-col gap-3">
      <Field label="Temperature unit">
        <select
          value={c.unit}
          onChange={(e) => onChange({ ...c, unit: e.target.value as WeatherConfig["unit"] })}
          className="input-field"
        >
          <option value="celsius">Celsius (°C)</option>
          <option value="fahrenheit">Fahrenheit (°F)</option>
        </select>
      </Field>
      <label className="flex items-center gap-2 text-[11px] text-gray-400">
        <input
          type="checkbox"
          checked={c.showIcon}
          onChange={(e) => onChange({ ...c, showIcon: e.target.checked })}
          className="rounded"
        />
        Show thermometer icon
      </label>
    </div>
  );
}
```

### 5. Add a migration function (if schema changes later)

If you later change the shape of `WeatherConfig`, provide a `migrate` function
in the registry entry to upgrade persisted records:

```ts
registerHotspotType({
  type: "weather",
  // ...
  migrate(raw) {
    return {
      unit: (raw.unit as string) ?? "celsius",
      showIcon: (raw.showIcon as boolean) ?? true,
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
| `text` | `TextHotspot.tsx` | Display entity state value with template |
| `state_image` | `StateImageHotspot.tsx` | Show different images based on on/off state |
| `state_icon` | `StateIconHotspot.tsx` | MDI icon with state-driven color and optional badge |
| `badge` | `BadgeHotspot.tsx` | Pill label with configurable state-to-text mapping |
| `scene` | `SceneHotspot.tsx` | Single-tap button for HA scene/script |
| `custom` | `CustomHotspot.tsx` | Placeholder — meant to be replaced via the registry |

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
