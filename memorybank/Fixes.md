# Fixes

Record of fixes applied to DonorDesk. Last updated: 2026-08-17.

## Readiness percentages wrong (evidence/approval) + Home/dashboard readiness snapshot + consolidated Settings nav (2026-08-17)

**Status:** Deployed and verified on Contabo production 2026-08-17 (release `20260817174622`, commit `8a849ec`). Preflight clean, incremental deploy (API + web), `verify.sh` green (API `/health` + `/ready` 200, web 200, workers 200, Kestra configs 200), public HTTPS checks green (`/`, `/login` 200; `/dashboard`, `/settings` 200 behind auth).

### 1. Reporting-period readiness list returned a stale stored score (always 0)

`ReportingPeriod.readinessScore` was initialized to `0` at creation and
`setReadinessScore` was never called anywhere, so every list that read the stored
value reported 0%: the project **Reports** tab, the cross-project **Reports**
page, the Home **Readiness snapshot**, the **Deadline overview** "X% ready", and
the recent-project readiness. Fix: `ListReportingPeriodsHandler` now computes
readiness **live** per period by delegating to `CalculateReadinessHandler`
(injected at container wiring), so lists always reflect current sections,
indicators, evidence, checklist, and approval state.

### 2. Evidence "required" count was a fabricated heuristic

`CalculateReadinessHandler` set `requiredEvidenceCount = max(1,
round(checklistItems × 1.5))`, so the **Evidence attached** percentage swung
with unrelated checklist size (and hit 100% with a single file when the checklist
was empty). Fix: the required count is now derived from the donor template's
`requiredAnnexes` (authoritative), falling back to a baseline of 1 before a
template is attached. The handler now loads the period + template repos.

### 3. Approval score was binary until final approval

`approvalScore` was `100` only when the whole draft was
APPROVED/EXPORTED/SUBMITTED and `0` otherwise — a report sitting **Under review**
showed 0% approval. Fix: `readiness-calculator.ts` now accepts `approvalProgress`
(0–100): no draft = 0, `UNDER_REVIEW` = 50, APPROVED/EXPORTED/SUBMITTED = 100.

### 4. Home page: Deadline overview placement

**Deadline overview** section moved to render directly under the four top Count
cards (was below My Work / Readiness snapshot).

### 5. Left navigation: Setup, Settings, and Audit log consolidated into one item

The three separate left-nav entries (`Setup` → `/onboarding`, `Audit log` →
`/audit`, `Settings` → `/settings`) are now a single **Settings** item
(`/settings`, shown when the user has any of `project.create`, `audit.view`,
`settings.view`, `org.manage`). The `/settings` route group gained a layout that
renders tabs: **Setup** (`/settings/setup`), **Settings** (`/settings`), **Audit
log** (`/settings/audit`). The setup overview was extracted into a shared
`SetupOverview` component (reused by `/onboarding`, which remains the consent-gate
entry), and the audit log content into `AuditLogPageContent` (reused by `/audit`).
The dashboard "Workspace setup" card link was repaired from the nonexistent
`/setup` to `/settings/setup`.

Verification: `pnpm -r typecheck` + `pnpm -r build` pass across
domain/application/infrastructure/api/web; domain (74) and application (64)
tests pass. Playwright e2e not run (no browser binaries / local Postgres server
in this environment).

## AI report generation ignored evidence content and activity/indicator narratives (2026-08-17)

**Status:** Fixed; typecheck + build + tests green (74 infra tests pass, 32 workers tests pass). Not yet deployed to Contabo.

Deep audit of the AI report draft pipeline found that generated reports effectively
ignored the project's saved Evidence and Activities:

