# Feature 10: Reporting Period Manager

## Overview

Manages reporting periods for projects with deadlines, templates, and status tracking.

## Specification (from MVP-features.md)

### Create Reporting Period
Fields:
- Project
- Report type (+ scope for Activity / Situation / Custom)
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
- `scopeJson: string` — `ReportScope` for ACTIVITY/SITUATION/CUSTOM (see "Report types & scope")
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

## Report types & scope (2026-10-03)

Report types: `MONTHLY`, `QUARTERLY`, `SEMI_ANNUAL` (new in the form), `ANNUAL`, `FINAL` (cadence — whole project, date
suggestions via `period-cadence.ts`) and `ACTIVITY`, `SITUATION`, `CUSTOM` (ad-hoc — manual dates, **scoped**).

Before this change the ad-hoc types were only a label: no way to say *which* activity/event, and generation used the type
just for the title. `ReportingPeriod.scopeJson` (migration `20261003100000_reporting_period_scope`, `TEXT NOT NULL DEFAULT '{}'`)
now stores a `ReportScope` (`packages/domain/src/contexts/reporting/report-scope.ts`):

| Type | Scope fields | Required |
|---|---|---|
| ACTIVITY | `activityIds[]` — project `ActivityUpdate` ids (any period) | ≥ 1 |
| SITUATION | `eventName`, `situationDate`, `location?`, `summary?` | eventName + situationDate |
| CUSTOM | `title`, `purpose?` | title |
| cadence types | — | — |

- **Validation:** `CreateReportingPeriodSchema` (`superRefine`, contracts) + `CreateReportingPeriodHandler` (`missingScopeFields`;
  ACTIVITY ids must belong to the project → `NOT_FOUND` otherwise). The handler takes an `IActivityUpdateRepository` (10th ctor arg).
- **Overlap rule:** enforced only between *cadence* periods (`CADENCE_REPORT_TYPES`); ad-hoc reports may sit inside a cadence period.
- **Activity resolution:** `resolvePeriodActivities` (`packages/application/src/services/period-activities.ts`) — ACTIVITY with a
  scope returns exactly the selected activities; everything else returns the period's own activity updates. Used by
  generation context, readiness evidence count and missing-evidence detection.
- **Writer:** `describeReportScope` → `PeriodGenerationContext.scope` (string) → legacy narrator (`- Report Scope:` line) and AI
  Reporter (`ContextPeriod.scope`, Python `models.py`; absent for cadence reports, so v2–v4 prompts stay byte-stable).
- **Checklist:** `SITUATION` has its own template (baseline + sources attached + figures approved); ACTIVITY gets a per-activity
  `MISSING_EVIDENCE` item (`relatedEntityType: "activity"`) for selected activities with no attached evidence.
- **UI:** `NewReportingPeriodForm` shows type-specific scope fields (activity checklist with filter / situation fields / custom
  title+purpose; scope resets on type change). `reportHeading()` (`apps/web/src/lib/labels.ts`) shows the custom title or
  "Situation report: <event>" in the reports list and editor heading. List API returns `scope`.
- **Deploy invariant:** `ReportingPeriod.scopeJson` is in `REQUIRED_PRISMA_FIELDS` (`health.ts`).
- **Tests:** `packages/domain/test/report-scope.test.mjs`; handler scope/overlap test in `packages/application/test/feature18-setup.test.mjs`.
- **Known limits:** no dedicated checklist item types per report type (reuses `MISSING_EVIDENCE`/`MISSING_APPROVAL`); scope is
  not editable after creation; indicator updates/findings for an ACTIVITY report are still period-based.

## Pending Enhancements

- [ ] Automated status transitions based on deadlines
- [ ] Reporting period templates for recurring schedules
- [ ] Period comparison view
- [ ] Auto-copy previous period data
- [ ] Notification on approaching deadlines
- [ ] Reporting calendar view across all projects
- [ ] Bulk period creation for quarterly/annual schedules
- [ ] Edit a period's scope after creation; scope-aware indicator findings for ACTIVITY reports

## Notes

The reporting period is the central context for report generation. All evidence, activity updates, and indicator updates are associated with a reporting period. Indicator data entry (2026-08-16) is a per-period spreadsheet grid — see "Indicator Data Entry" above.
