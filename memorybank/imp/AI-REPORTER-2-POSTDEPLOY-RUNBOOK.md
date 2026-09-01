# AI Reporter 2 — Post-Deploy Operator Runbook

**Latest deploy:** `20260901160940` (2026-09-01) — feature flag is **ON** on the live host.
**Status:** internal preview complete; controlled rollout to pilot tenants next.

This runbook is the operator-facing guide for the AI Reporter v2 rollout after
the 2026-09-01 deploy. It assumes the system has already shipped v2 code (worker
tree, api artifacts, `ReportArtifact` persistence, deterministic validators)
and that the api's startup banner logs `"AI Reporter flag is enabled…"` on
every restart.

> **Defaults (2026-09-01 update):** `HttpWorkerClient` now defaults to
> `http://127.0.0.1:8092` and `AI_REPORTER_DRAFT_TIMEOUT_MS` defaults to
> `45_000` (matching `AGENTS.md` §"AI Reporter 2 contracts"). Setting
> `AI_REPORTER_URL` is **only** required if the worker is on a different host.
> The previous legacy defaults (`localhost:5000` / `180_000`) were removed.
>
> **Token sync (2026-09-01 lesson):** the api reads `INTERNAL_TOKEN` from
> `/opt/donordesk/shared/api.env` and sends it to the worker; the worker
> reads its expected value from `/opt/donordesk/shared/workers.env`. These
> drift after every secret rotation. The deploy step §9 in
> [`CONTABO-DEPLOY.md`](../CONTABO-DEPLOY.md) covers the one-line fix.

## TL;DR

The AI Reporter is a **feature-flagged replacement** for `LlmReportDraftGenerator`.
When `AI_REPORTER_ENABLED=1` is set in `/opt/donordesk/shared/api.env`, the
container's `getReportDraftGenerator` factory returns an `AiReporterDraftGenerator`
that calls the Python worker. When the flag is **not** `1` (default), the
factory returns the existing `LlmReportDraftGenerator` and the system
behaves exactly as it did before 2026-08-29 — no other code path
is affected.

The rollout proceeds in three stages:

1. **Internal preview** — flip the flag for the internal DonorDesk
   tenant only. Observe for ≥7 days.
2. **Pilot tenants** — flip for 2 external tenants (one ECHO, one
   Gavi/GF). Observe for ≥7 more days.
3. **Default** — flip for all tenants; remove the legacy
   `LlmReportDraftGenerator` factory path (class retained for emergency
   rollback).

Each stage gates on observed metrics from `audit_events` and Grafana. Rollback
at any stage is a single config change (`AI_REPORTER_ENABLED=0`).

## Pre-flight (one-time, already done at deploy time)

The 2026-08-29 release shipped the code, schema, and RLS. Nothing else
needs to be done before flipping the flag. To verify on the host:

```bash
ssh contabo 'set -a; . /opt/donordesk/shared/api.env; set +a
# 1. Schema
psql "$DATABASE_URL" -c "\dt ReportArtifact*"  # both tables present
# 2. RLS
psql "$DATABASE_URL" -c "SELECT policyname FROM pg_policies WHERE tablename IN ('"'"'ReportArtifact'"'"', '"'"'ReportArtifactRow'"'"');"
# 3. donordesk_app grants
psql "$DATABASE_ADMIN_URL" -c "\dp \"ReportArtifact\" \"ReportArtifactRow\""
# 4. Routes registered
WORKER_TOKEN=$(grep "^INTERNAL_TOKEN" /opt/donordesk/shared/workers.env | cut -d= -f2)
curl -sS http://127.0.0.1:8092/openapi.json \
  | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); [print(m,p) for p,ops in d['"'"'paths'"'"'].items() for m in ops if '"'"'ai-reporter'"'"' in p]"
# Expected output: GET /v1/ai-reporter/health, POST /v1/ai-reporter/section, POST /v1/ai-reporter/rewrite
# 5. Worker health
curl -sS -H "x-internal-token: $WORKER_TOKEN" http://127.0.0.1:8092/v1/ai-reporter/health
# Expected: {"status":"ok"}
```

If any step fails, the AI Reporter sidecar is not deployed. **Stop and
debug before flipping the flag.**

## Stage 1 — Internal preview (days 0–7)

Goal: prove the v2 pipeline is functionally correct with a known tenant
before exposing external tenants.

### Flip the flag

