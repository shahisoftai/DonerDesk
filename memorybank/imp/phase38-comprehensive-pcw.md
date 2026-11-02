# Phase 38 — Comprehensive Project Creation Wizard (PCW): ten slides, fully set up before start

**DonorDesk Version 3.007** · plan written 2026-11-02 · status: **built and tested; the launch is proven end to end on a scratch Postgres and the wizard in a real browser; not deployed, not committed.** Current state, deviations and everything still pending are in **§0.1**; the per-batch log is in §11.

Builds on Phase 36 (`phase36-ai-project-setup-wizard.md`) and Phase 37 (`phase37-setup-wizard-v2.md`).
The existing extraction, grounding, proposal store, apply registry and appliers are kept and extended,
never forked.

## 0. Goal and the measure of done

One wizard, with or without documents, in ten slides. When the person presses **Launch**, the project is
completely set up: project and team, logframe, indicators (with targets, owners and collection method),
places, work plan (linked to logframe, places and indicators), data entry system (forms, connectors,
review mode, entry windows, evidence rules), reporting schedule (periods, templates, due dates,
approvers, reminders), finance (funding, budget lines, rates, approvers), risks, checklist and dashboard.

Decisions taken with the user (2026-11-02):

| # | Decision |
| --- | --- |
| D1 | **Everything is complete before start.** No "first month" tier: Launch is enabled only when every requirement is answered or marked "not used". |
| D2 | **Invitations**: the person chooses at Launch, per person, "invite now" or "invite later". |
| D3 | **One wizard** for projects with and without documents. |
| D4 | **Ten slides.** |
| D5 | Existing projects are test data only: no backfill path, no migration of running projects. |
| D6 | A **reason for "not used" is optional**. |
| D7 | ~~Second approver at Launch~~ **dropped 2026-11-02**: Launch needs one sign-off. |
| D8 | **Default packs are by sector only (plus the organisation's own copies), never by donor.** Donor requirements differ per project, so they come from that project's own documents and donor template; the Start slide asks the donor only to label the project. |
| D9 | **The Phase 36/37 review screens are removed** once 38.10 passes (no side-by-side release). |
| D10 | First built-in packs: generic, health, WASH, nutrition (agreed). |

"Done" is measured, not felt:

| Measure | Target |
| --- | --- |
| Requirements with no rule in `SETUP_REQUIREMENTS` | 0 (exhaustiveness test) |
| A project launched with an open requirement | impossible (server gate test) |
| Screens a person must visit after Launch to make the project usable | 0 (journey test: enter a value, file evidence, draft the first report, submit a form, book an expense — all without touching Setup) |
| Writes outside Launch | 0 (architecture test: no setup handler except `LaunchProject…` calls an applier) |
| Launch interrupted and resumed | finishes, nothing duplicated (journey test) |
| Clicks for a blank project (no documents), default pack accepted | ≤ 40 (harness counts) |

## 0.1 Implementation notes and pending items (consolidated 2026-11-02)

This section is the current truth. Where §1-§10 disagree with it, this wins (the body keeps the original design for the reasoning).

### A. Where the code is
| Layer | Location |
| --- | --- |
| Domain (pure) | `packages/domain/src/contexts/project-setup/pcw/`: `slides`, `draft`, `requirement` + `requirements/*` (25 rules), `operations`, `result-/place-/plan-/finance-/risk-operations`, `suggesters/{plan-links,collection-method,budget-links}`, `packs` + `packs-built-in`, `schedule`, `finance-summary`, `plan-coverage`, `launch-gate`, `launch-review` (summary + sign-off fingerprint), `launch-plan` (project from draft, entry windows, steps, cost kinds, budget lines, `notWrittenAtLaunch`), `responsibilities` |
| Contracts | `packages/contracts/src/project-setup-draft.ts` (five operation schemas, kind lists pinned to the domain by the architecture test) |
| Application | `use-cases/project-setup/`: `draft-view`, `start-blank`, `get-draft`, `edit-draft`, `apply-pack`, `change-proposal` (one generic handler, five instances), `sign-off`, `launch-project`, `launch-steps/*` (review mode, entry windows, forms, responsibilities, budget lines, dashboard, invitations, activation); `use-cases/identity/pending-member-resolver.ts`; `ports/project-setup-launch.ts` |
| Infrastructure | `project-setup/launch-steps.ts` (the only place that knows which handler backs which port), `built-in-pack-source.ts`; `PrismaPendingMemberRepository` and `updateExtras` in `repositories/project-setup.ts`; wiring in `container.ts` and `container/project-setup-module.ts` |
| API | `routes/project-setup-wizard.ts`: `POST /v1/project-setup/drafts`, `GET …/drafts/:id`, `POST …/drafts/:id/{operations,pack,results,places,plan,finance,risks,sign-off,launch}`; all `project.create`, all in `RULES` |
| Web | `app/(portal)/projects/new/wizard/page.tsx` (linked from "New project"); `features/project-setup/pcw/{copy,domain,presentation}`; `lib/actions/project-setup-draft.ts`; `lib/server/schemas-project-setup-draft.ts` |
| Data | migrations `20261103090000_project_setup_extras`, `20261103100000_project_pending_members`; `ProjectPendingMember` in `infra/postgres/rls.sql`; `/ready` pairs `ProjectSetupProposal.extrasJson`, `ProjectPendingMember.responsibilitiesJson` |
| Tests | domain `pcw*.test.mjs`; application `pcw-draft`, `pcw-launch`, `pcw-launch-parts`, `pcw-pending`; web `tests/unit/pcw-*.test.mts`; **browser** `pnpm --filter @donordesk/web test:pcw` (17 checks); **database** `packages/infrastructure/test/journey/project-setup-launch.test.mjs` and `project-setup-repositories.test.mjs` (opt-in `UOW_VERIFY_DATABASE_URL` / `SETUP_VERIFY_DATABASE_URL`); architecture `test/architecture-boundaries.test.mjs` |

### B. Decisions as finally taken (supersede the table in §0 where they differ)
- D7 (second approver at Launch) **dropped**: one sign-off. D8 packs by **sector only**. D5/D6 as written. **Only administrators create projects** (accepted as is).
- **No `SETTING_UP` status** (supersedes §3.5): a project is created as a draft, which the product already shows as "not started"; `ActivationStep` is the last launch step, so it is active only when every earlier step worked.
- **Pending people** (supersedes §4.4 and the migration table): a `ProjectPendingMember` table, not a nullable `ProjectMember.userId`; created at launch for everyone named without an account; resolved by `PendingMemberResolver` when they accept any invitation to that email.
- **The wizard does not ask for** a verifier, report or finance approvers, an evidence default or a checklist (the product has no place for them: approval and verification follow roles, confidentiality is per file, the checklist is generated). Steps 10, 29, 34, 36, 37, 39 of the 47 are `DEFERRED_STEPS` with reasons; step 11 (assumptions) is covered as a risk kind.
- **Forms are drafted at launch, not in the draft**; only unpublished drafts are made. The Zod mirror of operations was built with the first handler (38.1), not in 38.0.
- **Launch wraps the existing resumable apply** rather than replacing it; the wizard folds its decisions into the proposal it hands over (`proposalForLaunch`).

### C. What a launch writes today
Project, results, indicators, reporting periods, work plan (with the chosen places as location), places, funding, risks (all through the existing apply); review mode; an entry window on every period; a draft form per form-collected indicator; the team (people with accounts become members now), indicator owners and activity leads (now for people with accounts, on joining for the rest); budget lines on their activities; the starting dashboard (indicators matched by shared words; unmatched charts named as left out); invitations marked "when the project starts"; then the project is made active. **Not written, and said in the launch report**: budget lines that pay for the whole project, required files on planned activities, targets by group / formulas / donor mapping, and an owner or lead for a person with no email.

### D. Pending, by priority
**Before the first deploy (must):**
1. **Run the migrations and `rls.sql` on the real host and check `relrowsecurity` on `ProjectPendingMember`.** The scratch database ran as a superuser with no `donordesk_app` role, so row-level security for the new table was **not** exercised. Apply the table's statements per table if the single `DO` block stops early (see the Phase 31 note).
2. **Fix: blank drafts count toward the daily document cap.** `countStartedSince` counts every stored proposal, and a blank draft is one. Count only proposals that have a source (`sourceLength > 0`), or the cap will be eaten by people who never upload anything.
3. **Fix: `/projects/new/wizard` starts a new draft on every visit** (a refresh makes another). Resume the person's latest open draft, or ask. Drafts also need a way to be found again and to be discarded (30-day expiry exists; nothing lists or discards a wizard draft). Add "Continue a draft" to "New project".
4. **A signed-in browser check on the real stack** (the harness stubs storage and the final launch): the document path needs the AI service, Drive and a real model, none of which has been run; the model has never been seen on these documents through this path.
5. Re-run the architecture, authorization-coverage and the database journeys in CI (the DB journeys need a scratch database; CI already has one for the other journeys).

**Before the old screens can be removed (decision D9; held for the user):** the new wizard does not yet have these parts of the Phase 36/37 review, which are lost if the old screens go:
- the **"where in the document" viewer** for an item's quote (`PassageButton`; the quote is in the view but not shown);
- the **"left out" panel** (items dropped by grounding, counted and viewable; the Phase 37 rule "every drop is counted and viewable" must still hold);
- the **document list, document kind override and "read this part again"** (`DocumentsPanel`, rerun an area);
- **moving a result under another parent** (`ResultMover`); the new slide chooses a parent only when adding;
- the **Gantt view** of the plan (`PlanGantt`), the **do's and don'ts guidance**, and the **usage/cost line**.
Decide which are ported and which are dropped, then remove. The older "Set up from a project document" link on "New project" stays until then.

**Should do:**
6. **Four-language wording** for the new slides. `pcw/copy.ts` is one English object imported directly by every component; it needs a typed catalogue per language (as `features/project-setup/copy/` has) and a hook, and every slide changes. The translations are drafts without a native reviewer; Arabic also needs a right-to-left pass (the slides use some logical classes, but it has not been looked at).
7. **Start slide should use what the documents state.** Donor, country and sector read from documents sit in the proposal's facts, but the Start slide asks again and `start.donor/sector/country` check only the decisions; the Reporting slide shows the frequency a document stated in the calendar but leaves the frequency box empty. Pre-fill (as suggestions) from the facts and the document's periods.
8. **Support article** is a draft in `memorybank/docs/support/_unpublished-phase38/`; register it only after the signed-in check (the site stays honest until then).
9. **Accessibility pass** with a screen reader (the harness checks labels and focus, not announcements); the slide animation should respect reduced motion.
10. **Performance**: every action returns the whole re-derived view (requirements, suggestions, timeline, summary). Fine for a project of hundreds of rows; measure a document-heavy draft.

**Later / not built:**
11. Owners/leads for people with no email; report approvers, verifier and finance approver (no home in the product, by decision); the checklist; evidence default.
12. Required files on planned activities; budget lines that pay for the whole project; targets by group, formulas and donor indicator mapping (Logframe page after launch).
13. A donor's own report layout at setup (needs the project's folders; uploaded after the project starts).
14. Organisation-owned default packs (the port exists, `BuiltInPackSource` is the only source; `SetupDefaultPack` was in the plan and is not built); packs beyond generic, health, WASH, nutrition.
15. Another responsibility kind (report author, evidence reviewer) is a row in `RESPONSIBILITY_KINDS` plus one applier.
16. Milestones, dependencies, repeats and the Gantt in the wizard's work-plan slide (available on the Work plan page).

