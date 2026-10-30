# Phase 35.F — Finance register (completes 34.6 / 33.11)

Status: **LAYERS 1, 2 AND 3 BUILT AND TESTED, plus the Home totals tile and the bulk import (layer 4 partly). Checked in a real browser with stubbed server actions (13 checks); not yet tried against the real API in a signed-in session. Not deployed. Still open: IATI export, cost per result on the indicator page, finance charts, file attach, editing a draft, four-language copy.** Branch `0015-compitition`. Version: DonorDesk 3.007. Written 2026-10-29.
Owner decision (2026-10-29): build the finance register before the Home funding tile, so Home can say "obligated / awarded / disbursed" with data behind it.

## 1. What exists and what is new

| Exists | Where |
|---|---|
| Budget lines on a planned activity (code, category, donor, currency, amount in minor units) and expenses booked against them (date, amount, description); overspend is a flag | `BudgetLine`, `BudgetExpense`, `workplan/budget.ts`, `budget-handlers.ts` |
| Period finance summary (budget, expenditure, committed, lines), VERIFIED/DRAFT, `financeDataMode` | `PeriodFinancialSummary`, `finance/` |
| Project budget (`budgetAmount`, `budgetCurrency`), grants under programmes | `Project`, funding |

New: funding sources, **disbursements**, **advances** (given, accounted, outstanding), **dated manual currency rates**, expense **vendor / approval status / evidence link**, burn and budget-vs-actual views, cost per result, and (later) IATI export.

## 2. Layer 1 — pure rules (BUILT, 13 tests in `finance-register.test.mjs`; domain suite 1074 green)

`packages/domain/src/contexts/finance/`: `money.ts` (`Amount` = whole minor units + currency; `sumByCurrency`: two currencies never add), `currency-rate.ts` (`checkRate`, `rateOn`, `convert`: the rate in force on the transaction's day is the latest dated on or before it; the direct pair, else the inverse of the opposite pair and it says so; **no rate = `RATE_NEEDED`, never a guess or a future rate**; BigInt arithmetic, 8-decimal rates, half away from zero), `register.ts` (statuses, `registerTotals`: only APPROVED expenses are spent, drafts are pending, rejected counted apart; `advancePosition`: outstanding, age, overdue after 30 days, over-accounting flagged not clamped, other-currency accounting never mixed in; `convertedTotal`: each amount at its own day's rate, total **null** if any lacks a rate and the ones that do are named; `canEditEntry`: drafts only), `finance-views.ts` (`burnReading`: spend beside time elapsed, gap in points, **no projection**; `budgetVsActual`; `costPerResult`: additive indicators only, "not computed" with a reason for a rate, zero/missing achievement or no spend).

## 2b. What DevResults' help article says (read 2026-10-29: "Budget", last modified 09/29/2025) and what we take from it

Source: `devresults.knowledgeowl.com` help export of the Budget article (project Budget tab and Project Index). Not documented there: advances, expense approval, and which date's rate converts (so our dated-rate rule and approval are our own and stricter).

