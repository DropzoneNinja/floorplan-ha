# Architecture

This document describes the system architecture, component relationships, and data flow for floorplan-ha.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / Kiosk                       │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │                    React Frontend                     │  │
│   │  Presentation mode · Editor · Settings · Assets      │  │
│   │                                                      │  │
│   │  Zustand stores ←── SSE stream ──────────────────┐  │  │
│   └──────────────────┬───────────────────────────────┘  │  │
└──────────────────────┼──────────────────────────────────┼──┘
                       │ REST (HTTP)                       │ SSE
                       ▼                                   │
┌──────────────────────────────────────────────────────────┴──┐
│                      Fastify API (Node.js)                   │
│                                                              │
│  Auth · Dashboards · Floorplans · Hotspots · Assets          │
│  Settings · Revisions · Backup · Weather proxy               │
│                                                              │
│  HaService (singleton) ─────────────────────────────────┐   │
│    ├─ HaRestClient (REST calls to HA)                   │   │
│    ├─ HaWebSocketClient (real-time state changes)       │   │
│    └─ State cache (Map<entityId, EntityState>)          │   │
└──────────────────────────────┬──────────────────────────┘   │
                               │                               │
              ┌────────────────┴──────────────┐               │
              ▼                               ▼               │
┌─────────────────────┐          ┌────────────────────────┐   │
│   PostgreSQL 16     │          │   Home Assistant        │   │
│   (Prisma ORM)      │          │   WebSocket + REST API  │───┘
└─────────────────────┘          └────────────────────────┘
```

---

## Monorepo Structure

```
floorplan-ha/
├── apps/
│   ├── api/                  # Fastify 5 REST API backend
│   └── web/                  # React 18 + Vite frontend
├── packages/
│   ├── shared/               # Shared types, Zod schemas, rules engine
│   └── ha-client/            # Home Assistant REST & WebSocket clients
├── docker/
│   ├── api.Dockerfile
│   ├── web.Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

Build order (enforced by npm `build` script):
`packages/shared` → `packages/ha-client` → `apps/api` + `apps/web`

---

## Frontend (`apps/web`)

**Stack:** React 18, Vite, TypeScript, Tailwind CSS, Zustand, TanStack Query, React Router 6, React Hook Form, Zod

### Key directories

| Path | Purpose |
|------|---------|
| `src/pages/` | Top-level route components |
| `src/hotspots/` | Hotspot rendering system (registry, renderers, layers) |
| `src/components/editor/` | Config panel, entity/service pickers, state rules form |
| `src/components/` | Shared UI: asset manager, connection status, screensaver |
| `src/store/` | Zustand stores (auth, entity states, editor, theme, …) |
| `src/hooks/` | Custom hooks: `useStateStream`, `useInactivity`, `useSolarImage` |
| `src/api/` | HTTP client wrapper |

### Routing

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | `LoginPage` | Public |
| `/change-password` | `ChangePasswordPage` | Authenticated |
| `/` | `DashboardPage` | Authenticated |
| `/admin` | `AdminPage` | Admin only |
| `/admin/settings` | `SettingsPage` | Admin only |
| `/admin/assets` | `AssetsPage` | Admin only |
| `/admin/dashboards` | `DashboardsPage` | Admin only |

### State management

| Store | Contents |
|-------|---------|
| `auth` | Current user, JWT, login/logout |
| `entity-states` | Live `EntityState` map keyed by entity ID |
| `editor` | Dirty hotspots, undo/redo history, selected hotspot |
| `theme` | Dark/light theme preference |
| `toast` | Notification queue |
| `battery` | Battery overlay visibility toggle |
| `heatmap` | Heatmap overlay visibility toggle |

### Hotspot registry

The registry (`src/hotspots/registry.ts`) maps each `HotspotType` string to a `HotspotTypeDefinition`:

```ts
interface HotspotTypeDefinition<TConfig> {
  type: HotspotType;
  label: string;
  description: string;
  icon: string;
  Renderer: React.ComponentType<HotspotRendererProps>;
  defaultConfig: TConfig;
  migrate?: (raw: Record<string, unknown>) => TConfig;
}
```

`HotspotRenderer` dispatches to the correct renderer via registry lookup. New types are registered by calling `registerHotspotType()` — no core file changes required.

### Live state updates

`useStateStream` opens a Server-Sent Events connection to `GET /api/state/stream`. On connect, the backend sends an `init` event containing a snapshot of all cached entity states. Subsequent `state_changed` events are applied incrementally to the `entity-states` Zustand store. Hotspot renderers subscribe reactively to their bound entity ID.

---

## Backend (`apps/api`)

**Stack:** Node.js, Fastify 5, Prisma 6, PostgreSQL 16, Argon2, Jose (JWT)

