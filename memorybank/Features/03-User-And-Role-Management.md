# Feature 3: User and Role Management

## Overview

Admin users can invite users, assign roles, manage project assignments, and control user statuses.

## Specification (from MVP-features.md)

### User Roles

| Role | Key Capabilities |
|------|-----------------|
| Admin | Full access: create org, invite users, manage projects, billing, audit logs |
| Project Manager | Create/edit projects, review activities, approve reports, export |
| M&E Officer | Create logframe, add indicators, verify evidence, review data quality |
| Grants/Reporting Officer | Upload templates, generate drafts, edit reports, export |
| Field Officer | Submit activity updates, upload evidence, view own submissions |
| Compliance/Finance Officer | Upload compliance docs, verify finance evidence, export compliance pack |

### Invite Users
Fields:
- Email address
- Role
- Assigned project(s)

### User Statuses
- Invited
- Active
- Suspended
- Removed

## Implementation Technical Details

### Data Model

**User Entity** (`packages/domain/src/entities/User.ts`):
- `id: string`
- `organizationId: string`
- `tenantId: string`
- `name: string`
- `email: string`
- `passwordHash: string`
- `role: UserRole`
- `status: UserStatus`
- `lastLoginAt: Date | null`
- `createdAt: Date`
- `updatedAt: Date`

**UserProjectAssignment Entity**:
- `userId: string`
- `projectId: string`
- `assignedAt: Date`

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/users` | `listUsers` |
| POST | `/api/users/invite` | `inviteUser` |
| GET | `/api/users/:id` | `getUser` |
| PATCH | `/api/users/:id` | `updateUser` |
| DELETE | `/api/users/:id` | `deactivateUser` |
| POST | `/api/users/:id/reactivate` | `reactivateUser` |
| GET | `/api/users/:id/projects` | `getUserProjects` |
| POST | `/api/users/:id/projects` | `assignUserToProject` |

### Permission Matrix

Implemented via `packages/application/src/permissions/`:
- `canManageUsers()` - Admin only
- `canInviteUsers()` - Admin only
- `canAssignProjects()` - Admin only
- `canViewProject(user, project)` - Project members or Admin
- `canEditProject(user, project)` - Project Manager or Admin

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| User Invitation | Implemented | Email invitation flow stub |
| Role Assignment | Implemented | Roles defined and enforced |
| Project Assignment | Implemented | Per-user project assignments |
| User Status | Implemented | Invited/Active/Suspended/Removed |
| Permission Checks | Implemented | Role-based access control |
| Audit Logging | Implemented | User changes logged |

## Pending Enhancements

- [ ] Email invitation delivery (currently stub)
- [ ] Bulk user import (CSV)
- [ ] Role templates/custom roles
- [ ] Session management (concurrent sessions, timeout)
- [ ] User activity tracking dashboard
- [ ] Password policy enforcement
- [ ] Two-factor authentication

## Notes

User role changes are logged in the audit log per architecture rules. All API mutations write to `audit_events`.
