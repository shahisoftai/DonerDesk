# Phase 20: Project Setup & Logframe/Indicator Manager UX Enhancements

## Overview

Implementation plan for the UX enhancements recommended for Feature 4 (Project
Setup) and Feature 6 (Logframe & Indicator Manager), grounded in the current
codebase (audited 2026-09-27). Two corrections from the initial recommendation,
made after auditing the real code:

1. **Project creation is already a 3-step wizard** (`GuidedProjectWizard` at
   `apps/web/src/app/(portal)/projects/new/page.tsx`, steps: identity →
   geography → reporting, with per-step Zod validation and a review screen).
   This phase does **not** rebuild the wizard — it extends it (template
   pre-fill, draft persistence) and focuses new UX work on the **post-create
   setup flow** and **readiness visualization**, which are the genuinely weak
   spots.
2. **A sector-template abstraction already exists**
   (`packages/domain/src/contexts/templates/sector-template-pack.ts`:
   `SectorTemplatePack`, `IndicatorTemplate`, `LogframeNodeTemplate`,
   `ComplianceChecklistTemplate`). "Project templates" is not a new bounded
   context — it is wiring this existing entity into the wizard and the
   logframe builder, not inventing a new one. Building a second template
   concept would violate the no-duplication requirement.

All new code follows the existing layering (domain → application → API → web)
and SOLID discipline detailed in [Design Principles](#design-principles-and-solid-compliance).

---

## Part A: Project Setup Enhancements

### A1. Wire `SectorTemplatePack` into project creation

**Problem:** `SectorTemplatePack` exists but nothing in the creation flow
reads it. Every project starts with an empty logframe.

**Design:**
- New read-only query, not a new entity: `packages/application/src/use-cases/templates/list-published-templates.ts`
  — `ListPublishedTemplatesHandler.handle({ sector? })` returns
  `SectorTemplatePack[]` with `status: PUBLISHED`, optionally filtered by
  sector. Single responsibility: listing, no mutation.
- New API route `GET /v1/template-packs?sector=` → thin wiring, Zod-validated
  query param, no business logic in the route (per AGENTS.md "Routes are
  thin").
- Wizard step 1 (`ProjectWizardStepSchema` in
  `apps/web/src/features/projects/validation/project-wizard.ts`) gains an
  **optional** `templatePackId` field (not a new required field — keeps the
  step count and per-field completion cost unchanged, per the multi-step-form
  research: optional fields don't add abandonment risk the way required ones
  do). UI: a dismissible card "Start from a [Sector] template?" shown only
  when a published pack matches the selected sector, not a mandatory step.
- On submit, `CreateProjectHandler.handle` (already the sole entry point for
  project creation — no new handler) gains one new optional post-step: if
  `templatePackId` is present, it delegates to the **existing**
  `ImportLogframeHandler`-style path by calling a new, narrowly-scoped
  `SeedLogframeFromTemplateHandler` (`packages/application/src/use-cases/logframe/seed-logframe-from-template.ts`).
  This handler takes `(projectId, templatePackId)` and, for each
  `LogframeNodeTemplate`/`IndicatorTemplate` in the pack, builds
  `LogframeItem`/`Indicator` domain entities and persists them via the
  **existing** `ILogframeItemRepository`/`IIndicatorRepository` ports — no new
  repository interfaces. This keeps `CreateProjectHandler` from growing a
  second responsibility (Single Responsibility Principle): it still only
  creates the project + setup + reporting profile; template seeding is an
  independent handler it composes, invoked via the same
  `ITransactionManager` unit-of-work already used for the other seeding steps
  (`ProjectSetup`, `ReportingProfile`).
- Audit event: `logframe.seeded_from_template` (follows existing
  `project.created` / `logframe.indicator.semantics_configured` naming
  convention).

**No duplication check:** this reuses `SectorTemplatePack`,
`ImportLogframeHandler`'s entity-building logic (extract the
template-row-to-domain-entity mapping into a shared pure function in
`packages/domain/src/contexts/logframe/` if `parseLogframeText` and the new
seeder would otherwise duplicate mapping logic), and the existing
repositories. No new template entity, no new import pipeline.

### A2. Draft persistence across wizard steps

**Problem:** `GuidedProjectWizard` is client-side state only
(`emptyWizardData()` / `validateStep()` in-memory) — a page refresh or
accidental navigation loses all progress, including template selection.

**Design:**
- No new backend entity. Persist wizard state in `localStorage`, namespaced by
  a wizard session id (`donordesk.project-wizard.<uuid>`), written on every
  step transition (`onStepComplete`) and cleared on successful
  `createProjectAction` submit or explicit "discard draft" action. This is a
  pure `apps/web` concern — it never touches `packages/domain` or
  `packages/application`, keeping the wizard's resilience a web-layer detail
  (Dependency Inversion: the wizard depends on a `WizardDraftStore` interface
  it defines locally, with a `localStorage` implementation swappable for
  tests).
- On wizard mount, check for an existing unexpired draft (24h TTL) and offer
  "Resume draft from [time]" vs. "Start fresh," rather than silently
  restoring — avoids surprising a user who intentionally abandoned a draft.

### A3. Readiness score as a visual breakdown, not just a number

**Problem:** `calculateReadiness` (`packages/domain/src/contexts/compliance/readiness-calculator.ts`)
already computes `sectionsScore, indicatorsScore, evidenceScore,
checklistScore, approvalScore` plus the weighted `baseOverall` and
`qualityScore` — but the Project Overview only needs to surface what's
already computed; no domain change is required here.

**Design:**
- `CalculateReadinessHandler` already returns the full `ReadinessBreakdown` —
  confirm the existing `GET /api/projects/:id/overview` /
  `getProjectDashboard` read model passes the **breakdown**, not just the
  rolled-up score, through to the web layer (if it currently truncates to a
  single number, widen the DTO — additive, non-breaking field).
- New presentation component `apps/web/src/features/projects/presentation/ReadinessRing.tsx`:
  an SVG ring segmented into the five weighted categories
  (sections/indicators/evidence/checklist/approval), each segment sized by its
  weight (0.25/0.20/0.25/0.20/0.10) and colored by its own completion
  fraction. Hover/tap on a segment reveals the specific blocker count (e.g.
  "3 sections not yet approved") using data already in `ReadinessBreakdown`.
  If `dataQualityBlockers` reduced the score via the `DATA_QUALITY_PENALTY`,
  show that explicitly ("−15 pts: unresolved contradictions") rather than
  leaving the gap unexplained.
- This is presentation-only work: one new component, one DTO field widened if
  needed, zero domain/application changes beyond confirming the read model
  already exposes the breakdown.

### A4. Tab consolidation

**Design:** Group the existing 8 detail-page tabs (Overview, Logframe,
Activities, Evidence, Reports, Compliance, Team, Settings) into a primary row
(Overview, Logframe, Activities, Reports) plus a "More" overflow
(Evidence, Compliance, Team, Settings) on viewports under a breakpoint. This
is a pure layout change to the existing tab-navigation component — no route
changes, since all 8 tabs keep their current URLs; only the visual grouping
changes. No backend involvement.

---

## Part B: Logframe & Indicator Manager Enhancements

### B1. Drag-and-drop hierarchy builder

**Problem:** `logframe/page.tsx` renders a **static, read-only** nested list
(indentation via inline `paddingLeft: depth * 1.5rem`, sorted by
`LEVEL_ORDER` and code, built with the existing `buildHierarchy`/
`walkHierarchy` helpers in `apps/web/src/lib/shared/hierarchy.ts`). There is
no drag-and-drop library anywhere in the repo (confirmed: no `dnd-kit`,
`react-beautiful-dnd`, `react-dnd`, or `sortable` in any `package.json`).

**Design:**
- Add `@dnd-kit/core` + `@dnd-kit/sortable` to `apps/web` — chosen over
  `react-beautiful-dnd` (unmaintained) and `react-dnd` (more boilerplate for
  nested-tree reordering); `@dnd-kit` has first-class nested/sortable-tree
  support and is actively maintained.
- New client component `apps/web/src/features/logframe/presentation/LogframeTreeEditor.tsx`,
  replacing the static render in `logframe/page.tsx` with an editable tree
  that **reuses** `buildHierarchy`/`walkHierarchy` for the data shape (no
  parallel tree-building logic) and layers `@dnd-kit` sortable context on
  top. Each node is color-coded by `level` (GOAL/OUTCOME/OUTPUT/ACTIVITY)
  using a single shared `LEVEL_COLORS` map exported once from
  `apps/web/src/features/logframe/presentation/level-colors.ts` — referenced
  by the tree editor, the indicator list, and any future logframe chart, so
  the mapping isn't redefined per component (avoids the classic
  copy-pasted-constant duplication).
