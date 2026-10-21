# Feature 41: Management report and changes of plan

**DonorDesk Version 2.007** · **Shipped:** 2026-10-21, release `20261021075101` · **Audit:** RP-05, PM-09 (§17)

## 1. Management report

One page per project (`/projects/:id/management-report`, linked from Reports) and a CSV download. Six sections, each with a sentence and a table:

| Section | Shows |
|---|---|
| Project | Title, code, donor, country, sector, dates, status |
| Delivery | Standing, planned activities, late activities, values overdue, completed activities, accepted ones, people reached (accepted only) |
| Indicators | Target, latest cumulative value and its date, % of target, variance against the scheduled target, status. No value is "Not measured", never 0; rates have no % of target |
| Reports | Each period: type, status, deadline, days to deadline, readiness |
| Problems and risks | Open items with kind, seriousness, status, review date |
| Evidence | File counts by verification status |

The report only assembles what the product already knows; it does not compute new figures.

Code: `packages/domain/src/contexts/reporting/management-report.ts` (tables and CSV), `packages/application/src/use-cases/reporting/get-management-report.ts` (gathers facts), routes `GET /v1/projects/:id/management-report` and `…/export`, screen `apps/web/src/app/(portal)/projects/[id]/management-report/page.tsx`, CSV route `apps/web/src/app/api/projects/[id]/management-report/export/route.ts`. Tests: `packages/domain/test/management-report.test.mjs`, `packages/application/test/management-report.test.mjs`.

## 2. Changes of plan (adaptations)

A change of plan is recorded as a dated item: **what changed**, **why**, and optionally **the effect on results**, with optional links to the indicator and the report it touches.

- **Log:** `/projects/:id/adaptations` (newest first). Recording needs project membership with risk-raising rights.
- **Claim checks:** each dated change becomes a record statement ("On 2026-03-02: … The reason: … Effect on results: …") that a report's claim about a change of plan can be checked against. Records are never cited as evidence and never sent to the writer as instructions.
- **Links are checked:** an activity, indicator or report from another project is refused.
- **Corrections** change only what is sent; clearing the effect or a link empties it. Every edit is audited with the old and new text.

Code: `packages/domain/src/contexts/projects/adaptation.ts`, `packages/application/src/use-cases/projects/adaptations.ts`, `packages/application/src/services/record-chunk-builder.ts` (`recordChunksFromAdaptations`), repository `packages/infrastructure/src/repositories/adaptations.ts`, table `ProjectAdaptation` (migration `20261022170000_project_adaptations`, forced RLS). Tests: `packages/domain/test/adaptation.test.mjs`, `packages/application/test/adaptations.test.mjs`.

## 3. Left over

- **No edit screen** for changes of plan (corrections through the API only).
- Records are not yet shown in the report text itself; they are available to claim checks.
- The management report has no PDF or Word version; CSV only.
- No scheduled delivery of the report (RP-05 remainder).
