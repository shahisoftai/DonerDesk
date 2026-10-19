# Phase 28.1 — Gap closure after the programme-management review

**DonorDesk Version 2.006 (planned)** · **Date:** 2026-10-19 · **Branch:** `0013-programme-management` (uncommitted phase 28 work is still in the tree)
**Source of gaps:** `imp/phase28-new-management.md` §16 and the competitor review of 2026-10-19 (ActivityInfo, TolaData, Kobo, CommCare, Odoo NGO modules, Blackbaud, Workday Grants, Forecast, RAID-log practice). Competitor evidence was mostly vendor listicles and reviews; each batch below starts with a check of the real behaviour before it is built.

---

## 0. Status (re-reviewed against the code, 2026-10-19, HEAD e2f317b)

Every row below was checked against the code (file or symbol exists), not against earlier status text. "Owner" is the session that holds the open work; a session stages by path/hunk and commits within minutes so a sweep cannot catch half-edits.

| Batch | Built (committed) | Still open | Owner |
|---|---|---|---|
| A dependencies | links, cascade on move, blocked report, "Waiting for" label | timeline connector arrows; drag-confirm bar previewing cascaded moves | a9 (arrows); a6 (cascade preview) |
| B targets per group | validation, editor, indicator page | targets beside actuals in the Data Center sheet, report tables, exports | a9 |
| C custom fields | definitions, values, plan item form | list columns, filter, export (in progress, uncommitted) | a9 |
| D budget | lines, expenses, overspend flag, project totals on Overview (4a432e4) | budget in exports; split of the 7-method budget port | a9 (exports); a6 (port split) |
| E RAID | five kinds, kind filter (fbcfef5) | decision-log view | a6 |
| F roll-up | page, donor filter, link from projects | roll-up in reports and exports | a6 |
| G beneficiaries | register, consent, duplicate flag, link to activities, unique-people start (5326c65) | edit and remove a record | a6 |
| H offline | static shell + offline page only | offline progress-log outbox; offline indicator; (decision pending) caching signed-in pages | a6 |
| I Kobo/ODK import | CSV import, saved column mapping (02bd998), check-first review (e2f317b) | none known | done |
| J workload | per person per week, limit in activities | capacity per activity | a6 |
| K automations | two rules on/off per project | per-rule settings; run history screen | a6 |
| L bulk edit | move, lead, status, preview (fbcfef5) | undo | a6 |
| Progress log, one-step Done, details panel | built (ecb1053, 807f381, fbcfef5) | browser check with a real account | all |
| Phase 28 leftovers | series-wide lead change (fccd00c) | indicator due-days setter (column exists, read-only); move a planned activity's logframe link; backfilled completion date | a6 |
| Tests | domain, application and web unit suites cover every batch | database-backed repository tests for the new tables; Playwright e2e | a9 (DB tests) |

### SOLID audit (concrete findings, not a claim of compliance)

| Principle | Finding | Fix (owner) |
|---|---|---|
| Open-closed | `automationNotices` is an if-chain per rule; a new rule edits the function. | Rule registry: each rule is an entry with its own `evaluate`; the function iterates the registry (a6) |
| Open-closed | `BulkPlanActionHandler` branches on `action.kind` in preview, checks and apply. | Strategy table keyed by kind (a6) |
| Dependency inversion | `BulkPlanActionHandler` and `CompletePlannedActivityHandler` depend on other handler classes. | Depend on small interfaces (`IAssignPlan`, `IReschedulePlan`, `IChangePlanStatus`) (a6; a9 for Complete) |
| Dependency inversion | `SetAutomationRuleHandler` takes `{ record(e: unknown) }` instead of `IAuditLogger`. | Use `IAuditLogger` (a6) |
| Interface segregation | `IBudgetRepository` has 7 methods across two aggregates (lines, expenses). | Split into line and expense ports (a9 to confirm, a6 to do after a9 commits) |
| Single responsibility | `container.ts` is 1,718 lines; `repositories/workplan.ts` holds a dozen repositories. | One module per aggregate for wiring and for repositories, done last when no session has uncommitted edits there (a6) |
| Liskov | No inheritance in the new code; ports are structural. | No action |

"100% SOLID" is not something a test can prove. The above are the checkable violations; each fix keeps behaviour and has the existing tests as a safety net.

**Deployment:** nothing after `13d76ee` is on Contabo. Migrations to apply in order after `20261020160000_beneficiary_records`: `20261020170000_progress_log`, `20261020180000_submission_mapping`, `20261020190000_beneficiary_activity_link`, then any later ones (a9 uses `20261020190000`–`20261020230000`; a6 uses `20261020240000` upward). Re-run `infra/postgres/rls.sql`. Gate, push and deploy are held by donerdesk-a9.

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

## 7. Build record (2026-10-19)

Status below is the state at the end of the build session. Nothing is committed, migrated or deployed.

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
