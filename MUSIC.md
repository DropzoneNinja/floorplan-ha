# Music Assistant Hotspot

## Context

The floorplan already has a "powerpoint" hotspot: a single icon that, when tapped, reveals individual item pins across the floorplan, each of which opens a control dialog. The user wants the same interaction shape for Music Assistant (added to their Home Assistant instance): one music icon on the floorplan that reveals every speaker's live now-playing + volume, lets you tap a speaker to browse/select music or playlists, move (and now group) playback across speakers, and view a speaker's upcoming-track queue. Speakers are a mix of Apple (HomePod/mini) and Sonos Five, unified as players inside Music Assistant. A look-and-feel reference (`../floorplan-ha-info/music-thoughts.png`, for visual/interaction inspiration only) shows per-room cards with album art, track/artist, transport controls, and a volume slider, connected to floorplan pins.

This repo (`floorplan-ha` / "HomePlan HA Dashboard") is a monorepo: `apps/web` (React 18 + Vite + TS + Tailwind + Zustand), `apps/api` (Fastify 5 + Prisma 6 + Postgres), `packages/shared` (types/Zod schemas), `packages/ha-client` (HA REST + WebSocket clients). Hotspots use a self-registering registry pattern (`docs/extending-hotspots.md`). There is currently **zero** media_player/Music Assistant code anywhere in the repo — this is a greenfield feature, built entirely on top of the existing generic HA integration layer (which is entity-domain-agnostic).

### Decisions made in this design session

| Question | Decision |
|---|---|
| Depth of music selection | **Hybrid**: a quick-tap favorites row (curated shortcuts) + a "Browse library" view with live Music Assistant browsing (Playlists/Artists/Albums/Radio) and search |
| Moving playback | **Both**: transfer (move what's playing to a different single speaker) **and** synced multi-speaker grouping |
| Speaker setup | All speakers are registered as players **inside Music Assistant** — every speaker has an MA-provided `media_player.*` entity, so MA-only services (transfer, rich browse) can be relied on uniformly, no native-integration fallback needed |
| "Current playlist" | Means the **play queue** — upcoming tracks for that player, not just the active playlist name (which is already shown as a subtitle under the track title) |

### Design simplifications (proposed defaults, not blocking questions)

- **Card layout on the overlay**: cards render anchored directly at each speaker's configured floorplan position (like Powerpoint's pins, but richer content), not with leader-line routing to a separate callout position as in the reference image. This matches the existing Powerpoint/Battery pin pattern exactly and avoids building collision-avoidance/connector-routing logic. If two speakers are close together on the real floorplan, the admin nudges pin positions apart during placement — the same manual mechanism already used for Powerpoint/Battery items.
- **Idle aggregate icon**: shows a generic speaker icon when nothing is playing anywhere; when one or more speakers are playing, it shows a small rotating "now playing" indicator (album art thumbnail, or a music-note fallback) that cycles every ~5s through each currently-active speaker. This is a v1 default and easy to change later.
- **Exact Music Assistant service/field names** (e.g. for transfer, grouping, queue retrieval) are **not hard-coded from memory** in this plan — MA's HA integration service surface can shift between versions. Implementation starts by hitting the already-existing `GET /api/ha/services` endpoint against the user's live HA instance and reading the real `music_assistant.*` and `media_player.*` service definitions before wiring the control dialog's service calls. This is called out explicitly below as Milestone 0.

---

## Architecture

Follows the existing registry pattern (`docs/extending-hotspots.md`) using **Powerpoint as the primary template** (aggregate icon → overlay of item pins → per-item dialog, admin placement layer, Zustand visibility store) and **Light/Blind hotspots** as the secondary template for in-dialog controls (tap-vs-long-press, custom pointer-drag slider, `createPortal` modal convention, toast-based error surfacing).

