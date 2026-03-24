# Development Guide

Local development setup, scripts, project conventions, and how to add new features.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | LTS recommended |
| npm | 10+ | Comes with Node 20 |
| PostgreSQL | 16 | Or use the Docker Compose `db` service |
| Docker | Any recent | For the database and full-stack runs |

---

## Initial Setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/floorplan-ha.git
cd floorplan-ha

# 2. Install all workspace dependencies
npm install

# 3. Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set HA_BASE_URL, HA_TOKEN, SESSION_SECRET

# 4. Start the database
docker compose up db -d

# 5. Run migrations and seed the default admin user
npm run db:migrate -w apps/api

# 6. Start both dev servers
npm run dev
```

The API runs on `http://localhost:3001` and the frontend on `http://localhost:5173`.

Default login: `admin@localhost` / `changeme123` (set by `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`).

---

## Scripts

All scripts run from the repo root unless noted.

### Root-level

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start API (tsx watch) and web (vite) concurrently |
| `npm run build` | Build all packages and apps in dependency order |
| `npm run test` | Run all test suites (vitest) |
| `npm run typecheck` | Full incremental TypeScript check across all workspaces |
| `npm run lint` | ESLint on all `.ts` / `.tsx` files |
| `npm run format` | Prettier on all `.ts` / `.tsx` / `.json` / `.md` files |

### API workspace (`-w apps/api`)

| Command | What it does |
|---------|-------------|
| `npm run dev -w apps/api` | Start API with tsx watch |
| `npm run build -w apps/api` | Compile TypeScript to `dist/` |
| `npm run test -w apps/api` | Run API tests |
| `npm run db:migrate -w apps/api` | Create and apply a new Prisma migration |
| `npm run db:migrate:deploy -w apps/api` | Apply pending migrations (production) |
| `npm run db:seed -w apps/api` | Run `prisma/seed.ts` to create default records |
| `npm run db:generate -w apps/api` | Regenerate Prisma client after schema changes |
| `npm run db:studio -w apps/api` | Open Prisma Studio at `http://localhost:5555` |

### Web workspace (`-w apps/web`)

| Command | What it does |
|---------|-------------|
| `npm run dev -w apps/web` | Start Vite dev server |
| `npm run build -w apps/web` | Type-check and bundle |
| `npm run preview -w apps/web` | Preview production build locally |
| `npm run test -w apps/web` | Run frontend tests |

---

## Project Structure

```
apps/api/src/
├── server.ts          # Fastify bootstrap, plugin registration, startup
├── lib/
│   ├── env.ts         # Zod-validated environment variables (fail-fast on startup)
│   ├── jwt.ts         # JWT sign/verify helpers
│   └── prisma.ts      # Prisma client singleton
├── middleware/
│   └── auth.ts        # requireAuth, requireAdmin Fastify hooks
├── services/
│   ├── ha.ts          # Home Assistant singleton (WS + REST + state cache)
│   ├── asset-storage.ts  # Local file storage for uploads
│   ├── backup.ts      # Scheduled backup creation and restore
│   └── revisions.ts   # Audit trail logging helper
└── routes/            # One file per resource group

apps/web/src/
├── App.tsx            # Router, auth hydration, theme init
├── pages/             # Top-level route components
├── hotspots/
│   ├── registry.ts    # Central hotspot type registry
│   ├── renderers/     # One file per hotspot type
│   ├── HotspotRenderer.tsx   # Dispatches to type-specific renderer
│   ├── HotspotLayer.tsx      # Presentation-mode layer
│   └── EditorHotspotLayer.tsx # Editor-mode layer with drag/resize handles
├── components/
│   └── editor/        # ConfigPanel, EntityPicker, StateRulesForm, …
├── store/             # Zustand stores
├── hooks/             # useStateStream, useInactivity, useSolarImage
└── api/client.ts      # HTTP client
```

---

## Adding a New API Route

1. Create `apps/api/src/routes/my-resource.ts` following the pattern of an existing route file.
2. Define Zod schemas for request body/query params.
3. Use `requireAuth` / `requireAdmin` hooks where appropriate.
4. Register in `apps/api/src/server.ts`:

```ts
import myResourceRoutes from "./routes/my-resource.js";
// ...
fastify.register(myResourceRoutes, { prefix: "/api/my-resource" });
```

---

## Adding a New Hotspot Type

See [extending-hotspots.md](extending-hotspots.md) for a full step-by-step walkthrough. In brief:

1. Add a config interface and type name to `packages/shared/src/types.ts`
2. Add a Zod schema to `packages/shared/src/schemas.ts`
3. Create a renderer component in `apps/web/src/hotspots/renderers/`
4. Register the type in `apps/web/src/hotspots/registry.ts`
5. Optionally add editor UI in `apps/web/src/components/editor/ConfigPanel.tsx`

---

## Database Changes

1. Edit `apps/api/prisma/schema.prisma`
2. Generate the migration:
   ```bash
   npm run db:migrate -w apps/api
   # Enter a migration name when prompted
   ```
3. Regenerate the Prisma client if needed:
   ```bash
   npm run db:generate -w apps/api
   ```
4. Update shared types in `packages/shared/src/types.ts` and rebuild:
   ```bash
   npm run build -w packages/shared
   ```

Keep migrations **additive** where possible — avoid renaming or dropping columns without a plan for existing data.

---

## Environment Variables

See `.env.example` for the full list with inline documentation. The API validates all required variables at startup via `apps/api/src/lib/env.ts` and exits with a clear error list if any are missing or invalid.

---

## Testing

Tests use **Vitest** in each workspace.

```bash
npm run test              # All workspaces
npm run test -w apps/api  # API only
npm run test -w apps/web  # Frontend only
npm run test -w packages/shared  # Shared package (rules engine unit tests)
```

The rules engine in `packages/shared` has unit tests covering all condition types — run these after any logic changes.

---

## Type Checking

```bash
npm run typecheck   # Incremental check across all workspaces
```

TypeScript is configured in strict mode. All workspace `tsconfig.json` files extend `tsconfig.base.json` at the repo root.

---

## Code Style

- **ESLint** enforces rules defined in the root `eslint.config.js`
- **Prettier** handles formatting (see `.prettierrc`)
- Run `npm run lint && npm run format` before submitting a PR
- No `any` types — use `unknown` with narrowing or proper generics

---

## Docker Compose (Full Stack Locally)

To run the full production-like stack locally (all four services):

```bash
docker compose up --build
```

This builds the API and web images from source and starts postgres, migrate, api, and web containers. Useful for testing Docker-specific behaviour before deployment.
