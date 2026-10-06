# Phase 23 — User-friendliness: implementation plan

**Status (2026-10-06): R1–R9 implemented, deployed (release `20261005123155`) and browser-verified in a UI-driven six-month WASH run — see ["Verification outcome (demo 4)"](#verification-outcome-demo-4-2026-10-05) and the follow-up plan ["Phase 24 recommendations"](#phase-24--recommendations-from-the-demo-4-findings) at the end of this file. R10 (23.6) is a research protocol: [`../demo/usability-test-protocol.md`](../demo/usability-test-protocol.md). See "Implementation notes" for where the build differs from this plan.**
Source: the ten recommendations at the end of [`demo/verification-demo-3.md`](../demo/verification-demo-3.md) ("Appendix — a user's-eye review").
Goal: lift "overall ease of use for a non-technical officer" from **3.0** toward 4.0+ by removing hidden rules, dangerous defaults and opaque scores, **without** weakening any
assurance guarantee (grounding, verification, gates, RLS, audit).

Constraints inherited from `AGENTS.md` apply to every workstream: domain stays pure (no infra imports); application defines handlers + ports only; one repository per aggregate;
routes thin and Zod-validated; **every mutation writes `audit_events`**; `Result<T, DomainError>` for expected failures; new Prisma columns used in `select/create/where`
go into `REQUIRED_PRISMA_FIELDS` (`apps/api/src/routes/health.ts`) in the same change; never run `prisma format`; package tests run against `dist/` (build contracts → domain →
application → infrastructure first); section recognition by `classificationTitle()` / `canonicalTitle`.

---

## 0. What "100% SOLID, no errors" means here (verifiable gates, not slogans)

No plan can *guarantee* zero defects. Instead each workstream must pass the gates below before it merges; a gate that cannot be run is reported as skipped, never as passed.

**SOLID, as concrete rules for this work**

| Principle | Rule applied |
|---|---|
| **S** | Every new unit has one reason to change. Pure rules (what a semantics means, which period types are allowed, how a flag is classified, how readiness is scored) live in **domain** files of their own; orchestration lives in **one** application handler/service per use case; React components render, they never decide rules. |
| **O** | Rules are tables/strategies that are *extended*, not edited with new `if` branches: `FLAG_CLASS_RULES`, `PERIOD_TYPE_RULES`, `READINESS_BLOCKER_RULES`, `CLOSING_STEP_RULES` are arrays of small rule objects iterated by one runner. Adding a rule = adding an entry + test. |
| **L** | New ports are narrow supertypes' worth of behaviour; any in-memory/Prisma implementation must pass the same contract test (`repo-contract` style tests already used for `ReportingPeriodRepository.update`). Additive DTO fields are optional so old callers/clients stay valid. |
| **I** | New ports are small and role-specific (`IEvidenceLinker`, `IEvidenceSupportQuery`, `IPeriodRuleCatalog`…), not extensions of the fat `IEvidenceRepository`. UI components get narrow prop types, not whole read models. |
| **D** | Handlers depend on ports; Prisma only in `packages/infrastructure`; the web app reaches the API only through `lib/actions/*` → gateway. The **same** domain predicate is called by the refusing handler *and* the explaining panel (one source for each rule — see R3), so explanation can never drift from enforcement. |

**Quality gates (every phase)**
1. `pnpm -r typecheck` and `pnpm -r build` clean.
2. New unit tests for every new domain rule (table-driven, incl. boundary and "unknown value" cases); handler tests with in-memory ports; **golden tests that pin existing behaviour** where a function is changed (`calculateReadiness`, bulk save response, evidence attach).
3. Package tests run on a fresh build (`dist/`): domain `node --test`, application, infrastructure, `pnpm --filter @donordesk/infrastructure reporting:eval` (no regression in the golden corpus), web `pnpm --filter web test:unit`.
4. Migration phases only: apply on a **scratch DB** on the dev Postgres (not the app DB), re-run `infra/postgres/rls.sql`, confirm `/ready` passes with the new `REQUIRED_PRISMA_FIELDS`, round-trip a repository test.
5. Browser verification in one visible window (CDP attach), driving the real flow of that phase; detect completion from the UI; kill by pid.
6. Accessibility: new controls keyboard-operable, labelled, status conveyed by text not colour alone; mobile width checked.
7. Back-compat: every API change is **additive** (new optional fields / new routes). Nothing removed in this phase; deprecations are documented and logged.
8. Deploy follows `contabo-ops.md` + `scripts/deploy-fast.sh` (B2 `prisma generate` re-run); gate on a fresh green run; record the deploy in `memorybank` afterwards.

---

## 1. Baseline — what the code does today (inspected 2026-10-05)

| Area | Finding (file) |
|---|---|
| Indicator defaults | `defaultSemanticsForType` / `inferIndicatorSemantics` (`packages/domain/src/contexts/logframe/indicator-semantics.ts`): NUMBER/CURRENCY → SUM + NEUTRAL + `REQUIRES_REVIEW`; PERCENTAGE without num/den → LATEST + `REQUIRES_REVIEW`. `CreateIndicatorHandler` returns only `{id}` and persists no semantics (`semanticsJson` null → inferred at read in `indicator-analytics-service.ts:64`). `gate-rules.ts:153-193` blocks *evaluative* statements while semantics are unresolved. `IndicatorSemanticsCard.tsx` defaults the form to `HIGHER_IS_BETTER` (differs from the domain's NEUTRAL). Nothing in `ProjectReadinessService` mentions semantics. |
| Evidence | `UploadEvidenceHandler` only **tags** (`EvidenceFile.activityId/indicatorId`). `AttachEvidenceHandler` writes `attachedEvidenceIds` on the activity/indicator-update **and** copies the id into `EvidenceFile.indicatorId` — but the id passed is an **IndicatorUpdate id** (`attach-evidence.ts`, `evidence.indicatorId !== input.indicatorId`), so `EvidenceFile.indicatorId` holds two meanings. `EvidenceSearchSchema` paginates (default 20). Writer sees attached evidence plus tagged verified evidence. |
| Periods | `CreateReportingPeriodHandler` enforces setup readiness, project bounds, cadence overlap (`CADENCE_REPORT_TYPES`), scope, finance. Rules are only explained **after** refusal (`overlapMessage`). `ProjectStatus` DRAFT→ACTIVE via `PUT /v1/projects/:id` (`update-project.ts`; DRAFT can't be re-entered). `AcknowledgeProjectSetupSchema = {acknowledged: z.literal(true)}` → bare 400. Project page header shows a status badge only (`projects/[id]/page.tsx`). |
| Readiness | `calculateReadiness` (`packages/domain/src/contexts/compliance/readiness-calculator.ts`): sections 25 % + indicators 20 % + evidence 25 % + checklist 20 % + approval 10 %; `totalSections === 0` and `totalIndicators === 0` give 0; contradiction blockers cap `overall`. `ReadinessBreakdownList.tsx` shows weights and one link per dimension; no ranking, no "top blockers". Calculated in `CalculateReadinessHandler` and persisted via `ReportingPeriod.setReadinessScore`. |
| Review flags | `ReportClaim` has `verificationResult`, `verificationReasonCode`, `assertionType`, `materiality`. `REASON_CLASSES` (`verification-reason.ts`) already classes reasons (DETERMINISTIC_FAILURE / UNCERTAIN / INTEGRITY / POLICY). Copy exists (`apps/web/src/lib/reporting-copy.ts` — `verificationReasonCopy`), `smart-review.ts` already hides codes for gate issues, `BulkClaimResolution` + `BulkResolveReportClaimHandler` give bulk accept/exclude. `ReportReviewPanel.tsx` lists all pending statements flat, with a result badge and detail. No "report error vs checker could not confirm" split. |
| Closing report | FINAL rules live in `create-reporting-period.ts` (overlap message), `period-comparability.ts`, `life-of-project.ts`, `report-type-checklist.ts` (`cumulativeDataItems`, finance items). No guided flow. |
| Logframe ↔ activities | `ActivityUpdate` has `outputId` + `indicatorId` only (`schema.prisma:514`); `LogframeItem.level` includes ACTIVITY nodes but nothing references them. Participants are free `Int?` fields. |
| Bulk save / verify | `BulkUpsertIndicatorUpdatesHandler` returns `{saved, skipped}`; `VerifyIndicatorUpdateHandler` is one id per call (`POST /v1/indicator-updates/:id/verify`); `IndicatorEntryGrid.tsx` has per-row "Submit & verify". |
| Guidance | An Academy tour exists (`apps/web/src/features/tour/domain/tour-steps.ts`, order: sample project → setup → template → logframe → evidence → period → AI draft → editor → compliance …), `onboarding-steps.ts`, `reporting-steps.ts` (4-step guide). The five rules from the review are in none of them. |

---

## 2. Delivery order

Ordered so each phase ships and deploys independently; only R2 and R7 touch the schema (both additive, nullable).

| Phase | Recs | Why this order | Schema |
|---|---|---|---|
| **23.1** Safe data | R1, R8 | Fixes the most dangerous default and the cheapest friction; no migration | none |
| **23.2** Review that earns trust | R4, R5 | Highest daily-use pain after generation; pure-domain heavy, easy to test | none |
| **23.3** Evidence | R2 | The weakest area (2.0→3.0); needs a migration, so isolated | `EvidenceFile.indicatorUpdateId` |
| **23.4** Rules up front | R3, R9 | Shared "rules" source of truth feeds the panel, header and tour | none |
| **23.5** Closing + delivery links | R6, R7 | R6 consumes R1/R3/R4 outputs; R7 needs a migration | `ActivityUpdate.logframeActivityId` |
| **23.6** Validate with people | R10 | Run after 23.1–23.5 are live; a research task, not code | none |

---

## R1 — Make defaults safe and visible (Phase 23.1)

**Problem.** Unconfigured indicators read "Descriptive only" forever; a rate with no numerator/denominator once read "not calculable"; nothing tells the user, and a project can reach reporting with `REQUIRES_REVIEW` semantics.

**Design (one source of truth, no new aggregation enum).**
1. **Domain** `indicator-semantics-description.ts` (new, pure): `describeSemantics(effective: IndicatorSemantics, type): SemanticsDescription` →
   `{ aggregationLabel, evaluationLabel, summary, needsReview, reasons[] }`, e.g. *"Counts: summed across periods. Not evaluated against the target. Needs review."* and
   *"Rate: latest reported value. Needs review."* The label tables are data (`AGGREGATION_COPY`, `DIRECTION_COPY`) → open for extension. It consumes the **same** `inferIndicatorSemantics` that
   analytics uses, so what the UI says is exactly what the report does (no drift).
2. **"Reported as a rate"**: for `PERCENTAGE` without a numerator/denominator the form offers "Reported directly (latest value)" = `LATEST` + `CONFIGURED`. `sanitizeIndicatorSemantics` already
   rejects PERCENTAGE without a pair, so this maps onto `LATEST` and needs no enum change (the Python/TS mirrors stay untouched).
3. **One-click confirm** — new `ConfirmIndicatorSemanticsHandler` (application): takes `indicatorId[]`, resolves each indicator's *effective* semantics (`semantics ?? inferIndicatorSemantics`), and writes it
   via the existing `UpdateIndicatorSemanticsHandler` path with `status: CONFIGURED` (delegation, not duplication). Refuses a still-invalid pair (PERCENTAGE/RATIO without num/den) with an actionable error.
   Audit event `logframe.indicator.semantics_confirmed`. Direction stays whatever the user confirmed — **never auto-promote a direction** (domain rule already stated in `inferIndicatorSemantics`).
4. **Create returns the effective semantics**: `CreateIndicatorHandler` returns `{ id, semantics, semanticsDescription }` (additive). `NewIndicatorForm` shows the summary after save and a "Confirm"/"Change" pair.
5. **Unreviewed semantics are never silent** (additive, non-blocking):
   - `ProjectReadiness` gains `warnings: Array<{code, label, href}>` (blockers unchanged); `ProjectReadinessService` adds `INDICATOR_SEMANTICS_UNREVIEWED` ("3 indicators need their calculation confirmed") — a **warning**, so no existing project is suddenly un-reportable.
   - `report-type-checklist.ts` / checklist generator: new item type `INDICATOR_SEMANTICS_UNREVIEWED` (add to `ChecklistItemType` + `CHECKLIST_ITEM_TYPES` + DB value is a plain string, no migration) that auto-closes once confirmed (same auto-close mechanism as the stale-item fix).
   - Generation preflight shows the count with a "Confirm all suggested" button (calls the bulk confirm).
6. **UI**: `IndicatorSemanticsCard` initial direction = domain default (NEUTRAL) instead of HIGHER_IS_BETTER (today's mismatch silently changes behaviour when saved); a `SemanticsBadge` (one tiny component) on logframe rows, indicator pages and the period inputs grid; logframe page gets "Confirm all (n)".

**API.** `POST /v1/indicators/semantics/confirm` `{indicatorIds: string[]}`; `GET /v1/projects/:id/indicators` already returns `semantics`; add `semanticsDescription` (additive).

**Tests.** Domain: every `IndicatorType × (pair present/absent)` row of `describeSemantics`; confirm refuses invalid pairs; effective-semantics parity test (`describeSemantics(infer(x)).aggregation === analytics aggregation`). Application: confirm is idempotent, audited, tenant-scoped, partial failure reports per id. Web: `semantics-badge` unit; form default direction test.

**Acceptance.** A new "% attendance" indicator shows *"Rate: latest reported value — Needs review"* immediately, one click makes it CONFIGURED, the checklist item/warning disappears, and a report generated before and after the click differs only by the removed "descriptive only" restriction.

---

## R8 — Bulk ids and "verify all" (Phase 23.1)

1. `BulkUpsertIndicatorUpdatesHandler` returns `{ saved, skipped, updates: Array<{ indicatorId, updateId, changed }> }` (additive; `upsertIndicatorUpdate` already returns `{id, changed}`). `BulkUpsertIndicatorUpdatesSchema` response schema in `apps/web/src/lib/server/schemas.ts` gains the optional array.
2. New `VerifyPeriodIndicatorUpdatesHandler` (application): input `{ reportingPeriodId, updateIds?: string[] }` (default = every DRAFT/SUBMITTED update of the period within the report's indicator scope via `periodIndicatorScope`). For each it calls the existing `reviewIndicatorUpdate` helper (so permission checks, `submit()`+`verify()` and audit stay in one place). Result is **per-item, not atomic**, by design: `{ verified: n, failed: [{updateId, indicatorCode, message}] }` so one bad row never blocks the rest and never half-hides a failure.
3. `POST /v1/reporting-periods/:id/indicator-updates/verify-all`. Role check = same permission as single verify; a closed period returns the same CONFLICT as bulk save.
4. Grid (`IndicatorEntryGrid.tsx`): after "Save", rows already have ids (no second lookup); new **Save & verify all** (calls bulk then verify-all) plus a "Verify all (n)" button; failures listed inline with the row's code.

**Tests.** Handler: mixed valid/invalid, permission denied, closed period, idempotent re-run, scope respected. Golden: old `{saved, skipped}` consumers still parse.

**Acceptance.** Entering six indicators with breakdowns and pressing one button leaves all six VERIFIED, with ids returned and no per-indicator lookups.

---

## R4 — Readiness that guides (Phase 23.2)

**Problem.** 0 % on a correct report: sections (approved), approval and checklist carry 55 % and are 0 until a human acts; the score is opaque.

**Design.**
1. **Domain** `readiness-calculator.ts` stays the pure scorer but gains a **stage**: `ReadinessStage = "DRAFTING" | "IN_REVIEW" | "SUBMISSION"` derived from the draft status (none/DRAFT → DRAFTING; UNDER_REVIEW → IN_REVIEW; APPROVED+ → SUBMISSION). Weights per stage live in a table `READINESS_WEIGHTS_BY_STAGE` (open/closed): in DRAFTING, *approval* has weight 0 and *sections* measures "sections drafted with no open blocking issue" instead of "approved"; weights renormalise to 100. `SUBMISSION` weights are the **current** weights → existing results are byte-identical (golden test pins this). `dataQualityBlockers` cap unchanged. A correct, fully verified first draft therefore scores high; it can never exceed what is true because the blocker cap and verified-indicator terms still apply.
2. **Blockers, ranked.** New pure `rankReadinessBlockers(breakdown, context, rules)`: each `READINESS_BLOCKER_RULES` entry `{ key, applies, gapPoints, label, action }` produces candidates; the runner sorts by `gapPoints` (weight × gap) and returns the top 3 as `{ key, label, detail, points, action: { kind: "link" | "command", label, href | command } }`. Commands reuse existing handlers (e.g. *Confirm indicator calculations* (R1), *Verify all* (R8), *Resolve open statements* (R5), *Attach evidence* (R2)). No new business logic — each action points at an existing use case.
3. **Checklist items say what to do**: `ChecklistItem.description` stays; add a derived `nextAction` (type → `{label, href}` map in `compliance-links` which already exists in web tests) so each open item has a button; the stale-item auto-close remains.
4. **Application** `CalculateReadinessHandler` returns the additive `{ stage, topBlockers[] }`; `recompute-readiness`, dashboard and portfolio read-models keep using `overall`. `ReadinessGauge` shows the stage label ("Drafting · 82 %") so the number is never read as "ready to submit".
5. **UI** `ReadinessBreakdownList` gets a "Top 3 things to do" block above the dimension list; the 0 % empty-state copy for "no draft yet" becomes "Generate a draft to start" instead of a score.

**Tests.** Domain: stage × input matrix; SUBMISSION golden equals pre-change outputs; weights sum to 1 per stage; ranking is deterministic and stable on ties; a fully verified first draft ≥ threshold in DRAFTING but < submission-ready. Handler: stage derivation. Web: top-blockers render + links.

**Acceptance.** The demo-3 final report (all numbers right, no approvals yet) reads "Drafting · high %" with ≤ 3 concrete buttons; after approval the old formula applies unchanged.

---

## R5 — "Your report is wrong" vs "our checker could not confirm" (Phase 23.2)

**Design.**
1. **Domain** `flag-classification.ts` (new, pure): `classifyFlag(claim) → { class: "REPORT_ERROR" | "UNCONFIRMED" | "NEEDS_DECISION", reasonKey, suggestedAction }`, a rule table in priority order:
   - numeric/derived mismatch reasons (`VALUE_MISMATCH`, `UNIT_MISMATCH`, `PERIOD_MISMATCH`, `ENTITY_MISMATCH`, `DERIVATION_INVALID`), `NUMERIC_CONTRADICTION` gate issues, `MATERIAL` + deterministic failure → **REPORT_ERROR** (fix the text/number);
   - integrity/policy (`EVIDENCE_HASH_MISMATCH`, `CONFIDENTIALITY_RESTRICTED`, …) → **NEEDS_DECISION** (permission-gated);
   - uncertain/qualitative/interpretive (`ENTAILMENT_UNCERTAIN`, `COVERAGE_GAP`, `CAUSAL_REVIEW_REQUIRED`, `SOURCE_MISSING` on non-numeric, non-material) → **UNCONFIRMED** (checker limit).
   It reads only `verificationReasonCode`, `assertionType`, `materiality`, `type` — **never** the free-text detail (the module header of `verification-reason.ts` forbids that).
   **Invariant:** classification is presentation. It never changes `verificationResult`, gates, assurance state or approval rules; `evaluateReportGate` stays the sole gate authority (matches `smart-review.ts`'s own contract).
2. **Application read-model** (`get-report-assurance` / editor read-model) adds, per claim, `flagClass`, `plainReason` (via the existing copy module) and `suggestedAction`. Raw `verificationReasonCode` stays in the payload for tooling but the web layer never renders it.
3. **Section approval with one explained decision** — new `ResolveSectionFlagsHandler` (application, orchestrator only): for one section, resolves **only `UNCONFIRMED` + non-material** claims by delegating to `BulkResolveReportClaimHandler` (`ACCEPTED_WITH_LIMITATION`, one shared note, note required ≥ 10 chars) and optionally then to `ApproveReportSectionHandler`. REPORT_ERROR and NEEDS_DECISION claims are never touched; if any remain, it returns them instead of approving. Confidentiality override keeps its existing permission. Audit: one event per section carrying the claim count and note (the delegated handlers already audit each claim).
4. **UI** `ReportReviewPanel`: two groups — "Needs fixing" (REPORT_ERROR, red, first) and "We could not confirm" (UNCONFIRMED, neutral, collapsed by default with a count); per-section "Accept the n unconfirmed statements and approve" opens a dialog requiring the one note. Reason codes removed from every visible string; tooltip shows the plain reason only. Copy added to `reporting-copy.ts` (new `FLAG_CLASS_COPY`, extends `REASON_COPY` coverage test so a new code without copy fails CI).

**Tests.** Domain: every `VerificationReasonCode × materiality × assertionType` is classified (exhaustiveness test fails when a code is added without a rule); classification never mutates input. Handler: REPORT_ERROR present → section not approved and nothing resolved; note required; permission denied path; idempotent. Web: grouping, no raw `[A-Z_]+` token in rendered text (extends `reporting-copy.test.mts`).

**Acceptance.** Demo-3 style report: the 63 "unsupported" interpretive flags collapse into one group; a reviewer approves a section with one note; a genuinely wrong figure is still red, still blocks approval.

---

## R2 — One evidence concept (Phase 23.3)

**Design.**
1. **Schema** (additive migration `2026101xxxxxxx_evidence_indicator_update_link`): `EvidenceFile.indicatorUpdateId String?` + `@@index([indicatorUpdateId])`. Semantics become: `indicatorId` = **the indicator** the file tags; `indicatorUpdateId` = the **indicator-update (period value)** it supports. `REQUIRED_PRISMA_FIELDS += {EvidenceFile, indicatorUpdateId}`. RLS unchanged (existing table), but re-run `infra/postgres/rls.sql` per runbook.
   *Backfill (in the migration, idempotent):* `UPDATE "EvidenceFile" e SET "indicatorUpdateId" = e."indicatorId", "indicatorId" = u."indicatorId" FROM "IndicatorUpdate" u WHERE u.id = e."indicatorId";` — moves every legacy overloaded value to its proper column; rows whose `indicatorId` is a real indicator id are untouched. Verified on a scratch DB with a row of each kind.
2. **Domain** `EvidenceFile` gains `indicatorUpdateId`; `updateMetadata` accepts it.
3. **One linking service** — new `EvidenceLinkService` implementing port `IEvidenceLinker` (`linkToActivity`, `linkToIndicator`): the single place that (a) adds the id to `attachedEvidenceIds` of the activity / indicator update, (b) sets the correct tag column, (c) audits. `AttachEvidenceHandler`, `UploadEvidenceHandler`, `LinkGoogleDriveEvidenceHandler` and `ImportEvidenceHandler` all call it (today the logic lives only in `AttachEvidenceHandler`, and uploads skip it → the confusion).
   - **Upload with an activity ⇒ attached immediately.**
   - **Upload with an indicator** ⇒ resolve the indicator's update for the evidence's reporting period; if it exists, attach; if not, keep the indicator tag and let `UpsertIndicatorUpdate` (via port `IEvidenceLinker.attachPendingFor(indicatorId, periodId, updateId)`) attach tagged evidence of that period when the update is first created. Nothing is lost, nothing needs the user to know about update ids.
   - `AttachEvidenceHandler` input becomes `{ evidenceId, activityId?, indicatorId?, indicatorUpdateId? }`. **Compat:** a legacy `indicatorId` that is actually an update id is detected by lookup (exists in IndicatorUpdate → treat as update id) and a deprecation note is logged; documented, removed in a later phase.
4. **"Which files support this / which statements cite it"** — new read port `IEvidenceSupportQuery` + `GetEvidenceSupportHandler`: for an activity or indicator returns its files with `verificationStatus` and, per file, the report statements that cite it (from `ReportClaim.sourcesJson` evidence ids — search by id via a repository method, indexed read; no new table). Endpoint `GET /v1/{activities|indicators}/:id/evidence-support`; evidence detail adds "Cited by n statements". Record chunks stay **never cited as evidence** (unchanged rule).
5. **Pagination**: evidence page and the picker use cursor/page controls with the page size visible ("21–40 of 133") and a search box; `searchEvidence` response adds `total` (additive) so "default of 20" is no longer silent; the attach picker loads on demand instead of the first 20.
6. **UI**: `ActivityEvidencePanel` + indicator page show "Supporting files (n)" and "Cited in (m)"; the upload form's "Attach to" selects replace "tags" wording; the evidence list drops the separate "link" step for items already attached; `EvidenceLinkManager` stays for re-linking. Tooltips explain *attached = used as proof in reports*.

**Tests.** Migration scratch-DB test (backfill both row kinds, idempotent re-run). Application: upload→attached for activity; indicator with/without update (pending attach on later upsert); legacy update-id compat; detach clears both columns; audit emitted once. Repo contract tests (`EvidenceRepository` search/total/indicatorUpdateId). Support query: claim citing a file appears; deleted claims don't. Web: picker pagination.

**Acceptance.** Upload a photo while on an activity → it appears on that activity and in the next report's evidence with no second step; an indicator page lists its files and the statements citing each; `EvidenceFile.indicatorId` never again contains an update id.

---

## R3 — Explain rules before refusing (Phase 23.4)

**Design.**
1. **Single source for rules** (domain, new `period-type-rules.ts`): `PERIOD_TYPE_RULES: Record<ReportType, PeriodTypeRule>`, where a rule has `evaluate(ctx) → { allowed: boolean; reason?: string; nextAction?: string }`. The rules are **extracted from** `CreateReportingPeriodHandler` (overlap between cadence periods, FINAL must close the cadence, finance only for non-monthly/non-custom, project-date bounds, ACTIVITY/SITUATION/CUSTOM scope needs) — the handler is changed to *call* them, and the catalog calls the same functions. Result: the panel and the refusal are generated from identical code; `overlapMessage` moves here. A parity test runs every rule through both paths.
2. **Application** `GetPeriodOptionsHandler` + route `GET /v1/projects/:id/period-options` → `{ projectLifecycle, types: [{ type, label, available, why, nextAction, suggestedDates?, financeAvailable }] }`; suggested dates reuse `suggestPeriodDates` (already used by the form).
3. **UI** `NewReportingPeriodForm`: a "What you can create" panel above the type select — each type shows an enabled/disabled state with the sentence ("Monthly: your cadence. A **Final** report closes it — create it for the last month; finance is available on Final and Quarterly; **Custom** is a one-off over dates that already have periods."). The text comes from the catalog, not hard-coded in the component. Disabled options explain themselves.
4. **Lifecycle in the header**: domain `describeProjectLifecycle(status, setupAcknowledged, setupBlockers)` → `{ label: "Draft — activate to report", tone, primaryAction: {kind:"activate"} | …}`; `ProjectLifecycleBanner` in `projects/[id]/page.tsx` + project layout shows it with an **Activate** button (calls the existing `PUT /v1/projects/:id` status transition; permission-gated, hidden for non-owners with text instead). Also on the setup page: the acknowledgement action.
5. **No bare 400s**: Zod errors on API routes pass through a shared error mapper producing `{code, message, fieldErrors[], hint}`; `AcknowledgeProjectSetupSchema` keeps `literal(true)` but its error message says *"Send {\"acknowledged\": true} to confirm"*; the UI calls it with the right body (it already does). A route-level test asserts that no route in `apps/api/src/routes/*` returns a message-less 400 for schema failures (iterate registered routes with an empty body in a test harness).

**Tests.** Rule parity (handler refusal text === catalog reason) for every report type; catalog for combinations: monthly exist/none, final available only when…; lifecycle matrix (DRAFT/ACTIVE/PAUSED/COMPLETED/ARCHIVED × ack); error-mapper test.

**Acceptance.** A new user opening "New report" sees which types they can create and why; an attempted overlap is impossible to submit by surprise, and if forced via the API the message equals what the panel showed.

---

## R9 — First-run guidance (Phase 23.4)

The Academy tour (Feature 22) already exists; extend it, don't build a second one.
1. **One content module** `apps/web/src/features/tour/domain/workflow-rules.ts` (pure, no imports): `WORKFLOW_ORDER` (project → logframe → indicators → template → period → data → evidence → generate → review → export) and `WORKFLOW_RULES` (the five rules: indicator calculation, evidence attached = proof, periods cadence/final/finance, readiness stages, "checker could not confirm"). It is consumed by the tour, the period panel's help link, the empty states and a new static `/help/how-it-works` page — so the wording exists once.
2. **Tour**: reorder `TOUR_STEPS` to the workflow order above (logframe/indicators before template where the review gives that order) and add steps for *indicator calculation* (anchors on the R1 badge), *periods rules* (R3 panel), *evidence attach* (R2), *readiness top 3* (R4), *flags* (R5). New `data-tour-id`s are added where those components are built (each phase adds its own anchor); steps whose target is absent are already skipped by the overlay. Update `tour-shots.json` via its generator if it lists the steps.
3. Contextual first-run hints (dismissible, state in the existing `useTourProgress` store) on each empty page link to the matching rule.

**Tests.** `tour-steps` unit: every step id unique, every route placeholder resolvable, order matches `WORKFLOW_ORDER`; `workflow-rules` snapshot of keys; the help page renders every rule.

**Acceptance.** A new officer gets one linear tour in the correct order; every one of the five rules is reachable from where it bites.

---

## R6 — A "closing report" flow (Phase 23.5)

**Design.**
1. **Domain** `closing-report-plan.ts` (pure): `planClosingReport(input) → ClosingPlan{ steps: [{key,status:"DONE"|"TODO"|"BLOCKED",detail,action}], suggestedPeriod:{startDate,endDate} }`, rule table `CLOSING_STEP_RULES`: (1) project semantics confirmed (R1), (2) every cadence period approved/closed and none missing, (3) project-wide figures: each aggregatable indicator has baseline, target and verified life-of-project value (reuse `cumulativeDataItems` logic — move the predicate to domain and have both call it), (4) finance mode on + `PeriodFinancialSummary` VERIFIED (`FinanceInputsService.verifiedFor`), (5) all period activities accepted, evidence attached (R2) per template annex count, (6) donor template REVIEWED, (7) sign-offs: project manager and ME officer (from `Project.projectManagerId/meOfficerId`) assigned — approval itself stays the existing `ApproveReportHandler`.
2. **Application** `PlanClosingReportHandler` (read) and `StartClosingReportHandler` (writes): `Start` **delegates to `CreateReportingPeriodHandler`** with `reportType: FINAL` and the suggested closing dates (no duplicate period logic), then generates the checklist via the existing checklist generator. Refuses when a FINAL already exists with a pointer to it.
3. **Sign-offs**: reuse the checklist (`MISSING_APPROVAL` type exists) — one auto item per required signatory; no new approval engine.
4. **API**: `GET /v1/projects/:id/closing-report/plan`, `POST /v1/projects/:id/closing-report/start`.
5. **Web**: route `/projects/[id]/reports/closing` — a stepper (same visual language as `ReportingStepGuide`) where each step shows state and one CTA (confirm semantics, verify all, enter finance, accept activities, attach evidence, generate). Entry points: project header when the end date is within 60 days / all cadence periods approved, and the "New report" form's FINAL option links to it.

**Tests.** Domain: each rule × (done/todo/blocked); suggested dates (project end; clamps to last period). Handler: starts exactly one FINAL; delegates overlap/finance validation; idempotent re-open. Web: stepper state mapping.

**Acceptance.** An officer reaches a FINAL draft by following the stepper, with no overlap/finance refusal encountered.

---

## R7 — Link activities to logframe nodes + participants hint (Phase 23.5)

1. **Schema** (additive migration `…_activity_logframe_activity_link`): `ActivityUpdate.logframeActivityId String?` + index; `REQUIRED_PRISMA_FIELDS += {ActivityUpdate, logframeActivityId}`.
2. **Domain** `ActivityUpdate` gains `logframeActivityId` with validation in the handler (must be a `LogframeItem` of this project, level ACTIVITY, and — when `outputId` is also set — a descendant of that output). If only the node is given, `outputId` is derived from its parent (removes double entry). Contracts (`activities.ts`), DTO, repository, `import-activities.ts` (`activityCode` column optional, like `outputCode`), `NewActivityForm` (node picker via `LogframeItemSelect`, filtered by output).
3. **Logframe read-model**: `list-logframe` adds per ACTIVITY node `{ recordedCount, acceptedCount, lastActivityDate, participantsTotal }` (aggregate query, no N+1); `LogframeTreeEditor` shows delivery ("4 recorded · 3 accepted") so the nodes are no longer decoration.
4. **Participants consistency hint** (non-blocking): domain `participantsConsistency.ts`: (a) *within a record*: male + female (+ other) vs total, children/disability ≤ total; (b) *vs indicator*: for indicators whose unit/name marks people-counts, compare Σ accepted linked activities' `participantsTotal` with the period value; show *"Activities record 412 participants; the indicator says 380. People may attend more than one activity, so this may be fine."* only when the gap exceeds a configurable tolerance. Surface in `NewActivityForm` (a) and the period inputs grid / indicator row (b). Never blocks save, never enters the writer's inputs.

**Tests.** Validation matrix (wrong project, wrong level, node/output mismatch, derive output); import with codes; read-model aggregation; consistency rules (boundaries, missing numbers, tolerance). Migration scratch-DB test.

**Acceptance.** Recording an activity against a logframe node updates that node's delivery count; a mismatching participants total shows a hint, not an error.

---

## R10 — Usability-test the UI forms (Phase 23.6)

Cannot be performed by the engineering agent; this plan produces the instrument and a gate.
- **Protocol** (new `memorybank/demo/usability-test-protocol.md`): 3 officers (non-engineers, one per role: M&E, programme, finance); 6 tasks drawn from the journey table (create project + activate; define indicator and read its calculation; create the closing report; attach evidence to an activity; clear flags on one section; download the report); think-aloud, no coaching; record time-to-complete, errors, wrong turns, SUS + one-line "what surprised you".
- **Success bar**: ≥ 5/6 tasks completed unaided per participant; median SUS ≥ 75; no task with the same failure for 2+ users (that becomes a P1 fix).
- **Instrumentation** (optional, privacy-safe): none beyond existing audit; no new telemetry is added by this plan.
- **Output**: findings appended to a new `demo/verification-demo-5.md` (`verification-demo-4.md` is the UI-driven WASH run, see "Verification outcome" below); scores in the same 1–5 rubric so they compare with demo 3.

---

## 3. Cross-cutting checklist

- **Contracts**: every new/changed schema in `packages/contracts` first (additive, optional), then domain → application → infrastructure → api → web. Web response schemas in `apps/web/src/lib/server/schemas.ts` updated in the same change.
- **Audit**: new mutating handlers — confirm semantics, verify-all, section resolve/approve, link evidence, start closing report, activity link — each write `audit_events` (event names listed per rec).
- **Authorization**: each new handler checks the same permission as the action it composes (verify, approve, resolve claim, create period); UI hides buttons but the handler is authoritative.
- **Tenancy/RLS**: new queries are tenant-qualified; no new tables, so no new RLS policy; both migrations are additive nullable columns.
- **i18n**: new user-visible strings go through the copy modules; blueprint/period titles continue to use `classificationTitle()`; the writer contract (Python SSOT + TS mirror) is **not** touched by this phase — `pnpm` parity test `test_ts_contract_mirror_is_string_identical` must stay green.
- **Docs**: update `Features/04, 06, 07, 10, 12, 13, 22`, `features.md`, `pending.md`, and add outcome notes to this file per phase; add new invariants (rule single-source, flag classification is presentation-only, one evidence linker) to `AGENTS.md`.
- **Out of scope**: changing verification/gate logic, writer contracts, export renderers, billing, the extraction pipeline.

## 4. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Readiness stage change alters stored scores / dashboards | SUBMISSION weights = current weights, golden-pinned; stage is additive in the payload; recompute is idempotent |
| Flag classification hides a real error as "unconfirmed" | Numeric/material deterministic failures are always REPORT_ERROR; unknown/new codes default to **NEEDS_DECISION** (fail safe); exhaustiveness test; gate untouched |
| Evidence backfill misassigns ids | Backfill keys on an exact IndicatorUpdate-id join; scratch-DB test with both kinds; reversible (column drop) |
| Rules extracted from the period handler change refusals | Parity test per type; existing `ensure-auto-period` / report-type tests must stay green unchanged |
| Confirming semantics en masse locks in a wrong default | Confirm only copies the *effective* semantics, direction stays NEUTRAL, shows the summary first; reversible through the existing semantics card |
| Verify-all verifies unreviewed data | Same permission and same `reviewIndicatorUpdate` path as one-by-one verify; scoped to the period; per-item result list |
| Scope creep across 10 recs | Phase gates; each phase deploys alone; only two migrations |

## 5. Definition of done (per phase)

All quality gates in §0 pass on a fresh build; browser verification of that phase's acceptance scenario recorded in `memorybank/demo/` notes; `/ready` green; deploy recorded; this file's status line updated with the date and outcome.

---

## Implementation notes (2026-10-05)

**In short:** all ten recommendations are in code except R10, which is a research protocol. Domain rules, handlers and ports were added before UI, every rule has table-driven tests, and only two additive nullable columns were migrated. Verified: full build and typecheck clean; domain 380, application 320, infrastructure 304, web unit 214 tests green; both migrations applied to a scratch Postgres (evidence backfill checked on seeded rows); and a visible-browser pass confirmed the lifecycle banner, confirm-calculation, the "What you can create" panel and the closing-report stepper. Not exercised in a browser (they need a generated report): readiness stages and top-3, flag review with one-note approval, evidence upload with "use as proof", verify-all. One pre-existing API test (`foundation.test.mjs` RBAC, expects viewers to be refused the exports list while `VIEWER` holds `report.export`) fails independent of this work.

What was built, and the deliberate differences from the plan above.

What was built, and the deliberate differences from the plan above.

| Rec | Where it lives | Differences from the plan |
|---|---|---|
| R1 | `indicator-semantics-description.ts` (domain), `ConfirmIndicatorSemanticsHandler`, `POST /v1/indicators/semantics/confirm`, `SemanticsBadge` / `ConfirmSemanticsButton`, checklist type `INDICATOR_SEMANTICS_UNREVIEWED` (+ auto-close in `DetectMissingEvidenceHandler`), `ProjectReadiness.warnings` | The generation-preflight button was not added; the logframe page carries "Confirm all (n)". The `PUT /v1/indicators/:id/semantics` route had **no permission rule**; it now requires `logframe.manage`. |
| R8 | `BulkUpsertIndicatorUpdatesHandler` returns `updates[]`; `VerifyPeriodIndicatorUpdatesHandler`, `POST /v1/reporting-periods/:id/indicator-updates/verify-all`; grid "Save & verify all" / "Verify all (n)" | "Save & verify all" verifies **every** unverified value of the period (not only the rows just saved). |
| R4 | `readiness-calculator.ts` (stages, `READINESS_WEIGHTS_BY_STAGE`), `readiness-blockers.ts` (`READINESS_BLOCKER_RULES`, `rankReadinessBlockers`); `CalculateReadinessHandler` returns `stage`, `topBlockers`, `totalSections`; `ReadinessBreakdownList` "Top things to do" | DRAFTING weights are 0.30/0.25/0.25/0.20/0 (approval 0). SUBMISSION is byte-identical to the old formula (golden-pinned). The contradiction blocker's points = uncapped overall − capped overall. |
| R5 | `flag-classification.ts` (`FLAG_CLASS_RULES`, `classifyFlag`, `isBulkAcceptable`), `ResolveSectionFlagsHandler`, `POST /v1/report-sections/:id/resolve-flags`, `flagClass` on claim DTOs, grouped `ReportReviewPanel` + `SectionFlagsDecision` | **Bulk-acceptable = every UNCONFIRMED flag regardless of materiality** (not "non-material only"): material causal claims the checker is only *unsure* about would otherwise make a section unapprovable. The note (≥ 10 characters) is mandatory and audited. Figure errors and integrity/policy decisions are never accepted in bulk. |
| R2 | migration `20261006100000_evidence_indicator_update_link` (+ backfill), `EvidenceLinkService` / `IEvidenceLinker`, `GetEvidenceSupportHandler`, `GET /v1/{activities,indicators}/:id/evidence-support`, `ReportClaim` repo `findCitingEvidence`, `EvidenceSupportPanel`, "Use as proof for" on the upload form, range text in `Pagination` | No separate `IEvidenceSupportQuery` port: the handler composes the existing narrow repositories. The attach contract already accepted `indicatorUpdateId`; `AttachEvidenceHandler` also resolves an indicator id through the file's period. `UpdateActivityHandler`'s own attach/detach path still has its own code (not yet routed through the linker). |
| R3 | `period-type-rules.ts` (`describePeriodTypes`, `findCadenceOverlap`, `periodOverlapMessage`), `GetPeriodOptionsHandler`, `GET /v1/projects/:id/period-options`, `PeriodTypeGuide`, `project-lifecycle.ts` + `ProjectLifecycleBanner`, `validationTitle` (API error handler) | Unavailable types are labelled and explained but **not hard-disabled** in the select (the server still refuses with the same sentence). Finance rules were not in the create handler, so the guide reads `FINANCE_REPORT_TYPES`. Validation 400s keep their `errors` array and now also carry the cause in `title`. |
| R9 | `workflow-rules.ts` (`WORKFLOW_ORDER`, `WORKFLOW_RULES`), `/help/how-it-works`, tour steps reordered and carrying a `rule` | **No new tour step ids**: the public tour uses a screenshot per step id, so the rules are attached to the existing steps instead. |
| R6 | `closing-report-plan.ts` (`CLOSING_STEP_RULES`, `planClosingReport`, `missingCumulativeFields`, shared with the period checklist), `PlanClosingReportHandler` / `StartClosingReportHandler` (delegates to `CreateReportingPeriodHandler`), `GET …/closing-report/plan`, `POST …/closing-report/start`, `/projects/:id/reports/closing` | Unmet steps guide but do not forbid starting. Finance is an `AFTER_START` step (it is entered per period). Sign-offs = project manager and M&E officer assigned (no new approval engine). |
| R7 | migration `20261006110000_activity_logframe_activity_link`, `activity-node-link.ts`, `ActivityLinkResolver`, `activity-delivery.ts`, `participants-consistency.ts`; delivery on ACTIVITY nodes in `list-logframe`; node picker on `NewActivityForm`; per-row hint in the period inputs grid | The activity import's code column may now name a logframe **Activity**: it links the node and derives the output. Participant hint tolerance is 5 %. |
| R10 | `memorybank/demo/usability-test-protocol.md` | Not executable by an engineer; needs three real officers. |

New invariants (also in `AGENTS.md`): a period rule is written once and called by both the refusing handler and the explaining panel; flag classification is presentation only and fails safe to "needs a decision"; `IEvidenceLinker` is the only code that links a file to an activity / indicator update; readiness SUBMISSION scores equal the pre-Phase-23 formula.

Deploy notes: apply migrations `20261006100000_evidence_indicator_update_link` and `20261006110000_activity_logframe_activity_link` (additive, nullable); re-run `infra/postgres/rls.sql` per the runbook; `/ready` now also requires `EvidenceFile.indicatorUpdateId` and `ActivityUpdate.logframeActivityId`.

---

## Verification outcome (demo 4, 2026-10-05)

Full notes, numbers and the 19 findings: [`../demo/verification-demo-4.md`](../demo/verification-demo-4.md). Files: `../demo/verification-demo-4-artifacts/`; scripts: `scripts/demo-wash-ui/`.

**What was done.** A six-month WASH project ("[DEMO] Safe Water & Sanitation…", tenant GEC, production) was built **only through the web UI** in one visible browser: project, imported logframe and indicators, two donor
templates, five monthly periods and a FINAL period from the closing-report stepper, 48 verified indicator values with sex breakdowns, 37 activity records, 59 verified evidence files, verified finance, then one AI final report
(12 sections) that was reviewed, approved section by section and downloaded as Word, PDF, spreadsheet and checklist.

**Phase 23 items now verified in a browser:**

| Rec | Result |
|---|---|
| R1 semantics | Rates showed "Calculation needs review"; "Confirm all (2)" cleared them; "Reported directly (latest value)" offered. Minor: the indicator page says "Not confirmed yet" under a "Calculation confirmed" badge |
| R8 verify-all | One click verified a whole period (8 values) six times; grid shows ids and status |
| R3 rules up front | Lifecycle banner and Activate worked; "What you can create" panel listed every type with a reason; the closing-report stepper created the FINAL period with no overlap/finance refusal |
| R6 closing report | Stepper worked, but it **dropped the approved Final donor template** (finding 2) and its "Earlier reports approved / Activities accepted" steps cannot be cleared by a single-user tenant or a superseded record |
| R5 flag review | Flagged statements grouped as "needs a decision"; *Keep with a note* worked; "Approve all clean sections" worked. Raw reason codes still leak in checklist text |
| R4 readiness | "Things to finish" panel with links worked; the score fell 70% → 40% after one section was regenerated with no explanation |
| R2 evidence | Upload with "Use as proof for" attached to the activity immediately; **but the period link is still manual** (finding 3) |
| R7 activity ↔ node | Node picker derived output and indicator; **not exercised:** delivery counts on logframe nodes and the participants-vs-indicator hint |
| Not exercised | Evidence-support panel ("cited by n statements"), R9 tour |

**Result in one line:** the rules are now explained, but linking is still done *after* the fact in separate screens, and several flows still end in dead ends. The 19 findings are mapped to fixes below.

---

## Phase 24 — Recommendations from the demo 4 findings

Moved to its own plan: **[`Phase24-user-simplicity.md`](Phase24-user-simplicity.md)** (R11–R19: link at creation, editable indicator model, template inheritance, writer guard and reopen, activity review, live checks, exports, shorter journey; with
design, touch points, tests, acceptance and a finding → recommendation mapping).