- Reordering/re-parenting emits a `PATCH /api/logframe-items/:id` call using
  the **existing** `updateLogframeItem` endpoint with an updated `parentId`
  (and a new optional `sortOrder: number` field — see below) — no new
  endpoint for the common case of moving one node.
- **Domain change required:** `LogframeItem` currently has no explicit
  ordering field (`packages/domain/src/contexts/logframe/logframe-item.ts:8-14`
  sorts implicitly by `code` at read time). Add `sortOrder: number` to
  `LogframeItemProps`, defaulting to insertion order for existing rows via a
  backfill migration (`ORDER BY code` at migration time). This is additive —
  `UpdateLogframeItemSchema` in `packages/contracts/src/logframe.ts` gains an
  optional `sortOrder`, and the read model orders by `sortOrder` with
  fallback to `code` for rows not yet reordered (keeps behavior unchanged
  until a user actually drags something — Open/Closed: existing sort-by-code
  behavior isn't removed, just superseded when `sortOrder` is set).
- Reject invalid re-parenting **in the domain**, not just the UI: add a pure
  domain validator (`LogframeItem` cannot become its own descendant's parent;
  a node's `level` must be one level below its new parent's `level`, e.g. an
  OUTPUT can't be dropped under an ACTIVITY). This mirrors the existing
  pattern of domain-level validation (`sanitizeIndicatorSemantics`) rather
  than trusting client-side drag constraints alone.

### B2. Baseline → target visual with disaggregation

**Problem:** `disaggregationRequired: boolean` exists on `Indicator`
(`indicator.ts:9-24`) but nothing collects or displays disaggregated values —
Feature 6's own "Not implemented" line. `baseline`/`target` are stored as
strings with no visual representation anywhere.

**Design (this is the one net-new sub-feature, done as a single vertical
slice, not two disconnected pending items):**
- **Domain:** new value object `IndicatorDisaggregation` in
  `packages/domain/src/contexts/logframe/indicator-disaggregation.ts`:
  `{ dimension: DisaggregationDimension /* SEX | AGE_GROUP | DISABILITY | CUSTOM */, category: string, value: number }`.
  New entity `IndicatorUpdateDisaggregation` linking to an existing
  `IndicatorUpdate` by id, persisted 1-to-many. This does **not** duplicate
  `IndicatorUpdate` — it's a child collection, following the same
  aggregate-per-repository rule already used for `ProjectSetup`,
  `ReportingProfile`, etc. (one repository per aggregate, per AGENTS.md).
- **Application:** extend the **existing**
  `upsertIndicatorUpdate`/`bulk-upsert-indicator-updates.ts` handlers to
  accept an optional `disaggregations: IndicatorDisaggregationInput[]` array
  alongside `periodAchievement` — not a new use-case, since disaggregated
  values are just detail on the same update, not a separate lifecycle. Sum of
  disaggregated values must equal (or be validated against)
  `periodAchievement` when `disaggregationRequired` is true — validated in
  the domain (`IndicatorUpdate` gains a pure `validateDisaggregationTotals()`
  method), surfaced as a `422` with a specific error code
  (`DISAGGREGATION_TOTAL_MISMATCH`) rather than silently accepted, so bad data
  can't reach `VerifiedFinding` and corrupt report numbers (protects the
  "grounding" invariant already enforced elsewhere in the reporting
  pipeline).
- **Contracts:** `packages/contracts/src/logframe.ts` —
  `IndicatorDisaggregationSchema`, extend
  `CreateIndicatorUpdateSchema`/`UpsertIndicatorUpdateSchema`/
  `BulkUpsertIndicatorUpdatesSchema` with the optional field.
- **Read model:** extend `GET /v1/reporting-periods/:id/indicators` to
  include each update's disaggregation breakdown alongside the existing
  merge of indicators + updates — same query, one additional join, no new
  endpoint.
- **UI:** `IndicatorSemanticsCard`'s sibling on the indicator detail page
  (`apps/web/src/app/(portal)/projects/[id]/indicators/[indicatorId]/page.tsx`,
  currently only 31 lines wrapping one card) gains a second card,
  `IndicatorProgressCard.tsx`: a horizontal bar from `baseline` to `target`
  with the current cumulative value marked, and — only when
  `disaggregationRequired` — a stacked segment breakdown beneath it by
  dimension/category. The period-entry grid
  (`/projects/[id]/reports/[periodId]/indicators`) gains an expandable row
  section for entering disaggregated values only for indicators that require
  it (progressive disclosure — indicators that don't require disaggregation
  see no extra UI, avoiding the "every field costs completion" tax on the
  majority of indicators).

### B3. Indicator update history read model

**Problem:** `GET /v1/indicators/:id/updates` is listed as
"Not implemented" in Feature 6's pending list (`listIndicatorUpdates` handler
referenced in the endpoint table but no read model backs it per the doc).

