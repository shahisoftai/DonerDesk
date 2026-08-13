# Kestra Plugins — free enhancements (Tika, Redis, JDBC-Postgres, GDrive, SFTP)

**Author:** Kilo (agent) · **Date:** 2026-08-13
**Scope:** Implement four free (Apache-2.0) Kestra plugins for DonorDesk, each wired
to existing contracts, plus a SuperAdmin portal surface.
**Governing docs:** `memorybank/imp/KESTRA-IMPLEMENTATION-PLAN.md`,
`memorybank/SUPERADMIN-PORTAL.md`, `memorybank/contabo-ops.md`, `AGENTS.md`.

## What was added

### Layer 1 — Infra (pinned provisioning)
- `infra/kestra/plugins.manifest.tsv` — canonical pinned plugin list (Tika, Redis,
  JDBC-Postgres, Google, SFTP). Gated: versions must be verified against the
  pinned Kestra core (1.3.30) before enabling plugin flows.
- `infra/kestra/install-plugins.sh` — downloads the pinned JARs into the
  `--plugins` dir that `donordesk-kestra.service` passes to the server. Invoked
  automatically by `install-kestra.sh`.
- `infra/kestra/kestra.application.yml` — documented the plugins dir and added a
  **gated** `donordesk` read datasource (`donordesk_app`, RLS-bound) for the
  JDBC-Postgres plugin.
- `infra/docker-compose.dev.yml` — mounts the staged plugins into the dev Kestra.

### Layer 2 — Backend (signed internal routes)
- `apps/api/src/routes/internal.ts`:
  - `GET /internal/evidence/:id/content` — streams uploaded evidence bytes to
    Kestra flows (used by the Tika flow). Tenant-isolated via the signed tenant
    container + HMAC auth.
  - `POST /internal/evidence/upload` — Base64-JSON signed upload for inbound
    connectors (GDrive/SFTP). Publishes `EvidenceUploaded`, so the outbox maps it
    to the `evidence.suggest_tags` job.
- `packages/contracts/src/internal.ts` — `InternalEvidenceUploadSchema`.

### Layer 3 — Flows (one per plugin)
| Flow | Plugin | Purpose |
|---|---|---|
| `evidence_parse.yml` | Tika | Fetch real bytes → `io.kestra.plugin.tika.Parse` → workers `/v1/suggest-tags` with real document text → persist tags |
| `period_cache.yml` | Redis | RedisGet cache check; on miss recompute readiness + RedisSet with TTL; on hit log cached value |
| `analytics_snapshot.yml` | JDBC-Postgres | Read-only tenant-scoped aggregation via `app.current_tenant` (RLS enforced) |
| `gdrive_ingest.yml` | Google Drive | Trigger → signed evidence upload (gated on credentials) |
| `sftp_ingest.yml` | SFTP | Trigger → signed evidence upload (gated on credentials) |

All new flows are picked up automatically by `workflows/kestra/sync-flows.sh`.

### Layer 4 — FE UI/UX (SuperAdmin portal)
- `apps/api/src/routes/superadmin.ts` — `GET /superadmin/kestra` returns live
  Kestra + workers health plus a declarative plugin/flow catalog.
- `apps/superadmin/src/app/ui/Dashboard.tsx` — new **"Kestra plugins"** tab
  rendering runtime health, the plugin inventory, and the flows with honest
  status (staging vs. operational).

## Verification
- `pnpm -r typecheck` — passes (8 projects)
- `pnpm -r build` — passes (api, web, superadmin, infrastructure, contracts)
- Worker tests — `28 passed`
- All 12 flow YAMLs parse (`yaml.safe_load`)

## Honest status / gating
- Tika, Redis, and JDBC-Postgres flows are wired to contracts that exist and can
  be exercised once the plugins are staged and `sync-flows.sh` is run.
- GDrive and SFTP ingestion flows require credentials (SuperAdmin `CONNECTOR`
  records + Kestra secrets) and live connection testing before they are marked
  operational — they are **staged (gated)**, not claimed as running.
- JDBC-Postgres (`analytics_snapshot`) is gated on `donordesk_app` grants/RLS and
  the `DONORDESK_APP_DB_PASSWORD` Kestra secret; it only issues read-only SELECTs.
- The Base64-JSON upload is a Phase-1 convenience for inbound ingestion; very large
  media should move to a signed-URL/streaming contract later.
