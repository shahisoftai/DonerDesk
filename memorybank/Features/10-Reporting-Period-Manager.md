# Feature 10: Reporting Period Manager

## Overview

Manages reporting periods for projects with deadlines, templates, and status tracking.

## Specification (from MVP-features.md)

### Create Reporting Period
Fields:
- Project
- Report type
- Start date
- End date
- Report deadline
- Donor template
- Responsible reporting officer
- Internal review deadline
- Status

### Reporting Period Statuses
- Not started
- In progress
- Evidence collection
- Draft generated
- Under review
- Approved
- Submitted
- Closed

> **Canonical persisted values (2026-08-20):** the persisted `ReportingPeriod.status`
> must be one of the eight `ReportStatusValue`s enforced by
> `ReportStatus.create` (`packages/domain/src/value-objects/report-status.ts`):
> `NOT_STARTED`, `IN_PROGRESS`, `EVIDENCE_COLLECTION`, `DRAFT_GENERATED`,
> `UNDER_REVIEW`, `APPROVED`, `SUBMITTED`, `CLOSED`. Any other value (e.g.
> `COMPLETED`) throws `Invalid ReportStatus: …` in
> `PrismaReportingPeriodRepository.toDomain`, 500ing the Reports tab. Use
> `SUBMITTED` (or `CLOSED`) for a finished period. See `memorybank/Fixes.md`,
> 2026-08-20.

### Reporting Period Page
Displays:
- Report readiness score
- Required sections
- Indicator updates
- Evidence completeness
- Missing evidence
- Open review comments
- Draft report
- Export options

## Implementation Technical Details

### Data Model

**ReportingPeriod Entity** (`packages/domain/src/entities/ReportingPeriod.ts`):
- `id: string`
- `tenantId: string`
- `projectId: string`
- `donorTemplateId: string | null`
- `reportType: ReportType`
- `startDate: Date`
- `endDate: Date`
- `deadline: Date`
- `internalReviewDeadline: Date | null`
- `responsibleOfficerId: string | null`
- `status: ReportingPeriodStatus`
- `readinessScore: number | null`
- `createdAt: Date`
- `updatedAt: Date`

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/projects/:projectId/reporting-periods` | `listReportingPeriods` |
| POST | `/api/projects/:projectId/reporting-periods` | `createReportingPeriod` |
| GET | `/api/reporting-periods/:id` | `getReportingPeriod` |
| PATCH | `/api/reporting-periods/:id` | `updateReportingPeriod` |
| DELETE | `/api/reporting-periods/:id` | `deleteReportingPeriod` |
| GET | `/api/reporting-periods/:id/dashboard` | `getReportingPeriodDashboard` |
| POST | `/api/reporting-periods/:id/start` | `startReportingPeriod` |
| POST | `/api/reporting-periods/:id/submit` | `submitReportingPeriod` |
| POST | `/api/reporting-periods/:id/close` | `closeReportingPeriod` |

### Reporting Period Dashboard

```typescript
interface ReportingPeriodDashboard {
  readinessScore: ReportReadinessScore;
  requiredSections: TemplateSection[];
  indicatorUpdates: IndicatorUpdate[];
  evidenceCompleteness: EvidenceCompleteness;
  missingEvidence: ChecklistItem[];
  openComments: Comment[];
  draftReport: ReportDraft | null;
  exportOptions: ExportOption[];
}
```

### Indicator Data Entry (2026-08-16)

Indicator values are recorded **per reporting period**. A spreadsheet-style entry
grid lives at `/projects/[id]/reports/[periodId]/indicators` (linked from the
reports list, the report workspace header, and the project setup page):

- Rows are the project's logframe indicators grouped by level
  (Goal/Outcome/Output/Activity), loaded via `GET /v1/reporting-periods/:id/indicators`
  which merges each indicator with its existing update for the period.
- The grid saves drafts in one call via `POST /v1/indicator-updates/bulk`;
  a unique `(tenantId, indicatorId, reportingPeriodId)` constraint guarantees
  one update per indicator+period.
- Each row can be submitted and verified in place; verified rows are locked
  against edits, and a closed period rejects further writes.
- Google Sheets values can be imported via `POST /v1/indicator-updates/parse-sheet`
  (rows mapped by indicator code, previewed, then applied to the grid).
- **Percentage guard (2026-08-30):** PERCENTAGE/RATIO rows without a configured
  denominator indicator display a warning that their result cannot be
  independently verified in the report.

### Draft lifecycle — one working draft per period (2026-08-30, release `20260829160000`)

See `../imp/RECOVERY-PLAN-IMPLEMENTATION.md`:

- **Supersede:** `ReportDraft.supersededAt` (migration
  `20260829140000_report_draft_superseded`) — each generation supersedes prior
  DRAFT/UNDER_REVIEW drafts, so there is exactly one current working draft.
  Approved/exported/submitted drafts are never superseded (historical record).
  `findByReportingPeriod` orders superseded drafts last, so existing `[0]`
  consumers keep returning the current draft.
- **Versions archive UI:** the report workspace's **Versions** tab lists all
  drafts (status, created/superseded dates) with a **Make current** action for
  working drafts (`POST /v1/report-drafts/:id/activate` → `ActivateReportDraftHandler`,
  which supersedes the other working drafts in turn).
- **Cancel generation:** `POST /v1/reporting-periods/:id/cancel-generation`
  supersedes the working draft; the background section loop aborts on the
  superseded marker. Non-working (approved/etc.) drafts return
  `{cancelled:false}` without error.
- **"What to do next":** the workspace sidebar computes the single next action
  (verify indicators → generate draft → review statements → approve sections →
  submit → approve) in plain language, linking to the exact fix location.

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Period CRUD | Implemented | Full lifecycle |
| Status Transitions | Implemented | All 8 statuses |
| Dashboard | Implemented | All metrics displayed |
| Template Association | Implemented | Links to donor template |
| Officer Assignment | Implemented | Responsible officer |
| Deadline Tracking | Implemented | Visual indicators |

## Pending Enhancements

- [ ] Automated status transitions based on deadlines
- [ ] Reporting period templates for recurring schedules
- [ ] Period comparison view
- [ ] Auto-copy previous period data
- [ ] Notification on approaching deadlines
- [ ] Reporting calendar view across all projects
- [ ] Bulk period creation for quarterly/annual schedules

## Notes

The reporting period is the central context for report generation. All evidence, activity updates, and indicator updates are associated with a reporting period. Indicator data entry (2026-08-16) is a per-period spreadsheet grid — see "Indicator Data Entry" above.