```
MusicHotspot (aggregate icon, on floorplan)
  → click → useMusicStore.toggle()
MusicOverlayLayer (mounted once in DashboardPage/AdminPage, like PowerpointOverlayLayer)
  → renders one SpeakerCard per configured speaker item, anchored at its x/y
  → each card: room name, album art, track/artist, prev/play-pause/next, volume slider
  → click backdrop → dismiss overlay
  → click a card → MusicControlDialog (portal modal)
MusicControlDialog (per-speaker, tabbed/stateful)
  → Main view: favorites quick row, "Browse library", "Queue", "Move / Group" buttons
  → Browse view: MA library browse + search (Playlists/Artists/Albums/Radio)
  → Queue view: upcoming tracks for this player
  → Move/Group view: pick target speaker(s); transfer vs. synced group
MusicEditorLayer (admin mode, like PowerpointEditorLayer)
  → drag-place speaker pins, mirrors PowerpointEditorLayer's pointer-drag math
```

All HA communication stays server-side-only, unchanged: browser → `api.ha.*` (REST) → Fastify `/api/ha/*` → `HaService` (singleton, owns `HaRestClient` + `HaWebSocketClient`) → Home Assistant. Live state (volume, playing/paused, track title, album art path) flows automatically through the existing WS → SSE → `useEntityStateStore` pipeline with **no changes** — that pipeline is entity-domain-agnostic and already works for any `media_player.*` entity today.

Two backend additions are required beyond a plain service-call hotspot (see below): a **browse_media WS passthrough** (for library browsing) and a **media image proxy** (for album art), because of this app's "browser never talks to HA directly" security model.

---

## Data model

`packages/shared/src/types.ts` — new config shape, following the `PowerpointItem`/`PowerpointConfig` pattern:

```ts
export interface MusicSpeaker {
  id: string;                // stable UUID
  name: string;               // "Living Room"
  x: number; y: number;       // normalized 0–1, same convention as PowerpointItem
  entityId: string | null;    // media_player.* entity (Music Assistant player)
}

export interface MusicFavorite {
  id: string;
  label: string;               // "Morning Jazz"
  mediaId: string;              // MA media URI
  mediaType: string;             // "playlist" | "radio" | "album" | "track" | "artist" | ...
  imageUrl?: string | null;
}

export interface MusicConfig {
  speakers: MusicSpeaker[];
  favorites: MusicFavorite[];   // global quick-pick shortcuts, usable from any speaker's dialog
  backgroundColor: string | null;
}
```

Add `"music"` to the `HotspotType` union and `MusicConfig` to the `HotspotConfig` union (one-word type id, consistent with `battery`/`powerpoint`/`clock`).

Per the registry checklist confirmed against this codebase (not just `docs/extending-hotspots.md`, which misses the DB-enum step), a new hotspot type touches **four** places:
1. `packages/shared/src/types.ts` — `HotspotType` union + `MusicConfig` + `HotspotConfig` union
2. `packages/shared/src/schemas.ts` — add `"music"` to the `HotspotTypeSchema` Zod enum (config itself stays `z.record(z.unknown())`, matching every other type except the few with dedicated schemas)
3. `apps/api/prisma/schema.prisma` — add `music` to `enum HotspotType`, plus a new migration (mirror `apps/api/prisma/migrations/20260826000000_add_powerpoint_hotspot_type/migration.sql`): `ALTER TYPE "HotspotType" ADD VALUE 'music';`
4. `apps/web/src/hotspots/registry.ts` — `registerHotspotType({...})`

---

## Backend additions

`apps/api/src/services/ha.ts` (`HaService`) — two new methods, both following the existing `getStatisticsDuringPeriod()` precedent (a WS-only HA command with no REST equivalent, sent via `HaWebSocketClient.sendCommand<T>()`):

