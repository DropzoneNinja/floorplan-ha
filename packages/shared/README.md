# @floorplan-ha/shared

Shared TypeScript types, Zod validation schemas, and the state rules engine. Used by both `apps/api` and `apps/web`.

## Contents

| File | Exports | Purpose |
|------|---------|---------|
| `src/types.ts` | All domain interfaces and unions | Single source of truth for all data shapes |
| `src/schemas.ts` | Zod schemas | Runtime validation matching the types |
| `src/rules-engine.ts` | `evaluateRules`, `mergeRuleResult` | Pure state rule evaluation |

## Types

Core domain types:

- `User`, `UserRole`
- `Dashboard`, `Floorplan`, `FloorplanImageMode`, `CycleImages`
- `Hotspot`, `HotspotType`, `HotspotPosition`, `HotspotConfig`
- Per-type config interfaces: `ActionConfig`, `TextConfig`, `StateImageConfig`, `StateIconConfig`, `BadgeConfig`, `SceneConfig`, `BlindConfig`, `BinsConfig`, `WeatherConfig`, `TemperatureGaugeConfig`, `WindroseConfig`, `BatteryConfig`, `ClockConfig`
- `HotspotStateRule`, `Condition`, `ConditionType`, `RuleResult`
- `Asset`, `AppSetting`, `EntityState`, `HaConnectionStatus`
- `RevisionHistory`, `RevisionAction`
- `ApiError`, `PaginatedResponse<T>`

## Rules Engine

The rules engine is **pure** — no side effects, no I/O — so it can be used identically on the frontend (real-time rendering) and backend (`POST /api/ha/preview-state`).

```ts
import { evaluateRules, mergeRuleResult } from "@floorplan-ha/shared";

const result = evaluateRules(hotspot.stateRules, entityState.state);
// result: RuleResult | null — first matching rule wins, sorted by priority
```

### Condition types

| Type | Matches when |
|------|-------------|
| `exact_match` | `state === value` |
| `numeric_range` | `parseFloat(state)` is within `min`..`max` |
| `truthy` | state is not `"", "0", "off", "closed", "false", "unavailable", "unknown"` |
| `falsy` | inverse of truthy |
| `fallback` | always matches (use as default/else) |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build -w packages/shared` | Compile to `dist/` |
| `npm run test -w packages/shared` | Run rules-engine unit tests |
