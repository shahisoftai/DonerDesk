# Feature 2: Organization Workspace

## Overview

Each organization has a workspace with a profile and dashboard displaying key metrics, active projects, upcoming reports, and recent activity.

## Specification (from MVP-features.md)

### Organization Profile
Fields:
- Organization name
- Organization logo
- Organization type
- Country
- Main office location
- Sectors
- Contact person
- Contact email
- Website
- Donor types served
- Default language

### Organization Dashboard
Displays:
- Active projects
- Upcoming reports
- Reports due this month
- Missing evidence items
- Pending evidence reviews
- Draft reports
- Completed reports
- Storage usage
- Recent activity

## Implementation Technical Details

### Data Model

**Organization Entity** (`packages/domain/src/entities/Organization.ts`):
- `id: string`
- `tenantId: string`
- `name: string`
- `logoUrl: string | null`
- `organizationType: string`
- `country: string`
- `mainOfficeLocation: string | null`
- `sectors: string[]`
- `contactName: string`
- `contactEmail: string`
- `website: string | null`
- `donorTypesServed: string[]`
- `defaultLanguage: string`
- `storageUsedBytes: number`
- `storageLimitBytes: number`
- `createdAt: Date`
- `updatedAt: Date`

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/organizations/:id` | `getOrganization` |
| PATCH | `/api/organizations/:id` | `updateOrganization` |
| GET | `/api/organizations/:id/dashboard` | `getOrganizationDashboard` |

### Dashboard Metrics Calculation

```typescript
interface OrganizationDashboard {
  activeProjects: number;
  upcomingReports: Report[];
  reportsDueThisMonth: number;
  missingEvidenceItems: number;
  pendingEvidenceReviews: number;
  draftReports: number;
  completedReports: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  recentActivity: ActivityEvent[];
}
```

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Organization Profile | Implemented | Basic CRUD complete |
| Profile Update | Implemented | PATCH endpoint exists |
| Dashboard | Implemented | Redesigned with dark theme (2026-08-12) |
| Storage Tracking | Partial | Basic tracking, limits not enforced |
| Multi-tenancy | Implemented | RLS policies on all tenant tables |

## Pending Enhancements

- [ ] Storage quota enforcement and UI warnings
- [ ] Organization logo upload to object storage
- [ ] Donor types served configuration
- [ ] Dashboard widgets customization
- [ ] Organization-level activity feed
- [ ] Organization settings for notification preferences

## Notes

Per `memorybank/pending.md`, the RLS grants and policies were applied manually during the 2026-08-12 fix and should be baked into the deployment runbook.
