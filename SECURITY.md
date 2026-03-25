# Security Audit Report

**Project:** floorplan-ha
**Audit Date:** 2026-03-25
**Stack:** Node.js / Fastify API, React SPA, PostgreSQL, Prisma ORM

---

## Existing Security Controls

The project demonstrates several good security practices:

- **Argon2id password hashing** — industry-standard memory-hard algorithm
- **JWT via `jose` library** — proper JOSE-compliant signing/verification
- **Account lockout** — 3 failed login attempts triggers lockout
- **HTTP-only + Secure cookies** — auth tokens cannot be accessed by JS; `secure` flag enabled in production
- **Email allowlist** — registration requires pre-approved email addresses
- **Zod input validation** — comprehensive schema validation on all API inputs
- **MIME type + file size validation** — uploads checked for type (PNG/JPEG/WebP/GIF/SVG) and size (20MB max)
- **Parameterized queries** — Prisma ORM prevents SQL injection in standard queries
- **HA token server-side only** — Home Assistant token is never exposed to the frontend
- **Role-based access control** — `admin` vs `viewer` roles enforced
- **Backup filename validation** — regex prevents path traversal in backup filenames
- **Audit trail** — revision history logged for all changes

---

## Vulnerability Findings

---

### HIGH

---

#### H2 — SQL LIKE Injection
**File:** `apps/api/src/routes/assets.ts:137-140`
**Risk:** User-supplied `id` is concatenated directly into a LIKE pattern in a raw Prisma query. An attacker can inject LIKE wildcards (`%`, `_`) to enumerate data beyond the intended scope.

```typescript
const cycleUsage = await prisma.$queryRaw<{ count: bigint }[]>`
  SELECT COUNT(*)::bigint AS count FROM floorplans
  WHERE cycle_images_json::text LIKE ${'%' + id + '%'}
`;
```

**Impact:** Potential data enumeration; bypassing intended access restrictions on asset usage counts.

---

### MEDIUM

#### M1 — No Rate Limiting on Auth Endpoints
**Files:** All auth routes (`/api/auth/login`, `/api/auth/register`, `/api/auth/change-password`)
**Risk:** No per-IP or per-email rate limiting exists on authentication endpoints. Although account lockout is implemented after 3 failures per account, an attacker can still:
- Enumerate valid email addresses via response timing/content differences
- Attempt password spraying across many accounts from one IP

**Impact:** Account enumeration, credential stuffing attacks.

---

#### M4 — CORS Configuration Documentation Gap
**File:** `apps/api/src/server.ts:40-43`
**Risk:** CORS is correctly configured via environment variable, but there is no documentation or validation enforcement requiring `CORS_ORIGIN` to be set to a specific origin in production. A misconfigured wildcard (`*`) combined with `credentials: true` would be a critical vulnerability.

**Impact:** Cross-origin request forgery if misconfigured in production.

---

### LOW

#### L1 — Missing HSTS Header
**File:** `docker/nginx.conf`
**Risk:** No `Strict-Transport-Security` header is set. Browsers will not be instructed to always use HTTPS, leaving users potentially vulnerable to SSL stripping attacks on first connection.

**Impact:** Potential downgrade attacks if served over HTTPS.

---

## Dependency Status

All major security-relevant dependencies are current as of audit date:

| Package | Version | Notes |
|---------|---------|-------|
| argon2 | ^0.41.0 | Current — Argon2id hashing |
| jose | ^5.0.0 | Current — JWT signing |
| @fastify/cookie | ^11.0.0 | Current |
| prisma | ^6.0.0 | Current |
| zod | ^3.23.0 | Current |

No known critical CVEs identified in direct dependencies.

---

## Mitigation Checklist

Work through these items in priority order.

### High Priority

- [x] **Fix LIKE injection** (`apps/api/src/routes/assets.ts:137`) — Replaced `LIKE` with `strpos()` to eliminate wildcard injection risk

### Medium Priority

- [x] **Add rate limiting to auth routes** — Installed `@fastify/rate-limit` ^9.0.0; registered in `authRoutes` plugin (10 requests/minute per IP)
- [x] **Document CORS production requirement** — Added `superRefine` to `env.ts` that rejects `CORS_ORIGIN=*` when `NODE_ENV=production`

### Low Priority

- [x] **Add HSTS header** (`docker/nginx.conf`) — Added `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` to server block

---


