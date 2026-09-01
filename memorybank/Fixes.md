# Fixes

Record of fixes applied to DonorDesk. Last updated: 2026-08-30.

## Product recovery — writer ↔ verifier ↔ human-review boundary (2026-08-30, release `20260829160000`)

**Status:** Implemented and deployed to donordesk.online.

The end-to-end user audit found the AI report workflow generated hundreds of
unsupported-claim checklist items, approval gates blocked without explanation,
and the UI leaked internal assurance terminology. Full record:
`memorybank/imp/RECOVERY-PLAN-IMPLEMENTATION.md`.

**Root causes (code-traced):**
1. `extractNumericAtoms` (`packages/domain/src/contexts/reporting/numeric-atom.ts`)
   used `/-?\d+(?:\.\d+)?/g`: "3,251" became atoms `3,251,4,215`; "(OUT-1)"
   became atom `-1`. Any unbound atom failed the whole sentence.
2. The narrator prompt (`llm-report-draft-generator.ts`) encouraged
   derived percentages + indicator codes and its worked example demonstrated the
   exact pattern the verifier rejects.
3. Percentage findings compute to `0`/`MISSING_DENOMINATOR` when no denominator
   indicator is configured — claims about them can never verify, and nothing
   warned the user at data entry.
4. `checklist-projector.ts` deduped only against OPEN/IN_PROGRESS items, so
   resolved items were recreated after edits/regenerations.
5. Approval blockers surfaced only as a generic error line; claim resolution
   lived only in the export wizard; every regeneration created a new draft with
   no cleanup; the Evidence readiness score ignored evidence attached to
   indicator/activity updates.

**Fixes shipped:**
- Parser: thousands separators, digits embedded in codes ignored, ambiguous
  tokens rejected, standalone negatives preserved.
- Writer: temporary "Number discipline" rules (quote only finding values; never
  derive percentages / quote targets / substitute NOT_CALCULABLE values) +
  verifier-safe worked example; relaxed again in P1-2 once the verifier became
  tolerant.
- Verifier: target/baseline figures accepted as references only alongside a
  bound value; derived percentages accept 1-/2-decimal rounding; human-readable
  expected/actual failure detail.
- Projector: idempotent against ALL period items (open or resolved).
- Workspace: per-statement Accept-with-note / Exclude; Review / Preview /
  Versions tabs; actionable approval blockers; "What to do next" panel;
  per-section "drafted without AI" banner; generation ETA + Stop button.
- Draft lifecycle: `ReportDraft.supersededAt` (migration
  `20260829140000_report_draft_superseded`) + Versions archive + activate +
  cancel-generation.
- Evidence: `POST /v1/evidence/:id/period` + library picker; readiness Evidence
  score = union of period-linked evidence.
- Percentage guard in the indicator grid.

**Verification:** `pnpm -r typecheck` + `pnpm -r build` green; domain 96/96,
infrastructure 143 pass / 0 fail; `reporting:eval` exit 0. Live: `/ready` 200
(prisma client check includes `ReportDraft.supersededAt`), all services active,
workspace + evidence features verified in-browser.

**Deploy-script fixes surfaced by this release** (see `contabo-ops.md`):
`BASE` unbound in the snapshot step (now defaults to `REMOTE_BASE`) and the web
standalone extract path (now `apps/web/.next/standalone/`, matching the systemd
unit).

## `donordesk-api` silently down for ~7 days (2026-08-28)

**Status:** Restarted; root cause (supervision gap) still open — see `pending.md`.

`donordesk-api.service` had been `inactive (dead)` since 2026-08-21 06:34 CEST
with no automatic recovery. It exited cleanly (`status=0/SUCCESS`), so the
unit's `Restart=on-failure` did not restart it (that policy only fires on
non-zero exits). All API routes on `donordesk.online/api/*` returned 503 while
the web kept serving.

**Fix applied:** `systemctl restart donordesk-api`. Confirmed active; `/health`
returns `{"status":"ok"}` and `/ready` returns `{"status":"ready","checks":{"database":"ok"}}`.

**Remaining risk:** a clean exit will not self-heal. A watchdog (curl-based
systemd timer or external monitor) is recommended.

## AI reports were fluent but unsupported and provider failures were opaque (2026-08-20)

**Status:** Deployed in API releases `20260820164344` and `20260820170209`
(no migration).

Production evidence showed 14/22 report runs failed and only 3/115 claims in
the latest fluent demo report passed assurance. Report-level telemetry had zero
tokens and could not identify the failing section. Missing-denominator values
were narrated as real zeroes, evidence selection used the first four files,
and the prompt allowed the model to fill empty challenge/work-plan inputs with
plausible but unsupported prose.

The existing path now sends MiniMax Text-01 its supported JSON schema, records
real non-billable per-section usage and parse diagnostics in `LlmRun`, exposes
missing denominators as not calculable, ranks evidence using direct links and
section needs, and uses prompt v2 to prohibit invented causes, mitigations,
lessons and future plans. The report-level `REPORT_DRAFT` row remains the only
billing unit.

The follow-up release adds a production input-sufficiency gate. Sections that
require activity records, challenges, lessons, or approved next steps no longer
call the provider when those inputs are absent. They render explicit missing-data
notices and record a non-billable `REPORT_SECTION` run with status `skipped` and
parse outcome `INSUFFICIENT_INPUT`. It also fixes the deterministic Activities
section title match (`Activities` previously missed the singular `activity`
branch).

Production acceptance run `b8ab5fb9-2520-4f47-a113-99635ea0512c` generated
draft `e27e3e37-4f05-4b1f-84b1-5fad3ab21d46`: four unsupported sections were
guarded in 0–2 ms and only five provider calls were made. All five provider
calls returned, but three exhausted the 4,096-token output limit and required
parser recovery. Assurance remained unacceptable at 5 passed / 119 failed.
MiniMax still invented values for indicators explicitly marked not calculable
(for example 78% and 62%), while the verifier also classified many supplied
numeric values as `VALUE_MISMATCH`. This is a visible safety improvement, not
final quality acceptance. Next: use deterministic output for indicator tables
and annexes, reduce context/output size for narrative sections, and repair
numeric assurance matching before further prompt tuning.