- `browseMedia(entityId, mediaContentType?, mediaContentId?)` → `haWsClient.sendCommand("media_player/browse_media", { entity_id, media_content_type, media_content_id })`. Powers both the "Browse library" view (root call with no content id) and drill-down navigation.
- `getMediaImage(entityId)` → server-side fetch of the entity's `entity_picture` attribute path against `HA_BASE_URL` (using the stored `HA_TOKEN`), returning the image bytes/content-type. Required because `entity_picture` is an HA-relative path that the browser can never resolve directly under this app's security model (browser never reaches `HA_BASE_URL`).

`apps/api/src/routes/ha.ts` — two new routes, both `requireAuth` like the existing HA routes:
- `GET /api/ha/media/browse?entityId=&mediaContentType=&mediaContentId=`
- `GET /api/ha/media-image/:entityId` (streams the proxied album art)

No new route needed for transport controls, volume, transfer, or grouping — those are plain `media_player.*`/`music_assistant.*` service calls through the **existing** `POST /api/ha/services/:domain/:service`, exactly like `LightHotspot`/`BlindHotspot` already do.

`apps/web/src/api/client.ts` — add `ha.browseMedia(...)` and `ha.mediaImageUrl(entityId)` (returns a proxied URL string, mirroring `assets.fileUrl(id)`).

---

## Frontend additions

New files, modeled directly on the Powerpoint set:

| New file | Modeled on |
|---|---|
| `apps/web/src/hotspots/renderers/MusicHotspot.tsx` | `PowerpointHotspot.tsx` |
| `apps/web/src/hotspots/MusicOverlayLayer.tsx` (speaker cards + backdrop dismiss) | `PowerpointOverlayLayer.tsx` |
| `apps/web/src/hotspots/MusicControlDialog.tsx` (main/browse/queue/move views) | `PowerpointControlDialog.tsx` + `LightHotspot.tsx`'s modal/slider conventions |
| `apps/web/src/hotspots/MusicEditorLayer.tsx` | `PowerpointEditorLayer.tsx` |
| `apps/web/src/store/music.ts` (`visibleHotspotId`, `triggeredByZIndex`, `toggle`, `hide`) | `store/powerpoint.ts` |
| `apps/web/src/store/music-placement.ts` | `store/powerpoint-placement.ts` |

Reused as-is: `useEntityStateStore` for live state, `api.ha.callService()` for all actions, `EntityPicker` (editor) for binding each speaker to a `media_player.*` entity, `useToastStore` for error surfacing, the existing `createPortal` bottom-sheet-on-mobile/centered-on-desktop modal convention (no shared Modal component exists in this codebase — every hotspot hand-rolls it the same way; follow suit).

`apps/web/src/hotspots/icons.ts` — add transport/volume MDI path entries (play, pause, skip-next, skip-previous, volume-high/low/off, shuffle, repeat, speaker-group); a Media icon category already exists (`mdi:speaker`, `mdi:cast`) but has no transport controls yet.

`apps/web/src/components/editor/ConfigPanel.tsx` — new `MusicActionsTab` (add/place/remove speaker items, each with a name + `EntityPicker`, mirroring `PowerpointActionsTab`'s add/place flow via `usePowerpointPlacementStore`-style state) plus a favorites list editor (label + MA media URI/type — resolved via the Browse view's "add to favorites" action once that exists, with manual entry as the v1 fallback) and the `backgroundColor` style-tab branch.

`apps/web/src/pages/DashboardPage.tsx` and `AdminPage.tsx` — mount `MusicOverlayLayer` (both pages) and `MusicEditorLayer` (`AdminPage` only), exactly where `PowerpointOverlayLayer`/`PowerpointEditorLayer` are mounted today — these overlay/editor layers are hand-wired per page, not auto-discovered from the registry.

