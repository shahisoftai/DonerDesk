# Feature 25: Gap closure — dependencies, progress log, one-step Done, custom fields, budgets, beneficiaries, workload, automations

**DonorDesk Version 2.006** · **Branch:** `0013-programme-management` · **Plan and build record:** [`../imp/phase28-1-gap-closure.md`](../imp/phase28-1-gap-closure.md)

## 1. What a person gets

| Feature | In plain words | Where it shows |
|---|---|---|
| Comes after | Set which activities must finish first. Moving one pushes the ones that wait for it, and says which it could not move | Plan item page, list rows ("Waiting for …"), timeline bars (⧗) |
| Progress log | Record what was reached by day, week or month, then the activity end. Monthly is filled from the days inside it and replaces them. Blank stays blank | Plan item page → Progress |
| Done in one step | Pick the day it finished and (optionally) people reached; the completed activity and the plan status are saved together | "Done" on the plan item page and on list rows |
| Indicators per activity | Tick the indicators an activity reports on; their per-group targets become the log's breakdown fields | Plan item page → Progress |
| Targets per group | A target for each group (Women 150, Girls under 5 60 …), checked against the total target | Indicator page |
| Custom fields | A project's own text, number, date or choice fields on each planned activity | Plan item page |
| Budget | Budget lines per activity, expenses against them, overspend flagged (never blocked) | Plan item page |
| Problems, risks, assumptions, decisions, dependencies | One short list, filterable by kind | Project Overview |
| Roll-up | Verified indicator values added up per donor and code across the projects you can see | `/portfolio/indicators` |
| People reached | Case-code register (no names), duplicates caught, Kobo/ODK CSV import | `/projects/:id/beneficiaries` |
| Workload | Open activities each person leads, per week, against an optional limit | Team tab |
| Automatic reminders | Two rules, each on or off per project | Team tab |
| Bulk change | Move, set the lead, start or cancel many activities, previewed first | List view (tick rows) |
| Details panel | An activity opens in a panel from the right over the list | Activities section |
| Offline | The app shell and an offline page only; no project data is stored on the device | Any page |

## 2. Rules that matter

- **Blank is not zero.** An unrecorded figure is `null` in storage, empty in the form, "not recorded" when read. Pinned in `progress-log.ts`, `custom-fields.ts`, `budget.ts`, `portfolio-rollup.ts`.
- **One live entry covers each day.** A monthly progress report absorbs the daily and weekly entries inside it (`absorbedById`); totals never add an absorbed entry. A week may not cross a month end. Logging a saved day edits it.
- **Fields come from indicators.** `progressFields()` derives the breakdown fields from the linked indicators' `targetBreakdowns`; two indicators needing the same group share one field and name both.
- **Done is checked before it changes anything.** `CompletePlannedActivityHandler` validates the day, the reporting period and the status first; the completed activity is created before the status, so a failure leaves an open item, never a done one with nothing behind it.
- **Dependencies are a minimum.** `cascadeAfterMove` pushes successors by the fewest days and never pulls; done or cancelled successors are reported as blocked.
- **No personal data in the register.** Case code, sex, age group, location, consent; no names, phones or ID numbers (`beneficiary.ts`).
- **The service worker never caches pages or data** (`public/sw.js`): only the static shell and `offline.html`.
- **A new tour/help rule goes in `workflow-rules.ts`**; a rule with no `stepId` appears on "How it works" only.

## 3. Where it lives

| Layer | Path |
|---|---|
| Domain | `contexts/workplan/{plan-dependencies,progress-log,custom-fields,budget,beneficiary,submission-import,workload,automations}.ts`, `contexts/logframe/portfolio-rollup.ts` |
| Application | `use-cases/workplan/{plan-dependency,progress,complete-planned-activity,custom-field,budget,bulk-plan-action,workload,run-automations,beneficiary}-handlers.ts`, `use-cases/portfolio/` |
| Infrastructure | `repositories/{workplan,portfolio}.ts`; migrations `20261020100000` … `20261020170000` |
| API | `routes/workplan.ts`, `routes/tasks.ts` (`/v1/portfolio/indicators`) |
| Web | `features/workplan/{domain,presentation}/`, `app/(portal)/projects/[id]/activities/@panel/`, `public/{sw.js,offline.html}` |

## 4. Deploy

- Migrations, in order, as the migrator, before the code: `20261020100000_plan_dependencies` … `20261020170000_progress_log` (all additive).
- Re-run `infra/postgres/rls.sql`. `/ready` requires the new columns (see `apps/api/src/routes/health.ts`).
- Ship api and web together (`SCOPE=both`). The reminders timer picks up the automations on its next hourly run.
- Browser-verify with the owner's account after deploy; none of these screens has been opened on the live site yet.

## 5. Deployed

Release `20261019093235` (branch head `ee51780` plus `d556648`), `SCOPE=both`. Migrations applied as the migrator before the code: `20261020170000` progress log, `180000` submission mapping, `190000` beneficiary activity link, `240000` automation rule settings, `250000` plan effort; `rls.sql` re-run. `/ready` is green. Not built: targets by group in report tables (they pass through the writer contract and grounding). Not yet opened in a browser on the live site.
