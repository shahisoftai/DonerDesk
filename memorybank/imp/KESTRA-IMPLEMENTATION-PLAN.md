# Kestra Integration — Comprehensive Implementation Plan

**Author:** Kilo (agent audit) · **Date:** 2026-08-13
**Scope:** Make Kestra a real, deployable, SOLID-compliant orchestrator for DonorDesk's async/scheduled work, then deploy it safely on the Contabo shared host.
**Governing constraints:** `memorybank/contabo-ops.md` (host facts/rules), `memorybank/docs/CONTABO-LEAN-DEPLOYMENT.md` §15 (Kestra design), `memorybank/imp/PHASE1-DEVIATIONS.md`, `AGENTS.md`.

> **Honesty statement (read first).** Kestra is now deployed and connected to
> DonorDesk's API and workers. Where a feature is genuinely blocked by a different
> un-stubbed backend (real LLM, S3, email), this plan says so rather than faking it.
> See §0 for what Kestra can and cannot fix.

> **Status (2026-08-13):** Phases A–D are **implemented and deployed to Contabo
> production** as release `20260813064828` (internal routes, workers refactor,
> job-queue adapters + dispatcher, idempotency, outbox event bus, scheduled
> flows). Migration `20260813000000_idempotency` + RLS applied; API binds loopback.
> **`donordesk-workers` is ENABLED and verified** on `127.0.0.1:8092`.
> **`donordesk-kestra` is ENABLED and verified** on loopback ports 8093 (API/UI)
> and 8094 (management). The blocker was resolved with `sys database migrate`
> and a datasource named `postgres`; 53 Flyway migrations were applied. Seven
> flows are deployed, and production smoke executions proved Kestra → workers
> and signed Kestra → API calls. See §9 and `contabo-ops.md` §14.

> **Free plugins (2026-08-13):** the four recommended free plugins are now
> implemented on top of Phases A–D — **Tika** (real evidence text/OCR via
> `evidence_parse`), **Redis** (`period_cache`), **JDBC-Postgres**
> (`analytics_snapshot`, read-only + RLS-scoped), and **GDrive/SFTP** inbound
> ingestion (`gdrive_ingest`, `sftp_ingest`) via a new signed
> `/internal/evidence/upload` route. GDrive/SFTP and JDBC analytics are **gated**
> on credentials/grants. Details and verification in `imp/KESTRA-PLUGINS.md`.

---

## 0. What Kestra actually owns (and what it cannot fix)

Kestra is an **orchestrator and scheduler** — it triggers, retries, and sequences work. It does **not** perform compute itself; workers do. Therefore:

| Feature | Kestra's role | Blocked by something else? |
|---|---|---|
| Evidence ingest (fetch → parse → tag → persist) | Orchestrate the flow + retries | No — fully implementable now |
| Document parsing / OCR | Trigger parse job | No (parse is deterministic stub; OCR needs `ocr` worker logic) |
| AI tagging / confidence / sensitivity | Trigger tag job | Tag heuristic works; **real** LLM confidence is blocked on `LLM_PROVIDER` wiring |
| Activity polish / report drafting | Trigger job | Real LLM blocked; stub works |
| Nightly readiness recompute | Scheduled trigger | No |
| Deadline / missing-evidence reminders | Scheduled trigger | **Delivery** blocked on email adapter (logs only) |
| Checklist generation on period start | Scheduled trigger | No |
| Automated export on period close | Scheduled trigger | No |
| Inbound file watchers (Drive/S3/Kobo…) | Event trigger | Blocked on Phase-4 integration connectors (not present) |

**So:** Kestra unblocks *orchestration and scheduling* across the board. It does **not** unblock real AI, S3, or email — those remain honest `pending.md` items and are **out of scope** here except where noted.

---

## 1. Audit findings (ground truth)

