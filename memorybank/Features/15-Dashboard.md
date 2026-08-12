# Feature 15: Dashboard

## Overview

Organization and project dashboards with actionable metrics, KPIs, and readiness scores.

## Specification (from MVP-features.md)

### Main Dashboard Cards
- Active projects
- Reports due soon
- Reports overdue
- Missing evidence items
- Pending reviews
- Draft reports
- Submitted reports
- High-risk compliance gaps

### Project Dashboard Cards
- Report readiness score
- Evidence completeness
- Indicator verification status
- Checklist status
- Recent uploads
- Open comments
- Upcoming deadlines
- Assigned tasks

### Report Readiness Score
Calculated from:
- Required sections completed (25%)
- Indicators updated (20%)
- Required evidence attached (25%)
- Checklist items resolved (20%)
- Approval workflow completed (10%)

### Example Display
**Monthly Report: 76% Ready**
Breakdown:
- Sections: 80%
- Indicators: 70%
- Evidence: 75%
- Compliance: 65%
- Review: 90%

## Implementation Technical Details

### Dashboard Response Types

```typescript
interface OrganizationDashboard {
  activeProjects: number;
  reportsDueSoon: ReportingPeriod[];
  reportsOverdue: ReportingPeriod[];
  missingEvidenceItems: number;
  pendingReviews: number;
  draftReports: number;
  submittedReports: number;
  highRiskComplianceGaps: ChecklistItem[];
}

interface ProjectDashboard {
  readinessScore: ReportReadinessScore;
  evidenceCompleteness: EvidenceCompleteness;
  indicatorStatus: IndicatorVerificationSummary;
  checklistStatus: ChecklistSummary;
  recentUploads: EvidenceFile[];
  openComments: Comment[];
  upcomingDeadlines: Deadline[];
  assignedTasks: Task[];
}

interface ReportReadinessScore {
  overall: number;
  sections: number;
  indicators: number;
  evidence: number;
  compliance: number;
  approval: number;
}
```

### Workspace Health Ring
SVG conic-gradient ring computing derived health score from:
- Active projects
- On-track ratio
- Average days remaining

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/dashboard` | `getOrganizationDashboard` |
| GET | `/api/projects/:id/dashboard` | `getProjectDashboard` |
| GET | `/api/reporting-periods/:id/dashboard` | `getReportingPeriodDashboard` |

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Org Dashboard | Implemented | Redesigned 2026-08-12 |
| Project Dashboard | Implemented | All cards |
| Readiness Score | Implemented | Weighted formula |
| Evidence Completeness | Implemented | Metric tracking |
| Indicator Status | Implemented | Verification summary |
| Checklist Status | Implemented | Summary counts |
| Compliance Gaps | Implemented | High-risk items |
| Dark Theme | Implemented | Glassmorphism + gradients |

## Pending Enhancements

- [ ] Customizable dashboard widgets
- [ ] Date range filtering
- [ ] Comparative metrics (vs previous period)
- [ ] Trend charts over time
- [ ] Export dashboard as PDF
- [ ] Scheduled dashboard email
- [ ] Team performance metrics
- [ ] Storage usage visualization
- [ ] Project health scoring algorithm refinement

## Notes

The dashboard was redesigned with dark theme on 2026-08-12 (release `20260812163749`) featuring glassmorphism, ambient glow, and tech-grid backdrop.

Every page should answer: "What needs attention now?" per usability requirements.
