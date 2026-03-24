# Home Assistant Integration

How floorplan-ha connects to Home Assistant, the WebSocket protocol, the security model, and how entity state flows to the browser.

---

## Overview

All communication with Home Assistant happens **server-side only**. The browser never contacts HA directly and never sees the long-lived access token. The API acts as a secure proxy:

```
Browser ──SSE──► API ──WebSocket──► Home Assistant
         REST         REST
```

---

## Setup

### 1. Generate a Long-Lived Access Token

1. In Home Assistant, click your profile picture (bottom-left sidebar)
2. Scroll to **Long-Lived Access Tokens**
3. Click **Create Token**, give it a name (e.g. "floorplan-ha"), and copy it

### 2. Configure the API

Set these two variables in your `.env`:

```env
HA_BASE_URL=http://homeassistant.local:8123   # No trailing slash
HA_TOKEN=eyJ...your_token_here...
```

`HA_BASE_URL` must be reachable from the machine running the API container — use an IP or hostname that resolves inside Docker, not `localhost` unless the API runs on the same host.

### 3. Verify Connection

After starting the API, check the connection status:

- **Admin UI:** go to `/admin/settings` — the Home Assistant section shows connection state and last connected timestamp
- **API endpoint:** `GET /api/ha/status` returns `{ connected, lastConnectedAt, error }`

---

## Architecture

### `packages/ha-client`

This package contains two independent clients:

#### `HaRestClient`

Typed HTTP client for the HA REST API. Used for:
- Fetching all entity states on startup (`GET /api/states`)
- Single entity state queries (`GET /api/states/:entity_id`)
- Service calls (`POST /api/services/:domain/:service`)
- Service definitions (`GET /api/services`)
- HA configuration (latitude/longitude for solar calculations)
- Calendar events and historical state data

The token is passed as `Authorization: Bearer <token>` on every request and is never returned to callers.

#### `HaWebSocketClient`

Persistent WebSocket connection to HA for real-time state updates.

**Connection sequence:**

```
Client                          Home Assistant
  │                                    │
  │── ws://ha-host:8123/api/websocket ─►│
  │                                    │
  │◄──── { type: "auth_required" } ────│
  │                                    │
  │── { type: "auth",                  │
  │    access_token: "..." } ─────────►│
  │                                    │
  │◄──── { type: "auth_ok" } ──────────│
  │                                    │
  │── { type: "subscribe_events",      │
  │    event_type: "state_changed",    │
  │    id: 1 } ───────────────────────►│
  │                                    │
  │◄──── { type: "result",             │
  │        success: true } ────────────│
  │                                    │
  │◄──── { type: "event",              │  (fires whenever any entity changes)
  │        event: { ... } } ───────────│
```

**Auto-reconnect:** If the connection drops, the client schedules a reconnect with exponential backoff (initial 2 s, doubles each attempt, capped at 30 s). On reconnect, it re-subscribes to `state_changed` and re-hydrates the state cache via REST.

**Events emitted by `HaWebSocketClient`:**

| Event | Payload | When |
|-------|---------|------|
| `connected` | — | WebSocket authenticated successfully |
| `disconnected` | — | Connection lost or closed |
| `state_changed` | `EntityState` | Any HA entity state changes |
| `error` | `Error` | Protocol or connection error |

### `apps/api/src/services/ha.ts` — HaService singleton

`HaService` owns both clients and coordinates the data pipeline:

```
HaWebSocketClient
  │  state_changed event
  │  normalizeState()
  ▼
stateCache: Map<entityId, EntityState>   ← always up-to-date
  │
  │  notifies subscriber callbacks
  ▼
state-stream route (SSE fan-out to all connected browsers)
```

Key methods exposed to routes:

| Method | Used by |
|--------|--------|
| `getAllStates()` | `GET /api/ha/states`, `GET /api/ha/entities` |
| `getState(entityId)` | `GET /api/ha/entities/:entity_id` |
| `getServices()` | `GET /api/ha/services` |
| `callService(domain, service, data, target)` | `POST /api/ha/services/:domain/:service` |
| `getConfig()` | Solar image calculation |
| `getCalendarEvents(entityId, start, end)` | `GET /api/ha/calendar/:entityId/events` |
| `getHistory(entityId, start, end)` | `GET /api/ha/history/:entityId` |
| `onStateChange(callback)` | SSE route subscription |

---

## Real-Time State Stream (SSE)