### 1.1 What exists today
- `infra/docker-compose.dev.yml:39` — Kestra dev container (image `kestra/kestra:latest-lts`, embedded H2, root, `8080:8080`, `latest-lts` unpinned). Dev-only.
- `workflows/kestra/sync-flows.sh` — deploys flows via Flows API (boot loader can't load plugin-based flows).
- `workflows/kestra/evidence_ingest.yml` — single flow `donor_desk.phase1.evidence_ingest`.
- `apps/workers/` — FastAPI with `/health`, `/v1/parse`, `/v1/suggest-tags`, `/v1/polish`, `/v1/draft-section`. No production caller. Binds `0.0.0.0:5000`. Minimal tests.
- `packages/application/src/ports/infrastructure.ts` — `IJobQueue { enqueue(name, payload) }`.
- `packages/infrastructure/src/support.ts` — `InMemoryJobQueue` (just logs). **Always selected** in `container.ts:209`.
- `packages/infrastructure/src/security/priority-queue.ts` — BullMQ `PriorityJobQueue` adapter (unused, unwired).
- `packages/infrastructure/src/llm/evidence-tagger.ts` — `StubEvidenceTagger` (heuristic).
- `packages/application/src/use-cases/evidence/upload-evidence.ts` — inline parse + `jobs.enqueue("evidence.suggest_tags", …)` (goes nowhere).
- `memorybank/docs/architecture/decisions/0001-multi-tenancy.md` — envisions signed `X-Tenant-Id` + HMAC internal webhooks.

### 1.2 Broken / duplicated / risky things (must-fix list)
1. **Dangling flow contracts.** `evidence_ingest.yml` calls `GET /internal/evidence/{id}`, `POST /internal/evidence/{id}/tags` (no such routes) and `from app.parsers import parse` (no such module). **Flow cannot run.**
2. **DRY violation (duplication).** The heuristic tagger logic exists **twice**: TS `evidence-tagger.ts` and Python `main.py:suggest_tags`. Same keywords, same evidence types, drifting. Also parser logic diverges (TS `TolerantDocumentParser` vs Python `/v1/parse`).
3. **Job queue never wired.** `IJobQueue` has one implementation (`InMemoryJobQueue`); BullMQ adapter exists but is dead code; no Kestra adapter. Violates OCP/DIP.
4. **Workers not deployable to production.** Binds `0.0.0.0:5000` (port 5000 not in the ops allocation map), no auth, no systemd unit, no `/ready`.
5. **Production networking mismatch.** Dev Kestra (bridge container) **cannot call** loopback API/workers (`127.0.0.1`). Deployment doc §15 flags this explicitly.
6. **API binds `0.0.0.0:4001`** (ops §10 outstanding issue) — must be loopback.
7. **Kestra unpinned + H2 + root in dev** — dev only, but the prod plan must pin a version, use non-root, and own DB/schema.
8. **Scheduled jobs absent** — readiness recompute, deadline reminders, checklist generation, export-on-close are described in the plan but have **no flows and no handler entry points**.
9. **Idempotency/retry not designed** — tags persist naively; duplicate deliveries would duplicate writes.
10. **No backup of Kestra/workers state** — ops §9 says no DonorDesk off-host backup yet.

---

## 2. Target architecture (SOLID by construction)

```
 Browser
   │  (JWT, public /v1/*)
   ▼
 donordesk-api (Fastify, loopback :4001)
   ├── public routes (tenant auth)            ── read/write DB
   ├── /internal/* routes (internal token)    ── for Kestra S2S
   └── JobDispatcher ──► IJobQueue ──► [InMemory | BullMQ | Kestra]   ← swap via JOB_QUEUE
                                           │
 donordesk-workers (FastAPI, loopback :8092)  ← /v1/parse, /v1/suggest-tags, ...
                                           ▲
 donordesk-kestra (native systemd, loopback :8080, own PG role)
   └── flows: evidence_ingest, readiness_recompute, deadline_reminders,
              checklist_generate, export_on_close, [integration_* later]
```

SOLID mapping:
- **S (SRP):** one flow per job class; one worker route per capability; `JobDispatcher` only routes; handlers only do one job.
- **O (OCP):** adding a job = add a flow + register a handler in the dispatcher; existing code unmodified.
- **L (LSP):** `IJobQueue` adapters (`InMemory`, `BullMQ`, `Kestra`) are interchangeable; `JOB_QUEUE` selects.
- **I (ISP):** `IJobQueue` stays a single `enqueue`; worker ports are narrow (`IParser`, `ITagger`, `IPolisher`, `IDrafter`), not one god-interface.
- **D (DIP):** application depends on ports; `container.ts` injects concrete adapters.

---

## 3. Shared single-source-of-truth strategy (DRY fix)

**Problem:** TS and Python duplicate heuristic rules.

**Fix — a versioned machine-readable strategy, one source of truth:**
- Add `packages/contracts/src/strategies/heuristic-rules.json` (checked in, versioned) containing: evidence-type keywords + confidences, sensitive keywords, activity/indicator match prefixes, parse routing rules (extension → parser).
- TS `StubEvidenceTagger` and Python `suggest_tags` both load this JSON (Python: a committed copy or generated package). Add a script `generate` that emits the Python module from the JSON so they can never drift (single generator = DRY by construction).
- Same treatment for parser route rules (extension → handler) shared by TS `TolerantDocumentParser` and Python `app/parsers.py`.

This satisfies "no duplications of any kind" at the *rule* level, not just the code level.

---

## 4. Phase A — Contracts and internal API (foundation)

**Goal:** make the flow's referenced endpoints exist and be real.

1. **Internal token auth middleware** (`apps/api/src/middleware/internal.ts`):
   - Verify `X-Internal-Token` (constant-time compare against `INTERNAL_TOKEN` env) **and** `X-Tenant-Id` + HMAC per ADR 0001. Reject otherwise (401).
2. **Internal routes** (`apps/api/src/routes/internal.ts`), registered **outside** the public tenant-auth plugin (so Kestra can call them), but still validating token + tenant:
   - `GET /internal/evidence/:id` → returns stored evidence metadata + storage key/text for parsing.
   - `POST /internal/evidence/:id/tags` → accepts suggested tags and persists them via the existing `AcceptEvidenceTags`/persist path (idempotent — see §7).
   - Register in `server.ts` before/parallel to the auth-scoped group.
3. **Contracts** in `packages/contracts` — Zod schemas for `InternalEvidenceResponse`, `PersistTagsBody`, `JobEnvelope`. Reused by API and by flow docs.

---

## 5. Phase B — Workers service productionization

1. **Refactor into narrow modules** (`apps/workers/app/`): `parsers.py`, `tagging.py`, `polishing.py`, `drafting.py`, `security.py` — mirrors TS ports; **all** load shared strategy (§3).
2. **Add `app/parsers.py`** — the module the flow (and docs) reference; implements the same parse routes as the current `/v1/parse`.
3. **Auth:** require `X-Internal-Token` on all routes except `/health` (loopback anyway).
4. **Bind loopback + configurable port:** default `127.0.0.1:8092` (ops candidate port). Remove `0.0.0.0`.
5. **Add `/ready`** and `/health` (liveness/readiness).
6. **Tests:** expand `tests/` to cover each module, strategy loading, auth rejection, readiness.
7. **Systemd unit** `donordesk-workers.service` (uvicorn, `donordesk` user, loopback 8092) — see Phase E.

---

## 6. Phase C — Job queue adapters + dispatcher (SOLID wiring)

1. **Define job names** in one enum (`packages/contracts`): `evidence.ingest`, `evidence.suggest_tags`, `activity.polish`, `report.draft_section`, `readiness.recompute`, `checklist.generate`, `export.run`, `reminder.deadline`.
2. **`KestraJobQueue implements IJobQueue`** (`packages/infrastructure/src/jobs/kestra-job-queue.ts`):
   - `enqueue(name, payload)` → `POST {KESTRA_URL}/api/v1/executions/{namespace}/{flow}` with internal token.
   - Resolve flow id from job name via a mapping table (one table = OCP; add rows, don't edit code).
3. **`BullMQJobQueue implements IJobQueue`** — adapt existing `PriorityJobQueue` behind `IJobQueue`; wire Redis ACL user per ops §6 when selected.
4. **`JobDispatcher`** (`packages/infrastructure/src/jobs/dispatcher.ts`): registry `jobName → handler`; executes synchronously when `InMemory` (current behavior preserved), enqueues to Kestra/BullMQ otherwise. **No change to application use-cases** (they still just call `IJobQueue.enqueue`).
5. **Container selection** (`container.ts`): `const jobQueue = createJobQueue(logger)` reading `JOB_QUEUE=memory|redis|kestra` (default `memory`). One factory = SRP/DIP; existing tests unaffected by default.

---

## 7. Phase D — Idempotency, audit, and triggering

1. **Idempotency keys:** every flow that writes (`persist` tags, export, checklist) includes an `idempotencyKey` (derived from aggregate id + job name + content hash). Persist side must reject/ignore a duplicate key. Satisfies "duplicate delivery" and "restart" tests.
2. **Retry-safe:** each flow task uses Kestra's `retry` + exponential backoff; handler must be re-runnable (no partial-state writes before persist).
3. **Trigger from the API/outbox:** the API emits a domain event (`evidence.uploaded`, `report.period_closed`, …). The `IEventBus` implementation (`LoggingEventBus`) is extended to a real outbox-triggering event bus that maps events → `IJobQueue.enqueue`. (Phase 2 outbox per AGENTS.md — this is the seam.)
4. **Audit:** every enqueue and every internal persist is recorded via `PrismaAuditRepository` (audit_events), satisfying "every mutation writes to audit_events."
5. **Scheduled flows** (pure Kestra triggers, no API change beyond handler entry points):
   - `readiness_recompute.yml` — nightly; calls `/internal/readiness/recompute` (new thin handler).
   - `checklist_generate.yml` — on period start; calls `/internal/checklist/generate`.
   - `export_on_close.yml` — on period close; calls `/internal/export/run`.
   - `deadline_reminders.yml` — daily; calls `/internal/reminders/deadline` (generates notifications; actual email delivery remains blocked/logs-only — **honest**).
6. **New thin internal handlers** for the above in `packages/application/use-cases` + `container.ts`, each delegating to existing use-cases so there is **no** new business logic duplication.

---

## 8. Phase E — Production deployment on Contabo (native, non-disruptive)

Per ops §3/§4/§8 and deployment doc §15.

1. **Preflight** (ops §12): re-check `ss`, disk (31 GiB free), RAM (6.7 GiB avail), JVM load test, confirm **8092** free.
2. **Kestra as native systemd** (deployment doc §15 recommendation — least surprising on loopback):
   - **Pinned image/version** (not `latest-lts`), non-root user, own Postgres role `donordesk_kestra` + schema (not H2). Kestra state in that DB → include in backup.
   - Bind loopback `127.0.0.1:8080`; **do not** expose UI publicly (VPN/SSH tunnel or protected admin hostname only). **No new UFW rules.**
   - Load-test JVM/resource impact before enabling.
   - `systemd` unit `donordesk-kestra.service`.
3. **Workers** native systemd on `127.0.0.1:8092` (`donordesk-workers.service`, `donordesk` user, uvicorn).
4. **API loopback fix:** change `server.ts:153` `host: "0.0.0.0"` → `127.0.0.1` (ops §10 outstanding). Re-verify via `ss`.
5. **Release flow:** immutable release dir + atomic `current` symlink; deploy via self-contained tarball built with pnpm 10.34.5 (ops §10 — do not touch global pnpm).
6. **Backup/restore:** add Kestra DB/schema + workers to the off-host encrypted backup (ops §9) — Kestra state must be restorable.
7. **Health/verify** (ops §13): loopback checks for `:3002`, `:4001`, `:8092`, `:8080`; `/health`, `/ready`; Kestra executions succeed.

---

## 9. Phase F — Verification matrix and honest status

Test each (local + staging + prod):
- Flow loads (`sync-flows.sh`), executes end-to-end (fetch→parse→suggest→persist).
- **Interruption / restart:** kill mid-flow; Kestra resumes; persist is idempotent.
- **Retry / duplicate delivery:** replay a persisted job; no duplicate tags.
- **Auth:** internal routes reject bad token/tenant; workers reject unauthenticated calls.
- **Isolation:** tenant B cannot see/modify tenant A evidence via internal routes (RLS still enforced).
- **Regression:** `pnpm -r typecheck`, `pnpm -r build`, API/web/worker tests, `ruff`, `mypy`, `git diff --check`.
- **Ops:** loopback binds; no public Kestra UI; JVM memory stable; backups include Kestra state.

**Outcome of `pending.md` items this plan closes:**
- ✅ "Integrate worker service" (loopback, auth, systemd, real caller).
- ✅ "Kestra flow … references routes/modules that do not exist" (contracts now exist; aligned to `/v1/*`).
- ✅ Async queue durable/retried (Kestra or BullMQ adapter selectable; `InMemory` fallback default).
- ⏳ Items **still open & honest**: real LLM providers, S3, email delivery, inbound file-watcher connectors (Phase 4). Kestra will orchestrate them when their backend adapters land, but this plan does **not** fake them.

**Update these docs when done:** `memorybank/pending.md`, `memorybank/contabo-ops.md` (§10 allocation + §14 log), `memorybank/docs/CONTABO-LEAN-DEPLOYMENT.md` §15, `README.md` (ports), `memorybank/imp/PHASE1-DEVIATIONS.md` (queue row), ADR on async job ownership.

---

## 10. Suggested build order (each step shippable/verifiable)

1. A1–A3: internal token middleware + `/internal/*` routes + contracts. *(Unblocks the flow's missing routes.)*
2. B1–B6: worker refactor into narrow modules + `app/parsers.py` + loopback/auth + tests.
3. §3: shared heuristic-strategy JSON + generator (kills the TS/Python duplication).
4. C1–C5: job-name enum + `IJobQueue` adapters (`InMemory`/`BullMQ`/`Kestra`) + `JobDispatcher` + `container.ts` selection.
5. D1–D5: idempotency + outbox-triggered events + audit + scheduled flows + thin internal handlers.
6. E1–E7: Contabo deployment (systemd Kestra + workers, loopback API fix, backup, load test).
7. F: full verification matrix + doc updates.

**Recommended default for production:** `JOB_QUEUE=kestra` with `InMemory` as the safe rollback (`JOB_QUEUE=memory`). This keeps the synchronous core working even if Kestra is down — the honest, low-risk path.
