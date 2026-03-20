# PROJECT.md

## Project Title
HomePlan HA Dashboard

## Purpose
Build a browser-based home dashboard designed for wall-mounted iPads and other touchscreen devices. The application should display a floorplan image of the house and allow interactive hotspots to control and monitor Home Assistant entities.

The system must support both:
1. Presentation mode: a clean fullscreen dashboard for daily use
2. Edit mode: an admin/editor interface for creating, positioning, configuring, and testing hotspots and visual overlays

This project must be designed for long-term extensibility so new hotspot types, visual states, animations, devices, overlays, and dashboards can be added over time without major rewrites.

---

## Core Goals

### Main user experience
- Display a full-screen floorplan image as the main UI
- Overlay hotspots, icons, labels, state indicators, and informational widgets
- Support touch-friendly interaction for wall-mounted iPads
- Show dynamic Home Assistant device state in near real time
- Allow triggering actions such as turning lights on/off
- Allow displaying sensor data such as temperature, humidity, power usage, etc.
- Allow different images or animations to be shown depending on entity state
- Allow future support for multiple floorplans, zones, pages, and device groups

### Admin/edit experience
- Provide an edit mode protected by authentication
- Allow creating and editing hotspots visually on top of the floorplan
- Support dragging, resizing, rotation if needed, z-index ordering, and visibility rules
- Allow binding hotspots to Home Assistant entities and services
- Allow configuring behavior such as:
  - tap action
  - long press action
  - double tap action
  - conditional visibility
  - conditional images
  - text/value display
  - color/state styling
  - animation
- Allow previewing hotspot behavior before publishing
- Allow saving layout changes safely
- Allow versioning or history where practical

---

## Technology Stack

### Required
- Frontend: React
- Build tool: Vite
- Language: TypeScript
- Backend: Node.js with TypeScript
- Database: PostgreSQL
- Container orchestration: Docker Compose

### Recommended additional technologies
- API framework: Fastify or Express
  - Prefer Fastify for performance, schema validation, and clean plugin architecture
- ORM: Prisma
- Realtime state sync:
  - Home Assistant WebSocket API for live entity updates
  - REST API for service calls and initial state hydration where appropriate
- Frontend state management:
  - Zustand or Redux Toolkit
  - Prefer Zustand unless there is a strong reason otherwise
- Data fetching and caching:
  - TanStack Query
- Forms:
  - React Hook Form + Zod validation
- UI:
  - Tailwind CSS
  - headless component approach for flexibility
- Drag/drop and visual editing:
  - React Flow, dnd-kit, or a custom canvas-style editor
  - Prefer dnd-kit or a lightweight custom editor unless graph semantics are needed
- Testing:
  - Frontend unit/component tests: Vitest + React Testing Library
  - Backend tests: Vitest
  - End-to-end tests: Playwright
- Authentication/session:
  - Secure admin login via backend session or JWT
  - Presentation mode can optionally support anonymous read-only access on trusted local networks
- Logging:
  - Structured logging on backend
- Validation:
  - Zod on both client and server where appropriate

---

## High-Level Architecture

### Frontend apps/views
The frontend should support two primary application modes:

#### 1. Presentation Mode
Used on wall-mounted iPads and other browsers
- Fullscreen, kiosk-friendly dashboard
- Large touch targets
- Smooth transitions
- Minimal chrome
- Optional idle dimming or screensaver mode
- Rapid loading and resilience if Home Assistant temporarily disconnects

#### 2. Edit/Admin Mode
Used by the homeowner on desktop or tablet
- Manage floorplans
- Create/edit/delete hotspots
- Configure hotspot logic and visuals
- Preview state mappings
- Test Home Assistant service actions
- Manage dashboards, rooms, images, themes, overlays, and settings

### Backend responsibilities
- Authentication and authorization
- CRUD APIs for floorplans, hotspots, dashboards, widgets, and state mappings
- Home Assistant integration layer
- Realtime entity updates via WebSocket subscription
- Service-call proxy to Home Assistant
- Asset metadata management
- Validation and persistence
- Audit/change tracking where practical