1. **Real evidence document text never reached the generator.**
   `EvidencePackageBuilder` fed the generator `aiSummary || title`, but `aiSummary`
   was only a stub classification sentence — not document content. The Kestra
   `evidence_parse` flow extracted real text via Tika but **discarded it** after
   tagging; the `EvidenceChunk` table existed but nothing ever wrote to it.
   Fix: `EvidenceFile.extractedText` column added (migration
   `20260817200000_evidence_extracted_text`), persisted by `POST
   /internal/evidence/:id/tags` (`PersistEvidenceTagsInput.extractedText` +
   `PersistTagsBodySchema.extractedText`), and the Kestra `evidence_parse.yml` flow
   now sends the Tika-extracted text in the persist body. `EvidencePackageBuilder`
   now chunks `extractedText || aiSummary || title`, so real document content reaches
   the LLM/stub.
2. **Activity narratives never reached the generator.** The handler harvested only
   `attachedEvidenceIds`; `summary`, `achievements`, `challenges`, `lessonsLearned`,
   `nextSteps` were never passed to the narrator (stub challenges/lessons sections
   were hardcoded placeholders).
   Fix: `GenerateReportDraftInput` now carries `activities` (full narrative +
   participants + linked evidence) and `indicatorUpdates` (raw achievements,
   `comments`, `dataSource`, linked evidence). `GenerateReportDraftHandler` builds
   both from the period's repos. Stub generator narrates activity records,
   achievements, challenges, and lessons verbatim with `activity` source references;
   LLM prompt gains `# Activity Records` and `# Indicator Updates` sections.
3. **No evidence citations in generated sections.** Stub numeric claims carried
   `proposedSources: []`; the LLM prompt truncated evidence chunks to 300 chars and
   didn't require citations.
   Fix: stub claims now attach evidence chunks from each indicator/activity's linked
   evidence; the LLM prompt raises chunk slices to 600 chars (first 3 chunks) and
   mandates `sourceReferences` per section. The report workspace now renders
   statement-level sources (claims with evidence chips + verification status)
   instead of the "paragraph-level provenance not available yet" note.
4. **Indicator update comments/dataSource were omitted.** Now passed through the
   generation input and surfaced in the indicator section notes.
5. `ReportGenerationRun` snapshot now records `activityIds` for reproducibility.
6. Python workers `drafting.py` mirror updated to narrate activity
   achievements/challenges/lessons (tests pass).

Migration `20260817200000_evidence_extracted_text` must be applied on deploy.
Existing evidence rows have no `extractedText` until the Kestra parse flow re-runs
for them (or the file is re-uploaded).

## AI credit burn on stub fallback + timeout + section-switch (release `20260817171900`)

**Status:** Deployed and verified on Contabo production 2026-08-17.

1. **Credits consumed for stub output.** MiniMax timed out on the oversized
   8192-token report prompt; `LlmReportDraftGenerator` silently returned stub
   sections while `GenerateReportDraftHandler` recorded `status=success` +
   `billableUnits=1` + `modelId=minimax`. Five timeouts = five consumed credits
   → STARTER quota locked with "AI draft credits exhausted" while drafts held
   only stub text. Fix: `generateDraft` now returns `{ sections, usedFallback }`;
   a stub-fallback draft releases the reserved credit, records an error run
   (never billed), and marks the draft `generatedByAi=false`. `maxTokens` reduced
   to 4096 (verified MiniMax completes the full prompt in ~38s). Mislabeled prod
   runs re-marked `error`/`billableUnits=0`; the `AI_DRAFT_CREDITS` counter was
   reset to 0. See `imp/LLM-PROVIDER-WIRING.md` §14.
2. **P2002 on concurrent regeneration.** ReportPlan version allocation moved to
   `createNextVersion` (P2002 retry loop) so two regenerations cannot collide on
   the same `(tenantId, reportingPeriodId, version)`.
3. **Timeout surfaces.** Web gateway default 15s → 180s for generate-draft;
   MiniMax adapter 60s → 120s; OLS vhost `initTimeout` 60 → 180 (validated and
   reloaded). See `contabo-ops.md` §14.
4. **Section switch showed stale content.** `SectionEditor` was not remounted on
   section change (`key={selected.id}` added) — clicking a section kept the first
   section's text and could have saved it to the wrong section.

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
