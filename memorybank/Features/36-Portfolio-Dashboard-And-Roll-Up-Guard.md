# Feature 36: Portfolio dashboard and double-count guard

**DonorDesk Version 2.007** · **Shipped:** 2026-10-21, release `20261021054800` (roll-up guard and dashboard) · **Audit:** PM-07, PM-08, ME-07 (§16)

## 1. What a person gets

| Feature | In plain words | Where it shows |
|---|---|---|
| Portfolio dashboard | Every live project you can see, one row each: delivery standing, open problems and risks, next report. Most pressing first | `/portfolio` (linked from Projects) |
| Totals | Projects, behind, need attention, open risks, serious risks, reports overdue | Tiles above the table |
| Indicators across projects | Verified values summed per donor and indicator code | `/portfolio/indicators` (existing roll-up, extended) |
| Counted elsewhere | Mark an indicator as "another project also counts these": it is listed under the group but not added | Indicator editor checkbox; roll-up row "counted by another project, not added" |
| Possible double count | Projects in the same country with overlapping dates, both counted, are named in a note | Roll-up group note |

## 2. Rules that matter

- **No combined score.** Each column says what it counts. The row order (`rankPortfolio`) only decides what to look at first: behind (off track) → need attention → no plan → on track, then overdue reports, then serious risks, then the nearest report, then title.
- **Delivery comes from the same service as the project card** (`ProjectHealthService`), so the two cannot disagree.
- **Archived and completed projects are left out.** Only ACTIVE, DRAFT and PAUSED projects appear.
- **The guard never changes a total by itself.** A possible double count is a warning. Only an explicit "counted elsewhere" mark removes a value from the total.
- **Visibility is the same as the project list:** a person sees only projects they are a member of.

## 3. Code map

| Layer | File |
|---|---|
| Rows, ranking, totals | `packages/domain/src/contexts/projects/portfolio-overview.ts` |
| Overlap and counted-elsewhere rules | `packages/domain/src/contexts/logframe/portfolio-rollup.ts` |
| Handler (reads, no writes) | `packages/application/src/use-cases/health/portfolio-overview.ts` |
| Route | `GET /v1/portfolio/overview` (`apps/api/src/routes/tasks.ts`) |
| Screen | `apps/web/src/app/(portal)/portfolio/page.tsx` |
| Persistence | `Indicator.countedElsewhere` (migration `20261022130000_indicator_counted_elsewhere`) |

Tests: `packages/domain/test/portfolio-overview.test.mjs`, `portfolio-rollup.test.mjs`; `packages/application/test/portfolio-overview.test.mjs`; `apps/web/tests/unit/project-portfolio.test.mts`.

## 4. Left over

- Roll-up dimensions beyond donor and code: no region or sector grouping (ME-07 remainder).
- No dashboard for a whole organisation's programmes (PM-08 remainder); programmes and grants are listed separately.
- The portfolio shows risks and delivery, not finance.
