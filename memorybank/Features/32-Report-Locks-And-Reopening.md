# Feature 32: Report locks and reopening — approved figures do not change under a report

**DonorDesk Version 2.006**

**Author:** Claude (agent) · **Date:** 2026-10-21
**Status:** Built, tested and deployed 2026-10-20 (batch 3, audit finding H-4; CG-08). Browser check pending. Builds on [Feature 10](10-Reporting-Period-Manager.md) and [Feature 13](13-Review-And-Approval-Workflow.md).

## 1. What a user gets

| In plain words | Where it shows |
|---|---|
| Once a report is **approved, submitted or closed**, its indicator figures for that period cannot be changed | Indicator entry grid: a notice "This report's figures are locked", and the fields are read-only |
| The way to correct a locked figure is to **reopen the report**. You are asked why; the reason and who reopened it are kept | Report page → reopen (existing, audited) |
| If someone tries anyway, the message says what to do | Grid save, single-value save, verification and imports |

Before this, approval locked nothing: a value could still change after the report was approved.

## 2. Rules that matter

- **One rule for "locked"** (`isPeriodLocked`, domain): APPROVED, SUBMITTED and CLOSED. Every write path checks it: the grid save, the single-value create, verification and the data-sheet import.
- **Earlier statuses are open.** A report being drafted or in review can still change.
- **The screen mirrors the server.** The inputs page reads the same statuses to disable editing; the server remains the authority.
- **Reopening** is the only way back, and it is audited with the reason and the previous approval (`report.draft.reopened`).

## 3. Where it lives

| Layer | Path |
|---|---|
| Domain | `contexts/reporting/period-lock.ts` (`isPeriodLocked`, `periodLockedMessage`) |
| Application | `use-cases/logframe/bulk-upsert-indicator-updates.ts`, `create-indicator-update.ts`, `verify-period-indicator-updates.ts`; `use-cases/data-center/data-sheet.ts` (locked flag) |
| Web | `app/(portal)/projects/[id]/reports/[periodId]/inputs/page.tsx` (notice and disabled grid) |

## 4. Limits

- Locking is by report status. An indicator value entered *before* approval and later found to be wrong is corrected by reopening; there is no separate correction request for a single value yet.
- Reopening does not re-verify the framework version (see [Feature 26](26-Logframe-Versioning.md)).