### Database responsibilities
- Store floorplans, hotspots, dashboard definitions, visual state rules, action rules, user accounts, app settings, themes, and revision metadata
- Do not store Home Assistant as source-of-truth for states permanently unless needed for caching or history
- Home Assistant remains authoritative for live entity state

---

## Home Assistant Integration Requirements

### Integration method
The Home Assistant server already exists on a separate server. This application must integrate with that existing instance.

Use:
- Home Assistant REST API for initial data loads and service calls
- Home Assistant WebSocket API for realtime entity state updates and subscriptions

### Backend integration layer
Create a dedicated integration module or service layer for Home Assistant. Do not scatter HA API calls throughout the codebase.

This layer should:
- Manage Home Assistant authentication token securely
- Reconnect automatically if WebSocket disconnects
- Subscribe to relevant entity state updates
- Expose normalized entity data to the rest of the app
- Proxy service calls such as:
  - light.turn_on
  - light.turn_off
  - switch.turn_on
  - switch.turn_off
  - script.turn_on
  - scene.turn_on
  - cover.open_cover
  - cover.close_cover
  - climate.set_temperature
- Support future extension for additional service domains

### Live state behavior
- The dashboard should update automatically when Home Assistant state changes
- Entity state updates should be reflected without page reload
- If connection is lost, the UI should clearly but subtly indicate stale/disconnected state
- On reconnect, the system should rehydrate latest known states cleanly

### Security
- Never expose the Home Assistant long-lived access token directly to the frontend
- The frontend should only communicate with the backend
- The backend proxies Home Assistant interactions

---

## Main Functional Requirements

## 1. Dashboard / Floorplan Display
- Display one selected floorplan image as the base layer
- Support high-resolution images suitable for iPad wall displays
- Support responsive scaling while preserving hotspot positioning
- Use coordinate systems that remain stable across screen sizes
- Support multiple dashboards/floorplans in future
- Support optional background layers and overlay layers

### Coordinate system
Use a normalized positioning model so hotspot positions scale correctly regardless of viewport size:
- x and y stored as percentages or normalized values
- width and height optionally stored as percentages or normalized values
- avoid pixel-only persistence

---

## 2. Hotspots
A hotspot is any interactive or informational element placed on the floorplan.

### Hotspot types
Support a pluggable hotspot/widget model. Initial types should include:

#### Action hotspot
- Tapping triggers a Home Assistant service call
- Example: toggle a light

#### State image hotspot
- Shows one image when off and another when on
- Can optionally animate between states

#### State icon hotspot
- Shows an icon based on entity state
- Can change color, opacity, glow, badge, etc.

#### Text/value hotspot
- Displays sensor data such as temperature or humidity
- Supports formatting and units

#### Badge/status hotspot
- Shows simple state labels like Open, Closed, Armed, Motion, etc.

#### Group/scene hotspot
- Triggers scenes or grouped actions

#### Custom hotspot
- Reserved for future extension
- Must be easy to add without rewriting existing code

### Hotspot properties
Every hotspot should support a flexible schema including:
- id
- name
- type
- floorplan_id
- position
- size
- rotation
- z_index
- visibility
- entity_id
- optional secondary entity ids
- style configuration
- actions
- state mappings
- image mappings
- text template
- animation config
- metadata
- created_at
- updated_at

---

## 3. Edit Mode
The edit mode should feel like a lightweight visual editor.

### Required editor features
- Toggle edit mode on/off
- Add new hotspot by selecting type
- Position hotspot visually via drag and drop
- Resize hotspot
- Open a config panel for hotspot settings
- Duplicate hotspot
- Delete hotspot
- Adjust z-order
- Snap to grid optional
- Show alignment guides optional
- Preview live state while editing
- Save/publish changes
- Cancel/revert unsaved changes

### Hotspot config panel
The config UI for a hotspot should allow:
- selecting Home Assistant entity
- selecting service/action
- editing display text/template
- uploading/selecting images
- defining conditional state rules
- selecting animation
- adjusting dimensions and placement
- changing styling
- setting touch behavior
- testing action calls safely

---

