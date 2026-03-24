# HomePlan HA Dashboard — TODO

> Comprehensive task list derived from PROJECT.md. Check off items as they are completed.

---

## Phase 1 — Project Foundation

### Monorepo Scaffold
- [x] Initialize root `package.json` with workspaces (`apps/*`, `packages/*`)
- [x] Create directory structure: `apps/web`, `apps/api`, `packages/shared`, `packages/ui`, `packages/ha-client`
- [x] Add root `tsconfig.base.json` with strict TypeScript settings
- [x] Add per-package `tsconfig.json` files extending base
- [x] Configure ESLint at root with shared config
- [x] Configure Prettier at root
- [x] Add `.gitignore` covering `node_modules`, `dist`, `.env`, uploads
- [x] Add npm workspace config (package.json workspaces field)

### Docker & Infrastructure
- [x] Write `docker-compose.yml` with services: `web`, `api`, `postgres`
- [x] Configure persistent volume for PostgreSQL data
- [x] Configure persistent volume for uploaded assets (`ASSET_STORAGE_PATH`)
- [x] Set up Dockerfile for `apps/api` (production build) — `docker/api.Dockerfile`
- [x] Set up Dockerfile for `apps/web` (production build with Nginx) — `docker/web.Dockerfile`
- [x] Add health checks to Compose services
- [x] Add nginx reverse proxy config — `docker/nginx.conf`
- [x] Add `migrate` one-shot service to run Prisma migrations on startup

### Environment Configuration
- [x] Create `.env.example` with all required variables and inline comments
- [x] Validate all required env vars at API startup (fail fast) — `apps/api/src/lib/env.ts`
- [ ] Document env vars in `docs/deployment.md`

### Database — Schema & Migrations
- [x] Initialize Prisma in `apps/api`
- [x] Define `User` model
- [x] Define `Dashboard` model
- [x] Define `Floorplan` model
- [x] Define `Hotspot` model
- [x] Define `Asset` model
- [x] Define `HotspotStateRule` model
- [x] Define `AppSetting` model
- [x] Define `RevisionHistory` model
- [ ] Generate and run initial Prisma migration (requires live Postgres — run `npm run db:migrate -w apps/api`)
- [x] Add seed script for default admin user and default dashboard — `apps/api/prisma/seed.ts`

### Backend Foundation (`apps/api`)
- [x] Initialize Fastify app with TypeScript — `apps/api/src/server.ts`
- [x] Register plugins: `@fastify/cors`, `@fastify/cookie`, `@fastify/multipart`
- [x] Set up structured logging (Pino via Fastify)
- [x] Connect Prisma client — `apps/api/src/lib/prisma.ts`
- [x] Implement request validation using Zod schemas
- [x] Add graceful shutdown handler (SIGTERM/SIGINT)

### Authentication — Backend
- [x] Implement `POST /api/auth/login` (email + password → JWT)
- [x] Implement `POST /api/auth/logout`
- [x] Implement `GET /api/auth/me`
- [x] Hash passwords with `argon2`
- [x] Create auth middleware/guard — `apps/api/src/middleware/auth.ts`
- [x] Implement role-based access control (`admin` vs `viewer`)
- [x] Configure JWT expiration (7 days)

### Frontend Foundation (`apps/web`)
- [x] Initialize Vite + React + TypeScript project
- [x] Configure Tailwind CSS
- [x] Set up React Router with routes: `/`, `/login`, `/admin`, `/admin/settings`
- [x] Set up Zustand store(s) — `apps/web/src/store/`
- [x] Set up TanStack Query client
- [x] Create API client module — `apps/web/src/api/client.ts`
- [x] Implement auth context / protected route wrapper — `apps/web/src/components/ProtectedRoute.tsx`
- [x] Create basic layout shells for presentation and admin views
- [x] SSE state stream hook — `apps/web/src/hooks/use-state-stream.ts`

### Shared Package (`packages/shared`)
- [x] Define shared TypeScript types: `User`, `Dashboard`, `Floorplan`, `Hotspot`, `Asset`, `HotspotStateRule`, `AppSetting`
- [x] Define shared Zod schemas matching DB models
- [x] Export API request/response types
- [x] Rules engine with unit tests (`evaluateRules`)

