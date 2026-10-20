# Feature 23: Work plan (planned activities, timeline, My week)

**DonorDesk Version 2.005 (in development)**

**Author:** Claude (agent) · **Date:** 2026-10-19
**Status:** Batches 28.0–28.2 **deployed 2026-10-18** (release `20261018172624`, with 28.3–28.9). Demo 9 drove the main flows on production. **Still open:** the live-site check of the interactive screens with a real account, the offline status change, and §16 items (b) and (d) (see plan §16a). Plan and decisions: [`../imp/phase28-new-management.md`](../imp/phase28-new-management.md). Gap closure added dependencies, a progress log, budgets and bulk edit to this feature: [Feature 25](25-Gap-Closure.md).

## 1. What it is

Until now DonorDesk recorded and evidenced delivery (completed activities, indicator values, files) and reported on it. It did not let a team *plan* work, give it a lead, or see what is late while it can still change. This feature adds that, **inside the existing Activities tab, Overview, Home and project Settings**: no new navigation item and no new project tab. A project that does not use it looks exactly as before.

Two nouns, used everywhere and enforced by a copy test: a **planned activity** (work planned ahead) and a **completed activity** (the entry someone makes after doing it). A **milestone** is a planned activity with one date.

## 2. What a person can do

| Who | Can |
|---|---|
| Project Manager, M&E Officer, Admin (`workplan.manage`) | Plan from the logframe (3-step wizard), add or import planned activities, repeat them weekly or monthly, give a lead, move dates (drag or dialog), cancel and restore, copy a plan with a project's setup; see the Timeline |
| Anyone who leads or helps with an activity (`workplan.update-own`) | Set it Not started / Under way / Done, edit its notes and place |
| Field Officer | Lands on **My week** (Home): late, this week, next week; List, Week or Month; activities sent back to fix; "Add completed activity" |
| Everyone with project access | Read the plan; the planned-activity picker on the completed-activity form |
| Admin only | "Show work planning" (project settings) |

Buttons a role cannot use are not shown. One table (`ROLE_SURFACES`) decides, and a test checks it against capabilities.

## 3. Rules that matter

- **Delivery state is derived**, never stored: Upcoming, Due soon, In progress, Late start, Overdue, Done, Done late, Cancelled; a person sees one signal (On time / Late / Done / Cancelled) with the reason on hover ("past its end date 3 Mar", "done 4 days late").
- **Status** moves only through `PLAN_STATUS_TRANSITIONS`. Choosing **Done** is one action on the row or bar: it asks for the day it finished, the people reached and a note, and saves the completed activity and the status together (gap closure). A completed activity linked to a planned one may suggest that it is done; a person confirms. Cancelling needs a reason.
- **"Why?" is asked only when it matters** (original end passed, or a report covers the activity). Every change is stored as an append-only revision: the project's decision history, shown on the activity page.
- **Dates are plain days.** The first dates saved are kept as the original dates ("moved from 12 Mar").
- **Linking** a completed activity to a planned one fills an empty logframe link and never overwrites.
- **Import:** any row that cannot be read blocks the whole import and is named; repeats of existing rows are skipped.

## 4. Where it lives

| Layer | Path |
|---|---|
| Domain | `packages/domain/src/contexts/workplan/` (aggregate, transitions, delivery state, recurrence, plan-link, parser, copy, permissions, copy words), `core/exhaustive.ts`, `core/delimited.ts` |
| Application | `use-cases/workplan/` (create, status, reschedule, assign, update, list, history, start-from-logframe, import, copy, my week), `services/plan-access.ts`, `plan-recorder.ts`, `plan-link-resolver.ts`, `ports/workplan.ts`; `SetWorkPlanningVisibilityHandler`, `ListProjectPeopleHandler` |
| Infrastructure | `repositories/workplan.ts` (planned activities, revisions, context, facts, member directory, my week), migration `20261019100000_work_plan`, `infra/postgres/rls.sql` |
| API | `apps/api/src/routes/workplan.ts` (+ `GET /v1/projects/:id/people`, `copy-setup` option) |
| Web | `apps/web/src/features/workplan/{domain,application,presentation}`, `lib/actions/workplan.ts`, Activities tab, project Overview, Home, settings, `features/offline/domain/plan-status-outbox.ts` |

## 5. API

`GET/POST /v1/projects/:id/work-plan` · `POST …/work-plan/from-logframe` (`apply:false` previews) · `POST …/work-plan/import` · `PUT /v1/projects/:id/work-planning` · `GET /v1/projects/:id/people` · `PUT /v1/work-plan/:id` · `POST /v1/work-plan/:id/status | reschedule | assign` · `GET /v1/work-plan/:id/revisions` · `POST /v1/work-plan/parse-file` · `GET /v1/me/week` · `POST /v1/projects/:id/copy-setup` accepts `copyWorkPlan`. Create routes honour `Idempotency-Key`.

## 6. Tests

Domain table tests (every state, transition, recurrence edge, parser case), application tests with in-memory fakes (permissions, audit, revisions, series moves, import, copy), Prisma repository contract tests on a scratch Postgres with RLS (opt-in via `WORKPLAN_VERIFY_DATABASE_URL`), web unit tests for the pure layout, drag, calendar, role surfaces and outbox, and the architecture and server-to-client guards. Counts at commit time are in the plan, §14.

## 7. Not built

From the UX review (plan §16): the Ask-for-completed-activity button on the item page is still there (to remove or keep, decide first), and Completed is still a separate tab rather than a filter on Planned. Phase 29: opening the app offline (a service worker), partner access. Built since: budget lines (gap closure), the beneficiary register (gap closure, case codes only, no names).