| DevResults | Our decision |
|---|---|
| **Funding sources** are an organisation list (Administration); each is starred "Program's own funding", and the project's headline figures use **only starred sources** | `FundingSource` is an org list with `ownFunding`; `financeIndex` adds in own funding only and lists the rest apart (`otherFunding`). Built in layer 1 (`project-finance.ts`). |
| Project **Funding Sources table**: date, source, estimated amount, currency, primary-currency value, Budgeted (sum of the budget table per source), Disbursed (sum per source), % of total; a funding-breakdown pie | `ProjectFunding` rows (layer 1 type); per-source Budgeted/Disbursed computed on read; pie through the dataset/chart layer (layer 4) |
| **Budget table** per funding source: date, **item category** (org list under Administration), amount, currency, primary value, **Expenses** (sum per category), **Remaining**; a budget-breakdown pie | Org-defined **budget categories**: the six built-in categories stay as defaults and an organisation may add its own (`BudgetCategory`); `BudgetLine.category` already holds a string. Remaining = budget − spent (`budgetVsActual`, layer 1) |
| **Expenses and disbursements register**, one tab per funding source: date, memo, line item, expense + currency, disbursement + currency, **Balance** (cumulative expense − disbursement), **Age** (days since the date); export a template and import in bulk | `registerRows` (layer 1): running balance **per currency**, only approved entries move it, age in days. Expenses and disbursements both carry `fundingSourceId`. Import/export with a per-row error file (layer 3). |
| **Deliverables**: numbered, name, amount, currency, due date, **approval (who and when)**, payment date, attachments | `Deliverable` (a payment milestone; layer 1 rules `deliverableState`, `checkDeliverableChange`: approval records who and when, optional second-approver, payment needs approval, date not before approval). Attachments are evidence ids. |
| **Project Index**: Budget, **Obligated** (sum of the funding-sources table), **Disbursed**, **Remaining = Obligated − Disbursed**, each also in the local currency | `financeIndex` per currency; primary and local currency figures only through `convertedTotal` (null + the amounts lacking a rate) |
| **Budget Status** bars: budget, expenses to date, disbursed to date, **time elapsed** | `budgetStatusBars` (layer 1); time elapsed is `timeElapsedPercent` |
| **Obligated / awarded / disbursed** on the dashboard | Obligated = funding sources (own), awarded = grants (existing), disbursed = approved disbursements; Home says exactly these three |
| Primary and local currency under Program Settings; rates under Administration > Exchange Rates | `Organization.primaryCurrency` (+ optional `localCurrency`); `CurrencyRate` table (layer 2) |

## 3. Decisions for layer 2 (recommended)