### Home Assistant — Connectivity Smoke Test
- [x] Create `packages/ha-client` package
- [x] Implement REST client for HA API — `packages/ha-client/src/rest-client.ts`
- [x] Implement WebSocket client with auto-reconnect — `packages/ha-client/src/ws-client.ts`
- [x] Add `GET /api/ha/status` backend route — `apps/api/src/routes/ha.ts`
- [x] Display HA connection status in frontend — `apps/web/src/components/ConnectionStatus.tsx` + Settings page

---

## Phase 2 — Presentation Mode

### Floorplan Display
- [x] `GET /api/floorplans/:id` — return floorplan with hotspots
- [x] `GET /api/dashboards/default` — return default dashboard with floorplan
- [x] Render floorplan image as full-viewport base layer
- [x] Implement normalized coordinate system (x, y as percentages/fractions)
- [x] Ensure hotspot positions scale correctly on resize (use `position: absolute` + percentage-based layout or CSS transforms)
- [x] Support high-DPI/retina images
- [x] Handle missing or failed image loads gracefully

### Hotspot Overlay Rendering
- [x] Build `<HotspotLayer>` component that renders all hotspots over floorplan
- [x] Build `<HotspotRenderer>` that dispatches to type-specific renderer components
- [x] Implement hotspot registry (map of type → { Renderer, EditorForm, schema, defaults })
- [x] Ensure large touch targets (minimum 44×44pt) in presentation mode
- [x] Support z-index ordering for overlapping hotspots
- [x] Add hotspot visibility rules (show/hide based on entity state)

### Action Hotspot (Type: `action`)
- [x] Renderer: icon or label button on floorplan
- [x] Tap → call configured HA service
- [x] Visual press feedback (opacity/scale animation)
- [x] Support `tap_action`, `hold_action`, `double_tap_action` configs
- [x] Show loading/pending state while service call in flight
- [x] Show error toast if service call fails

### Text/Value Hotspot (Type: `text`)
- [x] Renderer: display formatted sensor value with units
- [x] Support configurable text template (e.g. `{{state}} °C`)
- [x] Update value in real time when entity state changes
- [x] Support font size, color, and alignment config

### Live Entity State — WebSocket
- [x] In `packages/ha-client`: implement WebSocket client for HA
- [x] Authenticate to HA WS API on connect
- [x] Subscribe to `state_changed` events for all relevant entity IDs
- [x] Normalize `state_changed` payloads to internal `EntityState` type
- [x] Auto-reconnect with exponential backoff on disconnect
- [x] On reconnect: re-subscribe and re-fetch latest states via REST
- [x] Backend broadcasts normalized state updates to connected frontend clients (WebSocket or SSE)
- [x] Frontend WebSocket/SSE client in Zustand store
- [x] Store entity states in Zustand; hotspot renderers subscribe reactively

### Connection Status
- [x] Show subtle "Disconnected from Home Assistant" indicator when WS is down
- [x] Show subtle "Backend offline" indicator when backend is unreachable
- [x] Clear indicators when connections are restored
- [x] Stale state should not show false information — consider a visual "stale" flag

### Fullscreen / Kiosk Layout
- [x] Fullscreen CSS layout with no scroll
- [x] No browser chrome in presentation mode
- [ ] Orientation-aware layout (portrait vs landscape) using CSS or JS
- [x] Prevent accidental access to edit mode from presentation screen
- [x] Support Safari/iPad rendering correctly (test with `100dvh`, `safe-area-inset`)
- [x] Fast initial load: defer non-critical assets

---

## Phase 3 — Edit / Admin Mode

### Edit Mode Toggle
- [x] "Edit Mode" button visible only to admin users
- [x] Toggle between presentation and edit overlay
- [x] Edit mode adds visual chrome (toolbars, selection handles, config panel)
- [x] Guard: non-admin cannot activate edit mode

### Hotspot Selection & Management
- [x] Click to select a hotspot (highlight with selection ring)
- [x] Show selected hotspot in config panel
- [x] "Add Hotspot" button → type picker → places new hotspot at center
- [x] Duplicate selected hotspot
- [x] Delete selected hotspot (with confirmation)
- [x] Keyboard shortcuts: Delete/Backspace to delete, Escape to deselect

### Drag-and-Drop Positioning
- [x] Drag selected hotspot to reposition (update x, y in normalized coords)
- [ ] Show position tooltip while dragging
- [ ] Optional: snap-to-grid (configurable grid size)
- [ ] Optional: show alignment guides relative to other hotspots

