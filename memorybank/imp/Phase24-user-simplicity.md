# Phase 24 — User simplicity: implementation plan

**Status (2026-10-07): built (24.1–24.5), deployed and re-verified in a browser; see §9 for what was built, what differs from this plan and what is deferred.**
Revised 2026-10-06 after a code review of the first draft (scope cut, causes verified, SOLID design rules added).
Source: the 19 findings of the UI-driven WASH run, [`../demo/verification-demo-4.md`](../demo/verification-demo-4.md), and the product direction "fewer steps, links chosen while creating things"
(follows Phase 23, [`PHSE23-userfriendliness.md`](PHSE23-userfriendliness.md)). Finding numbers below refer to demo 4.

**Vision: a user states a fact once, and every link follows from it.** Recording one delivered activity with its proof took **five screens** in demo 4 (create activity → accept → upload evidence → verify evidence →
link evidence to its period), plus a sixth for the indicator value. The target is **one form and one review step**, with no dead ends and no stale or internal text shown to the user or the donor.

**Scope rule for this phase: fix the cause, smallest change first.** Several first-draft items were larger than their verified cause (see §8). Each item below names the verified cause and the minimal fix; bigger ideas are in §6 *Deferred*
and come back only if the 24.6 re-run shows the minimal fix is not enough.

Constraints inherited from `AGENTS.md` apply to every workstream: domain stays pure; application defines handlers and ports only; one repository per aggregate; routes thin and Zod-validated; **every mutation writes
`audit_events`**; `Result<T, DomainError>` for expected failures; new Prisma columns used in `select/create/where` go into `REQUIRED_PRISMA_FIELDS` (`apps/api/src/routes/health.ts`) in the same change; never run `prisma format`;
package tests run against `dist/` (build contracts → domain → application → infrastructure first); rules recognise sections by `classificationTitle()` / `canonicalTitle`; Python SSOT + TS mirror stay in lockstep and
`test_ts_contract_mirror_is_string_identical` stays green. Phase 23 invariants still hold: one source per rule, flag classification is presentation only, `IEvidenceLinker` is the only code that links a file to an activity or indicator update,
readiness SUBMISSION scores stay golden-pinned.

---

## 0. Principles, design rules and gates

**Product principles** (each workstream is checked against them in review)

1. **Link at creation, never after.** Whatever the user creates lets them pick or confirm its links in that same form, defaulted from what is already known.
2. **Derive, don't ask.** Evidence period from its activity, template from the report type. Show the derived value; allow override.
3. **One place per fact, visible from both sides.** An activity lists its evidence; a file lists what it supports.
4. **No dead ends.** Every state (needs revision, superseded, wrong parent, approved section) has a visible way forward or out.
5. **Fewer, bulk, reversible steps.** Bulk accept, one-click resolve with undo.
6. **Never show something stale or internal.** Checks are live; internal scores and reason codes never appear in donor text or user copy.

**SOLID design rules (mandatory; reviewers reject a change that breaks one)**

| Principle | Rule in this codebase | How it is checked |
|---|---|---|
| **S — Single responsibility** | One handler = one use case; one policy object = one rule; one repository per aggregate. A handler that needs another use case **composes** it through its port, it never re-implements its rules. Domain policies (pure functions/objects) decide; handlers orchestrate load → decide → save → audit; routes only validate and map. | No handler file holds a business rule that also exists elsewhere (grep the rule name); each new policy has its own table-driven test file. |
| **O — Open/closed** | New behaviour is added by registering a rule, not by editing a branch: rule tables (`CHECKLIST_STATE_RULES`, `WRITER_EXCLUDED_KEYS`, `DONOR_TEXT_LINT_TERMS`, activity transition table, `READINESS_BLOCKER_RULES`). Existing handlers are extended by **decorating or composing**, not by `if (newCase)` inside them. | Adding one more rule in each table needs no change outside the table and its test (exhaustiveness tests enforce it). |
| **L — Liskov substitution** | Every new port has an in-memory and a Prisma implementation that pass **the same contract test suite** (`*.contract.test.mjs`); a fake used in handler tests must behave like the real one (same not-found, tenancy and ordering semantics). Extended ports keep old callers working (new methods, never changed signatures). | Shared contract suite runs against both implementations. |
| **I — Interface segregation** | Ports are small and named by need, not by table: e.g. `IPeriodEvidenceScope` (read: which evidence belongs to a period), `IDefaultTemplateResolver`, `IIndicatorApprovalGuard` — not new methods piled onto `IEvidenceRepository` or `IReportingRepository`. A handler depends only on the ports it calls. | A handler's constructor lists only ports it uses (lint in review); no port gains more than the methods its first consumer needs. |
| **D — Dependency inversion** | Application depends on ports; infrastructure implements them; the container (`apps/api`) wires them. Domain policies receive plain data, never repositories. Web calls the API through existing server actions, never imports application/infrastructure. | `packages/application` imports nothing from `@donordesk/infrastructure`; domain imports nothing outside domain (existing dependency check). |