### E. How to verify after any change
`pnpm --filter @donordesk/web test:pcw` (Chromium, ~1 minute); domain/application/web targeted tests; `node --test test/architecture-boundaries.test.mjs`; and for anything that touches launch, the database journey: `initdb` a scratch cluster, short socket directory (`/tmp/claude-1000/pgs`), `prisma migrate deploy`, run the journey with `UOW_VERIFY_DATABASE_URL`, and grant `ENTERPRISE` in the scratch organisation (a starter plan has a seat limit). Do not trust fakes for launch behaviour: the real database found three bugs the fake-based tests could not (periods/plan/places not applied, an unrated risk dropped, budget lines not made).

### F. Lessons worth keeping
- A field must never be disabled while a save runs (browsers drop focus from a disabled field without a blur).
- Every requirement that allows "not used" needs a control on its slide, or the wizard cannot be finished.
- A value that looks saved but is not (an offered currency) must be a button, not a pre-filled box.
- The existing apply decides what runs from the items present (a period gates the plan and places); anything the wizard keeps outside the proposal must be folded in before it is handed over.
- Postgres aborts a test transaction after a unique violation: put the refused duplicate last.

## 1. The ten slides

Every slide has the same frame (`SlideFrame`): left = the slide's own requirement checklist, centre =
editor, right = **gap inbox** (every open requirement across all slides, click to jump). Slides can be
visited in any order; a slide shows "N to answer" until it is **Complete**. Every item carries its origin
badge: *From document* (with quote, Phase 37), *Suggested* (with reason), *Default* (from the pack),
*Yours* (typed or edited).

| # | Slide | Holds | Complete when |
| --- | --- | --- | --- |
| 1 | **Start** | documents (0–5) or "Start without documents"; donor, sector, country → default pack | donor, sector, country chosen |
| 2 | **Project and team** | identity (name, code, dates, time zone, currency, programme, grant, award no., partners, summary); team roster (name, email, role) — named, not invited | identity filled; a manager and an M&E lead on the roster |
| 3 | **Results framework** | logframe tree (goal → outcome → output → activity), codes, parents, assumptions | every outcome has an output, every output an activity; no unconfirmed generated code |
| 4 | **Indicators** | per indicator: type, unit, aggregation, direction, baseline, target + schedule (incremental/cumulative), frequency, disaggregation, targets by group, formula, donor mapping, owner | every output has an indicator; every indicator has confirmed type, direction, frequency, owner, target; baseline given or "no baseline" |
| 5 | **Places** | map + list: places from documents matched to the gazetteer, ambiguous choices, hand pins, project area, boundary level | every mentioned place confirmed or removed; project area set |
| 6 | **Work plan** | one grid: activity · logframe activity · dates · repeats · places · feeds indicators · lead · files needed · records participants; milestones, dependencies; coverage bar | every logframe activity has planned work; every planned activity has dates, place (or "project-wide"), lead, indicator links |
| 7 | **Data entry system** | per indicator "how collected": form / connector / manual / calculated; drafted forms; review mode (simple/full), verifier; entry-window rule; evidence (proof needed, confidentiality default + exceptions); participant registration | every indicator has a method; every form has an owner; review mode, verifier and window rule set |
| 8 | **Reporting schedule** | period timeline from cadence + dates (roll-ups and final added); per report type: template, due-date rule, author, reviewer, approver; donor template review; reminders | every period has a type, due date, approver; every report type has a template (or "built-in") |
| 9 | **Budget and finance** | funding sources and amounts; budget column on the slide-6 activity rows + category; support lines not tied to one activity; reporting currency + dated rates; disbursements; deliverables; expense approver, separate-approver toggle | funding entered; budget vs funding shown, any difference acknowledged; approvers set — or the whole slide "not used" (finance mode off) |
| 10 | **Review and launch** | risks (owner, review date), compliance checklist and attestations, dashboard from sector template (preview), summary of everything to be created, source comparison, invitations (now / later per person), sign-off, **Launch** | gap inbox empty; sign-off given (second approver if the organisation requires it) |

Dependency order (the inbox and the "next" button follow it; the person may still jump):

```
1 ─► 2 ─► 3 ─► 4 ─┬─► 6 ─► 9
          5 ──────┘    │
              4 + 6 ─► 7
              1 + 2 ─► 8
                all ─► 10
```

Coverage of the 47-step list (from the 2026-11-02 conversation): 1→13,43 · 2→1–4 · 3→7,9,11 · 4→8,10 ·
5→16–18 · 6→19–24,33 · 7→15,30–32,34,36,37 · 8→5,12–14,42 · 9→25–29 · 10→6,38–41,44–47. Pinned by a
test over `SETUP_REQUIREMENTS[*].coversStep`.

## 2. Architecture and SOLID

The wizard is a **draft project model** edited by pure operations, judged by a table of requirements,
and written once by a registry of appliers. Each SOLID principle has a concrete rule and a test that
enforces it.

### 2.1 Layers (unchanged boundaries)

| Layer | New / extended | Knows |
| --- | --- | --- |
| `packages/domain/src/contexts/project-setup/` | draft model, requirement table, link suggesters, default packs (types + pure rules), slide registry, launch plan | nothing outside the domain |
| `packages/application/src/use-cases/project-setup/` | edit/answer/launch handlers, appliers, ports | domain + ports |
| `packages/infrastructure/src/project-setup/` | default-pack store, launch run repository, existing extractors | application ports |
| `apps/api/src/routes/project-setup*.ts` | thin Zod routes | handlers |
| `apps/web/src/features/project-setup/` | `domain/` (pure view state per slide), `presentation/` (one component per slide), `copy/` (four languages) | API via server actions |

### 2.2 S — Single responsibility

One file, one job (≤ 300 lines, one exported class per file: the Phase 36 architecture test is extended
to the new folders).

- `setup-draft.ts` — the draft's shape only (types, `emptyDraft`).
- `draft-operations/<section>.ts` — pure edits of one section each (`team.ts`, `logframe.ts`,
  `indicators.ts`, `places.ts`, `plan.ts`, `collection.ts`, `schedule.ts`, `finance.ts`, `launch.ts`).
- `requirements/<slide>.ts` — the requirement rules of one slide each.
- `suggesters/<link>.ts` — one link suggester each.
- `packs/` — pack types and the pack resolver (`resolvePack`); pack *data* lives in infrastructure.
- `launch-plan.ts` — turns a complete draft into an ordered list of apply steps; never writes.
- One applier class per area (Phase 36 rule kept).
- Web: one slide component per slide, its pure view state in `features/project-setup/domain/slides/<slide>.ts`.

### 2.3 O — Open/closed

Adding a slide section, requirement, suggester, pack or apply area is **a new row or a new file, never an
edit of a switch**:

- `SETUP_SLIDES` (domain): `{ key, order, labelKey, requirementKeys, sections }`.
- `SETUP_REQUIREMENTS` (domain): `{ key, slide, severity: "BLOCKS_LAUNCH", allowsNotUsed, coversStep,
  check(draft) → RequirementResult }`.
