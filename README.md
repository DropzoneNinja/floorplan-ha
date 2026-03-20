# floorplan-ha

A browser-based home automation dashboard for wall-mounted iPads and touch-screen displays. Overlay interactive hotspots on a floorplan image to view and control [Home Assistant](https://www.home-assistant.io/) entities in real time.

![License](https://img.shields.io/badge/license-MIT-blue)
![Version](https://img.shields.io/badge/version-0.5.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![React](https://img.shields.io/badge/React-18-61DAFB)

---

## Features

- **Presentation mode** — fullscreen kiosk display with live entity state updates via WebSocket
- **Visual editor** — drag, resize, and configure hotspots directly on the floorplan
- **7 built-in hotspot types** — action buttons, text labels, state images, state icons, badges, scene triggers, and custom placeholders
- **Rules engine** — map entity states to colors, labels, and images with conditional logic
- **Day/night image cycling** — swap floorplan images automatically based on solar position
- **Screensaver** — inactivity detection with configurable timeout
- **Revision history** — undo/redo and full audit trail for all changes
- **Asset manager** — upload and manage floorplan images and hotspot icons
- **Role-based access** — admin and viewer roles with JWT authentication
- **Extensible** — register new hotspot types without touching core code

---

## Architecture

```
floorplan-ha/
├── apps/
│   ├── api/          # Fastify REST API + WebSocket proxy
│   └── web/          # React + Vite frontend
├── packages/
│   ├── ha-client/    # Home Assistant REST & WebSocket clients
│   └── shared/       # Shared TypeScript types, Zod schemas, rules engine
├── docker/           # Dockerfiles + Nginx config
└── docker-compose.yml
```

**Stack:**

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Zustand, TanStack Query |
| Backend | Node.js, Fastify 5, Prisma 6, Argon2, Jose (JWT) |
| Database | PostgreSQL 16 |
| HA integration | WebSocket (real-time) + REST API |
| Deployment | Docker Compose, Nginx |

---

## Quick Start (Docker Compose)

**Prerequisites:** Docker and Docker Compose installed, a running Home Assistant instance with a long-lived access token.

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/floorplan-ha.git
cd floorplan-ha

# 2. Configure environment
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
HA_BASE_URL=http://homeassistant.local:8123
HA_TOKEN=your_long_lived_access_token
SESSION_SECRET=generate_with_openssl_rand_base64_32
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_admin_password
```

```bash
# 3. Start everything
docker compose up

# Dashboard: http://localhost:5173
# API:       http://localhost:3001
```

---

## Local Development

**Prerequisites:** Node.js 20+, PostgreSQL 16 (or use the Docker Compose db service)

```bash
# Install dependencies
npm install

# Start just the database
docker compose up db -d

# Run database migrations and seed the admin user
npm run db:migrate -w apps/api

# Start both dev servers (API on :3001, web on :5173)
npm run dev
```

Other useful commands:

```bash
npm run build       # Build all packages and apps
npm run test        # Run all test suites
npm run typecheck   # Full TypeScript type check
npm run lint        # ESLint across the monorepo
npm run format      # Prettier formatting
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HA_BASE_URL` | Yes | — | Home Assistant URL (no trailing slash) |
| `HA_TOKEN` | Yes | — | Long-lived access token (never exposed to frontend) |
| `SESSION_SECRET` | Yes | — | JWT signing secret (≥32 chars) |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `ADMIN_EMAIL` | Seed only | `admin@localhost` | Initial admin account email |
| `ADMIN_PASSWORD` | Seed only | `changeme123` | Initial admin account password |
| `API_PORT` | No | `3001` | Backend port |
| `APP_PORT` | No | `5173` | Frontend port |
| `ASSET_STORAGE_PATH` | No | `/uploads` | Where uploaded images are stored |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed frontend origin |

---

## Hotspot Types

| Type | Description |
|------|-------------|
| `action` | Tap/hold/double-tap to call any Home Assistant service |
| `text` | Display a live entity attribute (temperature, power, etc.) |
| `state_image` | Show different images based on on/off state |
| `state_icon` | MDI icon with state-driven color |
| `badge` | Pill label with state-to-text mapping |
| `scene` | Single-tap scene or script trigger |
| `custom` | Placeholder for your own renderer |

See [docs/extending-hotspots.md](docs/extending-hotspots.md) for a step-by-step guide to adding new hotspot types without modifying core files.

---

## Home Assistant Setup

1. In HA, go to **Profile → Long-Lived Access Tokens** and create a new token.
2. Paste the token into `HA_TOKEN` in your `.env` file.
3. Set `HA_BASE_URL` to the URL of your HA instance (accessible from the machine running the API container).
4. The backend proxies all HA communication — the token is never sent to the browser.

---

## Adding a Floorplan

1. Log in as admin and go to **Assets** to upload your floorplan image (PNG or JPG).
2. Go to **Dashboards → New Dashboard** and select your uploaded image.
3. Open the dashboard and click **Edit** to enter the visual editor.
4. Click **Add Hotspot**, choose a type, then drag it to position it on the floorplan.
5. Use the config panel to bind it to a Home Assistant entity or service.
6. Click **Save** when done.

---

## Security Notes

- The HA long-lived token is stored server-side only and proxied through the API — it is never sent to the browser.
- Passwords are hashed with Argon2id.
- All API routes (except login) require a valid JWT.
- An email allowlist restricts who can register.
- Change the default `ADMIN_PASSWORD` immediately after first login.

---

## Contributing

Pull requests are welcome. For significant changes, please open an issue first.

```bash
# Run tests before submitting
npm run test
npm run typecheck
npm run lint
```

---

## License

[MIT](LICENSE)