## 4. State Mapping System
This is a critical part of extensibility.

A hotspot should support mapping Home Assistant states to presentation logic.

Examples:
- if light.kitchen = on, show lit bulb image
- if binary_sensor.front_door = on, show open door icon
- if sensor.lounge_temp = 24.5, display 24.5°C
- if alarm_control_panel.home = armed_away, show red shield badge

### State mapping should support
- exact matches
- numeric ranges
- truthy/falsey conditions
- fallback/default state
- multiple conditions in priority order
- style changes
- image changes
- text changes
- animation changes
- visibility changes

Design this as a generic rules engine rather than hardcoding per-widget behavior.

---

## 5. Media / Asset Support
The app will grow over time and should support more images and animations.

### Asset requirements
- Support floorplan images
- Support hotspot state images
- Support SVG, PNG, WebP, and other reasonable web-friendly formats
- Support simple animations now or later
- Store asset metadata in the database
- Store actual files in a mounted volume or object-style storage abstraction

### Docker/local deployment approach
For now:
- store uploaded assets in a persistent mounted volume
- backend serves asset files securely
- structure code so this can later move to S3-compatible storage if desired

---

## 6. Fullscreen / Kiosk Support
This app is intended for wall-mounted iPads.

### Requirements
- clean fullscreen layout
- responsive touch-first interface
- large controls when needed
- no unnecessary scrollbars
- minimal admin chrome in presentation mode
- support Safari/iPad browsers well
- optional dark mode or theme mode
- orientation-aware layout behavior
- graceful handling of browser refresh/reconnect
- prevent accidental admin access from presentation screen

### Nice-to-have later
- kiosk PIN unlock for edit mode
- auto-hide edit controls
- inactivity return to home dashboard
- screensaver/ambient mode
- guided access compatibility notes

---

## 7. Authentication and Roles
Initial role model can be simple but should be extensible.

### Roles
- admin: full access to editor and settings
- viewer: can use dashboard presentation mode
- optional anonymous/local mode for dashboard-only screens if configured

### Requirements
- secure login for admin mode
- backend-enforced authorization
- all edit APIs require admin role
- session expiration handling
- CSRF/session protection where applicable
- hashed passwords if local auth is used

---

## 8. Extensibility Design Principles
This project must be designed as a platform, not a one-off page.

### Key extensibility requirements
- new hotspot types should be easy to add
- Home Assistant integration should be modular
- visual rules should be configuration-driven
- frontend components should be reusable
- APIs should be versionable
- avoid giant monolithic components
- keep business logic separate from rendering logic
- database schema should anticipate future dashboards, rooms, themes, and users

### Suggested pattern
Implement a widget/hotspot registry pattern:
- hotspot type declares:
  - editor form component
  - renderer component
  - validation schema
  - default config
  - optional migration rules

This will make adding future types much easier.

---

## Non-Functional Requirements

### Performance
- fast initial page load on local network
- smooth state updates
- efficient rerendering
- minimal layout thrashing
- avoid over-fetching
- cache stable resources appropriately
- support at least dozens to hundreds of hotspots without poor UX

### Reliability
- survive temporary Home Assistant disconnects
- survive backend restart cleanly
- no data corruption when editing
- clear error reporting
- safe migrations

### Maintainability
- strongly typed code throughout
- clear module boundaries
- high-quality documentation
- no unexplained magic values
- consistent naming conventions
- code comments for non-obvious logic only

### Accessibility
- reasonable keyboard support in admin mode
- sufficient contrast
- large touch areas in presentation mode
- semantic HTML where practical

### Security
- no HA token leakage to frontend
- secure secret handling via environment variables
- input validation on all APIs
- file upload validation
- protection against common web vulnerabilities

---

## Suggested Monorepo Structure

Use a clear workspace layout.

