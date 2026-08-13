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
| AI Detection | Implemented (rule-based) | `DetectMissingEvidenceHandler`; scheduled generate endpoint |
| Assignment | Implemented | Assign to user |
| Due Dates | Implemented | Optional tracking |
| Resolution Notes | Implemented | For accepted risk |

## Pending Enhancements

- [ ] Wire real LLM provider for detection
- [ ] Automated checklist generation on period start
- [ ] Real-time checklist updates as evidence uploaded
- [ ] Checklist item templates by donor type
- [ ] Bulk resolve/accept-risk operations
- [ ] Checklist email notifications
- [ ] Dashboard widget for critical items
- [ ] Checklist analytics/trends
- [ ] Link to specific donor requirement documents

## Notes

Per `memorybank/pending.md`, the AI checklist detector uses a stub. Critical checklist items must be resolved or accepted before final export.

Dashboard displays "High-risk compliance gaps" as a key metric.
