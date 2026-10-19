# Phase 28 — Programme management: implementation plan

**DonorDesk Version 2.005 (proposed)** · branch `0013-programme-management` (from `0012-demo8-fixes` once merged)

**Status (2026-10-19): 28.0, 28.1 and 28.2 built and committed on branch `0013-programme-management`. Not deployed. The interactive parts (drag, keyboard, offline queue, phone layout) have unit-tested logic but have not been driven in a browser; see §14.**
Sources: the review of the public positioning against the code (website `https://donordesk.online`, `/features`) and the gap list worked out from it.

**Goal.** The product should earn what the homepage says: an NGO can **plan** its programme work, **assign** it to people, **see delivery against plan** while it can still change, and
**keep the evidence** for each piece of work, and the report then reads from the same records. Today DonorDesk *records and evidences* delivery well. It does not *plan or coordinate*
it. Phase 28 adds the missing management layer without weakening any reporting invariant.

**Rule for the copy.** Until each batch ships, the website says only what is live (Batch 0). The wording of "Plan it" comes back once Batch 1 is in production and verified in the browser.

Constraints from `AGENTS.md` apply unchanged: domain pure; application = handlers + ports; one repository per aggregate; thin Zod-validated routes; **every mutation writes
`audit_events`**; `Result<T, DomainError>`; new Prisma columns used in `select/create/where` go into `REQUIRED_PRISMA_FIELDS` in the same change; never `prisma format`; package tests
run against `dist/` (build contracts → domain → application → infrastructure first); one source per rule; a missing value is never `0`; writers never receive workflow state;
plain-language reasons from one table; counts through `countOf`/`agree`/`stillNeed`; every form control labelled through `Field`; creates idempotent by key; offline sends through the
outbox; one import screen (`TextImportPanel`); dictation is `<Textarea dictate>`; proposals fill, never overwrite, never invent; Prisma `update` ignores `undefined` (write `?? null`).

**Simplicity review (2026-10-18, rev. 2).** The first draft added two project tabs, seven views, ten delivery states, a baseline step, a 5×5 risk matrix, three My Work tabs and a
budget module. That is the overload this product exists to avoid. Rev. 2 keeps the same architecture but changes what a person **sees and has to do**: §1a sets the rules, and §3, §8,
§9, §12 and §13 were edited to follow them. Where any older detail below conflicts with §1a, §1a wins.

---

## 0. Implementation status

| Batch | Scope | Status |
|---|---|---|
| 28.0 | Website copy matches what is live; architecture and copy-word guard tests | **Built** (homepage, hero, stage tabs, role card; `test/architecture-boundaries.test.mjs`; copy-word test in `packages/domain/test/workplan.test.mjs`). Not done: support articles and `/features` not re-read for the same claims; deck not updated |
| 28.1 | Plan the work: activities inside the Activities tab, *Start from my logframe* wizard, List view, records linked to activities | **Built** (domain, handlers, repos verified on scratch Postgres with RLS, migration `20261019100000_work_plan`, routes, List view, wizard, plan form, activity page with Move dates / Change lead / Cancel / Restore, planned-activity picker, import via `TextImportPanel` (any bad row blocks), Admin setting "Show work planning", names endpoint `GET /v1/projects/:id/people`, "copy work plan" option on copy-setup, tab-mode rule pinned for "no plan looks as before"). Not browser-checked or deployed |
| 28.2 | Timeline (with report deadlines), *My week* for field officers, Overview cards | **Built** (Timeline with deadline lane, three zooms, drag + keyboard + confirm bar; My week with List / Week / Month; Overview *Delivery* and *Outputs* cards; offline `plan-status` outbox kind). Not browser-checked or deployed |
| 28.3 | Who does what: leads on existing rows, one-click requests, My Work by person + Team tab | **Built and deployed** (assignment queue with nine sources and one shared contract test, requests, My Work by person, Team tab, leads on indicators/periods/checklist items; `ask-people` uses domain permissions) |
| 28.4 | See what is late: indicator values due, delivery health (three plain labels), risk trend wired | **Built and deployed** (indicator values due, delivery health three labels, `plan_slip`/`value_overdue` risk-trend factors; "behind target" deliberately left out) |
| 28.5 | Reminders without setup: one daily summary, escalation after 7 days, one setting | **Built and deployed** (hourly timer, one summary per person at 07:00 organisation time, escalation after 7 days, ledger, one email setting; runbook `docs/runbooks/reminders.md`) |
| 28.6 | Files the work needs (suggested), "still needed" warning, phone photo capture | **Built and deployed** (suggested required files, coverage, "Accept anyway" question; phone photo capture uses the existing "Take a photo") |
| 28.7 | Problems and risks (four-field form, Overview card) | **Built and deployed** (four-field form, Overview card, 30-day review, close with how it ended) |
| 28.8 | Comments on records, indicators, activities and risks | **Built and deployed** (`COMMENTABLE_ENTITIES`, `ICommentTargets`, `CommentsDisclosure` on four pages) |
| 28.9 | Reports read the plan (writer v6, advice only in readiness) | **Built and deployed** (writer contract v6, `record:plan:*` chunks, "Suggested from your plan", readiness advice; production runs v6) |
| 28.10 | Budget lines | Moved to Phase 29 |
| 28.11 | Offline opening, partner access | Moved to Phase 29 |
| 28.12 | Demo 9 with per-role simplicity measures; production browser check | **Run** — demo 9 (CMAM Nepal, 8 months) in `demo/verification-demo-9.md` |

Deferred to a later phase, on purpose: **beneficiary / participant register** (personal data, consent, retention and DPA work come first; counts stay on the activity record).

---

## 1. What exists today (baseline)

Labels: **Exists**, **Partial** (built in part or not wired), **Missing**.

| Area | Item | State | Where |
|---|---|---|---|
| Plan | Logframe tree with ACTIVITY nodes | Partial: code/title/description/sortOrder only | `LogframeItem` |
| Plan | Record → logframe activity link | Partial: link to a title, not a plan | `ActivityUpdate.logframeActivityId`, `resolveActivityNodeLink` |
| Plan | Dates, owner, status, target on planned work | Missing | — |
| Plan | Reporting periods, deadlines, internal review deadline | Exists | `ReportingPeriod`, `period-lifecycle.ts` |
| People | Members with seven roles, invitations | Exists | `ProjectMember`, `role.ts`, `permissions.ts` |
| People | Indicator owner | Partial: stored and in handlers, no UI | `Indicator.responsibleUserId` |
| People | Period owner | Partial: stored and in create handler, no UI | `ReportingPeriod.responsibleOfficerId` |
| People | Checklist assignee | Partial: column + `ChecklistItem.assign()`, never called | `ChecklistItem.assignedToId` |
| People | Tasks / requests | Missing | — |
| People | Comments | Partial: report sections and evidence page only | `Comment`, `CommentsThread` |
| Monitor | Data Center, roll-ups, % of target, not measured | Exists | `data-sheet.ts`, `data-charts.ts` |
| Monitor | Indicator due rule | Exists | `isDueInPeriod` / `expectedInPeriod` |
| Monitor | Risk score | Partial: table, domain and repository, no route, no UI | `ProjectRiskTrend`, `risk-trend.ts`, `risk-trend-repository.ts` |
| Monitor | Project overview, dashboard | Partial: deadlines, readiness, pending evidence only | `project-overview-read-model.ts`, `dashboard-read-model.ts` |
| Queue | My Work | Partial: urgency queue, no assignee filter | `work-items-read-model.ts`, `work-item.ts` |
| Notify | Notifications, Postmark email, Slack/Teams/WhatsApp adapters | Exists | `Notification`, `comms/` |
| Notify | Deadline reminders | Partial: one handler on an internal route, report sections only, no schedule | `generate-deadline-reminders.ts`, `routes/internal.ts` |
| Evidence | Library, single linker, verification, pack | Exists | `IEvidenceLinker`, `EvidencePackFileLoader` |
| Evidence | Requirements per planned work, evidence requests | Missing | — |
| Finance | Project budget, period finance summary | Partial: report input only | `Project.budgetAmount`, `PeriodFinancialSummary` |
| Risk | Risk/issue register, decision log | Missing | — |
| Field | Offline outbox for activity records | Exists | `features/offline` |
| Field | Open app offline, offline plan view, partner access | Missing | — |

