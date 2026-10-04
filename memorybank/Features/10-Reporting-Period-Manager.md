# Feature 10: Reporting Period Manager

## Overview

Manages reporting periods for projects with deadlines, templates, and status tracking.

## Specification (from MVP-features.md)

### Create Reporting Period
Fields:
- Project
- Report type (+ scope for Activity / Situation / Custom)
- Start date
- End date
- Report deadline
- Donor template
- Responsible reporting officer
- Internal review deadline
- Status

### Reporting Period Statuses
- Not started
- In progress
- Evidence collection
- Draft generated
- Under review
- Approved
- Submitted
- Closed

> **Canonical persisted values (2026-08-20):** the persisted `ReportingPeriod.status`
> must be one of the eight `ReportStatusValue`s enforced by
> `ReportStatus.create` (`packages/domain/src/value-objects/report-status.ts`):
> `NOT_STARTED`, `IN_PROGRESS`, `EVIDENCE_COLLECTION`, `DRAFT_GENERATED`,
> `UNDER_REVIEW`, `APPROVED`, `SUBMITTED`, `CLOSED`. Any other value (e.g.
> `COMPLETED`) throws `Invalid ReportStatus: …` in
> `PrismaReportingPeriodRepository.toDomain`, 500ing the Reports tab. Use
> `SUBMITTED` (or `CLOSED`) for a finished period. See `memorybank/Fixes.md`,
> 2026-08-20.

### Reporting Period Page
Displays:
- Report readiness score
- Required sections
- Indicator updates
- Evidence completeness
- Missing evidence
- Open review comments
- Draft report
- Export options

## Implementation Technical Details

### Data Model

