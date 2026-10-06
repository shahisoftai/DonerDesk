# Phase 25 — Stability and ease of use: implementation plan

**Status (2026-10-06): partly implemented, not deployed.** §2.1 fixes were deployed during demo 5. Since then the items marked **Done** in
[§0 Implementation status](#0-implementation-status) are built and tested in this working tree (uncommitted, no deploy, no browser run on production).
Everything marked **Not done** is still the plan as written below.
Sources: the 19 findings of the UI-driven WASH run, [`../demo/verification-demo-4.md`](../demo/verification-demo-4.md); the 13 findings of the UI-driven USAID health run,
[`../demo/verification-demo-5.md`](../demo/verification-demo-5.md); and the reflection on both runs (§1). Follows Phase 24, [`Phase24-user-simplicity.md`](Phase24-user-simplicity.md).
Finding numbers written `D4-n` / `D5-n` refer to demos 4 and 5.

**Goal.** A tenant can create a project, build its logframe, set up donor templates, run six monthly cycles and a closing report, and download donor-ready files **without a
dead end, a silent failure, a stale warning, a wrong number or an internal word in donor text, and without needing a developer or a server log to find out why something happened.**
Phase 24 made the *journey* shorter; Phase 25 makes it **dependable** (no silent failures, honest numbers, recoverable states) and **self-explaining** (every state says what
happened, why, and what to do).

Constraints from `AGENTS.md` and Phase 24 §0 apply unchanged: domain pure; application = handlers + ports; one repository per aggregate; thin Zod-validated routes; **every mutation
writes `audit_events`**; `Result<T, DomainError>`; new Prisma columns used in `select/create/where` go into `REQUIRED_PRISMA_FIELDS` in the same change; never `prisma format`; package
tests run against `dist/`; sections recognised by `classificationTitle()` / `canonicalTitle`; Python SSOT ↔ TS mirror kept in lockstep (`test_ts_contract_mirror_is_string_identical`);
Phase 23/24 invariants hold (one source per rule, flag classification is presentation only, `IEvidenceLinker` is the only linker, readiness SUBMISSION stays golden-pinned, writers never
receive workflow state, plain-language reasons from one table, Prisma `update` ignores `undefined`).

---

## 0. Implementation status

Verified with: `pnpm -r build` and `pnpm -r typecheck` clean; domain 465, contracts 10, application 406, infrastructure 325 package tests; worker tests 186; web unit 240;
API idempotency 6; artifact-validator tests; `reporting:eval` golden corpus byte-identical to the pre-change baseline; the migrations applied to a scratch Postgres with
`infra/postgres/rls.sql` re-run, a repository round-trip for each new column/table, and a local API smoke (real container, routes, `/ready` green, an 8-way simultaneous
create produced one record). The three API tests that need a `test` database role (`creem webhook`, `billing summary`, `RBAC`) fail on this machine without these changes too.

**Deploy order** (run for batches 1 and 2; releases `20261006125401` and the one after it): back up → migrations `20261008100000_section_generation_fallback`, `20261008110000_reporting_period_cancel`, `20261008120000_request_idempotency` →
re-run `infra/postgres/rls.sql` (adds `RequestIdempotency`) → `deploy-fast.sh` → `/ready` (now also requires `ReportSection.generationFallbackReason/Detail`,
`ReportingPeriod.cancelledAt/cancelReason`, `RequestIdempotency.responseJson`). All three migrations only add nullable columns or a new table.

| Item | Done | Not done |
|---|---|---|
| 25.0 | Fake AI writer scripted behaviours (`ai-reporter-recovery.test.mjs`); `scripts/demo-ui` (run lock, `waitForUi`, `step`, `phase25-check.mjs`) | `pnpm journey` handler journey test; baseline doc |
| 25.1 | Stored fallback reason + banner by reason; one automatic recovery; kind-based stubs; id/file-name lint (worker + TS); **cumulative percent-of-target grounding fix (root cause of D5-2)**; synthesis word-limit shorten retry; **writer contract v5** (rules, report structure, "not measured" line) behind `AI_REPORTER_CONTRACT_VERSION=5`, v2-v4 byte-stable; in-section regeneration notice; **Mark summary as current** (`summaryCurrentAt`, audited) | "Needs a decision" flag when a summary is still over its limit (the prose is kept and the count is in the run diagnostics); v5 is not the default yet (compare on the demo fixtures first) |
| 25.2 | `VerifiedFinding.status`; writer inputs REPORTED only; exports "Not measured"; `dueThisPeriod` in the grid; the writer is told which indicators were not measured (v5) | per-consumer property test beyond the calculator |
| 25.3 | Seal resolves requirements, plain refusals; `-final`/`-internal` names; checklist closes on read (audited); sentence splitter; percent grounding in the verifier; **one resolution step for bulk** (no second red Confirm) + attestation limits | wizard copy before/after export; "This matches a verified indicator" one-click; confidentiality gate link to the file; checks panel with buttons |
| 25.4 | **Compliance statements** per template compliance section (Tell the story tab, "Same as last month", standing statements, to-do count, reaches the writer as `officerNote`, stub and claim verification use it); **typed files on the activity form** (type suggested from the name, confidentiality, indicator preselected when the node has one); **suggestions with reasons** (`suggestEvidenceLinks`); **link panel on the file page**; **bulk evidence verify**; **start from an earlier record** and **Add activity** on a logframe node; blank, not "0", participants | field-report importer made section-aware; checklist type for a missing compliance note (the to-do shows in the Tell-the-story tab count instead) |
| 25.5 | **Default template per report type** (`defaultTemplateByType`, "Used for" chip, per-type buttons; uploading never changes a default); minor edits keep REVIEWED (already true, covered by tests) | word-limit chip on template cards |
| 25.6 | Cancel / restore / convert-to-final (auto-create no longer recreates a cancelled month; Cancel is offered only without a released report); idempotent creates with a retry of timed-out saves | banner "Created ... automatically"; per-step reasons on the closing page; export idempotency |
| 25.7 | plural helpers; string lint; **every form control labelled** (`Field` names its control); PDF text filter (WinAnsi) | readiness "what changed"; evidence-pack size preview; mobile pass |
| 25.8 | `signOffRoles`; **second-approver rule** (setting, enforced at approval, audited self sign-off); **attestations name who made them**, bulk attestation limited to Admin/PM | assigned attestations in My work; three-account journey test; invite list refresh |
| 25.9 | Billing fix; AI usage page; **settings error boundary with reference + Report this**; `/ready` AI-worker warning | operational alerts on the stub rate; pacing review |
| 25.10 | Production browser check of the first batch (below) | Demo 6 and failure drills |

---

## 1. Reflection: what the two runs say about the product

1. **The data model and the setup path are solid; trust breaks in generation and in checks.** Setup, imports, template extraction, the calendar, accept/verify and the editor all worked.
   Every severe finding in demo 5 sat where the product *decides something on the user's behalf and does not say so*: an auto-created period, a stub paragraph, a `0%` for a missing value,
   a watermark on an approved report, a checklist item that stays open.
2. **A silent fallback is worse than an error.** A section written by the stub reads like a finished section. The user can only tell by a small banner, and the reason lives in a server log.
   Fallbacks must be *visible, explained, recoverable in one click, and never lower quality than the section deserves*.
3. **Numbers need one definition, everywhere.** The same value can be "recorded", "missing", "partial" or "0" depending on which service computed it; three different services each decide
   what the writer sees. A missing value must be missing in every consumer (writer, table, chart, export, readiness, checklist).
4. **Checks must be live, bounded and decidable.** A check that cannot be cleared by any user action (a figure flag on a restated verified number, a sentence split by "no.") is a dead end
   even when the underlying report is right. Every blocker needs a defined user action: *fix the data*, *fix the text*, *decide with a note*, or *the system corrects itself*.
5. **The compliance half of a donor report has no input path.** USAID, EU and others require environmental, branding, gender, coordination and safeguarding statements. The product
   models indicators, activities, evidence and a four-question story, so these sections are written from nothing and say "no record".
6. **Two things were never designed for more than one person.** Sign-off, solo officers and the second-account journey (a field officer logging, an M&E officer verifying, a PM
   approving) were not exercised end to end. The first multi-user run found the invite, assignment and closing-plan checks disagreeing.
7. **Recurring friction is repeated work, not hard work.** Per month the run needed 8 activity forms, 15 evidence uploads, 15 single-file verifications, 17 values and a review.
   Everything repeatable (copy last month, bulk verify, templates for recurring activities) is an opportunity; everything that must be unique (a number, a note) must stay unique.
8. **Operations need to be observable by the product, not by `journalctl`.** The real cause of the two biggest demo 5 issues (validator rejection, provider timeout) was found only by
   reading the API log over SSH.

---

## 2. Findings inventory and status

### 2.1 Already fixed (deployed 2026-10-06, release `20261006074809`, commit `5a69cf4`) — keep, harden, add missing tests

| Id | Fix | Residual work in this phase |
|---|---|---|
| D5-1 | `EnsureAutoPeriodHandler` skips the block that reaches the project's end | 25.6: a banner on the Reports page stating what auto-create did; repair path for projects already affected (§3 P1-3) |
| D5-3 | Indicators without a value for the period are filtered out of the writer inputs (`report-generation-context.ts`) | 25.2: make "missing" a first-class state in the calculator, not a filter in one consumer |
| D5-4 | Export wizard "Copy" choice seals the snapshot and exports the donor copy | 25.3: contract test of the whole path; explain a failed seal in plain language |
| D5-2 (part) | Stub routing for progress/learning/priorities sections; clearer banner | 25.1 (the real fix) |

### 2.2 Demo 4 findings: status after Phase 24 and what remains

| D4 | Sev | State after Phase 24 | Remaining → item |
|---|---|---|---|
| 1 | H | Fixed (writer guard) | Add a donor-text lint for any evidence id / uuid / hex id → **25.1** (demo 5 found a new leak of the same kind) |
| 2 | H | Fixed (template inheritance) | Last uploaded template became the project default (D5-13): pick default by report type → **25.5** |
| 3 | H | Fixed (period from activity) | Evidence from the activity form carries no type or indicator → **25.4** |
| 4 | H | Fixed (breakdown on indicators) | none |
| 5 | M | Fixed (edit/move/archive) | none |
| 6 | M | Fixed (edit approved section) | Regeneration and section state feedback is silent (D5-10) → **25.1** |
| 7 | M | Fixed (resubmit) | none |
| 8 | M | Fixed (one-step resolve) | Bulk resolve still has a second red Confirm; make both paths the same → **25.3** |
| 9 | M | Partly (state items close from data) | Still open until "Scan for missing items" on a final period (D5-6) → **25.3** |
| 10 | M | Partly (freshness row; lint by basis) | Figure flags on restated verified numbers cannot be cleared except by "keep with a note" → **25.3** |
| 11 | M | Fixed (roll-up columns) | none |
| 12 | M | Fixed (labelled pickers) | Evidence form selects are unlabelled (D5-13) → **25.7** |
| 13 | M | Partly (button lock) | Still occurs: 4 of 17 uploads, first logframe item, template extraction (D5-12) → **25.6** |
| 14 | M | Hint only | Solo officer / second-account journey never verified → **25.8** |
| 15 | L | Fixed (plain reasons) | Add an automated "no raw code in UI strings" test → **25.7** |
| 16 | L | Fixed | none |
| 17 | L | Not verified | Re-check evidence detail Location/Uploaded → **25.7** |
| 18 | L | Fixed | none |
| 19 | L | Deferred (readiness change not explained) | **25.7** |

Deferred in Phase 24 and picked up here: evidence-pack size preview (25.7), "Add activity" on a logframe node (25.4), idempotency store for create forms (25.6), self sign-off rules (25.8).

### 2.3 Demo 5 findings → work items

| D5 | Sev | Finding | Item |
|---|---|---|---|
| 1 | H | Auto-created final month; closing report blocked; periods cannot be deleted | fixed + **25.6** (repair, cancel a period) |
| 2 | H | Silent stub fallbacks; progress section fails validation on derived figures; provider timeouts | **25.1** |
| 3 | H | Missing value reported as `0%` | fixed + **25.2** |
| 4 | H | Approved report exports stamped "internal preview" | fixed + **25.3** |
| 5 | H | `/settings/billing` fails: "Validation failed — limits.viewerSeats / aiCreditTopUp / byoLlmEnabled: Required" | **25.9** |
| 6 | H | Data-driven checklist items stay open until a manual scan | **25.3** |
| 7 | M | Writer leaks evidence ids, invents IR labels and cross-references; sentence split at "no." makes an uncleareable flag | **25.1** |
| 8 | M | No input route for compliance sections; field-report importer captures ~1 topic and fails to save | **25.4** |
| 9 | M | Activity-form evidence is type "Other", no indicator link; suggestions find nothing; no link control on the file page; no bulk evidence verify | **25.4** |
| 10 | M | Silent regenerate; stale-summary warning persists; word limit exceeded | **25.1** |
| 11 | M | Closing "Sign-offs assigned" stays To do with PM and M&E assigned; setup "Team assignment: Todo" | **25.8** |
| 12 | M | Forms do not redirect after save | **25.6** |
| 13 | L | "0 participants" when empty; unlabelled selects; garbled en dash in PDF; narrow PDF indicator table; grammar; project default template | **25.7**, **25.5** |

---

## 3. Delivery order

| Order | Item | Why this position |
|---|---|---|
| 0 | **25.0 Baseline and harness** | Nothing is measurable without a repeatable demo harness and fixtures |
| 1 | **25.1 Generation integrity** | Highest user impact: every report depends on it |
| 2 | **25.2 One definition of a number** | Feeds 25.1, 25.3 and the exports |
| 3 | **25.3 Checks and exports that can always be cleared** | Unblocks approval and submission |
| 4 | **25.6 Period lifecycle and form reliability** | Removes the unrecoverable states |
| 5 | **25.4 Capturing what donors ask for (compliance, evidence, activities)** | Largest design work; builds on 25.1/25.3 |
| 6 | **25.5 Templates and defaults** | Small |
| 7 | **25.8 Roles and sign-off** | Needs 25.3 for the approval rules |
| 8 | **25.9 Billing, health and observability** | Independent; schedule alongside 25.1 if a second developer is free |
| 9 | **25.7 Polish and accessibility** | Last, so it does not churn |
| 10 | **25.10 Re-run (demo 6) and sign-off** | Acceptance |

Each item ships as its own commit and its own deploy (backup → migrations → `deploy-fast.sh` → `/ready`), as in Phase 24.

---

## 4. Quality gates and measures

**Gates (every item):** `pnpm -r typecheck` and `pnpm -r build` clean; package tests on a fresh `dist/`; `reporting:eval` golden corpus without regression; worker tests
(`apps/workers/.venv/bin/python -m pytest tests`) and the artifact-validator tests; table-driven domain tests for every rule; port contract tests against in-memory **and** Prisma
implementations; migrations verified on a scratch DB with `infra/postgres/rls.sql` re-run and `/ready` green; browser verification in **one visible window** with the demo scripts;
keyboard/label/mobile checks on new controls; API changes additive.

**Measures (re-run at 25.10; baseline in 25.0).**

| Measure | Demo 5 | Target |
|---|---|---|
| Sections written by the stub per generated report (first generation) | 1–2 of 8 in 4 of 6 reports | **0 silent**; any stub is labelled with its reason and offers a one-click retry |
| Reports needing a manual workaround to reach "approved" | 6 of 6 | **0** |
| Figure flags a user must decide with a note although the figure is verified-correct | 3–15 per report | **≤ 1 per report** |
| Dead ends (no user action can proceed) | 3 (final month, uncleareable flag, billing page) | **0** |
| Checklist items needing a manual scan or bulk resolve for data-driven concerns | 4 | **0** |
| Clicks/screens per month for the field+M&E routine | ~55 | **−40 %** with copy-last-month, bulk verify, linked evidence |
| Server-log reads needed to explain a failure | 3 | **0** (reason is on screen and in the audit trail) |
| Raw ids, codes, internal scores in donor text or user copy | 2 | **0** (lint + test) |

---

## 5. Workstreams

### 25.0 Baseline and harness

**Problem.** The demo scripts are one-off and depend on timing (fixed sleeps, `Date.now()` polling, a shared CDP page) — runs collided twice. Without a stable harness a regression in these
flows would not be caught.

**Work**
1. Turn `scripts/demo-wash-ui/` and `scripts/demo-health-ui/` into one `scripts/demo-ui/` package: a `lib` with `attach()`, a single-flight **run lock** (refuse to start if another script holds
   the CDP page), `waitForUi(predicate)` helpers replacing fixed sleeps, a `step(name, fn)` wrapper that logs duration and timeouts, and fixtures (`plan.json`, evidence generator, templates) shared by both demos.
2. Add API-level **journey tests** (no browser) that exercise the same sequence through handlers with in-memory ports: create project → import → create all periods → activities → evidence →
   verify → generate (fake writer) → review → approve → seal → export. These run in CI and catch regressions in the domain/application layers in seconds.
3. Record the baseline measures of §4 from demo 4 and demo 5 into `memorybank/demo/baseline-phase25.md`.
4. A **fake AI writer** with switchable behaviours (valid, ungrounded figure, timeout, 500, empty) used by tests and by a staging browser run, so fallback paths are testable on demand.

**Acceptance.** `pnpm journey` runs the handler journey green; the browser harness completes a one-month cycle on a scratch tenant without manual intervention; each fake-writer
behaviour has a test asserting what the user sees.

### 25.1 Generation integrity (D5-2, D5-7, D5-10, D4-1 follow-up)

**Verified causes**
- `VALIDATOR_FAILED` on the progress section: the writer states derived percentages (cumulative percent of target, "17 indicators") that are not in the inputs. The worker retries once
  with feedback, then flags the section; the API swaps in the stub (`ai-reporter-draft-generator.ts`).
- 500 / 170 s timeout: the provider call exceeded `AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS`; the API swaps in the stub without a retry of its own.
- The fallback reason is returned in telemetry (`fallbackReason`) and mapped to plain copy (`reporting-copy.ts`) but **never stored on the section**, so the editor can only show a generic banner.
- "Try AI again" only opens the regenerate box; the user must know to add an instruction.
- The stub is chosen by title substrings (`buildSection`), so any section whose title is not on the list gets an indicator dump.

**Work**
1. **Store the reason.** Add `ReportSection.generationFallbackReason` (nullable enum string) and `generationFallbackDetail` (short, user-safe text, e.g. "figure not in your data: 33.3%"), written by the
   generate and regenerate handlers; surfaced in `GeneratedSectionResult` → persistence → section view model. Migration + `REQUIRED_PRISMA_FIELDS` + RLS re-run.
2. **Banner by reason.** `DocumentSection` shows the stored reason through `fallbackReasonCopy` with a primary action that fits it: *timeout/HTTP* → **Try again** (retries as-is);
   *validator* → **Try again, quote recorded figures only** (retries with the standard instruction, below); *not configured/disabled* → link to settings. Remove the generic text.
3. **Automatic bounded recovery.** On `VALIDATOR_FAILED` the API makes **one** automatic retry with an appended instruction naming the offending figures and the allowed set
   ("Do not state 33.3, 26.2 …; quote only recorded values and the percent of target given"). On timeout/5xx, **one** retry with the section brief shortened (drop prior-section summaries).
   Retries count once against the section budget and never against AI credits; both attempts are recorded in `llm_runs`.
4. **Fix the cause in the writer contract.** Python SSOT + TS mirror (lockstep): forbid cumulative or derived percentages unless present in `verifiedFindings`; forbid "N indicators";
   require the writer to quote `lifeOfProject` values only in roll-up sections; forbid inventing labels (IR1/IR2/IR3) — use the template's section titles and the logframe's own outcome
   codes (pass outcome codes and titles as a `structure` block). Contract v5, v2–v4 prompts byte-stable.
5. **Smarter stubs.** Replace title substrings with `classificationTitle()` → section *kind* (results, activities, challenges, learning, plan, compliance, finance, narrative). A
   *narrative* kind with no matching stub writes from the story answers and activity text, never an indicator dump. Table-driven test over every blueprint and the two USAID templates.
6. **Donor-text lint additions** (extend `WORKFLOW_VOCABULARY` / donor lint): evidence ids and uuids/hex ids, file names, "evidence ids", record ids, raw reason codes; section cross-references to
   titles that do not exist in the report (validate against the outline); template questions echoed verbatim as statements (treat as headings, not claims).
7. **Word and length limits enforced.** `maxWords` from the template becomes a hard validator for synthesis sections: one automatic shorten pass; if still over, flag **Needs a decision** with the count.
8. **Regeneration feedback.** The regenerate and "Try again" buttons show an in-section progress state (spinner, elapsed time, "Previous text stays until the new one is ready"), then a result toast
   ("Rewritten", "Kept previous text: the AI could not produce a valid version — reason"). Section-level, not page-level.
9. **Stale summary warning** recomputes from section hashes at the moment of approval and clears on regenerate or manual "Mark summary as current" (with audit event).

**Tests.** Fake writer (25.0): each behaviour → exact UI state and persisted reason; retry bounded to one; credits not charged for retries/fallbacks; contract mirror test green; lint cases;
stub-kind table test; word-limit test; golden corpus unchanged.

**Acceptance.** In a run with an ungrounded-figure writer, the report generates with the section **recovered automatically** or, if not, labelled "figure not in your data: …" with a one-click
retry; no section is silently stubbed; no donor text contains an id, file name or invented section reference.

### 25.2 One definition of a number (D5-3, D4-10 root)

**Cause.** `computeIndicator` returns `"0"` with `LOW_COVERAGE` when no verified numeric value exists; each consumer (writer inputs, tables, charts, readiness, export, contradiction lint)
decides on its own what to do with that. D5-3 was fixed in one consumer only.

**Work**
1. Make the finding explicit: `VerifiedFinding.status: "REPORTED" | "NOT_MEASURED" | "UNVERIFIED"` and `value: string | null`. `NOT_MEASURED` = no update in the period (and, for roll-ups, no
   life-of-project value); `UNVERIFIED` = updates exist, none verified. The calculator never emits `"0"` as a stand-in. Domain tests: table of (updates, verified, aggregation) → status/value.
2. Consumers: the writer receives only `REPORTED` findings plus one structured line "not measured this period: HL-OC2a (quarterly survey)" (allowed vocabulary: *not measured*); tables show
   an empty cell and "Not measured"; charts skip (Phase 23 rule: never plot a missing value as 0); the indicator workbook leaves the cell empty; readiness counts by **frequency** — a quarterly
   indicator is expected only in the periods where it is due (`Indicator.frequency` + project dates → `expectedInPeriod()`), so the period page stops showing "needs attention" for it.
3. Frequency-aware inputs panel: the values grid marks "not due this month" (greyed, optional) for quarterly/annual indicators and shows "due" with a nudge in the due month.
4. Contradiction lint and number grounding accept `NOT_MEASURED` and never treat "0" as grounded for it.
5. Remove the per-consumer filter added in `report-generation-context.ts` once the status is carried through (keep its test, retarget it).

**Acceptance.** A quarterly indicator is absent from monthly narrative, table, chart and export in the months it is not due; the grid explains why; roll-up reports still show the
life-of-project value; no consumer can produce `0` for a missing value (property test: for any updates set with no values, no output contains the indicator's value).

### 25.3 Checks and exports that can always be cleared (D5-4, D5-6, D4-8, D4-9, D4-10)

**Principle.** Every blocker has a *defined* user action, and the same action works in single and bulk form.

**Work**
1. **Donor copy path hardened.** The seal (`CreateSubmissionSnapshotHandler`) needs resolved requirements; today a template-based period may have none. Resolve requirements when the template is
   approved and pinned (idempotent `ResolveRequirementsHandler` call at period creation and template change), so the seal never fails for a missing resolution. A failed seal returns a plain-language
   reason list (which section, which rule) instead of the raw gate message. Contract test: create → approve → seal → export donor copy → no watermark, and the manifest lists approvals.
2. **Watermark honesty.** The wizard states the copy kind before and after export; the file name carries `-final` (donor) or `-internal` (never `-draft` for an approved report); the Export center lists
   the copy kind per row.
3. **State items close from data, always.** Run the state-rule pass (`CHECKLIST_STATE_RULES`) in the same transaction as any data change that can satisfy one (activity accepted, finance verified,
   disaggregation saved, indicator verified) via a domain event → `ChecklistReconciler` subscriber; keep the manual scan as a repair tool. Closing the item writes an audit event `checklist.closed_by_data`.
   Contract test per rule: data change → item closed with the "Closed automatically" note, no scan.
4. **One resolution UI.** Single and bulk resolve share one component, one confirm step and the same Undo; delete the second red "Confirm" on bulk (keep a count + note field + one button).
5. **Figure flags that are decidable and rarer.**
   - Fix the sentence splitter (abbreviations: "no.", "No.", "approx.", "e.g.", "i.e.", "vs.", "Dr.", "St.", numbers with decimals/ids) so one sentence is one statement; test with the real award-number sentence.
   - Compare a restated figure against *all* values a finding legitimately has (period, cumulative, life-of-project, previous, percent of target, baseline, target), not one basis (extends `LintGrounding`).
   - For a flag whose figure equals a verified finding value, offer **Use the verified value** (already exists) *and* **This matches a verified indicator** (one click, creates a resolution
     citing the finding id) instead of a free-text note.
   - Bulk decision for "wording changed" items: **Re-check all** first, then decide.
6. **Confidentiality gate.** The "Review confidentiality" link goes to the specific file and statement, not the evidence list; Admin/Grants Officer can **Confirm may be shared** inline from the report checks.
   The gate clears when the citing statement is regenerated or left out (verified in demo 5; add a test).
7. **Report checks panel** shows, for each blocker, the action buttons that clear it (never only a link), ordered by what unblocks submission.

**Acceptance.** Re-running a closing report with zero manual scans, zero second confirms and at most one "decide" per report; seal succeeds for every template-based period; exports are labelled
correctly; no blocker without an action.

### 25.4 Capturing what donors ask for (D5-8, D5-9, D4 recommendation follow-ups)

**Compliance narrative (largest design item).**
1. **Template-driven input prompts.** When a template section is of kind *compliance/narrative-without-data* (environmental, branding, gender, coordination, safeguarding, risk), the period's
   **Tell the story** tab gains one short question per such section, titled with the donor's wording (e.g. "Environmental compliance under the IEE: what did you do this month?"), stored in
   `ReportingPeriod.storyContext.sectionNotes[sectionKey]`. The writer receives it as that section's source and cites it as a *reporting-officer statement*.
2. **Recurring statements.** "Same as last month" button copying the previous period's note for that section; a project-level **standing statements** card (branding policy, waste management
   procedure) usable by any period.
3. **Field-report importer.** Replace the free extraction with a section-aware one: split the pasted text by the template's compliance sections and show a preview per section; fix
   "Add confirmed to report" ("unexpected response shape": schema mismatch between the route response and `ProposedInputsSchema`); one contract test of request/response shape.
4. Readiness: a compliance section without a note is a **To do** ("add this month's environmental note") rather than a silent "no record" in the report.

**Evidence capture.**
5. **Typed files on the activity form.** Each dropped file gets a row with type (auto-suggested from file name/extension/template), confidentiality, and an optional indicator; default the indicator
   from the activity's logframe node (indicators under that node, preselected when exactly one). Linker stays `IEvidenceLinker` (Phase 23).
6. **Suggested links that work.** `Suggest links` uses code, title and node tokens plus the file's extracted text and the activity's linked indicator; show the reason ("same activity node", "title
   mentions 'mentorship visits'"). Contract test with demo-5 fixtures (mentorship log → HL-1.1b; training attendance → HL-1.1a).
7. **Link control on the file page** (docs promise it): "Supports: activity, indicator + period" panel with add/remove, using the linker.
8. **Bulk verify evidence** on the list (checkbox selection + filter by period/activity), with the same result list as bulk accept; writes one audit event per file.
9. **Activity form speed:** *Copy last month's record* (title, node, location, narrative placeholders, participants zeroed) and an **Add activity** button on each logframe activity node (Phase 24 deferral).
10. Participants: show blank when not entered (D5-13), distinguish 0 from unknown in the model (`participantsTotal: number | null`).

**Acceptance.** A compliance section of a USAID monthly report is written from an officer's note (or flagged as a To do), not from nothing; one month's evidence for 8 activities uploads
with types and indicator links in the activity form alone; bulk verify handles a month in one action.

### 25.5 Templates and defaults (D5-13, D4-2 follow-up)

1. `Set as default` is per report type (`defaultTemplateIdByType`), not one id for the project; uploading a template never silently changes another type's default. A visible
   "Used for: Monthly reports / Final report" chip on each template card.
2. Template extraction: keep the heading hierarchy and the donor's word limits; show a "word limit" chip; test with the two USAID DOCX files from demo 5 (8 and 14 sections, two nested).
3. Template status after approval can be edited without losing approval for unrelated fields (typo in an instruction) — create a minor version and keep `REVIEWED` when only
   `instructions`/`authorInstructions` change (spec + audit).
4. Extract button: redirect and progress reliability (25.6).

### 25.6 Period lifecycle and form reliability (D5-1, D5-12, D4-13)

**Periods**
1. **Cancel a period** (new `CANCELLED` status): allowed while it has no approved report; its data stays; it no longer blocks the calendar or the closing report; audited; restore possible.
   A period that is the wrong *type* (monthly where the final belongs) can be **converted to Final** when it is the last block and no other period overlaps (`ConvertPeriodTypeHandler`, with
   the same checks as create). This is the repair path for any project already affected by D5-1.
2. Reports page shows what auto-create did ("Created Apr 2026 automatically") and the setting is visible there, not only in the profile.
3. The closing-report page lists *why* each step is To do with the exact missing item (fixes D5-11 mismatch with 25.8) and never renders "Not possible" for every step when the only blocker is one.

**Forms**
4. **Idempotency for creates.** Use the existing `IdempotencyRecord` table: the web action sends an idempotency key generated when the form mounts; the API returns the original response on a repeat.
   Applies to project, logframe item, indicator, activity, evidence, template, period, export.
5. **Redirect reliability.** Root-cause the missed redirect (server action resolves after the 15–30 s window; button re-enabled; `router.push` swallowed by a pending transition). Use one shared
   `useCreateAction()` hook: disable until the server answers, show "Saving… (can take up to a minute for large files)", redirect on success, and on timeout poll the idempotency key and
   redirect when the record exists. Replace ad-hoc `router.push` in create forms (`EvidenceUploadQueue`, templates, logframe, indicator, activity).
6. Upload queue: per-file status, retry and a "saved but not redirected" safety net.

**Acceptance.** No create form ever leaves the user wondering whether it saved; a double click creates one record; a wrongly auto-created final month can be converted in two clicks.

### 25.7 Polish and accessibility (D5-13, D4-15…19)

1. Label every form control (evidence form selects, bulk checkboxes); automated axe check in the browser harness for the ten core screens.
2. PDF/Word: replace the en dash glyph by a font that supports it (or `-`), landscape layout or a two-line cell layout for indicator tables with ≥ 9 columns, repeat header row per page.
3. Copy: "1 item still need attention" (pluralise helper everywhere), "Team assignment" status, "0 participants" (25.4.10), and a **string lint**: no raw reason code, no uuid, no `snake_case` in any
   user-visible string (extend the existing exhaustiveness test to scan rendered view-model strings).
4. Readiness change explanation (Phase 24 R16.6): when readiness drops, show *what changed* ("2 sections reopened after regenerate") from the audit events.
5. Evidence pack size preview and per-folder counts in the wizard; "Select all cited / all verified / all" shortcuts.
6. Evidence detail shows Location and Uploaded date (D4-17 re-check).
7. Mobile pass for the report editor (outline collapses, inspector as drawer) and for the compliance bulk bar.

### 25.8 Roles and sign-off (D5-11, D4-14)

1. One source for "who can sign off": `signOffRoles(project)` used by the closing plan, the checklist item "Final report sign-off obtained" and the report approve button. Replace the
   split between *tenant* role and *project* role checks that left "Sign-offs assigned" at To do (verify the cause with the demo-5 project first: two project roles assigned, tenant roles differ).
2. **Self sign-off rules.** Configurable per project: `requireSecondApprover` (default off for single-user tenants). When on, the author cannot approve; the UI says who can. When a tenant has one
   full seat, the closing plan shows "Working alone: you may sign off as both (recorded)" and writes an audit event `signoff.self`.
3. **Attestation items done by the right person.** The checklist's attestations (sign-off, sensitive handling, procurement) can be **assigned** to a project role; the assignee sees them in *My work*;
   bulk resolve of attestations is allowed only to Admin/PM and records `attested_by` per item (not a shared note).
4. **Journey test with three accounts** (field officer logs + uploads; M&E verifies; PM approves and seals) in the handler journey (25.0) and once in the browser; permission matrix test for every action in this phase.
5. Seat/role hints: when inviting, show what each role can do on one screen; invite list updates immediately (demo 5: "No team members match" right after inviting).

### 25.9 Billing, health and observability (D5-5)

1. **Billing page.** Reproduce locally with a tenant on each plan; the web response schema requires `limits.viewerSeats/aiCreditTopUp/byoLlmEnabled` as present while the API sends `null` or omits
   them (plan `limits` are `number | null`). Make the schema match the contract (`nullable().optional()`), add a contract test that parses the real `PLAN_LIMITS` output for every plan, and show a
   degraded but usable page (plan name, usage) if one section fails to parse rather than a full-page error.
2. **Section-level error boundaries** on settings pages: a validation failure in one card never blanks the page and always shows the reference id plus a "Report this" button.
3. **AI run visibility in the product.** Settings → AI usage shows the last 50 section runs: section, outcome (written / recovered / stub), reason, latency, tokens, retries — from `llm_runs`
   and the new fallback fields. Admin-only; no server log needed.
4. **Operational alerts.** Count of stubs, timeouts and validator rejections per day; an alert (existing ops channel) when the stub rate exceeds a threshold or the worker returns 5xx twice in
   a row. Add `/ready` check for the AI worker health (`/v1/ai-reporter/health`) as a non-blocking warning.
5. **Provider pacing review.** The 170 s section call and the 240 s HTTP timeout were hit once in demo 5 despite pacing; record queue wait vs provider time per call, and verify the
   `provider_limiter` behaviour under 14-section final reports (one 12-section final report generated in ~65 s; the timeout was in a monthly run).

### 25.10 Re-run and sign-off (demo 6)

1. Re-run the **demo 5 journey** (USAID health, six months, closing report) on a **fresh tenant project** with the new harness, plus the demo 4 WASH journey at the API level.
2. Add three failure drills: fake writer ungrounded figure; fake writer timeout; a project whose final month was auto-created before the fix (conversion path).
3. Score the measures in §4; any measure missed becomes an item in a Phase 26 list, not a re-opening of this plan.
4. Support docs and Help Center updated for every behaviour change (list in §7); web deploy so they go live.
5. Record outcome in `memorybank/demo/verification-demo-6.md` and add §Outcome to this file.

---

## 6. Cross-cutting checklist (apply to every item)

- Behaviour change → plain-language copy from `reporting-copy.ts` (one table), no codes.
- Every new state has: a label, a reason, an action, an audit event.
- Every new handler: in-memory + Prisma port, contract test, permission-matrix test, audit assertion.
- Every new rule: a table in the domain with an exhaustiveness test.
- API additive; no route or column removed; migrations reversible by additive default.
- Existing projects: backfill or lazy-repair (never require a user to rebuild).
- Writers never receive workflow state; donor-text lint extended in the same change as any new context field.
- Docs: edit `memorybank/docs/support/`, update `INDEX.md`, deploy web.

## 7. Support docs to change with this phase

| Article | Change |
|---|---|
| tell-the-story-and-add-inputs | Compliance prompts per section, "same as last month", field-report import (25.4) |
| use-compliance-checklist | Items close by themselves again; one resolve flow; attestations assigned (25.3, 25.8) |
| export-reports | Copy choice, file naming, failed-seal messages (25.3) |
| create-a-reporting-period / create-the-closing-report | Auto-create behaviour, cancel and convert a period, per-step reasons (25.6) |
| generate-ai-report-draft / troubleshooting-ai-report-generation | Reasons and automatic recovery, "Try again" variants (25.1) |
| upload-evidence / log-activities | Typed files on the activity form, bulk verify, link panel, copy last month (25.4) |
| upload-donor-template / change-a-reports-template | Defaults per report type (25.5) |
| invite-team-members / manage-team-roles / review-and-approve-reports | Sign-off rules, attestations, self sign-off (25.8) |
| manage-billing-subscription / plans-and-limits | Page behaviour after the schema fix (25.9) |

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Writer contract v5 changes prose style across reports | v2–v4 prompts byte-stable; golden corpus; ship behind `AI_REPORTER_CONTRACT=5` and compare on the demo fixtures before default |
| Automatic retry doubles latency on slow providers | Single retry, shared section budget, shortened brief on the second attempt; metrics in 25.9 before raising any timeout |
| `NOT_MEASURED` changes a widely used type | Additive field first (`status`), keep `value` string for one release, migrate consumers one by one with the property test as the guard |
| Event-driven checklist closing causes churn (Phase 24 saw re-creation) | Reconciler is idempotent, never raises what a person decided, covered by the Phase 24 churn tests plus new data-change tests |
| Converting/cancelling a period breaks comparability or approvals | Allowed only without approved reports; comparability and cumulative rules re-run on the change; audit events; restore path |
| Idempotency keys leak across users | Key scoped by tenant + user + route; TTL 24 h; tested |
| Compliance prompts add form length | One question per template section of that kind only, collapsed by default, "same as last month" fills it |
| Demo accounts and data accumulate on production | The harness uses a labelled scratch project per run and archives it; the two demo users from demo 5 are removed or reused |

## 9. Definition of done

The phase is done when all of the following hold on production, verified in the demo 6 run:

1. A tenant can run a six-month project from creation to a donor-ready closing report **without any workaround**, in the order the docs describe.
2. **No silent failure**: every fallback, retry, seal failure and refused action shows its reason on screen and in the audit trail.
3. No consumer shows a missing value as 0; no donor text contains an internal id, code, score or invented reference.
4. Every blocker has a user action that clears it; no blocker needs a manual scan, a developer, or a server log.
5. Two-person and one-person sign-off both complete; permissions are covered by tests.
6. The measures in §4 are met, the docs in §7 are live, and the outcome is written into this file.
