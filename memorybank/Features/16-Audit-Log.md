# Feature 16: Audit Log

## Overview

Comprehensive logging of all important system events for accountability and troubleshooting.

## Specification (from MVP-features.md)

### Logged Events
- User login
- Project created/edited
- File uploaded/deleted
- Evidence metadata changed
- AI tags accepted/rejected
- Indicator updated
- Report generated/edited
- Checklist item resolved
- Approval completed
- Export generated
- User role changed

### Audit Log Fields
- Event type
- User
- Date/time
- Project
- Entity affected
- Old value (where relevant)
- New value (where relevant)
- IP address (optional)
- System note

### Audit Log Access
- Admin can view all logs
- Project Manager can view assigned project logs
- Other users have restricted access

## Implementation Technical Details

### Data Model

**AuditLog Entity** (`packages/domain/src/entities/AuditLog.ts`):
- `id: string`
- `tenantId: string`
- `organizationId: string | null`
- `projectId: string | null`
- `userId: string | null`
- `eventType: AuditEventType`
- `entityType: string | null`
- `entityId: string | null`
- `oldValueJson: Record<string, any> | null`
- `newValueJson: Record<string, any> | null`
- `ipAddress: string | null`
- `systemNote: string | null`
- `createdAt: Date`

### Event Types Enum

```typescript
type AuditEventType =
  | 'user_login'
  | 'user_logout'
  | 'user_invited'
  | 'user_role_changed'
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'file_uploaded'
  | 'file_deleted'
  | 'evidence_metadata_changed'
  | 'ai_tags_accepted'
  | 'ai_tags_rejected'
  | 'indicator_updated'
  | 'indicator_verified'
  | 'report_generated'
  | 'report_edited'
  | 'report_approved'
  | 'checklist_item_resolved'
  | 'export_generated'
  | 'comment_created'
  | 'approval_completed';
```

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/audit-logs` | `listAuditLogs` |
| GET | `/api/audit-logs/:id` | `getAuditLog` |
| GET | `/api/projects/:id/audit-logs` | `getProjectAuditLogs` |
| GET | `/api/audit-logs/export` | `exportAuditLogs` |

### Repository
- `packages/infrastructure/src/repositories/PrismaAuditRepository.ts`
- Uses outbox pattern wired via `record()` method

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Event Logging | Implemented | All event types |
| User/Project Context | Implemented | Full fields |
| Old/New Values | Implemented | JSON storage |
| IP Address | Implemented | Optional capture |
| Access Control | Implemented | Role-based view |
| Organization Logs | Implemented | Admin access |
| Project Logs | Implemented | PM access |
| Export | Implemented | CSV export |

## Pending Enhancements

- [ ] Real-time audit log streaming
- [ ] Audit log retention policies
- [ ] Anomaly detection/alerts
- [ ] Compliance report generation
- [ ] User activity summaries
- [ ] Bulk export with filters
- [ ] Dashboard widget for recent activity
- [ ] Integration with external SIEM

## Notes

Per architecture rules: Every API mutation writes to `audit_events`. The outbox pattern is wired in `PrismaAuditRepository.record()`.

RLS policies apply to audit logs - users see only permitted logs based on their role and project assignments.