## AI content disappeared — MiniMax literal control chars + maxTokens truncation broke JSON parsing (2026-08-20)

**Status:** Fixed (code + tests; release `2026082015xxxx` deployed).

**Symptom:** after the parser-hardening release (`20260820141254`), every
section fell back to the stub again — reports showed only indicator lists
("recorded via SUM:neutral:period … Source: Field reports…"), and even the stub
reported "0 activity records, 0 evidence files".

**Root cause (TWO independent parser breakers, both from MiniMax):**

1. **Literal unescaped control chars inside JSON string values.** MiniMax emits
   a real `\n`/`\t`/`\r` inside the `content` field (common for markdown-heavy
   sections). Strict `JSON.parse` throws on raw control chars in strings, so
   every response was rejected. Fixed by `repairUnescapedControlChars()`.
2. **maxTokens truncation.** Sections that contain a markdown table (Progress
   Against Indicators, Annex A) plus narrative plus claims plus references
   exceed the 1500-token output budget, so MiniMax returns a **truncated JSON
   PREFIX** — cut mid-string and with unclosed braces. Strict parse, balanced
   extraction, and control-char repair all return null on truncated JSON.
   Short sections (e.g. Executive Summary) succeeded; table sections fell back
   to the stub — producing a **partially-AI draft** (first section AI, rest
   stub). Fixed by `completeTruncatedJson()` (closes unclosed strings +
   structures and retries) and raising `generateSection` `maxTokens` 1500 →
   4096 (matches the proven full-draft budget).

**Fix summary:**
- `repairUnescapedControlChars()` — escapes raw `0x00-0x1F` chars inside JSON
  strings as `\uXXXX` (string-literal-aware scanner).
- `completeTruncatedJson()` — tracks string/escape state and an open-structure
  stack; when the input ends mid-string or with unclosed `{`/`[`, appends the
  missing closing characters and retries parse.
- `tryParseSections` pipeline: strict → control-char repair → truncation
  completion → stub. `parseRewrite` uses the same control-char repair.
- `generateSection` `maxTokens` 1500 → 4096.
- Four new parser tests (literal newlines; tabs+CR; truncated mid-structure;
  truncated mid-string). 116 infra tests pass.
- **Scope: the fix covers the WHOLE report.** `generateSection` is called for
  every plan section by the background loop, and `generateDraft` (full report)
  uses the same `parseSections`. No section is special-cased.

**Also fixed — demo data had no evidence linkage:** the EERP seed created 15
evidence files but never linked them to activities or indicator updates, so the
evidence packages handed to the narrator (stub and LLM) were always empty and
reports read "0 evidence files". Added `linkEvidenceToActivitiesAndUpdates()`
to `seed-eerp-evidence-activities.ts` (title-keyword linkage) and applied a
standalone `link-eerp-evidence.ts` to production (linked 15 activities + 20
indicator updates). Note: the monthly period `5dce445a` genuinely has no
activity records (only Q1/Q2 periods do), so "0 activity records" there is
correct data, not a bug.

**Lesson for the future (do not regress):**
- NEVER treat an unparseable JSON-looking response as narrative prose, and
  NEVER accept that a response "failed validation" until a control-character
  repair pass AND a truncation-completion pass have been attempted. MiniMax
  returns literal newlines inside JSON strings and truncates long outputs at
  the token budget — this has now broken generation four separate times (see
  `Features/11-AI-Report-Draft-Generator.md` for the history).
- NEVER set `maxTokens` below the largest realistic section output (tables +
  claims + references). 1500 was too low; 4096 matches the proven full-draft
  budget.
- Any demo seed that creates evidence MUST link it to activities/indicator
  updates, or reports silently lose evidence context.

See `Features/11-AI-Report-Draft-Generator.md` (Section-wise hardening,
2026-08-20) and `contabo-ops.md` §29.

## Section-wise AI generation: raw JSON stored as content + 113–142s per section (2026-08-20)

**Status:** Fixed (code + tests, in source; deploy pending).

Two defects surfaced after the section-wise generation release
(`20260820125717`):

**Defect 1 — raw JSON blob stored as section content ("garbage").**
`parseSections` (`llm-report-draft-generator.ts`) fell into
`fallbackAsNarrative` whenever `JSON.parse` threw, so a MiniMax response that
wrapped the JSON (prose preamble, trailing text, or a fence with surrounding
text) caused the **entire `{"sections":[...]}` blob to be stored as a section's
`content`**. Production rows literally begin `{` + `"sections": [`.

**Defect 2 — 113–142s per section.** `buildSectionNarratorUserPrompt` dumped
the **entire** report plan, all findings, all indicator updates, all 15 activity
narratives, and all 15 evidence packages (8 chunks × 800 chars each ≈ 100K
chars) into **every** section call, so each section took ~2 minutes.

**Fix:**
- `parseSections` rewritten to: strip fences anywhere; strict-parse first;
  detect a `"sections"` wrapper anywhere in the response and run a
  balanced-brace JSON extractor (prose-wrapped / fenced-with-preamble
  responses now parse); and — critically — **never** fall back to narrative
  for anything JSON-like (returns `null` → stub fallback). Only genuine prose
  still becomes a narrative section.
- Post-parse guard `looksLikeRawJson()`: `generateDraft`/`generateSection`
  reject a parsed section whose content still starts with a JSON object, so a
  malformed capture can never be persisted as report content.
- Per-section prompt slimmed: evidence capped to 4 packages × 4 chunks × 400
  chars, activities to 6 with 250-char fields, the full `# Report Plan` dump
  removed, and `maxTokens` reduced 2048 → 1500. Sections now carry only a
  bounded, relevant context slice.
- New tests: prose-wrapped JSON extraction, fenced-with-surrounding-text,
  truncated-JSON → `null`, and raw-JSON-never-narrative.

See `Features/11-AI-Report-Draft-Generator.md` (Section-wise generation,
2026-08-20) and `contabo-ops.md` §29.

## Generate AI draft timed out / "No report draft yet" — full-report LLM call raced the web timeout (2026-08-20)

**Status:** Fixed (code, in source; deploy pending).

