# Feature 9: Activity Update Capture

## Overview

Field officers and project staff can submit activity updates with participant data, achievements, challenges, and attached evidence.

## Specification (from MVP-features.md)

### Create Activity Update
Fields:
- Project
- Reporting period
- Activity title
- Activity date
- Location
- Related output
- Related indicator
- Participants reached
- Male participants
- Female participants
- Children reached
- Persons with disabilities reached (optional)
- Other disaggregation (optional)
- Summary of activity
- Key achievements
- Challenges
- Lessons learned
- Next steps
- Attachments
- Submitted by

### Draft and Submit Statuses
- Draft
- Submitted
- Needs revision
- Accepted
- Rejected

### AI Writing Assistance
AI can help convert rough notes into:
- Clean activity summary
- Donor-friendly narrative
- Achievement paragraph
- Challenge paragraph
- Lessons learned paragraph

User must review and approve AI output.

### Link Activity Update to Evidence
Each activity update can have multiple evidence files attached.

## Implementation Technical Details

### Data Model

**ActivityUpdate Entity** (`packages/domain/src/entities/ActivityUpdate.ts`):
- `id: string`
- `tenantId: string`
- `projectId: string`
- `reportingPeriodId: string | null`
- `activityTitle: string`
- `activityDate: Date`
- `location: string | null`
- `outputId: string | null`
- `indicatorId: string | null`
- `participantsTotal: number | null`
- `participantsMale: number | null`
- `participantsFemale: number | null`
- `participantsChildren: number | null`
- `participantsDisability: number | null`
- `otherDisaggregationJson: Record<string, any> | null`
- `summary: string | null`
- `achievements: string | null`
- `challenges: string | null`
- `lessonsLearned: string | null`
- `nextSteps: string | null`
- `status: ActivityUpdateStatus`
- `submittedById: string`
- `createdAt: Date`
- `updatedAt: Date`

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/activity-updates` | `listActivityUpdates` |
| POST | `/api/activity-updates` | `createActivityUpdate` |
| GET | `/api/activity-updates/:id` | `getActivityUpdate` |
| PATCH | `/api/activity-updates/:id` | `updateActivityUpdate` |
| DELETE | `/api/activity-updates/:id` | `deleteActivityUpdate` |
| POST | `/api/activity-updates/:id/submit` | `submitActivityUpdate` |
| POST | `/api/activity-updates/:id/ai-polish` | `polishActivityNarrative` |
| GET | `/api/activity-updates/:id/evidence` | `getActivityEvidence` |
| POST | `/api/activity-updates/:id/evidence` | `linkEvidenceToActivity` |

### AI Polishing Handler
- Location: `packages/infrastructure/src/ai/handlers/activityPolisher.ts`
- Currently stub implementation (per `memorybank/pending.md`)

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Activity Update CRUD | Implemented | Full lifecycle |
| Participant Disaggregation | Implemented | Male/Female/Children/Disability |
| Draft/Submit Flow | Implemented | Status transitions |
| Evidence Linking | Implemented | Many-to-many relationship |
| AI Polishing | Stub | InMemoryJobQueue |
| Review Workflow | Implemented | Needs revision/Accepted/Rejected |

## Pending Enhancements

- [ ] Wire real LLM provider for AI polishing
- [ ] Bulk activity update import
- [ ] Recurring activity templates
- [ ] Activity calendar view
- [ ] Activity vs indicator mapping suggestions
- [ ] Photo gallery view for activity evidence
- [ ] Activity comparison across periods
- [ ] Export activity data to Excel

## Notes

Activity updates are linked to reporting periods and can have multiple evidence files. The `submittedById` tracks the user who submitted, but field officers can edit their own drafts before submission.