### Resize
- [x] Show resize handles on selected hotspot corners/edges
- [x] Drag handles to resize (update width, height in normalized coords)
- [ ] Maintain aspect ratio option (hold Shift)
- [x] Minimum size constraint

### Z-Index Ordering
- [x] "Bring Forward" / "Send Backward" controls
- [ ] "Bring to Front" / "Send to Back" controls

### Config Panel
- [x] Side panel opens when hotspot is selected
- [x] Tabs or sections: General, Entity, Actions, Style, State Rules
- [x] **General**: name, type (read-only after creation), visibility toggle
- [x] **Entity**: searchable HA entity picker (browse entities from backend)
- [x] **Actions**: tap/hold/double-tap action type and service picker, service data editor
- [x] **Style**: size, font, color, opacity, border, icon selection
- [x] **State Rules**: list of rules with priority order; add/edit/delete rules
- [ ] All forms use React Hook Form + Zod validation
- [ ] Show field-level validation errors inline

### Entity Picker
- [x] `GET /api/ha/entities` — fetch entity list from HA via backend
- [x] Searchable dropdown with domain filter (light, sensor, binary_sensor, etc.)
- [x] Show entity ID, friendly name, and current state
- [ ] Debounced search input

### Service / Action Picker
- [x] `GET /api/ha/services` — fetch available services from HA via backend
- [x] Filter by domain of selected entity
- [x] Show service name and description
- [x] Support specifying service data (JSON or form fields for common services)

### Save & Revert
- [x] "Save" button: `PATCH /api/hotspots/:id` for each dirty hotspot
- [x] "Revert" button: discard unsaved changes and reload from server
- [x] Track unsaved changes in editor state
- [x] Warn before navigating away with unsaved changes
- [x] Show toast on save success/failure
- [ ] Optimistic update with rollback on failure

### Preview Mode (within editor)
- [x] Toggle between edit handles visible and clean preview
- [x] In preview, hotspots respond to real entity states
- [x] Test action calls from config panel without leaving edit mode

---

## Phase 4 — Advanced State Mapping

### State Rules Engine (`packages/shared`)
- [x] Define `ConditionType`: `exact_match`, `numeric_range`, `truthy`, `falsy`, `fallback`
- [x] Define `Condition` schema (type + value/range params)
- [x] Define `RuleResult` schema (style, image, text, animation, visibility overrides)
- [x] Implement `evaluateRules(rules: HotspotStateRule[], state: string | number): RuleResult | null`
- [x] Rules evaluated in priority order; first match wins; `fallback` always matches
- [x] Engine is pure and deterministic (easy to unit test)
- [x] Reuse engine on both frontend (rendering) and backend (preview/test endpoint)

### Condition Types
- [x] `exact_match`: state === value
- [x] `numeric_range`: state >= min && state <= max
- [x] `truthy`: state is truthy (non-empty, non-zero, not "off", not "closed", etc.)
- [x] `falsy`: inverse of truthy
- [x] `fallback`: always matches (used as default)

### Rule Results
- [x] Style overrides: color, background, opacity, border, glow
- [x] Image override: show specific asset
- [x] Text override: display formatted string with `{{state}}` template
- [x] Animation override: apply named animation
- [x] Visibility override: show/hide hotspot

### Rule Editor UI
- [x] List of rules with priority order (drag to reorder)
- [x] "Add Rule" button → condition type picker
- [x] Condition editor fields per type (value input, range inputs, etc.)
- [x] Result editor: toggle which overrides are active and their values
- [x] "Test" button: enter a mock state value and preview which rule fires and its result
- [x] Visual preview of result in mini hotspot preview

### State Preview Tool
- [x] `POST /api/ha/preview-state` — given entity_id and rules, evaluate and return result
- [x] Frontend preview panel in config panel showing live evaluation against current real state

---

## Phase 5 — Additional Hotspot Types

### Hotspot Registry Pattern
- [x] Define `HotspotTypeDefinition<TConfig>` interface: `{ type, label, description, icon, Renderer, defaultConfig, migrate? }`
- [x] Create central registry in `apps/web/src/hotspots/registry.ts`
- [x] Register all built-in types at app bootstrap
- [x] `HotspotRenderer` and editor dynamically load from registry by type
- [x] `TypePickerModal` driven from registry (no duplicate hardcoded list)

### State Image Hotspot (Type: `state_image`)
- [x] Renderer: display one image when entity state = on/open/active, another when off/closed
- [x] Support animated transition between images (CSS crossfade via opacity on two layers)
- [x] Config: entity_id, on-image asset, off-image asset, animation type
- [x] Style editor in ConfigPanel (asset ID inputs, animation type select)