\`\`\`
/project-root
  /apps
    /web          # React/Vite frontend
    /api          # Node/Fastify backend
  /packages
    /shared       # shared types, schemas, utilities
    /ui           # shared UI components if useful
    /ha-client    # Home Assistant integration abstractions
  /docker
  /docs
  /scripts
  docker-compose.yml
  .env.example
  README.md
\`\`\`

If Claude prefers a simpler structure, that is acceptable, but it must still preserve strong separation between frontend, backend, and shared code.

---

## Recommended Database Model

This is a suggested starting point. Claude may refine it if needed.

### users
- id
- email
- password_hash
- role
- created_at
- updated_at

### dashboards
- id
- name
- slug
- description
- is_default
- created_at
- updated_at

### floorplans
- id
- dashboard_id
- name
- image_asset_id
- width
- height
- background_color
- created_at
- updated_at

### hotspots
- id
- floorplan_id
- name
- type
- x
- y
- width
- height
- rotation
- z_index
- entity_id
- config_json
- created_at
- updated_at

### assets
- id
- filename
- original_name
- mime_type
- size_bytes
- storage_path
- width
- height
- created_at
- updated_at

### hotspot_state_rules
- id
- hotspot_id
- priority
- condition_type
- condition_json
- result_json
- created_at
- updated_at

### app_settings
- id
- key
- value_json
- updated_at

### revision_history
- id
- entity_type
- entity_id
- action
- before_json
- after_json
- user_id
- created_at

A simplified schema is acceptable initially, but the code should not prevent later normalization.

---

## API Requirements

The backend should expose clear REST endpoints and possibly WebSocket/SSE for frontend state updates.

### Minimum API areas
- auth
- dashboards
- floorplans
- hotspots
- assets
- Home Assistant entity browse/search
- Home Assistant service execution
- live state stream
- settings

### Example backend responsibilities
- GET dashboards
- GET floorplan with hotspots
- POST hotspot
- PATCH hotspot
- DELETE hotspot
- POST upload asset
- GET available Home Assistant entities
- POST execute Home Assistant service
- GET or stream live entity states

Do not overcomplicate the initial API, but keep naming clean and versionable.

---

## Frontend Requirements

### UI pages/views
At minimum:
- Login page
- Dashboard presentation page
- Admin/editor page
- Settings page
- Asset manager page or modal
- Dashboard/floorplan manager page

### Presentation page requirements
- floorplan occupies primary viewport
- overlay rendering system
- touch interactions
- live state updates
- fullscreen-friendly layout
- robust reconnect behavior

### Editor page requirements
- canvas-like editing experience
- side config panel
- entity picker
- service/action picker
- asset selector
- state mapping editor
- preview mode

---

## Styling / Visual Design
- modern, minimal, highly legible design
- optimized for dark environments and wall displays
- avoid clutter
- prefer subtle animations
- prioritize function over decoration
- admin mode can be more conventional, presentation mode should be immersive and clean

---

## Error Handling Requirements
- show clear toast/dialog for save errors
- show connection status for backend and Home Assistant
- handle stale state gracefully
- validate editor forms before save
- show field-level validation errors
- log backend errors clearly

---

## Documentation Requirements
Claude should generate well-documented code and include documentation files.

### Required docs
- README.md
- .env.example
- docs/architecture.md
- docs/development.md
- docs/deployment.md
- docs/homeassistant-integration.md
- docs/extending-hotspots.md

### README must include
- what the app does
- architecture overview
- prerequisites
- local setup
- Docker Compose usage
- environment variables
- Home Assistant configuration required
- testing instructions
- production deployment notes

### Code documentation expectations
- clear module naming
- comments for tricky logic
- no excessive comments on obvious code
- schema documentation
- integration layer documentation
- editor architecture documentation

---

## Testing Requirements
The generated code must include tests.

### Backend tests
- API route tests
- schema validation tests
- Home Assistant integration adapter tests with mocked responses
- authorization tests

### Frontend tests
- hotspot rendering tests
- edit mode interaction tests
- state mapping tests
- form validation tests

### End-to-end tests
- login flow
- load dashboard
- create hotspot
- edit hotspot
- trigger Home Assistant action via mocked backend
- display state-driven image/text changes

### Testing philosophy
- tests should focus on critical behavior, not shallow snapshot spam
- mock Home Assistant at integration boundaries
- keep tests deterministic

---

## Docker / Deployment Requirements

### Docker Compose
Provide a Docker Compose setup for:
- frontend
- backend
- postgres

Optionally:
- reverse proxy if useful
- migration runner service if helpful

### Requirements
- one-command local startup
- persistent Postgres volume
- persistent asset storage volume
- configurable environment variables
- clear production notes

### Environment variables
At minimum support:
- DATABASE_URL
- POSTGRES_USER
- POSTGRES_PASSWORD
- POSTGRES_DB
- APP_PORT
- API_PORT
- HA_BASE_URL
- HA_TOKEN
- SESSION_SECRET
- ASSET_STORAGE_PATH
- NODE_ENV

Provide a complete .env.example with comments.

---

## Implementation Guidance for Claude

### General expectations
- generate production-quality code, not a prototype hack
- use TypeScript strictly
- avoid any
- create shared types and validation schemas
- use clean architecture principles where reasonable
- keep code modular and testable
- prefer composition over inheritance
- keep dependencies justified and minimal

### Home Assistant integration guidance
- centralize HA logic in backend service
- use typed wrappers around HA endpoints and events
- support reconnect and resubscribe logic
- normalize incoming entity state payloads
- do not expose raw secrets to frontend

### Editor guidance
- design the editor so adding new hotspot types is easy
- use a registry/config-based system
- separate hotspot renderer from hotspot editor form
- separate persisted model from transient UI state

### State rules guidance
- implement a reusable state evaluation engine
- document rule structure clearly
- keep conditions and results serializable in DB

### Migrations
- use Prisma migrations or equivalent
- generate seed data only if helpful
- ensure app starts cleanly on fresh database

---

## Suggested Development Phases

### Phase 1
Foundation
- monorepo structure
- Docker Compose
- backend auth
- Postgres schema
- basic frontend shell
- Home Assistant connectivity test
- single floorplan support

### Phase 2
Presentation mode
- render floorplan
- live entity state sync
- basic action hotspot
- basic text/value hotspot
- fullscreen dashboard

### Phase 3
Editor mode
- add/edit/delete hotspots
- drag and resize
- entity binding
- service binding
- save and load layouts

### Phase 4
Advanced state mapping
- conditional images
- dynamic styling
- rule engine
- preview/test tools

### Phase 5
Polish and extensibility
- asset management
- revision history
- better animations
- multiple dashboards/floorplans
- improved docs and tests

Claude does not need to stop after scaffolding. It should build as much of the working app as possible.

---

## Acceptance Criteria

The project is acceptable when:
- it runs locally with Docker Compose
- it connects to an external Home Assistant server
- it displays a floorplan in browser
- hotspots can be added and edited in admin mode
- hotspots can call Home Assistant services
- hotspots can display live Home Assistant state
- dashboard works well on iPad-sized browsers
- code is documented and tested
- architecture supports future hotspot/widget expansion

---

## Nice-to-Have Features
These are optional unless easy to include cleanly.
- multiple dashboards/floors
- theming
- presence-aware dashboard behavior
- room grouping
- animated device effects
- day/night variants
- role-based permissions beyond admin/viewer
- import/export layout config
- undo/redo in editor
- floorplan zoom/pan in admin mode
- kiosk PIN unlock
- WebSocket broadcast optimization
- audit trail UI

---

## Things to Avoid
- tightly coupling UI directly to raw Home Assistant API objects
- storing secrets in frontend code
- hardcoding behavior per entity in many places
- giant React components
- weak typing
- editor logic mixed with rendering logic
- one-off hotspot implementations that are hard to extend
- overengineering with unnecessary microservices

---

## Deliverables Claude Should Produce
- full project source code
- Docker Compose configuration
- database schema and migrations
- backend API
- frontend app
- tests
- documentation
- .env.example
- clean setup instructions

---

## Final Instruction to Claude
Build this as a serious, extensible, maintainable application intended for real daily use in a home environment. Optimize for clarity, modularity, reliable Home Assistant integration, and an excellent touch-first fullscreen dashboard experience. Prefer robust architecture over shortcuts, but avoid unnecessary complexity. Produce code that is well-structured, documented, and tested.