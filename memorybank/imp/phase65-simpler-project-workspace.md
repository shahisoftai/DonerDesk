# Phase 65 — a simpler project workspace

**DonorDesk Version 4.01** · plan written 2026-11-23 · branch to create: `0026-simpler-project` · status: PLAN ONLY, nothing built; owner decisions recorded in §7 (2026-11-23).

Goal: a person opening a project knows at once **where they are in the project's life, what to do next, and where each job lives**, with fewer
pages, fewer doors to the same job and plain words, and **no feature lost**. Every change is table-driven like the rest of the app (SOLID, §5).

---

## 1. Audit (what makes the project confusing today)

Evidence is from the code on `0025-place-tree` at `d0e6a566`.

### 1.1 The navigation is organised by feature, not by job
- `PROJECT_TABS` (`apps/web/src/features/projects/domain/project-tabs.ts`) has **7 tabs and 24 sub-pages**; the project has **52 page routes**
  plus 3 redirect routes (`charts`, `maps`, `infographics`).
- **Data** holds 8 pages (Data Center, Enter data, Import, Forms, Datasets, Data tables, Charts, Maps). Charts and Maps are redirects into
  `/visuals/*`, so two of them leave the project; the Overview also links "Visuals for this project" and the Data Center has "Chart Studio"
  and "Map" buttons: **four doors to the same visuals**.
