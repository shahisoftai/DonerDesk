# AI Reporter 2 — Post-Deploy Retrospective

**Release:** `20260828200000`
**Deployed:** 2026-08-29 (commit `a2ffc29` on `0005-report-enhanc-03`, pushed to
`origin/0005-report-enhanc-03`)
**Status:** ✅ IMPLEMENTED; feature flag **OFF** by default.

## Summary

AI Reporter 2 shipped every artifact in the implementation plan:

- 622-LOC monolithic `apps/workers/app/ai_reporter.py` replaced by a
  12-module SRP package (`models`, `writer_contract`, `llm_gateway`,
  `outline`, `chart_suggester`, `draft_writer`, `critique_writer`,
  `refiner`, `artifact_validators`, `timeouts`, `pipeline`, `router`).
- Writer contract v2 (`WRITER_CONTRACT_VERSION=2`) with banned-phrase list,
  numeric verbatim rule, repetition guard, mandatory-Q&A discipline,
  table/chart/delta mandates — mirrored in Python SSOT and
  `packages/infrastructure/src/llm/ai-reporter/contract.ts`.
- `GeneratedSection` carries optional additive fields
  (`artifacts[]`, `qa[]`, `chartSpec?`, `deltaFromPrior?`) — every v1
  generator (`StubReportDraftGenerator`, `LlmReportDraftGenerator`)
  still works unchanged (LSP holds).
- Typed artifact storage in two new Prisma models (`ReportArtifact`,
  `ReportArtifactRow`, migration `20260828200000_ai_reporter_artifacts`).
  RLS forced on both tables; cross-tenant INSERT verified to fail.
- Deterministic artifact validators (9 hard gates) mirrored
  Python + TS; each exported individually for testability and
  aggregated via `runAll`.
- Per-section timeout (`AI_REPORTER_DRAFT_TIMEOUT_MS=45000` enforced
  by `apps/workers/app/ai_reporter/timeouts.py` + `AbortSignal.timeout`
  on the TS HTTP client). **Per-section fallback** semantics: a single
  slow section no longer demotes the whole draft; the per-section
  `usedFallback` flag rolls up to the draft-level flag, but the
  successful sections keep their AI-generated content.
- Eval corpus grown 8 → 25 cases. New deterministic metrics:
  `banned-phrase`, `qa-coverage`, `narrative-length-vs-target`,
  `artifact-coverage`, `citation-density`. All 25/25 pass locally and
  in CI; the corpus is checked in at
  `packages/infrastructure/test/fixtures/reporting-golden.json`.

## Deploy timeline (UTC+02:00)

| Step | Time | Duration | Outcome |
|------|------|----------|---------|
| Preflight | 07:38 | <1 min | ssh ok, services active, ports 3002/4001/8092 bound |
| Prisma migration applied | 07:46 | ~5 min | SQL via `psql` + manual row insert (migrator role lacks CREATE on `_prisma_migrations`); `donordesk_migrator` granted CREATE |
| RLS + grants | 07:48 | <1 min | Cross-tenant INSERT denied; same-tenant INSERT passes RLS |
| First deploy attempt | 07:48 | timed out at 10 min | SSH transient failure → aborted |
| Second deploy attempt | 09:47 | build 196s + snapshot 60s | api tar extracted, chown error killed the script before worker sync |
| Third deploy attempt | 10:00 | build 238s | Same chown error: pre-existing bug, not the new code |
| Manual recovery (api + workers) | 07:01–07:24 | ~25 min | Diagnosed broken `apps/api/node_modules/fastify` symlink; updated systemd unit's `WorkingDirectory`; `pnpm install` at `apps/api/`; rsynced worker code; restarted services |
| Final verification | 07:24 | <1 min | api `/health` ok, `/ready` ok; worker `/v1/ai-reporter/health` ok (with worker `INTERNAL_TOKEN`); public `https://donordesk.online/login` 200 |

The ~25-minute recovery was longer than expected because:

1. The pre-existing api tar shipped the api's `node_modules/` as 14
   symlinks into `node_modules/.pnpm/...` whose target paths assumed a
   3-level-relative layout that didn't match pnpm 10's defaults
   (`node_modules/.pnpm/` lives at the workspace root, not at the
   app tree).
2. The api systemd unit's `WorkingDirectory=/opt/donordesk/app` was
   correct only because the api tar was previously flattened
   (`dist/` at top). Once the ai-reporter-2 code introduced new
   transitive imports (artifact validators, chart suggester,
   report-artifact repository), the api started needing
   `fastify` resolved at startup — which the broken symlink couldn't
   do.