- `LINK_SUGGESTERS`: `{ key, suggest(draft) → Suggestion[] }`.
- `SETUP_AREAS` (existing) gains the new areas; `createSetupAppliers` gains one applier each.
- Default packs are data (`DefaultPack` rows + built-ins), selected by `resolvePack(donor, sector,
  country)`; no `if (donor === "USAID")` anywhere.
- The Phase 36 grep test ("no setup code branches on an area name") is extended to slide keys, pack
  keys and requirement keys.

### 2.4 L — Liskov substitution

- Every applier implements `ISetupApplier` and passes one shared contract test
  (`test/support/setup-applier-contract.mjs`): idempotent on repeat (resumable launch), refuses nothing
  the requirement table accepted, reports created ids, never writes when `apply: false`.
- Every suggester passes `test/support/link-suggester-contract.mjs`: deterministic, every suggestion has
  a reason, never suggests a link that already exists or was rejected, never suggests across projects.
- Every requirement passes `requirement-contract`: pure, total (never throws on an empty draft),
  "not used" honoured when `allowsNotUsed`.
- The no-document path and the document path produce the same `SetupDraft` type; extraction is just one
  source of draft items (`DraftItemOrigin`), so every downstream function accepts either.

### 2.5 I — Interface segregation

Small ports, each consumer depends only on what it uses:

- `ISetupDraftReader` / `ISetupDraftWriter` (handlers that only read do not get write).
- `IDefaultPackSource` (read-only).
- `ISetupInvitationSender` (only the launch applier for the team uses it).
- `ILaunchRunStore` (launch progress only).
- `ISetupApplier` stays `{ area, apply(draft, ctx) }`; no applier receives the whole container.
- Web: each slide component receives its own section's view state and callbacks, never the whole draft.

### 2.6 D — Dependency inversion

- Handlers depend on ports; Prisma, Drive, mail and the model live behind them (wired in
  `container/project-setup-module.ts`).
- Appliers call the **existing use-case handlers by interface** (`CreateProjectHandler`,
  `ImportLogframeHandler`, `CreateIndicator…`, `ImportPlacesHandler`, `ImportWorkPlanHandler`,
  `SaveCollectionFormHandler`, `CreateAllPeriodsHandler`, `SetPeriodEntryWindowHandler`, finance register
  handlers, `CreateRiskHandler`, `SaveDashboardHandler`, invitation handler, …). No applier writes
  Prisma. No second writer for anything a handler already owns (Phase 36 invariant).
- Clock, id generator and current user are injected (pure domain receives `today`).

## 3. Domain model

### 3.1 `SetupDraft` (extends today's `ProjectSetupProposal.proposalJson`)

```ts
interface SetupDraft {
  version: 2;
  start: { donor?: string; sector?: SectorKey; country?: string; packId?: string; documents: SourceRef[] };
  project: FactsSection;            // existing facts + time zone, programme, grant, partners
  team: DraftPerson[];              // { key, name, email, role, external, invite: "NOW" | "LATER" }
  logframe: DraftNode[];            // existing
  indicators: DraftIndicator[];     // existing + ownerKey, direction, schedule, method (7)
  places: DraftPlace[];             // existing + confirmed, projectArea, boundaryLevel
  plan: DraftPlanItem[];            // existing + placeKeys, indicatorKeys, leadKey, files, recordsParticipants
  collection: CollectionSetup;      // reviewMode, verifierKey, windowRule, evidence, forms: DraftForm[], connectors
  schedule: ScheduleSetup;          // cadence, periods (derived, overridable), perReportType rules
  finance: FinanceSetup | NotUsed;  // funding, budgetLines (planKey | support), rates, disbursements, deliverables, approvers
  risks: DraftRisk[];
  checklist: DraftChecklistItem[];
  dashboard: { templateKey?: string } | NotUsed;
  answers: Record<RequirementKey, { notUsed: true; reason?: string }>;  // D6: reason optional
  signOff: { byUserId?: string; at?: string; secondByUserId?: string; secondAt?: string };
}
```

- People, places and plan items are referenced by **draft keys**, not database ids (nothing exists until
  Launch). The launch plan maps keys to ids as it goes.
- Every item keeps `origin` (`DOCUMENT | SUGGESTED | DEFAULT | USER`) and, for DOCUMENT, its quote
  (grounding rules of Phase 36/37 unchanged: an ungrounded document item is dropped and counted).
- `version: 1` proposals (Phase 36/37) are read through `upgradeDraft` (pure). D5 means no data
  migration beyond that.

### 3.2 Requirements and the gap inbox

- `evaluateRequirements(draft, today) → RequirementResult[]` (pure): `{ key, slide, status: OPEN | MET |
  NOT_USED, message: { code, params }, target: { slide, itemKey? } }`.
- `slideProgress(results, slide)` and `gapInbox(results)` are derived; never stored.
- `canLaunch(results, signOff, orgRules)`: every result MET or NOT_USED, plus sign-off (D7 via the existing
  `checkApprover`).
- Copy for each `message.code` lives in `copy/` (four languages, scanned by `findRawTokens`).
- Cross-slide effects are free: requirements read the whole draft, so deleting an output re-opens its
  indicators' and activities' requirements without any event plumbing.

### 3.3 Link suggesters (pure, table-tested)

| Suggester | Suggests | Reason given |
| --- | --- | --- |
| `planToLogframe` | planned activity → logframe activity | same code / title words / document row |
| `planToIndicator` | planned activity → indicators | indicator under the same output; shared words |
| `planToPlace` | planned activity → places | place named in the activity's row or quote |
| `planToLead` | planned activity → roster person | role from the pack (e.g. field officer for site work) or document name |
| `indicatorToOwner` | indicator → person | M&E lead by default; output lead when named |
| `indicatorToMethod` | indicator → collection method | formula → calculated; people counts at sites → form; others → manual |
| `budgetToPlan` | budget line → planned activity | same code / words; else support line |
| `periodTemplates` | report type → template | `pickDefaultTemplate` (existing, one rule) |

`acceptSuggestions(draft, ids)` and `rejectSuggestions` are draft operations; a rejected suggestion is
remembered and not offered again.

### 3.4 Default packs

- `DefaultPack`: cadence, report types + due-date rules, template keys, disaggregations per indicator
  kind, frequency per level, review mode, window rule, evidence defaults, confidentiality default,
  checklist items, standard risks, dashboard template key, team roles expected.
- Built-ins in code (`packs/built-in.ts`, generic + a few donor/sector pairs); organisation copies stored
  (`SetupDefaultPack`, RLS). `resolvePack` picks: organisation (sector) → built-in (sector) → generic.
- Applying a pack only fills empty fields (same rule as `applyNarrativeProposal`: fill, never overwrite).

### 3.5 Project lifecycle

> **Superseded (see §0.1 B):** no `SETTING_UP` status was built; the existing draft status is used and activation is the last launch step.

- `Project.status` (string, default `DRAFT`) gains **`SETTING_UP`**. A project the wizard is setting up
  does not exist as a database row until Launch; the status exists for the window between Launch's first
  step (project created) and its last (activated), so a half-launched project never shows up in
  reporting, reminders, My week, portfolio or the public API.
- `isOperationalProject` (domain, one rule) is used by every list that must hide it; tested across the
  assignment sources, reminders, portfolio, data sheet, dashboards and public API.
- The last launch step sets `ACTIVE` and opens the first period.

## 4. Application

### 4.1 Handlers

| Handler | Route | Permission |
| --- | --- | --- |
| `StartSetupHandler` (with or without documents; existing start-extraction becomes its document branch) | `POST /v1/project-setup` | `project.create` |
| `GetSetupHandler` (draft + requirement results + suggestions) | `GET /v1/project-setup/:id` | owner or `project.create` |
| `EditSetupHandler` (one typed operation per call, `expectedVersion`) | `PATCH /v1/project-setup/:id` | same |
| `AnswerRequirementHandler` (not used / reopen) | `POST …/:id/answers` | same |
| `AcceptSuggestionsHandler` / `RejectSuggestionsHandler` | `POST …/:id/suggestions` | same |
| `ApplyPackHandler` | `POST …/:id/pack` | same |
| `SignOffSetupHandler` | `POST …/:id/sign-off` | manager on roster or `project.create`; second approver per D7 |
| `LaunchProjectHandler` (resumable) | `POST …/:id/launch` | `project.create` |
| `GetLaunchProgressHandler` | `GET …/:id/launch` | same |
| `SaveDefaultPackHandler` / list / delete | `/v1/setup-packs*` | `org.manage` |

All routes go in `RULES` (authorization coverage test) and none on `EXTERNAL_ALLOWED`.

### 4.2 Edit operations

`EditSetupHandler` takes a discriminated union `SetupOperation` (Zod in contracts), dispatched through
`DRAFT_OPERATIONS` (a table: operation kind → pure function). A new operation is a new row and a new
schema member. Each operation returns `Result<SetupDraft, DomainError>`; the handler saves, re-evaluates
requirements and returns both (version = stored `updatedAt`, Phase 36 rule).

### 4.3 Launch

- `buildLaunchPlan(draft) → LaunchStep[]` (pure): ordered steps by `SETUP_AREAS.applyOrder`:
  1 project (status SETTING_UP) · 2 team (members; pending people for "later") · 3 places · 4 logframe ·
  5 indicators (+ owners, schedules, formulas, donor mappings) · 6 reporting profile + periods + entry
  windows + templates + approvers · 7 work plan (+ place, indicator, lead links) · 8 collection
  (forms published, connectors, review mode, evidence rules) · 9 finance · 10 risks · 11 checklist ·
  12 dashboard + Home pin · 13 invitations (NOW only) · 14 activate (ACTIVE, first period open,
  notifications).