**Design:**
- `packages/application/src/use-cases/logframe/list-indicator-updates.ts` —
  `ListIndicatorUpdatesHandler.handle({ indicatorId })`, reusing the
  **existing** `IIndicatorUpdateRepository` (no new port) with a
  `findByIndicatorId` method added to that interface if not already present.
  Returns updates ordered by `reportingPeriodId` chronologically, each
  including `verificationStatus`, `verifiedById`, disaggregation (from B2) if
  present.
- UI: a `IndicatorHistoryPanel.tsx` on the indicator detail page, a simple
  chronological table/sparkline (reuses the `dataviz` skill's sparkline
  pattern for the period-achievement trend) — this is what makes B2's single
  baseline→target snapshot into a genuine trend view without building a
  second charting abstraction.

### B4. Verification pipeline visualization + correction/reject routes

**Problem:** `VerificationStatus` (DRAFT/SUBMITTED/VERIFIED/NEEDS_CORRECTION/
REJECTED) exists on `IndicatorUpdate` but Feature 6 lists "Request-correction
/ reject routes for indicator updates" as not implemented, and there is no
UI visualizing the pipeline.

**Design:**
- **Application:** two new narrowly-scoped handlers, not a generic
  "transition" handler that would hide the distinct authorization/audit
  rules each transition needs:
  `request-indicator-update-correction.ts` (SUBMITTED/VERIFIED →
  NEEDS_CORRECTION, requires a `comments` reason, M&E-role-gated) and
  `reject-indicator-update.ts` (SUBMITTED → REJECTED, requires a reason,
  same role gate as `verify-indicator-update.ts` which this mirrors). Both
  follow the exact pattern already established by
  `packages/application/src/use-cases/logframe/verify-indicator-update.ts`
  (same audit-event convention, same repository, same status-guard style) —
  this is deliberate consistency, not three divergent implementations of
  "change status."