Docs: `docs/hotspots/music.md` (new, mirrors `powerpoint.md`'s structure) + a row in `docs/extending-hotspots.md`'s built-in types table.

---

## Build milestones

Given the scope, build in stages rather than one pass — each is independently useful and reviewable:

- **M0 — API discovery.** Query the live `GET /api/ha/services` (already implemented) for the `media_player` and `music_assistant` domains on the user's actual HA instance. Confirms exact service names/fields for play/pause/volume/select-source, transfer, grouping (standard `media_player.join`/`unjoin` vs. an MA-specific group service), and how the queue is retrieved, before writing any control-dialog code against them.
- **M1 — Foundation.** Registry plumbing (types/schema/Prisma migration), `MusicHotspot` aggregate icon, `MusicOverlayLayer` with per-speaker now-playing cards (album art via the new image proxy, track/artist, transport controls, volume slider), `MusicEditorLayer` + `MusicActionsTab` admin config for adding/placing speakers. This alone delivers "click the icon → see every speaker's now-playing + volume" end to end.
- **M2 — Selection.** `MusicControlDialog`'s favorites quick row + full Browse view (`browseMedia` backend route + drill-down UI + search) for picking what plays where.
- **M3 — Move & group.** Transfer-to-another-speaker and synced multi-speaker grouping, using the service names confirmed in M0.
- **M4 — Queue view.** Upcoming-tracks view for a given player.
- **M5 — Polish.** Idle-icon rotation among active speakers, offline/unavailable-player states, long text truncation, docs page.

---

## Critical files

**New:** `apps/web/src/hotspots/renderers/MusicHotspot.tsx`, `MusicOverlayLayer.tsx`, `MusicControlDialog.tsx`, `MusicEditorLayer.tsx`, `apps/web/src/store/music.ts`, `music-placement.ts`, `apps/api/prisma/migrations/<ts>_add_music_hotspot_type/migration.sql`, `docs/hotspots/music.md`.

**Modified:** `packages/shared/src/types.ts`, `packages/shared/src/schemas.ts`, `apps/api/prisma/schema.prisma`, `apps/api/src/services/ha.ts`, `apps/api/src/routes/ha.ts`, `apps/web/src/api/client.ts`, `apps/web/src/hotspots/registry.ts`, `apps/web/src/hotspots/icons.ts`, `apps/web/src/components/editor/ConfigPanel.tsx`, `apps/web/src/pages/DashboardPage.tsx`, `apps/web/src/pages/AdminPage.tsx`, `docs/extending-hotspots.md`.

**Reference implementations to copy patterns from:** `apps/web/src/hotspots/renderers/PowerpointHotspot.tsx`, `PowerpointOverlayLayer.tsx`, `PowerpointControlDialog.tsx`, `PowerpointEditorLayer.tsx`, `apps/web/src/hotspots/renderers/LightHotspot.tsx` (long-press modal, drag slider), `apps/web/src/hotspots/renderers/BlindHotspot.tsx` (group service-call fan-out via `Promise.all`).

---

## Verification

- **M1:** Run the stack locally (`docker compose up`), confirm `GET /api/ha/services` and `GET /api/ha/entities` surface the configured `media_player.*` (Music Assistant) entities. In the admin editor, add 2–3 speaker items bound to real entities, place their pins, save. On the presentation dashboard, tap the music icon and confirm each configured speaker's card shows correct live play/pause state, track/artist, and volume (cross-check against the actual Music Assistant panel), and that volume dragged in the card updates the real speaker within ~1s. Click empty floorplan space and confirm the overlay dismisses.
- **M2:** From a speaker's dialog, play a favorite and confirm audio starts on the correct physical speaker; use Browse to drill into a playlist/artist and play a track; use search and play a result.
- **M3:** Start playback on speaker A, transfer to speaker B, confirm playback stops on A and resumes on B at the same position. Group B+C, confirm synced audio, then ungroup and confirm both return to independent control.
- **M4:** Queue several tracks on one player, open its Queue view, confirm the upcoming-tracks order matches Music Assistant's own queue.
- Throughout: verify with the API/Home Assistant temporarily disconnected that the hotspot fails gracefully (existing stale/disconnected indicator, no crash), matching the reliability behavior of every other hotspot type.
