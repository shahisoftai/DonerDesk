# Phase 52 — Results Framework and Logframe: one backbone, two lenses

**DonorDesk Version 3.007** · plan written 2026-11-12 · branch to create: `0021-results-framework` · status: BUILT 2026-11-12 on `0021-results-framework` (uncommitted; **nothing has been built, typechecked, tested or deployed yet**; see §12)

## 0. Why

A Results Framework explains *what* a programme intends to achieve and *why* each level leads to the next. A Logframe turns
that logic into a measurement matrix: indicators, baselines, targets, means of verification and assumptions. Donors use one
or the other (USAID: Results Framework with IRs and sub-IRs; FCDO/EU: logframe or intervention logic), and the two must stay
in step: a change to the agreed results logic must be traceable into the measurement matrix without rewriting the targets
or the periods a report was already approved against.

DonorDesk today has one object, `LogframeItem`, and calls it both things (`key-concepts.md`: "Logframe | The results
framework"). It has no assumptions, no causal rationale, no donor vocabulary, and no guard on a target edit after approval.

**Decision (owner, 2026-11-12): do not build a second tree.** The hierarchy of results is the same object in both
documents; what differs is the columns attached and the words used. We keep one backbone and give it two lenses.

**We keep these rules on purpose:**
- Planning text (assumptions, rationale) never reaches a report writer unless a person switches it on (Batch 52.6, deferred).
- A target that an approved report was judged against is never changed in place.
- Stored data never changes when a donor's vocabulary changes; only the words shown do.
- No cross-contribution graph (one output feeding two outcomes). Every rollup (`owningOutcome`, place rollups, portfolio
  totals) depends on a tree. A cross-link is written as a rationale sentence.

## 1. What exists today (verified in code 2026-11-12)

| Area | Today | Where |
|---|---|---|
| Hierarchy | `LogframeItem`: `level` (GOAL/OUTCOME/OUTPUT/ACTIVITY), `parentId`, `code`, `title`, `description`, `sortOrder`. No assumptions, no rationale. | `packages/domain/src/contexts/logframe/logframe-item.ts`, `schema.prisma:433` |
| Editing a result | Create and move only. **There is no `UpdateLogframeItemHandler`**: a title or description cannot be corrected after creation except by re-import. | `use-cases/logframe/` |
| Indicators | baseline, target, unit, MoV, data source, frequency, disaggregation, target schedule, formula, semantics, library link | `schema.prisma:452` |
| Versions | `LogframeVersion` (append-only snapshot, `contentHash`, `summary`, `approvedBy/At`); `LogframeVersioner.capture` after every framework handler via `withLogframeVersioning`; `ApproveLogframeVersionHandler` | `services/logframe-versioning.ts`, `logframe-version-handlers.ts` |
| Snapshot | `buildLogframeSnapshot` / `diffLogframeSnapshots` / `summarizeLogframeChanges`; optional fields (`targetSchedule`, `formula`) present only when set so hashes stay stable | `logframe-snapshot.ts` |
| Report ↔ framework | `ApproveReportHandler` writes `{logframeVersion, logframeApproved}` into the approval audit row | `approve-report.ts:119-124` |
| Guards | `checkIndicatorEdit` (type cannot change once values exist); `IIndicatorApprovalGuard.isUsedInApprovedReport` (move/archive refused). **`UpdateIndicatorHandler` applies no guard to `target`, `baseline` or `targetSchedule`.** | `indicator-change-rules.ts`, `update-indicator.ts` |
| Period lock | `isPeriodLocked` blocks value writes (not definition edits) | reporting |
| Vocabulary | Level names hard-coded in `apps/web/src/lib/labels.ts:102-105` and repeated in `labels.ts` (infographics), `pcw/copy.ts`, `apply-sheets.ts`, exports | several |
| Risks | `ProjectRisk` is a separate list; may point at a planned activity, never at a result; never in the framework version | `contexts/risks/` |
| Export | `logframe-template.ts` builds the import workbook; DOCX/PDF exports render indicator tables, no four-column logframe | `infrastructure/src/exports/` |
| Wizard | Results slide builds the tree; `RESULT_OPERATIONS` table; sector library suggests results and indicators | `project-setup/pcw/` |
| Writer | receives findings and section briefs; never sees `description` of results today | `ai-reporter` |

## 2. Principles for this phase (SOLID, made checkable)

- **S — one job per file.** `framework-lenses.ts` (which columns a lens shows), `framework-vocabulary.ts` (what a level is
  called), `framework-change-rules.ts` (what may change after approval), `framework-change-classifier.ts` (strategic vs
  measurement), each ≤ 300 lines, one exported class at most, no React/Prisma. The existing architecture test is extended
  to `contexts/logframe/**` and `features/logframe/**`.
- **O — rows, not branches.** Lenses (`FRAMEWORK_LENSES`), vocabulary presets (`VOCABULARY_PRESETS`), change kinds
  (`FRAMEWORK_CHANGE_KINDS`), guard rules (`POST_APPROVAL_RULES`) and export columns (`LENS_COLUMNS`) are tables. A test
  greps the logframe context, the web feature and the exporters for `lens ===`, `"RESULTS"`/`"LOGFRAME"` literals and
  `"Goal"`-style strings outside the tables. Adding a donor's vocabulary is a row and needs no code.
- **L — one contract for every lens.** `FrameworkLens` = `{ key, levels, itemFields, indicatorFields, documentName }`;
  `renderFramework(snapshot, lens, vocab)` works for any row. A contract test runs every lens through the same fixture
  (renders, hides what it must, shows nothing not in its field list, round-trips through the DOCX renderer).
- **I — narrow ports.** `IFrameworkApprovalReader` (one question: the latest approved version's snapshot, or null),
  `IVocabularyReader` (the project's vocabulary, or the default). Neither widens `ILogframeRepository`; the handlers that
  do not need them do not receive them.
- **D — depend on the rule, not the row.** Handlers call `checkPostApprovalChange(facts)` and `classifyFrameworkChange
  (diff)`; the facts are loaded by the application layer from the ports. Presentation gets `lens` and `vocab` as data
  and never reads the profile itself. Adapters (Prisma) implement the new ports; wiring is in `container.ts` only.
- **Honesty rules carried over**: a missing baseline or target stays empty, never 0; vocabulary never alters a stored
  `level`; a version diff names every changed field; nothing is written on a view.

## 3. Batch 52.0 — Vocabulary: one function for a level's name (no migration)

**Domain** (`logframe/framework-vocabulary.ts`)
- `FrameworkVocabulary = { document: string; levels: Record<LogframeLevel, string>; plural?: Partial<Record<LogframeLevel, string>> }`.
- `VOCABULARY_PRESETS` (table): `DONORDESK` (Goal/Outcome/Output/Activity, "Logframe"), `USAID` (Goal / Strategic
  Objective / Intermediate Result / Activity, "Results Framework"), `FCDO` (Impact/Outcome/Output/Activity, "Logframe"),
  `EU` (Overall objective / Specific objective / Result / Activity, "Intervention logic"), `UN` (Impact/Outcome/Output/
  Activity, "Results Framework"), `CUSTOM` (person's own words). Every preset names all four levels; a test walks the table.
- `levelName(level, vocab)`, `documentName(vocab)`, `parseVocabulary(json)` (defensive; unknown or missing → default).
- `checkVocabulary(input)`: four non-empty distinct names ≤ 40 chars; a name containing a code, uuid or snake_case fails
  (`findRawTokens`).

**Persistence**: `ReportingProfile.vocabularyJson String @default("{}")` — *this is the one migration of the batch*, additive
(`20261116090000_framework_vocabulary`); `/ready` requires `ReportingProfile.vocabularyJson`. `ReportingProfileRepository
.update` writes it (test pins). Set through the existing reporting-profile form (one select + four fields shown for CUSTOM),
`project.edit`, audited `reporting_profile.vocabulary_set`.

**Consumers** (each change is a replacement of a hard-coded word by `levelName`): `labels.ts:102`, `LogframeTreeEditor`,
`NewLogframeItemForm`, `LogframeItemSelect`, the logframe page headings, the Data Center level filter, the exports
(`logframe-template.ts` keeps the *import* headers English: files must round-trip; it may add a second row of donor words),
the wizard's Results slide (uses the donor preset chosen on the Start slide when the donor is one of the presets), the
writer brief's level words (`sectionGuidance` names "outcome"/"output" — pass the vocabulary; the Python contract is
unchanged because these are data, not rules).

**Tests**: preset completeness; `levelName` falls back by level; copy-lint on names; a grep test that no `"Goal"`/
`"Outcome"`/`"Output"` string literal remains in `features/logframe/**`, `lib/labels.ts` or the exporters outside the
vocabulary table (the i18n catalogue keeps its own keys for the default preset).

## 4. Batch 52.1 — The backbone gains its missing columns, and a result can be edited

**Migration** `20261116100000_framework_logic` (additive): `LogframeItem.assumptions String?`, `LogframeItem.rationale
String?`. `/ready` requires `LogframeItem.rationale`. No RLS change.

**Domain**
- `LogframeItemProps` gains `assumptions?`, `rationale?`; `LogframeItem.edit({ title?, description?, assumptions?,
  rationale? })` validates (title ≥ 2 chars; each text ≤ 4000) and `touch()`es. `code` and `level` are not editable here
  (a level change is a move with its own rules; a code change is refused once an approved version names it — Batch 52.3).
- `SnapshotItem` gains `assumptions?` and `rationale?` **present only when set**, exactly like `targetSchedule`, so every
  stored `contentHash` is unchanged (test: a snapshot built from items without them is byte-identical to today's).
- `diffLogframeSnapshots` reports the two fields; `summarizeLogframeChanges` writes "assumption changed on Output 1.2".

**Application**: `UpdateLogframeItemHandler` (new; `logframe.manage`; wrapped by `withLogframeVersioning` in the container
like every framework handler; audited `logframe.item.updated` with old/new). `PrismaLogframeRepository.update` writes both
fields with `?? null` (persistence test pins, as for `showWorkPlanning`).

**Import / wizard / library**: the Logframe sheet gains optional `Assumptions` and `Rationale` columns (`header-vocab.ts`
rows; an absent column is absent, never ""); `RESULT_OPERATIONS` gains `SET_ASSUMPTIONS`/`SET_RATIONALE` rows; the
sector library's suggested results may carry a starting assumption (data, `UNREVIEWED`, optional); `planLogframeCopy` copies
both (definitions, not values); `ProjectRisk` gains an optional `logframeItemId` (same migration) so a risk can sit against
a result — it stays in the risk list and **does not** enter the version snapshot.

**Route**: `PATCH /v1/logframe-items/:id` (`logframe.manage`, in `RULES`; body Zod with `describeValidationIssue` labels).

**Web**: `LogframeTreeEditor` node gets an Edit disclosure (title, description, assumptions, rationale) through one
`EditLogframeItemForm`; `NewLogframeItemForm` gains the two fields collapsed under "Logic".

**Tests**: entity edit rules; snapshot hash stability; diff/summary rows; handler (refuses another project's id, audits,
versions); persistence (`?? null`); import column parsing; wizard op; architecture (no new branches).

## 5. Batch 52.2 — Two lenses over one backbone

**Domain** (`logframe/framework-lenses.ts`)
- `FrameworkLens` contract (§2 L). `FRAMEWORK_LENSES`:
  - `RESULTS`: levels GOAL/OUTCOME/OUTPUT; item fields `title, description, rationale`; indicator fields `code, name`
    (the "usually includes indicators" column, names only); document name from vocabulary.
  - `LOGFRAME`: all four levels; item fields `title, assumptions`; indicator fields `code, name, baseline, target, unit,
    meansOfVerification, dataSource, frequency`.
  - A `CUSTOM` row is out of scope (named in §9).
- `renderFramework(snapshot, lens, vocab) → FrameworkDocument` (pure): rows in tree order, each with `levelName`, the
  lens's fields only, indicators grouped under their result; a missing baseline/target is `null`. `LENS_COLUMNS` is the
  one table the screen, DOCX and PDF read for headings.
- `lensProblems(lens)` (contract check used by the table test).

**Infrastructure**: `FrameworkDocumentRenderer` (DOCX via the existing `markdown-renderer` tables; PDF through the same
path as report exports), one class, takes a `FrameworkDocument`; `GET /v1/projects/:id/framework/export?lens=&format=`
(`report.export`, audited counts only). The donor-template Python export is **not** touched (it draws report sections).

**Web**: the logframe page gets a lens switch (segmented control, kept per device in `localStorage`, defensive parse);
`FrameworkTable` draws `FrameworkDocument` and nothing else (it never reads the profile: `lens` and `vocab` are props).
The tree editor stays the editing surface; the lenses are reading/export surfaces. A "Download as {documentName}" button
calls the export route.

**Tests**: contract test over every lens (renders fixture; shows only its fields; no 0 for a gap); renderer parity
(DOCX table text equals `FrameworkDocument` cells, one row per lens); route in `RULES`.

## 6. Batch 52.3 — Traceability: what changed, and what may not

**Domain**
- `framework-change-classifier.ts`: `FRAMEWORK_CHANGE_KINDS` table maps each diff field to `STRUCTURE` (item added/
  removed/moved/renamed, rationale, assumptions) or `MEASUREMENT` (indicator added/archived/moved, baseline, target,
  targetSchedule, targetBreakdowns, MoV, dataSource, frequency, formula, semantics). `classifyFrameworkChange(diff) →
  { kinds: Set, structure: Change[], measurement: Change[] }`. A field the table does not name fails the exhaustiveness
  test (so a new snapshot field must be classified).
- `framework-change-rules.ts`: `POST_APPROVAL_RULES` (ordered table) and `checkPostApprovalChange(facts)`, facts =
  `{ approvedSnapshot: LogframeSnapshot | null; change: IndicatorDefinitionChange | ItemChange; reason?: string;
  usedInApprovedReport: boolean }`:
  1. No approved version → allowed.
  2. Field not in the approved snapshot's measurement set (e.g. a new indicator) → allowed.
  3. `target`/`baseline`/`targetSchedule` of an indicator **used in an approved report** → allowed only with a reason
     (≥ 10 chars); the reason becomes the version `summary` prefix "Target revised: …".
  4. `code` of an item or indicator named by an approved version → refused ("Codes in an approved framework do not
     change; archive and add a new one").
  5. Otherwise → allowed (the version records it).
  Returns `{ allowed: true, requiresNewVersion: boolean } | { allowed: false, reason }`.

**Application**
- Port `IFrameworkApprovalReader.latestApprovedSnapshot(projectId, tenantId)` (one method). Prisma adapter reads
  `LogframeVersion` where `approvedAt is not null`, latest by version.
- `UpdateIndicatorHandler`, `UpdateLogframeItemHandler`, `MoveLogframeItemHandler`, `ArchiveIndicatorHandler` call
  `checkPostApprovalChange` with facts from the reader and `IIndicatorApprovalGuard`. They hold no rule of their own.
  The `reason` travels as an optional body field; the API describes a refusal with the rule's sentence.
- `LogframeVersioner.capture` stores `kinds` (STRUCTURE/MEASUREMENT) in a new `LogframeVersion.changeKinds String
  @default("")` column (migration `20261116110000_framework_change_kinds`, additive; `/ready` requires it) and the
  `ListLogframeVersionsHandler` returns them. `GetLogframeChangesHandler` returns the classified diff.
- Approved periods are not touched by definition: findings are computed per period at generation and pinned by the
  submission snapshot. **A test proves it**: approve a report, revise a target with a reason, re-read the approved
  report's export — the old target stands; a new period's draft uses the new one.

**Web**: the history page shows a "Strategic" / "Measurement" chip per version, a filter by kind, and the reason;
the indicator edit form asks for the reason only when the server says `REASON_REQUIRED` (one round-trip, the typed
values are kept); the "Approve framework" button names what changed since the last approval, split by kind.

**Tests**: classifier exhaustiveness; each `POST_APPROVAL_RULES` row (one test per row, ordered); handler integration on
the scratch Postgres (`UOW_VERIFY_DATABASE_URL`): approve → edit without reason refused → with reason allowed → new
version with `changeKinds=MEASUREMENT` → approved report export unchanged.

## 7. Batch 52.4 — Everything that names a level reads the vocabulary; copy and languages

- Writer brief: `levelName` words for the section guidance (`buildSectionSpecificGuidance`) and the indicator table
  headings in `artifact_builder.py` receive the words as **data** in the request (`period.vocabulary`); the Python
  contract text is unchanged (mirror test still passes). Grounding is unaffected (words, not figures).
- Dashboards, Data Center, infographics, places rollups: level filters and headings through `levelName`.
- Support articles: `key-concepts.md` rewritten (Results Framework vs Logframe, two lenses, one data); `how-to-build-
  logframe.md` gains the lens switch, assumptions, rationale, vocabulary, post-approval reasons; new
  `how-to-trace-framework-changes.md`. Register in `FILE_MAP` + `wikiCategories.tsx`.
- i18n: new keys `framework.*` in the four catalogues (drafts; the preset names are proper nouns and stay).

## 8. Batch 52.5 — Wizard and sector library follow

- Start slide: choosing a donor whose preset exists offers (never sets) the vocabulary; the Results slide shows level
  words from it. `SETUP_REQUIREMENTS` gains `results.rationale` as a **soft** requirement (advice, not a blocker).
- The document reader (`PromptedAreaExtractor` for `results`) may extract `assumptions` and `rationale` with quotes under
  the existing grounding rules (`groundProposed`; a sentence without a quote is dropped). The prompt forbids inventing a
  rationale from indicators.
- Library: `withActivities` may carry `assumption` text per suggested result (optional, UNREVIEWED).

## 9. Deferred, with reasons

| Item | Why not now |
|---|---|
| Assumptions/rationale to the report writer | Planning text would be read by the contradiction lint and claim checker as claims. Needs a toggle, a record chunk kind (`record:logic:*`) and a writer-rule mirror test. Batch 52.6 if a donor asks for an "assumptions held" section. |
| Cross-contribution links | Breaks every tree-based rollup; written as rationale text instead (owner's decision). |
| A `CUSTOM` lens (person picks columns) | Needs a column picker UI and per-tenant storage; the two standard lenses cover the donors we know. |
| Per-item vocabulary overrides ("Sub-IR 1.1" vs "IR 1") | A code already carries it; the preset's plural/singular handles headings. |
| Risk entering the version snapshot | A risk has its own lifecycle and owner; linking it to a result (52.1) is enough. |

## 10. Order, deploy and verification

| Batch | Migration | `/ready` pairs | Scope |
|---|---|---|---|
| 52.0 vocabulary | `20261116090000_framework_vocabulary` | `ReportingProfile.vocabularyJson` | both |
| 52.1 columns + edit | `20261116100000_framework_logic` | `LogframeItem.rationale`, `ProjectRisk.logframeItemId` | both |
| 52.2 lenses + export | none | — | both |
| 52.3 traceability | `20261116110000_framework_change_kinds` | `LogframeVersion.changeKinds` | both |
| 52.4 vocabulary everywhere + copy | none | — | both (workers restart: `period.vocabulary` is new data) |
| 52.5 wizard + library | none | — | both |

- Ship 52.0 + 52.3 first (small, highest trust value), then 52.1 + 52.2, then 52.4 + 52.5. All migrations additive, applied
  before the code, after a fresh backup; no RLS change (no new table). `deploy-fast.sh` with `BUILD_ON=host SCOPE=both`.
- Gates per batch: `pnpm -r typecheck`; contracts → domain → application → infrastructure build then the targeted tests;
  `test/architecture-boundaries.test.mjs` (extended); `authorization-coverage`; `rls-coverage`; the web unit suite; the
  scratch-Postgres journey in 52.3. Before deploy: the full `pnpm test`.
- Browser check after 52.2 and 52.3 in the signed-in test tenant: switch lens, download both documents, edit a target
  after approval (refused, then allowed with reason), read the history chips, check the approved report's export is
  unchanged. Record the result here.

## 11. Acceptance (against the note that started this)

| Note's component | Delivered by |
|---|---|
| Results Framework Builder (impact, outcomes, outputs, causal relationships) | one backbone + `RESULTS` lens + `rationale` (52.1, 52.2) |
| Logframe Builder (structured, measurable matrix with assumptions) | `LOGFRAME` lens + `assumptions` + export (52.1, 52.2) |
| Indicator management | exists; post-approval rules added (52.3) |
| Activity planning | exists (`PlannedActivity.outputId`) |
| M&E dashboard, evidence, reporting | exist; level words follow the donor (52.4) |
| "Changes to an approved results framework traceable into the logframe, never silently overwriting history" | `changeKinds`, `POST_APPROVAL_RULES`, reason on a target change, approved-report invariance test (52.3) |
| "Accommodate donors who use either terminology" | `VOCABULARY_PRESETS` (52.0) |

## 12. Implementation status (2026-11-12)

Written in full but **not yet compiled or run** (the owner asked for all implementation first, then builds, tests and deploy). Expect
type errors to surface on the first `pnpm -r build`; fix forward, then run the targeted suites below, then the full ones.

| Batch | Built | Where |
|---|---|---|
| 52.0 vocabulary | yes | `framework-vocabulary.ts`; `ReportingProfile.vocabularyJson` (migration `20261116090000`); `SetFrameworkVocabularyHandler`; `PUT /v1/projects/:id/framework-vocabulary`; project layout `FrameworkVocabularyProvider` + `useLevelName`; profile page `FrameworkVocabularyForm`; `LOGFRAME_LEVEL_LABEL` deleted |
| 52.1 columns + edit | yes | `LogframeItem.assumptions/rationale` + `edit()`; snapshot fields only when set; `UpdateLogframeItemHandler`; `PATCH /v1/logframe-items/:id`; import columns; copy-setup; tree editor Edit + display; "Logic" on the new-item form; `ProjectRisk.logframeItemId` + picker on the risk form (migration `20261116100000`) |
| 52.2 lenses | yes | `framework-lenses.ts` (`FRAMEWORK_LENSES`, `renderFramework`, column `owner`); `GetFrameworkDocumentHandler`; `GET /v1/projects/:id/framework` and `/export` (Word, PDF); logframe page `?view=` switch + `FrameworkTable` |
| 52.3 traceability | yes | `framework-change-classifier.ts`, `framework-change-rules.ts`; `FrameworkApprovalReader`; `UpdateIndicatorHandler` guard (reason, code lock); `LogframeVersion.changeKinds` (migration `20261116110000`); history chips; sign-off button names pending changes; **export pin** (below) |
| 52.4 vocabulary everywhere | yes | exports, logframe/entry screens, library picker and rows (`useDonorLevelWord`), overview setup counts (donor word + count, never pluralised), canvas results-chain block (screen, print painter, Studio block via `levelWords` on the infographic data and `CanvasFacts`), writer (below), `framework.*` messages in four languages (drafts) |
| 52.5 wizard + library | yes | Start-step wording picker and `WordingStep`; Results slide shows the chosen words; `EDIT_NODE_LOGIC` + per-result logic fields on the slide; advisory requirement `results.reasoning` (new `ADVICE` status, never blocks); extraction reads assumptions/rationale only when the words are inside the item's quote, and a matrix "Assumptions" column on the result's own row; `LogframeSkeletonNode.assumption` filled for every suggested outcome and output |

### Deviations from the plan, with reasons
1. **Writer vocabulary is narrow, not wholesale.** The writer's prompts and tables never print level names, so nothing there is translated. What the donor's words *do* change is matching: a section named "Intermediate Result 2" now scopes to that outcome's indicators (`ContextProject.outcomeWord`, `ProjectGenerationContext.outcomeWord`, `_per_outcome_findings`), sent only when it differs from "Outcome". The prompt contract text is unchanged.
2. **Assumptions are never taken on the model's word.** The extractor keeps one only when its words appear inside the item's verbatim quote; the matrix reader takes the cell on the result's own row only (matrices disagree about the row below).
3. **Library assumptions are shipped as unreviewed starting text** (`data/assumptions.ts`, `withAssumptions`): one plain condition under every suggested outcome and output of all 34 sectors (pinned by `sector-assumptions.test.mjs`). They are general and written from recall, not checked against a source: a sector reviewer should confirm them, and a person keeps, edits or deletes each in the wizard.
4. **A donor-worded count is not pluralised** ("Intermediate Result: 4"), because plural rules differ by language.
5. **Export file uses a dash for a gap** (not "Not measured").
6. **`Move`/`Archive` handlers were not changed**: they already refuse an indicator an approved report used. Only `UpdateIndicatorHandler` needed the rule. Item edits after approval are allowed and recorded as STRUCTURE.
7. **Correction to the first audit:** the risk register already has an `ASSUMPTION` kind (project level); per-result assumptions complement it.

### Gap found while building, and what was done
`CreateExportHandler` read each indicator's *live* target, so re-exporting an approved report after a target change showed the new target. Fixed: for a draft that is APPROVED/EXPORTED/SUBMITTED with an `approvedAt`, the indicator table reads the framework version that was current at approval (`versionInForce`, `indicatorAsApproved`, new last constructor argument `frameworkVersions`). **This changes what an old approved report's re-export shows** (it now shows its approval-time targets). A framework with no version before approval falls back to live values. Decide whether this is what you want before deploy; the support article describes it.

### Tests written, not yet run
`domain`: `framework-vocabulary`, `framework-change`, `framework-logic`, `framework-lenses`. `application`: `profile-preferences` (new case), `framework-post-approval`, `update-logframe-item`, `export-approved-framework`. `infrastructure`: `framework-document-files`, `framework-repositories` (fake Prisma, no database). `web`: `framework-vocabulary-wiring`, `framework-lens-architecture`. Also `domain/test/framework-wizard.test.mjs` and a Python case in `apps/workers/tests/test_ai_reporter_quality.py` (donor-worded outcome section). Existing suites to add: workers `pytest tests/test_ai_reporter_quality.py`, `pcw-translations`, i18n key parity. Existing suites to re-run: `pcw` (launch step count and `SET_START`), `logframe-versioning`, `indicator-lifecycle`, `authorization-coverage`, `rls-coverage`, `architecture-boundaries`, `copy lint`, `pcw-translations`, `i18n`.

### Deploy checklist (when you decide)
Fresh backup; migrations `20261116090000_framework_vocabulary`, `20261116100000_framework_logic`, `20261116110000_framework_change_kinds` (all additive, before the code, no RLS change); `/ready` now also requires `ReportingProfile.vocabularyJson`, `LogframeVersion.changeKinds`, `LogframeItem.rationale`; ship api and web together (`SCOPE=both`); no env.
