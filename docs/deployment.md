# Deployment

Production deployment guide using Docker Compose.

---

## Prerequisites

- A server with **Docker** and **Docker Compose** installed (v2+)
- A running **Home Assistant** instance reachable from the server
- A HA **long-lived access token** (Profile → Long-Lived Access Tokens)
- Ports `5173` (or your chosen `APP_PORT`) and optionally `3001` exposed if accessing the API directly

---

## 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/floorplan-ha.git
cd floorplan-ha
```

---

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with production values:

```env
NODE_ENV=production

# Ports
APP_PORT=5173
API_PORT=3001

# Database (Docker Compose manages this internally)
DATABASE_URL=postgresql://floorplan:secret@postgres:5432/floorplan_ha
POSTGRES_USER=floorplan
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=floorplan_ha

# Auth — MUST change
SESSION_SECRET=<run: openssl rand -base64 32>

# Home Assistant
HA_BASE_URL=http://homeassistant.local:8123
HA_TOKEN=<your-long-lived-access-token>

# Storage — these paths are inside the container; bind-mount them below
ASSET_STORAGE_PATH=/uploads
BACKUP_STORAGE_PATH=/backups

# CORS — must match the URL the browser uses to reach the frontend
CORS_ORIGIN=http://your-server-ip:5173

# Initial admin account (used only on first seed)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<strong-password>
```

> **Security:** Change `POSTGRES_PASSWORD`, `SESSION_SECRET`, and `ADMIN_PASSWORD` before first start. The HA token is never exposed to the browser.

---

## 3. Configure Storage Paths (optional)

By default the compose file bind-mounts `./uploads` and `./backups` relative to the repo root. To use different host paths, edit `docker-compose.yml`:

```yaml
api:
  volumes:
    - /your/host/uploads:/uploads
    - /your/host/backups:/backups
```

Make sure these directories exist and are writable by the container user.

---

## 4. Start

```bash
docker compose up -d
```

Compose brings up four services in order:

| Service | Image | Purpose |
|---------|-------|---------|
| `postgres` | postgres:16-alpine | Database |
| `migrate` | (API Dockerfile) | Runs `prisma migrate deploy` then seed; exits when done |
| `api` | (API Dockerfile) | Fastify backend |
| `web` | (Web Dockerfile, nginx) | Serves the React app; proxies `/api/*` to api |

The first start may take a minute while Docker pulls images and builds the app. Check progress with:

```bash
docker compose logs -f
```

Once all services are healthy, the dashboard is available at `http://your-server:5173`.

---

## 5. First Login

Navigate to `http://your-server:5173` and log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env`.

**Change the admin password immediately** via Settings → Change Password.

---

## Updates

```bash
git pull
docker compose up -d --build
```

The `migrate` service runs automatically on each start and applies any pending database migrations before the API comes up.

---

## Health Checks

Compose defines health checks for all services:

- **postgres** — `pg_isready`
- **api** — `GET /health` (returns `200 OK`)
- **web** — nginx HTTP check

```bash
docker compose ps   # shows health status
```

---

## Backups

The API automatically creates periodic backups (ZIP archives containing a database dump and the uploads directory) in `BACKUP_STORAGE_PATH`.

Manual operations via the admin UI (`/admin/settings` → Backup section) or the API:

| Action | Endpoint |
|--------|---------|
| List backups | `GET /api/backup/list` |
| Create backup | `POST /api/backup/create` |
| Download backup | `GET /api/backup/download/:filename` |
| Restore backup | `POST /api/backup/restore` |
| Delete backup | `DELETE /api/backup/:filename` |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HA_BASE_URL` | Yes | — | Home Assistant URL, no trailing slash |
| `HA_TOKEN` | Yes | — | Long-lived access token |
| `SESSION_SECRET` | Yes | — | JWT signing secret, minimum 32 characters |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `POSTGRES_USER` | Yes | — | Database username (Compose only) |
| `POSTGRES_PASSWORD` | Yes | — | Database password (Compose only) |
| `POSTGRES_DB` | Yes | — | Database name (Compose only) |
| `NODE_ENV` | No | `development` | Set to `production` in production |
| `API_PORT` | No | `3001` | Backend listening port |
| `APP_PORT` | No | `5173` | Frontend exposed port |
| `ASSET_STORAGE_PATH` | No | `/uploads` | Upload storage path inside container |
| `BACKUP_STORAGE_PATH` | No | `/backups` | Backup storage path inside container |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin for the API |
| `ADMIN_EMAIL` | Seed only | `admin@localhost` | Initial admin email |
| `ADMIN_PASSWORD` | Seed only | `changeme123` | Initial admin password |

---

## Reverse Proxy (optional)

If you want to serve on port 80/443 behind nginx or Caddy, proxy all traffic to port `5173`. The nginx container already handles `/api/*` internally, so a simple upstream proxy is all that's needed.

Example Caddy config:

```
your-domain.com {
    reverse_proxy localhost:5173
}
```

Example nginx upstream block:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://localhost:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Logs

```bash
docker compose logs api       # API logs
docker compose logs web       # nginx access logs
docker compose logs migrate   # migration output
```

---

## Stopping and Removing

```bash
docker compose down           # Stop containers, keep volumes
docker compose down -v        # Stop and delete volumes (DESTROYS DATA)
```