1. **One expense store.** Extend `BudgetExpense` additively (`vendor`, `status` default `APPROVED` so existing rows keep counting, `evidenceId`, `currency` nullable = the line's) instead of a second expense table ("one rule per concept"). `BudgetLine` stays the budget line; add `fundingSourceId` (nullable).
2. **New tables** (revised after the DevResults article): `FundingSource` (**organisation** list: name, ownFunding, archived), `ProjectFunding` (project, source, date, amount, currency), `BudgetCategory` (organisation list, added to the six built-ins), `Disbursement` (project, source, date, amount, currency, memo, status), `Deliverable` (project, name, amount, currency, due, approvedBy/At, paidOn), `Advance` (+ `AdvanceAccounting` rows), `CurrencyRate` (from, to, rate text, effectiveOn, source, enteredBy), and `Organization.primaryCurrency` / `localCurrency`. `BudgetLine.fundingSourceId` and `BudgetExpense.fundingSourceId` (nullable). All tenant-scoped, RLS forced, in `rls.sql`, `/ready` pairs.
3. **Approval** is the existing sign-off style: a draft is entered by anyone with `workplan.update-own` on the activity; approve/reject needs a finance-capable role (new permission `finance.approve`, mapped to Admin, Project manager; M&E and Grants read). Approved/rejected rows are never edited; a correction is a new entry (`canEditEntry`). Every change audited.
4. **Rates** are an admin's dated table (`org.manage`); a rate cannot be deleted once a converted figure used it (it is superseded by a later-dated one).
5. **Finance never reaches a writer** unless `financeDataMode` is on and the summary VERIFIED (existing rule, unchanged); outside viewers never see finance (existing); the share-link and public API keep stripping it.

## 4. Layers

| Layer | Contents | Size |
|---|---|---|
| 2 Persistence and handlers | migration, repositories, handlers (add/approve/reject expense, disbursement, advance + accounting, rate, funding source), routes in `RULES`, audit, `/ready`, RLS coverage test, repository contract test (opt-in scratch DB) | L |
| 3 Screens | Project **Finance** tab: budget vs actual by line, register (filter, status, evidence link), advances with ageing, funding sources, burn beside time elapsed; Settings → **Currency rates**; CSV/XLSX import with a per-row error file (reuse record-sheet pattern); four-language copy | L |
| 4 Views and exports | portfolio totals for Home ("awarded / disbursed / spent", per currency or converted with the rate shown), finance charts through the dataset layer (`FINANCE` shape exists), cost per result in the indicator page, IATI export validated before download | L |

## 5. Not decided / out of scope here

- Auto conversion from a feed: refused (owner: rates are manual).
- Reclassifications between lines and markers (gender/environment/disability): later, additive.
- Payroll, procurement, bank reconciliation: out of scope; the register records, it does not move money.

## 6. Next step

Decisions 1–3 were agreed by the owner (2026-10-29). Layer 1 now also covers the DevResults-derived rules. Layer 2 starts with the revised schema above; two additions follow from the article and are taken as recommended unless the owner objects: **deliverables** (payment milestones with approval) and **organisation-defined budget categories**.

## 7. Layer 2 — what was built (2026-10-29)

- **Migration** `20261031090000_finance_register` (additive; applied cleanly on a scratch Postgres with all earlier migrations; `prisma migrate diff` shows no drift for it). Eight tables (`FundingSource`, `ProjectFunding`, `BudgetCategory`, `Disbursement`, `Deliverable`, `Advance`, `AdvanceAccounting`, `CurrencyRate`) with RLS in `rls.sql`; new columns on `Organization` (`primaryCurrency`, `localCurrency`), `BudgetLine.fundingSourceId`, and `BudgetExpense` (`vendor`, `currency`, `fundingSourceId`, `evidenceId`, `status` default `APPROVED`, `decidedBy/At`, `decisionNote`). **New amounts are BIGINT**: a grant can exceed 2^31 cents (verified with a 5-billion-dollar row).
- **Permission** `finance.approve` (Admin, Project manager; mirrored in `apps/web/src/lib/shared/capabilities.ts`). Entry: org lists/rates/currencies `org.manage`; project funding, disbursements, deliverables, advances `project.edit`; expenses `workplan.update-own`; approve/reject `finance.approve`.
- **Code**: domain `finance/entry-checks.ts`; ports `ports/finance-register.ts`; Prisma adapters `repositories/finance-register.ts`; handlers `use-cases/finance-register/finance-handlers.ts`; container module `container/finance-module.ts`; contracts `finance-register.ts`; routes `apps/api/src/routes/finance-register.ts` (all in `RULES`). Tests: domain (21 in `finance-register.test.mjs`), application (8 in `finance-register-handlers.test.mjs`), a Prisma smoke run on the scratch DB (draft decided once, a decided entry not again, deliverable approve-then-pay, advance accounting, rates).
- **Rules the handlers add**: an entry is DRAFT until `finance.approve` decides it, exactly once (the repository update is conditional on DRAFT); a rejection needs a reason; every project-scoped entity is addressed through its project and refused if it belongs to another; a funding source must exist and not be archived; an expense's budget line must belong to the project; a rate is added, never edited or deleted; advance accounting is in the advance's currency and not before it was given.
- **Read model** `GetProjectFinanceHandler` (`GET /v1/projects/:id/finance`): funding rows, `financeIndex` (own funding only), `inPrimary` (obligated/disbursed/spent in the primary currency, **null with the amounts that lack a rate**), the register with running balance and age, totals, advances with position, deliverables with state, budget vs actual per line (spend in another currency is counted apart, never mixed in), burn beside time elapsed, and which draft entries the caller may decide.

### Open points found while building
1. **Existing `BudgetLine.amountMinor` and `BudgetExpense.amountMinor` are 32-bit integers** (max about 21 million in major units): a line or expense above that fails to save. They are used by the work-plan budget screens, so changing them touches Number/bigint handling in that code; recommend a separate additive-then-swap migration to BIGINT.
2. **The older "Add expense" on a plan item still books an expense as APPROVED immediately** (the column default), so it bypasses the new approval. Decide: route it through the register (DRAFT then approve) or keep it as the activity lead's own entry.
3. **`separateApprover`** on deliverables is a constructor flag (off); it should become an organisation setting.
4. Deploy order: migration first, then `rls.sql` per table (check `rowsecurity`), then the code; `/ready` now requires `ProjectFunding.amountMinor`, `Disbursement.status`, `BudgetExpense.status`, `Organization.primaryCurrency`.

## 8. Layer 3 — screens (2026-10-29)

- **Project → Finance** (`/projects/:id/finance`, tab "Finance"): where the money stands (obligated, received, still to receive, spent; per currency; a reporting-currency line only when every amount has a rate, otherwise "Rate needed" and what is missing), funding sources table + add/remove, budget against spending with the burn bars and a plain sentence (ahead/behind/level; no projection), the register (running balance, age, draft/approved/rejected, approve and reject-with-reason for people who may), advances (age, overdue, account for part), payment milestones (approve, mark paid).
- **Settings → Finance** (`/settings/finance`, tab for `org.manage`): reporting and local currency, funding sources (own-funding flag, retire), dated exchange rates (added, never edited), organisation budget categories.
- **Structure**: `features/finance/domain/` (`finance-copy.ts`, `finance-view.ts`: pure, 7 tests), `presentation/` (`EntryForm` = one validated form for every "add", the sections, the settings panel), `lib/server/schemas-finance.ts`, `lib/actions/finance.ts` (async server actions, each validates then calls the API; the API applies the permission). Buttons a person may not use are not rendered (`project.edit`, `workplan.update-own`, `finance.approve`, `org.manage`); the server still refuses.
- **Checked**: web typecheck, 579 unit tests, and a full `next build` (it catches "use server" and server/client boundary errors). **Not checked**: any of it in a signed-in browser.
- **Not built in layer 3**: bulk import (CSV/XLSX with a per-row error file; reuse the record-sheet pattern), attaching a file to an expense from the form, editing a draft, a rate/figure history view, four-language copy (English only, in `finance-copy.ts`).

## 9. Done after layer 3 (2026-10-29)

- **Bulk import** (`finance/register-sheet.ts`, `ImportRegisterSheetHandler`, `POST /v1/projects/:id/finance/import`, "Import from a spreadsheet" on the Finance tab). One sheet, expenses and money received; columns `Type, Date, Amount, Currency, Paid to, What for, Budget line, Funding source`. Every row uses the same entry checks as a typed one; **any bad row blocks the whole import** and the person's own sheet comes back with a `Problems` column (only the rows to fix); unknown columns are reported; rows land as DRAFT; the same sheet applied twice stores once (ids from the sheet's hash and the row). Money received needs `project.edit`, an expense `workplan.update-own`. Domain subpath export `@donordesk/domain/contexts/finance/register-sheet.js` (pure; the client uses it for the template).
- **Home** (`/v1/portfolio/finance`, `GetPortfolioFinanceHandler`, `HomeFinance` on the portfolio Home): obligated, received and spent across the projects the person can see; per currency, own funding only; a reporting-currency line only when every amount has a rate; "funding is recorded for N of M projects" so a project with none is never read as zero; entries waiting for approval are counted apart. Needs `listForProjects` on the funding, disbursement and expense repositories (one read, not one per project).
- **Browser check**: `pnpm --filter @donordesk/web test:finance` bundles the real sections and the real sheet rules, stubs the actions and the router, and drives Chromium (13 checks): per-currency summary and "Rate needed" with what is missing, own-funding flags, over-budget and burn sentence, register balances and drafts, approve and reject-with-reason, bad-amount message before sending, **any three-letter currency can be typed** (the first version offered only the reporting currency: found by writing this check, fixed), overdue advance and accounting form, milestone approve and pay, import refusal with an error file and a good import, and a viewer sees no form or button. Run it after changing the finance screens.

