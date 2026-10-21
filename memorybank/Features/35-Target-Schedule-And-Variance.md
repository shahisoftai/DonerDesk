# Feature 35: Target schedule and variance

**DonorDesk Version 2.007** · **Shipped:** 2026-10-21, release `20261021054800` · **Audit:** ME-02, ME-11 (`../imp/product-gap-audit-2026-10-20.md` §16)

## 1. What a person gets

| Feature | In plain words | Where it shows |
|---|---|---|
| Target schedule | For an indicator, the cumulative target due by a date, e.g. `2026-06-30: 100`, one per line | Indicator page → "Target schedule (optional)" in the editor |
| Judged against what was due | A period is compared with the latest scheduled target dated on or before its end; before the first entry, the project target applies | Data Center grid, report figures |
| Variance | How far the figure is from the scheduled target, absolute and as a share: `-1 (-20%)` | Data Center → "Variance from scheduled target" |

## 2. Rules that matter

- **A schedule holds cumulative targets.** A SUM indicator's period total is compared through its cumulative figure. With no cumulative figure, no variance is shown.
- **Blank is not zero.** No recorded value means no variance. Rates (percentage/ratio) never get a variance.
- **The writer never sees it.** `periodTarget` and `variance` are judging fields only; the report writer's finding schema forbids extra fields, so they are not sent.
- **Bad lines are refused with their line number** (`Target schedule, line 2: …`). Dates must be real days, targets numeric, dates not repeated.
- **Versioned with the framework.** The schedule is part of the logframe snapshot, so a change to it appears in framework history.

## 3. Code map

| Layer | File |
|---|---|
| Domain rules (lookup, variance, text round-trip) | `packages/domain/src/contexts/logframe/target-schedule.ts` |
| Period judgement | `packages/domain/src/contexts/reporting/period-target.ts` (`withPeriodTarget`) |
| Data Center variance | `packages/domain/src/contexts/reporting/data-sheet.ts` (`cellVariance`, `VARIANCE` measure, charts excluded) |
| Persistence | `Indicator.targetScheduleJson` (migration `20261022120000_indicator_target_schedule`) |
| Editor | `apps/web/src/features/logframe/presentation/IndicatorManageCard.tsx` |

Tests: `packages/domain/test/target-schedule.test.mjs`, `period-target.test.mjs`, `data-sheet-variance.test.mjs`.

## 4. Left over

- No schedule import from a spreadsheet (the text box only).
- The report's narrative does not yet quote the variance sentence; figures appear in the Data Center and the management report only.
- Schedules are per indicator; there is no project-wide calendar of targets.
