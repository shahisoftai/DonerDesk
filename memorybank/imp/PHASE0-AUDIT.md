# Phase 0 audit

Audited against Phase 0 in `memorybank/base/DonorDesk — Phased Implementation Plan.md`.

**Status: implemented and runtime-accepted** on a Docker-enabled Linux host (11 August 2026),
with one documented host-level prerequisite (see *Host prerequisites*).

## Implemented

- pnpm monorepo with strict TypeScript package boundaries and reproducible builds.
- Fastify API foundation with `/health`, dependency-aware `/ready`, Prometheus `/metrics`, and authenticated tenant-aware `/v1/ping`.
- PostgreSQL 16 is the active Prisma datasource. The application role is non-superuser; tenant sessions are established per authenticated request and RLS is enabled and forced on tenant tables.
- OIDC JWT validation through remote JWKS plus a Next.js Authorization Code + PKCE flow. Local JWT remains an explicit development fallback.
- OpenTelemetry Node auto-instrumentation and OTLP/HTTP export to Tempo.
- Prometheus RED metrics, structured logging, Sentry exception capture, and request-data/header scrubbing.
- Local Compose definitions for PostgreSQL, Redis, Keycloak, Kestra, Tempo, Loki, Prometheus, and Grafana.
- AWS Terraform foundation for private PostgreSQL and private, encrypted, versioned evidence storage.
- CI gates for build, strict type checks, Ruff, Mypy, automated tests, Playwright, dependency audit, Gitleaks, Semgrep, Trivy, and Terraform plan.
- Executable tests in domain, contracts, application, infrastructure, API, workers, and web workspaces.

## Verification evidence

Static verification (all passing):

- TypeScript type checks across all seven workspaces, Python Mypy strict, TypeScript builds, Next.js production build, Ruff.
- Node tests (domain 4, contracts 2, application 1, infrastructure 1, API 2), Pytest (2), Playwright (1).
- Docker Compose configuration validation.
- Production dependency audit: zero high or critical findings; seven moderate findings remain.

Runtime acceptance executed against the Compose stack:

| Acceptance check | Result |
|---|---|
| Compose stack starts (PostgreSQL, Redis, Keycloak, Kestra, Tempo, Loki, Prometheus, Grafana) | Passed |
| `pnpm db:migrate` — Prisma schema push plus RLS policies | Passed; 18 tenant tables report `rowsecurity` and `relforcerowsecurity` true |
| `pnpm db:seed` | Passed; `demo-tenant` organisation and admin user created |
| `GET /health` | `200 {"status":"ok"}` |
| `GET /ready` | `200 {"status":"ready","checks":{"database":"ok"}}` |
| Unauthenticated `GET /v1/ping` | `401` RFC 7807 problem document |
| OIDC-authenticated `GET /v1/ping` | `200`, body `tenantId: demo-tenant`, header `x-tenant-id: demo-tenant` |
| Access token claims | `iss` realm, `aud=donordesk-web`, `org_id=demo-tenant`, `realm_access.roles=[ADMIN]` |
| Browser Authorization Code + PKCE login through Keycloak | Passed; redirected to `/dashboard` rendering the tenant organisation |
| Database-level cross-tenant denial (application role) | Passed; no tenant session returns 0 rows, wrong tenant returns 0 rows, cross-tenant `INSERT` raises `new row violates row-level security policy` |
| API-level cross-tenant denial | Passed; tenant B receives `404` on tenant A's project for both read and update, and an empty project list |
| Audit trail on mutation | Passed; `project.created` recorded in `AuditEvent` for `demo-tenant` |
| Prometheus RED metrics | Passed; `donordesk_http_requests_total` and `donordesk_http_request_duration_seconds` exposed with route/method/status labels |
| Prometheus alert rules loaded | Passed; `DonorDeskApiDown` and `DonorDeskHighErrorRate` both evaluated |
| Trace arrival in Tempo | Passed; `rootServiceName: donordesk-api` trace returned by the Tempo search API |
| Grafana datasource health | Prometheus and Loki report `OK`; Tempo returns `plugin.notImplemented` because the Tempo datasource has no health endpoint, and is verified through the Tempo API instead |
| Kestra starts and loads versioned workflows | Passed; `donor_desk.phase1.evidence_ingest` present with tasks `fetch`, `parse`, `suggest`, `persist` |

## Defects found and fixed during runtime acceptance

| Defect | Fix |
|---|---|
| `apps/api` dev script had the tsx flag before the `watch` subcommand, so `pnpm dev` never started the API | Reordered to `tsx watch --env-file=.env src/server.ts` |
| Compose project name defaulted to the `infra` directory, colliding with unrelated stacks on the host | Added an explicit `name: donordesk` to `infra/docker-compose.dev.yml` |
| Prometheus could not resolve `host.docker.internal` on Linux | Added `extra_hosts: host.docker.internal:host-gateway` to the Prometheus service |
| Keycloak realm had no audience mapper, so access tokens never carried `aud=donordesk-web` and every token was rejected | Added an `oidc-audience-mapper` protocol mapper |
| Keycloak 26 drops unmanaged user attributes on import, so `org_id` could never reach a token | Declared `org_id` in the realm's declarative user profile |
| Realm contained no users, so the OIDC acceptance path was untestable | Added `admin@example.org` (`demo-tenant`) and `admin@other.org` (`other-tenant`) dev users with the `ADMIN` role |
| `workflows/kestra/evidence_ingest.yml` began with a Python-style `"""` docstring and was not valid YAML | Converted the header to YAML comments |
| Kestra's boot-time flow loader runs before plugin JARs register, so any flow using a plugin task type fails to load | Removed reliance on the boot loader and added `workflows/kestra/sync-flows.sh`, which deploys flows through the validated Flows API |

## Host prerequisites

Prometheus scrapes the API over `host.docker.internal:4000` while the API runs on the host under
`pnpm dev`. On Linux hosts with `ufw` active, the default deny-incoming policy blocks
container-to-host traffic, so the `donordesk-api` scrape target stays `down` and
`DonorDeskApiDown` fires. This is host firewall configuration, not application configuration.
Allow it with:

```bash
sudo ufw allow in on docker0 to any port 4000 proto tcp
```

The alert firing while the port is blocked is itself evidence that rule evaluation and the
metrics pipeline work end to end.

## Reproducing the acceptance run

```bash
docker compose -f infra/docker-compose.dev.yml up -d
pnpm db:migrate
pnpm db:seed
./workflows/kestra/sync-flows.sh
pnpm dev
```

Then obtain a real OIDC token through the Authorization Code + PKCE flow and call the API:

```bash
TOKEN=$(node infra/keycloak/dev-token.mjs)
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:4000/v1/ping
```

`infra/keycloak/dev-token.mjs` is a development-only helper that performs the real PKCE
authorization code exchange against the local Keycloak realm; it issues no tokens itself.

Dev credentials for the local realm are `admin@example.org` / `password123` (tenant
`demo-tenant`) and `admin@other.org` / `password123` (tenant `other-tenant`, used to prove
cross-tenant denial). The Kestra UI uses `admin@donordesk.local` / `DonorDesk123`.

## Remaining non-blocking items

- Seven moderate production dependency advisories remain; CI blocks only on high and critical.
- The full CI workflow still needs a green run on a pull request, which cannot be produced from a local host.