### Still open
| Item | Why it is not done | What it needs |
|---|---|---|
| **IATI export** | A large spec: activities and transactions mapped to IATI codelists, validated against the schema before download; sensitive projects excluded | A decision on the IATI version (2.03), the publisher id and which fields we can honestly fill (our finance model has no IATI transaction types for expenses); then a mapping table and a validator |
| **Cost per result on the indicator page** | `costPerResult` (domain) exists; there is no link from a budget line to an indicator. A planned activity may serve several indicators, so dividing its spend by each one would double count | Decide the rule: spend of lines on activities linked to exactly one indicator, others listed as "shared" and not divided |
| **Finance charts** | The dataset layer has the `FINANCE` shape fed by period summaries, not by the register | Feed `DatasetResult.finance` from the register per period, then the existing waterfall/stacked/sankey kinds work |
| **Attach a file to an expense; edit a draft** | Needs an evidence picker in the form and an update path that keeps "a decided entry is never edited" | `PUT` for DRAFT rows only |
| **Four-language copy** | The finance screens are English only (`finance-copy.ts`) | Move to the typed catalogue and have native reviewers check the finance terms |
| **Older budget tables** | `BudgetLine`/`BudgetExpense.amountMinor` are 32-bit (overflow at about 21 million); the older plan-item "Add expense" books APPROVED directly | A BIGINT migration with the Number/bigint handling in the work-plan budget code; a decision on routing the older path through the register |