- `LaunchProjectHandler` re-checks `canLaunch` **on the server** (never trusts the client), then runs the
  steps through `ISetupApplier`s, recording each in `ProjectSetupRun` (existing table) with the key → id
  map, so a re-run skips finished steps and resumes the failed one. First failure stops (PARTIAL); the
  draft stays editable only for the not-yet-applied areas.
- Each applier delegates to the existing handler (D in SOLID); new appliers needed:
  `TeamApplier`, `CollectionApplier`, `ScheduleApplier` (extends `PeriodsApplier`), `ChecklistApplier`,
  `DashboardApplier`, `InvitationApplier`, `ActivationApplier`. Existing ones extended:
  `FactsApplier`, `IndicatorsApplier`, `PlacesApplier`, `PlanApplier`, `FundingBudgetApplier` (now
  creates budget lines on plan items), `RisksApplier`.

### 4.4 Pending people (invite later)

> **Superseded (see §0.1 B):** built as a `ProjectPendingMember` table and a resolver on invitation acceptance, not as a nullable `ProjectMember.userId`.

- A roster person with "later" becomes a **pending project member**: `ProjectMember` gains
  `pendingEmail`/`pendingName` with `userId` nullable and status `PENDING` (migration). Indicator owners,
  activity leads and approvers may point at a pending member.
- Inviting later uses the existing invitation flow from the project's People page; on accept,
  `PendingMemberResolver` binds the user and every reference moves with the member id (references hold the
  member id, not the user id, so nothing is rewritten).
- Assignment sources skip pending members; the manager sees "N people not invited yet" on the Overview
  (one new `needsYouItems` row).

## 5. Web

- `SetupWizard` becomes the ten-slide shell driven by `SETUP_SLIDES` (web mirrors keys only; order and
  requirements come from the API response).
- Slide components: `StartSlide`, `ProjectTeamSlide`, `ResultsSlide` (existing logframe matrix),
  `IndicatorsSlide`, `PlacesSlide` (lazy `SiteMapFigure`), `WorkPlanSlide` (grid + `PlanGantt`),
  `DataEntrySlide`, `ReportingSlide`, `FinanceSlide`, `LaunchSlide`.
- Shared: `GapInbox`, `OriginBadge`, `SuggestionBar` ("Accept all suggested (n)"), `NotUsedToggle`
  (reason optional), `CoverageBar`, `BulkActionMenu`.
- Tables use the entry-sheet engine's keyboard and paste rules where a slide is a grid (plan, indicators,
  budget) — reuse `entry-sheet.ts` patterns, do not copy them.
- Autosave each operation; offline edits are not supported (setup is online), and a failed save says why.
- Copy in `copy/{en,fr,es,ar}.ts` typed against `types.ts`; logical CSS for RTL.
- Server Components pass only ids/strings/booleans to client components (boundary test).
- Browser harness `pnpm --filter @donordesk/web test:pcw`: blank project end to end with the default pack;
  document project with the AMAN corpus stubbed; not-used finance; invite later; resume after a failed
  launch; Arabic layout.

## 6. Data and migrations