**Root cause:** `GenerateReportDraftHandler` drafted the WHOLE report in one LLM
call (`generateDraft`, `maxTokens=4096`) while MiniMax has a **180s adapter
timeout** (`factory.ts` MiniMax default) and the web server action also used a
**180s gateway timeout** (`generateDraftAction`). For data-heavy demo projects
the single call ran the full 180s, so the API aborted MiniMax, fell back to the
stub, and saved a draft — but the browser had already given up at the same 180s
mark, so the user saw "No report draft yet / The request timed out. Please try
again." even though a stub draft existed server-side.

**Fix — section-wise generation (2026-08-20):**
- `POST /generate-draft` is now two-phase: it creates the draft + **all plan
  sections as `NOT_STARTED` placeholders** and returns immediately
  (`generating: true`); a background loop drafts each section in its own small
  LLM call (`IReportDraftGenerator.generateSection`, `maxTokens=2048`, well
  within the 180s timeout), committing + assessing each as it completes.
- The web `generateDraftAction` timeout dropped 180s → 60s (only the skeleton
  creation is awaited); the UI polls `getReportDraftAction` every 4s and flips
  sections greyed→normal as they complete.
- Resume-safe: the loop skips already-`DRAFTED` sections, so a re-click or API
  restart only regenerates the remaining `NOT_STARTED` ones.
- Credit/run accounting: the AI credit is reserved in phase 1 and reconciled at
  loop completion (real AI draft = no section fell back → credit consumed;
  otherwise released + `generatedByAi=false` + error run).
- See `Features/11-AI-Report-Draft-Generator.md` (Section-wise generation,
  2026-08-20).

## Seeded USAID demo template "Section title required" — wrong `sectionsJson` field names (2026-08-20)

**Status:** Fixed in production (direct DB correction; no release required).

**Root cause:** The demo seed for the **Emergency Education Response Programme**
(`packages/infrastructure/src/db/seed-eerp.ts`) persisted the donor template's
`DonorTemplate.sectionsJson` using the spec's UI-facing names
(`sectionTitle`, `sectionDescription`, `inputNeeded`) instead of the domain
`TemplateSection` shape that `PrismaDonorTemplateRepository.toDomain`
(`packages/infrastructure/src/repositories/templates.ts`) expects. Every section
therefore lacked `title`, and `createSection()` in
`packages/domain/src/contexts/templates/template-section.ts` threw
`DomainError.validation("Section title required")`. The Project → **Donor
Templates** page failed with "This information could not be loaded" — any read
of the template's sections threw.

**Fix:** Rewrote the seeded template's `sectionsJson` to the canonical persisted
shape — every section carries `title`, `description`, `inputType`
(`NARRATIVE`/`TABLE`/`INDICATOR_TABLE`/`ANNEX`/`COMPLIANCE`), `required`,
`evidenceNeeded`, `order`, `reviewStatus` (`DRAFT`/`REVIEWED`), and optional
`minWords`/`maxWords`. The seed script was corrected so future runs persist the
right shape.

**Process note:** Do not mirror the MVP spec's `ExtractedTemplateSection` fields
into `sectionsJson` — the canonical persisted shape is `TemplateSection`
(`title`, `description`, `inputType`, `evidenceNeeded`, `required`,
`reviewStatus`, `order`). See `Features/05-Donor-Template-Manager.md`.

## Reports tab 500 "Invalid ReportStatus: COMPLETED" — invalid persisted period status (2026-08-20)

**Status:** Fixed in production (direct DB correction; no release required).

**Root cause:** The demo seed created the Q1 2026 reporting period with
`status = 'COMPLETED'`, which is **not** a valid `ReportStatus` value.
`ReportStatus.create` (`packages/domain/src/value-objects/report-status.ts`)
only accepts `NOT_STARTED`, `IN_PROGRESS`, `EVIDENCE_COLLECTION`,
`DRAFT_GENERATED`, `UNDER_REVIEW`, `APPROVED`, `SUBMITTED`, `CLOSED`.
`PrismaReportingPeriodRepository.toDomain` throws, so
`GET /v1/projects/:projectId/reporting-periods` returned 500 and the project
**Reports** tab showed "Internal Server Error" (journal: `Invalid ReportStatus:
COMPLETED`).

**Fix:** Updated the Q1 period row to `SUBMITTED` (a valid terminal status);
`seed-eerp-evidence-activities.ts` now writes `SUBMITTED`.

## "Project setup is not complete — WORKSPACE_PENDING" blocked reporting-period creation (2026-08-20)

**Status:** Fixed in production (direct DB correction; no release required).

**Root cause:** `ProjectReadinessService.compute`
(`packages/application/src/readiness/project-readiness-service.ts`) derives the
workspace provision status from `ProjectSetup.workspaceProvisionStatus`, defaulting
to `PENDING` when no `ProjectSetup` row exists **and** the organization's
`storageProvider` is `GOOGLE_DRIVE`. The GEC tenant
(`mnpiracha@gmail.com`, tenant `faed0177-5f2d-4a42-864f-e4c254e6d247`) is a Drive
tenant and the seeded project had no `ProjectSetup` row, so readiness reported
`WORKSPACE_PENDING` and `CreateReportingPeriodHandler` denied period creation.
Two further readiness blockers were also present: no `ReportingProfile`
(`REPORTING_PROFILE_MISSING`) and template sections not marked `REVIEWED`
(`TEMPLATE_HAS_NO_REVIEWED_REQUIRED_SECTIONS`).

**Fix:** For the EERP-2026 project, created/updated:
- `ProjectSetup` → `workspaceProvisionStatus = READY` (+ `acknowledgedAt`).
- `ReportingProfile` → `defaultTemplateId` = the USAID template,
  `language = en`, `tone = FORMAL`.
- USAID template `sectionsJson` → all 9 sections `reviewStatus = REVIEWED`.

`seed-eerp-evidence-activities.ts` now creates `ProjectSetup` + `ReportingProfile`
automatically, and `seed-eerp.ts` writes `REVIEWED` sections. All 20 indicators
were confirmed reportable (baseline/target/unit/frequency present).