3. The chown error in the deploy script (`chown -R ${REMOTE_APP}/dist ${REMOTE_APP}/apps/api` where the latter didn't exist) aborted the script silently under `set -eu` before the worker sync step ran.

All three issues are now fixed in
[`scripts/deploy-fast.sh`](../../../scripts/deploy-fast.sh) and
[`infra/systemd/donordesk-api.service`](../../../infra/systemd/donordesk-api.service).

## Gate results

| Gate | Status | Notes |
|------|--------|-------|
| TS typecheck (8 packages) | ✅ | |
| TS full build | ✅ | |
| Python mypy (22 files) | ✅ | Pre-existing `openpyxl` import-not-typed warning unrelated to v2 |
| Python pytest | ✅ 55/55 | 32 existing + 23 new |
| TS infra tests | ✅ 136/137 | 14 new artifact-validator tests; 1 pre-existing skip |
| Reporting eval corpus | ✅ 25/25 | All hard metrics + soft signals pass |
| systemd (api/web/workers) | ✅ all active | |
| API health (`/health`, `/ready`) | ✅ | `{"status":"ready","checks":{"database":"ok"}}` |
| Worker AI Reporter health | ✅ | `{"status":"ok"}` with worker token |
| Public HTTPS | ✅ | `https://donordesk.online/login` 200, full Next.js assets served |
| RLS isolation | ✅ | Cross-tenant INSERT denied (verified on host) |
| Pre-deploy tar created | ✅ | `dd-app-pre-20260828200000.tgz` |
| Off-host backup | ⚠️ | Per §23 of contabo-ops.md — **not scheduled**; on-host tar is the rollback target |

## Lessons learned (ADR-style notes)

### L1. Fast-deploy tar layout must mirror how the systemd unit resolves
**modules.**

The api systemd unit reads `dist/server.js` from its `WorkingDirectory`.
The api tar's `node_modules/` is a symlink farm. Two layouts were possible:

- **Flattened (what the original script did):** tar root is `dist/`, the
  api extract step puts `dist/` at `/opt/donordesk/app/dist/`; the api
  can be run from `/opt/donordesk/app` with `node dist/server.js`.
  Workspace links fail because `apps/api/node_modules/@donordesk/infrastructure
  -> ../../../../packages/infrastructure` (4 levels up) resolves to
  `/packages/infrastructure` from `/opt/donordesk/app/node_modules/`,
  which doesn't exist.
- **Tree (what the current script does):** tar root is `apps/api/{dist,...}`,
  the api extract step puts `dist/` at `/opt/donordesk/app/apps/api/dist/`;
  the systemd unit must run from `/opt/donordesk/app/apps/api`. Workspace
  links now resolve correctly.

**Decision:** Tree layout. The systemd unit's `WorkingDirectory` is the
contract; the tar shape is the implementation. Future package additions
keep the workspace links intact.

### L2. pnpm symlinks need the workspace-root pnpm-store contents shipped.

pnpm 10's default puts `node_modules/.pnpm/` at the workspace root.
`apps/api/node_modules/fastify -> ../../../node_modules/.pnpm/fastify@5.11.3/...`
resolves correctly to `/opt/donordesk/app/node_modules/.pnpm/...` only
if that store is populated. The fast-deploy script now ships that store
explicitly, then runs `pnpm install` at `apps/api/` to regenerate the
api-level symlinks. This handles both the case where the store is up
to date and where it's been replaced.

**Decision:** ship the pnpm-store tar + re-link. Don't try to use
the api's pre-existing symlinks to find a non-existent target.

### L3. Per-section fallback is a correctness fix, not just a UX nicety.

The old behavior was: any one section's LLM call timing out demoted
the whole draft to "usedFallback: true" — the operator saw a stub
draft even though 4 of 5 sections drafted successfully. The new
behavior: that one section retries once, then falls back per-section.
The aggregate `usedFallback` is the OR across sections, but the
successful sections still ship their AI content. This was the bug
behind "all-sections-fallback-to-stub" (2026-08-20, recorded in
`pending.md`).

**Decision:** per-section fallback is the right semantic for a
multi-section report. The audit event `report.draft.section.fallback`
will let Grafana flag tenant-level regressions without losing the
work the LLM did for the other sections.

### L4. The migrator role needs CREATE on the schema to apply new migrations.

`prisma migrate deploy` runs `ALTER TABLE _prisma_migrations ...` and
needs `CREATE` on `public`. The `donordesk_migrator` role had DML
privileges but not DDL. Two fixes are needed:

- **Operational (already applied):** `sudo -u postgres psql -c
  "GRANT CREATE ON SCHEMA public TO donordesk_migrator"`.
- **Procedural (added to contabo-ops.md §18):** when a new migration
  ships, the operator should grant the migrator CREATE *before* the
  deploy runs `prisma migrate deploy`. This avoids the situation
  where the SQL is applied directly to the DB but `prisma migrate`
  can't update the bookkeeping table.

**Decision:** document the migrator-CREATE pattern as a §18 prerequisite
for any future additive migration.

## Operational guidance (for the next deploy)

- Always run `pnpm db:migrate` (or `prisma migrate deploy`) as the
  migrator role; if it fails with "permission denied for table
  _prisma_migrations", grant the migrator CREATE on the schema first.
- When changing the api systemd unit's `WorkingDirectory`, verify the
  api tar's tree layout matches; the deploy script's `bash -n` check
  catches typos but not logical mismatches.
- The worker and api use **different** `INTERNAL_TOKEN`s; check both
  `/opt/donordesk/shared/api.env` and `/opt/donordesk/shared/workers.env`
  when debugging 401s.
- The `AI_REPORTER_URL` default (`http://localhost:5000`) is the legacy
  stub address; set `AI_REPORTER_URL=http://127.0.0.1:8092` when
  flipping `AI_REPORTER_ENABLED=1`.

## Known follow-ups (not blocking)

- **Frontend artifact renderers** (Phase 7 of the plan): TABLE renders
  via the existing TanStack table; CHART reuses the ECharts renderer
  (`buildChartOption`); LIST/KEY_VALUE/QA/DELTA need new components.
  Tracked in `pending.md` as part of "Frontend: render typed
  artifacts".
- **Default rollout** (Phase 8): controlled enablement for preview
  tenants, then two pilot tenants, then default. The exact procedure
  is in `imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`.
- **LLM-judge soft metrics**: deferred (optional per the plan). The
  current eval corpus already covers all the hard metrics.
- **Off-host backup**: per §23 of contabo-ops.md, no automated off-host
  DonorDesk backup is scheduled yet. The on-host pre-deploy tarball
  is the rollback target.