- **API:** `PATCH /v1/indicator-updates/:id/request-correction`,
  `PATCH /v1/indicator-updates/:id/reject`, alongside the existing
  `PATCH /v1/indicator-updates/:id` — thin routes delegating straight to the
  handlers.
- **UI:** `IndicatorVerificationPipeline.tsx` — a horizontal Kanban-style
  strip (Draft → Submitted → Verified / Needs correction / Rejected) shown on
  both the indicator detail page and the period-entry grid header, driven
  entirely by counts already available from B3's read model — no new
  aggregation query.

### B5. Semantics nudge during indicator creation

**Problem:** `IndicatorSemanticsCard` (semantics configuration) is only
reachable after creating an indicator, so PERCENTAGE/RATIO indicators sit in
`REQUIRES_REVIEW` until someone visits the detail page.

**Design:** No new domain/application code — `defaultSemanticsForType` and
`inferIndicatorSemantics` already exist
(`packages/domain/src/contexts/logframe/indicator-semantics.ts`). Purely a UI
sequencing change: `logframe/new-indicator/page.tsx`'s form calls
`inferIndicatorSemantics(type)` client-side as soon as `type` is selected; if
the inferred status is `REQUIRES_REVIEW` (i.e., PERCENTAGE/RATIO without an
inferable numerator/denominator), show the **same** `IndicatorSemanticsCard`
fields inline in the creation form (imported as-is from
`apps/web/src/features/logframe/presentation/`, not re-implemented) instead
of only after creation. This reuses the one existing card component in two
places rather than forking it.

