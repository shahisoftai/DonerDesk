# Feature 42: Demo project with a first quarter

**DonorDesk Version 2.007** · **Shipped:** 2026-10-21, release `20261021054800` (first quarter); delete-by-foreign-keys fix in `20261021062305` · **Audit:** UX-03 (§16)

The guided tour's demo project ("Community Nutrition Programme (Demo)") now arrives with something to report on, instead of an empty project.

## 1. What is created

- The project starts **three months before today** (1st of that month, a year long), so its first quarter has just ended.
- The usual framework, indicators and donor template (unchanged).
- **Set-up is confirmed**, then one **quarterly reporting period** for the first quarter, with a deadline 14 days from today or 30 days after the quarter ends, whichever is later.
- **Verified values** for the two demo indicators (IND-1: 1,320 children screened; IND-2: 78 treatment completions), each with a source line.
- **Two accepted activity records** (a screening drive with 640 children; refresher training with 24 health workers).

## 2. Rules that matter

- **Best effort.** If a step is refused, the demo still exists, just emptier; the reason comes back in `contentNote` and is not shown as an error.
- **Same handlers as a person's actions.** The seeder calls the real period, value, verification and activity handlers, so the demo obeys the same rules (set-up, locks, evidence policy).
- **Idempotent.** Asking again returns the same demo.
- **Delete follows the database's foreign keys** (`PrismaDemoProjectRepository`): children first, one transaction. The old hand-kept list missed report revisions and failed once a report had been generated.

Code: `packages/application/src/services/demo-content-seeder.ts`, `packages/application/src/use-cases/projects/create-demo-project.ts`, `packages/infrastructure/src/repositories/demo.ts`. Tests: `packages/application/test/demo-content-seeder.test.mjs`, `packages/infrastructure/test/journey/demo-project.test.mjs` (real stack: `UOW_VERIFY_DATABASE_URL`).

## 3. Left over

- The demo has no evidence files, no drafted report and no changes of plan; the tour covers those steps.
- Figures are fixed sample values; they are not tied to a donor template's real indicators.
