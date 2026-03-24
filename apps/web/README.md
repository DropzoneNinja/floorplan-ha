# @floorplan-ha/web

React 18 + Vite frontend for floorplan-ha.

## Stack

- **React 18** — UI framework
- **Vite** — build tool and dev server
- **TypeScript** — strict mode
- **Tailwind CSS** — utility-first styling
- **Zustand** — client state management
- **TanStack Query** — server state and caching
- **React Router 6** — client-side routing
- **React Hook Form + Zod** — form validation
- **Vitest + Testing Library** — unit tests

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on `:5173` |
| `npm run build` | Type-check and bundle to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run test` | Run tests with Vitest |
| `npm run typecheck` | TypeScript check without emitting |

## Key directories

| Path | Purpose |
|------|---------|
| `src/pages/` | Top-level route components |
| `src/hotspots/` | Hotspot registry, renderers, and layer components |
| `src/components/editor/` | Config panel, entity/service pickers, state rule editor |
| `src/components/` | Shared UI components |
| `src/store/` | Zustand stores (auth, entity states, editor, theme) |
| `src/hooks/` | `useStateStream`, `useInactivity`, `useSolarImage` |
| `src/api/client.ts` | HTTP client wrapper |

## Environment

The dev server proxies `/api/*` to the backend at `http://localhost:3001` (configured in `vite.config.ts`). Make sure the API is running before starting the frontend.

## Adding a hotspot type

See [docs/extending-hotspots.md](../../docs/extending-hotspots.md).
