# Feature 13: Review and Approval Workflow

## Overview

Multi-stage review workflow with comments, approvals, and role-based verification.

## Specification (from MVP-features.md)

### Review Flow
1. Draft created
2. Internal review requested
3. Reviewer comments
4. Revisions made
5. M&E verification
6. Compliance verification
7. Project Manager approval
8. Final export
9. Submitted externally
10. Closed

### Comments
Users can comment on:
- Report sections
- Evidence files
- Indicator updates
- Checklist items
- Activity updates

Comment fields: Comment text, Author, Date, Mentioned user, Status
Comment statuses: Open, Resolved

### Approval Roles
- M&E Officer approves indicator data
- Compliance Officer approves compliance evidence
- Project Manager approves final report
- Grants Officer prepares final export

### Final Approval Checks
- All required report sections completed
- Critical checklist items resolved or accepted
- Indicator updates verified
- Required evidence attached
- Sensitive files reviewed
- Final approver selected

## Implementation Technical Details

### Data Model

**Comment Entity** (`packages/domain/src/entities/Comment.ts`):
- `id: string`
- `tenantId: string`
- `entityType: 'report_section' | 'evidence_file' | 'indicator_update' | 'checklist_item' | 'activity_update'`
- `entityId: string`
- `commentText: string`
- `authorId: string`
- `mentionedUserId: string | null`
- `status: CommentStatus`
- `createdAt: Date`
- `updatedAt: Date`

**ApprovalRecord Entity**:
```typescript
interface ApprovalRecord {
  id: string;
  tenantId: string;
  entityType: 'report' | 'indicator_update' | 'evidence' | 'checklist';
  entityId: string;
  approverId: string;
  status: 'approved' | 'rejected' | 'changes_requested';
  comments: string | null;
  approvedAt: Date;
}
```

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/comments` | `listComments` |
| POST | `/api/comments` | `createComment` |
| PATCH | `/api/comments/:id` | `updateComment` |
| DELETE | `/api/comments/:id` | `deleteComment` |
| POST | `/api/comments/:id/resolve` | `resolveComment` |
| POST | `/api/comments/:id/mention` | `mentionUser` |
| POST | `/api/reports/:id/request-review` | `requestReportReview` |
| POST | `/api/reports/:id/approve` | `approveReport` |
| POST | `/api/reports/:id/reject` | `rejectReport` |
| POST | `/api/indicators/:id/verify` | `verifyIndicator` |
| POST | `/api/evidence/:id/verify` | `verifyEvidence` |
| GET | `/api/reports/:id/approval-history` | `getApprovalHistory` |

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Comment CRUD | Implemented | Full lifecycle |
| Comment Resolution | Implemented | Open/Resolved |
| User Mentions | Implemented | Notification trigger |
| Report Review Flow | Implemented | Request/Approve/Reject |
| Indicator Verification | Implemented | M&E role; per-row Submit & verify in the data-entry grid (2026-08-16) |
| Evidence Verification | Implemented | Compliance role |
| Approval History | Implemented | Audit trail |
| Final Approval | Implemented | PM role |

## Indicator verification (2026-08-16)

Indicator updates move DRAFT → SUBMITTED → VERIFIED via `submit()` + `verify()`
on the `IndicatorUpdate` aggregate (`POST /v1/indicator-updates/:id/verify`,
permission `indicator.verify`). The per-period entry grid
(`/projects/[id]/reports/[periodId]/indicators`) offers a per-row **Submit &
verify** action, shows status badges (Draft/Submitted/Verified/Needs correction/
Rejected), and locks verified rows against edits in both the UI and the bulk
upsert handler. `NEEDS_CORRECTION`/`REJECTED` transitions are still domain-only
(no dedicated API routes yet — see `pending.md`).

## Pending Enhancements

- [ ] Email notifications for mentions
- [ ] Comment threading/responses
- [ ] Comment templates
- [ ] Review deadline tracking
- [ ] Automated reminders for pending reviews
- [ ] Approval delegation
- [ ] Bulk approval operations
- [ ] Review analytics dashboard
- [ ] External reviewer access (donor portal)

## Notes

All approval actions are logged to `audit_events` per architecture rules. Every API mutation writes to `audit_events`.

Report approval is required before export. The approval score (10% weight) factors into the readiness score.