---

## 1a. Simplicity rules (user-facing; they decide every screen in this phase)

Today: 7 global nav items (Home, My Work, Projects, Reports, Download Center, Evidence, Compliance + Team/Settings by role) and 9 project tabs. **Phase 28 adds no global nav item and
no project tab.**

1. **No new places to go.** Planning lives inside the existing **Activities** tab (views *Planned* and *Completed*); risks live on **Overview**; delivery health is a card on Overview and
   Home. Tasks and reminders appear where the person already is (My Work, the item, the email digest).
2. **One word per thing (decided 2026-10-18).** A **planned activity** is the work planned ahead (internal `PlannedActivity`). A **completed activity** is the entry someone makes
   after doing it (internal `ActivityUpdate`; button "Add completed activity"). A **request** is one person asking another for something (internal `ProjectTask`; never shown as
   "task kind"). A **milestone** is a planned activity with one date. These terms, and no others, appear in copy
   (`workplan-copy.ts`, scanned by `findRawTokens`; a copy test fails on "record" for an entry, "baseline", "delivery state", "series", "assignment", "subject").
3. **Optional and invisible until wanted.** A project with no planned activities behaves exactly as today. The Activities tab shows one card: "Plan your activities (optional) — see
   what is due and late. **Start from my logframe**". Dismissed per user; never a setup blocker, never a readiness or checklist item, never a red badge.
4. **Start from what exists, in three steps.** "Start from my logframe" is a wizard: (1) tick the logframe activities to plan (all ticked), (2) dates — default spread across the project
   dates, "repeats monthly" one switch per row, (3) who leads each (optional, "Skip for now"). Finish → the plan exists. Import from a sheet is the alternative path, never a third one.
5. **Each role sees its own work first** (`ROLE_SURFACES`, §8.0, one table): a field officer lands on *My week*; a project manager on delivery health; an M&E officer on indicator values
   due; grants and compliance officers on reporting, as today; a viewer reads. Buttons a role cannot use are not shown (the same `canActOnPlanItem`/permission check the API enforces).
