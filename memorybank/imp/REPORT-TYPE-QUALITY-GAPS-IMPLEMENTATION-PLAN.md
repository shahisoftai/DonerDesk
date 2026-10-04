# Report-type quality gaps — implementation plan

**Status (2026-10-04): implemented in code (Phases 1–7 except the native-speaker review); tests green; not yet deployed or browser-verified.** Outcome notes: [`Features/10-Reporting-Period-Manager.md`](../Features/10-Reporting-Period-Manager.md) §"Report-type quality gaps closed". Phase 0 was folded into per-phase tests (no separate golden-corpus fixtures were added).

Source: audit of 2026-10-03 (report types vs. what the code feeds the writer). Baseline behaviour is documented in
`Features/10-Reporting-Period-Manager.md` ("Report types & scope", "Report-type blueprints & structure rules").
Constraints from AGENTS.md apply throughout: domain stays pure; Python writer contract is the SSOT with a string-identical TS mirror;
`reportType`-dependent rules recognise sections by `classificationTitle()` / `canonicalTitle`; never title a section "Overview"/"Abstract";
new Prisma fields used in select/create/where go in `REQUIRED_PRISMA_FIELDS` (`apps/api/src/routes/health.ts`); every mutation writes `audit_events`.

## Gap map

| # | Gap | Types hit | Severity |
|---|-----|-----------|----------|
| G1 | Prior-period narratives ignore report type and match on displayed title | Quarterly, Semi-annual, Annual, Situation | High |
| G2 | No cumulative / life-of-project data | Annual, Final, Semi-annual | High |
| G3 | No finance data source (Financial section can only say "reported separately") | Quarterly → Final | Medium |
| G4 | Cadence blueprints carry only a one-line description; writer has no per-type guidance | Monthly → Final | Medium |
| G5 | Situation: no affected-population/needs fields; previous report's text not passed | Situation | Medium |
| G6 | Scope not editable after creation | Activity, Situation, Custom | Low |
| G7 | No type-specific checklist item types | All | Low |
| G8 | Ar/Ur/Ps blueprint titles unreviewed by a native speaker | Non-English reports | Low |
| G9 | Verification/cleanup debt (prod test reports) | — | Housekeeping |

Phases are ordered so each ships and deploys independently. Phase 0 is a test harness all later phases reuse.

---

## Phase 0 — Baseline and test harness (½ day)

- Add a golden fixture per report type to the existing reporting eval (`pnpm --filter @donordesk/infrastructure reporting:eval`):
  one project with 3 periods of history, indicator updates with cumulative values, one situation series (2 reports), 3 activities.
- Record current output as the baseline so each phase shows a measurable diff (section fallbacks to non-AI text, ungrounded-number failures, word counts).
- Acceptance: eval runs for MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, FINAL, ACTIVITY, SITUATION, CUSTOM and prints a per-type scorecard.

## Phase 1 — G1: type-aware, canonical prior-period history (1 day)

**Problem.** `findPreviousPeriods` (`packages/infrastructure/src/repositories/reporting.ts:80`) returns earlier periods of any type; `DeterministicPriorPeriodService`
(`llm/prior-period.ts`) matches sections by `normalizeTitle(sectionTitle)`, so language changes or renamed titles lose the match, and an Activity/Situation
report can be fed to a Quarterly report as its "previous period".

**Changes**
1. Port `IReportingPeriodRepository.findPreviousPeriods` gains an options arg `{ reportTypes?: string[]; situationEventKey?: string }` (default = current behaviour).
2. Repository filters on `reportType IN (...)`; for SITUATION also filters on the normalised event name from `scopeJson` (`normalizeEventName`). Do the event filter
   in the query via the existing scope column if indexed, otherwise post-filter the (≤ 20) rows.
3. `prior-period.ts`: derive `comparable types` from the current period — cadence types compare with cadence types only (same type preferred; Semi-annual/Annual may
   fall back to the nearest cadence type), SITUATION with the same event series, ACTIVITY/CUSTOM → none.
