# Runbook — Phase 1 alerts

## API down
1. `curl http://localhost:4000/health` → 200 means process is up.
2. Check logs: `journalctl -u donordesk-api -n 200`.
3. Verify DB file exists: `ls packages/infrastructure/prisma/dev.db`.
4. Restart with `pnpm --filter @donordesk/api start`.

## Database connection lost
1. Check `DATABASE_URL` env var on the running process.
2. For SQLite dev: verify the path is writable.
3. For Postgres (Phase 2): check RDS status and IAM auth.

## High LLM cost
1. Switch provider to the cheaper tier via env var.
2. Inspect recent `llm_runs` (Phase 3 table).
3. Cache embeddings — skip re-embedding unchanged evidence (hash check).

## Readiness score drops unexpectedly
1. Open the report workspace for the affected period.
2. Review the checklist: each item is a derived signal (missing evidence,
   unverified indicators, late activity updates, unsupported claims).
3. Run "Run compliance check" to regenerate after fixes.

## AI Reporter worker unreachable (2026-08-29 — v2 sidecar)
1. `curl -H "x-internal-token: $(grep ^INTERNAL_TOKEN /opt/donordesk/shared/workers.env | cut -d= -f2)" http://127.0.0.1:8092/v1/ai-reporter/health`.
2. If 200, the worker is healthy — the issue is upstream (api → worker).
   Check `journalctl -u donordesk-api -n 200` for `AI Reporter` log lines.
3. If 401, the `INTERNAL_TOKEN` in `/opt/donordesk/shared/api.env` doesn't
   match `/opt/donordesk/shared/workers.env`. Sync them and restart the api.
4. If 404, the worker's `apps/workers/app/main.py` isn't including
   `ai_reporter_router`. Verify the deployed tree at
   `/opt/donordesk/workers/app/main.py` and rsync from
   `/opt/donordesk/app/apps/workers/app/main.py` if missing.
5. If the worker process is dead, `systemctl status donordesk-workers`
   then `journalctl -u donordesk-workers -n 200`. Most common cause is
   a Python syntax error in a newly deployed module; the systemd unit
   is configured to restart on failure with `RestartSec=3`.

When the worker is unreachable, `AiReporterDraftGenerator` falls back to
`StubReportDraftGenerator` per the existing fallback chain
(`HttpWorkerClient` returns `Result.err`; the api logs the reason and
returns a stub draft). This is logged in the audit event
`report.draft.worker.unreachable` (when
`AI_REPORTER_ENABLED=1`). The operator dashboard should show a degraded
state; the audit event is the source of truth.

## AI Reporter validator failures clustering on one tenant (2026-08-29 — v2 sidecar)
1. Pull the artifact issues from the response payload of the failing
   draft (`section.telemetry.validatorIssues`).
2. If the issues are all `BANNED_PHRASE` / `WORD_LIMIT`: the writer prompt
   may be mis-tuned for that tenant. Lower `temperature` to 0.1 in the
   api.env worker settings (if exposed) or temporarily disable v2 for
   the tenant via the legacy `LlmReportDraftGenerator` path (toggle
   `AI_REPORTER_ENABLED=0` until the corpus catches up).
3. If the issues are `NUMERIC_PARAPHRASE`: the writer is summarising
   numbers. Check the brief's `VerifiedFinding.value` strings; the
   brief must carry the exact numeric the writer should use.
4. If the issues are `MISSING_TABLE` / `MISSING_CHART`: the writer may
   not be respecting the brief's `inputType`. Cross-reference with
   `apps/workers/app/ai_reporter/outline.py` to confirm the slot
   templates are correct.

## AI Reporter per-section fallback rate elevated (2026-08-29 — v2 sidecar)
1. Per-call timeout is `AI_REPORTER_DRAFT_TIMEOUT_MS=90000` and the
   per-section budget is `AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS=200000` (v4,
   2026-09-26). The api HTTP ceiling `AI_REPORTER_HTTP_TIMEOUT_MS` (240000)
   must stay above the section budget.
2. Check `llm_runs.responseText` for `parseOutcome` / `qualityIssues`.
   `VALIDATOR_FAILED` means the writer invented a figure; `PROVIDER_ERROR`
   means the provider call failed. Read the worker journal for the provider
   message (e.g. an Anthropic 400 "credit balance is too low").
3. If a specific provider is slow or failing, switch the all-tenants default
   in SuperAdmin → AI (not `AI_REPORTER_MODEL`: the per-request configuration
   wins over the env since 2026-09-26).
3. Check `journalctl -u donordesk-workers -n 200` for `SectionTimeoutError`
   tracebacks to identify whether the timeout is in the LLM call, the
   critique step, or the refine step.
4. The audit event `report.draft.section.fallback` carries
   `fallbackReason` (`PROVIDER_TIMEOUT`, `PROVIDER_HTTP_ERROR`,
   `VALIDATOR_FAILED`). Trend per `tenantId`.
