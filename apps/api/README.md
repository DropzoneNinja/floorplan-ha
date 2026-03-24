# @floorplan-ha/api

Fastify 5 REST API backend for floorplan-ha.

## Stack

- **Fastify 5** — HTTP server framework
- **Prisma 6** — ORM and database migrations
- **PostgreSQL 16** — primary database
- **Argon2id** — password hashing
- **Jose** — JWT signing and verification
- **Zod** — request validation
- **Vitest** — unit tests

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with `tsx watch` (hot reload) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled output (`node dist/server.js`) |
| `npm run test` | Run tests with Vitest |
| `npm run db:migrate` | Create and apply a new Prisma migration |
| `npm run db:migrate:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio at `:5555` |

## Key directories

| Path | Purpose |
|------|---------|
| `src/server.ts` | App bootstrap, plugin registration, startup sequence |
| `src/routes/` | One file per resource group |
| `src/services/ha.ts` | Home Assistant singleton (WS + REST + state cache) |
| `src/services/asset-storage.ts` | Local file storage for uploads |
| `src/services/backup.ts` | Scheduled backup creation and restore |
| `src/services/revisions.ts` | Audit trail logging helper |
| `src/middleware/auth.ts` | `requireAuth` and `requireAdmin` Fastify hooks |
| `src/lib/env.ts` | Zod-validated environment variables (fail-fast on startup) |
| `src/lib/prisma.ts` | Prisma client singleton |
| `prisma/schema.prisma` | Database schema |
| `prisma/seed.ts` | Default admin user and dashboard seeding |

## API Routes

| Prefix | Description |
|--------|-------------|
| `/api/auth` | Login, logout, password change |
| `/api/users` | User management (admin) |
| `/api/allowed-emails` | Registration allowlist (admin) |
| `/api/dashboards` | Dashboard CRUD |
| `/api/floorplans` | Floorplan CRUD + export/import |
| `/api/hotspots` | Hotspot CRUD, duplicate, state rules |
| `/api/assets` | Image upload, serve, delete |
| `/api/ha` | Home Assistant proxy (entities, services, calendar, history) |
| `/api/state` | SSE stream for real-time entity state |
| `/api/settings` | App-wide settings |
| `/api/backup` | Backup create, list, download, restore |
| `/api/revisions` | Audit trail |
| `/api/weather` | Weather forecast proxy |
| `/health` | Health check |

## Environment Variables

See `.env.example` at the repo root. All required variables are validated at startup via `src/lib/env.ts`. The server exits with a descriptive error if any are missing or invalid.
