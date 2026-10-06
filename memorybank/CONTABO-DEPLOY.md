# Deploy to Contabo — Fastest Path

**Last deploy:** 2026-10-06 (UTC) — `releaseId=20261006054211` (`SCOPE=both`, no migration): **Restore screen for archived indicators** (Logframe page, `GET /v1/projects/:id/indicators/archived`) and the matching Help Center text; `/ready` 200, worker ok, route 401 unauthenticated. Before it: `releaseId=20261006051833` (`SCOPE=web`): Help Center articles for Phase 24 (four new how-tos, ~25 updated; articles are baked into the web build). Verified: all new pages 200, in the sitemap. Before it: `releaseId=20261006045737` (`SCOPE=both`, branch `0009-agent-memory`). **Phase 24 user simplicity** (`imp/Phase24-user-simplicity.md` §9): one evidence-scope rule, evidence inherits its activity's period,
editable/movable/archivable indicators, template defaults per report type, writers no longer see the readiness score, activity resubmit/withdraw/bulk accept, self-closing checklist state items + one-step resolve with Undo,
roll-up exports with life-of-project columns, create-all periods. **Three additive migrations applied manually first** (`rsync --relative` + `prisma migrate deploy` as `donordesk_migrator`):
`20261007100000_evidence_period_from_activity` (data backfill only), `20261007110000_indicator_archive` (`Indicator.archivedAt`), `20261007120000_activity_superseded` (`ActivityUpdate.supersededById`). No `rls.sql` change.
DB backup before: `/opt/donordesk/backups/db-pre-20261007-phase24.dump`. `REQUIRED_PRISMA_FIELDS` gained both columns; `/ready` 200, worker ok, api/web active.
Browser-verified on production with a real login (read-only): reviewer note shown beside an activity's text with Resubmit and Withdraw panels, the closing plan names "GWHF Final Project Report", the new-period form preselects the reviewed template per type,
the indicator page has Edit / Move / Remove, evidence detail shows the upload date. The create-all, bulk-accept and one-step-resolve writes were covered by tests and a local scratch run, not clicked on production.

**Earlier:** 2026-10-05 — `releaseId=20261005123155` (`SCOPE=both`, branch `0009-agent-memory`, commit `dd78aba`). **Phase 23 user-friendliness** (`imp/PHSE23-userfriendliness.md`):
indicator-calculation confirm + setup warnings, verify-all, staged readiness + top-3, flag classes + one-note section decision, one evidence linker + support panel,
"what you can create" / lifecycle banner / readable validation errors, guided closing report, activity→logframe link, shared workflow rules.
**Two additive migrations applied manually first:** `20261006100000_evidence_indicator_update_link` (`EvidenceFile.indicatorUpdateId` + backfill of legacy update ids out of `indicatorId`) and
`20261006110000_activity_logframe_activity_link` (`ActivityUpdate.logframeActivityId`), shipped with `rsync --relative` (migration dirs + `schema.prisma`) and `prisma migrate deploy` as
`donordesk_migrator`. No `rls.sql` change (no new tables). DB backup before: `/opt/donordesk/backups/db-pre-20261006-phase23.dump` (written by root; `pg_dump` as `postgres` cannot write there).
Verified: api/web/worker active, `/ready` 200 (new `REQUIRED_PRISMA_FIELDS` present), new route 401 unauthenticated, both columns present, no API errors after restart.
Not browser-verified in production; locally the lifecycle banner, confirm-calculation, period guide and closing stepper were checked in a real browser (see Features notes in the plan doc).

**Earlier:** (previous) **Last deploy:** 2026-10-05 — `releaseId=20261005095940` (`SCOPE=both`: downloads get a readable `.docx`/`.pdf` name and the right content type), the last of sixteen same-day deploys (`both`: `20261005054216`, `20261005074239`, `20261005080930` (web: Download draft); `api`: the rest up to `20261005090450`). No migration. Verification demo 3: disaggregation reaches the writer and the verifier, record-grounded claim verification (activity records, project
details, story, findings, finance, evidence log), roll-up reports judged on the life-of-project value with its own breakdown, tagged evidence reaches the writer, preflight counts before the first
draft (Fixes.md; `demo/verification-demo-3.md`). `20261005055544` shipped with four guidance tests failing because the package tests had run against a stale `dist/` (build every package in
dependency order first); `20261005061903` replaced it ~4 minutes later. Verified each time: `/ready` 200, worker ok; final report regenerated in a visible browser.

**Earlier:** (previous) **Last deploy:** 2026-10-04 — `releaseId=20261004052515` (`SCOPE=both`, branch `0009-agent-memory`, commit `5322e2c`). **Report-type quality gaps**
(Features/10 §"Report-type quality gaps closed"): same-kind history, life-of-project (cumulative) findings, per-section cadence guidance, finance data
(per-project mode, verified-only per-period figures), situation figures + previous-report table, editable scope, new checklist item types.
**One additive migration applied manually first:** `20261004100000_period_finance` (`ReportingProfile.financeDataMode`, new `PeriodFinancialSummary` table),
shipped with `rsync --relative` (migration dir + `schema.prisma` + `infra/postgres/rls.sql`), `prisma migrate deploy` as `donordesk_migrator`, then
`sudo -u postgres psql -d donordesk -f rls.sql` (RLS forced `t/t` on the new table; `donordesk_app` INSERT granted; `financeDataMode` defaults `'DISABLED'`).
DB backup before: `/opt/donordesk/backups/db-pre-20261004-report-type.dump`. Gates: typecheck + build clean, all test suites green. Verified: api/web/workers
active, `/ready` 200 (`prismaClient` ok, new fields present), worker health ok, web 200 on `127.0.0.1:3002`. Finance is **off for every project** (default
`DISABLED`) until a project's reporting profile turns it on; existing reports are unchanged. Not browser-verified yet — see `pending.md`.