### State Icon Hotspot (Type: `state_icon`)
- [x] Renderer: display icon (inline SVG paths for common MDI icons) with state-driven color/glow/opacity
- [x] Support badge overlay (small indicator dot in top-right corner)
- [x] Config: entity_id, icon name, state-color mapping, badge rules
- [x] Style editor in ConfigPanel (icon name, on/off color pickers, badge toggle)

### Badge/Status Hotspot (Type: `badge`)
- [x] Renderer: small pill/badge showing state label ("Open", "Armed", "Motion", etc.)
- [x] Config: entity_id, state-to-label mapping, color mapping
- [x] Style editor in ConfigPanel (JSON editors for labels and colors)

### Group/Scene Hotspot (Type: `scene`)
- [x] Renderer: button/icon that triggers a HA scene or script
- [x] Config: scene/script entity_id or service call, display label/icon
- [x] Actions tab in ConfigPanel handles service picker for scene type
- [x] Style editor in ConfigPanel (label, icon)

### Custom Hotspot Extension Point (Type: `custom`)
- [x] Placeholder renderer that shows "custom hotspot" in edit mode, silent in presentation
- [x] Document how to add a new type by registering in the registry
- [x] Write `docs/extending-hotspots.md` with step-by-step guide

---

## Phase 6 — Asset Management

### Backend Asset API
- [x] `POST /api/assets/upload` — multipart upload; validate MIME type, store file, save metadata
- [x] Accept: SVG, PNG, WebP, JPEG, GIF
- [x] Reject unsupported types with clear error
- [x] Generate unique filename (UUID-based) to avoid collisions
- [x] Extract image dimensions on upload (using `sharp` or similar)
- [x] Store file in `ASSET_STORAGE_PATH` volume
- [x] `GET /api/assets` — list all assets with metadata
- [x] `GET /api/assets/:id` — get single asset metadata
- [x] `GET /api/assets/:id/file` — serve actual file (with cache headers)
- [x] `DELETE /api/assets/:id` — delete asset and file (check for references first)

### Frontend Asset Manager
- [x] Asset manager modal (accessible from hotspot config panel and standalone page)
- [x] Grid/list view of all uploaded assets with thumbnails
- [x] Upload button with drag-and-drop zone
- [x] Upload progress indicator
- [x] Select asset → returns asset ID to caller
- [x] Delete asset (with confirmation; warn if asset is in use)
- [x] Asset manager page at `/admin/assets`

### Asset Storage Abstraction
- [x] Create `AssetStorage` interface with `save`, `get`, `delete` methods
- [x] Implement `LocalFileStorage` backed by mounted volume
- [x] Structure for future swap to S3-compatible storage (just implement interface)

---

## Phase 7 — Polish & Extended Features

### Multiple Dashboards & Floorplans
- [x] Dashboard list page (`/admin/dashboards`)
- [x] Create/edit/delete dashboards
- [x] Assign floorplans to dashboards
- [x] Set default dashboard
- [x] Presentation mode loads default dashboard on visit
- [ ] Navigation between dashboards in presentation mode

### Revision History
- [x] Log all create/update/delete operations on hotspots and floorplans to `RevisionHistory`
- [x] `GET /api/revisions?entity_type=hotspot&entity_id=:id` — list revisions
- [x] Revision history viewer in admin UI (side panel or modal)
- [ ] Restore to previous revision (optional)

### Animations
- [x] Define animation types: `pulse`, `fade`, `blink`, `none`
- [x] Apply animations via CSS classes or keyframes
- [x] Support configuring animation per state rule result
- [ ] Consider Lottie for complex SVG animations (optional)

### Theming / Dark Mode
- [x] Tailwind dark mode class strategy
- [x] Theme toggle in settings
- [x] Persist theme preference in `AppSetting`
- [x] Presentation mode defaults to dark theme (optimized for wall displays)

### Kiosk PIN Unlock
- [x] PIN overlay on presentation screen to access edit mode
- [x] Configurable PIN in settings
- [x] Auto-lock after inactivity timeout (screensaver)

### Undo/Redo in Editor
- [x] Track editor action history in Zustand
- [x] Ctrl+Z / Cmd+Z to undo last action
- [x] Ctrl+Shift+Z / Cmd+Shift+Z to redo
- [x] Limit history depth (e.g. 50 steps)