The frontend connects to `GET /api/state/stream` using the browser's `EventSource` API. This is a Server-Sent Events (SSE) endpoint.

### Protocol

**On connect:** The server immediately sends an `init` event containing the full cached state snapshot:

```
event: init
data: [{"entityId":"light.living_room","state":"on","attributes":{...},...},...]
```

**On state change:** Each entity update is pushed as a `state_changed` event:

```
event: state_changed
data: {"entityId":"light.living_room","state":"off","attributes":{...},...}
```

**Heartbeat:** A comment line is sent every 30 seconds to keep the connection alive through proxies:

```
: heartbeat
```

### Frontend handling (`useStateStream` hook)

The `useStateStream` hook (called once in `DashboardPage`) manages the `EventSource` lifecycle:

1. Opens `EventSource` to `/api/state/stream`
2. On `init`: bulk-loads the entity state store
3. On `state_changed`: updates the single entity in the Zustand store
4. On error: closes and reconnects with exponential backoff (2 s → 4 s → 8 s → capped at 30 s)
5. On unmount: closes the connection

Hotspot renderers read from the Zustand store reactively — each renderer only re-renders when its bound `entityId` changes.

---

## API Routes (HA Proxy)

All HA proxy routes require authentication.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ha/status` | Connection status and last-connected timestamp |
| `GET` | `/api/ha/entities` | All entity states (from cache) |
| `GET` | `/api/ha/entities/:entity_id` | Single entity state |
| `GET` | `/api/ha/services` | All service definitions from HA |
| `POST` | `/api/ha/services/:domain/:service` | Call a HA service |
| `GET` | `/api/ha/states` | Bulk entity states (alias for entities) |
| `GET` | `/api/ha/config` | HA configuration (latitude, longitude, etc.) |
| `GET` | `/api/ha/calendar/:entityId/events` | Calendar events for a date range |
| `GET` | `/api/ha/history/:entityId` | Historical state values for an entity |
| `POST` | `/api/ha/preview-state` | Evaluate state rules against a given state value |

---

## Security Model

| Concern | How it's handled |
|---------|-----------------|
| Token storage | `HA_TOKEN` lives in `.env` / environment variable only; loaded into memory by the API process at startup |
| Token transmission | Sent only in outbound requests from the API to HA (`Authorization: Bearer`) — never included in any API response |
| Token in browser | Never. All HA calls go through the `/api/ha/*` proxy endpoints which require a valid user JWT |
| User authentication | Every `/api/ha/*` route requires `requireAuth` — unauthenticated requests receive `401` |
| Service calls | Require `requireAuth`; the calling user's JWT is validated before any service call is forwarded to HA |

---

## Supported HA Entity Domains

floorplan-ha works with any HA entity. The following domains have specific UI support:

| Domain | Hotspot type(s) | Notes |
|--------|----------------|-------|
| `light`, `switch`, `input_boolean` | `action`, `state_icon` | On/off state with color overrides |
| `cover` | `blind` | Position control (0–100%), group control |
| `sensor`, `input_number` | `text`, `temperature_gauge` | Numeric state with template formatting |
| `binary_sensor` | `state_icon`, `badge` | Truthy/falsy condition matching |
| `calendar` | `bins` | Event title matching for bin day display |
| `scene`, `script` | `scene`, `action` | Service call on tap |
| `weather` (Open-Meteo) | `weather` | External forecast fetched directly by the `weather` renderer |
| Any | `state_image` | Show different asset images per state |
| Any | `action` | Call any service with any data |

---

## Troubleshooting

**"Disconnected from Home Assistant" indicator showing**

- Check that `HA_BASE_URL` is reachable from inside the API container: `docker compose exec api curl $HA_BASE_URL/api/`
- Verify the token is valid: the same `curl` with `-H "Authorization: Bearer $HA_TOKEN"` should return `{"message":"API running."}`
- Check API logs: `docker compose logs api | grep ha`

**Entity not updating in real time**

- Confirm the SSE connection is open: browser DevTools → Network → filter by `stream` — should show an open request to `/api/state/stream`
- Check that the entity ID in the hotspot config exactly matches the entity ID in HA (case-sensitive)
- Restart the API to force a WebSocket reconnect and cache re-hydration

**Service call failing**

- Use the editor's "Test" button in the Actions tab to see the raw error from HA
- Verify the domain and service exist: `GET /api/ha/services` lists everything HA exposes
- Check the `serviceData` payload — some services require specific fields (e.g. `brightness` for `light.turn_on`)
