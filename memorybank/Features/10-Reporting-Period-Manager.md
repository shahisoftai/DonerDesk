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

The reporting period is the central context for report generation. All evidence, activity updates, and indicator updates are associated with a reporting period.