### Import/Export Layout Config
- [x] `GET /api/floorplans/:id/export` — export floorplan + hotspots as JSON
- [x] `POST /api/floorplans/import` — import from JSON (with conflict resolution)
- [x] Export/import button in admin UI

### Inactivity / Screensaver
- [x] Detect inactivity after configurable timeout (default 5 min)
- [x] Dim screen or show screensaver overlay
- [x] Tap anywhere to restore
- [ ] Configurable timeout in settings (currently hardcoded to 5 min)

---

## Backend API — Full Checklist

### Auth
- [ ] `POST /api/auth/login`
- [ ] `POST /api/auth/logout`
- [ ] `GET /api/auth/me`

### Dashboards
- [ ] `GET /api/dashboards`
- [ ] `GET /api/dashboards/default`
- [ ] `GET /api/dashboards/:id`
- [ ] `POST /api/dashboards`
- [ ] `PATCH /api/dashboards/:id`
- [ ] `DELETE /api/dashboards/:id`

### Floorplans
- [ ] `GET /api/floorplans` (filter by dashboard_id)
- [ ] `GET /api/floorplans/:id` (includes hotspots)
- [ ] `POST /api/floorplans`
- [ ] `PATCH /api/floorplans/:id`
- [ ] `DELETE /api/floorplans/:id`
- [ ] `GET /api/floorplans/:id/export`
- [ ] `POST /api/floorplans/import`

### Hotspots
- [ ] `GET /api/hotspots?floorplan_id=:id`
- [ ] `GET /api/hotspots/:id`
- [ ] `POST /api/hotspots`
- [ ] `PATCH /api/hotspots/:id`
- [ ] `DELETE /api/hotspots/:id`
- [ ] `POST /api/hotspots/:id/duplicate`
- [ ] `GET /api/hotspots/:id/rules`
- [ ] `PUT /api/hotspots/:id/rules` (replace all rules for hotspot)

### Assets
- [ ] `POST /api/assets/upload`
- [ ] `GET /api/assets`
- [ ] `GET /api/assets/:id`
- [ ] `GET /api/assets/:id/file`
- [ ] `DELETE /api/assets/:id`

### Home Assistant Proxy
- [ ] `GET /api/ha/status`
- [ ] `GET /api/ha/entities`
- [ ] `GET /api/ha/entities/:entity_id`
- [ ] `GET /api/ha/services`
- [ ] `POST /api/ha/services/:domain/:service`
- [ ] `GET /api/ha/states` (bulk current states)

### Live State
- [ ] WebSocket endpoint or SSE stream: `GET /api/state/stream`
- [ ] Push `entity_state_changed` events to subscribed clients
- [ ] Handle client reconnect cleanly

### Settings
- [ ] `GET /api/settings`
- [ ] `PUT /api/settings/:key`

### Revisions
- [ ] `GET /api/revisions?entity_type=&entity_id=`

---

## Frontend Pages & Views — Full Checklist

### Login Page (`/login`)
- [ ] Email + password form
- [ ] Zod validation
- [ ] Show error on bad credentials
- [ ] Redirect to dashboard on success
- [ ] Prevent access if already logged in

### Presentation Dashboard Page (`/`)
- [ ] Load default dashboard + floorplan
- [ ] Render floorplan + hotspot overlay
- [ ] Live entity state updates
- [ ] Fullscreen layout
- [ ] Touch-friendly hotspot interactions
- [ ] Connection status indicator
- [ ] Inactivity dimming (Phase 7)

### Editor / Admin Page (`/admin`)
- [ ] Edit mode toolbar (add hotspot, save, revert, preview toggle)
- [ ] Floorplan canvas with hotspot overlays
- [ ] Hotspot selection and drag handles
- [ ] Config panel sidebar
- [ ] Entity picker integration
- [ ] State rule editor
- [ ] Asset selector integration

### Settings Page (`/admin/settings`)
- [ ] HA connection config (read-only display of connection status)
- [ ] Theme setting
- [ ] Inactivity timeout setting
- [ ] PIN lock setting
- [ ] Default dashboard setting

### Asset Manager (`/admin/assets`)
- [ ] Asset grid with thumbnails
- [ ] Upload UI
- [ ] Delete with confirmation

### Dashboard Manager (`/admin/dashboards`)
- [ ] List dashboards
- [ ] Create / edit / delete
- [ ] Set default
- [ ] Manage floorplans per dashboard