```bash
ssh contabo 'set -a; . /opt/donordesk/shared/api.env; set +a
# AI_REPORTER_URL defaults to http://127.0.0.1:8092 in the code; only set
# it here if the worker is on a different host.
if ! grep -q "^AI_REPORTER_URL=" /opt/donordesk/shared/api.env; then
  echo "AI_REPORTER_URL=http://127.0.0.1:8092" \
    >> /opt/donordesk/shared/api.env
fi
# Accepted truthy values: 1, true, on, yes, enabled (case-insensitive).
if ! grep -q "^AI_REPORTER_ENABLED=" /opt/donordesk/shared/api.env; then
  echo "AI_REPORTER_ENABLED=1" >> /opt/donordesk/shared/api.env
else
  sed -i "s/^AI_REPORTER_ENABLED=.*/AI_REPORTER_ENABLED=1/" \
    /opt/donordesk/shared/api.env
fi
# The api must send the worker's INTERNAL_TOKEN, not its own.
WORKER_TOKEN=$(grep "^INTERNAL_TOKEN=" /opt/donordesk/shared/workers.env | cut -d= -f2-)
sed -i "s|^INTERNAL_TOKEN=.*|INTERNAL_TOKEN=${WORKER_TOKEN}|" \
  /opt/donordesk/shared/api.env
systemctl restart donordesk-api
sleep 3
curl -fsS http://127.0.0.1:4001/health
curl -fsS http://127.0.0.1:4001/ready
# Confirm the factory now returns an AiReporterDraftGenerator:
tail -f /var/log/donordesk-api.log | grep -i "ai reporter\|reporter\|getReportDraftGenerator"
# (or add a temporary log line in container.ts — see §"Verifying the flag" below)
```

### Verifying the flag

The container's `getReportDraftGenerator` has a single cache map keyed
by `tenantId`.` it is built lazily — the **first request** to a `/generate-draft`
route triggers both the construction and the worker `probe()`. The api's
**startup banner** (always logged) confirms whether the flag is recognised:

```bash
ssh contabo 'journalctl -u donordesk-api -n 5 --no-pager | grep -E "AI Reporter|flag"'
# flag ON:  "AI Reporter flag is enabled; the dedicated Python worker will be used for report drafting" url=http://127.0.0.1:8092 timeoutMs=45000 internalTokenSet=true
# flag OFF: (no banner line; the container falls through to LlmReportDraftGenerator)
# flag bogus: "AI_REPORTER_ENABLED is set but unrecognised; treating as disabled."
```

To also confirm the worker is actually reachable, hit any tenant's
`/generate-draft` route and then check:

```bash
ssh contabo 'journalctl -u donordesk-api -n 50 --no-pager | grep -E "probe|AI Reporter"'
# success: "AI Reporter worker probe succeeded" url=… latencyMs=…
# failure: "AI Reporter worker probe failed; falling back to standard LLM generator chain" url=… hint=…
```

The probe failure case shows the exact URL it tried and a hint pointing
at `AI_REPORTER_URL`, the worker service, and `INTERNAL_TOKEN`.

### What to watch during stage 1

| Metric | Source | Healthy range | Action if breached |
|--------|--------|---------------|---------------------|
| `report.draft.section.fallback` rate | `audit_events` (`eventType = 'AUTO_SECTION_FALLBACK'` or fallbacks recorded in `report.section.fallback.*`) | <5% of all sections drafted | Investigate: is the per-section timeout too tight? Are LLM credentials correct? |
| Validator failure rate | `audit_events` (`report.section.artifacts.persist_failed`, worker-side fallback to deterministic output) | <2% of all sections | Run a draft end-to-end, capture validator issues from the response payload, check the eval corpus |
| `AI_REPORTER_URL` / `AI_REPORTER_PROVIDER` reachability | logs | no errors | Verify env, verify worker token |
| End-to-end draft quality | manual review by DonorDesk engineering on 3+ reports | prose is verbatim-numeric, no banned phrases | Pull the artifact issues from the response; cross-reference with `reporting:eval` to ensure the corpus still passes |
| Worker `/v1/ai-reporter/health` | Grafana uptime probe | 200 OK | Check `systemctl status donordesk-workers` |
| LLM cost per draft | `llm_runs` table (`prompt_version`, `model_version`, `cost_usd`) | within per-tier AI-credit budget (per `Features/19-Tiers-And-Payments.md`) | Lower `WRITER_CONTRACT_VERSION`? Lower `max_tokens`? Switch to a cheaper model? |

Stage 1 is **done** when:

- All metrics are within healthy range for **≥7 consecutive days**.
- A donor-facing report has been generated end-to-end with the v2 path.
- `reporting:eval` still returns 25/25 (the corpus is checked into git, but
  CI will catch regressions).

### Rollback to flag-off (any time, one command)

```bash
ssh contabo 'sed -i "s/^AI_REPORTER_ENABLED=.*/AI_REPORTER_ENABLED=0/" \
  /opt/donordesk/shared/api.env
