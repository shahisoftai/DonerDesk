# Feature 12: Missing Evidence and Compliance Checklist

## Overview

System compares donor requirements against available evidence and generates checklist items for missing or weak documentation.

## Specification (from MVP-features.md)

### Checklist Purpose
Compares donor template requirements, logframe means of verification, activity records, and uploaded evidence.

### Checklist Item Types
- Missing evidence
- Incomplete evidence metadata
- Unverified indicator
- Unsupported report claim
- Missing annex
- Missing procurement document
- Missing approval
- Missing disaggregation
- Late activity update
- Sensitive data warning
- Unreviewed AI output

### Checklist Item Fields
- Project
- Reporting period
- Checklist item title
- Description
- Related donor requirement
- Related activity
- Related indicator
- Severity
- Assigned to
- Due date
- Status
- Resolution notes

### Severity Levels
Low, Medium, High, Critical

### Checklist Statuses
Open, In progress, Resolved, Accepted risk, Not applicable

### Example Items
- Attendance sheet missing for caregiver training on 12 July
- Indicator NUT-03 updated but no supporting evidence attached
- Distribution photos uploaded but not linked to activity
- Procurement approval missing for nutrition supplies
- Beneficiary list contains personal data and needs restricted access
- Donor annex table incomplete
- Report paragraph has no source evidence

## Implementation Technical Details

### Data Model

**ChecklistItem Entity** (`packages/domain/src/entities/ChecklistItem.ts`):
- `id: string`
- `tenantId: string`
- `projectId: string`
- `reportingPeriodId: string | null`
- `type: ChecklistItemType`
- `title: string`
- `description: string | null`
- `severity: Severity`
- `relatedEntityType: string | null`
- `relatedEntityId: string | null`
- `assignedToId: string | null`
- `dueDate: Date | null`
- `status: ChecklistStatus`
- `resolutionNotes: string | null`
- `createdAt: Date`
- `updatedAt: Date`

### AI Detector Handler
- Location: `packages/infrastructure/src/llm/checklist-detector.ts`
- Orchestration (2026-08-13, deployed): checklist generation is a real scheduled
  entry point — `POST /internal/checklist/generate` → `GenerateChecklistHandler`
  → `DetectMissingEvidenceHandler` (creates checklist items). The `checklist.generate`
  job exists in the wired job queue (memory/BullMQ/Kestra via `JOB_QUEUE`).

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/projects/:projectId/checklist` | `listChecklistItems` |
| GET | `/api/reporting-periods/:id/checklist` | `getReportingPeriodChecklist |
| POST | `/api/reporting-periods/:id/checklist/generate` | `generateChecklist` |
| POST | `/api/checklist-items` | `createChecklistItem` |
| GET | `/api/checklist-items/:id` | `getChecklistItem` |
| PATCH | `/api/checklist-items/:id` | `updateChecklistItem` |
| DELETE | `/api/checklist-items/:id` | `deleteChecklistItem` |
| POST | `/api/checklist-items/:id/resolve` | `resolveChecklistItem` |
| POST | `/api/checklist-items/:id/accept-risk` | `acceptRisk` |
| POST | `/api/checklist-items/:id/not-applicable` | `markNotApplicable` |

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Checklist CRUD | Implemented | Full lifecycle |
| Severity Levels | Implemented | Low/Medium/High/Critical |
| Status Transitions | Implemented | All 5 statuses |
| AI Detection | Implemented (rule-based) | `DetectMissingEvidenceHandler`; dedupe by (type, entity) |
| Assignment | Implemented | Assign to user |
| Due Dates | Implemented | Optional tracking |
| Resolution Notes | Implemented | For accepted risk |
| Automated Generation | Implemented | On period start via `reporting.period.created` → `checklist.generate` job (2026-08-16) |
| Checklist Templates | Implemented | Config-driven baseline items per report type (2026-08-16) |
| Bulk Operations | Implemented | `POST /checklist/bulk-resolve` + UI (2026-08-16); "Select all" header checkbox in bulk mode selects all open items matching the current filters, with indeterminate + `(selected/total)` states (2026-08-28, release `20260828124537`) |

## Product recovery (2026-08-30, release `20260829160000`)

See `../imp/RECOVERY-PLAN-IMPLEMENTATION.md` for the full record. Changes to
this feature:

- **Idempotent projection:** `ChecklistUnsupportedClaimProjector` dedups against
  **all** `UNSUPPORTED_REPORT_CLAIM` items ever created for the period (open or
  resolved), so accepting a claim is a permanent decision and edits /
  regenerations never recreate resolved items. Regression test added.
- **Human-readable verification detail:** numeric failure detail now explains
  expected vs actual in plain language (e.g. percentage claims cite the missing
  denominator + indicator codes), instead of bare reason codes.
- **Claim resolution moved into the report workspace:** per-statement
  Accept-with-note / Exclude actions plus an aggregated Review view, so users
  resolve failed statements where they review them rather than in the export
  wizard.
- **Actionable approval blockers:** report/section approval errors name the
  blocker and the fix (statement decisions, verification fixes) in human
  language — no CURRENT/FAILED/STALE/UNASSESSED terms in the UI.
- **Evidence readiness score** (`calculate-readiness.ts`) now counts the union
  of evidence tagged to the period + evidence attached to its indicator updates
  + its activity updates (the same set the generation run consumes), so the
  "Evidence" readiness component reflects what actually supports the report.

## Per-report-type checklists (2026-10-03)

`checklist-template.ts` now gives `SITUATION` its own template (baseline + "Situation sources attached" + "Situation figures
verified and approved"). For `ACTIVITY` periods `DetectMissingEvidenceHandler` adds one `MISSING_EVIDENCE` item per scoped
activity with no attached evidence (`relatedEntityType: "activity"`, `relatedEntityId` = activity id, so dedupe is per activity).
Activity counts for readiness/detection come from `resolvePeriodActivities`. See Feature 10 "Report types & scope".

## Pending Enhancements

- [ ] Wire real LLM provider for detection
- [ ] Real-time checklist updates as evidence uploaded (event-driven re-check)
- [ ] Checklist email notifications
- [ ] Dashboard widget for critical items
- [ ] Checklist analytics/trends
- [ ] Link to specific donor requirement documents

## Notes

Per `memorybank/pending.md`, the AI checklist detector uses a stub. Critical checklist items must be resolved or accepted before final export.

Dashboard displays "High-risk compliance gaps" as a key metric.