---

## Design Principles and SOLID Compliance

To keep this phase's additions consistent with the codebase's existing
discipline (AGENTS.md layering rules) and avoid duplication/errors:

- **Single Responsibility.** Every new handler does exactly one thing:
  `SeedLogframeFromTemplateHandler` seeds, it does not create projects;
  `RequestIndicatorUpdateCorrectionHandler` and `RejectIndicatorUpdateHandler`
  are separate handlers, not one handler branching on an action enum — each
  has its own authorization rule and audit event, and merging them would mix
  two independently-changing policies into one function.
- **Open/Closed.** `sortOrder` is additive to `LogframeItem`; existing
  code paths that sort by `code` keep working for rows that have never been
  reordered. `disaggregations` is an optional array on existing update
  schemas, not a breaking shape change. No existing handler signature is
  altered in an incompatible way.
- **Liskov substitution / port integrity.** No new repository *interfaces*
  are introduced where an existing one already models the aggregate
  (`ILogframeItemRepository`, `IIndicatorRepository`, `IIndicatorUpdateRepository`
  are extended with new query methods, e.g. `findByIndicatorId`, rather than
  replaced or shadowed by a second port for the same aggregate).
- **Interface Segregation.** The wizard's `WizardDraftStore` is a two-method
  interface (`save`/`load`) defined where it's consumed (web layer only) —
  it is not folded into a larger "wizard service" interface that would force
  unrelated consumers to depend on methods they don't use.
- **Dependency Inversion.** `SeedLogframeFromTemplateHandler` and the two new
  verification-transition handlers depend on the existing repository *ports*
  from `packages/application`, never on Prisma types directly — matching
  the existing pattern where `packages/application` has zero infrastructure
  imports (AGENTS.md).
- **No duplication, explicitly checked per item:**
  - Template concept → reuse `SectorTemplatePack` (A1), not a new entity.
  - Logframe entity mapping (template seed vs. `parseLogframeText` import) →
    extract one shared pure mapping function if seeding and import would
    otherwise write the same row-to-entity logic twice.
  - Tree traversal → reuse `buildHierarchy`/`walkHierarchy` (B1), do not
    write a second tree-flattening algorithm for the drag-and-drop view.
  - Level color coding → one exported `LEVEL_COLORS` map (B1), referenced
    everywhere a level needs a color, not redefined per component.
  - Status-transition audit/authorization pattern → correction and reject
    handlers mirror `verify-indicator-update.ts`'s existing shape (B4)
    instead of inventing a new state-machine abstraction.
  - Semantics UI → the creation-time nudge (B5) imports the existing
    `IndicatorSemanticsCard` fields rather than forking a second semantics
    form.