**Earlier:** (previous) **Last deploy:** 2026-10-03 — `releaseId=20261003174505` (`SCOPE=api`): non-English reports no longer get the English
attribution prepended. Preceded by `20261003172259` (`SCOPE=both`): donor attribution in exactly one section, report-inputs
panel scoped and counted from entered values, blueprint titles in the report language with English `canonicalTitle`
(worker `SectionBrief.canonicalTitle`). Both verified `/ready` 200 + worker ok and in a visible browser (see Features/10
"Follow-ups done"). Three verification reports were left on production — see `pending.md`.

**Earlier same day:** `releaseId=20261003164154` (`SCOPE=web`, branch
`0009-agent-memory`). AI progress popup portalled to `document.body` so it stays
floating on screen. **Same-day series (all `deploy-fast.sh`, no further migration
after the first):** `20261003142133` report scope (`scopeJson` migration
`20261003100000_reporting_period_scope`, DB dump
`/opt/donordesk/backups/db-pre-20261003-report-scope.dump`; also bundled the
pending AI Reporter provider pacing), `20261003152523` per-type report blueprints /
optional templates / situation series, `20261003160235` blueprint titles + deterministic
activity participants table, `20261003162152` date-aware number grounding (worker) +
situation indicator scoping. Each verified by `/ready` 200, worker health ok, and a
visible-browser run on production (Activity report; Situation #1 and #2). The three
verification periods were then removed from production in one guarded transaction
(`LlmRun` and audit left intact). Features/10 "Report types & scope" and "Production
verification & fixes".

**Earlier:** (previous) **Last deploy:** 2026-10-03 — `releaseId=20261003142133` (`SCOPE=both`, branch
`0009-agent-memory`, commit `d1c649a`). **Report types & scope**: Activity /
Situation / Custom reports name what they cover (`ReportingPeriod.scopeJson`),
Semi-annual type offered, scoped writer prompts (legacy narrator + AI Reporter
`ContextPeriod.scope`), per-type checklists. Bundled the pending AI Reporter
provider pacing (`provider_limiter.py`). **One additive migration applied
manually first:** `20261003100000_reporting_period_scope` (`scopeJson TEXT NOT
NULL DEFAULT '{}'`), same `rsync --relative` + `prisma migrate deploy` as
`donordesk_migrator` procedure; DB backed up to
`/opt/donordesk/backups/db-pre-20261003-report-scope.dump`; no `rls.sql`
change. `ReportingPeriod.scopeJson` added to `REQUIRED_PRISMA_FIELDS`. Gates:
`pnpm -r typecheck` clean; domain/application/infrastructure/workers tests
pass. Verified: api/web/workers active, `/ready` 200, worker health ok. Pre-deploy
snapshot: `dd-app-pre-20261003142133.tgz`. Feature: Features/10 "Report types & scope".

**Earlier:** (previous)  2026-09-28 — `releaseId=20260928094857` (`SCOPE=both`, branch
`0009-agent-memory`, commit `9ebe213`). **DonorDesk Version 2.0 — Agent
Memory** (Feature 21): lets the AI Reporter learn tenant/donor-specific
narrative style and terminology from what reviewers change in AI-drafted
sections, gated by explicit human approval; numbers/dates/facts are never
learned (three independent guard layers — extraction-time hunk filtering,
entity-construction validation, human approval). New `AgentMemory` table +
`Organization.agentMemoryEnabled` tenant toggle; new capability
`report.manage-agent-memory`; new "AI Writing Style" Settings tab (hidden
unless both the platform flag and the capability are present). **One
additive migration applied manually first:** `20260928150000_agent_memory`
(`AgentMemory` table, `Organization.agentMemoryEnabled` column), via the
same `rsync --relative` + `prisma migrate deploy` as `donordesk_migrator`
procedure below; DB backed up beforehand to
`/opt/donordesk/backups/db-pre-20260928-agent-memory.dump`. `rls.sql`
re-applied (adds `AgentMemory` to the tenant-isolation table array) —
verified `donordesk_app` cross-tenant read (no `app.current_tenant` set)
returns zero rows. `REQUIRED_PRISMA_FIELDS` (`apps/api/src/routes/health.ts`)
extended with `Organization.agentMemoryEnabled` and
`AgentMemory.provenanceJson`. Gates: `pnpm -r typecheck` and `pnpm -r build`
clean across all 9 workspace packages; new domain/application/infrastructure
unit tests pass, no regressions on existing suites. **Shipped dark:**
`AGENT_MEMORY_ENABLED` is unset in `api.env` (platform flag off), so
generation output is byte-identical to pre-Version-2.0 behaviour for every
tenant until both the platform flag and a tenant's own
`agentMemoryEnabled` toggle are turned on. Verified post-deploy: api/web/
worker active, `/health` and `/ready` 200 (Prisma client fresh, no
`missingPrismaFields`), web root 200, no `AGENT_MEMORY_ENABLED` log line
(confirms flag-off state).

**2026-09-28, same day — platform flag turned on.** `AGENT_MEMORY_ENABLED=1`
appended to `/opt/donordesk/shared/api.env` (backed up first to
`api.env.bak-20260928-pre-agent-memory-flag`; verified the append landed
with a trailing newline per the standing `EnvironmentFile` truncation rule),
`donordesk-api` restarted. Log confirms: `"Agent Memory flag is enabled;
tenants may opt in from Settings to learn style guidance from reviewer
edits"`. `/health` and `/ready` green post-restart. **Still tenant-dark**:
`Organization.agentMemoryEnabled` defaults `false` for every tenant, so no
tenant's generation output changes until a report manager opts in from the
"AI Writing Style" Settings tab.

**Earlier:** 2026-09-28 — `releaseId=20260928095726` (`SCOPE=both`). Template extraction v2 (TOC first: heading levels from DOCX formatting / PDF font size, outline pass over the whole document, guidance per branch; larger token budgets + per-call timeout because DeepSeek's reasoning tokens had been exhausting `max_tokens`, which silently sent every extraction to the heuristic fallback) and the hierarchical report outline (4-level TOC tree in the workspace, Heading 2–5 in exports). **One additive migration applied manually first:** `20260928120000_report_section_hierarchy` (`ReportSection.level/numbering/templateSectionId`), via the same `rsync --relative` + `prisma migrate deploy` as `donordesk_migrator` procedure below; DB backed up beforehand to `/opt/donordesk/backups/db-pre-20260928-hierarchy.dump`. No `rls.sql` change. Gates: `pnpm -r typecheck` clean; domain 228, application 139, infrastructure 245, web 182. Verified: api/web/worker active, `/ready` 200 (includes the three new `ReportSection` fields), `jszip` (new direct dependency) resolves from `packages/infrastructure`. Real-model check before deploy (tenant DeepSeek, BE NOFO QPR): DOCX 9 sections + 44 sub-sections, PDF 9 + 45, every section with an AI guidance note. Existing drafts stay flat until regenerated from a re-extracted template.

**Earlier:** 2026-09-27 — `releaseId=20260927145612` (`SCOPE=api`, commit
`a3041a9`). Fixes real extraction-quality bugs found by manually reviewing a
production template on project "123" (a USAID BE NOFO QPR DOCX with no Word
heading styles, a native TOC field, cover-page bracket placeholders, and a
per-page running header baked into the body): a Word TOC hyperlink entry
("1.     6" — the title lost through dot-leader flattening) was being read
as a real section; bracket placeholders and the repeated running header were
becoming sections; a heading titled "Guide for Implementing Partners" (meta
guidance about the template) was not recognised as guidance and shown as a
narrative report section; `Table N:`/`Chart N:`-titled sections were typed
NARRATIVE instead of TABLE/CHART; and a real bug in the section re-extraction
merge (`mergeExtractedSections`'s title key collapsed any all-numeric leftover
title to the empty string, so most of a fresh extraction could be silently
dropped on merge). Added a `CHART` section type end to end (domain/contracts/
web) per the requirement to classify chart-needing sections, not just tables.
Re-extracted the live "BE NOFO" template (id `aa684241-…`) in place: section
count dropped from 106 (mostly duplicate/garbage, 84 NARRATIVE) to 59
(accurate structure, 45 NARRATIVE/10 ANNEX/2 TABLE/1 INDICATOR_TABLE/1
COMPLIANCE), both meta-guidance headings correctly excluded, verified via the
API response and a real browser session (screenshots) against production.
No migration. Pre-deploy gates green (domain 228, contracts 9, application
138, infrastructure 236 incl. new regression coverage for this exact failure
class; `pnpm -r typecheck` clean). Deploy verified: `/ready` 200, worker
health ok.

**Last deploy:** 2026-09-27 — `releaseId=20260927134429` (`SCOPE=both`,
branch `0008-log-frame`, commit `e0bf15d`). Rebuilds the Donor Template
Manager end to end (see `Features/05-Donor-Template-Manager-Plan.md`): the
report planner now carries donor instructions/questions/required
tables/hierarchy into `ReportPlanSection` — previously dropped entirely, so
this is the fix for AI drafts ignoring the donor's own template — plus a
structure-preserving DOCX/PDF/XLSX/CSV parser, LLM extraction with per-item
grounding (heuristic fallback, canonical outline always flagged, never
silent), a real template lifecycle (`EXTRACTING -> NEEDS_REVIEW ->
REVIEWED`), per-version snapshots, donor compliance rules feeding the
checklist, and a new Template Workspace UI (section tree, requirements
editor, AI-brief preview, source panel, version diff, library/clone).

**One additive migration applied manually before the code deploy**, per the
usual order (fast-deploy does not run migrations itself):
`20260927150000_donor_template_manager_v2` — adds `DonorTemplate.{requirementsJson,
status, extractionMetaJson, originalFileName, originalFileMime,
originalFileHash, isLibrary, sourceTemplateId}` and a new
`DonorTemplateVersion` table (immutable per-version section/requirements
snapshots), with a backfill of `requirementsJson` from the legacy
`requiredAnnexes` column and a `DonorTemplateVersion` row per existing
template (all 4 production templates backfilled as version-1 snapshots,
status defaulted to `REVIEWED` so in-flight reports keep generating).
Applied via `prisma migrate deploy` as `donordesk_migrator` over
`postgresql://donordesk_migrator@127.0.0.1:5432/donordesk` (trust auth,
per the standing host finding — no migrator password exists). **Caveat this
time:** the new `packages/infrastructure/prisma/` folder had to be `rsync`'d
to the host *before* running `migrate deploy` (it isn't there until a
deploy ships it) — done via `rsync -az --relative packages/infrastructure/prisma/{migrations/<dir>,schema.prisma} contabo:/opt/donordesk/app/`.
**Also caught:** `infra/postgres/rls.sql` was edited locally to add
`DonorTemplateVersion` to the tenant-isolation table list, but the file on
the host was stale (only the prisma folder had been shipped) — the first
`rls.sql` apply was a silent no-op for the new table (`relrowsecurity=f`).
Fixed by explicitly `rsync`-ing `infra/postgres/rls.sql` too before
re-applying it. **Any future migration that also touches `rls.sql` must ship
both files to the host, not just the prisma folder** — `deploy-fast.sh`
itself ships both correctly as part of its worker tar; this only bit because
the migration was applied manually, ahead of the scripted deploy.
`REQUIRED_PRISMA_FIELDS` in `apps/api/src/routes/health.ts` updated for the
new `DonorTemplate`/`DonorTemplateVersion` columns in the same commit.
Verified after the migration and again after the code deploy: RLS forced on
`DonorTemplateVersion` (`t/t`), cross-tenant query returns 0 rows under a
foreign `app.current_tenant`, 4 rows visible as admin.

Pre-deploy gates all green: `pnpm -r typecheck` clean across all 8 packages;
unit tests domain 228, contracts 9, application 138, infrastructure 234, web
178, worker pytest 127 — all passing (the two `apps/api/test/billing.test.mjs`
failures are the known local-Postgres-credentials case, confirmed present on
`HEAD~1` too, not a regression). Also verified end-to-end against a scratch
local Postgres database (full migration chain, a realistic ECHO-style Word
template through upload/parse/extract/review/approve/generate) and in a real
Chromium browser session before shipping. Deploy verified: systemd
api/web/superadmin active, `/health` `{"status":"ok"}`, `/ready` 200 with
`database: ok` and `prismaClient: ok`, worker health `{"status":"ok"}`,
public `https://donordesk.online/login` and `https://sa.donordesk.online/`
both 200. No env changes.

**Flag flip (same day, no new release):** 2026-09-27 — `REPORT_EDITOR_V2=1` set
for **all tenants** via a systemd drop-in,
`/etc/systemd/system/donordesk-web.service.d/report-editor-v2.conf`
(`[Service]\nEnvironment=REPORT_EDITOR_V2=1`), then `systemctl daemon-reload &&
systemctl restart donordesk-web`. Verified: flag present in
`/proc/<donordesk-web pid>/environ`, `donordesk-web` active, and a real EERP
report loads the new editor with **no `?editor=` query param** at all.
`?editor=classic` still reaches the old workspace. This skips P7's staged
internal-tenant → EERP-pilot → all rollout (the flag has no per-tenant
granularity, only the global env var plus the query-param override) — done
at the user's explicit request after confirming `?editor=v2` worked cleanly
against production. To roll back: delete the drop-in file, `daemon-reload`,
restart `donordesk-web`.

**Last deploy:** 2026-09-27 — `releaseId=20260927082847` (`SCOPE=both`, branch
`0008-log-frame`). Ships Phase 20 (Project Setup & Logframe/Indicator Manager
UX): wizard draft persistence, readiness score breakdown, logframe
drag-and-drop reorder/re-parent (behind `LOGFRAME_DND_ENABLED`, unset =
read-only tree, so this ships dark by default), per-update indicator
disaggregation with sum validation, indicator update history +
verification-pipeline UI, request-correction/reject routes, and
logframe-item/parent pickers on the create forms. **Two additive migrations
applied manually before the code deploy** (the fast-deploy path does not run
migrations itself — see `Fixes.md` "evidence_extracted_text" incident for why
this order matters): `20260927120000_logframe_item_sort_order`
(`LogframeItem.sortOrder Int @default(0)`) and
`20260927130000_indicator_update_disaggregation`
(`IndicatorUpdate.disaggregationJson Text @default('[]')`), both applied via
`prisma migrate deploy` as `donordesk_migrator` over
`postgresql://donordesk_migrator@127.0.0.1:5432/donordesk` — **no stored
migrator credential file was found on the host; `pg_hba.conf` has `host all
all 127.0.0.1/32 trust`, so the migrator role needs no password over that
loopback connection.** `REQUIRED_PRISMA_FIELDS` in `apps/api/src/routes/health.ts`
updated for both new columns in the same commit. Pre-deploy gates all green:
`pnpm -r typecheck` clean across all packages; unit tests domain 217,
application 129, infrastructure 229, contracts (bundled), web 175 all
passing (the `apps/api/test` billing/webhook tests fail locally only for
lack of a local Postgres — known, unrelated, not run as part of this
deploy's gate). Deploy verified: systemd api/web/workers active, `/ready`
200 with `database: ok` and `prismaClient: ok`, worker health `{"status":"ok"}`,
public `https://donordesk.online/login` 200. See
`imp/Phase20_setup_logframe.md` for the full plan and the one blocked item
(A1, project templates — not shipped, no code path reaches it).

**Last deploy:** 2026-09-27 — `releaseId=20260927062322` (`SCOPE=both`). Ships Report Editor v2 P3–P6 (statements inline, section regenerate + Ask AI, the `/inputs` page, shortcuts, responsive/a11y/dark-mode polish) — the full `REPORT-EDITOR-V2-IMPLEMENTATION-PLAN.md` build except the axe-core Playwright suite and editor usage-analytics events (both still open; see `pending.md`). Pre-deploy gates all green and matching the plan's documented counts: `pnpm -r typecheck` clean across all 8 packages; unit tests domain 205, application 121, infrastructure 229 (+1 skipped), contracts 9, web 163, worker pytest 125 — all passing (the two `apps/api/test/billing.test.mjs` failures are the known local-Postgres-credentials case, not a real regression). Deploy verified: systemd api/web/workers active, `/ready` 200, worker health `{"status":"ok"}`, and `/proc/<pid>/environ` matched `api.env`/`workers.env` with no post-restart rewrite this time. `REPORT_EDITOR_V2` is unset on the host (default off), so the new editor is reachable only via `?editor=v2` — this is intentionally P7's first rollout stage (internal tenant, by knowing the query param) before the env var is set for the EERP pilot and then everyone. No migrations.

**Earlier:** 2026-09-26 — `releaseId=20260926174726` (SCOPE=api), preceded the same evening by `20260926164318` (SCOPE=both) and `20260926171958` (SCOPE=api). These carry the EERP Q2 run fixes: cumulative-aware verifier, date/count classifier, restricted evidence withheld from the writer, indicator-semantics API + UI, the manual evidence-link UI, worker `MAX_TOKENS` 16384 default, and truncated-JSON salvage. All gates were green (`/ready` 200, worker ok). A follow-up api deploy with the worker draft retry-on-no-JSON was started but not confirmed; check `grep -c "transient, so retry once" /opt/donordesk/workers/app/ai_reporter/draft_writer.py` on the host. Host env fix: re-added `AI_REPORTER_MAX_TOKENS=16384` to `workers.env` (see `contabo-ops.md`). No migrations. See `Fixes.md` §"EERP-2026 Q2 end-to-end report run".

**Earlier the same day:** `releaseId=20260926153744` (`SCOPE=both`: report-quality v4, the Claude and Gemini providers, per-tenant provider resolution, and "tenant's own AI provider consumes no DonorDesk credits"). Green: api/web/workers/superadmin active, `/ready` 200, worker health 200, public `donordesk.online` + `sa.donordesk.online` 200, no warnings in the journals.
- Pre-installed `anthropic==1.8.0` into the host worker venv (§9a; the venv has `pip`, and `uv` is not on the host PATH).
- Env edits, with backups `*.bak.providers-20260926153736`:
  - `workers.env`: `AI_REPORTER_DRAFT_TIMEOUT_MS=90000`, `AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS=200000`, `AI_REPORTER_CONTRACT_VERSION=4`.
  - `api.env`: `AI_REPORTER_HTTP_TIMEOUT_MS=240000`, `AI_REPORTER_CONTRACT_VERSION=4`.
- No migrations.
- SuperAdmin shipped separately with a `.next` + `server.js` swap in `/opt/donordesk/app/superadmin`. BUILD_ID is `wsXef7TcybCfhFjNpzma-`; rollback is `/opt/donordesk/backups/superadmin-pre-20260926155153.tgz` or `.next.old`/`server.js.old`. `deploy-fast.sh` does NOT ship SuperAdmin.
- **Gotcha:** re-provisioning (a SuperAdmin save, or the api's boot-time re-provision) rewrote both env files ~3 s *after* the deploy restarted the services, so they ran on stale env. After any deploy, compare `/proc/<pid>/environ` with the env files, and restart again if they differ. **Also confirm `AI_REPORTER_MAX_TOKENS=16384` is still in `workers.env`.** It was lost in such a rewrite on 2026-09-26.

**Previous deploy:** 2026-09-18 — `releaseId=20260918043830` (see git history of this file).

**Older deploy:** 2026-09-01 — `releaseId=20260901160940`, ~8 min wall-clock
(96s build + **210s snapshot (foreground)** + 297s xfer + 8s restart + 10s verify).

**Host:** `vmi2954830.contaboserver.net` (`109.123.248.253`) — SSH alias `contabo`.

**Runtime tree:** `/opt/donordesk/app/` (mutable; tar-extracted in place).

This is the single source of truth for deploying. For the live-host
inventory, port map, services, db rules, and security sign-off see
[`contabo-ops.md`](contabo-ops.md). For the AI Reporter feature-flag flip
see [`imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`](imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md).

---

## 1. One-liner (the common case)

```bash
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)" scripts/deploy-fast.sh
```

That's it. The script auto-detects scope from `git diff HEAD~1`, typechecks,
builds, stages tars, snapshots the previous deploy, streams the new tars
to `/opt/donordesk/app/`, restarts the affected systemd services, and
verifies with `/health`, `/ready`, and `/v1/ai-reporter/health`. On any
gate failure it prints the rollback command and exits non-zero
(**does not auto-rollback** — see §7).

**Wall-clock for a web-only change:** ~3–4 min total (most of it is the
Next.js build, ~150s).

**Wall-clock for a full api+web change:** ~7–8 min.

If you have already built locally and just want to ship, add
`SKIP_BUILD=1 SKIP_TYPECHECK=1`. If you do not want a fresh pre-deploy
backup (dev loop), add `NO_BACKUP=1`.

---

## 2. Scope control

| `SCOPE=…` | What ships | What restarts |
|---|---|---|
| `web` (auto) | `apps/web/.next/standalone/`, `apps/web/.next/static/`, `apps/web/public/`, `apps/web/package.json` | `donordesk-web` |
| `api` (auto) | `apps/api/{dist,node_modules,package.json,tsconfig.json}` + `packages/*` + `node_modules/.pnpm/` + `apps/workers/app/` | `donordesk-api`, `donordesk-workers` |
| `both` (auto) | everything from both scopes | `donordesk-api`, `donordesk-web`, `donordesk-workers` |

Auto-detection looks at the diff vs `HEAD~1`:
- changes in `apps/web/` → at least `web`
- changes in `apps/api/`, `apps/workers/`, `apps/superadmin/`, `packages/`, `prisma/` → at least `api`
- both → `both`

Working-tree (uncommitted) changes are detected too.

---

## 3. Required gate (run BEFORE the deploy)

```bash
pnpm -r typecheck   # ~60s
pnpm -r test        # ~30s if you've already built; 2-3 min cold
```

The script re-runs both, but pre-running surfaces failures in 30s without
spending 96s on the build.

For schema changes (new migration under `packages/infrastructure/prisma/`):

```bash
# As root on the host, with migrator credentials (never in api.env):
ssh contabo 'set -a; . <migrator-env>; set +a
DATABASE_URL="$DATABASE_ADMIN_URL" \
  /opt/donordesk/app/packages/infrastructure/node_modules/.bin/prisma \
  migrate deploy \
  --schema /opt/donordesk/app/packages/infrastructure/prisma/schema.prisma

# Then RLS + grants from infra/postgres/rls.sql:
sudo -u postgres psql "$DATABASE_ADMIN_URL" --set ON_ERROR_STOP=1 \
  --file /opt/donordesk/app/packages/infrastructure/prisma/rls.sql
```

**Add the new schema column to `REQUIRED_PRISMA_FIELDS`** in
`apps/api/src/routes/health.ts` in the same PR — the `/ready` gate
blocks the deploy otherwise.

---

## 4. Live-host preflight (30 s)

```bash
ssh contabo '
  echo "=== ports ===";  ss -ltn | grep -E ":3002|:4001|:8092|:8093" || echo "MISSING"
  echo "=== disk ===";   df -h /opt | tail -1
  echo "=== mem ===";    free -m | head -2
  echo "=== api ===";    systemctl is-active donordesk-api donordesk-web donordesk-workers
  echo "=== workers ==="; curl -fsS --max-time 3 http://127.0.0.1:8092/v1/ai-reporter/health 2>/dev/null || echo "worker down"
  echo "=== /ready ==="; curl -fsS --max-time 3 http://127.0.0.1:4001/ready 2>/dev/null || echo "api not ready"
  echo "=== backups ==="; ls -1t /opt/donordesk/backups/dd-app-pre-*.tgz 2>/dev/null | head -3
'
```

**Expected output (2026-09-01):**

| Check | Healthy |
|---|---|
| ports | 3002 (web), 4001 (api), 8092 (worker) all listening on `127.0.0.1` |
| disk | `/opt` ≥ 30 GiB free |
| mem | available ≥ 4 GiB |
| api/web/workers | all `active` |
| workers `/v1/ai-reporter/health` | `{"status":"ok"}` |
| `/ready` | `{"status":"ready","checks":{"database":"ok","prismaClient":"ok"}}` |
| backups | ≥ 1 recent `dd-app-pre-*.tgz` |

If any port is missing → check `systemctl status`. If `/ready` returns 503
with `missingPrismaFields` → `prisma generate` did not run during the
last deploy; re-run it manually:

```bash
ssh contabo 'cd /opt/donordesk/app/packages/infrastructure && \
  /opt/donordesk/app/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js generate \
  --schema prisma/schema.prisma && \
  systemctl restart donordesk-api'
```

---

## 5. The deploy

```bash
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)" scripts/deploy-fast.sh
```

Add `SCOPE=web|api|both` if auto-detect misfires (e.g. only docs/ edited).
Add `SKIP_BUILD=1 SKIP_TYPECHECK=1` if you built and tested locally. Add
`NO_BACKUP=1` for tight dev loops.

**What it does (in order):**

1. **Preflight** — hostname sanitisation, scp+extract canary against
   `app/.deploy-canary/`, `@sentry/node` resolution check.
2. **Typecheck** — `pnpm -r typecheck` (~60 s; skipped with `SKIP_TYPECHECK=1`).
3. **Build** — `pnpm -r build` (~96 s for `contracts + domain + infrastructure + application + api + web`; skipped with `SKIP_BUILD=1`).
4. **Scope detection** from `git diff HEAD~1`.
5. **Stage tars** locally in `/tmp/dd-deploy-<RELEASE_ID>/`:
   - `web.tgz` ~210 MB (`.next/standalone/` + `.next/static/` + `public/` + `package.json` + `node_modules/.pnpm/`).
   - `api.tgz` ~56 KB (`apps/api/dist/`, `package.json`, `tsconfig.json`).
   - `packages.tgz` ~860 KB (`packages/{contracts,domain,application,infrastructure}/{dist,prisma,scripts}`).
   - `pnpm.tgz` ~200 MB (`node_modules/.pnpm/` virtual store).
   - `worker.tgz` ~44 KB (`apps/workers/app/` excluding `.venv/`, `__pycache__/`).
6. **Snapshot** the previous `app/` tree to `/opt/donordesk/backups/dd-app-pre-<RELEASE_ID>.tgz` (~210 s for a 250 MB tree; rotated to keep last 3). Optional with `NO_BACKUP=1`.
7. **Stream + extract** the new tars over `scp` into the live tree:
   - `web.tgz` → `/opt/donordesk/app/apps/web/.next/standalone/`
   - `packages.tgz` → `/opt/donordesk/app/`
   - `pnpm.tgz` → `/opt/donordesk/app/node_modules/.pnpm/` then `pnpm install` at `apps/api/` to regenerate the symlink farm.
   - `api.tgz` → `/opt/donordesk/app/apps/api/`
   - `worker.tgz` → `/opt/donordesk/app/apps/workers/` then rsync to `/opt/donordesk/workers/app/`.
8. **Regenerate Prisma client** against the shipped schema (the api's `@prisma/client` is in `node_modules/.pnpm/`).
9. **Restart** the affected systemd services (`donordesk-api`, `donordesk-web`, `donordesk-workers`).
10. **Verify** via SSH:
    - `systemctl is-active` for the restarted services
    - `curl /health` and `curl /ready` on the api (polls up to 60 s)
    - `curl /v1/ai-reporter/health` on the worker with the `workers.env INTERNAL_TOKEN`

On any failure, the script prints the rollback command and exits non-zero
— it does **not** auto-rollback (a 2026-08-28 lesson — auto-rollback
extracted a snapshot that itself was missing `node_modules/` and made
things worse).

---

## 6. Manual tail (when you want to see what's happening)

```bash
# On your local box (the deploy script):
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)" scripts/deploy-fast.sh 2>&1 | tee /tmp/dd-deploy.log

# In another terminal, watch the api journal:
ssh contabo 'journalctl -u donordesk-api -u donordesk-web -u donordesk-workers -f --since "5 minutes ago"'

# And probe the public URL:
curl -fsS -o /dev/null -w "HTTP:%{http_code}  time:%{time_total}s\n" https://donordesk.online/login
```

A clean deploy ends with this in the local log:

```
==> Done. releaseId=<RELEASE_ID>
```

and the api journal shows:

```
"msg":"DonorDesk API listening on :4001"
"msg":"AI Reporter flag is enabled…"   # only if AI_REPORTER_ENABLED=1
"res":{"statusCode":200}              # for the /ready probe
```

---

## 7. Rollback

The previous `app/` tree is always snapshot to
`/opt/donordesk/backups/dd-app-pre-<RELEASE_ID>.tgz` (rotated, last 3
kept). **Rollback is one command:**

```bash
ssh contabo '
  PRE=$(ls -1t /opt/donordesk/backups/dd-app-pre-*.tgz | head -1)
  echo "Rolling back to $PRE"
  rm -rf /opt/donordesk/app
  tar -xzf "$PRE" -C /opt/donordesk
  systemctl restart donordesk-api donordesk-web donordesk-workers
  sleep 3
  curl -fsS http://127.0.0.1:4001/ready
'
```

For non-emergency rollback the cleanest path is `git checkout <prev-commit>`
+ redeploy — git is the source of truth and the script will rebuild the
previous code in ~3 min.

**Application rollback does not undo database changes.** Production
migrations must remain compatible with the preceding release. If the
rollback needs a database reversal, that's a separate approval and an
expand/migrate/contract plan.

---

## 8. Speed tuning (when even 3 min is too slow)

The deploy's wall-clock breakdown on 2026-09-01:

| Step | Time | Optimisation |
|---|---:|---|
| Build (full) | 96 s | Cache the `node_modules/.pnpm/` between deploys (it already is); cache `apps/web/.next/cache/` between web builds. |
| Stage tars | 96 s | Already runs concurrently with snapshot. |
| **Snapshot** | **210 s** | **Foreground. The single biggest wall-clock contributor.** |
| Stream + extract | 297 s | Dominated by the 200 MB `pnpm.tgz` over a 2.86 MB/s link. |
| Restart | 8 s | systemd serialises restarts; could be parallelised in a future patch. |
| Verify | 10 s | Sequential health probes; minimum possible. |

**Cheap wins already in the script:**

- `SKIP_BUILD=1 SKIP_TYPECHECK=1` if you already ran them — saves 96+60 s.
- `NO_BACKUP=1` saves 210 s on a tight dev loop. **Never use in production.**
- `SCOPE=web` (web-only deploys do not ship `pnpm.tgz` or `worker.tgz`) saves ~3 min over `both`.

**Cheap wins not yet in the script (follow-up):**

- Move the snapshot to a backgrounded `nohup` so it runs concurrently with stream+extract — net win ~150 s per `both` deploy. Tracked in `pending.md`.
- SSH `ControlMaster`/`ControlPersist` for the ~6 SSH/SCP calls per deploy — saves ~10 s of connection overhead. Easy 5-line patch.
- Sparse `rsync` of `node_modules/.pnpm/` instead of full tar — saves ~120 s on a `both` deploy with no pnpm changes.

---

## 9. After-deploy token sync (do this ONCE if you restart the worker)

The api sends `X-Internal-Token` to the worker on every AI Reporter
request. The api reads it from `INTERNAL_TOKEN` in `/opt/donordesk/shared/api.env`;
the worker reads its expected value from `INTERNAL_TOKEN` in
`/opt/donordesk/shared/workers.env`. **These two are independent values
in the live env files** — the api's token was historically a copy but
drifted after the 2026-09-01 token-rotation.

If the worker returns `{"detail":"Invalid internal token"}` (HTTP 401)
when the api calls `/v1/ai-reporter/*`, the tokens have drifted. Fix:

```bash
ssh contabo '
  WORKER_TOKEN=$(grep "^INTERNAL_TOKEN=" /opt/donordesk/shared/workers.env | cut -d= -f2-)
  cp -a /opt/donordesk/shared/api.env /opt/donordesk/shared/api.env.bak.tokensync-$(date -u +%Y%m%d%H%M%S)
  sed -i "s|^INTERNAL_TOKEN=.*|INTERNAL_TOKEN=${WORKER_TOKEN}|" /opt/donordesk/shared/api.env
  systemctl restart donordesk-api
'
```

Verify:

```bash
ssh contabo '
  TOKEN=$(grep "^INTERNAL_TOKEN=" /opt/donordesk/shared/api.env | cut -d= -f2-)
  curl -fsS -H "X-Internal-Token: $TOKEN" http://127.0.0.1:8092/v1/ai-reporter/health
'
# Expected: {"status":"ok"}
```

---

## 9b. pgvector extension + HNSW index (required once, before enabling semantic evidence retrieval)

`infra/postgres/pgvector.sql` is a standalone idempotent DDL script (NOT a
Prisma migration — Prisma cannot read/write the `vector` column type), so it
is never applied automatically by `prisma migrate deploy`. It must be run by
hand once per environment before `EMBEDDING_PROVIDER`/`OPENAI_API_KEY` are
set, otherwise every `SemanticEvidenceRetriever` call fails closed to the
lexical-matching fallback (safe, but not what you configured):

```bash
ssh contabo '
  PGPASSWORD=$(grep "^DATABASE_ADMIN" /opt/donordesk/shared/api.env | ...) \
  psql -h 127.0.0.1 -U donordesk_migrator -d donordesk < /opt/donordesk/app/infra/postgres/pgvector.sql
'
```

Verify the extension and index exist:

```bash
ssh contabo "psql -h 127.0.0.1 -U donordesk_migrator -d donordesk -c \"\\dx vector\" -c \"\\di evidence_embedding_hnsw_idx\""
```

Then set `EMBEDDING_PROVIDER=openai` + `OPENAI_API_KEY` in `api.env`, restart
the api, and run `pnpm --filter @donordesk/infrastructure embedding:backfill`
once against existing evidence so historical files get embedded (new evidence
is embedded going forward automatically whenever `AI_REPORTER_ENABLED` is set).

---

## 9a. Worker Python dependency changes (needed for the 2026-09-18 donor-template release, and any future one that touches `apps/workers/requirements.txt`)

**`scripts/deploy-fast.sh` explicitly excludes `.venv/` from the worker
artifact** (§5, `worker.tgz` = `apps/workers/app/` only) — it never installs
or updates Python packages on the host. If a change adds a new entry to
`apps/workers/requirements.txt` (as the 2026-09-18 donor-template feature did:
`docxtpl` + its transitive deps `jinja2`, `docxcompose`, `babel`,
`markupsafe`, `six`), the deploy will ship code that imports the new package
**unconditionally at worker startup** (`apps/workers/app/main.py` imports
`donor_template.router` at module load, not gated by any feature flag) —
without a manual venv update first, `donordesk-workers` will crash-loop on
the very next restart, taking the AI Reporter down with it (same process).

**Before deploying a release that changes `requirements.txt`:**

```bash
ssh contabo 'cd /opt/donordesk/workers && uv pip install --python .venv/bin/python -r /opt/donordesk/app/apps/workers/requirements.txt'
# then restart to confirm before proceeding with the wider deploy
ssh contabo 'sudo systemctl restart donordesk-workers && sleep 3 && curl -fsS http://127.0.0.1:8092/v1/ai-reporter/health'
```

(`uv` was already present on the host during the 2026-09 work; if absent, the
venv predates `pip` too — see `memorybank/Fixes.md` "AI Reporter completely
non-functional on production" for how that was diagnosed. Fall back to
whatever installer the host actually has, verified read-only first.)

## 10. Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `app/release.json` shows old `releaseId` | Script aborted before writing | Re-run with `SKIP_BUILD=1 SKIP_TYPECHECK=1` — build is the most likely failing gate. |
| `/ready` returns 503 `missingPrismaFields` | Shipped schema drift from the generated client | Run `prisma generate` on the host (§4) and restart. |
| Web renders but styling is broken (unstyled HTML) | The web tar is missing `node_modules/.pnpm/` or `.next/standalone/apps/web/.next/static/` | Re-run the deploy with `SCOPE=web` (forces the web stage). |
| `ERR_MODULE_NOT_FOUND` from `apps/api/dist/server.js` | The api's `node_modules/` symlink farm was not regenerated | The api stage does `pnpm install` — if it failed, re-run with `SCOPE=api` to redo the pnpm step. |
| Worker health 401 `Invalid internal token` | api/worker `INTERNAL_TOKEN` drift | §9. |
| Web OK but api 502 | Web reached the api through OLS and got a non-2xx | Check `journalctl -u donordesk-api -n 50`; check `host=127.0.0.1` is set in api.env. |
| Build fails with `ELIFECYCLE` on `pnpm install` | Lockfile drift | `cd packages/infrastructure && pnpm install --no-frozen-lockfile` then re-run the deploy. |
| `hostname contains invalid characters` | Local hostname has odd chars; gzip embeds it | The script sanitises and sets `GZIP=-n`. If you still see it, set `HOSTNAME=donordesk-deploy` in your shell. |
| `donordesk-workers` crash-loops after a deploy that touched `requirements.txt` | New Python dependency not installed — the deploy script never touches `.venv/` | §9a — install the new dependency into the host venv, then restart, before assuming the deploy itself is broken. |