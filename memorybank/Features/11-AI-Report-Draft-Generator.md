# Feature 11: AI Report Draft Generator

## Overview

AI generates donor-ready report drafts from project data, evidence, and templates. Each section is editable with source references.

## Specification (from MVP-features.md)

### Report Generation Inputs
- Donor template
- Project overview
- Logframe
- Indicator updates
- Activity updates
- Verified evidence
- Challenges
- Lessons learned
- Risk notes
- Previous reporting period (optional)
- Compliance checklist

### Generate Report Draft
Creates:
- Executive summary
- Project progress summary
- Activities completed
- Indicator progress table
- Achievements section
- Challenges section
- Lessons learned section
- Risk and mitigation section
- Beneficiary reach summary
- Evidence annex list
- Missing information notes

### Source-Linked Drafting
Each generated paragraph shows source references:
"During the reporting period, the project conducted three IYCF counselling sessions reaching 142 caregivers."

Source links:
- Activity Update #14
- Attendance Sheet #22
- Indicator NUT-02 update
- Photo Evidence #31

### Unsupported Claim Warning
If AI generates a statement without supporting evidence, flag as: "Needs source verification"

### Report Editor
- Rich text editing
- Section-by-section layout
- AI rewrite button
- AI shorten button
- AI make more donor-friendly button
- Insert indicator table
- Insert evidence reference
- Add comment
- Resolve comment
- Mark section complete

### Report Section Status
- Not started
- Drafted
- Needs evidence
- Needs review
- Approved

## Implementation Technical Details

### Data Model

**ReportDraft Entity** (`packages/domain/src/entities/ReportDraft.ts`):
- `id: string`
- `tenantId: string`
- `projectId: string`
- `reportingPeriodId: string`
- `title: string`
- `status: ReportStatus`
- `version: number`
- `generatedByAi: boolean`
- `createdById: string`
- `approvedById: string | null`
- `approvedAt: Date | null`
- `createdAt: Date`
- `updatedAt: Date`

**ReportSection Entity** (`packages/domain/src/entities/ReportSection.ts`):
- `id: string`
- `tenantId: string`
- `reportDraftId: string`
- `sectionTitle: string`
- `sectionOrder: number`
- `content: string | null`
- `sourceReferencesJson: SourceReference[] | null`
- `status: ReportSectionStatus`
- `createdAt: Date`
- `updatedAt: Date`

### Source Reference Schema

```typescript
interface SourceReference {
  type: 'activity_update' | 'indicator_update' | 'evidence_file' | 'checklist_item';
  entityId: string;
  description: string;
  url?: string;
}
```

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/reporting-periods/:id/report` | `getReportDraft` |
| POST | `/api/reporting-periods/:id/report/generate` | `generateReportDraft` |
| PATCH | `/api/reports/:id` | `updateReportDraft` |
| DELETE | `/api/reports/:id` | `deleteReportDraft` |
| GET | `/api/reports/:id/sections` | `getReportSections` |
| PATCH | `/api/reports/:sections/:id` | `updateReportSection` |
| POST | `/api/reports/:sections/:id/regenerate` | `regenerateSection` |
| POST | `/api/reports/:sections/:id/ai-rewrite` | `aiRewriteSection` |
| POST | `/api/reports/:sections/:id/ai-shorten` | `aiShortenSection` |
| POST | `/api/reports/:sections/:id/ai-donor-friendly` | `aiMakeDonorFriendly` |

### AI Report Generator Handler
- Location: `packages/infrastructure/src/llm/report-draft-generator.ts` (stub/heuristic)
- Orchestration (2026-08-13, deployed): the `report.draft_section` job and the
  workers `/v1/draft-section` route exist; the job queue is wired
  (memory/BullMQ/Kestra via `JOB_QUEUE`). Drafting content itself remains a stub
  until a real LLM provider is configured (`LLM_PROVIDER` swap point).

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Report Draft CRUD | Implemented | Full lifecycle |
| AI Generation | Stub | Heuristic draft; real LLM pending |
| Section Editing | Implemented | Rich text |
| Source References | Implemented | Populated from activities/indicators/evidence in the stub generator |
| Unsupported Claims | Implemented | Flagged per section and surfaced in compliance |
| AI Rewrite/Shorten | Implemented (heuristic) | `rewriteSection` on the generator port + UI (2026-08-16); real LLM pending |
| Donor-friendly Mode | Implemented (heuristic) | Audience-aware rewrite in the section editor (2026-08-16) |
| Section Status | Implemented | All 5 statuses |
| Version Tracking | Implemented | Version number |

## Pending Enhancements

- [ ] Wire real LLM provider for generation
- [ ] Actual source reference population from evidence
- [ ] Unsupported claim warning UI
- [ ] AI regenerate individual sections
- [ ] AI tone adjustment (donor-specific)
- [ ] Previous period comparison text
- [ ] Indicator table auto-insertion
- [ ] Executive summary auto-generation
- [ ] Risk and mitigation section suggestions
- [ ] Export to DOCX with formatting

## Notes

Per `memorybank/pending.md`, BullMQ/Redis and LLM provider wiring are pending. Report sections must be editable before export.

The readiness score calculation includes approval score (10% weight).