**Process note:** directly-seeded demo projects must include a ready
`ProjectSetup`, a `ReportingProfile` (ideally with `defaultTemplateId`), and a
template with `REVIEWED` required sections, otherwise the reporting-period gate
stays closed. See `Features/18-Project-Creation-Wizard.md`.

## Numeric-atom currency regex matched "rs" inside ordinary words — false CURRENCY roles (2026-08-19)

**Status:** Fixed in release `20260819090000` (professional donor-reporting hardening).

**Root cause:** `classifyNumericAtomRoles` used `/(usd|eur|gbp|kes|uzs|afn|npr|rs|$|€|£)/i`
to detect currency. The bare `rs` alternative matched substrings inside ordinary
words (e.g. the "rs" in "period"), so a claim like "99 people were reached in
this period" was misclassified as a CURRENCY atom and failed with
`DERIVATION_INVALID` instead of `VALUE_MISMATCH`.

**Fix:** currency codes now require word boundaries
(`/\b(usd|eur|gbp|kes|uzs|afn|npr|rwh|rwf|pkr)\b|\$|€|£/i`). See
`packages/domain/src/contexts/reporting/numeric-atom.ts`.

## Evidence-integrity verifier short-circuited before the confidentiality check (2026-08-19)

**Status:** Fixed in release `20260819090000`.

**Root cause:** the deterministic integrity verifier `continue`d a source as soon
as it found a `SOURCE_TEXT_MISMATCH`, so a source that was BOTH text-mismatched
AND confidential never emitted `CONFIDENTIALITY_RESTRICTED`. Confidentiality
therefore could not be enforced independently of relevance.

**Fix:** integrity reasons now accumulate per source instead of short-circuiting;
a source can carry `SOURCE_TEXT_MISMATCH` + `CONFIDENTIALITY_RESTRICTED`
together. See `packages/infrastructure/src/llm/evidence-integrity-verifier.ts`.

## Reporting eval `assertion-recall` metric masked real matches by trailing punctuation (2026-08-19)

**Status:** Fixed in release `20260819090000`.