systemctl restart donordesk-api'
```

The api immediately reverts to `LlmReportDraftGenerator`. No data loss;
the v2 artifacts in `ReportArtifact` are still queryable via
`GetReportDraftHandler` for any drafts that were completed with v2.

## Stage 2 — Pilot tenants (days 7–14)

Goal: confirm v2 holds with two real tenants on real donor templates.

### Enable per tenant

`getReportDraftGenerator` reads `process.env.AI_REPORTER_ENABLED` at
container start. The cache key includes the tenantId, but the flag is
**global** in the current implementation (a single env var applies to all
tenants). For per-tenant enablement:

1. **Run a second api process with `AI_REPORTER_ENABLED=1` and a
   tenant allowlist filter** — requires a small refactor to
   `getReportDraftGenerator` to honour `AI_REPORTER_TENANT_ALLOWLIST`
   (a comma-separated tenant-id list). Tracked in
   `imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md` §8.
2. **Until that ships**: flip the flag globally for a short observation
   window. Stage 2 then becomes "Stage 1 + 7 more days + spot-check
   drafts for the two pilot tenants."

The simpler path (option 2) is fine for two pilot tenants. To enable
it without disturbing the internal preview:

```bash
# Stop the internal-preview watch.
ssh contabo 'sed -i "s/^AI_REPORTER_ENABLED=.*/AI_REPORTER_ENABLED=0/" \
  /opt/donordesk/shared/api.env
systemctl restart donordesk-api'

# Coordinate with the two pilot tenants (one ECHO, one Gavi/GF) so they
# generate drafts in the next observation window. Then flip back on:
ssh contabo 'sed -i "s/^AI_REPORTER_ENABLED=.*/AI_REPORTER_ENABLED=1/" \
  /opt/donordesk/shared/api.env