**Quality gates (every phase)** — as Phase 23 §0, plus:

1. `pnpm -r typecheck` and `pnpm -r build` clean; package tests on a **fresh** `dist/`; `pnpm --filter @donordesk/infrastructure reporting:eval` shows no golden-corpus regression.
2. Table-driven domain tests for every new rule; handler tests with in-memory ports; **port contract tests** run against both implementations (L); **golden tests pinning existing behaviour** wherever a function is changed.
3. Migration phases only: apply on a **scratch DB** on the dev Postgres, re-run `infra/postgres/rls.sql`, confirm `/ready` with the new `REQUIRED_PRISMA_FIELDS`, round-trip a repository test.
4. **Browser verification in one visible window** (CDP attach), re-running the demo-4 journey with `scripts/demo-wash-ui/` adapted to the new flow; completion detected from the UI; helper processes killed by pid.
5. Accessibility: new controls keyboard-operable and labelled, status by text not colour alone, mobile width checked.
6. Back-compat: API changes **additive**; nothing removed this phase.
7. Deploy per `contabo-ops.md` + `scripts/deploy-fast.sh`; gate on a fresh green run; record the deploy in `memorybank`.
8. **Measures** (re-run at 24.6, same rubric as demos 3 and 4). **Baseline the click count in 24.0 before any change**, otherwise "halve it" cannot be checked.

| Measure | Demo 4 | Target |
|---|---|---|
| Screens to record one activity with evidence | 5–6 | **1 form + 1 review** |
| Dead ends met in the journey | 4 | **0** |
| Stale or reopened items on a finished report | 5 | **0** |
| Checklist items a user must resolve by hand for a correct report | 4 | **≤ 1** (true attestations only) |
| Manual per-file period links | 59 | **0** (incl. existing projects, via backfill) |
| Rebuilds caused by an unfixable set-up mistake | 2 | **0** |
| Clicks to record one month (8 indicator values, 6 activities, their evidence) | baseline in 24.0 | halve it |

---

## 1. Delivery order

| Phase | Items | Closes findings | Schema |
|---|---|---|---|
| **24.0** Baseline | click-count script on demo 4 project; no code change | — | none |
| **24.1** Evidence follows its activity; robust forms | R11, R18 | 3, 12, 13, 17 | none (data backfill only) |
| **24.2** Indicator model and templates | R12, R13 | 2, 4, 5, 16, 18 | `Indicator.archivedAt` (additive, nullable) |
| **24.3** Writer guard and review flow | R14, R15 | 1, 6, 7, 14 (hint only) | `ActivityUpdate` WITHDRAWN state + `supersededById` (additive) |
| **24.4** Trustworthy checks and exports | R16, R17 | 8, 9, 10, 11, 15, 19 | none |
| **24.5** Create all periods | R19 (cut) | (vision) | none |
| **24.6** Validate with people | re-run demo 4 UI-driven; the R10 usability test of Phase 23 | all | none |

---

## 2. P1 — Unblock the core flow

### R11 — Evidence follows its activity *(findings 3, 12, 17)*