4. Match sections by `canonicalTitle` (persist it on `ReportSection` if not already; else read from the period's `templateSnapshotJson`/blueprint ids `bp:<type>:<key>`)
   and fall back to title match. Blueprint section ids are stable across languages, so match on the `bp:` key first.
5. `periodLabel` becomes a real label (e.g. "Q2 2028"), not the raw type enum.

**Tests.** Domain/infra unit tests: mixed-type history returns only comparable periods; French report matches English prior section via blueprint key;
situation series #3 gets #2 and #1 only. Add to `p0-4`/prior-period tests.

**Acceptance.** Quarterly report beside an Activity report in the same window never receives the activity text; prior narrative still found after language switch.

## Phase 2 — G2: cumulative / life-of-project data (2 days)

**Problem.** `IndicatorUpdate.cumulativeAchievement` exists but generation scopes findings to the period window only. Annual "Cumulative Progress" and Final
"Achievement of Objectives" have nothing life-of-project to cite.

**Changes**
1. Application: new `buildCumulativeFindings(projectId, upToDate)` in `indicator-analytics-service.ts` — per indicator: baseline, target, cumulative achieved
   (sum of verified updates to date, or latest `cumulativeAchievement` for non-additive indicators — respect indicator `aggregation` if present; otherwise document
   the choice), % of life-of-project target, by-period series.
2. `report-generation-context.ts`: for `SEMI_ANNUAL`, `ANNUAL`, `FINAL` attach `cumulativeFindings`; for FINAL, widen the activity/indicator window to
   the project duration (period dates stay the final period for display only). QUARTERLY/MONTHLY unchanged.
3. Contract: add optional `cumulative` block to `AiReporterContext` / `ReportPlan` — Python `models.py` and TS `ai-reporter-worker.ts` in lockstep (additive, optional).
4. Grounding: `grounding.py` and `number-grounding.ts` must treat cumulative figures as grounded inputs; "percent of target" remains the only derived figure.
5. `artifact_builder.py`: deterministic cumulative table (indicator | baseline | target | period | cumulative | % target) for the `bp:*:cumulative` / `objectives` sections.
6. Legacy narrator (`llm-report-draft-generator.ts`): same data in its prompt so the flag-off path doesn't regress.

**Tests.** Analytics unit tests (additive vs. latest-value indicators, missing baseline, unverified updates excluded); worker tests for the table builder and grounding;
TS/Python mirror test stays green.

**Acceptance.** Final report's objectives section cites life-of-project totals, no `VALIDATOR_FAILED` on cumulative numbers, Quarterly output unchanged (golden diff).

## Phase 3 — G4: per-type writer guidance for cadence blueprints (1.5 days)

**Problem.** Activity/Situation sections carry `instructions` and `mandatoryQuestions`; Monthly → Final sections carry only `description`.

**Changes**
1. In `report-type-blueprints.ts` give every cadence section `instructions` + `questions` (+ `maxWords` where short): e.g. Monthly "This Month at a Glance" 3-4 sentence
   headline; Quarterly Results = "progress vs. target, explain variances ≥ 20 % either way"; Annual Cumulative = "life-of-project progress and whether on track";
   Final Outcomes = "evidence-backed change, distinguish outputs from outcomes"; Final Sustainability = exit/handover. Reuse `NO_INVENTION`.
2. Add per-type tone/length rules to a single source: extend `buildSectionSpecificGuidance` (`llm-report-draft-generator.ts`) with a `reportType` branch so the legacy
   narrator and the AI Reporter `sectionGuidance` stay in one place (AGENTS.md invariant). No worker branching needed.
3. i18n: add the new instruction/question strings to `report-type-blueprint-i18n.ts` only if they are shown to users; writer-facing instructions stay English.
4. Check titles: no new title matches `overview|abstract`; extend `blueprint-tables.test.mjs`.

**Tests.** Blueprint snapshot tests (every section of every type has instructions); guidance parity test between legacy and AI Reporter.

**Acceptance.** Eval scorecard shows fewer generic/repetitive sections on cadence types; word limits respected.

## Phase 4 — G3: finance data source, selectable mode (3.5 days)

**Decision (2026-10-04):** finance entry is a per-project setting `financeDataMode` = `TYPED` | `IMPORT` | `DISABLED` (default `DISABLED`, so nothing changes for existing projects).
Set in project settings; admins can change it at any time. All three modes feed the same stored summary, so the writers have one input shape.

1. **Storage (shared by all modes).** Prisma model `PeriodFinancialSummary` (tenantId, periodId, currency, budget, expenditure, committed, `linesJson` by budget line,
   `source` = TYPED | IMPORT, verifiedById/verifiedAt) + RLS forced + `donordesk_app` grants; re-run `infra/postgres/rls.sql`; add new fields to `REQUIRED_PRISMA_FIELDS`.
   `Project.financeDataMode` column (migration). Domain aggregate, `IPeriodFinancialRepository` port, Prisma impl, upsert/get use cases, audit events, Zod routes.
2. **TYPED.** "Finance" tab in the period workspace (server action write, RSC read): totals plus optional budget lines; same verify-before-use flag as indicator values.
3. **IMPORT.** Reuse the existing spreadsheet import path: map columns (budget line, budget, expenditure, committed), preview, validate currency and totals,
   save as an unverified summary the user then confirms. Imported rows keep the file as evidence.
4. **DISABLED.** No tab, no import; the Financial section stays optional and keeps the current "reported separately" behaviour; checklist item not added.
5. **Generation.** Context passes the finance block only when the mode is not DISABLED and a verified summary exists; deterministic burn-rate table in
   `artifact_builder.py`; grounding treats the figures as inputs; legacy narrator gets the same block. Unverified data is never sent to the writer.
6. **Checklist.** `FINANCE_FIGURES_PROVIDED` (see G7) for Quarterly → Final when mode ≠ DISABLED.

**Acceptance.** Each mode behaves as specified; switching to DISABLED hides finance inputs and removes the checklist item without deleting stored data; with a verified summary the section reports grounded budget, expenditure and burn rate.

## Phase 5 — G5: Situation reports (2 days)

1. Scope: add optional `affectedPopulation` (`{ figure, unit, source, asOf }[]`) and `needs` (`string[]`) to `ReportScope` + Zod validation + trimmed limits in
   `report-scope.ts`; form fields in `NewReportingPeriodForm` for situation type. Because scope isn't editable yet, ship G6 first or together.
2. `describeReportScope` includes these; figures are added to grounding inputs so the Needs section can cite them.
3. Follow-ups: pass the previous situation report's drafted text to the writer through the Phase 1 prior-period path (same event series), and instruct
   "state only what changed". Include previous figures so deltas ("up from X") are deterministic via `DELTA` artifacts.
4. Deterministic "Affected population" table in `blueprint-tables.ts` **only** when figures were supplied (the earlier invented table was removed for good reason).

**Acceptance.** Situation #2 cites changes against #1 with grounded numbers; with no figures, the section still says "not reported".

## Phase 6 — G6 + G7: editable scope and type-specific checklist (2 days)

- **G6.** `UpdateReportingPeriodScopeHandler`: allowed while no draft is APPROVED/SUBMITTED; revalidates (activity ids in project, situation fields), recomputes
  server-set series fields, marks existing draft sections stale (reuse the stale mechanism from Report Editor v2) and recomputes readiness. Audit event with before/after.
  UI: "Edit scope" on the period page reusing the form's scope fields.
- **G7.** New checklist item types in the `ChecklistItem` enum (migration if the type is a DB enum): `AFFECTED_FIGURES_CONFIRMED` (Situation), `ACTIVITY_RECORD_ACCEPTED`,
  `FINANCE_FIGURES_PROVIDED`, `CUMULATIVE_DATA_COMPLETE` (Annual/Final: every indicator has a baseline and cumulative value), `PRIOR_REPORT_LINKED`.
  Update `checklist-template.ts`, `detect-missing-evidence.ts` scan, and labels in `apps/web/src/lib/labels.ts`.

## Phase 7 — G8 + G9: i18n review and housekeeping (½ day, parallel)

- Send the Ar/Ur/Ps blueprint catalog (`report-type-blueprint-i18n.ts`) to native reviewers; apply fixes; keep canonical English titles untouched.
- Clean up the three verification reports on production (ids in `pending.md`) with the same guarded transaction as before, keeping `LlmRun` and audit rows.

---

## Cross-cutting

- **Contract changes** (Phases 2, 4, 5): update Python models first, regenerate the TS mirror, run `test_ts_contract_mirror_is_string_identical`. Prompt prefix must stay
  byte-identical across a report's sections — put new per-section data in `_section_prompt`, report-wide data (cumulative, finance) in the prefix only if identical for every section.
- **Backward compatibility:** every new field optional; v2/v3/v4 prompt bytes unchanged for reports that don't use it.
- **Verification per phase:** `pnpm -r typecheck`, `pnpm -r build`, Python `pytest`, `node --test .../artifact-validators.test.mjs`, the golden eval, and for UI phases
  a visible-browser run on production (per the browser-verification memory), as done for the blueprint release.
- **Deploy:** `scripts/deploy-fast.sh`; Phases 4 and 6 add migrations + RLS re-run; check `/ready` for stale Prisma client fields.
- **Docs:** update `Features/10-Reporting-Period-Manager.md`, `Fixes.md`, `pending.md` (tick the items), `INDEX.md` after each phase.

## Sequencing and effort

| Order | Phase | Effort | Depends on |
|---|---|---|---|
| 1 | P0 harness | 0.5 d | — |
| 2 | P1 prior-period (G1) | 1 d | P0 |
| 3 | P3 cadence guidance (G4) | 1.5 d | P0 |
| 4 | P2 cumulative (G2) | 2 d | P0 |
| 5 | P6 scope edit + checklist (G6, G7) | 2 d | — |
| 6 | P5 situation (G5) | 2 d | P1, P6 |
| 7 | P4 finance (G3) | 3.5 d | product decision, P6 (checklist) |
| 8 | P7 i18n + cleanup (G8, G9) | 0.5 d | — |

Total ≈ 13–14 working days. Highest value per day: P1, P2, P3.

## Decisions (2026-10-04)

1. **Finance entry:** selectable per project — typed per period, spreadsheet import, or disabled (default). See Phase 4.
2. **Cumulative aggregation:** approved. Phase 2 starts by checking whether indicators already store an aggregation rule (sum vs. latest value); if not, add an
   `aggregation` field (default `SUM`) with a migration before building the cumulative findings.
3. **Semi-annual comparison:** approved — compare with the previous Semi-annual; when none exists, fall back to the last two Quarterly reports (Phase 1 rule).
4. **Scope edit after a draft exists:** mark the affected sections stale and tell the user to regenerate; never regenerate automatically. Reason: regeneration spends
   metered AI credits and would overwrite manual edits; stale-marking reuses the existing Report Editor v2 mechanism. Scope edits are blocked once a draft is APPROVED or SUBMITTED.
