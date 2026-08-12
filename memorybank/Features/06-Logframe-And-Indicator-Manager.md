# Feature 6: Logframe and Indicator Manager

## Overview

Users can create, upload, or AI-structure project logframes with Goals, Outcomes, Outputs, Activities, and Indicators.

## Specification (from MVP-features.md)

### Logframe Creation Options
- Upload logframe file (XLSX, CSV, DOCX, PDF, TXT)
- Import from Excel/CSV
- Manually create logframe
- Use AI to structure pasted logframe text

### Logframe Structure
Supports: Goal, Outcome, Output, Activity, Indicator

Each item has:
- Indicator code
- Indicator name
- Indicator type
- Level
- Baseline
- Target
- Current achievement
- Unit of measurement
- Disaggregation required
- Means of verification
- Data source
- Frequency
- Responsible user
- Status

Indicator types: Number, Percentage, Yes/No, Text, Ratio, Currency, Custom
Levels: Goal, Outcome, Output, Activity

### Indicator Update
M&E Officer can update:
- Reporting period achievement
- Cumulative achievement
- Comments
- Data source
- Attached evidence
- Verification status

### Indicator Verification Statuses
- Draft
- Submitted
- Verified
- Needs correction
- Rejected

## Implementation Technical Details

### Data Model

**LogframeItem Entity** (`packages/domain/src/entities/LogframeItem.ts`):
- `id: string`
- `tenantId: string`
- `projectId: string`
- `parentId: string | null` (for hierarchy)
- `level: LogframeLevel` (Goal, Outcome, Output, Activity)
- `code: string`
- `title: string`
- `description: string | null`
- `createdAt: Date`
- `updatedAt: Date`

**Indicator Entity** (`packages/domain/src/entities/Indicator.ts`):
- `id: string`
- `tenantId: string`
- `projectId: string`
- `logframeItemId: string`
- `code: string`
- `name: string`
- `type: IndicatorType`
- `baseline: number | null`
- `target: number | null`
- `unit: string`
- `meansOfVerification: string | null`
- `dataSource: string | null`
- `frequency: string | null`
- `responsibleUserId: string | null`
- `status: IndicatorStatus`
- `createdAt: Date`
- `updatedAt: Date`

**IndicatorUpdate Entity** (`packages/domain/src/entities/IndicatorUpdate.ts`):
- `id: string`
- `tenantId: string`
- `indicatorId: string`
- `reportingPeriodId: string`
- `periodAchievement: number | null`
- `cumulativeAchievement: number | null`
- `comments: string | null`
- `verificationStatus: VerificationStatus`
- `verifiedById: string | null`
- `verifiedAt: Date | null`
- `createdById: string`
- `createdAt: Date`
- `updatedAt: Date`

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/projects/:projectId/logframe` | `getLogframe` |
| POST | `/api/projects/:projectId/logframe` | `createLogframeItem` |
| PATCH | `/api/logframe-items/:id` | `updateLogframeItem` |
| DELETE | `/api/logframe-items/:id` | `deleteLogframeItem` |
| GET | `/api/projects/:projectId/indicators` | `listIndicators` |
| POST | `/api/projects/:projectId/indicators` | `createIndicator` |
| PATCH | `/api/indicators/:id` | `updateIndicator` |
| DELETE | `/api/indicators/:id` | `deleteIndicator` |
| GET | `/api/indicators/:id/updates` | `listIndicatorUpdates` |
| POST | `/api/indicators/:id/updates` | `createIndicatorUpdate` |
| PATCH | `/api/indicator-updates/:id` | `updateIndicatorUpdate` |

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Logframe Hierarchy | Implemented | Goal/Outcome/Output/Activity |
| Manual Creation | Implemented | Full CRUD |
| File Upload | Partial | Excel/CSV import stub |
| AI Logframe Structuring | Stub | Pending LLM provider |
| Indicator CRUD | Implemented | Full lifecycle |
| Indicator Updates | Implemented | Period-based tracking |
| Verification Workflow | Implemented | Draft/Submitted/Verified/Rejected |
| Disaggregation | Not implemented | Fields defined but not tracked |

## Pending Enhancements

- [ ] Excel/CSV logframe file import
- [ ] AI logframe structuring from pasted text
- [ ] Disaggregation tracking (Male/Female/Children/Disability)
- [ ] Indicator baseline/target visualization
- [ ] Cross-period indicator calculations
- [ ] Indicator comparison across periods
- [ ] Means of verification linking to evidence
- [ ] Bulk indicator import from Excel

## Notes

Indicator updates are linked to reporting periods and can have evidence attached. Verification follows the approval workflow pattern.