**Verified cause.** `ActivityUpdate.reportingPeriodId` is **required**, but `EvidenceLinkService.linkActivity` never copies it to the evidence. Worse, "which evidence belongs to a period" has **three definitions**:
`taggedEvidenceIds` (`services/period-evidence.ts`, used by generation: period-tagged ∪ evidence of the period's activities), `CalculateReadinessHandler` (`compliance/calculate-readiness.ts:91`, period-tagged only) and the
report-inputs panel / export wizard (period-tagged only). That is why generation worked while the panel said "0 files". `taggedEvidenceIds` also caps at `pageSize: 200` (silent truncation on a large project).

**Design.**

1. **One rule for period evidence (S, I, D).** Domain policy `periodEvidenceScope({ period, reportKind, activityIds }) → { mode: "PERIOD" | "PROJECT", activityIds }` (pure; roll-up kinds FINAL/ANNUAL/SEMI_ANNUAL → `PROJECT`, sensitive excluded by default; reuses `period-comparability` / life-of-project helpers so "what a roll-up covers" is defined once).
   Application port `IPeriodEvidenceScope.evidenceIdsFor(ctx, periodId, { includeSensitive? })` implemented by one service that applies the policy and pages through the repository (no 200 cap). **Every consumer switches to it**:
   generation (`taggedEvidenceIds` becomes a thin adapter, then is removed), `CalculateReadinessHandler`, `RecordChunkBuilder.evidenceIds`, the report-inputs panel, the export wizard and the evidence package. Golden test: generation input for demo-4 periods unchanged.
2. **Derive the period on link (S, O).** In `EvidenceLinkService.linkActivity`: if the evidence has no `reportingPeriodId`, set it from the activity, audited as `evidence.period_derived` with source `activity`. An explicit period always wins (override kept; library select stays as override only). Lives in the linker because the linker is the only code that links (Phase 23 invariant); the rule "explicit beats derived" is a domain function `resolveEvidencePeriod(explicit?, fromActivity?)`.
3. **Backfill.** One idempotent script (`scripts/backfill-evidence-period.ts`, through the same `resolveEvidencePeriod`) for existing evidence with an activity and no period; dry-run count first; audited. Without it, existing projects still read "0 files".
4. **Upload on the activity form.** `NewActivityForm` gets an *Evidence* drop zone. On submit the web action creates the activity, then uploads each file with `activityId` through the **existing** upload route (per-file result list with retry; the activity is never lost because a file failed). No new combined endpoint this phase (see §6).
5. **Add evidence from the activity.** *Add evidence* on every activity row/page opens the evidence form pre-linked (`?activityId=`); the form shows the derived period with its source ("from the activity: Monthly · Mar 2026").
6. **Pickers show context (S).** One web formatter module `option-labels.ts`: activities `A1.1 · 6 Mar · Johi (Bhan Syedabad)`, periods `Monthly · Mar 2026` / `Final · Aug 2026`, recent first, type-to-search. Used by the activity form's period select, evidence form's activity/indicator selects and the library link select.
7. **Evidence detail fields.** `UploadEvidenceHandler` already stores `location`; trace the web form → server action → API route mapping for `location` and the uploaded date, and fix there (likely a dropped field in the action or the route schema). Detail page lists the evidence's links using the existing `GetEvidenceSupportHandler`.

**Tests.** Domain: `periodEvidenceScope` table (each report kind, sensitive on/off), `resolveEvidencePeriod` table. Application: linker derives the period and an explicit period wins; port contract suite for `IPeriodEvidenceScope` (in-memory + Prisma, > 200 files); readiness and inputs panel agree with generation for the same period. Backfill: idempotent, dry-run equals applied count. Web: formatter; per-file result list.

**Acceptance.** Uploading against an activity shows the file in the report inputs at once with **zero** per-file linking; the demo-4 project shows 59 files after backfill; a FINAL report's wizard offers all verified project evidence; readiness, inputs panel and generation report the same evidence count.

### R18 — Forms that never double-submit or leave you guessing *(finding 13)*

**Design.** **Find the cause first** (likely `router.push` after a slow server action, or an error swallowed after the record was saved); fix it. Then the existing `apps/web/src/lib/client/action-state.ts` gets a `useSubmit` hook (extend, do not fork): disable on click, success toast, always navigate or show why it stayed. Server-side idempotency is **deferred** (§6) unless the cause is shown to be server retries.

**Tests.** Hook unit test (double click sends one request); e2e on the logframe-item, activity and evidence forms.

**Acceptance.** Ten rapid double-clicks on each of the three forms create exactly one record; every save navigates or states why not.

### R12 — Make the indicator model editable and honest *(findings 4, 5, 16, 18)*

**Verified cause.** No update/archive handler exists for indicators (`use-cases/logframe/` has create, import, semantics only); `disaggregationRequired` is only set by import; import ties indicator code to node code.

**Design.**

1. **Edit, move, archive — separate use cases (S, I).** `UpdateIndicatorHandler` (name, unit, baseline, target, means of verification, data source, frequency, `disaggregationRequired`), `MoveIndicatorHandler` (`logframeItemId`) and `ArchiveIndicatorHandler` (soft archive once values exist; hard delete only with none). Invariants on the aggregate (`Indicator.update`, `Indicator.moveTo`, `Indicator.archive`: type immutable once values exist; target node in the same project and a valid level). The "used in an approved report" rule is a small port `IIndicatorApprovalGuard.isUsedInApprovedReport(indicatorId)` consumed by Move and Archive only. Audit before/after. Routes `PATCH /v1/indicators/:id`, `POST /v1/indicators/:id/move`, `POST /v1/indicators/:id/archive`; `REQUIRED_PRISMA_FIELDS += Indicator.archivedAt`; archived indicators excluded from lists, the grid, generation and readiness through the repository's default filter (one place).
2. **Breakdown is a setting.** "Break results down by" in `NewIndicatorForm` and the indicator page; default rule `defaultBreakdown(unit)` in domain (Sex on for people/persons/households/children). The grid shows *Breakdown* when enabled; the existing `DisaggregationEditor` gets a compact inline layout.
3. **Show what you picked.** "Measures" options use the R11 formatter with level and path (`Output 2.2 · Hygiene promotion delivered…`); the save confirmation names the node. *Add indicator* on each logframe node is the primary path.
4. **Import accepts several indicators per node.** Optional `Logframe code` column (alias `Output code`) in `indicator-parser.ts` / `header-vocab.ts`; absent → today's behaviour (golden test). Document `Disaggregation Required` in the template.
5. **Copy fix.** The indicator page sentence reads from `describeSemantics`, so badge and text cannot disagree.

**Tests.** Domain invariants table (update/move/archive × has values × approved use); `defaultBreakdown` table; parser with/without `Logframe code`. Application: each handler audited, tenant-scoped; guard contract suite. Web: grid shows *Breakdown* after enabling.

**Acceptance.** A wrong parent is fixed in two clicks; a people indicator records a sex split with no import; two indicators sit under one node by import.

### R13 — A report type uses its template by default, and the template can be changed *(finding 2)*

**Verified cause.** `PlanClosingReportHandler` computes `templateState` from `profile.defaultTemplateId` only (`use-cases/reporting/closing-report.ts:82`); `StartClosingReportHandler` creates the period without a template; no screen changes a period's template.

**Design.**

1. **One resolver (S, I, D).** Port `IDefaultTemplateResolver.resolve(ctx, projectId, reportType) → template | none`; implementation applies a pure domain rule `pickDefaultTemplate(candidates, reportType, profileDefault?)` (profile default if REVIEWED and type-compatible, else most recently reviewed of that type; ACTIVITY/SITUATION only their own type). Consumed by `CreateReportingPeriodHandler`, `PlanClosingReportHandler` and the new-period form's preselect, so stepper text and created period cannot disagree.
2. **Show it.** New-period form and closing stepper show "Template: GWHF Final Project Report ✓ · Change"; with none, they say the built-in structure is used and link to *Add template*.
3. **Change a template.** `ChangePeriodTemplateHandler`: before the first draft it re-pins `templateSnapshotJson`; after a draft it only re-pins and returns "regenerate needed" — regeneration stays the existing generate use case, triggered by the user (S: changing a template does not also generate). Audit old and new.

**Tests.** `pickDefaultTemplate` table (none, one, several, profile default, wrong type, not reviewed); closing plan and created period agree for every case; change before/after a draft; golden: periods without templates unchanged.

**Acceptance.** The demo's closing flow produces the donor's **9 sections** and names the template it will use; a wrong choice is changed in two clicks.

### R14 — Keep internals out of donor text, and let a reviewer fix approved text *(findings 1, 6)*

**Verified cause.** `readinessScore` is part of the writer's period context (`report-generation-context.ts:306`), printed into the legacy narrator prompt (`llm-report-draft-generator.ts:138`, "Readiness Score: …/100") and carried by the worker model (`models.py:108`).

**Design.**

1. **Stop sending workflow state to writers (minimal).** Remove `readinessScore` from the writer context type and both prompt builders; the worker field stays optional and ignored (back-compat with an older api). A single declared list `WRITER_EXCLUDED_KEYS` (readiness, approval/gate/checklist state) in the Python SSOT, mirrored to TS by the existing mirror test, is asserted by a test over the assembled prompt — **no contract version bump**: this removes an input, it does not change prompt wording for v2–v4 except the deleted line, which is noted in the deploy record and checked with `reporting:eval`.
2. **Donor-text lint (O).** Rule table `DONOR_TEXT_LINT_TERMS` (readiness, approval status, checklist, "requires verification before approval", gate) checked by one validator added to `artifact_validators` `runAll` (Python + TS twin); a hit becomes a `NEEDS_DECISION` statement.
3. **Reopen to edit.** `ReopenReportSectionHandler`: permission as approve, audited, section back to DRAFT with history, dependent synthesis sections marked stale through the existing staleness mechanism. `DocumentSection.tsx` shows *Reopen to edit* on approved sections.
4. **Rewrite takes an instruction.** *Rewrite with AI* gets the optional free-text `userInstruction` field already used by Regenerate (same `SectionBrief.userInstruction` / `buildAuthorInstructionBlock` path).

**Tests.** Golden: assembled prompts for demo-4 inputs contain no excluded key or its label; lint table; reopen handler (permission, audit, stale summaries, history).

**Acceptance.** A one-word fix after bulk approval is **two clicks**; a test fails if any excluded key reaches a prompt.

### R15 — Activity review without dead ends, and fewer review clicks *(findings 7, 14, and the 4-click accept)*

**Design.**

1. **Transitions as a table (O, S).** Domain `ACTIVITY_TRANSITIONS` (SUBMITTED, NEEDS_REVISION, ACCEPTED, REJECTED, WITHDRAWN × submit/resubmit/accept/request-revision/reject/withdraw/restore) enforced by the `ActivityUpdate` aggregate; handlers only call aggregate methods.
2. **Resubmit.** `ResubmitActivityHandler` (separate from `UpdateActivityHandler`, which keeps its attach/detach job): in NEEDS_REVISION the submitter edits the pre-filled form with the reviewer note on top; *Resubmit* → SUBMITTED, history kept.
3. **Withdraw / superseded.** `WithdrawActivityHandler` with optional `supersededById`; WITHDRAWN is excluded from "not accepted" counts, the closing plan and reports through one domain predicate `countsTowardReport(activity)`; reversible by a manager; audited. `REQUIRED_PRISMA_FIELDS += ActivityUpdate.supersededById`.
4. **Bulk accept.** `BulkReviewActivitiesHandler` composes the existing `ReviewActivityHandler` per item (no duplicated rules), shared note, per-item results (pattern of `VerifyPeriodIndicatorUpdatesHandler`). Single accept becomes one step with an inline optional note.
5. **Solo officer (hint only).** `ProjectMember` is unique per (tenant, project, user); relaxing it touches every permission check, so this phase only adds a plain hint on the closing plan and team page explaining who can sign off and how to invite a second person. Multi-role / self sign-off is deferred (§6).

**Tests.** Transition table × actions; bulk partial failure; closing-plan counts exclude WITHDRAWN.

**Acceptance.** Six monthly activities accepted in **one action**; a revision request answered on the same page; a replaced record no longer blocks the closing plan.

---

## 3. P2 — Make the checks trustworthy and the exports right

### R16 — Live checks, no stale or reopened items *(findings 8, 9, 10, 15, 19)*

1. **One-step resolve with undo.** Remove the second confirm; toast "Resolved · Undo". A failed action shows a message. Accept-risk / not-applicable keep one confirm.
2. **State items derived from data (O).** `CHECKLIST_STATE_RULES`: one rule object per state item (`{ code, appliesTo(period), isSatisfied(facts) }`), facts loaded once per read by a single `ChecklistFactsLoader` (S; uses R11's `IPeriodEvidenceScope` and the R15 `countsTowardReport` predicate, so roll-ups count project data). Satisfied state items show as done automatically. **Classification is explicit per item** in the table: *state* (activities accepted, finance verified, breakdowns recorded, sections approved) vs *attestation* (sign-off, sensitive-data handling, procurement records, **AI content reviewed** — a person must attest it, it is not inferred from approvals). An exhaustiveness test fails on an unclassified item. A human-resolved item is reopened only with a stated new cause.
3. **Live preflight.** `GetExportPreflightHandler` and the wizard read current state, exclude resolved items, show "Checked 2 min ago · Re-check".
4. **Lint compares like with like.** Divergence key includes **period basis** (this period vs life-of-project) and **unit**; a lint issue can be explained with a note; written dates (`Aug 31, 2026`) ground to their ISO date (`number-grounding.ts` + `grounding.py` in lockstep).
5. **No raw codes in user strings.** Extend the `reporting-copy` exhaustiveness test to checklist and gate descriptions (`[A-Z_]{4,}` in rendered text).
6. **Readiness explains change.** `CalculateReadinessHandler` stores the previous score and the top changed blocker; `ReadinessGauge` shows "70% → 40%: section 3 regenerated, re-check needed".

**Tests.** Rule table (each rule × satisfied/unsatisfied/not-applicable); classification exhaustiveness; resolved stays resolved across scans; preflight golden unchanged for an unchanged report; lint pairs; written dates; copy test.

**Acceptance.** On a correct finished report the user resolves only true attestations; the wizard never lists a resolved item or a figure no longer in the text; no raw code is visible.

### R17 — Exports match the report's kind *(finding 11)*

FINAL / ANNUAL / SEMI_ANNUAL indicator spreadsheets add **baseline, target, life-of-project value and % of target** beside the period value, from the same `lifeOfProject` data as the report table. Column definitions live in one table shared by the sheet, CSV and Word/PDF indicator table (S). Evidence package uses `IPeriodEvidenceScope` (R11) with a count and size preview.

**Tests.** Golden monthly (unchanged), new golden FINAL; size preview; sensitive excluded by default.

**Acceptance.** The demo's FINAL spreadsheet shows 14,000 (life of project) beside 2,800 (August).

---

## 4. P3 — Shorter journey (cut to one item)

### R19 — Create all periods at once

From the project dates and cadence: preview ("6 periods: Mar–Aug; the last is the Final") and one **Create all**, implemented as `CreateAllPeriodsHandler` composing `CreateReportingPeriodHandler` per period (every rule still applies; per-period result). The preview uses the same `period-type-rules.ts` functions as `GetPeriodOptionsHandler`.

**Tests.** Preview equals what is created; partial failure per period.

**Acceptance.** A 6-month project's periods are created in one action.

**Open question to settle in 24.5 (not built yet):** does a FINAL report require the earlier periodic reports to be approved? Demo 4's closing plan kept "5 earlier reports not approved" as a To-do. Decide the rule, put it in `closing-report-plan.ts` only, and state it on the plan.

---

## 5. Cross-cutting checklist

- **Contracts first**: additive, optional schemas in `packages/contracts`, then domain → application → infrastructure → api → web; web response schemas in `apps/web/src/lib/server/schemas.ts` in the same change.
- **Audit**: `evidence.period_derived`, `evidence.period_backfilled`, indicator update/move/archive, period template change, section reopen, activity resubmit/withdraw/restore, bulk accept.
- **Authorization**: each handler checks its own action's permission; a composing handler relies on the composed handler's check (no duplicate checks with different rules).
- **Tenancy/RLS**: new queries tenant-qualified; no new tables; additive nullable columns only.
- **i18n**: user-visible strings via the copy modules.
- **Docs**: update `Features/` pages, `features.md`, `pending.md`, the invariants below in `AGENTS.md`, each phase's outcome here and the deploy in `memorybank`.
- **Out of scope**: verification/gate rules, billing, the extraction pipeline, number-grounding beyond R16's written-date fix.

**New invariants for `AGENTS.md` when built:** "which evidence belongs to a period" has one source (`IPeriodEvidenceScope` / `periodEvidenceScope`); evidence linked to an activity inherits its period unless one was given explicitly; writers never receive workflow state (`WRITER_EXCLUDED_KEYS`); every checklist item is classified state or attestation, and a human-resolved item is reopened only with a stated new cause; activity status changes go through `ACTIVITY_TRANSITIONS`.

## 6. Deferred (revisit only if the 24.6 re-run shows a need)

| Idea from the first draft | Why deferred |
|---|---|
| `POST /v1/activities/with-evidence` combined endpoint + `RecordActivityWithEvidenceHandler` | Period derivation + upload on the activity form gives the same one-form flow with existing routes |
| `deriveLinks` / `GET /v1/link-preview` (node → output → indicator) | The verified gap is only the period; indicator derivation from a node can mis-link when a node has several indicators |
| "Counts toward the indicator value" on the activity form | Second entry point for indicator values; grid + Verify all already work |
| Server idempotency store (`IIdempotencyStore`, new table + RLS) | Cause of the missed redirect not yet known; client fix first |
| Multi-role `ProjectMember` + "Allow self sign-off" | Changes a uniqueness constraint used by every permission check; solo tenants are not the target user |
| Writer contract v5 / allow-list refactor | Removing one input is enough; a denylist test guards it |
| Next-best-action button, ZIP import, copy-last-month | New products, not simplifications of the demo-4 journey |
| One combined "Set up your results" page | Edit/move + *Add indicator* per node removes the rebuilds; revisit after usability test |

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Derived evidence period is wrong | Only derived from the evidence's own activity; shown with its source; explicit period wins; audited; backfill dry-run first |
| Unifying the evidence rule changes generation inputs | Golden test on demo-4 generation inputs before/after; roll-up widening applies only to readiness/panel/export, whose counts already diverged |
| Moving or archiving an indicator corrupts an approved report | `IIndicatorApprovalGuard` refuses; otherwise audited and reversible |
| Removing `readinessScore` shifts output | `reporting:eval` before/after; deploy note |
| Auto-satisfied checklist items hide real gaps | Only *state* items, from live facts; explicit classification table with exhaustiveness test |
| SOLID drift during implementation | §0 rules checked in review: one rule per policy, ports small, contract suites for both implementations |

## 8. Revision note (2026-10-06)

Code review of the first draft found: (a) finding 3 is three competing definitions of period evidence plus a missing period copy in the linker, not a missing form — fixed by R11.1–R11.3, and a 200-file cap was found on the way;
(b) the score leaks through the legacy narrator prompt as well as the worker model — R14 now removes the input from both; (c) `location` is stored by the upload handler, so finding 17 is in the web/API mapping;
(d) several items (combined endpoint, link preview, idempotency store, multi-role, contract v5, next-best-action, ZIP import) were larger than their causes and moved to §6. SOLID rules were added to §0 and applied per item.

## 9. Outcome (2026-10-07)

**Built (commits 24.1 … 24.5 on branch `0009-agent-memory`).** Tests added or extended in every layer; port-level behaviour pinned with golden tests where a function changed.

| Item | Built | Differs from the plan |
|---|---|---|
| R11 | `periodEvidenceMode` / `isEvidenceInPeriodScope` / `resolveEvidencePeriod` (domain), `PeriodEvidenceScope` (read every page, no 200 cap) used by generation, readiness, the inputs panel, the export wizard and the export pack; linker copies the activity's period (audited `evidence.period_derived`); backfill migration `20261007100000_evidence_period_from_activity`; upload on the activity form with per-file results and retry; Add evidence from an activity; labelled pickers; the activity form derives the period from the date; real upload date on evidence detail | Port `IPeriodEvidenceScope` is a class-level service (`PeriodEvidenceScope`) behind the domain rule, not a separate interface file per consumer. Location was already saved: the blank "Uploaded" was the activity date shown under the wrong label |
| R18 | Cause found: the logframe-item and indicator forms re-enabled the button before the route change; they stay locked now | No idempotency store (deferred) |
| R12 | `UpdateIndicatorHandler`, `MoveIndicatorHandler`, `ArchiveIndicatorHandler`, `RestoreIndicatorHandler`, `IndicatorApprovalGuard`, `Indicator.archivedAt` (migration `20261007110000_indicator_archive`), breakdown setting with `defaultBreakdown`, `Logframe code` import column and template column, edit/move/remove card on the indicator page, copy follows the badge, breakdown editor fields constrained | |
| R13 | `pickDefaultTemplate` + `DefaultTemplateResolver` used by period creation, the closing plan (names the template) and the new-period form; `ChangePeriodTemplateHandler` and a card on the inputs page; `useBuiltInStructure` keeps an explicit "no template"; clearing a period's template now really persists (Prisma ignored `undefined`) | |
| R14 | `readinessScore` no longer sent to any writer (Python SSOT `WRITER_EXCLUDED_PERIOD_KEYS`, TS mirror, tests); workflow-vocabulary lint (`WORKFLOW_VOCABULARY`); Edit is available on approved sections (the handler already reopens and audits); Rewrite with AI takes an instruction | No contract v5 and no new `ReopenReportSectionHandler`: both were already covered |
| R15 | `ACTIVITY_TRANSITIONS` table enforced by the aggregate; `resubmit` (reviewer notes leave the text), `withdraw` / `restore` with `supersededById` (migration `20261007120000_activity_superseded`), bulk accept composing the single review, one-step Accept, closing plan and checklist ignore WITHDRAWN, solo-officer hint | Multi-role / self sign-off deferred |
| R16 | `CHECKLIST_KIND` (exhaustive) + `CHECKLIST_STATE_RULES`: state items close from data and are not raised when already satisfied, attestations never close by data and are not raised again once decided; one-step resolve with Undo (`REOPEN`); **the typed resolution note was never sent to the server: fixed**; "Checked at … · Re-check" in the export wizard; consistency lint compares by basis (period vs life of project) and a written date is not a figure; plain-language reasons from one domain table | Readiness change explanation (R16.6) deferred |
| R17 | `indicatorExportColumns` / `indicatorExportRow`: final/annual/semi-annual tables show this period, life of project and % of target (sheet, Word, PDF); the pack uses the shared evidence scope | Size preview deferred |
| R19 | `planCadencePeriods` + `CreateAllPeriodsHandler` + reports-page panel; the closing block is left to the closing report | Next-best-action, ZIP import, copy-last-month stay deferred (§6) |

**Deferred (unchanged from §6, plus):** readiness-change explanation (R16.6), evidence-pack size preview, "Add activity" on every logframe node, idempotency store. `IdempotencyRecord` already exists as a table; reuse it if a server-side key is ever needed.

**Findings while building (not in demo 4):** the checklist scan created a fresh item for a concern a person had already decided, and re-created state items it then closed (churn); the checklist note was dropped; an activity's reviewer note stayed inside the summary text that reports read.

**Known test status.** Package tests: domain 426, application 376, infrastructure 310, contracts 10, web 230+, worker 172. `apps/api` tests need a local Postgres; with one, two tests still fail for reasons older than this phase (`foundation` expects 403 for a VIEWER exporting while the policy gives VIEWER `report.export`; the billing webhook test).
