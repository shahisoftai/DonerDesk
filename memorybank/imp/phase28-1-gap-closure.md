# Phase 28.1 — Gap closure after the programme-management review

**DonorDesk Version 2.006 (planned)** · **Date:** 2026-10-19 · **Branch:** `0013-programme-management` (uncommitted phase 28 work is still in the tree)
**Source of gaps:** `imp/phase28-new-management.md` §16 and the competitor review of 2026-10-19 (ActivityInfo, TolaData, Kobo, CommCare, Odoo NGO modules, Blackbaud, Workday Grants, Forecast, RAID-log practice). Competitor evidence was mostly vendor listicles and reviews; each batch below starts with a check of the real behaviour before it is built.

---

## 0. Status (checked against the code, 2026-10-20, after commit e616439)

Every row was checked against the code. Nothing after `13d76ee` is on Contabo.

| Batch | Built (committed) | Still open |
|---|---|---|
| A dependencies | links, cascade on move, blocked report, "Waiting for" label, timeline arrows (55aefa4), cascade preview in the timeline confirm bar (a130f36) | browser check of the arrows |
| B targets per group | validation, editor, indicator page, Data Center beside the verified figure (8d13569, 6cd43d0); **report tables: a "Results by group against group targets" table follows the indicator table (worker `group_target_table`; `VerifiedFinding.targetBreakdowns`; record chunk, lint and verifier accept the figures; no writer-contract change, 2026-10-20)** | none known |
| C custom fields | definitions, values, plan item form, list columns and spreadsheet (0c59907) | none known |
| D budget | lines, expenses, overspend flag, project totals (4a432e4), spreadsheet columns (8cc5c34), port split into roles (5b9fd1f) | none known |
| E RAID | five kinds, kind filter (fbcfef5), decision log on the Overview (ee51780) | none known |
| F roll-up | page, donor filter (6183378), link from projects, CSV download (6414b26) | not in the donor **report** documents |
| G beneficiaries | register, consent, duplicate flag, link to activities (5326c65), edit and remove (f5fb015) | none known |
| H offline | static shell + offline page; the existing banner already shows the offline state; progress entries and Done are kept on the device and sent later (06e6be5, 7108c11) | caching signed-in pages (needs a privacy decision) |
| I Kobo/ODK import | CSV import, saved column mapping (02bd998), check-first review (e2f317b) | none known |
| J workload | per person per week, limit, effort weight 1 to 5 per activity (35c65d8) | hours (not recorded by the app) |
| K automations | registry of rules with their own numbers, on/off, history screen (79f7d5c) | none known |
| L bulk edit | move, lead, status, preview, undo (e47fcf5, 296711d) | none known |
| Progress log, one-step Done, details panel | built (ecb1053, 807f381, fbcfef5) | browser check |
| Phase 28 leftovers | series-wide lead change (fccd00c), due-days setting (e39f2a1), logframe link move (7804e81), dated Done (06e6be5) | partner access (phase 29) |
| Tests | domain 694, application 619, web unit 343, infrastructure 344 + opt-in database tests (65 + 5) | Playwright e2e; browser check of every new screen with a real account |

### SOLID pass (done)

| Principle | Finding | Fix |
|---|---|---|
| Open-closed | automation rules were an if-chain | registry; each rule declares its label, default, numbers and evaluator (0cd810a, 79f7d5c) |
| Open-closed | bulk action kinds were branches | strategy table; a new kind is one entry (e47fcf5) |
| Dependency inversion | handlers depended on other handler classes; one took a loose audit type | small command interfaces (`IAssignPlan`, `IReschedulePlan`, `IChangePlanStatus`); `IAuditLogger` (e47fcf5, 0cd810a) |
| Interface segregation | `IBudgetRepository` had seven methods over two aggregates | four role interfaces; each handler names the roles it uses (5b9fd1f) |
| Single responsibility | `container.ts` 1,725 lines; one repositories file of 17 classes | work plan built in `container/workplan-module.ts` (container is 1,300 lines); one file per aggregate under `repositories/work-plan/` (eee43b3, 106364f) |
| Liskov | no inheritance in the new code | no action |