**Root cause:** `ReportDraftEvaluator` split drafts on `[.!?]+\s+` (dropping the
sentence's trailing period) but fingerprinted reference assertions including
their trailing period, so recall was always ~0 for period-terminated sentences.

**Fix:** recall now compares punctuation-stripped, normalized sentence keys.
Also, a missing required limitation or a missed numeric fact is a hard failure
(it can no longer be averaged away by the aggregate score). See
`packages/infrastructure/src/ai/reporting-eval.ts`.

## AI report generation could not narrate period-over-period change — previous-period value was computed then dropped (2026-08-18)

**Status:** Fixed in release `20260818074405` (deployed, API + web).

**Root cause:** `IndicatorAnalyticsService.computeFindings` computed the
previous-period finding and passed its value to `computeIndicator` as
`comparisonPeriodFindingValue`, but `computeIndicator` only stored
`comparisonPeriodId` in the resulting `VerifiedFinding` — the numeric value was
silently discarded. The narrator therefore had no way to write "increased from
500 to 850 since the previous period," and AI drafts could only report the
current value in isolation.

**Fix:** `computeIndicator` now emits `comparisonValue:
input.comparisonPeriodFindingValue` into every `VerifiedFinding`. The narrator
prompt instructs period-on-period narration when a `comparisonValue` is present
(e.g. "up from 500 in the previous period"), and the stub generator renders the
previous-period value in its indicator tables and summaries. As part of the same
release, `VerifiedFinding` also gained optional `indicatorName`, `indicatorType`,
`baseline`, `target`, resolved `semantics`, and a deterministic
`performanceEvaluation` (POSITIVE/NEGATIVE/NEUTRAL gated by `evaluatePerformance`)
so reports can describe progress against targets with evaluative wording only
where semantics permit. See `Features/20-report-gen.md` §17 and
`Features/11-AI-Report-Draft-Generator.md`.

## Flaky phase4-security test — tampered donor-portal token could equal the original (2026-08-18)

**Status:** Fixed (test-only, included in release `20260818074405`).

**Root cause:** the "donor portal tokens are tenant-bound and tamper evident"
test replaced the token's **last character** with `"0"` and asserted the result
was invalid. The token ends in the last hex character of the 64-char HMAC-SHA256
signature, which is `"0"` roughly 1/16 of the time — then the "tampered" token
was byte-identical to the original and the assertion intermittently failed
(`true !== false`), breaking the release gate.

**Fix:** the test now flips the signature's **first** hex character deterministically
(`0`↔`1`), guaranteeing a different signature, so the HMAC mismatch check always
exercises what it intends. Ran 5/5 clean after the fix.

## Creem webhook could not resolve the tenant for a brand-new subscription (2026-08-18)

**Status:** Fixed in release `20260818053116` (deployed).

**Root cause:** the webhook processor resolved the tenant only by looking up an
existing local `BillingSubscription` row for `providerSubscriptionId`. For the
*first* event of a brand-new subscription (e.g. `subscription.paid` right after
checkout), no local row exists yet, so the processor returned "Webhook
references an unknown customer/subscription." and the new grant was never
created.

**Fix:** `ProcessBillingWebhookHandler.resolveTenant` now resolves the tenant
from the trusted checkout `metadata.tenant_id` first (recorded server-side at
checkout creation), falling back to the local subscription mapping. Both the
Creem and stub adapters now parse `object.metadata` into
`ProviderBillingEvent.metadata` (string/number/boolean values only).

## Latent subscription-end grant failed domain validation (effectiveFrom == effectiveUntil) (2026-08-18)

**Status:** Fixed in release `20260818053116` (deployed).

**Root cause:** `BillingSubscriptionSynchronizer` terminated an open grant when a
subscription stopped granting access (cancelled/expired) by creating a new
`EntitlementGrant` with `effectiveFrom: now, effectiveUntil: now`. The domain
requires `effectiveUntil` strictly after `effectiveFrom`, so this threw a
validation error on that path.

**Fix:** the termination window is now `[now - 1ms, now]` — it keeps the domain
invariant while remaining immediately expired for `isEffectiveAt`.

## Playwright "projects portfolio renders a search form and table header" strict-mode failure (2026-08-18)

**Status:** Fixed (test-only, included in release `20260818061120`).

**Root cause:** the `/projects` page has both a "Search workspace" link
(`aria-label="Search workspace"`) and the search input (placeholder "Title,
code, donor, country"), so `getByLabel("Search")` resolved to two elements and
Playwright strict mode failed the test.

**Fix:** the test now targets `getByPlaceholder("Title, code, donor, country")`.

## 14-day trial references removed product-wide (2026-08-18)

**Status:** Shipped in release `20260818061120` (deployed).

Per product decision ("we already have free Starter tier"), the 14-day trial
offer was removed across the stack:

- `ProvisionTenantHandler` no longer grants trials — every new workspace starts
  on the free STARTER tier (`trialGranted: false`, single `DEFAULT` grant).
- Catalog `trialDays` nulled for Team/Growth; `isPlanForTrial` always `false`.
- Pricing page, signup plan options, and the billing settings panel no longer
  mention trials (the billing-panel trial banner was removed).
- `TrialIdentity` table/repository and `ExpireLocalTrialsHandler` remain dormant
  for any legacy trial grants.


## Production 500 on project Evidence / Reports / Compliance tabs — unapplied `evidence_extracted_text` migration (2026-08-17)

**Status:** Fixed and verified in production 2026-08-17.

The project Evidence, Reports, and Compliance tabs returned "Internal Server
Error" / "This information could not be loaded. Please try again" after release
`20260817174622` went live.

**Root cause:** The release bundled code that references
`EvidenceFile.extractedText` (from the earlier committed-but-never-deployed
`feat(reporting): reflect evidence…` work), but migration
`20260817200000_evidence_extracted_text` had **not** been applied to the
production database. Every path that touched the evidence table or computed
readiness (which searches evidence) threw `PrismaClientKnownRequestError`
`P2022` — `The column EvidenceFile.extractedText does not exist`:

- **Evidence tab** → `POST /v1/evidence/search` → `PrismaEvidenceRepository.search`
- **Compliance tab** → `/v1/reporting-periods/:id/readiness` → readiness evidence search
- **Reports tab** → `/v1/projects/:id/reporting-periods` → live readiness → readiness evidence search

**Fix:** Ran the bundled `prisma migrate deploy` as `donordesk_migrator`
(`DATABASE_ADMIN_URL`) from `/opt/donordesk/current`, applying
`20260817200000_evidence_extracted_text` (adds nullable `EvidenceFile.extractedText`
TEXT). Verified the column exists, RLS remains enforced on `EvidenceFile`
(`t/t`), and zero API 500s since the fix.

**Process note:** the fast-deploy path deliberately does not run migrations;
the deploy runbook requires running `prisma migrate deploy` before activation.
This release introduced an unapplied migration (carried in from an unreleased
commit) and it was missed — check `prisma/migrations` for unapplied entries
before every release.

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
  (Deployment blocker listed in `contabo-ops.md` §19 release gate.)
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

## AI Reporter 2 deploy — api tree layout + pnpm symlink regression (2026-08-29)

The 2026-08-29 release `20260828200000` shipped AI Reporter 2 (typed
artifacts, deterministic validators, per-section fallback, 25-case
eval). Three intertwined issues surfaced during the first deploy attempt
that were unrelated to the AI Reporter code itself; they're documented
here so future deploys avoid the same trap.

### 1. Pre-deploy snapshot size tripled

The old `apps/api/node_modules/` on Contabo was a small symlink farm (~14
symlinks, <1 KB). The first deploy attempt at 09:47+02:00 shipped a new
`apps/api/node_modules/` but the **pnpm virtual store** at
`/opt/donordesk/app/node_modules/.pnpm/` (where the symlinks point) was
unchanged. The api tar had only symlinks — the actual package files
existed only in `.pnpm/`. When the api tar was extracted into
`apps/api/node_modules/`, the 14 symlinks overlaid on top of the existing
symlinks (also unchanged), but the `apps/api/dist/` was now the **new**
compiled tree. The first restart after extract failed with
`ERR_MODULE_NOT_FOUND: Cannot find package 'fastify' imported from
/opt/donordesk/app/dist/server.js`.

Root cause: the api systemd unit's `WorkingDirectory=/opt/donordesk/app`
runs `node dist/server.js` from `/opt/donordesk/app/`. From that location,
Node resolves `fastify` via `/opt/donordesk/app/node_modules/fastify`
which is a **broken** symlink (target was 3 levels up to
`/node_modules/.pnpm/fastify@5.11.3/...`, but pnpm 10 puts the store at
`/opt/donordesk/app/node_modules/.pnpm/`). The pre-existing api process
had worked because it was loaded into memory **before** my deploy broke
the symlink resolution chain — once restarted, it couldn't find fastify.

**Fix shipped in this release:**
- The api systemd unit now uses
  `WorkingDirectory=/opt/donordesk/app/apps/api` so the api tree's
  pnpm symlinks (which resolve correctly to
  `/opt/donordesk/app/node_modules/.pnpm/`) are honored. The unit file
  is checked in at `infra/systemd/donordesk-api.service`.
- The deploy script (`scripts/deploy-fast.sh`) ships **four** api-scoped
  tars instead of one: the api tree, the workspace `packages/` tar, the
  pnpm-store tar (`node_modules/.pnpm/`), and (optionally) the worker
  tar. The api extract step now does:
  1. Ship `packages/` so the api's `@donordesk/*` workspace links resolve.
  2. Ship `node_modules/.pnpm/` and run `pnpm install` at `apps/api/` to
     regenerate the api-level symlinks against the new store.
  3. Ship the api tree.
  4. Rsync the worker tree into `/opt/donordesk/workers/app/` and
     `systemctl restart donordesk-workers`.

### 2. Migrator role lacks CREATE on `public`

`prisma migrate deploy` runs `ALTER TABLE _prisma_migrations …` which
requires `CREATE` on the schema. The `donordesk_migrator` role had DML
privileges on the table but not DDL. Two migration attempts failed with
`ERROR: permission denied for table _prisma_migrations`.

**Fix shipped in this release:**
- Granted `donordesk_migrator` `CREATE ON SCHEMA public` and
  `ALL ON TABLE _prisma_migrations` so future migrations run cleanly.
- The SQL for migration `20260828200000_ai_reporter_artifacts` was
  applied directly via `psql` because the pre-fix `migrate deploy`
  couldn't run. The migration row was then inserted manually so the
  bookkeeping table is consistent.

This is now documented as a prerequisite in `contabo-ops.md` §18 for
future additive migrations: **grant the migrator CREATE before
running `prisma migrate deploy`.**

### 3. `chown -R ${REMOTE_APP}/apps/api` killed the script silently

The original api extract step in `scripts/deploy-fast.sh` ended with
`chown -R donordesk:donordesk ${REMOTE_APP}/dist ${REMOTE_APP}/apps/api`.
The latter directory didn't exist on the host (the api tar was created
by `cd apps/api && tar dist …` and extracted to `${REMOTE_APP}/`,
producing `${REMOTE_APP}/dist/` but **not** `${REMOTE_APP}/apps/api/`).
Under `set -eu`, the chown exited 1, killing the script before the
worker-sync step could run.

**Fix shipped in this release:**
- The new deploy script's api extract step only `chown`s paths that
  exist (`${REMOTE_APP}/dist`), and the worker-sync step uses
  `if [ -d apps/workers ]; then chown -R donordesk:donordesk apps/workers; fi`
  (the directory is created by the tar before chown is attempted).

### Verification (post-fix)
- `RELEASE_ID=20260828200000 SCOPE=both scripts/deploy-fast.sh` runs
  end-to-end in ~5 minutes (build + 4 api tar streams + worker rsync +
  restart).
- API: `curl http://127.0.0.1:4001/health` → `{"status":"ok"}`;
  `curl http://127.0.0.1:4001/ready` → `{"status":"ready","checks":{"database":"ok"}}`.
- Worker: `curl -H "x-internal-token: <worker-token>" http://127.0.0.1:8092/v1/ai-reporter/health`
  → `{"status":"ok"}`.
- Public: `curl https://donordesk.online/login` → 200 with full HTML.
- Eval corpus: `pnpm --filter @donordesk/infrastructure reporting:eval` → 25/25.
- RLS isolation: cross-tenant INSERT denied (verified on host).

### Prevention for future deploys

- The deploy script now probes `/v1/ai-reporter/health` as part of the
  release gate (§19 in `contabo-ops.md`), so a pnpm-store or symlink
  regression fails the gate before the operator even sees a dashboard
  alert.
- The api systemd unit file is checked into
  `infra/systemd/donordesk-api.service` so any future change to
  `WorkingDirectory` is visible in code review.
- The migrator CREATE grant is now a prerequisite documented in
  `contabo-ops.md` §18.

## Outstanding (tracked in memorybank/pending.md)
See `memorybank/pending.md` for remaining deployment/hardening items,
including the AI Reporter v2 controlled rollout (preview tenant → 2 pilot
tenants → default) per `memorybank/imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`.

## Report-Quality root cause + UX reorganisation + flexible inputs + deploy hardening + AI runtime provisioning (2026-08-31 / 2026-09-01, releases `20260831154253` → `20260901140002`)

**Status:** Implemented, deployed to donordesk.online, browser-verified end-to-end.

### A. Report-Quality root causes (109 → 43 Smart Review items, deterministic noise → real detection)

Audited the generation + verification pipeline end-to-end. Found four systemic defects in `packages/infrastructure/src/llm/`:

1. **Eligibility**: `classifyAssertionType(text, hasNumbers)` returned `"NUMERIC"` for *any* sentence with a number — so dates, participant counts, summary counts, and "80%" in an indicator name all became material achievement claims.
2. **Role classification**: `classifyNumericAtomRoles` couldn't tell DATE / COUNT / TARGET / PERCENT / ordinals apart from ACHIEVEMENT.
3. **Gate inconsistency (P0-3 partial)**: `ApproveReportSection` ignored `NOT_MATERIAL` failed claims, but `evaluateGate` (used by Smart Review + Report Check) emitted UNSUPPORTED_MATERIAL_CLAIM for every failed claim regardless of materiality.
4. **Re-extraction drift**: `DeterministicClaimVerifier` re-extracted atoms from claim text without the extractor's indicator-name masking, so a masked number could be reintroduced.

**Fixes shipped** (root-cause, not regex patches):
- `packages/domain/src/contexts/reporting/numeric-atom.ts`
  - `classifyNumericAtomRoles`: added inference for **DATE** (year tokens + date sequences), **COUNT** (number + count nouns: `participant|file|record|finding|evidence|item|session`), **PERCENT** (trailing `%`), **ordinal identifiers** (`Batch 2`, `Phase 1`).
  - Added `"COUNT"` role, `NON_ACHIEVEMENT_ROLES` set, exported `hasAchievementNumber(atoms)`, exported `indicatorLabelRanges(text)` so extractor **and** verifier share the masking logic.
- `packages/infrastructure/src/llm/assertion-extractor.ts`
  - `classifyAssertionType` now returns `"NUMERIC"` only when `hasAchievementNumber(offsetAtoms)` is true; materiality gates on the same predicate.
  - `isSkippableSentence` skips markdown table rows (`|` prefix).
  - `isNonClaimSentence`: added `evidence` to the provenance prefix list (`Evidence: …` excluded).
- `packages/infrastructure/src/llm/claim-verifier.ts`: applies `indicatorLabelRanges` before extracting atoms so masked label numbers can't be reintroduced.
- `packages/application/src/use-cases/reporting/approve-report.ts`: `evaluateGate` now skips NOT_MATERIAL failed claims (consistent with `ApproveReportSection` P0-3 contract).

**Regression tests** (`packages/infrastructure/test/p0-report-quality.test.mjs`, 9 tests):
- Summary/count metadata, activity date + participant count, evidence count, evidence reference lists, markdown table rows → not NUMERIC, not MATERIAL.
- `80%+ attendance` inside indicator name → `80` not extracted as achievement atom.
- Genuine numeric performance sentences remain NUMERIC + MATERIAL.
- End-to-end: `OUT-5 ... 5600 ... target 6400 (80%+ attendance)` verifies **PASSED**.

### B. Reporting UX reorganisation — Increment 1 (Reporting Period Workspace, frozen architecture)

- `apps/web/src/features/reporting/presentation/ReportingStepGuide.tsx` (new): four-step guide at the top of every report workspace — *Update Project → Tell the Story → Generate Draft → Review & Submit* — progress, not a wizard.
- `apps/web/src/features/reporting/presentation/StoryPanel.tsx` (new): the **5 guided questions** in step ② — *what went well / challenges / why variance / adaptations / lesson (optional)* — with **structured** persistence (`ReportingPeriod.storyContextJson`).
- `apps/web/src/features/reporting/presentation/SmartReviewPanel.tsx` (new) + `packages/domain/src/contexts/reporting/smart-review.ts`: plain-language summary over the existing gate — `hasAchievementNumber`-aware, deduped by `claimId`/`sectionId`, no reason codes.
- `apps/web/src/features/reporting/presentation/ReportCheckPanel.tsx` (new): single "Review & Submit" panel — plain-language readiness areas (Structure / Numbers / Evidence / Completeness / Approval) 🟢/🟡/🔴 + Smart Review + approval.
- Project navigation: **Reporting** moved to the front; **Compliance** removed from the primary tab bar (reached contextually via Overview / workspace); **Templates** placed last. See `memorybank/Fixes.md` mapping.

### C. Increment 2 — structured `Tell the Story`

- `packages/domain/src/contexts/reporting/reporting-period.ts`: `StoryContext` type (`achievements | challenges | varianceExplanations | adaptations | lessons`), `setStoryContext()`, tolerant `parseStoryContext()`.
- `packages/domain/src/contexts/reporting/index.ts`: exports `StoryContext`, `STORY_CONTEXT_FIELDS`, `hasAchievementNumber`.
- `apps/web/src/features/reporting/presentation/StoryPanel.tsx` + `apps/api/src/routes/reporting.ts` `PUT /v1/reporting-periods/:id/story` + `packages/application/src/use-cases/reporting/update-reporting-period-story.ts` (new).
- **AI generation prompt** (`packages/infrastructure/src/llm/llm-report-draft-generator.ts`): `buildStoryContextBlock(ctx)` injects the structured story into both `buildNarratorUserPrompt` and `buildSectionNarratorUserPrompt` so the writer weaves it into the relevant sections without inventing new context.
- **Stub fallback** (`report-draft-generator.ts`): `storyContextBlock` emits `Context recorded by the reporting officer:` lines.

### D. Increment 5 — Flexible Inputs (Excel/CSV + field-report extraction, conservative)

- **Domain parsers** (`packages/domain/src/contexts/reporting/`):
  - `period-value-import.ts` — header detection (real keyword rows, not arbitrary text), column mapping (`code|indicator code`, `achievement|value|period value|result`), numeric validation, unmappable flagging.
  - `field-report-extraction.ts` — conservative deterministic extractor: indicator code + number (`FOUND`), dates + participant counts / activity stats (`SUGGESTED`), story-context cue mapping (`challenges|achievements|variance|adaptations|lessons`). Never invents.
- **Application handlers** (`packages/application/src/use-cases/reporting/`):
  - `ImportPeriodIndicatorValuesHandler` — `preview` (parse + validate against project indicators, NO write) + `confirm` (upsert `IndicatorUpdate`, gracefully skip **verified** updates with a clear message — no silent overwrite of audited data).
  - `ProposeFieldReportExtractionHandler` (propose only, NO write).
  - `ApplyFieldReportExtractionHandler` (commits user-confirmed items to existing model: `IndicatorUpdate`, `ActivityUpdate`, `ReportingPeriod.storyContext` merged).
- **Contracts** + **API routes** (`apps/api/src/routes/reporting.ts`): `POST /v1/reporting-periods/period-values/{preview|confirm}`, `POST /v1/reporting-periods/field-report/{propose|apply}`.
- **Web UI** (`apps/web/src/features/reporting/presentation/FlexibleInputsPanel.tsx`): two-tab panel (Import values / From field report), preview → human confirm → commit flow.

### E. Deploy hardening (`scripts/deploy-fast.sh`) — the `hostname` mystery finally root-caused

**Root cause:** `SSH="${SSH:-ssh -o ConnectTimeout=15 -o ServerAliveInterval=30}"` — missing the **`contabo`** host argument. Every `${SSH} "command"` invocation was passing the command string as the hostname → `ssh: hostname contains invalid characters`, causing snapshot + stream to abort. Confirmed by `bash -x scripts/deploy-fast.sh` trace.

**Hardening shipped:**
- `SSH="${SSH:-ssh -o ConnectTimeout=15 -o ServerAliveInterval=30 contabo}"` (one-line root-cause fix).
- **Canary preflight**: before building, scp-extract a tiny tar to both env files via the host-file pattern; aborts with a clear error if the transfer path is broken.
- **scp-based transfers** for all five artifacts (web, packages, pnpm-store, api, worker). Replaced the `cat | ssh "tar -xzf -"` pipe pattern, which was the surface where the `hostname` symptom appeared. New pattern: `ssh "cat > /tmp/dd-art.tgz; tar -xzf /tmp/dd-art.tgz -C DEST; rm -f /tmp/dd-art.tgz" < LOCAL_TAR`.
- **Snapshot retry** (attempt, retry once, warn-and-continue on second failure; `NO_BACKUP=1` still skips entirely).
- **API ready-poll** in verify: retries `/health` every 2s up to 60s instead of failing the verify when the api was still starting.
- **Worker → env sync** (deferred to F-runtime-provisioner): api now regenerates the api's `node_modules/.pnpm` symlink farm **after** extracting the api tar, so `@sentry/node` and friends always resolve on Contabo (no manual `pnpm install`).

### F. Runtime provisioning — SaaS control-plane → Contabo runtime envs

**Status:** live on Contabo; verified end-to-end (api boot → env files → worker → DeepSeek → real AI Executive Summary in ~6s; MiniMax → real AI Executive Summary in ~57s).

- **Why:** selecting DeepSeek / MiniMax on `sa.donordesk.online` only wrote to `PlatformConfiguration`. The api service and the worker had **no path** to read that — they read env files only. The operator had to copy secrets manually, which never happened.
- **New: `packages/infrastructure/src/platform/runtime-provisioner.ts`** (`RuntimeProvisioner`):
  - Atomic env-file writer (temp file → `chmod 0640` → `chown donordesk:donordesk` → rename). Preserves existing ownership on re-provision.
  - Idempotent managed block (`# dd-managed:LLM:GLOBAL:<provider>:<scopeId>` … `# dd-end-managed:LLM`) — updates replace cleanly; re-applies are a no-op.
  - `renderApiManagedBlock` writes `AI_REPORTER_ENABLED=1`, `AI_REPORTER_URL`, provider, model, `LLM_PROVIDER`. `renderWorkersManagedBlock` writes the worker-side `AI_REPORTER_*` (including the decrypted api key).
  - Restart via `execFile` of `/usr/bin/sudo` + `/usr/bin/systemctl restart donordesk-{api,workers}` (no shell, scoped sudoers NOPASSWD). **Never logs the secret** — the injected logger receives provider / model / changed / restarted only.
- **Wired into `PlatformControlPlane.upsertConfiguration` / `deleteConfiguration`**: after the DB write + audit, the control plane calls `provisioner.provisionGlobalLlm` / `deprovisionGlobalLlm` for GLOBAL enabled LLM configs (TENANT scope is documented as out-of-V1 for the AI Reporter path; it flows through `LlmConfigResolver`). Provisioning failures are audited (`configuration.provisioning_failed`) but don't roll back the save.
- **API boot backfill** (`apps/api/src/server.ts`): on api startup, iterates every GLOBAL enabled LLM `PlatformConfiguration` row, decrypts secrets, and provisions the env files + restarts. So a provider selected on sa.donordesk reaches donordesk.online automatically — **no operator copy step**.
- **Host setup on Contabo (operator one-time, root):**
  - `/etc/sudoers.d/donordesk-restart` (`0440`, root): `donordesk ALL=(root) NOPASSWD: /usr/bin/systemctl restart donordesk-api, /usr/bin/systemctl restart donordesk-workers`.
  - `donordesk-api.service` `ReadWritePaths=/opt/donordesk/shared /opt/donordesk/shared/storage` (expanded so the api process, `User=donordesk`, can write the env files).
  - `/opt/donordesk/shared/{api,workers}.env` chowned to `donordesk:donordesk` `0640`.
- **Regression tests** (`packages/infrastructure/test/runtime-provisioner.test.mjs`, 5 tests): inserts/updates/idempotent managed block, remove targeted block, render block content, `provisionGlobalLlm` writes env files + scoped restart + **no secret in logs** (asserted by scanning every log line), `deprovisionGlobalLlm` removes blocks + restarts.

### G. MiniMax "Test connection" 404 → fix

**Root cause:** `testProvider` in `control-plane.ts` built the test URL as `baseUrl + paths[provider]`. For MiniMax, `paths["minimax"] = "/v1/models"`. The operator saved `baseUrl = "https://api.minimax.io/v1"` (the correct form for the **worker**'s `llm_gateway.py`, which does `f"{base_url}/chat/completions"` → `.../v1/chat/completions`). But the Test-connection path then appended `/v1/models` → **`https://api.minimax.io/v1/v1/models` → HTTP 404**. Direct probes confirmed `https://api.minimax.io/v1/models` → **200** (valid model list) vs `.../v1/v1/models` → **404**.

**Fix** (`packages/infrastructure/src/platform/control-plane.ts` `testProvider`): strip a trailing `/v1` segment from `baseUrl` before appending the provider path, so the path's leading `/v1` doesn't double:

```ts
config.baseUrl.trim().replace(/\/(v1)\/?$/, "").replace(/\/+$/, "")
```

**Verified via the actual UI path** (login as superadmin + `POST /superadmin/configurations/:id/test` for both providers):

```
minimax → { "status": "SUCCESS", "message": "Connection and credentials verified" }
deepseek → { "status": "SUCCESS", "message": "Connection and credentials verified" }
```

The MiniMax draft endpoint also produces real AI content (Executive Summary: *"During the reporting period, the EERP project reported on learning centre establishment. According to verified indicator data for OUT-1, 30 learning centres have been established against a target of 120 centres…"*) with `parseOutcome: VALID, critiqueIssues: 0, validatorIssues: []`.

### H. Worker env reload when a provider is saved after api boot (sharp edge)

The api's boot backfill provisions env + restarts services on **first api boot**. For a save made *while* the api is already running (e.g., operator toggles provider / pastes key on sa.donordesk), `upsertConfiguration` calls `provisioner.provisionGlobalLlm` → writes env files → `restartServices` (api + workers). On Contabo this was observed to fail to restart workers in one case (worker held stale env → 401 against the new provider key). Operationally, the operator resolved it with a one-time `systemctl restart donordesk-workers`. A more robust detection (e.g., log + verify worker pid picked up new env, with a stronger retry) is tracked separately. The platform → runtime propagation is correct; this is a deploy-tooling robustness item, not a product regression.

### I. Browser-verified real-user flow (Increments 1–5 + P0 fixes)

- Project tabs: **Reporting** first; **Compliance** removed from primary.
- 4-step guide renders in every report workspace; links use existing routes — no new workflow.
- Story panel: 5 questions persist as structured `storyContextJson` (verified in DB: `{challenges: "Flooding…"}` merged correctly).
- Report Check (single panel): 🟢 Numbers/Evidence, 🔴 Structure/Completeness/Approval, plain-language "2 things need attention" with deep-links — no `ASSERTION_FAILED` / `VALUE_MISMATCH` in the user path.
- Flexible inputs: CSV paste → preview (`will update` / `does not exist in this project`) → confirm; field-report paste → propose (`OUT-4 = 2600` FOUND + `challenges/adaptations/lessons` mapped) → confirm. Verified indicators persisted to DB; story context merged.
- Test connection: ✅ SUCCESS for DeepSeek and MiniMax after the `/v1` fix.

**No regressions:** domain **108** ✓ · application **84** ✓ (later 86 with new tests) · infrastructure **165+** ✓ · api/web typecheck clean.