- **Overview** hides four unrelated pages under "More" (Management report, Changes of plan, People reached, Ask).
- **Settings** holds Project settings, Team and Setup, while the Overview has a fourth "Setup" section (`SetupSection.tsx`, "Definitions
  the report draws on") that links Logframe, Donor templates and a "Reporting profile" card which points at `/settings`, not at
  `/setup/profile` where the profile actually lives (verify in 65.3).
- Several names are internal jargon: *Data Center*, *Datasets*, *Data tables*, *Changes of plan*, *Compliance*, *Logframe & indicators*
  (page title) vs *Results framework* (tab label) for the same page.

### 1.2 A reporting period, the thing every figure hangs on, is hidden inside Reports
- Values are recorded against periods, but a period is created at `/reports/new` ("Create reporting period"), the Setup page says
  "Open reporting periods to enter indicator data" and links to **Reports**, and the Overview shows a "Set up your reporting period" card.
- A new user therefore has to "start a report" before they can enter their first number. This is the single most confusing step.

### 1.3 The Overview asks the person to decide instead of telling them
`app/(portal)/projects/[id]/page.tsx` stacks, before any panel: meta line + "Visuals for this project" link + status badges,
`LifecycleStrip`, period switcher, `NextStepStrip`, the "Set up your reporting period" card, `NeedsYouSection`, an "Arrange this page"
button, then up to **11 panels** (`OVERVIEW_SECTION_ORDER`). The project header in `layout.tsx` already shows status, code, donor, country,
sector, dates and cadence, plus `ProjectLifecycleBanner`. So: **two lifecycle indicators, three "what next" devices, the meta twice.**
`nextStep` only knows two rules (needs-you, no period).

### 1.4 Setup lives in five places
1. The wizard (`/projects/new/wizard`, PCW, 10 slides, 30 requirement codes).
2. A second, older wizard still reachable: `/projects/new/document` (`features/project-setup/presentation/SetupWizard.tsx`, Phase 36),
   linked from its own `UploadSlide`/`DoneSlide`. Two creation flows for one job.
3. `/projects/[id]/setup` — a readiness checklist "to unlock reporting periods".
4. `/projects/[id]/setup/profile` and `/projects/[id]/settings` (identity, dates, cadence, the work-planning switch).
5. The Overview's SETUP section.
Nothing tells a person, after launch, what the wizard left undone (`notWrittenAtLaunch` exists but is not shown on the project).

### 1.5 One job, many doors
- **Recording data:** Record sheet (6 kinds), Enter data (`/enter`), Entry Sheet and By place inside report inputs
  (`/reports/[periodId]/inputs`), Import (`/import`), Forms, Datasets, the field app, inline entry in Needs you. Each is justified; the
  person sees eight choices where they want one.
- **Activities:** `/activities` is two different things switched by `?view=` and `activitiesTabMode`: *Activity updates* (done work) and
  *Planned activities* (the work plan). The tab is called "Work plan" but opens "Activity updates" by default for some roles.

### 1.6 The wizard is long because every decision is asked before launch
`SETUP_SLIDES`: START → PROJECT_TEAM → RESULTS → INDICATORS → PLACES → WORK_PLAN → DATA_ENTRY → REPORTING → FINANCE → LAUNCH. LAUNCH
depends on all nine. Team, places, work plan, data entry, finance, risks and the dashboard are useful but **not needed to start**; they
could be finished on the live project. (Requirements are already a table with an `advice` status, so this is a data change, §4 65.8.)

### 1.7 Roles help only partly
`ROLE_PROJECT_TABS` hides tabs per role (Phase 59) and `ROLE_REACHABLE_PAGES` restricts the field officer (Phase 63). The other roles still
land on the same 11-panel Overview and the same tab order, whatever their job.

### 1.8 What other tools do (from the earlier report; sources there)
ActivityInfo starts from a template choice and then has few nouns (database, forms, partners, users). Monday.com and Hive put an activation
checklist with a progress bar on the home page, with explained dependencies. ZITADEL rebuilt its console home around next steps after
people "got stranded" there. Common pattern: **one home that tells you the next step, a short checklist that disappears when done, few
nouns, templates first.**

---

## 2. Principles for this phase

1. **Organise by the project's life, not by our modules**: Set up → Plan → Collect → Review → Report, with Finance as its own stage.
2. **One next step.** One card that answers "what should I do now", from ordered rules.
3. **One door per job**, with the other ways as modes behind that door, never removed.
4. **Ask only what is needed to start.** Everything else becomes a checklist item on the live project.
5. **Plain words**, one name per thing, used everywhere (tab, page title, breadcrumb, palette, support, tour).
6. **No feature lost** — enforced by a ledger test (§3), not by care.
7. **No URL breaks.** Old addresses keep working (moved pages redirect; the route-map test forbids linking to a redirect).

---

## 3. Feature-preservation ledger (enforced)

A table in `memorybank/imp/phase65-ledger.md`, one row per item, columns: *item · today's place · new place · how reached · status
(KEPT | MOVED | MERGED-INTO | REDIRECT)*. A new test `apps/web/tests/unit/project-ledger.test.mts` (same pattern as
`visual-parity.test.mts` and `route-map.test.mts`) fails when:
- a `page.tsx` or `route.ts` under `app/(portal)/projects/` has no row;
- a `PROJECT_TABS` page, an `OVERVIEW_SECTION_ORDER` panel, a `PROJECT_COMMANDS` entry, a `RECORD_KINDS` kind or a PCW `RequirementCode`
  has no row;
- a row marked MOVED / MERGED-INTO names a new place that is not reachable from the navigation table (or the palette, for rare tools);
- a link in `apps/web/src` points at a REDIRECT address.

Starting rows (to be completed in 65.0, every one of the 52 routes):

| Today | New place |
|---|---|
| Overview `""` | **Home** (journey page) |
| Overview › Management report, Ask | Report › More |
| Overview › Changes of plan | Plan › More |
| Overview › People reached | Collect |
| Plan › Results framework (`/logframe`, `/indicators/*`) | Plan › Results (same routes) |
| Plan › Work plan (`/activities?view=planned`, `/activities/plan/*`) | Plan › Work plan (`/activities/plan` new index; `?view=planned` redirects) |
| Plan › Where we work (`/places`) | Plan › Places |
| Reporting periods (inside `/reports`, `/reports/new`) | Plan › Reporting periods (`/periods`, new page reusing the period list; `/reports/new` kept for "new report") |
| Data › Enter data, Import, Forms, Datasets | Collect (behind the **Add data** page `/collect`) |
| `/activities` (activity updates), `/activities/new`, `/activities/import` | Collect › Activity updates |
| Evidence (`/evidence/*`) | Collect › Files and evidence |
| Data › Data Center (`/data`) | Review › Data Center |
| Data › Data tables, Charts, Maps; Reports › Infographics; Overview "Visuals" link | Report › Visuals (one entry opening `/visuals/assets?project=`; Charts/Maps/Data tables listed inside it) |
| Reports, Donor templates, Compliance | Report |
| Finance | **Finance** stage (own tab) |
| Settings, Team, Setup, Setup › profile | Gear menu "Project settings" (Settings, Team, Setup checklist, Reporting profile) |
| Overview panels (11) | Home: Needs you → Review page and Home card; PULSE, CALENDAR, REPORTING, DELIVERY, RESULTS, RISKS on Home by default per role; LOCATION, TEAM, CLOSEOUT, SETUP still available through "Customise" (Arrange editor kept) |
| `/projects/new/document` (old wizard) | REDIRECT → `/projects/new/wizard` after the parity check in 65.8 |

---

## 4. Batches

Each batch is shippable on its own, tested only for what changed (AGENTS "Fast verification loop"), web-only unless stated.

### 65.0 — Ledger, guard tests, baseline (no visible change)
- Write `phase65-ledger.md` (every route, tab page, panel, command, record kind, requirement code) and `project-ledger.test.mts`.
- Baseline: five-person task test (create a project, enter a first value, upload a photo, produce a report draft, find "who is late")
  — time and wrong turns recorded in `memorybank/imp/phase65-usability.md`. Same tasks are re-run after 65.9.
- Capture screenshots of today's project pages with the existing live harness for before/after.

### 65.1 — Navigation by stage (`PROJECT_STAGES`)
- New pure table `features/projects/domain/project-stages.ts` replacing `PROJECT_TABS`: `home | plan | collect | review | report` plus a
  `settings` group rendered as the gear menu. Same shape (`ProjectSubPage`: label key, path, also, onlyWhen, more, needs) plus an optional
  `query` match so `/activities` and `/activities/plan` are two pages. `locateProjectPage`, `subNavFor`, `projectCrumbs` keep their
  signatures (consumers unchanged).
- `ROLE_PROJECT_TABS` → `ROLE_PROJECT_STAGES` (exhaustive over `Role`), with a **landing stage per role**: Project manager → Home,
  M&E officer → Review, Grants officer → Finance, Compliance → Report, Viewer → Home; field officer unchanged (`ROLE_REACHABLE_PAGES` untouched).
- `PROJECT_COMMANDS` gains the stage words ("Go to Collect", …); every old label stays as a synonym so search still finds it.
- Ships directly (owner decision 5): `PROJECT_TABS` is replaced, not kept beside. Stages: `home | plan | collect | review | report |
  finance` + gear. Finance holds the finance register, budget and (moved from the plan item pages' links) expenses.
- Tests: `project-stages.test.mts` (every page in exactly one stage, every role a row, landing exists and is reachable), existing
  `phase59-project-rules` and `phase63-field-officer` updated, ledger test.

### 65.2 — Home: one journey card, fewer panels
- `features/projects/domain/journey.ts` (pure): `projectStage(facts)` → current stage + done/total per stage; `NEXT_STEP_RULES`, an
  ordered table replacing the two `if`s in `next-step.ts`:
  1. an urgent Needs-you item; 2. setup checklist incomplete (first open item); 3. no reporting period; 4. an open period with no values
  yet; 5. a report due within 14 days or overdue; 6. the next Needs-you item; 7. nothing (say "You are up to date").
  Each rule: `{ id, applies(facts, caps), step(facts) }`, only offered with the capability its action needs.
- `ProjectJourney` component replaces `LifecycleStrip`, `NextStepStrip`, the "Set up your reporting period" card and the duplicated meta
  line on the page. `ProjectLifecycleBanner` (draft/closed notices) stays in the layout.
- Default Home panels per role: `OVERVIEW_DEFAULT_PANELS` (new table) shows 4–6 panels; the rest remain available through the Arrange
  editor, renamed **Customise**, moved into a "⋯" menu. A saved arrangement still wins (no person loses their layout).
- Needs-you on Home shows the top 3 with "See all" → Review page (65.6).
- Tests: rule-order table test (one row per rule), `overview-layout` default test, harness check of Home for PM, M&E, viewer.

### 65.3 — One setup checklist
- Application read model `GetProjectSetupChecklistHandler` (API, additive `GET /v1/projects/:id/setup-checklist`, `project.view`):
  the union of `ISetupChecklistSource`s — readiness items (today's `/setup`), what the wizard left (`notWrittenAtLaunch` and the
  post-launch requirements from 65.8), team, reporting profile, first period, first form/dashboard. A source is a class in its own file
  implementing one port; a shared contract test (`test/support/setup-checklist-source-contract.mjs`) every source passes.
- `/setup` becomes the checklist page (progress "5 of 8", each item a verb, a link, why it waits); the Overview SETUP section becomes a
  compact progress card on Home while incomplete and disappears when done (or dismissed, using the existing acknowledgement).
- Fix the "Reporting profile" card target.
- Deploy: api + web (`SCOPE=both`), no migration.

### 65.4 — Plan stage: periods out of Reports, work plan on its own page
- `/projects/[id]/periods`: lists, creates and cancels periods using the existing period components and handlers (`CreateReportingPeriodHandler`,
  `period-lifecycle.ts`); the entry window editor moves here. `/reports/new` remains for starting a report on an existing period and
  offers "create a period" inline when none fits.
- `/projects/[id]/activities/plan` (index) renders `PlannedActivitiesView`; `/activities?view=planned` redirects there; links to
  `plan/start|new|import` stay plain anchors (interception rule). `activitiesTabMode` keeps deciding the "plan hidden" case.
- Every "Open reporting periods to enter data" link points at `/periods`.

### 65.5 — Collect stage: one "Add data" door
- `/projects/[id]/collect`: cards from a table `ADD_DATA_OPTIONS` (pure, like `IMPORT_OPTIONS`/`RECORD_KINDS`): *Type a number*,
  *By place*, *Fill a form*, *Record an activity*, *Upload photos or files*, *Bring in a spreadsheet*, *Connect a tool* — each with the
  capability it needs, a one-line "when to use this", and its existing destination. No new write path.
- Sub-pages: Activity updates, Forms, Files and evidence, People reached, Datasets (onlyWhen).
- The Record button opens the same options (it already reads `RECORD_KINDS`; `ADD_DATA_OPTIONS` references kinds, never copies them).

### 65.6 — Review stage
- `/projects/[id]/review`: the project's own queue (values to verify, files to verify, activities to accept, reports to approve,
  late values) from the existing `AssignmentQueue` sources filtered by project (API: add an optional `projectId` filter to the
  existing `me/assignments` read if absent — additive), grouped by kind, with the bulk actions that already exist ("Verify all",
  "Send back").
- Sub-pages: Data Center (`/data`), Changes of plan.

### 65.7 — Report stage and plain words
- Report: Reports, Donor templates, Donor rules (Compliance), Visuals (one entry), More: Management report, Data tables,
  Ask. The Data Center's "Chart Studio"/"Map" buttons and the Overview's "Visuals for this project" link go to that one entry.
- Renames, one table `PROJECT_WORDS` in the typed catalogue (en/fr/es/ar), used by stages, page titles, breadcrumbs, palette and copy:

  | Today | New |
  |---|---|
  | Overview | Home |
  | Data Center | Data Center (kept, owner decision) |
  | Data tables | Tables |
  | Datasets | Data files |
  | Changes of plan | Plan changes |
  | Compliance | Donor rules |
  | Logframe & indicators (page title) | the project's framework word (`useLevelName`), same as the tab |
  | Activity updates | Activities done |
  | Planned activities | Work plan |

  Final words are confirmed in the 65.0 usability session before this batch ships.

### 65.8 — Wizard: essentials first, the rest after launch; one wizard
- Requirement rows gain `when: "BEFORE_LAUNCH" | "AFTER_LAUNCH"` (`RequirementDef`, domain). `launch-gate.ts` checks only BEFORE_LAUNCH;
  AFTER_LAUNCH rows become `ISetupChecklistSource` items on the live project (65.3), evaluated against the project, not the draft.
  BEFORE_LAUNCH: `start.*`, `results.chain`, `results.codes`, `indicators.complete`, `reporting.cadence`. Everything else AFTER_LAUNCH
  — superseded by the decided split below.

  **Decided split (owner delegated, 2026-11-23).** Rule: before launch = what the first period's figures and the first report cannot be
  right without. After launch = what makes the project fuller, done when the person is ready, guided by the checklist.

  | Code | When | Why |
  |---|---|---|
  | `start.donor`, `start.country`, `start.sector` | BEFORE | identity, sector pack, wording |
  | `results.chain`, `results.codes`, `results.decided` | BEFORE | every figure hangs on a result |
  | `indicators.complete`, `indicators.decided`, `indicators.perOutput`, `indicators.placed` | BEFORE | nothing to record without them |
  | `indicators.direction` | BEFORE | a wrong direction makes the stoplight and reports say the opposite |
  | `reporting.cadence` | BEFORE | periods are created from it |
  | `results.reasoning` | AFTER (stays advice) | improves the framework, never blocks |
  | `indicators.owners` | AFTER | needs the team, which may join later |
  | `places.area`, `places.decided` | AFTER | maps and by-place entry; project-wide entry works without |
  | `plan.complete`, `plan.coverage`, `plan.decided`, `plan.indicatorFed`, `plan.indicators` | AFTER | work plan is managed on the live project |
  | `reporting.rules` | AFTER | the donor's rules are needed at the first report, not to record |
  | `finance.funding`, `finance.budget`, `finance.reconcile` | AFTER | Finance stage, own checklist group |
  | `launch.risks`, `launch.assumptions`, `launch.dashboard` | AFTER | already "not used" allowed |

  Slides: *Essentials* = Start, Results, Indicators, Reporting (cadence), Launch. *Can wait* = Team, Places, Work plan, Data entry,
  Finance, shown with "Finish later on the project" beside "Continue". The team slide stays offered first among them because owners and
  invitations come from it.

  **Nothing the documents found is lost by launching early.** Suggestions still undecided in an AFTER area are not written; the draft
  stays readable after launch and the checklist item says "Your documents suggested 12 planned activities — review them", opening the
  same review rows (accept → written through the existing apply handlers, which already resume per area).

  **Checklist guidance** (65.3): each item carries `why` (one sentence), `effort` ("about 5 minutes"), one action, an optional
  "see an example" link to a support article, and a group (Team, Places, Work plan, Reporting rules, Finance, Risks, Dashboard). Items are
  ordered by what the next report needs first (`reporting.rules` and `indicators.owners` rise when a report is within 30 days). Copy in
  the four languages.
- `SETUP_SLIDES` gains `essential: boolean`; the step rail shows *Essentials* (Start, Results and indicators, Reporting, Launch) and an
  *Optional before launch* group (Team, Places, Work plan, Data entry, Finance) that can be skipped; a skipped slide's answers are simply
  not written, its items appear on the checklist. Sign-off and the server-side re-check are unchanged.
- Retire the old document wizard: parity check of `SetupWizard` against PCW (documents, reading progress, per-area review,
  accept/reject, re-read a part, passage, left-out, recent proposals, organisation packs, setup-assist settings) recorded in the ledger;
  `/projects/new/document[/id]` redirect to the wizard; `OrganisationPacksPanel` and `SetupAssistSettingsCard` stay (Settings uses them).
  Old proposals stay readable through the wizard's draft list.
- Deploy: api + web; no migration (requirements are code).

### 65.9 — Finish: copy, help, tour, cleanup
- Four-language copy for every new string (drafts, flagged for native review as before).
- Support articles: update `memorybank/docs/support/ux-4000-map.md` → `ux-4010-map.md` and every article naming a moved page.
- Re-capture the public tour scenes whose route or hook moved (`public-tour-scenes.ts`; hooks keep their ids).
- Route map, AGENTS.md section, feature doc `memorybank/Features/74-Simpler-Project-Workspace-Phase-65.md`.
- Re-run the five-person test and record the difference.

---

## 5. How SOLID applies here (checked by tests, not trusted)

- **Single responsibility.** One file per job: `project-stages.ts` (where pages sit), `journey.ts` (which stage, which next step),
  `add-data-options.ts` (ways to add data), each checklist source its own class. Presentation files draw only (≤300 lines, ≤1 component),
  as already pinned for Record.
- **Open/closed.** Stages, pages, next-step rules, add-data options, checklist sources, requirement timing and default panels are rows.
  Adding one never edits a function. A new architecture test `project-journey-architecture.test.mts` fails on `=== "plan"`-style
  branching on a stage/rule/option name outside its table.
- **Liskov.** Every `ISetupChecklistSource` passes one shared contract test (same idea as `assignment-source-contract.mjs`); every
  `NEXT_STEP_RULES` row passes the same rule-shape test (pure, returns a reachable href, respects its capability).
- **Interface segregation.** Small ports: `ISetupChecklistSource { items(projectId, actor) }`, `JourneyFacts` (only the facts the rules
  read), `DrawerEditorPort`-style props for components; no component receives the whole overview read model.
- **Dependency inversion.** Domain tables are pure (no React, no fetch, no clock); application read models depend on ports; only
  composition files wire adapters; presentation never imports `@/lib/actions` directly (extend the Record architecture test to
  `features/projects/presentation/journey/`).

---

## 6. Verification per batch
- Unit: the new tables (exhaustive per `Role`, per rule, per option), the ledger and route-map tests.
- Browser: a new harness `test:project-journey` (Home for four roles, Add data, Review, Periods, the wizard essentials path) with
  server actions stubbed, as the other harnesses.
- Live: `apps/web/tests/live/field-officer-screens.mjs` must still pass unchanged (the field officer's world does not change).
- Database journey for 65.8: launch with only the essentials on a scratch Postgres; the project is ACTIVE and its checklist lists the
  skipped slides.

## 7. Owner decisions (2026-11-23) — these override anything above that disagrees
1. **Stages and renames approved, except "Data Center" keeps its name** (Review › Data Center).
2. **Requirement split decided by Claude** (table in 65.8): before launch only what a first report cannot do without; everything else after
   launch, **with a proper checklist and guidance** (each item: why it matters, how long it takes, one button, an example).
3. **Finance is its own stage.** Stages: **Home / Plan / Collect / Review / Report / Finance** (+ gear). Report no longer holds Money.
4. **Retire the old document wizard** (65.8), after the parity check.
5. **Ship directly, no feature switch**: every tenant and project is test data. 65.1 replaces `PROJECT_TABS` outright; the
   `NEXT_PUBLIC_PROJECT_NAV` step and its removal in 65.9 are dropped.

## 8. Not in this phase
The global sidebar (Home, Inbox, Projects, Visuals, Portfolio, Reports, Evidence, Compliance…) is unchanged except for labels that must
match the new words; the field app (`/field`) and the field officer's restricted pages are unchanged; no schema migration is planned.