**ReportingPeriod Entity** (`packages/domain/src/entities/ReportingPeriod.ts`):
- `id: string`
- `tenantId: string`
- `projectId: string`
- `donorTemplateId: string | null`
- `reportType: ReportType`
- `scopeJson: string` — `ReportScope` for ACTIVITY/SITUATION/CUSTOM (see "Report types & scope")
- `startDate: Date`
- `endDate: Date`
- `deadline: Date`
- `internalReviewDeadline: Date | null`
- `responsibleOfficerId: string | null`
- `status: ReportingPeriodStatus`
- `readinessScore: number | null`
- `createdAt: Date`
- `updatedAt: Date`

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/projects/:projectId/reporting-periods` | `listReportingPeriods` |
| POST | `/api/projects/:projectId/reporting-periods` | `createReportingPeriod` |
| GET | `/api/reporting-periods/:id` | `getReportingPeriod` |
| PATCH | `/api/reporting-periods/:id` | `updateReportingPeriod` |
| DELETE | `/api/reporting-periods/:id` | `deleteReportingPeriod` |
| GET | `/api/reporting-periods/:id/dashboard` | `getReportingPeriodDashboard` |
| POST | `/api/reporting-periods/:id/start` | `startReportingPeriod` |
| POST | `/api/reporting-periods/:id/submit` | `submitReportingPeriod` |
| POST | `/api/reporting-periods/:id/close` | `closeReportingPeriod` |

### Reporting Period Dashboard

```typescript
interface ReportingPeriodDashboard {
  readinessScore: ReportReadinessScore;
  requiredSections: TemplateSection[];
  indicatorUpdates: IndicatorUpdate[];
  evidenceCompleteness: EvidenceCompleteness;
  missingEvidence: ChecklistItem[];
  openComments: Comment[];
  draftReport: ReportDraft | null;
  exportOptions: ExportOption[];
}
```

### Indicator Data Entry (2026-08-16)

Indicator values are recorded **per reporting period**. A spreadsheet-style entry
grid lives at `/projects/[id]/reports/[periodId]/indicators` (linked from the
reports list, the report workspace header, and the project setup page):

- Rows are the project's logframe indicators grouped by level
  (Goal/Outcome/Output/Activity), loaded via `GET /v1/reporting-periods/:id/indicators`
  which merges each indicator with its existing update for the period.
- The grid saves drafts in one call via `POST /v1/indicator-updates/bulk`;
  a unique `(tenantId, indicatorId, reportingPeriodId)` constraint guarantees
  one update per indicator+period.
- Each row can be submitted and verified in place; verified rows are locked
  against edits, and a closed period rejects further writes.
- Google Sheets values can be imported via `POST /v1/indicator-updates/parse-sheet`
  (rows mapped by indicator code, previewed, then applied to the grid).
- **Percentage guard (2026-08-30):** PERCENTAGE/RATIO rows without a configured
  denominator indicator display a warning that their result cannot be
  independently verified in the report.

### Draft lifecycle — one working draft per period (2026-08-30, release `20260829160000`)

See `../imp/RECOVERY-PLAN-IMPLEMENTATION.md`:

- **Supersede:** `ReportDraft.supersededAt` (migration
  `20260829140000_report_draft_superseded`) — each generation supersedes prior
  DRAFT/UNDER_REVIEW drafts, so there is exactly one current working draft.
  Approved/exported/submitted drafts are never superseded (historical record).
  `findByReportingPeriod` orders superseded drafts last, so existing `[0]`
  consumers keep returning the current draft.
- **Versions archive UI:** the report workspace's **Versions** tab lists all
  drafts (status, created/superseded dates) with a **Make current** action for
  working drafts (`POST /v1/report-drafts/:id/activate` → `ActivateReportDraftHandler`,
  which supersedes the other working drafts in turn).
- **Cancel generation:** `POST /v1/reporting-periods/:id/cancel-generation`
  supersedes the working draft; the background section loop aborts on the
  superseded marker. Non-working (approved/etc.) drafts return
  `{cancelled:false}` without error.
- **"What to do next":** the workspace sidebar computes the single next action
  (verify indicators → generate draft → review statements → approve sections →
  submit → approve) in plain language, linking to the exact fix location.

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Period CRUD | Implemented | Full lifecycle |
| Status Transitions | Implemented | All 8 statuses |
| Dashboard | Implemented | All metrics displayed |
| Template Association | Implemented | Links to donor template |
| Officer Assignment | Implemented | Responsible officer |
| Deadline Tracking | Implemented | Visual indicators |

## Report types & scope (2026-10-03)

Report types: `MONTHLY`, `QUARTERLY`, `SEMI_ANNUAL` (new in the form), `ANNUAL`, `FINAL` (cadence — whole project, date
suggestions via `period-cadence.ts`) and `ACTIVITY`, `SITUATION`, `CUSTOM` (ad-hoc — manual dates, **scoped**).

Before this change the ad-hoc types were only a label: no way to say *which* activity/event, and generation used the type
just for the title. `ReportingPeriod.scopeJson` (migration `20261003100000_reporting_period_scope`, `TEXT NOT NULL DEFAULT '{}'`)
now stores a `ReportScope` (`packages/domain/src/contexts/reporting/report-scope.ts`):

| Type | Scope fields | Required |
|---|---|---|
| ACTIVITY | `activityIds[]` — project `ActivityUpdate` ids (any period) | ≥ 1 |
| SITUATION | `eventName`, `situationDate`, `location?`, `summary?` | eventName + situationDate |
| CUSTOM | `title`, `purpose?` | title |
| cadence types | — | — |

- **Validation:** `CreateReportingPeriodSchema` (`superRefine`, contracts) + `CreateReportingPeriodHandler` (`missingScopeFields`;
  ACTIVITY ids must belong to the project → `NOT_FOUND` otherwise). The handler takes an `IActivityUpdateRepository` (10th ctor arg).
- **Overlap rule:** enforced only between *cadence* periods (`CADENCE_REPORT_TYPES`); ad-hoc reports may sit inside a cadence period.
- **Activity resolution:** `resolvePeriodActivities` (`packages/application/src/services/period-activities.ts`) — ACTIVITY with a
  scope returns exactly the selected activities; everything else returns the period's own activity updates. Used by
  generation context, readiness evidence count and missing-evidence detection.
- **Writer:** `describeReportScope` → `PeriodGenerationContext.scope` (string) → legacy narrator (`- Report Scope:` line) and AI
  Reporter (`ContextPeriod.scope`, Python `models.py`; absent for cadence reports, so v2–v4 prompts stay byte-stable).
- **Checklist:** `SITUATION` has its own template (baseline + sources attached + figures approved); ACTIVITY gets a per-activity
  `MISSING_EVIDENCE` item (`relatedEntityType: "activity"`) for selected activities with no attached evidence.
- **UI:** `NewReportingPeriodForm` shows type-specific scope fields (activity checklist with filter / situation fields / custom
  title+purpose; scope resets on type change). `reportHeading()` (`apps/web/src/lib/labels.ts`) shows the custom title or
  "Situation report: <event>" in the reports list and editor heading. List API returns `scope`.
- **Deploy invariant:** `ReportingPeriod.scopeJson` is in `REQUIRED_PRISMA_FIELDS` (`health.ts`).
- **Tests:** `packages/domain/test/report-scope.test.mjs`; handler scope/overlap test in `packages/application/test/feature18-setup.test.mjs`.
- **Known limits:** no dedicated checklist item types per report type (reuses `MISSING_EVIDENCE`/`MISSING_APPROVAL`); scope is
  not editable after creation. (Indicator scoping for ACTIVITY and per-type structure are handled in the next section.)

### Report-type blueprints & structure rules (2026-10-03, second pass)

The first pass only recorded scope; the report still needed a full donor template. Now **structure is chosen per report type**:

- **A donor template is optional.** If attached *and applicable* it structures the report; otherwise the type's built-in blueprint does
  (`packages/domain/src/contexts/reporting/report-type-blueprints.ts`, `blueprintSectionsFor`; section ids `bp:<type>:<key>`).
  Wired in `ReportGenerationContextBuilder.loadBase` (also used by section regenerate). The old "no template → blocked" gate now
  applies only to an unknown report type.
- **Applicability:** `templateAppliesToReportType` — ACTIVITY and SITUATION accept only a template of their *own* type; every other
  combination is the author's choice. Enforced on create (explicit mismatched template → validation error; profile default template is
  silently not applied), in the form picker (filtered) and at generation (mismatched/legacy template ignored → blueprint).
- **Blueprints:** Monthly (6 sections: "This Month at a Glance", …), Quarterly / Semi-annual / Annual / Final (donor progress-report shape; financial section is
  optional and forbids invented figures), **Activity** (Introduction → Activity Details with **one level-2 sub-section per selected
  activity**, Participants and Reach, Challenges and Lessons, Next Steps, Evidence Annex; ≤ 8 top-level sections, no executive
  summary), **Situation** (Situation at a Glance; *Background* for report #1 or *Developments Since the Last Report* for follow-ups; Affected
  Population and Needs; Response to Date; Access/Security/Constraints; Coordination; Priority Needs and Next Steps), **Custom** (the
  author's own `scope.sections`, else Background/Findings/Conclusions).
- **Activity data scoping:** verified findings and indicator updates are limited to indicators the selected activities feed
  (`ActivityUpdate.indicatorId`); the writer is told to report only on the selected activities. **Situation** reads activities dated
  inside its window (any period). `resolvePeriodActivities` handles both.
- **Situation series:** server-set `scope.sequence`, `previousPeriodId`, `previousSituationDate` (same event name, case/space-insensitive;
  client values ignored) → "Situation Report #N… emphasise what changed since <date>".
- **Smart defaults (form):** Activity dates = span of the picked activities; Situation dates = day after the previous report on the
  event → as-of date; deadline default 3 days (Situation) / 7 days (Activity) via `defaultDeadlineOffsetForType`, after the template's own
  offset, before the project profile's. Custom has a section-list editor (title + guidance, reorder).
- **Checklist:** Activity adds a per-activity "record accepted" item (`ActivityUpdate.status` ≠ `ACCEPTED`) next to the evidence item.
- **Tests:** `packages/domain/test/report-scope.test.mjs` (blueprints, template applicability, defaults), handler tests in
  `feature18-setup.test.mjs` (situation series, template mismatch), `p0-4-donor-template-gate.test.mjs` (blueprint planning; unknown type
  still blocked).
- **No migration** (scope fields live in `scopeJson`). Worker unchanged since the first pass.
- **Not done:** blueprint section text is English-only; scope still not editable after creation.

### Production verification & fixes (2026-10-03, releases `20261003152523` → `20261003164154`)

Verified end to end in a visible browser on production (EU nutrition project: Activity report over two activities; Situation #1 and #2 on one
event). Defects found by that run, all fixed and re-verified:

- **Never title a blueprint section "Overview".** The AI worker's `outline.py` classes any title matching `executive summary|summary of
  (results|progress)|overview|abstract` as `EXECUTIVE_SUMMARY` (period-on-period delta, project-wide rules) → the opener of an activity/situation report
  failed validation and fell back to non-AI text. Titles are now *Introduction* / *Situation at a Glance* / *This Month at a Glance*;
  `blueprint-tables.test.mjs` asserts no blueprint title matches `overview|abstract`.
- **Written dates are grounded against ISO dates in the inputs.** Activity dates are stored `2028-04-20`; a draft saying "20 April 2028" failed
  `UNGROUNDED_NUMBER: 20`. `grounding.py` (+ TS mirror `number-grounding.ts`) record `date:YYYY-MM-DD` markers and blank out a written date
  ("20 April 2028", "April 20th, 2028", "12 March") **only if that exact date is in the inputs**; bare numbers are still checked.
- **Situation reports carry no indicator findings** (`scopeIndicatorData`, `services/period-activities.ts`): an empty short window made the writer say
  "all six indicators registered zero, down from 5,200". Activity reports keep only the indicators their activities feed.
- **Activity participants table is deterministic** (`services/blueprint-tables.ts`, `bp:activity:participants`, appended in
  `SectionGenerationService.draft`): exact recorded numbers, no `requiredTables` asked of the model. The blueprint also dropped evidence-need hints
  (they leaked as "the donor template requires…") and the invented Situation affected-population table.
- **AI progress popup is portalled to `document.body`** (`AiActivityPopup.tsx`): the page's fade-in wrapper keeps a CSS transform while generating,
  which made `position: fixed` relative to the page (popup at y=1268 on an 854px viewport, scrolling away). Verified fixed on screen at top, scrolled
  and scrolled back.
- Verified OK: type list incl. Semi-annual; scope validation; Activity dates from picked activities (+7-day deadline); Situation dates continue the series
  (+3-day deadline), series numbering is case/space-insensitive and server-owned; ad-hoc reports may overlap a cadence period; Activity checklist adds
  per-activity "evidence attached" and "record accepted" items (after *Scan for missing items*).
- **Cleanup:** the three verification periods (and their drafts/sections/claims/revisions/checklist items) were deleted from production in one guarded
  transaction; `LlmRun` (AI usage ledger) and audit events were deliberately kept.
- **Known, not changed:** the EU visibility sentence repeats at the start of several sections of a short report (donor-visibility rule applies per
  section); the workspace "Indicator values · 6 of 6 verified" panel is project-wide even on an Activity report.

### Follow-ups done (2026-10-03): attribution once, scoped inputs panel, translated titles

- **Donor attribution in exactly one section.** Sections are drafted separately from one shared context, so "include once" put the
  sentence in every section. `attributionSectionTitle` (domain `visibility-statement.ts`) picks the carrier: a dedicated
  acknowledgement/visibility/disclaimer section, else the first top-level non-annex section. `visibilityPromptBlock(…, carrier)` names it
  (the report-wide prefix stays byte-identical across sections), and `SectionGenerationService.draft` enforces it with
  `placeAttribution` + `attributionSentences` (exact statement and quoted disclaimers removed from other sections; statement prepended
  to the carrier if missing). Applies to every report type, template or blueprint.
- **Inputs panel scoped and counted correctly.** `periodIndicatorScope` (`services/period-activities.ts`) is the one rule for the
  indicators list (`ListPeriodIndicatorsHandler`, now also returns `reportType` + `scope.activityCount/acceptedActivityCount`), export
  preflight, readiness and the missing-items scan: Activity = its activities' indicators, Situation = none. The panels
  (`GenerateLaunchCard`, `ReportInputsCard`) take rows from `buildReportInputRows` (`report-editor/application/report-inputs.ts`):
  counts come from *entered* values (an indicator with nothing entered was shown as "verified" on every report type — fixed), Activity
  reports show "Activities · n selected · m accepted" and "Linked indicators", Situation reports "Activities in this window" and no
  indicator row.
- **Blueprint titles in the report language.** `report-type-blueprint-i18n.ts`: catalog for fr / ar / ur / ps (titles + participants
  table headers), chosen from the period's reporting-profile language (`normalizeReportLanguage`, unknown → English). Each blueprint
  section keeps its English `canonicalTitle` (TemplateSection → ReportPlanSection → AI Reporter brief, sent only when translated), and
  every title-based role rule uses it: `classificationTitle`, `isSynthesisSection` (also recognises `bp:*:exec|conclusion` ids for
  persisted sections), legacy narrator guidance, worker `outline.section_kind` and the annex-table validator. Activity sub-section
  titles are the user's own words and are never translated. French is a reviewed translation; **Arabic, Urdu and Pashto titles are
  first drafts that need native review.** The cadence finance section was renamed "Financial and Procurement Status" (it contained
  "Overview").
- **Non-English attribution.** In a French report the writer renders the attribution in French; the safety net, not finding the English
  sentence, used to prepend it as well ("This project is funded…" + "Ce projet est financé…"). `placeAttribution(…, ensure)` now adds the
  missing sentence only for English reports (`normalizeReportLanguage(profile.language) === "en"`); removing exact duplicates from other
  sections still applies to every language. The visibility catalog itself is English-only.
- **Verified on production** (releases `20261003172259`, `20261003174505`, visible browser):
  - English Activity report: attribution exactly once (Introduction), no non-AI fallbacks; launch panel and side panel show
    "Activities · 2 selected · 0 accepted" and "Linked indicators · none linked" (no more "6 of 6 verified").
  - Situation report panel: "Activities in this window · 0", no indicator row.
  - French Activity report (report snapshot language set to `fr`): French section titles, French participants table header
    ("Activité | Total | Hommes | Femmes | Enfants | Personnes handicapées"), French body, no non-AI fallbacks; the duplicate English
    attribution was found here and fixed in `20261003174505`. **The regeneration after that fix was stopped before it could be checked.**
- **Not done — right-to-left export.** DOCX/PDF exporters have no RTL/bidi handling and the PDF uses Helvetica (no Arabic-script glyphs),
  so Arabic/Urdu/Pashto *body text* already renders incorrectly in PDF, independent of the titles. Tracked in `pending.md`.

## Report-type quality gaps closed (2026-10-04)

Plan: [`imp/REPORT-TYPE-QUALITY-GAPS-IMPLEMENTATION-PLAN.md`](../imp/REPORT-TYPE-QUALITY-GAPS-IMPLEMENTATION-PLAN.md). Code state only; not deployed/verified in a browser yet.

- **Comparable history (G1).** `periodComparability` / `selectComparablePeriods` (`packages/domain/.../period-comparability.ts`): a report is only compared
  with its own kind (Quarterly↔Quarterly, Monthly↔Monthly, Annual↔Annual, Situation↔same event; Semi-annual falls back to at most 2 Quarterlies, Final to
  Annual then ≤ 2 Semi-annual/Quarterly; Activity/Custom have no history). `findPreviousPeriods` takes a `PreviousPeriodFilter` (`reportTypes`, `eventKey`).
  Used by prior-narrative (`prior-period.ts`), indicator deltas (`IndicatorAnalyticsService`) and the "previous report approved" checklist item. Sections
  match across reports/languages by blueprint key (`bp:<type>:<key>` → `sectionMatchKeys`), then donor template id, then title (leading numbering ignored);
  a follow-up's "Developments Since the Last Report" looks for the previous report's "at a glance" (`sectionPredecessorKeys`, one-way alias).
- **Life-of-project data (G2).** `computeLifeOfProject` (domain): recorded cumulative of the latest verified period is authoritative for SUM / CUMULATIVE-basis
  indicators, otherwise aggregated from verified period values by the indicator's existing `aggregation` (no schema change was needed); ratios/percentages
  have none. `IndicatorAnalyticsService` adds `finding.lifeOfProject` for SEMI_ANNUAL / ANNUAL / FINAL (cadence periods up to the report's end only).
  Worker: `Finding.lifeOfProject`, cumulative columns in the indicator table, a deterministic cumulative table for the "Cumulative Progress…" section
  (`artifact_builder.cumulative_table`), grounding of the cumulative value and its percent of the project target (Python + `number-grounding.ts`).
  FINAL reports also read the project's accepted activities (cap 60, `resolveGenerationActivities`).
- **Cadence writer guidance (G4).** Every Monthly→Final section has `instructions` (+ `mandatoryQuestions` on narrative sections); `reportTypeGuidance`
  (`llm-report-draft-generator.ts`) adds report-type tone/scope rules to the one guidance SSOT used by both writers.
- **Finance (G3).** `ReportingProfile.financeDataMode` = `DISABLED` (default) | `TYPED` | `IMPORT`, set in the project's reporting profile form. One per-period
  `PeriodFinancialSummary` (migration `20261004100000_period_finance`; RLS list in `infra/postgres/rls.sql`; `/ready` field checks): totals or budget lines
  (totals = sum of lines), currency, source, verification. Any edit drops the verification; **only a VERIFIED summary reaches a writer**
  (`FinanceInputsService.verifiedFor`). Balance and burn rate are computed in the domain (`summarizeFinance`), sent as inputs (so they are grounded) and shown
  in a deterministic table appended to the `bp:*:finance` section, and to a donor template's own financial narrative section (`isDonorFinanceSection`: plain narrative
  with no donor-prescribed table shape). The financial section becomes required only when verified figures exist
  (`BlueprintInput.financeAvailable`). Routes: `GET/PUT /v1/reporting-periods/:id/finance`, `POST …/finance/import-preview`, `POST …/finance/verify`
  (enter = `report.edit`, verify = `report.approve`). Import = pasted CSV/TSV (`parseDelimited`, quotes/tabs aware) → preview → "use ready lines".
  Switching the mode off never deletes stored figures. Web: "Finance" tab on the report inputs page.
- **Situation (G5).** `ReportScope.affectedPopulation[]` (group, figure, source?, asOf?) and `needs[]`; quoted in the writer's scope paragraph with the previous
  report's figures for comparison; a deterministic "Affected population" table in `bp:situation:needs` (with a "Previously reported" column on follow-ups).
  No figures entered → the section says they were not reported (nothing invented).
- **Editable scope (G6).** `UpdateReportingPeriodScopeHandler` (`PUT /v1/reporting-periods/:id/scope`) re-validates through the shared `ReportScopeResolver`
  (also used by creation), keeps a situation's series position unless the event changes, is blocked once the draft is under review/approved/exported/submitted,
  and marks drafted sections' assurance STALE (blocks approval until re-checked; nothing is regenerated automatically — AI credits, manual edits).
  Web: "Covers" tab on the report inputs page (`ScopeInputs`, shared `ReportScopeFields`).
- **Checklist (G7).** New item types `ACTIVITY_RECORD_ACCEPTED`, `AFFECTED_FIGURES_CONFIRMED`, `CUMULATIVE_DATA_COMPLETE` (per indicator), `PRIOR_REPORT_LINKED`,
  `FINANCE_FIGURES_PROVIDED` (`entry` / `verification`); built by `services/report-type-checklist.ts`; legacy open `MISSING_APPROVAL` items are not duplicated.
- **Claim verification.** `NumericAssertionVerifier` also grounds numbers equal to a finding's `lifeOfProject.value` (and its percent of the project target) and to the
  verified finance figures (`IClaimVerifier.verify({ finance })`, fed by `ReportAssuranceService` through `IFinanceInputs.verifiedForPeriod`), otherwise cumulative or
  financial prose would fail assurance and block approval.
- **Verified:** unit/integration suites (domain 295, application ~265, infrastructure ~275, workers 162, web unit 199) plus a scripted end-to-end run through the real handlers,
  Prisma repositories and generation pipeline on a scratch Postgres (stub writer): life-of-project value, same-type deltas, finance unverified→verified table, situation
  series + previous figures, scope edit persistence + STALE marking, checklist items; migration + RLS applied to a scratch DB.
- **Not done:** native-speaker review of ar/ur/ps strings (new table headers included); browser (UI) verification and a run against a real LLM; deploy needs the migration + `rls.sql`.

## Pending Enhancements

- [ ] Automated status transitions based on deadlines
- [ ] Reporting period templates for recurring schedules
- [ ] Period comparison view
- [ ] Auto-copy previous period data
- [ ] Notification on approaching deadlines
- [ ] Reporting calendar view across all projects
- [ ] Bulk period creation for quarterly/annual schedules

## Notes

The reporting period is the central context for report generation. All evidence, activity updates, and indicator updates are associated with a reporting period. Indicator data entry (2026-08-16) is a per-period spreadsheet grid — see "Indicator Data Entry" above.
