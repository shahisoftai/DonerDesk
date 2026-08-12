# Feature 4: Project Setup Module

## Overview

Users can create and manage donor-funded project workspaces with full metadata, team assignments, and project status tracking.

## Specification (from MVP-features.md)

### Create Project
Fields:
- Project title
- Project code
- Donor name
- Implementing organization
- Partner organization (optional)
- Country
- Province/region
- District/location
- Sector
- Project start date
- Project end date
- Total budget (optional)
- Reporting frequency
- Project description
- Primary contact person
- Project manager
- M&E focal person
- Grants/reporting focal person

Reporting frequency options: Monthly, Quarterly, Semi-annual, Annual, Final report, Custom

### Project Statuses
- Draft
- Active
- Paused
- Completed
- Archived

### Project Detail Page Tabs
- Overview
- Logframe
- Activities
- Evidence
- Reports
- Compliance
- Team
- Settings

### Project Overview Displays
- Project status
- Project duration
- Days remaining
- Current reporting period
- Next report deadline
- Report readiness score
- Indicator progress summary
- Evidence completeness summary
- Compliance gaps
- Recent updates

## Implementation Technical Details

### Data Model

**Project Entity** (`packages/domain/src/entities/Project.ts`):
- `id: string`
- `tenantId: string`
- `organizationId: string`
- `title: string`
- `projectCode: string`
- `donorName: string`
- `implementingOrganization: string`
- `partnerOrganization: string | null`
- `country: string`
- `region: string | null`
- `district: string | null`
- `sector: string`
- `startDate: Date`
- `endDate: Date`
- `budget: number | null`
- `reportingFrequency: ReportingFrequency`
- `description: string | null`
- `status: ProjectStatus`
- `projectManagerId: string | null`
- `meOfficerId: string | null`
- `reportingOfficerId: string | null`
- `createdAt: Date`
- `updatedAt: Date`

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/projects` | `listProjects` |
| POST | `/api/projects` | `createProject` |
| GET | `/api/projects/:id` | `getProject` |
| PATCH | `/api/projects/:id` | `updateProject` |
| DELETE | `/api/projects/:id` | `deleteProject` |
| GET | `/api/projects/:id/overview` | `getProjectOverview` |
| GET | `/api/projects/:id/dashboard` | `getProjectDashboard` |

### Project Dashboard Response

```typescript
interface ProjectDashboard {
  status: ProjectStatus;
  duration: { start: Date; end: Date; daysRemaining: number };
  currentReportingPeriod: ReportingPeriod | null;
  nextReportDeadline: Date | null;
  readinessScore: ReportReadinessScore;
  indicatorProgress: IndicatorProgressSummary;
  evidenceCompleteness: EvidenceCompletenessSummary;
  complianceGaps: ComplianceGap[];
  recentUpdates: ActivityUpdate[];
}
```

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Project CRUD | Implemented | Full create/read/update/delete |
| Project Status | Implemented | Draft/Active/Paused/Completed/Archived |
| Project Overview | Implemented | Dashboard with all metrics |
| Tab Navigation | Implemented | All tabs functional |
| Team Assignments | Implemented | PM, M&E, Grants focal points |
| Project Settings | Implemented | Basic settings page |
| Project Archive | Not implemented | Soft delete only |

## Pending Enhancements

- [ ] Project archive/restore functionality
- [ ] Project copy/duplicate
- [ ] Project template library
- [ ] Partner organization management
- [ ] Project-level notification settings
- [ ] Project milestones/timeline view
- [ ] Budget tracking vs actuals
- [ ] Cross-project reporting

## Notes

The readiness score formula per MVP spec:
```
Readiness Score = Sections Score × 0.25 + Indicator Score × 0.20 + Evidence Score × 0.25 + Checklist Score × 0.20 + Approval Score × 0.10
```
