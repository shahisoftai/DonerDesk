# Feature 24: Programme management — requests, My Work, reminders, delivery health, files, risks, comments, reports that read the plan

**DonorDesk Version 2.005**

**Author:** Claude (agent) · **Date:** 2026-10-18
**Status:** Batches 28.3–28.9 IMPLEMENTED and **deployed 2026-10-18** (`releaseId=20261018172624`, `SCOPE=both`; migrations `20261019110000_project_tasks`, `20261019120000_reminders`, `20261019130000_risk_register`; writer contract v6). Browser-verified in **demo 9** (`../demo/verification-demo-9.md`). Builds on [Feature 23](23-Work-Plan.md); plan: [`../imp/phase28-new-management.md`].

## 1. What a person gets

| Batch | In plain words | Where it shows |
|---|---|---|
| 28.3 Who does what | One list of everything that is yours, by when it is due; ask someone for a completed activity, an indicator value or a file in one click; a lead on indicators, reports and checklist items; a **Team** tab with each person's open work | *My Work*, planned-activity page ("Ask for completed activity", "Ask for a file"), indicator page, project **Team** |
| 28.4 What is late | Three plain labels for delivery health (On track / Needs attention / Behind), indicator values due, plan slip and overdue values feeding the risk trend | Project Overview "Delivery", Home portfolio, indicator pages |
| 28.5 Reminders | One morning summary per person, one escalation after 7 days late, one email setting | Notifications page (setting), bell, email |
| 28.6 Files the work needs | Suggested kinds of file per planned activity ("Files we will need"), "Still needed" on the activity, one question when accepting without them | Planned-activity page, planned-activity form ("More details"), review panel |
| 28.7 Problems and risks | A four-field form (what happened, how serious, what we are doing, who) and a short list; reviewed every 30 days; closed with how it ended | Project Overview "Problems and risks" |
| 28.8 Comments | "Add a comment" on a planned activity, a completed activity, an indicator and a problem or risk; the people who own the thing are told | Those four pages, per risk on Overview |
| 28.9 Reports read the plan | The writer is told how many activities were planned and held in the period and why some moved or were cancelled; claims restating that are supported; "Suggested from your plan" in *Tell the story*; one readiness hint | Report generation, Inputs → Story, readiness "Top 3 things to do" |

## 2. Rules that matter

- **One queue, many sources.** `AssignmentQueue` merges `IAssignmentSource`s (plan items, requests, checklist, report deadlines, evidence review, activity review, activity fix, indicator values, risk reviews). A new source is a class plus a `TASK_KINDS` row; every source passes `test/support/assignment-source-contract.mjs`.
- **A request closes when the work is done** (`TaskReconciler`), not by clicking; only a person may close a judgement request.
- **Reminders:** 07:00 in the organisation's time zone, one summary per person, nothing on a quiet day, ledger-protected (`../docs/runbooks/reminders.md`).
- **Risks never reach a writer.** Plan counts and recorded reasons do (`deliveryPlan`); names, statuses and workflow words do not.
- **Plan in a period:** an activity counts in the period of its planned end; cancelled ones are counted apart; "held" = Done.
- **Comments:** `COMMENTABLE_ENTITIES` says what can carry one and who is told; unknown or foreign ids are refused.

## 3. Where it lives

| Layer | Path |
|---|---|
| Domain | `contexts/tasks/` (task kinds, `ProjectTask`, assignment model, week, reminder rules/planner, indicator collection, delivery health, `commentable.ts`), `contexts/risks/project-risk.ts`, `contexts/workplan/required-files.ts`, `plan-delivery.ts`, `contexts/compliance/readiness-blockers.ts` (rule `plan`) |
| Application | `services/assignment-queue.ts`, `task-reconciler.ts`, `person-notifier.ts`, `project-health-service.ts`, `plan-delivery-service.ts`, `record-chunk-builder.ts` (`recordChunksFromPlan`); `use-cases/tasks/`, `health/`, `risks/`, `support/add-comment.ts`, `reporting/get-plan-story-suggestion.ts` |
| Infrastructure | `repositories/{tasks,reminders,health,risks,comment-targets}.ts`, `assignment-sources/`, migrations `20261019110000…130000`, `infra/postgres/rls.sql`, `infra/systemd/donordesk-reminders.*`, `scripts/run-reminders.sh` |
| API | `routes/tasks.ts` (assignments, team-work, tasks, owners, delivery-health, risk-trend, risks, notification preferences), `routes/internal.ts` (`/internal/reminders/run`), `routes/reporting.ts` (`GET /v1/reporting-periods/:id/plan-suggestion`), `routes/legal.ts` (consent) |
| Web | `features/tasks/`, `features/comments/presentation/CommentsDisclosure.tsx`, `features/workplan/`, `lib/actions/{tasks,workplan}.ts`, My Work, Team tab, Overview, Inputs → Story |
| Worker | `apps/workers/app/ai_reporter/{writer_contract,models,draft_writer}.py` (v6 rules, `ContextDeliveryPlan`, "Work plan for this period" block), mirror `llm/ai-reporter/contract.ts` |

## 4. Writer contract v6

v6 = v5 + three rules (state plan counts exactly as given; explain a move or cancellation only with a recorded reason, never name who led it or call it late/behind; say nothing about the plan when the block is absent) and a report-wide "Work plan for this period" block. Selected by `AI_REPORTER_CONTRACT_VERSION=6` (written by `runtime-provisioner.ts`; `deploy-fast.sh` restarts the worker when its environment differs). v2–v5 prompts are byte-stable; the TS mirror is pinned by `test_ts_contract_mirror_is_string_identical`; the counts are grounded by the generic request walk (`test_delivery_plan_block_appears_only_when_sent_and_its_counts_are_grounded`, `number-grounding.test.mjs`).

## 5. Deviations from the plan (recorded)

- "Behind target" is **not** a health signal (it would duplicate the per-period analytics).
- The Dashboard cards still use the old `loadWorkItems`; *My Work* uses the new queue.
- `/internal/reminders/deadline` is kept as a thin deprecated alias.
- Risks live on the project Overview only (no portfolio risk page).
- The reminders script is installed by hand (not shipped by `deploy-fast.sh`).
- 28.9 readiness advice is one rule worth 1 point so it can never move a score.

## 6. Tests

Domain (`tasks`, `reminders`, `collection-health`, `risks`, `commentable`, `plan-delivery`), application (`tasks-handlers`, `reminders-handler`, `health-handlers`, `risk-handlers`, `comment-handler`, `plan-delivery`, assignment-source contract), infrastructure (opt-in Postgres: tasks, reminders repositories), contracts (consent), worker (v6 rules, plan block, mirror), web unit (workplan view, risk view, collection view, server/client boundary), architecture boundaries. Counts at deploy: domain 624, application 561, infrastructure 402 (343 pass, 59 DB tests skipped without `WORKPLAN_VERIFY_DATABASE_URL`), contracts 14, web 318, worker 212.

## 7. Found in demo 9 (see `../demo/verification-demo-9.md`)

Consent from the invite page was rejected silently (fixed), plan-link suggestions ignored the typed title (fixed), "files we will need" history wording (fixed); open items are listed there and in `../pending.md`.
