# @floorplan-ha/ha-client

Typed Home Assistant REST and WebSocket clients. Used exclusively by `apps/api` — never imported by the frontend.

## Contents

| File | Class / Function | Purpose |
|------|-----------------|---------|
| `src/rest-client.ts` | `HaRestClient` | HTTP calls to the HA REST API |
| `src/ws-client.ts` | `HaWebSocketClient` | WebSocket connection for real-time state changes |
| `src/normalizer.ts` | `normalizeState`, `normalizeStates` | Convert raw HA state objects to `EntityState` |
| `src/types.ts` | `HaStateResponse`, `HaServiceDomain`, … | Raw HA API response shapes |

## HaRestClient

```ts
const client = new HaRestClient(baseUrl, token);

await client.ping();                                 // verify reachability
await client.getStates();                            // all entity states
await client.getState("light.living_room");          // single entity
await client.getServices();                          // service definitions
await client.callService("light", "turn_on", { brightness: 255 }, { entityId: "light.living_room" });
await client.getConfig();                            // HA config (lat/lon, etc.)
await client.getCalendarEvents("calendar.home", start, end);
await client.getHistory("sensor.temp", start, end);
```

## HaWebSocketClient

```ts
const ws = new HaWebSocketClient(baseUrl, token);

ws.on((event) => {
  if (event.type === "connected") { /* ... */ }
  if (event.type === "state_changed") { /* event.state is EntityState */ }
  if (event.type === "disconnected") { /* ... */ }
});

ws.connect();    // initiates connection and auth flow
ws.disconnect(); // graceful close
ws.isConnected;  // boolean getter
```

**Auto-reconnect:** exponential backoff starting at 2 s, capped at 30 s. On reconnect, state-changed subscriptions are automatically re-established.

## Security

- The HA token is stored in a private class field
- It is sent only in the WebSocket auth message and REST `Authorization` headers — never returned to callers
- This package must never be imported by the frontend