systemctl restart donordesk-api'
```

### What to watch during stage 2

Same metrics as Stage 1, broken down per tenant via `report.draft.section.fallback`
audit events (each carries `tenantId`). Confirm both pilots hit the
healthy range for ≥7 consecutive days.

The pilot tenants should ideally be:

- **Pilot A: an ECHO single-form report** — table-heavy, numeric, per-period
  comparisons. Verifies TABLE artifacts + numeric verbatim rule + word
  count + chart data grounding.
- **Pilot B: a Gavi/GF narrative report** — narrative-heavy, indicator
  achievements. Verifies CHART artifacts + delta from prior + mandatory
  questions + cross-section repetition guard.

Stage 2 is **done** when both pilots hit the healthy range for ≥7 days.

## Stage 3 — Default

Goal: remove the legacy factory path so every draft uses v2.

### Flip the flag for all tenants

Already done at the end of Stage 2.

### Remove the legacy factory path

In `packages/infrastructure/src/container.ts`:

```diff
-      const generator =
-        process.env.LLM_PROVIDER
-          ? new LlmReportDraftGenerator(...)
-          : new StubReportDraftGenerator();
+      // AI Reporter v2 is the only supported draft generator. The legacy
+      // LlmReportDraftGenerator class is retained (and the stub class too)
+      // for emergency rollback via direct code change; see
+      // memorybank/imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md §15.
+      const generator = await getReportDraftGenerator();
```

`getReportDraftGenerator` is the factory that picks the AI Reporter when the
flag is on, and the stub when it's off. With the flag defaulted on, the
factory's branch is no longer needed; the AI Reporter is always the path.

Keep `LlmReportDraftGenerator` and `StubReportDraftGenerator` in the tree so
an emergency rollback (commit + redeploy) can re-enable them in <10 min.

### Long-running metrics

Once Stage 3 ships:

- `report.draft.section.fallback` rate per tenant — track for 30 days,
  flag any tenant >5%.
- `validator.failed` audit events — track total volume and per-tenant
  trends.
- Per-section latency p50/p95/p99 — track in Grafana.

## Verifying the api-tar / worker tree (post-rollout hygiene)

The deploy script ships four api-scoped tars (see
`CONTABO-DEPLOY.md` §5 — api tar layout): `apps/api/`, `packages/`, `node_modules/.pnpm/`,
and the api-extract step re-runs `pnpm install` to regenerate the api's
symlink farm. When upgrading to a future AI Reporter version:

1. Run `RELEASE_ID=… SCOPE=api scripts/deploy-fast.sh` — the script
   enforces the new layout automatically.
2. Verify `/v1/ai-reporter/health` on the worker still returns
   `{"status":"ok"}` with the worker `INTERNAL_TOKEN`.
3. Verify the api's `apps/api/dist/llm/ai-reporter-draft-generator.js`
   contains the new mapping functions (e.g. `mapArtifacts`,
   `mapChartPayload`, `mapDeltaPayload`).

## Failover / rollback

| Scenario | Recovery |
|----------|----------|
| LLM provider outage | The per-section timeout + retry + per-section fallback handles this. Sections fall back to deterministic output; the rest of the draft continues. Audit event `report.draft.section.fallback` records the reason. |
| LLM provider costs spike | Lower `max_tokens` in `apps/workers/app/ai_reporter/draft_writer.py`; lower `temperature`; switch to a cheaper model via `AI_REPORTER_MODEL`. |
| Validator failures cluster on one tenant | That tenant may have unusual evidence shape. Either (a) tighten the validator for that tenant via a per-tenant override (future feature), or (b) disable v2 for that tenant by adding it to a `BLOCKLIST` (future feature), or (c) flip the flag globally and wait for the corpus to grow. |
| Worker unreachable | `HttpWorkerClient` returns `Result.err`; `AiReporterDraftGenerator` falls back to `StubReportDraftGenerator` per the existing fallback chain. The audit event records the reason (`PROVIDER_HTTP_ERROR`). |
| Database migration conflict | The v2 migration `20260828200000_ai_reporter_artifacts` is additive. If a future migration conflicts, see `CONTABO-DEPLOY.md` §7 for rollback (single `tar xzf`). |

## Useful Grafana queries

The following queries (using the `audit_events` and `llm_runs` tables)
are the operator's primary observability during the rollout. The
`AuditEvent` table uses scalar columns (`tenantId`, `eventType`,
`newValue`, `systemNote`) — not a JSON `payload` column.

```sql
-- Per-section fallback rate per tenant (last 24h)
-- The handler writes eventType='report.draft.fallback' with a systemNote
-- of the form "Draft generation fell back to stub generator (reason=…)."
SELECT
  "tenantId",
  COUNT(*)::float / NULLIF(SUM(COUNT(*)) OVER (), 0) AS fallback_share
FROM "AuditEvent"
WHERE "eventType" = 'report.draft.fallback'
  AND "createdAt" > NOW() - INTERVAL '1 day'
GROUP BY "tenantId"
ORDER BY fallback_share DESC NULLS LAST;

-- Recent fallbacks (the systemNote carries the fallbackReason)
SELECT
  "tenantId",
  "systemNote",
  "createdAt"
FROM "AuditEvent"
WHERE "eventType" = 'report.draft.fallback'
ORDER BY "createdAt" DESC
LIMIT 50;

-- Validator/persistence failures (per-section artifacts)
SELECT
  "tenantId",
  "entityId"   AS section_id,
  "newValue"   AS message,
  "createdAt"
FROM "AuditEvent"
WHERE "eventType" = 'report.section.artifacts.persist_failed'
ORDER BY "createdAt" DESC
LIMIT 50;

-- Per-section latency p95 (LlmRun records every drafted section)
SELECT
  percentile_disc(0.95) WITHIN GROUP (ORDER BY "latencyMs") AS p95_latency_ms
FROM "LlmRun"
WHERE "operationType" = 'REPORT_SECTION'
  AND "promptVersion" = 2  -- AI Reporter v2
  AND "createdAt" > NOW() - INTERVAL '7 days';
```

## Reference

- `memorybank/imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md` — the design
  plan, §8 has the rollout phase definitions.
- `memorybank/imp/AI-REPORTER-2-RESULTS.md` — the post-deploy
  retrospective with deploy timeline + lessons learned.
- `memorybank/Features/11-AI-Report-Draft-Generator.md` — feature
  catalog entry (status tables, behavior).
- `memorybank/CONTABO-DEPLOY.md` §5 — api tar layout + workspace
  symlinks fix.