| Migration | Change |
| --- | --- |
| `20261103090000_project_setup_extras` (built in 38.1) | `ProjectSetupProposal.extrasJson` (the wizard's decisions) |
| `20261103095000_pcw_pending_members` (moved from 38.2 to 38.9, where the team is first written) | `ProjectMember.userId` nullable, `pendingEmail`, `pendingName`; unique on (`tenantId`,`projectId`,`userId`) kept, plus unique on pending email per project |
| `20261103100000_setup_default_packs` | `SetupDefaultPack` (tenantId, key, sector, json, updatedAt); RLS forced |
| `20261103110000_project_setup_launch` | `ProjectSetupRun.keyMapJson` (the extras column already exists from 38.1) |

- `/ready` adds `ProjectMember.pendingEmail`, `SetupDefaultPack.json`, `ProjectSetupRun.keyMapJson`.
- `rls-coverage.test.mjs` fails until `SetupDefaultPack` is in `rls.sql`.
- Organisation export lists `SetupDefaultPack` (test-enforced).
- Never `prisma format`; edit `schema.prisma` by hand.

## 7. Batches

> All batches are built (38.9 was split into 38.9a-f, 38.10 into 38.10a-b); the per-batch log is in §11 and what is left is in §0.1 D.

Each batch ends green on `pnpm -r typecheck`, the package tests (build from repo root first), the web unit
suite and the architecture tests.

| Batch | Content | Tests |
| --- | --- | --- |
| **38.0 Foundations** | `SetupDraft` v2 + `upgradeDraft`; `SETUP_SLIDES`; `SETUP_REQUIREMENTS` skeleton with exhaustiveness + `coversStep` test; requirement contract; `evaluateRequirements`, `gapInbox`, `canLaunch`; `DRAFT_OPERATIONS` table + Zod union; architecture test extensions (SRP size, no key branching, no writes outside launch) | domain table tests; contract tests |
| **38.1 Packs and Start** | `DefaultPack`, built-ins, `resolvePack`, fill-only `applyPack`; migration packs; `StartSetupHandler` (with/without documents); `StartSlide` | pack table tests; no-document start journey |
| **38.2 Project and team** | team operations, roster requirements, pending members migration + `PendingMemberResolver`, `TeamApplier`; `ProjectTeamSlide` | resolver integration test (DB); applier contract |
| **38.3 Results and indicators** | logframe + indicator requirements, `indicatorToOwner`, bulk operations (frequency by level, disaggregation by kind), schedules, formulas, donor mapping in draft; extend appliers; `ResultsSlide`, `IndicatorsSlide` | suggester contract; requirement tables |
| **38.4 Places** | place confirmation operations and requirements, project area, boundary level; `PlacesSlide` | requirement tables; harness map |
| **38.5 Work plan and links** | `planToLogframe`, `planToIndicator`, `planToPlace`, `planToLead`; coverage rules; plan applier writes links; `WorkPlanSlide` with grid + Gantt | suggester tables (AMAN corpus rows); coverage tests |
| **38.6 Data entry system** | `indicatorToMethod`; `CollectionSetup`; drafted forms via `formFromIndicator`; connector draft; review mode, verifier, window rule, evidence rules; `CollectionApplier`; `DataEntrySlide` | applier contract; form publish journey |
| **38.7 Reporting schedule** | period derivation from cadence + dates (existing `CreateAllPeriodsHandler` rules), per-type templates (`pickDefaultTemplate`), due-date rules, approvers, reminders; `ScheduleApplier`; `ReportingSlide` | period table tests; first-report journey |
| **38.8 Finance** | funding, budget on plan rows, support lines, rates, disbursements, deliverables, approvers; `budgetToPlan`; reconcile requirement; "not used"; `FundingBudgetApplier` creates budget lines; `FinanceSlide` | reconcile tests; expense journey |
| **38.9 Launch** | risks/checklist/dashboard operations; `SETTING_UP` + `isOperationalProject` everywhere; sign-off (D7); `buildLaunchPlan`; `LaunchProjectHandler` resumable; `InvitationApplier`, `ActivationApplier`, `DashboardApplier`, `ChecklistApplier`; `LaunchSlide` with summary and source comparison; migration launch | launch journey (blank + documents), resume journey, hidden-while-setting-up tests, second-approver tests |
| **38.10 Polish and proof** | four-language copy, RTL check, `test:pcw` harness, click count, setup:eval rerun on AMAN corpus, support article draft, AGENTS.md invariants, memory bank feature spec | harness; eval table |

Ship order: 38.0–38.2 can deploy behind the existing `setupAssistEnabled` switch only when 38.9 is also
built; until then the old wizard stays the live one (`PCW_V2` web flag, default off). Deploy once, after
38.10.

## 8. Tests that hold the design

- `setup-requirements.test.mjs` — every requirement: empty draft OPEN, filled draft MET, not-used
  honoured; every slide has ≥ 1 requirement; every one of the 47 steps covered.
- `setup-applier-contract.mjs` — every applier: idempotent, resumable, no write on preview.
- `link-suggester-contract.mjs` — every suggester: deterministic, reasoned, no repeats of rejected.
- `architecture-boundaries.test.mjs` — no area/slide/pack key branching; ≤ 300 lines and one class per file
  in setup folders; only `LaunchProjectHandler` reaches appliers; web `features/project-setup/domain` pure.
- `launch-journey` (DB) — blank project with default pack → launch → enter a value, file evidence, submit a
  form, book an expense, draft the first report, with no Setup screen visited.
- `launch-resume` (DB) — fail step 8, re-run, nothing duplicated.
- `operational-visibility` — a `SETTING_UP` project is absent from every list in §3.5.
- `authorization-coverage` and `rls-coverage` — existing, extended by the new routes and table.

## 9. Invariants to add to AGENTS.md when built

- The PCW is complete or not launched: `canLaunch` is the one gate, checked on the server.
- Requirements, slides, suggesters, packs and operations are tables; a new one is a row.
- The draft references people, places and plan items by draft key; ids exist only after Launch.
- Only Launch writes, only through existing handlers, one applier per area, resumable.
- A pack fills, never overwrites; a suggestion carries a reason; a rejected suggestion is not offered again.
- A `SETTING_UP` project is never operational (`isOperationalProject`).
- Pending members can own work; references hold the member id.
- "Not used" reasons are optional; Launch needs a second approver only when the organisation requires it.

## 10. Open items

Superseded by **§0.1 D (pending, by priority)**. The two questions this section used to hold were answered: steps 10 and 34 stay after launch, step 11 is covered as a risk kind; and the blank path needs no AI service while the document path needs the AI service, Drive and a configured model.

## 11. Status

### 38.0 Foundations — built and tested (2026-11-02)
- `packages/domain/src/contexts/project-setup/pcw/`: `slides.ts` (`SETUP_SLIDES`, ten rows), `draft.ts` (`SetupDraft` = unchanged `proposal` + `extras`; `planKeyOf`, `budgetKeyOf`, `emptyDraft`, `upgradeProposal`), `requirement.ts` (engine: `evaluateRequirements`, `gapInbox`, `slideProgress`), `requirements/*` (25 requirement rows over five files), `launch-gate.ts` (`canLaunch`, second approver via the existing `checkApprover`), `operations.ts` (`DRAFT_OPERATIONS`, typed so a kind without a handler does not compile).
- `packages/domain/test/pcw.test.mjs`: 26 tests (slide order, unique keys, all 47 steps accounted for, totality on an empty draft, cross-slide re-opening, finance switch, launch gate, operations).
- Deviation from §7: the Zod mirror of `SetupOperation` moves to 38.1 with the first handler that uses it (a schema nobody calls would be untested).
- Design note: the wizard's own decisions live in `extras`, beside the unchanged proposal, so Phase 36/37 grounding, appliers and tests are untouched.

### 38.1 Packs and Start — built and tested (2026-11-02)
- **Domain** (`pcw/packs.ts`, `packs-built-in.ts`): `DefaultPack`, `resolvePack(packs, sector)` (organisation's own, then built-in, then generic; sector only), `applyPack` (fill-only, reports what it filled; suggested risks arrive undecided; no pack holds people). Built-ins: generic, health, WASH, nutrition (dashboard ids pinned to `SECTOR_TEMPLATES`; a test fails if a pack names a donor). `REQUIREMENT_CODES` is now a typed list, so each gap sentence is checked at compile time in the web catalogue.
- **Application**: `StartBlankSetupHandler` (no AI, no Drive; a READY draft with no source), `GetSetupDraftHandler`, `EditSetupDraftHandler` (writes only the decisions, retries a lost race up to 3 times, audit records the operation kind only), `ApplyDefaultPackHandler`, `IDefaultPackSource`. `ISetupProposalRepository.updateExtras` writes only `extrasJson`, and `update` never does, so a running extraction cannot undo an edit (and vice versa).
- **Persistence/API**: migration `20261103090000_project_setup_extras` (additive, before the code); `/ready` requires `ProjectSetupProposal.extrasJson`; routes `POST /v1/project-setup/drafts`, `GET …/drafts/:id`, `POST …/drafts/:id/operations`, `POST …/drafts/:id/pack` (all `project.create`, in `RULES`). Zod mirror `SetupOperationSchema` in `packages/contracts/src/project-setup-draft.ts`, its kind list pinned to the domain by the architecture test. Discarding a draft with no source no longer tries to delete a file.
- **Web**: route `/projects/new/wizard` (not linked from anywhere yet; the old wizard stays the default), `PcwShell` (rail of ten slides with progress in words, gap inbox, shared `SlideFrame`), `StartSlide` (donor, sector, country, starting answers), actions in `lib/actions/project-setup-draft.ts`, pure `pcw-view.ts`, English copy only (`pcw/copy.ts`); slides 2-10 show their open gaps until their batch builds them. Four-language copy stays in 38.10.
- **Found while building**: only `ADMIN` holds `project.create` today (a project manager cannot start a project); and **assumptions already exist as a risk kind (`ASSUMPTION`)**, so deferred step 11 can be covered in 38.9 by a risks requirement without a new draft field.
- **Decided 2026-11-02**: only administrators create projects (unchanged); no second approver at Launch (rule and tests removed); assumptions will be a risk kind (38.9).

### 38.2 Project and team — built and tested (2026-11-02)
- **Slide** (`ProjectTeamSlide`): name, code, start, end, currency and summary (stored through the proposal's own EDIT, so a document's reading and a typed value are the same kind of item), and the team roster (name, optional email, role, outside-partner flag, invite when the project starts / later). The view now carries `facts`.
- **Deviation**: the pending-members migration and `PendingMemberResolver` move to 38.9. In 38.2 the roster lives only in the draft (people are named, never written), so the nullable-`userId` change to `ProjectMember` would be unused until `TeamApplier` exists.
- **Decided**: only administrators create projects; no second approver at Launch (`canLaunch(results, signOff)`); assumptions will be a risk kind.
- **Tests run**: only the new and affected files (`pcw-team-view.test.mts`, `pcw-draft.test.mjs`, `pcw*.test.mjs`, architecture guards), per the user's request to stop running full suites each batch.

### 38.3 Results and indicators — built and tested (2026-11-02)
- **Domain** (`pcw/result-operations.ts`): `RESULT_OPERATIONS` (ADD_NODE, ADD_INDICATOR, EDIT_INDICATOR, EDIT_NODE_TITLE, BULK_INDICATORS), pure and typed so a kind without a handler does not compile. A person's node/indicator is EDITED with no quote; parents are checked (an output needs an outcome, an activity an output, one goal); codes are made for anything without one; BULK fills only empty frequency/breakdown, optionally for one level. `IndicatorSetup.direction` added (choosing a direction confirms it).
- **Application**: `ChangeSetupResultsHandler` (saves the proposal with the version the person saw, audit = kind only); the draft view now lists `logframe` and `indicators` items with `path`, `status`, `origin` (DOCUMENT / SUGGESTED / USER) and quote.
- **API/contracts**: `POST /v1/project-setup/drafts/:id/results` (`project.create`, in `RULES`); `SetupResultOperationSchema` + kind list pinned to the domain by the architecture test.
- **Web**: `ResultsSlide` (indented tree, accept/remove, add with parent choice, "keep the codes made up for you") and `IndicatorsSlide` (a card per indicator: result, kind, unit, baseline or "no starting value", target, frequency, breakdown, owner from the team, which way is better; add one; fill-all-empty bulk action). Pure `results-view.ts`; `OriginBadge` shows the origin in words.
- **Not in 38.3**: target schedules, targets by group, formulas and donor mapping (stay on the Logframe page after Launch; the draft holds no place for them yet), the "unreviewed meaning" confirmation beyond direction.
- **Tests run (targeted)**: `pcw-results.test.mjs` (8), `pcw-draft.test.mjs` (11), web `pcw-results-view` + `pcw-view` + `pcw-team-view` (21), architecture guards (8), use-server-exports / server-client-boundary (2), authorization-coverage (2); api, infrastructure and web typechecks clean (use `--incremental false`; a stale cache gave a false error).

### 38.4 Places — built and tested (2026-11-02)
- **Domain** (`pcw/place-operations.ts`): `PLACE_OPERATIONS` (ADD_PLACE, EDIT_PLACE). A parent must be on the list, wider than the place and not itself (matched with `normalizeLocationKey`, so "Gulu" is "Gulu District"); the same name under the same parent is one place; the kind is chosen by the person, never guessed; renaming drops a pin that described the old name. New `SET_PLACES_SETUP` decision (project area, boundary level).
- **Refactor**: `ChangeSetupResultsHandler` became the generic `ChangeSetupProposalHandler<Op>` (the slide's pure change is passed in), instantiated for results and for places; a third kind of proposal edit is one more instance.
- **API/contracts**: `POST /v1/project-setup/drafts/:id/places` (`project.create`, in `RULES`); `SetupPlaceOperationSchema` and `SETUP_PLACE_OPERATION_KINDS` pinned to the domain by the architecture test.
- **Web**: `PlacesSlide` (list with kind and parent per place, confirm/remove, add with suggestions from the bundled place list loaded only when typing, project area and boundary level) and a reusable `NotUsedToggle` (optional reason) for any requirement that may be left out. The view lists `places`.
- **Not in 38.4**: the map (a pin is not drawn or placed here; places stay as names with a kind and parent; maps come with Data Center/Places pages after Launch), boundary preview. Resolution against the real places list happens at Launch (`ImportPlacesHandler`), never as a guess now.
- **Tests run (targeted)**: `pcw-places.test.mjs` (8), `pcw.test.mjs` (27), `pcw-draft.test.mjs` (12), web `pcw-*` views (29 with use-server-exports), architecture guards (9), typechecks clean.

### 38.5 Work plan and links — built and tested (2026-11-02)
- **Domain**: `pcw/plan-operations.ts` (`PLAN_OPERATIONS`: ADD_PLAN, EDIT_PLAN; dates are plain days, the end never before the start, a row sits under one of the project's activities). **A planned activity now has a stable `key`** (`PlannedActivityDef.key`, in `NON_FIGURE_FIELDS`, preferred by `planKeyOf`): the first edit of a row gives it the key it already had, so the places, indicators and lead chosen for it survive a new title or date. `pcw/suggesters/plan-links.ts` (`SETUP_LINK_SUGGESTERS`: indicators of the activity's output, places the activity's own words name as whole words, the lead the work plan names or the only field officer) and `suggestSetupLinks`; `ACCEPT_SUGGESTIONS` (recomputes server-side and refuses an id no longer offered); `planCoverage` shares its predicates with the requirements (`uncoveredActivities`, `incompletePlans`, `unfedIndicators`) so the bar and the inbox cannot disagree.
- **Suggester contract** (a test runs it over every suggester): deterministic, a plain-language reason on each, only about rows of this draft, never repeats a link that exists or was rejected, never changes the draft.
- **API/contracts**: `POST /v1/project-setup/drafts/:id/plan` (third instance of the generic `ChangeSetupProposalHandler`); `SetupPlanOperationSchema`, `ACCEPT_SUGGESTIONS` added to the decisions schema; kind lists pinned to the domain.
- **Web**: `WorkPlanSlide` (coverage bars in words, suggestions with reasons and accept selected / accept all / not this one, a card per activity: part of, dates, lead, places with project-wide, indicators, files needed, records participants; add an activity) and pure `plan-view.ts`.
- **Name clash worth remembering**: `workplan` already exports `suggestPlanLinks` / `PlanLinkSuggestion`; the wizard's are `suggestSetupLinks` / `SetupLinkSuggestion`.
- **Not in 38.5**: milestones and dependencies ("comes after"), repeats, a Gantt view (the old wizard's `PlanGantt` is not reused yet); these remain available on the Work plan page after Launch.
- **Tests run (targeted)**: `pcw-plan.test.mjs` (13 incl. the suggester contract), `pcw.test.mjs` (27), `pcw-draft.test.mjs` (13), web `pcw-plan-view` + `pcw-view` + use-server-exports (16), architecture guards (10), API authorization coverage (2); all package typechecks clean.

### 38.6 Data entry system — built and tested (2026-11-02)
- **Domain**: `suggesters/collection-method.ts` (`suggestMethods`: a form when a feeding activity records who took part, typed in otherwise, each with a plain reason; calculated and connector are never suggested because the draft cannot know of a formula or an outside tool); `ACCEPT_METHOD_SUGGESTIONS` (stale or repeated ids refused); the evidence default is validated against the real confidentiality levels.
- **Application/contracts**: the view carries `methodSuggestions`; the new decision op is in the schema and its kind list (pinned).
- **Web**: `DataEntrySlide` — a collection method per indicator with its suggestion (use / not this one / use all), review mode and verifier, the entry window (whole days 0-365; half an answer saves nothing), evidence default with `NotUsedToggle`, and counts: forms to be drafted at launch, activities that record participants. Pure `entry-view.ts`.
- **Deviation**: forms are **not** drafted in the wizard. The draft holds no form objects; Launch (38.9) calls `CreateFormFromIndicatorHandler` for each indicator whose method is FORM and reports any that cannot be drafted (that handler refuses a calculated indicator or one whose aggregation is not SUM, which the draft cannot know). Connector set-up (KoboToolbox/SurveyCTO field mapping) also stays on the Connectors page after Launch; choosing it here only records the intent.
- **Tests run (targeted)**: `pcw-collection.test.mjs` (6) with `pcw.test.mjs` (27), `pcw-draft.test.mjs` (13), web `pcw-entry-view` + `pcw-view` + use-server-exports (13), architecture (10); typechecks clean.

### 38.7 Reporting schedule — built and tested (2026-11-02)
- **Domain**: `pcw/schedule.ts` — `scheduleTimeline(draft)` is built on the existing `planCadencePeriods` / `suggestDeadline`, so the calendar shown is the one Launch's `CreateAllPeriodsHandler` creates (quarterly blocks, the last one the final report); a due date comes from the report type's rule; with no dates, no cadence or a roll-up cadence the calendar is empty and says why. `cadenceOf` takes the person's choice, else the cadence a document stated. `SET_SCHEDULE` now checks the cadence, that report types exist and are listed once, due days 0-365, and that author/reviewer/approver are on the team.
- **Application**: the view carries `timeline`.
- **Web**: `ReportingSlide` — cadence, reminders, a card per kind of report (layout, due days, approver, author, reviewer; what is still missing in words), add a kind of report, one approver for all, and the calendar (first 12 periods and a count of the rest). Pure `schedule-view.ts`.
- **Deviations**: (1) the only layout offered is the standard one; a donor's own report layout is uploaded after the project starts (it needs the project's folders), which leaves setup step 14 to the Reports page. (2) Semi-annual and annual reports are opened when due, as elsewhere in the product, so the calendar lists only the cadence periods and the final report. (3) Author and reviewer are optional; only layout, due date and approver are required (`reporting.rules`).
- **Tests run (targeted)**: `pcw-schedule.test.mjs` (7), `pcw.test.mjs` (27), `pcw-draft.test.mjs` (13), web `pcw-schedule-view` + `pcw-view` + use-server-exports (15); web typecheck clean.

### 38.8 Budget and finance — built and tested (2026-11-02)
- **Domain**: `pcw/finance-operations.ts` (`FINANCE_OPERATIONS`: ADD/EDIT_FUNDING, ADD/EDIT_BUDGET). Amounts go through the one locale-aware reader and are stored as plain digits; an ambiguous amount ("1,250") is refused with the way to write it, never guessed; currencies are three letters; a budget line gets a stable `key` (`BudgetLineDef.key`, preferred by `budgetKeyOf`) the first time it is edited, so its chosen activity survives a new name or amount (same fix as plan rows). `parseAmount` is now exported from `budget-checks.ts`.
- **Summary** (`pcw/finance-summary.ts`): funding and budget totals per currency (never added across currencies); the budget total is the categories when there are any, else the most detailed rows, never both; a stated grand total is checked by the review's own `checkBudgetTotals`; unreadable amounts are counted, never added as 0. **`finance.reconcile` now compares funding with budget** (a difference holds the slide open until a person accepts it), as well as the stated total.
- **Suggester** (`suggesters/budget-links.ts`): a budget line goes to the activity its own result link points at, else to the one activity whose words it shares (a tie gives nothing), else to "a cost of the whole project" when its words are overhead words (a table, `SUPPORT_WORDS`); a line that matches nothing gets nothing. `ACCEPT_BUDGET_SUGGESTIONS`; `SET_FINANCE` now checks currency format and that every budget target is a planned activity or the support marker.
- **API/contracts**: `POST /v1/project-setup/drafts/:id/finance` (fourth instance of the generic proposal-change handler); `SetupFinanceOperationSchema`; kind lists pinned; the view carries `funding`, `budget` (with `budgetKey`), `budgetSuggestions` and `financeSummary`.
- **Web**: `FinanceSlide` — funding and budget lists (edit in place, add, confirm/remove), where each line belongs with the suggestion and its reason, totals side by side with differences stated and an "I have checked this" box, reporting currency (offered from the funding currency), approver, separate-approver switch, and "Not used" for the whole slide. Pure `finance-view.ts`.
- **Not in 38.8**: disbursement schedule, deliverables, advances and exchange rates (they stay on the project's Finance page after Launch; setup steps 28 is covered by funding alone), and creating the budget lines themselves, which happens at Launch (38.9) through the finance handlers using `budgetPlan`.
- **Tests run (targeted)**: `pcw-finance.test.mjs` (12) with `pcw.test.mjs` (27), application `pcw-draft` (13), web `pcw-finance-view` + `pcw-view` + use-server-exports (16), architecture (11), API authorization coverage (2); all typechecks clean.

### 38.9a Launch slide, risks and sign-off — built and tested (2026-11-02)
38.9 is split: **38.9a** (this: the slide and the sign-off) and **38.9b** (the launch engine, still to build).
- **Domain**: `pcw/risk-operations.ts` (`RISK_OPERATIONS`: ADD/EDIT_RISK; **assumptions are a risk kind**, so one list holds both; kind and seriousness from the real lists; same kind + title is one entry). New requirement `launch.assumptions` (step 11 is no longer deferred; `DEFERRED_STEPS` is now 10 and 34 only). Decision ops `ADD/REMOVE_CHECKLIST_ITEM` and `SET_DASHBOARD` (checked against `SECTOR_TEMPLATES`). `pcw/launch-review.ts`: `launchSummary` (what will be created, who is invited when, how many items read from documents were kept or left out) and the **sign-off fingerprint**: `signOffDraft` records who, when and `draftFingerprint(draft)` (proposal and every decision except the sign-off itself); `signOffIsCurrent` is false after any change. `canLaunch(results, draft)` now returns `OPEN_REQUIREMENTS`, `SIGN_OFF_MISSING` or `SIGN_OFF_STALE`.
- **The client can no longer set a sign-off**: the old `SIGN_OFF` decision op is gone from the domain and the contract. `SignOffSetupHandler` (`POST /v1/project-setup/drafts/:id/sign-off`) takes who and when from the session and clock, refuses while anything is open, and is creator-only.
- **API/contracts**: `POST …/drafts/:id/risks` (fifth instance of `ChangeSetupProposalHandler`); `SetupRiskOperationSchema`; kind lists pinned. The view carries `risks`, `summary`, `launch` (verdict + blockers) and `dashboardOptions`.
- **Web**: `LaunchSlide` — risks and assumptions (add, edit in place, confirm/remove, "Not used" for each), checklist, starting dashboard, invitations per person (when the project starts / later), a plain summary of what will be created with the documents comparison, and sign-off ("You signed this off on …", stale warning, disabled while anything is open). No **Start project** button yet: that is 38.9b.
- **Left for 38.9b**: `buildLaunchPlan`, `LaunchProjectHandler` (server re-check of `canLaunch`, resumable, `ProjectSetupRun` key map), the appliers that write through existing handlers (team + pending members migration, collection/forms, schedule, checklist, dashboard, invitations, activation), the `SETTING_UP` project state with `isOperationalProject`, and the Start button.
- **Tests run (targeted)**: `pcw-launch.test.mjs` (7), `pcw.test.mjs` (updated and extended), application `pcw-draft` (15, now with a finished-draft fixture in `test/support/pcw-complete-draft.mjs`), web `pcw-launch-view` + `pcw-view` + use-server-exports (14), architecture (12), API authorization coverage (2); all typechecks clean.

### 38.9b Launch engine — built and tested with fakes (2026-11-02)
- **Design**: launching wraps the existing `ApplySetupProposalHandler` (project + results, indicators, periods, plan, places, funding, risks; already resumable) and adds the wizard's own steps after it. No second writer for anything a handler already owns.
- **Domain** (`pcw/launch-plan.ts`): `projectInputFromDraft` (the project from the draft, the organisation's own name as implementing organisation, the launcher as manager unless the team's manager already has an account, no M&E officer named who cannot be), `entryWindowFor`, `LAUNCH_STEPS`, and `notWrittenAtLaunch` — a table of what the draft holds that launching does not write, said in words in the report so nothing is dropped silently.
- **Application**: `LaunchProjectHandler` — the server re-reads the stored draft and re-checks every requirement and the sign-off (the request decides nothing), creator-only, status READY/PARTIAL; validates the project against the real `CreateProjectSchema`; calls the apply; stops if the apply is partial; runs the steps in order, each recorded as a `LAUNCH` run; a repeat skips finished steps and carries on from the one that failed; a failed step puts the proposal back to PARTIAL. A **resumed launch ignores the sign-off fingerprint** (the apply rewrites the stored proposal), but still needs the sign-off and every requirement. Steps (one class per file, narrow ports in `ports/project-setup-launch.ts`): `ReviewModeStep` (simple review on/off), `EntryWindowsStep` (each non-cancelled period gets its window; a refusing period is a note), `FormsStep` (draft forms for FORM indicators; drafts only, a refusal is a note), `InvitationsStep` (invite those marked "when the project starts", each to this project; a waiting invitation or refusal is a note).
- **Infrastructure/API**: `createLaunchSteps` (the one place that knows which handler backs which port) and `createUserDirectory`; `POST /v1/project-setup/drafts/:id/launch` (`project.create`, in `RULES`). The view carries `appliedProjectId`.
- **Web**: a Start section on the Launch slide (button enabled only when the server's verdict says so; "Try again" after a partial launch; a report of what was made and what did not finish, with the sentences that explain; the "still to do by hand" list; a link to the project).
- **NOT written by a launch yet (honest list; shown to the person in the report)**: indicator owners, activity leads, report approvers and verifier (they need people who have joined: the pending-members design below), places and required files on planned activities, checklist items, the starting dashboard, the evidence default. **`SETTING_UP` project state and `isOperationalProject` are not built**: between the first and last step of a launch the project is visible as it is created.
- **38.9c, to build next**: (1) pending members — a `ProjectPendingMember` table (project, email, name, role, JSON of responsibilities such as indicator owner / activity lead / report approver) with RLS, and a resolver called from `AcceptInvitationHandler` that makes the person a member and applies the stored responsibilities through `SetIndicatorOwnerHandler` and the plan and report handlers (this replaces the earlier plan to make `ProjectMember.userId` nullable, which would touch every member query); (2) write the rest of the list above through existing handlers; (3) `SETTING_UP`; (4) a database-backed journey test (`UOW_VERIFY_DATABASE_URL`): a blank project through to using it with no setup screen visited.
- **Tests run (targeted)**: domain `pcw-launch-plan` (8), application `pcw-launch` (13) + `pcw-draft` (15), web `pcw-launch-view` (17 with the report rows) + `pcw-view` + use-server-exports, architecture (12), API authorization coverage (2); api, infrastructure and web typechecks clean. **Not run**: anything against a real database or the real handlers end to end.

### 38.9c Pending members, responsibilities and the first real-database run (2026-11-02)
- **Real-database journey** (`packages/infrastructure/test/journey/project-setup-launch.test.mjs`, opt-in `UOW_VERIFY_DATABASE_URL`): a finished draft is signed off and launched through the container's real handlers; checks the project, indicators, the plan's location, three periods each with an entry window, simple review on, one draft (unpublished) form, an invitation, an owner with an account, a remembered person, then that person joins by an ordinary invitation and gets their place and their indicator; no duplicate membership; a second launch refused. **It found three real problems that the fake-based tests could not**, all fixed: (1) the existing apply makes periods, plan and places only when a period is among the items, so a wizard project (which keeps its frequency in the decisions) silently got none of them: `proposalForLaunch` now states the chosen frequency as a period item; (2) the apply leaves out any risk with no seriousness, so a typed assumption vanished: a rating is now required when adding or editing a risk, and `risksUnrated` holds the requirement open for an unrated one; (3) budget lines are not created by the apply: listed in `notWrittenAtLaunch`.
- **Pending members**: `ProjectPendingMember` (migration `20261103100000_project_pending_members`, in `rls.sql`, exported with the organisation, `/ready` pair) remembers everyone named without an account, with their responsibilities as JSON; `PendingMemberResolver` runs from `AcceptInvitationHandler` (optional last constructor argument; never blocks joining; acts with the launcher's authority and role; keeps the record when something cannot be done). `ResponsibilitiesStep` puts people with accounts on the project and gives them what they own now. **One table of responsibility kinds** (`pcw/responsibilities.ts`, `RESPONSIBILITY_KINDS`) with one applier per kind (`IndicatorOwnerApplier`); today only indicator owners. People with no email who own something are named in the report.
- **A launch can be retried before the project exists**: a `BEGIN` launch run is recorded first, so a failed first attempt no longer makes the sign-off look stale (the existing apply rewrites the stored proposal as it goes).
- **Lessons**: a test run inside one transaction cannot continue after a unique-key violation (Postgres aborts it): put the refused duplicate last. A scratch Postgres needs a short socket directory (`/tmp/claude-1000/pgs`; the scratchpad path is too long). A starter-plan organisation has a seat limit: grant `ENTERPRISE` (`EntitlementGrant`, source `MANUAL`) in journey tests. `rls.sql` errors on a missing `donordesk_app` role when run on a bare scratch database; harmless there.
- **Still not written by a launch** (listed to the person in the report): activity leads, report approvers and the finance approver, the verifier, required files, the checklist, the starting dashboard, the evidence default, and budget lines. `notWrittenAtLaunch` is the todo list; delete a row when a step writes it. **`SETTING_UP` is not built**: a project is visible as it is created.
- **Tests run (targeted)**: domain `pcw-launch`, `pcw-launch-plan`, `pcw` (49); application `pcw-launch`, `pcw-pending`, `pcw-draft` (39) and `accept-invitation` (10, unchanged behaviour); infrastructure repository tests on the real database (4) and the launch journey (1) plus the earlier apply journey (1); `rls-coverage`, `organization-export`; web `pcw-view`, `pcw-launch-view`; architecture (12); API authorization coverage (2).

### 38.9d Leads, budget lines and the starting dashboard — built; proven on the scratch Postgres (2026-11-02)
- **Activity leads** are a second responsibility kind (`PLAN_LEAD`: title + start day, since a plan row's draft key does not exist in the database) with `PlanLeadApplier` (its own file; the architecture guard caught two classes in one file). Same path as indicator owners: now for people with accounts, kept and applied on joining for the rest. An ambiguous activity (same title and day twice) is a sentence, not a guess.
- **Budget lines** (`BudgetLinesStep`, `budgetLinesForLaunch`): each line the person placed on a planned activity is made on that activity through `AddBudgetLineHandler`; the activity is found again by title and start day; the line's code is the budget's own reference else `B<n>`, made unique if the activity already has it, so a repeat adds nothing twice; the kind of cost comes from clear words in its name (`COST_CATEGORY_WORDS`, whole words, one table) and is "Other" when the words say nothing. Lines for the whole project have no activity to sit under: counted in the report.
- **Starting dashboard** (`DashboardStep`): the chosen template is applied to the project through `ApplyDashboardTemplateHandler`; which indicator answers each role is only suggested by shared words (`suggestRoleMapping`), a role with no clear match stays empty and its charts are named as left out; a dashboard with nothing it can draw is a note.
- **Launch order**: review mode, entry windows, forms, team and responsibilities, budget lines, dashboard, invitations.
- **Verified on a real Postgres** (same journey test, extended): one budget line on its activity with the right amount in minor units, one dashboard with charts, the lead given to the person only when they join, and every earlier check still passing; the earlier apply journey and the repository tests still pass.
- **Still not written, and why (decision needed)**: the **verifier**, **report approvers**, the **finance approver** and the **evidence default** are collected on the Data entry, Reporting and Finance slides but the product has nowhere to store them: approval and verification follow a person's *role* and permissions, not a named person per project, and confidentiality has no project default. The **checklist** items have no handler that adds a custom item (the checklist is generated from rules). Options: (a) stop asking for these four on the slides and drop their requirements; (b) map them to roles; (c) build the missing homes. Until decided they stay in the report's "still to do by hand" list. `notWrittenAtLaunch` is the list.
- **`SETTING_UP`** is still not built.
- **Tests run (targeted)**: domain `pcw*` (111); application `pcw-launch-parts`, `pcw-launch`, `pcw-pending`, `pcw-draft` (45); infrastructure journey + apply journey + repositories on the real database (6); architecture (12); API authorization coverage (2); web `pcw-view`, `pcw-launch-view` (16); typechecks clean.

### 38.9e The wizard stops asking for what the product cannot store (2026-11-02, decision agreed with the user)
- **Removed from the wizard** (domain, contracts, API schemas, slides, copy, packs, tests): the **verifier**, the **report author / reviewer / approver**, the **finance approver and the separate-approver switch**, the **evidence default**, and the **checklist** (its items, the requirement, the two operations). Why: verification and approval follow a person's *role* and permissions, not a named person per project; confidentiality is chosen per file; the checklist is generated from the project's data and donor rules as each report is prepared. The slides now say so in one plain sentence each (`rolesNote`, `checklistNote`).
- **Requirements removed**: `entry.evidence`, `finance.approver`, `launch.checklist`; `entry.review` no longer needs a verifier; `reporting.rules` needs only layout and due date. Their codes (`verifierMissing`, `evidenceDefaultMissing`, `financeApproverMissing`, `checklistMissing`) are gone from `REQUIREMENT_CODES`.
- **The 47-step list stays fully accounted for**: steps 29 (finance approver), 36-37 (evidence confidentiality) and 39 (checklist) moved to `DEFERRED_STEPS` with the reason, next to 10 (donor indicator mapping) and 34 (collection links). `notWrittenAtLaunch` now lists only whole-project budget lines.
- **Packs** carry no checklist and no evidence default. `DefaultPack` is: cadence, report rules (layout + due days), review mode, entry window, risks, dashboard.
- **Left alone on purpose**: `financeSeparateApprover` and the approval rules of the finance register and the report editor are existing product features with their own settings; the wizard just no longer duplicates them.
- **Tests run (targeted)**: domain `pcw*` (111), application `pcw-*` (45), web `pcw-*` + use-server-exports (66), infrastructure real-database launch + apply journeys + repositories (6), architecture (12), API authorization coverage (2); typechecks clean.
- **What remains**: `SETTING_UP` (a project is visible while a launch creates it) and batch 38.10: four-language copy for the new slides, a browser check of the wizard (a Chromium harness like the other slides'), a link to the wizard from "New project", removing the Phase 36/37 review screens (D9), the AGENTS.md invariants (plan §9) and the support article.

### 38.9f The project is started by the launch; no `SETTING_UP` status (2026-11-02)
- **Deviation from §3.5, on purpose**: no new `SETTING_UP` status. A project is already created as a **draft**, which the product labels "Draft — activate to report" everywhere it shows. Adding a status would have meant changing every list, reminder, assignment source and public-API query that filters by status, for a launch that takes seconds. The health query includes drafts, so a status that hid them would also have been inconsistent.
- **`ActivationStep`** is the last launch step (`LAUNCH_STEPS` ends with `ACTIVATION`), through the existing `UpdateProjectHandler` (`status: "ACTIVE"`); safe to repeat. So the project is **active only when every earlier step worked**; a launch that stops partway leaves a draft, which is exactly "not started yet", and "Try again" carries on. The launch report names the step; the Start section already reads "The project has been started" only when the launch finishes.
- **Verified on a real Postgres**: the launch journey now asserts the project is `ACTIVE` afterwards; an application test proves a failing earlier step means activation never runs.
- **Tests run (targeted)**: domain `pcw-launch-plan` (15); application `pcw-launch`, `pcw-launch-parts`, `pcw-pending` (32); the real-database launch journey (1); architecture (12); web `pcw-launch-view` (9).
- **Left: batch 38.10.** (1) Four-language wording for the new slides (typed against the English shape; drafts without a native reviewer, as with the earlier wizard). (2) A Chromium harness for the wizard, like `test:setup-wizard`. (3) A link to `/projects/new/wizard` from "New project" (the route exists but nothing links to it). (4) Decision D9: remove the Phase 36/37 review screens once (1)-(3) pass; this deletes working code, so confirm first. (5) The AGENTS.md invariants (§9). (6) The support article. (7) A pass over what a person with no AI service configured sees (the blank path must work without it; the document path needs the service and Drive).

### 38.10a The wizard in a real browser (2026-11-02)
- **Link**: "New project" now offers "Set up step by step (guided, with or without documents)" (a plain anchor to `/projects/new/wizard`, which starts a draft on the server) beside the older "Set up from a project document" link.
- **Browser harness** (`pnpm --filter @donordesk/web test:pcw`, Chromium via Playwright, `apps/web/tests/harness/pcw/`): bundles the real `PcwShell` and all ten slides; the stubs run the **real domain operations and the application's own `describeDraft`** over an in-memory draft, so the page sees exactly the view the server builds; only storage and the final launch (proven on a real database) are stubbed. 15 checks: a person with no documents builds a whole project by clicking and typing (start, team, results, indicators, places, work plan with suggested links, data entry, reporting, finance, risks, dashboard), signs off, a change makes the sign-off stale, signs off again and starts it, and the launch report and project link show; typing straight after tabbing keeps the text; finance can be marked not used; nothing runs off the side at 375 px; no console errors. Three consecutive runs pass.
- **Real defects the browser found (all fixed)**: (1) **every field on a slide was disabled while any save ran**, and a browser drops focus from a disabled field without a blur, so tabbing into the next box and typing could lose the text and its save: fields are never disabled while saving now (buttons still wait); (2) **two requirements a project may leave out had no control on their slide** (outside partners, activities that feed no indicator), so the wizard could not be finished: added, with plain wording; (3) the reporting-currency box showed the funding currency as if it were saved while the requirement stayed open: it now offers "Use EUR, the currency of the funding" as a button and saves only when chosen; (4) a currency still showed as typed ("eur") after it was saved as "EUR": the box now shows what was kept; (5) the project-area section and its box shared one accessible name: the section is "Project area and boundaries"; (6) a typo in my copy ("DonerDesk"); (7) the shell's one-column layout let content widen the page on a phone: the column is now `minmax(0,1fr)`.
- **Tests run (targeted)**: `test:pcw` (15 checks, three runs), web `pcw-*` + use-server-exports + server-client-boundary (67); typechecks clean.
- **Left in 38.10**: four-language wording for the new slides; the AGENTS.md invariants; the support article; a pass over the no-AI-service view; and, once you confirm, removing the Phase 36/37 review screens (D9).

### 38.10b Documents in the wizard, notes and support article (2026-11-02)
- **A real gap closed**: the plan promised "one wizard with or without documents", but the new Start slide had no way to read documents. Now: `StartDocuments` (up to five files; sent through the existing `startSetupAction`; the browser moves to the new draft, which `PcwShell key={id}` remounts), a **reading notice** with polling every 3 seconds while the status is `EXTRACTING` (what was found appears when ready; a failure offers "Start without documents"), and **"Confirm all N that are waiting"** on the Results, Indicators, Places, Work plan, Funding/budget and Risks slides (`ACCEPT_MANY` for items nobody has decided; one decision, not hundreds). Without the AI service or Drive the server's own sentence appears and the slides still work by hand.
- **Browser harness**: 17 checks now (documents, notice, confirm-all, no-AI message added).
- **Docs**: `AGENTS.md` has the Phase 38 invariants; the support article is a draft in `memorybank/docs/support/_unpublished-phase38/` (registered only after a signed-in check, like the other unpublished drafts).
- **Left**: (1) **four-language wording** for the new slides: `copy.ts` is one English object that every component imports directly, so it needs a typed catalogue per language and a hook, touching every slide (a large, mechanical change plus unreviewed translations; best done as its own batch); (2) **removing the Phase 36/37 review screens (D9)**, held for the user's confirmation because it deletes working code; the older link on "New project" still points at them.
- **Tests run (targeted)**: `test:pcw` (17), web `pcw-*` + guards (67), architecture (12); typechecks clean.

### 38.11 Parity with the old review, four languages, organisation packs (2026-11-02)
- Built: "Show in the document", the "Left out" list, the documents list with a kind override, "Read this part again" (with a warning; the shell polls while a part runs), moving a result under another parent, the work-plan timeline, donor/country offered from documents (never filled). Backend: `DraftViewer`, `leftOutFromRuns`, `areaRunStates`; harness 18 checks.
- Built: French, Spanish and Arabic for every wizard sentence (typed against the English shape, `usePcwCopy`, completeness test, harness check). Drafts for a native reviewer. Still English: domain refusal sentences returned by operations, and the old review screens.
- Built: organisation-owned default packs (`SetupDefaultPack`, `checkPackInput`, Settings → Starting answers, migration `20261104090000_setup_default_packs`; proven on a scratch Postgres: migration applies, no drift, save/overwrite/list/remove, another tenant sees the built-in pack).
- Not built: screen-reader pass beyond the existing focus/labels/reduced-motion; removal of the old Phase 36/37 review screens (needs the owner's go-ahead after a browser check); sector and frequency suggestions from documents.