6. **Three statuses a person sets, three signals the app shows.** People set *Not started / Under way / Done* (plus *Cancel* with a reason, from the item's menu). The app shows one
   signal: **On time**, **Late** (with "started late" / "past its end date" in the tooltip) or **Done**. Granular states stay internal for rules and tests.
7. **Ask for a reason only when it matters.** Moving an activity's dates asks "Why?" only when the activity's original dates have passed or a report has used it. There is no
   "Baseline" button: the first dates saved are the *original dates*; later dates show as "moved from 12 Mar".
8. **One-click requests from where you are.** On a planned activity: "Ask for completed activity", "Ask for a file". On an indicator row: "Ask for this value". On a completed activity: "Ask for a review". Anywhere:
   "Ask someone…" (free text). The kind is implied by the button; the dialog has only *who*, *by when* (suggested) and an optional note. Requests close themselves when the thing arrives.
9. **Sensible defaults, one setting.** Reminders work with no setup: a daily summary email only on days something is due or late; escalation to the project manager after 7 days late.
   The person's only setting: "Email me: daily summary (default) · only urgent · never".
10. **Two views, not seven.** Plan: **List** (default on phones and for field officers, grouped This week / Next / Later / Done) and **Timeline** (default for managers on desktop,
    report deadlines drawn on it). **Calendar** is a toggle inside My week. Output progress is a card on Overview. Drag to reschedule is built (with a confirm bar). Board, workload strip and planned-vs-actual chart are not built in this
    phase (revisit after demo 9 with evidence they are missed).
11. **Small risk list, not a register.** "Problems and risks": what it is, how serious (High/Medium/Low, one choice), who is handling it, what is being done, open/closed. No matrix, no
    separate decision log: reasons recorded when an activity is moved or cancelled *are* the decision history, shown on the activity and listed on Overview.
12. **No new configuration screens.** Indicator owner, report owner and checklist owner are pickers on the rows people already edit. No feature toggles; Admins can hide the plan card
    for the whole project from the existing project Settings ("Show work planning": on).
13. **Progressive help.** Each new screen has one hint from `workflow-rules.ts` (tour + how-it-works read it); no new tour.
14. **Every addition passes the simplicity checklist** (§2.7) as well as the SOLID one.

---

## 2. SOLID design rules for this phase (the review gate)

"100% SOLID" is checked, not hoped for: every PR in this phase passes the checklist in §2.6 and the guard tests in Batch 28.0.

### 2.1 Single responsibility
- **One aggregate per concept**: `PlannedActivity`, `ProjectTask`, `ProjectRisk`, `ReminderLedgerEntry` (`BudgetLine` in Phase 29). No "god" project aggregate gains plan fields.
- **Rules are pure functions in their own module**, one rule per file: `delivery-state.ts`, `recurrence.ts`, `plan-schedule.ts`, `assignment.ts`, `due-groups.ts`, `reminder-rules.ts`,
  `indicator-collection.ts`, `delivery-health.ts`, `risk-score.ts`, `timeline-layout.ts`, `calendar-layout.ts`.
- **One handler per use case** (create, update, reschedule, change status, assign, ...). Handlers orchestrate; they do not compute rules.
- **Read models are separate from repositories** (`IWorkPlanReader` for views; `IPlannedActivityRepository` for the aggregate). Web view helpers (`*-view.ts`) only format.

### 2.2 Open/closed
Extension is by adding an entry to an **exhaustive table**, never by adding a branch. Each table has an exhaustiveness test (same pattern as `CHECKLIST_KIND`, `FALLBACK_ACTION`).
- `ASSIGNMENT_SOURCES`: every kind of thing a person can be responsible for (plan item, task, indicator collection, checklist item, period, evidence verification, activity review).
- `DELIVERY_STATE_RULES`: ordered rules that turn facts into a delivery state.
- `TASK_KINDS`: each task kind's subject type, completion mode (STATE closes from data / MANUAL) and copy.
- `REMINDER_RULES`: when to remind and when to escalate, per assignment kind.
- `COMMENTABLE_ENTITIES`: entity type → permission check + people to notify.
- `WORK_PLAN_VIEWS`: view key → layout function + component (timeline, calendar, board, ...).
- `PLAN_STATUS_TRANSITIONS`: allowed status changes (same style as `ACTIVITY_TRANSITIONS`).

### 2.3 Liskov substitution
- Every `IAssignmentSource` returns the same `Assignment` shape with the same meaning of `dueDate`, `state` and `href`; a shared **contract test suite** (`assignment-source.contract.mjs`)
  runs against each implementation, including the in-memory fakes.
- Every `IPlannedActivityRepository` / `IProjectTaskRepository` implementation (Prisma, in-memory) passes the same repository contract test.
- A milestone is a `PlannedActivity` with `kind = MILESTONE` and `plannedStart = plannedEnd`; every rule that accepts a plan item accepts a milestone without a special case
  (pinned by running the delivery-state table tests for both kinds).

### 2.4 Interface segregation
Small ports, each used by few handlers: `IPlannedActivityRepository`, `IWorkPlanReader`, `IPlanRevisionRepository`, `IProjectTaskRepository`, `IAssignmentSource`,
`IAssignmentQueue` (composes sources), `IDeliveryFactsReader` (records per plan item), `IReminderLedger`, `INotificationPreferences`, `IProjectRiskRepository`,
`IScheduledJobRunner`. The existing `IClock` is injected wherever "today" matters. No handler takes the container.

### 2.5 Dependency inversion
- Domain imports nothing outside `packages/domain` (guard test, Batch 28.0).
- Application imports domain and its own ports only, never `@donordesk/infrastructure`, Prisma or Next.
- Infrastructure implements ports; `container.ts` is the only place they are wired.
- Web calls the API through `gatewayRequest`/server actions; pure layout code lives in `features/*/domain` with no React import.

### 2.6 Per-PR checklist (copy into each PR description)
- [ ] New rule lives in exactly one pure module, with a table test.
- [ ] New kind added through its table; exhaustiveness test passes.
- [ ] Handler depends only on ports; fakes cover it in an application test.
- [ ] Repository passes the shared contract test (in-memory and Prisma on scratch Postgres).
- [ ] Mutation audited; route thin and Zod-validated; permission from `permissions.ts`.
- [ ] New Prisma fields in `REQUIRED_PRISMA_FIELDS`; migration additive; RLS re-run if a table was added.
- [ ] User copy passes `findRawTokens`; counts through `countOf`; controls labelled.
- [ ] Guard tests (import boundaries) green; `pnpm -r build && pnpm -r typecheck` clean.

### 2.7 Simplicity checklist (also in each PR description)
- [ ] No new nav item or project tab; the feature lives where §1a puts it.
- [ ] Only the terms of §1a rule 2; copy test passes.
- [ ] Hidden for roles that cannot use it (`ROLE_SURFACES` / permission check), not just disabled.
- [ ] Works with zero setup; defaults chosen; no new required field.
- [ ] At most one primary button per screen; a form shows ≤ 5 fields before "More details".
- [ ] A project without a plan looks exactly as before (screenshot test in web unit or demo check).
- [ ] Usable at 360 px; no horizontal page scroll.

---

## 3. Domain model

### 3.1 `PlannedActivity` (new aggregate, `packages/domain/src/contexts/workplan/`)
| Field | Type | Notes |
|---|---|---|
| `id`, `tenantId`, `projectId` | string | |
| `kind` | `ACTIVITY \| MILESTONE` | milestone: one date, no participants |
| `logframeActivityId` | string? | ACTIVITY node it delivers; validated by `PlanNodeResolver` (same project, node level ACTIVITY) |
| `outputId` | string? | derived from the node's parent when a node is given; kept for unlinked items |
| `title`, `description` | string | |
| `ownerUserId` | string? | must be an active project member (`assignment.ts` `checkAssignable`) |
| `supportUserIds` | string[] | optional co-owners; never more than 10 |
| `location` | string? | |
| `plannedStart`, `plannedEnd` | date | `plannedEnd ≥ plannedStart`; inside project dates (warning, not refusal, when outside) |
| `originalStart`, `originalEnd` | date | set on creation to the first dates saved; never edited afterwards (shown as "moved from …"; no baseline step) |
| `targetParticipants` | int? | blank, never 0, when unknown |
| `targetCount` | int? | planned number of sessions/visits for a span item (e.g. 41 outreach visits) |
| `status` | `PLANNED \| IN_PROGRESS \| DONE \| CANCELLED` | stored; changes through `PLAN_STATUS_TRANSITIONS`; shown as Not started / Under way / Done / Cancelled |
| `statusReason` | string? | required for CANCELLED (no ON_HOLD: a paused activity is moved to new dates with a reason) |
| `seriesId`, `recurrenceJson` | string? | recurring items are materialised rows sharing a series |
| `evidenceRequirementsJson` | `EvidenceRequirement[]` | Batch 28.6 |
| `budgetLineId`, `plannedCost` | string?, decimal string? | Batch 28.10 |
| `completedAt`, `cancelledAt` | date? | |
| `createdById`, timestamps | | |

Invariants (in the aggregate, `Result` on failure): dates ordered; milestone has `plannedStart = plannedEnd`; status changes only through the transition table; reason required where
the table says so; a DONE item cannot be rescheduled (reopen first); every date change records a revision; a reason is required only when `reasonRequired(item, today)` says so
(original end date passed, or a non-cancelled report period covering it has a generated draft).

**Delivery state is derived, never stored** (`delivery-state.ts`, pure, clock passed in):
`deliveryState(item, facts, today) → UPCOMING | DUE_SOON | IN_PROGRESS | LATE_START | OVERDUE | DONE | DONE_LATE | CANCELLED`.
**What a person sees** is one signal from `deliverySignal(state) → ON_TIME | LATE | DONE | CANCELLED` (exhaustive table, copy "On time" / "Late" / "Done" / "Cancelled"; the
tooltip names the reason: "started late", "past its end date 3 Mar", "done 4 days late"). Granular states exist for rules, reminders and tests only.
where `facts = { liveRecords, acceptedRecords, firstRecordDate, lastRecordDate, deliveredCount }` (records linked to the item, `isLiveActivity` filter). `DUE_SOON` window = 7 days
(one constant). `deliveredCount` counts accepted records, or the sum of a span record's sessions when stated. The table is ordered and tested case by case.

**Status suggestions, not automation** (`plan-status-suggestion.ts`): the first live record suggests IN_PROGRESS; reaching `targetCount` or an accepted record on a single-date item
suggests DONE. The UI offers "Mark done"; nothing changes the stored status without a person (a person decides, as with attestations).

`PLAN_STATUS_TRANSITIONS` (same shape as `ACTIVITY_TRANSITIONS`): START (PLANNED→IN_PROGRESS), COMPLETE (PLANNED/IN_PROGRESS→DONE), REOPEN (DONE→IN_PROGRESS),
CANCEL (PLANNED/IN_PROGRESS→CANCELLED, reason), RESTORE (CANCELLED→PLANNED). The UI asks `canApplyPlanAction`. The status control is a three-step segmented control
(Not started · Under way · Done); Cancel/Restore sit in the item menu.

**Recurrence** (`recurrence.ts`): what a person chooses is only **Repeats: no / every week / every month, until <date>** (defaults: monthly on the start's day, until the project end).
The rule shape stays general for the code (`{ every: WEEK|MONTH, interval: 1, until }`) → `expandRecurrence(rule, start, duration) → dates[]`, capped at 120 rows. Occurrences are real
rows (each can be assigned, moved or cancelled). Moving one asks "Only this one / This and later ones" (`RescheduleSeriesHandler`); no other series editing.

### 3.2 `PlanRevision` (new, append-only)
`{ id, tenantId, projectId, plannedActivityId, changeJson (field → {from,to}), reason?, changedById, changedAt }`. Written by every reschedule, owner change, target change and
cancel. Reason required only per `reasonRequired` (§3.1). Never edited or deleted. These reasons are the project's **decision history** (rule 11): shown on the activity and as
"Recent changes to the plan" on Overview. **No baseline step**: `originalStart/originalEnd` replace it.

### 3.3 Link records to the plan
`ActivityUpdate.plannedActivityId` (nullable). `PlanLinkResolver` (one resolver, like `ActivityLinkResolver`) validates the same project and, when both exist, that the plan item's
node equals the record's `logframeActivityId`, filling the node from the plan item when empty (fill, never overwrite). The activity form gets a "Planned activity" picker
(owner's open items first, then same node, then by date nearest the record date; `suggestPlanLinks`, pure, with reasons).

### 3.4 `ProjectTask` (new aggregate, Batch 28.3)
A request from one person to another about something in the project.
| Field | Notes |
|---|---|
| `kind` | `TASK_KINDS` key: `RECORD_ACTIVITY`, `PROVIDE_EVIDENCE`, `ENTER_INDICATOR_VALUE`, `REVIEW_RECORD`, `OTHER`. Never chosen from a list: the button the person pressed sets it (§1a rule 8). Evidence verification stays a role-based queue item, not a request. |
| `subjectType`, `subjectId` | optional; required by the kinds that need one (`plannedActivity`, `indicator`+`reportingPeriodId`, `evidence`, `activityUpdate`) |
| `title`, `details` | title written from kind + subject ("Record: Mobile clinic, Ward 4 — March"); the person adds an optional note only |
| `assigneeId`, `assignedById` | the picker lists only active members with the permission the kind needs (`TASK_KINDS[kind].requires`), the subject's owner first |
| `dueDate`, `urgent` | due date suggested (activity end + 3 days; indicator due date; 3 days for others); one "Urgent" tick instead of a priority scale |
| `status` | `OPEN \| DONE \| CANCELLED`; `completedById`, `completedAt`, `completionNote` |

Completion modes (from `TASK_KINDS`): **STATE** kinds close from data, like checklist STATE items — `RECORD_ACTIVITY` when a live record is linked to the plan item,
`PROVIDE_EVIDENCE` when a file is linked to the subject, `ENTER_INDICATOR_VALUE` when the period value exists, `REVIEW_RECORD` when the record leaves
SUBMITTED. Closing is done by `TaskReconciler` on read and after the related mutation (audited `task.closed_by_data`); the person who asked gets one "Done: …" line in their next summary,
not a separate notification. **MANUAL** kind (`OTHER`) is closed by a person ("Mark done").

### 3.5 Assignment (one view of responsibility, Batch 28.3)
`Assignment = { key, kind, projectId, projectTitle, title, assigneeId, dueDate?, state (OPEN|LATE|DONE), urgent, href, source }`. It is a **read model**, not a table.
Sources (`ASSIGNMENT_SOURCES`, each an `IAssignmentSource` in infrastructure):
plan items by `ownerUserId`/`supportUserIds`; tasks by `assigneeId`; indicator collection by `Indicator.responsibleUserId` + due rule; checklist items by `assignedToId`;
reporting periods by `responsibleOfficerId` (report deadline, internal review deadline); evidence awaiting verification and activities awaiting review for people holding the approve
permission (role-based, flagged `source: ROLE` so the UI can say "because you can approve").
`due-groups.ts` (pure): `groupByDue(assignments, today) → LATE | TODAY | THIS_WEEK | LATER | NO_DATE` (empty groups are not shown). Role-based items (approve/verify) appear in the
same list with a small "because you approve" line, not in a separate tab.

### 3.6 Indicator collection schedule (Batch 28.4, no table)
`indicator-collection.ts`: `collectionDue(indicator, periods, updates, today) → { periodId, dueBy, state: RECORDED | DUE | OVERDUE | NOT_DUE }` using `isDueInPeriod` and a due offset
(`ReportingProfile.indicatorEntryDueDays`, default 5 days after period end, new column). A not-due indicator is never "missing". Owner = `responsibleUserId`; no owner → the
project's M&E officer (`signOffRoles` style lookup in one function `collectionOwner`).

### 3.7 Delivery health (Batch 28.4)
`delivery-health.ts` (pure): per project/output → `{ planned, done, doneLate, overdue, lateStart, onHold, cancelled, dueSoon, onTimeRate }` from delivery states, plus indicator
signals (`behindTarget` from the existing `performanceEvaluation`, `collectionOverdue`). One classification `healthBand(health) → ON_TRACK | AT_RISK | OFF_TRACK | NO_PLAN`
(thresholds in one table; shown as "On track" / "Needs attention" / "Behind" with the two biggest reasons, e.g. "4 activities late · 2 indicator values overdue"; no score is
shown to users). `ProjectRiskTrend` is recomputed from the same facts by the existing `risk-trend.ts` (extend its factors with `overduePlanItems`, `collectionOverdue`;
keep the stored score shape).

### 3.8 `ProjectRisk` — "Problems and risks" (Batch 28.7)
`ProjectRisk { kind PROBLEM|RISK ("It has happened" / "It might happen"), title, seriousness HIGH|MEDIUM|LOW, ownerId?, action (what is being done), status OPEN|CLOSED,
closedNote?, plannedActivityId?, raisedById, reviewBy? }` — the form is four fields (what, how serious, who handles it, what we are doing). `reviewBy` defaults to 30 days for open
HIGH items and feeds one reminder rule. No likelihood × impact matrix, no categories. **No separate decision log**: `PlanRevision` reasons are the decision history (§3.2).

### 3.9 `BudgetLine` (Batch 28.10 — **deferred to Phase 29** by the simplicity review: finance is off by default and few tenants use it; keep the design below for then)
`{ code, title, category, amount (decimal string), currency (= project currency), logframeItemId? }`. Plan items may carry `budgetLineId` + `plannedCost`. Spend comes from the
existing verified `PeriodFinancialSummary.linesJson` matched by line code (`matchSpendToLines`, pure). Balance and burn are computed in the domain (`summarizeFinance` extended per line),
never by the writer. A line without verified spend shows blank, never 0.

---

## 4. Application layer

New folder `packages/application/src/use-cases/workplan/` and ports in `ports/workplan.ts`, `ports/tasks.ts`, `ports/risks.ts`.

| Handler | Permission | Notes |
|---|---|---|
| `CreatePlannedActivityHandler` | `workplan.manage` | idempotent by key; recurrence expands here (one transaction) |
| `UpdatePlannedActivityHandler` | `workplan.manage`, or owner for location/description | revision; reason only when `reasonRequired` |
| `ReschedulePlannedActivityHandler` / `RescheduleSeriesHandler` | `workplan.manage` | |
| `ChangePlanStatusHandler` | `workplan.manage`, or owner (`workplan.update-own`) | through `PLAN_STATUS_TRANSITIONS` |
| `AssignPlannedActivityHandler` | `workplan.manage` | notifies the new owner |
| `StartPlanFromLogframeHandler` | `workplan.manage` | the 3-step wizard's one write: logframe ACTIVITY nodes → activities (dates from `proposePlanDates`, pure: spread across project dates, monthly where ticked), owners optional; idempotent; refuses when the project already has activities (then it is "Add activity") |
| `ImportWorkPlanHandler` | `workplan.manage` | preview then apply; any bad row blocks the import (Data Center rule) |
| `ListWorkPlanHandler` | `project.view` | items + delivery facts + states, filtered by range/output/owner/status |
| `GetDeliveryHealthHandler` | `project.view` | project and portfolio |
| `CreateTaskHandler`, `UpdateTaskHandler`, `CompleteTaskHandler`, `CancelTaskHandler` | `task.assign` / assignee | |
| `ListAssignmentsHandler` | self; `team.view-work` for others | composes `ASSIGNMENT_SOURCES` through `IAssignmentQueue` |
| `AssignChecklistItemHandler` | `compliance.manage` | finally calls the existing `ChecklistItem.assign()` |
| `SetIndicatorOwnerHandler`, `SetPeriodOwnerHandler` | `logframe.manage` / `report.manage` | wires the stored fields to the UI |
| `RunRemindersHandler` | internal | Batch 28.5 |
| `UpdateNotificationPreferencesHandler` | self | one field: `DAILY_SUMMARY` (default) / `URGENT_ONLY` / `NEVER` |
| `CreateRiskHandler`, `UpdateRiskHandler`, `CloseRiskHandler` | `risk.raise` / `risk.manage` / owner | Batch 28.7 |
| `GetMyWeekHandler` | self | a field officer's landing read: their activities this week and next, open requests, completed activities sent back to fix; one call |

Shared services: `PlanLinkResolver`, `TaskReconciler`, `AssignmentQueue`, `ReminderPlanner`.
Every handler: `Result`, audit event (`workplan.item_created`, `workplan.item_rescheduled`, `workplan.status_changed`, `workplan.started_from_logframe`, `task.created`, `task.closed_by_data`,
`task.completed`, `risk.created`, `risk.closed`, ...), idempotent creates, tenant scoping.

Changes to existing handlers (each additive):
- `CreateActivityUpdateHandler` / update / import: accept `plannedActivityId` through `PlanLinkResolver`; call `TaskReconciler` afterwards.
- `EvidenceLinkService.linkOnUpload`: after linking, `TaskReconciler` for `PROVIDE_EVIDENCE`.
- `CreateIndicatorUpdateHandler`: `TaskReconciler` for `ENTER_INDICATOR_VALUE`.
- `CopyProjectSetupHandler`: option "copy work plan" — titles, kinds, nodes, durations and offsets from project start; never owners, dates outside the target project, statuses or records
  (extend `planLogframeCopy` with `planWorkPlanCopy`).
- `GenerateDeadlineRemindersHandler`: replaced by `RunRemindersHandler`; the old route stays as a thin call for one release, then is removed.

---

## 5. Permissions (`packages/domain/src/policies/permissions.ts`)

| Permission | ADMIN | PM | M&E | GRANTS | FIELD | COMPLIANCE | VIEWER |
|---|---|---|---|---|---|---|---|
| `workplan.manage` | ✓ | ✓ | ✓ | | | | |
| `workplan.update-own` (status/notes of items they own) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `task.assign` | ✓ | ✓ | ✓ | ✓ | | ✓ | |
| `team.view-work` | ✓ | ✓ | ✓ | | | | |
| `risk.manage` | ✓ | ✓ | ✓ | ✓ | | ✓ | |
| `risk.raise` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

Ownership checks are one function, `canActOnPlanItem(user, item, action)` (domain), used by handlers and by the UI to decide which buttons to show. Viewers read the plan and its visuals.

---

## 6. Persistence

| Migration | Contents |
|---|---|
| `20261019100000_work_plan` | `PlannedActivity` (with `originalStart/originalEnd`), `PlanRevision`; `ActivityUpdate.plannedActivityId`; `Project.showWorkPlanning` (default true); indexes `(tenantId, projectId, plannedStart)`, `(tenantId, ownerUserId)`, `(seriesId)` |
| `20261019110000_project_tasks` | `ProjectTask`; indexes `(tenantId, assigneeId, status)`, `(subjectType, subjectId)`; `ReportingProfile.indicatorEntryDueDays` |
| `20261019120000_reminders` | `ReminderLedgerEntry { tenantId, recipientId, subjectKey, ruleKey, sentOn }` unique on all but id; `User.emailSummaryMode` (`DAILY_SUMMARY` default) — one column, no preference table; send hour fixed at 07:00 in the organisation's time zone |
| `20261019130000_risk_register` | `ProjectRisk` |
| (Phase 29) `budget_lines` | `BudgetLine`; `PlannedActivity.budgetLineId/plannedCost` |

All additive (new tables, nullable columns). After each: re-run `infra/postgres/rls.sql` with the new tables added (RLS forced, `donordesk_app` DML grants). Verify on a scratch database
(see memory note on local Postgres) with a repository round-trip per table. Add to `REQUIRED_PRISMA_FIELDS`: `PlannedActivity.plannedEnd`, `PlannedActivity.ownerUserId`,
`PlannedActivity.originalEnd`, `ActivityUpdate.plannedActivityId`, `Project.showWorkPlanning`, `ProjectTask.assigneeId`, `ReportingProfile.indicatorEntryDueDays`,
`ReminderLedgerEntry.ruleKey`, `User.emailSummaryMode`, `ProjectRisk.seriousness`. `ReportingPeriodRepository.update` is untouched; the new repositories each
have an "every mutable field persists" test.

---

## 7. API (`apps/api/src/routes/workplan.ts`, `tasks.ts`, `risks.ts`; thin, Zod in `packages/contracts/src/workplan.ts`)

- `GET /v1/projects/:id/work-plan?from&to&outputId&ownerId&status` · `POST /v1/projects/:id/work-plan` (Idempotency-Key) · `PUT /v1/work-plan/:itemId` ·
  `POST /v1/work-plan/:itemId/status` · `POST /v1/work-plan/:itemId/reschedule` (`scope: THIS|SERIES_FROM_HERE`) · `POST /v1/work-plan/:itemId/assign` ·
  `GET /v1/work-plan/:itemId/revisions` · `POST /v1/projects/:id/work-plan/from-logframe` (preview with `apply=false`, then apply) ·
  `POST /v1/projects/:id/work-plan/import` (multipart `apply` then `file`) · `GET /v1/me/week` ·
  `GET /v1/projects/:id/work-plan/export`
- `GET /v1/projects/:id/delivery-health` · `GET /v1/portfolio/health` · `GET /v1/projects/:id/risk-trend` (wires the existing repository)
- `GET /v1/me/assignments?group=due` · `GET /v1/projects/:id/team-work` · `POST /v1/projects/:id/tasks` · `PUT/POST …/tasks/:taskId(/complete|/cancel)`
- `POST /v1/checklist/:itemId/assign` · `PUT /v1/indicators/:id/owner` · `PUT /v1/periods/:id/owner`
- `GET /v1/projects/:id/indicator-collection?periodId`
- `GET/PUT /v1/me/notification-preferences` · `POST /internal/reminders/run` (internal auth, per tenant or all)
- `GET/POST /v1/projects/:id/risks`, `PUT …/risks/:riskId`, `POST …/risks/:riskId/close`

`describeValidationIssue` / `FIELD_LABELS` gain every new form field. API additions are additive; ship api and web together (`SCOPE=both`).

---

## 8. Web

New feature folders, each `domain/` (pure), `application/` (read models), `presentation/` (components): `features/workplan`, `features/tasks`, `features/delivery`, `features/risks`.
**No new routes in the global nav and no new project tab** (§1a rule 1).

### 8.0 Who sees what (`ROLE_SURFACES`, `features/workplan/domain/role-surfaces.ts`, one table, exhaustive over `Role`)

| Role | Lands on (Home) | Activities tab default | Can do (buttons shown) | Not shown |
|---|---|---|---|---|
| Field officer | **My week**: my activities this week/next, requests to me, completed activities to fix; big "Add completed activity" | Planned · List, "Mine" filter on | Under way / Done on own planned activities; Add completed activity; Ask for a review; Raise a problem | Timeline, Start-from-logframe, owner pickers, risk list editing, team view |
| Project manager | **Delivery health** card + My Work | Planned · Timeline | everything in the plan; requests; owners; risks; team view | — |
| M&E officer | My Work with **indicator values due** first | Planned · Timeline | plan editing; indicator owners; "Ask for this value" | team view |
| Grants / Compliance officer | as today (reports, checklist) | Completed (as today) | requests; checklist owner; raise/handle problems | plan editing |
| Admin | as project manager | Planned · Timeline | as PM + project setting "Show work planning" | — |
| Viewer | as today | Planned · List (read only) | none | every action |

The table drives: the Home cards, the Activities tab's default view, which buttons render, which My Work sections exist. A test pins that every role has a row and that no surface
offers an action the role's permissions lack (`permissionsFor(role)` cross-check).

### 8.1 Where each thing lives
- **Activities tab** (existing): a two-option switch at the top — **Planned** · **Completed** (Completed = today's page, unchanged). When the project has no planned activities, *Planned* shows
  the single optional card ("Plan your activities — see what is due and late. **Start from my logframe** · Import a sheet · Not now"). When `showWorkPlanning` is off, the switch is
  hidden and the tab is exactly today's page.
- **Activity page** `projects/[id]/activities/plan/[itemId]`: top = title, dates ("moved from …" when moved), lead, signal (On time / Late / Done); one primary button by role:
  field officer "Add completed activity", manager "Ask for completed activity" when none; below, in this order: completed activities, files (with "still needed" from requirements), requests, changes (reasons),
  comments. Status control (Not started · Under way · Done) and the item menu (Edit, Move dates, Cancel).
- **Overview tab** (existing): adds three cards only when a plan exists — *Delivery health*, *Outputs* (activities done of planned beside indicator % of target), *Problems and risks*
  (open items, "Raise a problem") and a short *Recent changes to the plan* list. No new tab.
- **Home** (`/dashboard`): role landing from `ROLE_SURFACES`; managers get portfolio health rows on the existing projects widget (one line per project: band + top reason).
- **My Work** (existing): one list grouped Late / Today / This week / Later (empty groups hidden), filter chips by project; managers get a second tab **Team** (people × counts:
  late, due this week; click a person → their list). No "I can act on" tab: approve/verify items are in the same list with "because you approve".
- **Indicator rows, period settings, checklist rows** (existing screens): a "Lead" picker inline; "Ask for this value" on an indicator row that is due.

### 8.2 Visuals (only two in this phase; layout functions pure, tested, no React in them)
1. **List** (`plan-list-view.ts`): grouped This week / Next week / Later / Done (Done collapsed), each row = title, dates, lead, signal, records count; "Mine" filter. Default on phones
   and for field officers and viewers.
2. **Timeline** (`timeline-layout.ts`): rows grouped by output, bar = planned dates, faint outline = original dates when moved, fill = progress (`deliveredCount/targetCount`),
   diamond = milestone, vertical line = today, top lane = report deadlines (`deadline`, `internalReviewDeadline`). CSS grid + SVG, no new chart library; each bar is a button with an
   accessible label; colour by signal from one token table and always with a text label on focus/hover. Zoom: Month / Quarter / Whole project (three buttons, remembered per user in
   local storage). Under 640 px the timeline is not offered — List is shown.
3. **Calendar** is a toggle inside *My week* only (week / month), for people who plan their own days.
4. Output progress is the Overview card above (reuses `optionForType`; rates left out as in the Data Center).
**Drag to reschedule (decided: in scope, Batch 28.2).** A bar can be dragged (move) or its ends dragged (change dates), snapping to days. On drop the bar shows the new dates in a
   ghost state and a small confirm bar opens: "Move to 12–14 Mar? **Save** · Undo"; for a repeating activity it adds "Only this one / This and later ones", and "Why?" appears only when
   `reasonRequired`. Nothing is saved until Save, so a reason is still asked when it matters. Only people with `canActOnPlanItem(…, MOVE)` can drag; others see no drag handles.
   Keyboard alternative: focus a bar, then ←/→ moves a day, Shift+←/→ changes the end, Enter opens the same confirm bar. Done activities are not draggable. The Move dates dialog stays
   for phones and the List view. Layout code (`timeline-drag.ts`, pure) converts pixels to dates and is table-tested.
Not built this phase: Board, workload strip, planned-vs-actual chart.

### 8.3 Forms (≤ 5 fields visible; "More details" for the rest)
- **Activity (plan) form**: Title · Dates (start, end, "End of month" helper; one date = milestone automatically, no "kind" field) · Repeats (No / Weekly / Monthly) · Lead ·
  Logframe activity (prefilled when started from a node). *More details*: location, people expected, number of sessions, other people helping, files we will need (suggested).
- **Start from my logframe** (3 steps, progress dots, Back/Next, nothing saved until Finish): (1) Which activities — the logframe ACTIVITY nodes, all ticked, grouped by output;
  (2) When — each row prefilled from `proposePlanDates`, a "Monthly" switch, one "Spread across the project" reset; (3) Who leads — optional per row, "Skip for now". Finish → preview
  count ("24 activities, 2 repeating monthly") → Create.
- **Add completed activity** started from a planned activity: the form opens with node, title, location and the activity linked (fill, never overwrite); after saving, "Mark activity done?"
  appears only when the suggestion rule says so.
- **Activity picker on the record form** (records not started from an activity): shown only when the project has a plan; "Which planned activity is this?" with up to three
  suggestions and reasons, "None of these" always available.
- **Request dialog**: Who (owner first) · By when (suggested) · Note (optional) · Urgent (tick). Title is written for the user.
- **Problem/risk form**: What is it · It has happened / It might happen · How serious (High/Medium/Low) · Who is handling it · What we are doing.
- **Move dates** dialog: new dates; "Only this one / This and later ones" for repeating activities; "Why?" only when `reasonRequired`.
- **Work plan import**: `TextImportPanel` with its action and row renderer; template columns Output/Activity code, Title, Start, End, Lead email, Location, Sessions, Repeats.
- Offline: status changes and "Add completed activity" from My week are queued through the outbox (`plan-status` sender in `OutboxProvider`).

---

## 9. Batches in detail

Each batch is usable alone and passes both checklists (§2.6, §2.7). Ship order (decided): 28.0 → 28.1 → 28.2 → 28.3 → 28.5 → 28.4 → 28.6 → 28.7 → 28.8 → 28.9 → 28.12 (reminders before monitoring: value sooner).

### 28.0 Copy and guards (no migration; web only)
- Homepage (`apps/web/src/app/page.tsx`, `HomeHero`, `StageTabs`), `/features`, role cards: replace "Plan it" with "Set it up", pillar 1 → "Set the logframe once. Each role sees
  the records, indicators and evidence it works with, and the report deadlines coming up."; Project Manager card → "Reviews and accepts activity records and signs off reports.";
  add the scope line "DonorDesk records and evidences delivery; activities are logged as they happen." Support articles checked for the same claims.
- Guard tests: `test/architecture-boundaries.test.mjs` (domain imports nothing outside itself; application imports no infrastructure/Prisma; web `features/*/domain` imports no React or
  server code). Shared `assertExhaustive(table, keys)` helper. Copy-word test for §1a rule 2 (`workplan-copy.ts`).

### 28.1 Plan the work (migration `work_plan`)
Domain: `PlannedActivity`, `PlanRevision`, `delivery-state.ts` + `deliverySignal`, `plan-status-transitions.ts`, `plan-status-suggestion.ts`, `recurrence.ts`, `reason-required.ts`,
`propose-plan-dates.ts`, `suggest-plan-links.ts`, `canActOnPlanItem`, `role-surfaces.ts`. Application: plan handlers incl. `StartPlanFromLogframeHandler`; `PlanLinkResolver`.
Infrastructure: repositories, `WorkPlanReader`, wiring, `REQUIRED_PRISMA_FIELDS`. Web: Activities tab switch, optional card, 3-step wizard, **List view**, activity page, plan form,
record-form link, import, project setting "Show work planning".
Done when: a PM goes from logframe to a 24-activity plan in the wizard in under 2 minutes (demo timing), a field officer opens an activity from the list, adds a record, and sees
"Mark activity done?"; a project without a plan looks exactly as before.

### 28.2 Timeline and My week (web only)
Timeline with report-deadline lane, zoom and drag to reschedule (§8.2); *My week* landing for field officers (list + calendar toggle); Overview cards *Delivery health* (simple counts until 28.4) and *Outputs*.
Layout functions with table tests (overlaps, range clipping, milestones, moved dates, 120-row repeats, empty plan). 360 px check.

### 28.3 Who does what (migration `project_tasks`)
`ProjectTask` (requests), `TASK_KINDS`, `TaskReconciler`, `ASSIGNMENT_SOURCES` + `AssignmentQueue`, `due-groups.ts`; "Lead" pickers on indicator rows, period settings and checklist
rows; request buttons where §1a rule 8 puts them; My Work as one grouped list + Team tab for managers. Replace `work-items-read-model.ts` (keep its urgency order inside each group).
Done when: "Ask for a file" on an activity closes itself when the file is linked, and the asker sees "Done" in the next summary; My Work shows only the person's items.

### 28.4 See what is late (column `indicatorEntryDueDays` rides in `project_tasks`)
`indicator-collection.ts` ("Due by 5 Nov · Amina" on indicator rows), `delivery-health.ts` + `healthBand` (three plain labels with two reasons), extend `risk-trend.ts` factors and
wire its route (feeds the band; no score shown), portfolio rows on Home. Late signals reach people only through 28.5's summary, never as ad hoc notifications.

### 28.5 Reminders without setup (migration `reminders`)
`REMINDER_RULES` (pure, per assignment kind): due in 3 days and due today → in the daily summary; late → in the summary each day; late 7 days → one escalation line in the project
manager's summary. `ReminderPlanner` (pure) builds one summary per person per day (nothing sent on a quiet day); `RunRemindersHandler` records in-app notifications, sends through
`INotificationPort` (Postmark when configured) and writes the ledger (once per rule per day). Immediate email only for: a new request to you, and an escalation. The only setting is
`User.emailSummaryMode` on the profile page. Scheduling: `IScheduledJobRunner`; production systemd timer `donordesk-reminders.timer` (hourly, `POST /internal/reminders/run`, sends to
organisations whose local time is 07:00); dev uses the in-memory queue. Runbook updated. No "delivered" claim without a provider receipt. The old deadline-reminder route becomes a thin
call into `RunRemindersHandler` for one release, then is removed.

### 28.6 Files the work needs (no migration; JSON column from 28.1)
"Files we will need" on an activity, suggested from the title/node with the existing evidence-type suggestions (the person only unticks); `evidenceCoverage` shows "Still needed:
attendance sheet" on the activity and on its records. Accepting a record with a needed file missing shows one line ("No attendance sheet yet — accept anyway?") and offers
"Ask for a file"; it never blocks. Phone capture: the record form's file input uses `accept`/`capture` for photos; location is taken from the record, the device location only with
explicit permission.

### 28.7 Problems and risks (migration `risk_register`)
The four-field form and the Overview card (§8.1, §8.3); anyone except viewers can raise one; HIGH open items get a 30-day review line in the handler's summary. No separate page:
"See all" expands the card into a full list on Overview.

### 28.8 Comments where the work is
`COMMENTABLE_ENTITIES` table: `report_section`, `evidence` (existing), `activity_update`, `indicator`, `planned_activity`, `project_risk`. Each entry gives the permission check and
the people to notify (lead, author, mentioned user). `AddCommentHandler` reads the table. `CommentsThread` at the bottom of each page, collapsed when empty ("Add a comment").

### 28.9 Reports read the plan (worker + API; **writer contract v6 is built in this phase** (decided), selected by `AI_REPORTER_CONTRACT_VERSION=6`; `runtime-provisioner.ts` switches production to 6 once demo 9's report compares cleanly with v5)
- Record chunks `record:plan:*` (`recordChunksFromPlan`): "Outreach visits: 41 planned, 38 held between 1 Jul and 30 Sep"; cancelled/moved activities with their recorded reason.
  Supported for claims; never cited as evidence.
- Planned/delivered counts grounded in `grounding.py`, `number-grounding.ts` and `LintGrounding` together, one shared test table.
- Writer input `deliveryPlan` (counts and reasons only — no names, no statuses, no workflow words; checked against `WRITER_EXCLUDED_PERIOD_KEYS`). `_WRITER_RULES_V6_ADDITIONS` mirrored in
  `contract.ts`, pinned by the mirror test; v5 byte-stable.
- *Tell the story*: "Suggested from your plan" fills empty variance/challenge fields only, with a visible "from your plan" label.
- Readiness: one non-blocking advice rule in `READINESS_BLOCKER_RULES` for DRAFTING/IN_REVIEW ("3 planned activities in this period have no record"); SUBMISSION unchanged and
  golden-pinned; `reporting:eval` byte-identical with v5.
- Nothing here asks the user for anything new: a project without a plan reports exactly as today.

### 28.10 Budget lines — moved to Phase 29 (design kept in §3.9).

### 28.11 Field and partners — moved to Phase 29
Service worker (open the app offline, read-only *My week*); partner access (role `PARTNER` limited to activities assigned to it; seats and billing decided first).

### 28.12 Demo 9 and verification
UI-driven, management-first demo (new script under `scripts/demo-ui`): 3 outputs, plan built with *Start from my logframe*, 4 people of different roles, 3 months, requests, a late
activity moved with a reason, two problems, one quarterly report citing planned vs held. **Simplicity measures recorded per role**: clicks to first useful action, number of buttons on
the landing page, any moment the tester was unsure where to go. Findings in `memorybank/demo/verification-demo-9.md`; production browser check with the user's own account after each
deploy.

---

## 10. Tests

| Layer | Tests |
|---|---|
| Domain | table tests for `deliveryState` (every state × milestone/activity), `PLAN_STATUS_TRANSITIONS`, `expandRecurrence` (month ends, leap years, caps), `planSchedule` warnings, `suggestPlanLinks`, `groupByDue` (time zones at day boundaries), `deliverySignal` exhaustive, `reasonRequired`, `proposePlanDates`, `ROLE_SURFACES` × permissions cross-check, `collectionDue`, `deliveryHealth`/`healthBand`, `evidenceCoverage`, `planWorkPlanCopy`; exhaustiveness for every table in §2.2 |
| Application | each handler with in-memory fakes: permissions, audit, idempotency, revision-on-reschedule, `TaskReconciler` per STATE kind, `AssignmentQueue` merges and dedupes, `ReminderPlanner` + ledger (no duplicate send, nothing on a quiet day, one summary per person) |
| Contracts | shared repository contract tests (in-memory + Prisma); `assignment-source.contract.mjs` for every source |
| Infrastructure | Prisma round-trip per table on scratch Postgres with RLS; "every mutable field persists" per repository |
| API | route tests (validation labels, permissions, 404 across tenants), `/ready` fields |
| Worker | v6 rules, plan chunks grounding, mirror test, v5 byte-stable |
| Web unit | layout functions, view helpers, copy lint (`findRawTokens`) + the §1a word test, round-trip of the plan import parser, "project without a plan renders as before" snapshot per page touched |
| Golden | `reporting:eval` unchanged; readiness SUBMISSION golden |
| Architecture | boundary guard tests (28.0) |

Gate: `pnpm -r build && pnpm -r typecheck`, all package tests from a fresh build, worker tests, web unit — green before every deploy.

---

## 11. Deploy order (per batch)

Back up → apply the batch's migration(s) → re-run `infra/postgres/rls.sql` when a table was added → `deploy-fast.sh` with `SCOPE=both` (workers too for 28.9; confirm
`AI_REPORTER_CONTRACT_VERSION` in `/proc/<pid>/environ`; v6 only after the demo fixtures compare) → `/ready` green with the new `REQUIRED_PRISMA_FIELDS` → for 28.5 install and
enable the reminders timer, then watch one run in the log → browser check on production → record the release id in the deploy doc.

---

## 12. Copy after shipping

- After 28.1 + 28.2 are live and checked: restore "Plan it. Deliver it. Measure it. Prove it." with pillar 1 "Plan your activities from the logframe in minutes, and see what is
  late before the donor asks."
- After 28.3: Project Manager card "Gives each activity a lead, follows it and signs off reports"; My Work copy "everything that is yours, by when it is due".
- After 28.5: "A short daily summary, only on days something is due".
- Never claim a capability from a later batch; the features page lists each one as it ships. Deck and support articles move with the copy.

---

## 13. Decisions (all decided 2026-10-18)

| # | Item | Decision |
|---|---|---|
| 1 | Names | **Planned activity** (the plan) and **Completed activity** (the entry). Tabs *Planned* / *Completed*; copy test enforces them. |
| 2 | Auto status | A completed activity only suggests "Mark activity done?"; a person confirms. |
| 3 | Accepting without a needed file | One warning line + "Ask for a file"; never blocks. |
| 4 | Drag to reschedule | **Built** in 28.2, with a confirm bar (Save/Undo), "Why?" only when `reasonRequired`, keyboard alternative, hidden for people who cannot move. |
| 5 | Risks in donor reports | Never in Phase 28; later only opt-in per risk ("Mention in report"), title and action only. |
| 6 | Time zones | Organisation time zone, suggested from the country, default UTC; due dates are plain dates; summary at 07:00 local. |
| 7 | Email volume | At most one summary a day, none on quiet days; immediate only for a new request and an escalation. |
| 8 | Escalation | One line in the project manager's summary after 7 days late; no second or admin escalation. |
| 9 | Request due date | Suggested (planned end + 3 days / indicator due date / today + 3 days), editable. |
| 10 | Problems and risks | Anyone except Viewer raises; the handler, PM or Admin closes. |
| 11 | "Show work planning" | Per project, on by default, Admin only; off hides the screens and keeps the data. |
| 12 | Partner access | Phase 29; a partner user is a paid seat, scoped to activities assigned to them. |
| 13 | Budget lines | Phase 29, finance mode only. |
| 14 | Beneficiary register | Deferred until consent, retention and DPA rules are designed. |
| 15 | Writer contract v6 | Built in 28.9; production switched to 6 by `runtime-provisioner.ts` after demo 9's report compares cleanly with v5. |
| 16 | Scope and order | Phase 28 = 28.0–28.9 + 28.12; order 28.0 → 28.1 → 28.2 → 28.3 → 28.5 → 28.4 → 28.6 → 28.7 → 28.8 → 28.9 → 28.12. |

Remaining risks: feature creep back into the UI (mitigated by §1a, §2.7 and demo 9's per-role measures; anything not missed in demo 9 stays out) and the size of the phase (each batch
stands alone after 28.1).

---

## 14. As built (28.0–28.2) — what differs from the plan, and what is not proven

**Where it lives.** Domain `packages/domain/src/contexts/workplan/` (one rule per file, `index.ts` re-exports; `core/exhaustive.ts`, `core/delimited.ts`); application `use-cases/workplan/` + `services/plan-*.ts` + `ports/workplan.ts` (one narrow port per concern: `IPlannedActivityRepository`, `IPlanRevisionRepository`, `IPlanContextReader`, `IDeliveryFactsReader`, `IMemberDirectory`, `IMyWeekReader`); infrastructure `repositories/workplan.ts`; API `routes/workplan.ts`; web `features/workplan/{domain,application,presentation}`. AGENTS.md lists the invariants.

**Deviations (all small, all deliberate).**
| Plan said | As built | Why |
|---|---|---|
| Names of people via the existing user list | New `GET /v1/projects/:id/people` (names and role only, `project.view`) | `/v1/users` needs `users.manage`; a field officer could not see who leads what |
| Project setting inside `UpdateProjectHandler` | Own `SetWorkPlanningVisibilityHandler`, `org.manage` (Admin only), audited | Single responsibility; the plan said Admin only |
| Copy work plan inside `CopyProjectSetupHandler` | Own `CopyWorkPlanHandler`; the copy-setup route calls it when `copyWorkPlan` is true | Open/closed: the logframe copy is untouched; a plan that cannot be copied is reported without undoing the logframe copy |
| `reasonRequired` computed on the page | `reasonRequired` is a field of every list row, from one `reportCoveredRanges` query | "Why?" appears only when needed, with no per-row queries |
| Import preview then apply | Handler supports both (`apply`); the screen uses the shared `TextImportPanel`, which creates in one step, and a refusal lists the rows to fix | One import screen rule (plan §1a); the panel has no preview step |
| My week on Home for field officers | Shown only once the person has planned work (`shouldShowMyWeek`) | A project without a plan must look as before |
| Overview *Outputs* beside indicator % of target | Uses the logframe response + the Data Center sheet (`outputProgress`); rates and unrecorded values are left out | Reuses the existing "% of target" rule |
| `GetMyWeekHandler` includes open requests | Only planned activities and completed activities sent back; requests arrive with 28.3 | Requests do not exist yet |

**Bugs the tests found while building (kept as regression tests).** `PrismaProjectRepository.update` did not write `showWorkPlanning`; `parseWorkPlanText` trimmed a leading tab and shifted every column; a Server Component passing functions to Client Components (would fail at render, invisible to `tsc` and `next build`; now `tests/unit/server-client-boundary.test.mts`); `PlanStatusControl` refreshed on a result `run()` cannot distinguish from failure (actions now return `true`).

**Proven by tests (all green at commit time).** Domain 576, application 498, contracts 13, infrastructure 353 (352 passed, 1 skipped; the repository tests ran against a scratch Postgres with RLS), web unit 310, architecture 3; `pnpm -r typecheck` clean; `next build` exit 0 (run before the last small history-formatter change, which `tsc` and the web unit tests cover). The API suite has 3 failures that need database credentials for a `test` user and fail identically without these changes.

**Not proven (do these before deploy).**
1. Browser check on a real project: the wizard, the List, the Timeline drag (pointer capture, touch), keyboard moves, the confirm bar with and without "Why?", My week on a phone (360 px), the month calendar, dark mode.
2. Offline: change a status in My week with the network off, reload, reconnect, and watch it send; confirm a refused change is parked.
3. Production: migration, `rls.sql`, `/ready`, `SCOPE=both` (plan §11).
4. Public copy: restore "Plan it" wording and publish the support articles only after 1–3 (drafts are in `memorybank/docs/support/_unpublished-phase28/`; the deck is still v2.004 and says nothing about planning).

**Next:** 28.3 (requests, My Work by person, Team tab), then 28.5 (reminders), 28.4, in the order of §9.

---

## 15. As built (28.3–28.9) and deployed 2026-10-18 — what differs from the plan

**Release.** `releaseId=20261018172624`, `SCOPE=both`, branch `0013-programme-management`; migrations `20261019100000_work_plan`, `…110000_project_tasks`, `…120000_reminders`, `…130000_risk_register` applied by hand first (DB backup `/opt/donordesk/backups/db-pre-20261018-1725-phase28.dump`), `rls.sql` re-run (five tables, RLS forced), reminders script + timer installed by hand, worker restarted by `deploy-fast.sh` because its environment said contract 5 and `workers.env` said 6. Details: `CONTABO-DEPLOY.md`. Feature doc: `Features/24-Programme-Management.md`.

| Plan said | As built | Why |
|---|---|---|
| "Behind target" in delivery health | Not included | The per-period analytics own "behind target"; a second signal would disagree |
| Dashboard cards on the new queue | Dashboard still uses `loadWorkItems`; *My Work* and Home use the queue | Smaller change; the cards are scheduled to move with the Dashboard rework |
| Reminder route replaces the deadline route | `/internal/reminders/deadline` kept as a thin deprecated alias; old handler deleted | Kestra flows may still call it |
| Reminders script shipped by deploy | Installed by hand (`docs/runbooks/reminders.md`) | `deploy-fast.sh` does not ship `scripts/` |
| Risks also on a portfolio page | Overview only | Simplicity rule §1a: no new page |
| Comments on records, indicators, activities, risks | Same, through one table and a disclosure link; three older entity types unchanged | OCP: one row per commentable thing |
| Readiness advice (28.9) | One rule worth 1 point; only while drafting or in review | It must never move a score or the SUBMISSION golden |
| Production switches to v6 after demo 9 compares cleanly | Switched at deploy; demo 9's reports were written under v6 | One less release; v6 only adds three rules and a block that is absent without a plan |

**Found in demo 9 and fixed in the same phase:** consent from the invite page was rejected by the API (`CONSENT_SOURCES`), plan-link suggestions did not use the typed title, "files we will need" history wording and acronym casing. **Open (not fixed):** see `demo/verification-demo-9.md` ("Open findings") and `pending.md`.

## 16. UX review against other planners (2026-10-19) — changes to simplicity rules 6, 7 and 10

**Method.** Web search only, not hands-on testing. Most sources are vendor community forums or third-party blogs, some dated, so treat them as direction, not fact.

| Tool | How done is marked | How planned vs actual is shown |
|---|---|---|
| MS Project | Enter an *Actual Finish* date: scheduled finish moves to it and the task is 100% complete. Warns that % complete alone hides late finishes | Baseline set once (up to 11); Tracking Gantt with a Variance table |
| TeamGantt | Progress on the bar | Baseline bar (original dates + % complete at the time it was saved) drawn under the live bar |
| Xurrent | Status | Grey overlay of the original plan behind current tasks; shows behind/ahead |
| Tempo | Status | Dotted baseline bars under the task bar |
| Smartsheet | % Complete drives the bar fill | No native baseline on the Gantt (community answers); users add baseline columns |
| Asana | Tick the box (timestamp is set, cannot be backdated) | Not native; users export and compare |
| Monday | "Done" in a status column; Progress column fills the bar; drag a bar end to change dates | Not native; status history is a requested feature |
| Teamwork | Completion % in Gantt | No baseline described |
| TolaData / ActivityInfo / Kobo | Not Gantt-first | Users ask for a clear target-vs-achieved split |

**What this says.**
1. Most planners mark done **on the bar or row, with one field** (an actual date or a status), not in a second form. That supports the "one Done action" change.
2. Planned-vs-actual is a **ghost of the original bar** in the timeline (TeamGantt, Xurrent, Tempo), not text. That was deferred in rule 10; the evidence now supports building it.
3. An actual date is the completion record (MS Project). Our Done form already captures it.
4. Nobody offers a Baseline button as the main path. Our "first dates are the original dates" rule matches.
5. NGO tools are weak on schedule vs actuals; target vs achieved is a real, unmet need. Our plan + completed split already covers it.

**Updated rules (replace 6 and 7 wording, extend 10):**
- **6. Done is one action on the bar or row.** "Done" opens a short form: actual end date (default today), people, a note, files. Saving creates the completed activity and sets Done in one save. No separate "Mark activity done?" step.
- **7. Moves show as a ghost.** In the timeline, an activity moved from its original dates shows a thin outline of the original bar behind the live bar, with "moved from 12 Mar" on hover. The text stays in the list. Still "Why?" only when required.
- **10. Planned-vs-actual on the timeline is built** as the ghost bar above (one toggle, on by default for managers). Board and workload strip remain out of scope.

**Not changed:** three statuses, no Baseline button, no new tab, no new screen, reason rules, revisions and audit.

**Build order (proposed):** (a) combined Done save use case + one Done form on the bar/row; (b) remove "Ask for completed activity" from the item page (keep it in My Work); (c) ghost bar in `timeline-layout.ts` (pure, table-tested); (d) Completed becomes a filter on the Planned tab, with the Completed page read-only.