Remaining SOLID debt (honest): `container.ts` is still 1,300 lines for the other contexts, and `plan-handlers.ts` still holds several handlers per file, which is the repository's existing convention.

**Deployment:** migrations after `20261020160000_beneficiary_records`, in order: `20261020170000_progress_log`, `20261020180000_submission_mapping`, `20261020190000_beneficiary_activity_link`, any later ones from donerdesk-a9, then `20261020240000_automation_rule_settings`, `20261020250000_plan_effort`. Re-run `infra/postgres/rls.sql`. `/ready` requires the new columns. Gate, push and deploy are held by donerdesk-a9.

## 1. Principles for every batch

1. **Derived where possible.** A rule that can be computed (cascade, late, capacity) is a pure domain function with a table test; nothing is stored that can drift.
2. **One rule, one place.** Dependencies are checked by one function used by the aggregate, the handler and the UI. Copy goes through `workplan-copy.ts` and the forbidden-term scan.
3. **Every change is a revision and an audit event** (`PlanRecorder`). A cascade records one revision per moved item, and the revision names the item that caused the move.
4. **Tenant and RLS.** Any new table has `tenantId`, RLS forced, and a `donordesk_app` grant in `infra/postgres/rls.sql`. `/ready` requires each new column the app selects.
5. **Additive migrations only.** Apply by hand as `donordesk_migrator` before the code, as in phase 28.
6. **Gate.** `pnpm -r typecheck`, domain/application/infrastructure tests against a fresh `dist/` build, architecture-boundary test, copy lint. A batch does not ship on a red run.

---

## 2. Decisions needed from the user (before the batch named)

| # | Decision | Needed for | My recommendation |
|---|---|---|---|
| 2.1 | **Beneficiary records hold personal data.** Store names and ages, or only a case code and sex/age group? | 28.1-G, 28.1-I | Case code, sex, age group and location only. No names, phone numbers or ID numbers in the first version. Consent and retention rules to be written with the organisation's data-protection lead. |
| 2.2 | **Budget granularity.** Budget per activity, per output, or per budget line with a cost category? | 28.1-D | Budget line per planned activity (code, cost category, amount, donor). Expenses are entered against a line, not against the activity as a whole. |
| 2.3 | **Offline scope.** Which screens must work with no signal? | 28.1-H | Opening the app with no signal and logging daily/weekly/monthly progress. Planning and reports stay online. |
| 2.4 | **Custom field types.** Which types? | 28.1-C | Text, number, date, single choice. No formulas in the first version. |
| 2.5 | **Dependency type.** Finish-to-start only, or also start-to-start? | 28.1-A | Finish-to-start only. It covers almost every NGO case; start-to-start can be added later. |

Batch 28.1-A proceeds on recommendation 2.5 (already decided by the choice of rules below).

---

## 3. Batches in detail

### 28.1-A — Dependencies between planned activities

**Rule.** "B starts after A ends": `B.plannedStart >= A.plannedEnd + 1 day`.