### Key directories

| Path | Purpose |
|------|---------|
| `src/server.ts` | App bootstrap, plugin registration, startup sequence |
| `src/routes/` | One file per resource group |
| `src/services/ha.ts` | HA singleton (WS + REST clients, state cache, SSE fan-out) |
| `src/services/asset-storage.ts` | Local file storage for uploads |
| `src/services/backup.ts` | Scheduled backup creation and restore |
| `src/services/revisions.ts` | Audit trail helper |
| `src/middleware/auth.ts` | JWT extraction, `requireAuth`, `requireAdmin` guards |
| `src/lib/env.ts` | Startup environment variable validation (Zod) |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/jwt.ts` | Sign / verify JWT helpers |
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts` | Default admin user + dashboard seeding |

### Request lifecycle

```
HTTP request
  → Fastify routing
  → requireAuth / requireAdmin (if protected)
  → Zod body/query validation
  → Route handler
  → Prisma query / HaService call
  → JSON response
```

### Authentication

- Passwords hashed with **Argon2id**
- JWT signed with `SESSION_SECRET` (HS256, 7-day expiry)
- Token delivered via `Authorization: Bearer <token>` header or `token` cookie
- `requireAuth` attaches decoded payload to `request.user`
- `requireAdmin` additionally checks `request.user.role === "admin"`

### Home Assistant integration

`HaService` is a singleton that owns:
- `HaRestClient` — typed HTTP calls to the HA REST API
- `HaWebSocketClient` — persistent WebSocket connection for real-time `state_changed` events
- In-memory `Map<entityId, EntityState>` state cache

On startup (`server.ts` line ~102), `getHaService().connect()` is called which:
1. Opens the WebSocket connection to HA
2. Authenticates using `HA_TOKEN`
3. Subscribes to all `state_changed` events
4. Hydrates the state cache via `getStates()` REST call

State changes are broadcast to connected frontend SSE clients via a subscriber callback list.

---

## Shared Package (`packages/shared`)

**Contents:**
- `types.ts` — all domain TypeScript interfaces and unions
- `schemas.ts` — Zod validation schemas matching the types
- `rules-engine.ts` — pure `evaluateRules()` and `mergeRuleResult()` functions

The rules engine is deliberately pure (no side effects, no I/O) so it can be used identically on the frontend (real-time rendering) and backend (preview endpoint `POST /api/ha/preview-state`).

---

## HA Client Package (`packages/ha-client`)

**Contents:**

| File | Class/Function | Purpose |
|------|---------------|---------|
| `rest-client.ts` | `HaRestClient` | Typed HTTP calls to HA REST API |
| `ws-client.ts` | `HaWebSocketClient` | WebSocket connection, auth flow, auto-reconnect |
| `normalizer.ts` | `normalizeState` / `normalizeStates` | Convert raw HA API objects to `EntityState` |

The token is stored only in private class fields and used only for outbound requests to HA — it is never returned in any API response.

---

## Database Schema

Core models and their relationships:

```
Dashboard
  └── Floorplan (many)
        └── Hotspot (many)
              └── HotspotStateRule (many)

Asset  ←── referenced by Floorplan.imageAssetId, Floorplan.heatmapMaskAssetId,
           Floorplan.cycleImages, and hotspot configJson fields

User   ←── referenced by RevisionHistory.userId
AllowedEmail  (controls who can register)
AppSetting    (key/value store for app-wide settings)
RevisionHistory  (audit trail for all create/update/delete operations)
```

---

## Data Flow: Live Entity State

```
Home Assistant
  │  WebSocket state_changed event
  ▼
HaWebSocketClient (packages/ha-client)
  │  normalizeState()
  ▼
HaService (apps/api/src/services/ha.ts)
  │  updates stateCache
  │  calls subscriber callbacks
  ▼
state-stream route (apps/api/src/routes/state-stream.ts)
  │  SSE: "data: {entityId, state, …}\n\n"
  ▼
useStateStream hook (apps/web/src/hooks/use-state-stream.ts)
  │  dispatches to entity-states Zustand store
  ▼
HotspotRenderer (apps/web/src/hotspots/HotspotRenderer.tsx)
  │  evaluateRules(hotspot.stateRules, entityState.state)
  ▼
Type-specific renderer (e.g. StateIconHotspot, TextHotspot, …)
```

---

## Deployment

See [deployment.md](deployment.md) for full Docker Compose production setup.

The compose stack has four services:
1. **postgres** — PostgreSQL 16 with persistent volume
2. **migrate** — runs `prisma migrate deploy` + seed once on startup
3. **api** — Fastify API with bind-mounted upload and backup volumes
4. **web** — nginx serving the built React app; proxies `/api/*` to the api service