- **No errors / invariant protection.** Every value that can corrupt a
  verified report number is validated in the **domain**, not just the UI:
  re-parenting legality (B1), disaggregation-sum-matches-total (B2). This
  matches the existing pattern where `grounding.py` / `number-grounding.ts`
  reject ungrounded numbers — new data entry points must not create a way
  for a bad number to reach `VerifiedFinding` unchecked.

---

## Migration / Rollout Plan

1. **Schema additions** (additive only, one migration):
   `LogframeItem.sortOrder`, `IndicatorUpdateDisaggregation` table,
   `REQUIRED_PRISMA_FIELDS` updated per the "Prisma client vs schema drift"
   deploy invariant (AGENTS.md) for both new fields/tables before merge.
2. **Feature flags:** ship B1 (drag-and-drop) and A1 (template seeding)
   behind flags (`LOGFRAME_DND_ENABLED`, `PROJECT_TEMPLATE_SEEDING_ENABLED`)
   since both change a primary creation/editing surface; B2–B5 are additive
   UI/API surfaces that can ship unflagged once their migrations land.
3. **Sequencing:** A1 depends on B1's `sortOrder` field being present (a
   seeded logframe should have a sensible default order) — land B1's schema
   migration before A1's seeding handler ships.
4. **Testing:** unit tests per new handler (mirroring existing
   `verify-indicator-update` test conventions), a domain test for the
   re-parenting legality validator and `validateDisaggregationTotals()`, and
   an e2e test for the full wizard → template-seeded logframe →
   drag-reorder → disaggregated update → verify pipeline, per
   `pnpm test:e2e`.

## Status

| Item | Status |
|------|--------|
| A1 Template wiring | **Blocked — needs decision** (see below) |
| A2 Wizard draft persistence | Implemented |
| A3 Readiness breakdown | Implemented |
| A4 Tab consolidation | Implemented |
| B1 Drag-and-drop hierarchy | Implemented (behind `LOGFRAME_DND_ENABLED`) |
| B2 Baseline/target + disaggregation | Implemented |
| B3 Indicator update history | Implemented |
| B4 Verification pipeline + correction/reject routes | Implemented |
| B5 Semantics creation-time nudge | Implemented |

## Implementation notes (2026-09-27)

What was actually built, including where the code audit forced a deviation
from the design above.

### B4 — review decisions
- Domain: `IndicatorUpdate.requestCorrection` (from SUBMITTED/VERIFIED, clears
  verifier) and `reject` (from SUBMITTED only) now guard transitions and
  require a non-empty reason; previously they had no guards and no callers.
- Application: `reviewIndicatorUpdate` (`review-indicator-update.ts`) is the
  one load → transition → save → audit flow; `VerifyIndicatorUpdateHandler`,
  `RequestIndicatorUpdateCorrectionHandler`, `RejectIndicatorUpdateHandler`
  are separate classes on top of it. Domain errors now come back as `Result`.
- API: `POST /v1/indicator-updates/:id/request-correction` and `/reject`
  (body `IndicatorUpdateReviewReasonSchema`), permission `indicator.verify`.
- Repository fix: `PrismaIndicatorUpdateRepository.update` writes
  `verifiedById/verifiedAt ?? null` — Prisma ignores `undefined`, so a
  correction would otherwise never clear the verifier.

### B3 — history read model
- `GET /v1/indicators/:id/updates` → `ListIndicatorUpdatesHandler`
  (oldest period first, with period type/start/end), permission `project.view`.
- `toIndicatorUpdateView` is the single update serializer, shared with
  `ListPeriodIndicatorsHandler`.
- Indicator page: `IndicatorProgressCard`, `IndicatorVerificationPipeline`,
  `IndicatorHistoryPanel` (verify / request correction / reject with reason)
  replace the "no history read model" placeholder.