- Moving A **pushes** B (and B's own successors, transitively) by the minimum days needed. Dates move as a block, so duration is kept.
- Moving A earlier **never pulls** B earlier. A dependency is a minimum, not a fixed link.
- A successor that is already **DONE** or **CANCELLED** is not moved. It is reported as *blocked*, so the person sees the conflict instead of a silent change.
- A dependency cannot point to itself, duplicate another, or close a cycle. Cross-project links are refused.

**Domain** (`packages/domain/src/contexts/workplan/plan-dependencies.ts`, built in this batch):
- `canAddDependency(links, items, predecessorId, successorId)` → `Result`.
- `wouldCreateCycle(links, predecessorId, successorId)`.
- `cascadeAfterMove(items, links, movedId)` → `{ moves, blocked }`, pure, clock-free.

**Still to build:** a `PlannedActivityDependency` table (tenant, project, predecessor, successor, unique pair; RLS), `AddDependency` / `RemoveDependency` handlers, `RescheduleHandler` calling `cascadeAfterMove` and recording one `PlanRevision` per moved item with the cause, a "Comes after" picker on the plan form, dependency arrows on the Timeline, and a row warning "Waiting for: <title>" when the predecessor is not done.

**Tests.** Table tests for push, no-pull, chain push, blocked DONE successor, diamond (two paths to one successor), self-link, duplicate, cycle, and cross-project refusal (the last in the handler test).

### 28.1-B — Source of verification and targets per breakdown
- Indicator gets `sourceOfVerification` (text, required for the approved logframe) shown in the logframe table, the indicator page and the donor export.
- Target per breakdown: `IndicatorTarget.breakdowns[]` (the same field keys as the indicator's disaggregation). Shown beside the actual per breakdown in the Data Center sheet and the report table. Never a target without an actual value showing as 0.
- **Check first:** whether the logframe import already reads a "source of verification" column (the header vocabulary may already include it).

### 28.1-C — Custom fields per project
- `ProjectField` (project, key, label, type TEXT|NUMBER|DATE|CHOICE, choices, required?). `CustomFieldValue` attached to a planned activity or an indicator.
- Admins define fields on project settings; leads fill them on the plan form under "More details". Fields appear as columns in the list and as an export column.
- A custom field never reaches a writer prompt (same rule as risks).

### 28.1-D — Budget lines and budget-versus-actual (needs decision 2.2)
- `BudgetLine` (project, planned activity, code, cost category, donor, amount, currency). `Expense` (budget line, date, amount, evidence file). Actual = sum of expenses; remaining = line − actual.
- Overspend is a flag, not a block. Figures are shown only when a line has an amount; a line with no amount shows "No budget set", never 0.
- Interplay with the existing finance model: `PeriodFinancialSummary` stays the period view; budget-versus-actual is a project view. A verified summary still gates the writer; budget lines never reach the writer unverified.

### 28.1-E — RAID log
- Extends the risk register with `kind`: RISK (existing), ISSUE, ASSUMPTION, DECISION, DEPENDENCY (project-level, not plan-level).
- A decision records who decided, what, why and the date. Decisions are the record the plan's reasons already point to.
- One list on the project Overview, filter by kind. Risks still never reach a writer.

### 28.1-F — Roll-up across projects
- Portfolio view: for each donor and indicator code, the sum of verified period values across the projects that report it. Only reported findings count; a missing value is excluded, never 0.
- Projects must share the indicator code and unit; a mismatch is listed, not summed.

### 28.1-G — Beneficiary records (blocked on decision 2.1)
- `Beneficiary` (tenant, project, case code, sex, age group, location, consent recorded, created). No names in v1.
- Duplicate check: same case code in the same project is refused; a probable duplicate (same sex, age group, location, and similar code) is flagged for a person to decide, never merged silently.
- Activity entries can count people by case code, which lets unique-person counts replace attendance counts for the activity-end report.

### 28.1-H — Offline app opening and offline logging (scope decision 2.3)
- Service worker caches the app shell and the signed-in user's project pages that were opened recently.
- The existing per-user IndexedDB outbox gets two kinds: `progress-log` (daily, weekly, monthly entries) and `plan-status`. Each entry keeps its idempotency key.
- A refused entry is parked, never retried by itself (same rule as today).

### 28.1-I — Import of Kobo / ODK submissions (after 28.1-G)
- Import from a Kobo or ODK export file first (no live API). Each submission maps to a progress log entry or a beneficiary row through an explicit column mapping saved per project.

### 28.1-J — Workload and capacity
- `capacityHours` per person per week (optional). Team tab shows planned load per person per week against capacity; an overload is a signal, not a block.
- Load is computed from planned activities' dates and `targetCount`, not from timesheets.

### 28.1-K — Automations
- Rules of the form "when a planned activity is late by N days, assign a request to its lead" or "when a report is due in 7 days, notify the project manager". Rules are a fixed list (not user code), each with a test, and each run is recorded in the reminders ledger.

### 28.1-L — Spreadsheet-style bulk edit
- Multi-select on the List view: set lead, shift dates by N days, set status (through the existing transition table). Preview of every change before saving; one revision per item.

---

## 4. Non-goals for this phase
- Time tracking and timesheets.
- Payments or bank integration.
- Formulas in custom fields.
- Storing names, phone numbers or ID numbers of beneficiaries.
- Replacing KoboToolbox or CommCare as a data-collection tool.

---

## 5. Risks
- **Scope.** Twelve batches is a multi-week programme. The order above puts the cheapest, most-used gaps first, so a stop after any batch leaves working software.
- **Personal data (28.1-G).** Built only after decision 2.1 and a written retention rule.
- **Cascade surprises.** A moved predecessor can move many activities. Mitigation: the move preview lists every affected item before saving (28.1-L shares this preview).
- **Budget misreads.** A missing amount must never look like zero spending (same rule as "not measured").

---

## 6. Build order and tests per batch
1. 28.1-A domain (done) → persistence and handlers → UI.
2. 28.1-B, then 28.1-E (both extend existing registries; no new screen).
3. 28.1-C, then 28.1-J.
4. 28.1-D once decision 2.2 is answered.
5. 28.1-F, then 28.1-K and 28.1-L.
6. 28.1-G, then 28.1-I, once decision 2.1 is answered.
7. 28.1-H last: the offline scope is the largest change to the web client.

Each batch's acceptance tests are listed in its section. Browser verification with the user's own account happens after each deploy, as in phase 28.

---

## 7. Build record (2026-10-19) — SUPERSEDED by §0

This is the first build session's record, kept for history. Its "Not built" list and "Nothing is committed" line are **out of date**: §0 (checked against the code on 2026-10-20) is the current status. Items 2–5, 8 (partly), 9–11, 13 and 14 below were built later (timeline arrows and cascade preview, navigation links, beneficiary-to-activity links, budget totals, custom-field columns, RAID kind filter, status in bulk edit, repository tests).

### Verification run (2026-10-19, tree clean at 00235b7)
- `pnpm -r typecheck` and `pnpm -r build`: green.
- Domain 694, application 619, contracts 14, web unit 343, superadmin 3, workers (pytest) 212, architecture boundaries: all pass.
- Infrastructure 414 pass, 0 fail **with `WORKPLAN_VERIFY_DATABASE_URL` set** (all 25+ migrations applied to a scratch database, `rls.sql` run with no errors, repository contract tests green). `prisma migrate diff` shows only the known unrelated drift (pgvector column, two index renames, one `ReportDraft` index, one `ReportRevision` FK).
- Every new tenant table is listed in `infra/postgres/rls.sql` and has forced RLS; `/ready` requires the new columns.
- Playwright e2e: 12 of 12 pass (needs `npx playwright install chromium` once per machine).
- API: 3 tests fail only because they need a database login (`creem webhook`, `billing summary`, `RBAC before repository access`); not a code fault.
- Older tables without RLS (`ProjectRiskTrend`, `LessonPattern`, `ConnectorRun`, and others from the initial commit) are not part of this phase; listed as a separate hardening item.

The remaining open items are those in §0: the cross-project roll-up in the report documents (a report is per project, so there is no donor-level report to put it in; it stays a portfolio page and CSV), caching signed-in pages offline (privacy decision), hours in workload (not recorded), and a browser check of the new screens with a real account.

Original record follows.

### Built (domain, application, infrastructure, API, web, tests)

| Batch | What exists | Migration |
|---|---|---|
| A dependencies | finish-to-start links; cascade on move (recorded with its cause); DONE/CANCELLED successors reported as blocked; "Comes after" on the plan item; "Waiting for" on list rows and timeline bars (a marker and label, not arrows) | `20261020100000_plan_dependencies` |
| B targets per breakdown | per-group targets validated against the total target (summable types); editor on the indicator page; shown on the indicator page. "Source of verification" was already the **means of verification** field; the heading is renamed | `20261020110000_indicator_target_breakdowns` |
| C custom fields | project fields (text, number, date, one choice); values per planned activity; blank stored as no row; managers define, lead fills | `20261020120000_custom_plan_fields` |
| D budget | budget lines per planned activity (cents, currency, donor); expenses against a line; overspend flagged, never blocked; "No budget set" is not zero | `20261020130000_budget_lines` |
| E RAID | risk kinds extended: has happened, might happen, we are assuming, we decided, we depend on someone; each with its own question | none (kind is text) |
| F roll-up | verified values summed per donor and code; a project with none is "not measured"; a different unit or type is listed, not summed; visibility as the project list; page `/portfolio/indicators` | none |
| G beneficiaries | case code, sex, age group, location, day joined, consent required; no names; repeat code refused; likely duplicate flagged for a person; counts per person | `20261020160000_beneficiary_records` |
| I import | Kobo/ODK CSV → beneficiaries; all rows checked first; any bad row or clashing code refuses the file and names the line | (uses G) |
| J workload | open planned activities a person leads, per week, against an optional limit in activities; overload marked in words; Team page | `20261020140000_member_capacity` |
| K automations | two rules, each on/off per project: a soon-starting activity with no lead (manager); a finished activity still needing files (lead); run in the hourly reminder pass, once per item per rule per day | `20261020150000_automation_rules` |
| L bulk edit | many activities: move by N days, set the lead, change status; preview first; a refusal changes nothing; reason checked up front | none |
| H offline (shell only) | service worker caches the static shell and an offline page; never caches pages, API responses or `/v1`, `/api`, `/internal` | none |

RLS: `infra/postgres/rls.sql` lists every new table. `/ready` requires each new column the app selects.

### Tests (this session)
- Domain: 670 pass (new: dependencies, custom fields, budget, portfolio roll-up, targets, workload, automations, beneficiaries, submission import).
- Application: 580 pass (new: dependencies, custom fields, budget, bulk, beneficiaries/import/automation runner).
- Infrastructure: 344 pass; 59 database tests skipped (need `WORKPLAN_VERIFY_DATABASE_URL`).
- Contracts: 14 pass. Architecture boundaries: 3 pass.
- Web unit: 324 pass.
- API: 38 pass, **3 fail**: billing and RBAC tests hit a database and get "Authentication failed". These need a database; I did not confirm they pass on the original tree.

### Not built, or built partly (honest list)
1. **Data Center and report wiring for B** (targets beside actuals in the sheet and the report table) — not done.
2. **Timeline arrows for A** — the waiting marker and label are done; connector lines are not. The drag confirm bar does not preview cascaded moves (the server applies them).
3. **Navigation** for portfolio (F), beneficiaries (G) and automation settings (K): the pages and cards exist; no nav entries were added.
4. **Beneficiaries are not linked to completed activities**, so unique-person counts for an activity-end report are not derived from them yet (G).
5. **H deviates from the plan on purpose**: no signed-in pages or project data are cached on the device. The plan's "recent project pages" needs your decision (privacy). The offline outbox for progress logs was not built, because the app has no daily progress log yet.
6. **Daily/weekly/monthly progress logging (the mock)** is **not in the app**. Only the mock has it. It needs a decision on how it relates to completed activities.
7. **I**: CSV only; no saved column mapping; no direct Kobo/ODK API.
8. **J**: capacity is counted in activities per week, not hours. Hours are not recorded.
9. **D**: no project-level budget totals, and budget is not in the Data Center or exports.
10. **C**: custom fields are not yet in list columns, filters or exports.
11. **E**: the kind filter on the Overview is not added (the kinds exist).
12. **K**: two rules only, as planned. Notices are not configurable beyond on/off.
13. **L**: the UI offers move and lead; status change is in the API only.
14. **Repository tests against a real Postgres** for the new tables are not written (they need `WORKPLAN_VERIFY_DATABASE_URL`).

### Deploy notes (when this ships)
- Apply migrations `20261020100000` to `20261020160000` as `donordesk_migrator`, in order, before the code.
- Re-run `infra/postgres/rls.sql`.
- `schema.prisma` was edited by hand (never `prisma format`). Regenerate the client.
- Ship api, web and workers together (`SCOPE=both`). Restart the reminders timer so automations run.