---

## Home Assistant Integration Layer — Full Checklist

### `packages/ha-client`
- [ ] `HaRestClient`: typed REST calls using `HA_BASE_URL` + `HA_TOKEN`
  - [ ] `getStates()` — all entity states
  - [ ] `getState(entity_id)` — single entity state
  - [ ] `getServices()` — all service definitions
  - [ ] `callService(domain, service, data)` — call HA service
- [ ] `HaWebSocketClient`: typed WebSocket connection to HA
  - [ ] Authenticate on connect
  - [ ] `subscribeStateChanged(callback)` — subscribe to state_changed events
  - [ ] `unsubscribe(subscription_id)`
  - [ ] Auto-reconnect with exponential backoff
  - [ ] Emit `connected`, `disconnected`, `state_changed` events
- [ ] `EntityStateNormalizer`: convert raw HA state objects to internal `EntityState` type
- [ ] Never expose `HA_TOKEN` to frontend

### Backend HA Service Layer (`apps/api/src/services/ha.ts`)
- [ ] Singleton that manages HA WS and REST clients
- [ ] On startup: connect WS, subscribe to all state changes
- [ ] Maintain in-memory entity state cache
- [ ] Broadcast state changes to frontend clients
- [ ] Expose `callService`, `getEntities`, `getServices` to API routes

---

## Documentation — Full Checklist

### Files to Create
- [ ] `README.md` (project root)
  - [ ] What the app does
  - [ ] Architecture overview
  - [ ] Prerequisites
  - [ ] Local setup steps
  - [ ] Docker Compose usage
  - [ ] Environment variables
  - [ ] Home Assistant configuration required
  - [ ] Testing instructions
  - [ ] Production deployment notes
- [ ] `docs/architecture.md` — system architecture, component diagram, data flow
- [ ] `docs/development.md` — local dev setup, scripts, adding new features
- [ ] `docs/deployment.md` — Docker Compose production deployment, env vars
- [ ] `docs/homeassistant-integration.md` — how HA integration works, WS protocol, security model
- [ ] `docs/extending-hotspots.md` — step-by-step guide to adding a new hotspot type

### Code Documentation
- [ ] JSDoc comments on public functions in `packages/shared`
- [ ] Schema documentation on Prisma models
- [ ] Inline comments for non-obvious state rule engine logic
- [ ] README in each package (`apps/web`, `apps/api`, `packages/*`)

---

## Non-Functional — Checklist

### Performance
- [ ] Avoid re-rendering all hotspots on every state change (memoize per entity)
- [ ] Lazy-load editor code (code split from presentation mode)
- [ ] Cache floorplan image and static assets with proper headers
- [ ] Debounce drag events to avoid excessive state updates
- [ ] Avoid over-fetching HA entities on every render

### Security
- [ ] HA long-lived access token never sent to frontend
- [ ] All secrets via environment variables only
- [ ] Input validation on all API routes (Zod)
- [ ] File upload validation: MIME type + size limit
- [ ] Admin routes require valid auth + admin role
- [ ] XSS prevention: no `dangerouslySetInnerHTML` with user data
- [ ] CSRF protection for state-mutating routes

### Reliability
- [ ] HA WebSocket auto-reconnect (exponential backoff, max attempts)
- [ ] Frontend reconnects to backend event stream on drop
- [ ] No DB writes without proper error handling and rollback
- [ ] Safe migrations: additive only, avoid destructive schema changes without care

### Accessibility
- [ ] Sufficient color contrast in presentation mode
- [ ] Large touch targets (min 44pt) in presentation mode
- [ ] Keyboard navigation in admin/edit mode
- [ ] Semantic HTML for form controls and buttons

---

## Nice-to-Have (Low Priority / Backlog)

- [ ] Multiple floorplan floors with navigation
- [ ] Theming system (light/dark/custom)
- [ ] Presence-aware dashboard behavior (show/hide hotspots based on who is home)
- [ ] Room/zone grouping for hotspots
- [ ] Animated device effects (e.g. fan spinning, TV glow)
- [ ] WebSocket broadcast optimization (only push changed entities to subscribers)
- [ ] Audit trail UI (view revision history in admin)
- [ ] Guided Access compatibility notes for iPad kiosk setup
- [ ] Floorplan zoom/pan in admin mode
- [ ] Auto-hide edit controls in presentation mode
- [ ] Ambient/screensaver mode with clock or weather widget
