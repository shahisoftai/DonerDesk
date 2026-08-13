# Fixes

Record of fixes applied to DonorDesk. Last updated: 2026-08-13.

## Deploy latest code + backend hardening (release `20260813064828`)

**Status:** Deployed and verified on Contabo production 2026-08-13.

Deployed the Kestra-plan Phases A–D backend code (internal routes, workers
refactor, job-queue adapters + dispatcher, outbox event bus, idempotency,
scheduled flows) and applied three production fixes:

- **API loopback bind (outstanding issue resolved).** `donordesk-api` previously
  listened on `0.0.0.0:4001`; it now binds `127.0.0.1:4001` (verified via `ss`).
- **Idempotency migration + RLS.** Applied migration `20260813000000_idempotency`
  (creates `IdempotencyRecord`) and updated `infra/postgres/rls.sql` to include it
  (23 tenant tables). RLS enabled+forced; `donordesk_app` DML grants verified.
- **Internal service auth configured.** Added `INTERNAL_TOKEN` + `INTERNAL_HMAC_SECRET`
  to `/opt/donordesk/shared/api.env` so `/internal/*` routes authenticate (401
  without a valid token/HMAC) per ADR 0001.

Verified live: `/health` + `/ready` OK (DB connected), `/internal/evidence/x` → 401,
public HTTPS `/` and `/login` 200, no journal errors. Rollback: repoint `current` to
`releases/20260812224500` and `systemctl restart donordesk-api`.

## Production dashboard parity and My Work runtime fix

**Status:** Fixed and verified in production (web release `20260812224500`, 2026-08-12).

The dashboard visible at `DonerDesk.online/dashboard` was not the full designed
desktop experience. The deployed code was current, but the dashboard route itself
still rendered the thinner Phase 3 home screen and did not load the My Work,
readiness, deadline-band, evidence, compliance, activity, or setup/storage
sections.

Fixes:
- Rebuilt `/dashboard` around operational widgets: My Work preview, readiness
  snapshot, deadline bands, evidence review, compliance blockers, activity
  updates, richer project cards, notifications, and setup/storage notices.
- Added reporting-period `readinessScore` to the dashboard read model.
- Removed the redundant body-level new-project action from the dashboard header.
- Fixed `/my-work` production runtime failure by replacing a Server Component
  `<select onChange>` with server-rendered filter links.

Verification: web typecheck passed, all 23 frontend unit test files passed,
optimized Next.js build passed, `git diff --check` passed, and production
release `20260812224500` is active on Contabo with public HTTPS routing verified.

## Frontend UI/UX route and shell integration gaps

**Status:** Fixed and deployed on 2026-08-12; dashboard follow-up deployed in release `20260812224500`.

A post-implementation audit found that several feature components existed but were
not consistently reachable through the rendered portal. The fix added the missing
cross-project Reports, Evidence, and Compliance routes; exposed them in primary
navigation; enriched shared project context; added project Team/Settings and
indicator-detail destinations; introduced a dedicated export center; and corrected
nested-tab matching. Dashboard `/evidence` navigation no longer targets a missing page.

The top bar now provides a context-aware Create menu and a keyboard shortcut to the
existing project search. Permission-filtered global search remains a backend dependency
and is not claimed as implemented.

Verification: web typecheck passed, all 23 frontend unit test files passed, optimized
Next.js build passed, and `git diff --check` passed. See
`imp/FRONTEND-UX-INTEGRATION-AUDIT.md` for the full finding-to-fix matrix and remaining
dependencies.

## Production signup/login 500 at DonerDesk.online

**Status:** Fixed and verified in production (release `20260812115010`, 2026-08-12).

The signup/login pages returned HTTP 500 with the client error
`Uncaught Error: An unexpected response was received from the server`
(`ERR_INVALID_URL` on `'https://donerdesk.online, https://donerdesk.online'`).
Four stacked root causes were found and fixed.

### 1. Server actions hit a wrong API URL
- **Where:** `apps/web/src/lib/auth-actions.ts`, `apps/web/src/lib/api.ts`
- **Problem:** The deployed build baked in `NEXT_PUBLIC_API_URL=http://localhost:4000`,
  so server actions `fetch()`ed a nonexistent local API on the production box.
  (Deployment blocker listed in `docs/CONTABO-LEAN-DEPLOYMENT.md` §4.)
- **Fix:** Resolve a server-only `API_INTERNAL_URL` first, falling back to
  `API_URL` → `NEXT_PUBLIC_API_URL` → `http://127.0.0.1:4001`. A web systemd
  drop-in (`/etc/systemd/system/donordesk-web.service.d/api-url.conf`) sets
  `API_INTERNAL_URL=http://127.0.0.1:4001`.

### 2. OpenLiteSpeed duplicated the `Origin` header
- **Where:** proxy layer (OpenLiteSpeed vhost for `donerdesk.online`)
- **Problem:** OLS appended a second `Origin` header to proxied requests whenever
  the client sent one. Node.js joined the two into
  `req.headers['origin'] = 'https://donerdesk.online, https://donerdesk.online'`.
  Next.js server actions call `new URL(req.headers['origin'])`, which throws
  `TypeError [ERR_INVALID_URL]` on the comma-joined value.
- **Fix:** Added `apps/web/src/middleware.ts` which detects a comma-joined
  `Origin` header on `/signup`, `/login`, `/logout` and rewrites it to the first
  origin value before the server-action handler runs.

### 3. Audit append broke on the Postgres advisory lock
- **Where:** `packages/infrastructure/src/repositories/support.ts` (line 150)
- **Problem:** `SELECT pg_advisory_xact_lock(...)` returns `void`, which
  `prisma.$queryRaw` cannot deserialize, throwing
  `Failed to deserialize column of type 'void'`. This failed every mutation's
  audit write (including signup).
- **Fix:** Cast the lock result:
  `SELECT pg_advisory_xact_lock(...)::text AS lock`.

### 4. RLS and table privileges were never applied
- **Where:** PostgreSQL database `donordesk`
- **Problem:** The initial migration created tables owned by `donordesk_migrator`,
  but the runtime role `donordesk_app` was never granted DML and RLS was never
  enabled. Post-signup reads failed with `permission denied for table ...`
  (Postgres `42501`).
- **Fix:**
  - Ran the RLS SQL across all 28 tenant tables: granted
    `SELECT, INSERT, UPDATE, DELETE` to `donordesk_app`, enabled and forced
    RLS, and created the `tenant_isolation` policy keyed on `app.current_tenant`.
  - Granted `BYPASSRLS` to `donordesk_migrator` (table owner) so the
    auth/admin connection can look up a user globally during login/signup before
    a tenant is known.
  - Runtime `donordesk_app` is intentionally **not** `BYPASSRLS`; it only sees
    rows for its own `app.current_tenant` (verified).

### Verification
- Signup → dashboard redirect, workspace + audit event persisted in Postgres.
- Login → dashboard.
- `/v1/organization` and `/v1/projects` return tenant-scoped data (HTTP 200).
- Tenant isolation: `donordesk_app` sees only its own tenant rows; no rows
  without `app.current_tenant`.
- Zero console errors on `/signup`, `/login`, `/dashboard`.

## Outstanding (tracked in memorybank/pending.md)
See `memorybank/pending.md` for remaining deployment/hardening items.