### B1 — logframe ordering and moves
- Deviation: there was **no** update/move endpoint for logframe items (the plan
  assumed `PATCH /logframe-items/:id`). Added `PUT /v1/logframe-items/:id/position`
  (`MoveLogframeItemSchema { parentId | null, index }`, `logframe.manage`).
- Domain: `planLogframeMove` validates (parent exists in the same project,
  strictly higher level — levels may be skipped, no cycles) and renumbers the
  sibling group densely; `compareLogframeItems` is the one ordering rule
  (sortOrder → level → code → createdAt). `CreateLogframeItemHandler` reuses it
  to validate the parent and append.
- Schema: `LogframeItem.sortOrder Int @default(0)` (in `REQUIRED_PRISMA_FIELDS`).
  No backfill: all-zero keeps today's level/code order until a group is reordered.
  `ILogframeRepository.savePositions` writes a group in one transaction.
- UI: `LogframeTreeEditor` (`@dnd-kit`, sibling reorder by pointer or keyboard,
  plus "Move to"), shown editable only with `LOGFRAME_DND_ENABLED=1` and the
  `logframe.edit` capability; read-only otherwise. "Add child" links.
- Usability fix found in the audit: "Add logframe item" had **no parent
  picker**, so hand-built items could never be nested. Both create forms now
  use the shared `LogframeItemSelect`.

### B5 — semantics nudge
- Deviation: the semantics card needs an indicator id, so it cannot be shown
  before creation without forking it. The create form warns for
  PERCENTAGE/RATIO and redirects to the indicator's calculation card after save.
- Usability fix: "Add indicator" asked users to **paste a logframe item id**;
  it is now a hierarchy dropdown.

### B2 — disaggregation
- Deviation: stored as `IndicatorUpdate.disaggregationJson` (value objects of
  the update aggregate, like `semanticsJson`), not a separate table/repository —
  same RLS, one atomic write, no extra aggregate.
- Domain: `validateDisaggregation` (known dimension, named category, numeric
  value, no duplicates; for NUMBER/CURRENCY each dimension must sum to the
  period value — `disaggregationMustSum`). Percentages are never summed.
- `BulkUpsertIndicatorUpdatesHandler` validates all rows before writing any.
  `disaggregation` omitted = keep, `[]` = clear.
- UI: breakdown editor per row in the entry grid (presets for sex / age /
  disability), latest breakdown on the indicator page. Not yet fed into report
  generation.

### A2 / A3 / A4
- A2: `createWizardDraftStore` (injected storage, validated on load, 24 h TTL);
  the wizard offers Resume / Start fresh and clears the draft on create.
- A3: the readiness endpoint additively returns `weights` + `dataQualityPenalty`
  (from the domain constants); `ReadinessBreakdownList` shows weight, points
  contributed, a fix link per dimension and the data-quality cap. Fixed the
  overview's period dropdown, which had no handler (`?period=` now selects it).
- A4: `Tabs` supports `secondary` (folded into "More" on phones) and
  `matchPrefixes` (indicator pages now highlight the Logframe tab).

### A1 — why it is blocked
`SectorTemplatePack` has a domain entity, a Prisma table and a repository
*interface* only: no implementation, no seeded packs, no authoring UI. Its
shape also does not map to the logframe (levels `goal/purpose/output/activity`,
flat nodes with no parent links, indicator types `quantitative/qualitative/binary`,
no node↔indicator link). Wiring it into the wizard would ship a card that can
never appear. Options: build a curated pack library + mapping, or replace A1
with "copy logframe from an existing project" (real data, already on the
Feature 4 pending list).

### Verification
`pnpm -r typecheck` and `pnpm -r build` clean; tests: domain 217, application
129, infrastructure 229, web unit 175 all pass. API: 30 pass, 2 billing tests
fail only because they need a live Postgres (unrelated).
