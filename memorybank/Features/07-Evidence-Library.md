# Feature 7: Evidence Library

## Overview

Central repository for uploading, classifying, tagging, and verifying all project evidence files.

## Specification (from MVP-features.md)

### Upload Evidence
Supported formats: PDF, DOCX, XLSX, CSV, JPG, PNG, TXT
(Future: Video, Audio, WhatsApp imports, Kobo/ODK sync)

### Evidence Metadata
Fields:
- File name, Evidence title
- Project, Reporting period
- Activity, Output, Indicator
- Location, Date of activity
- Evidence type, Uploaded by
- Upload date, Verification status
- Confidentiality level, Notes

### Evidence Types
Attendance sheet, Photo, Distribution list, Training record, Field visit report, Monitoring report, Kobo/ODK export, Procurement document, Approval document, Beneficiary list, Meeting minutes, Case study, Financial document, Supplier document, Donor communication, Other

### Confidentiality Levels
Public, Internal, Sensitive, Highly sensitive

### Verification Statuses
Uploaded, AI tagged, Pending review, Verified, Needs correction, Rejected, Archived

### Evidence Detail Page
- File preview
- Metadata display/edit
- AI-suggested tags
- Linked activity/indicators/donor requirements
- Verification status
- Reviewer comments
- Upload history
- Download button

### Search and Filters
By: Project, Reporting period, Activity, Indicator, Evidence type, Location, Uploaded by, Verification status, Confidentiality level, Date range

Search: File name, Evidence title, Notes, Extracted text, Tags

## Implementation Technical Details

### Data Model

**EvidenceFile Entity** (`packages/domain/src/entities/EvidenceFile.ts`):
- `id: string`
- `tenantId: string`
- `organizationId: string`
- `projectId: string`
- `reportingPeriodId: string | null`
- `fileName: string`
- `title: string`
- `fileUrl: string`
- `fileType: string`
- `fileSizeBytes: number`
- `evidenceType: EvidenceType`
- `activityId: string | null`
- `outputId: string | null`
- `indicatorId: string | null`
- `location: string | null`
- `activityDate: Date | null`
- `uploadedById: string`
- `verificationStatus: VerificationStatus`
- `confidentialityLevel: ConfidentialityLevel`
- `aiSummary: string | null`
- `aiSuggestedTagsJson: Record<string, any> | null`
- `sensitivityWarning: boolean`
- `createdAt: Date`
- `updatedAt: Date`

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/evidence` | `listEvidence` |
| POST | `/api/evidence` | `uploadEvidence` |
| GET | `/api/evidence/:id` | `getEvidence` |
| PATCH | `/api/evidence/:id` | `updateEvidence` |
| DELETE | `/api/evidence/:id` | `deleteEvidence` |
| GET | `/api/evidence/:id/download` | `downloadEvidence` |
| POST | `/api/evidence/:id/verify` | `verifyEvidence` |
| GET | `/api/evidence/:id/history` | `getEvidenceHistory` |
| GET | `/api/evidence/search` | `searchEvidence` |

### Storage Backend (per-tenant strategy)
- Primary: **Google Drive (link-first)** — files stay in the tenant's own Drive; DonorDesk stores a reference (`storageProvider=GOOGLE_DRIVE`, `driveFileId`, `driveWebLink`), no byte copy.
- Optional paid tier: **Cloudflare R2 / S3-compatible** (`R2EvidenceStorage`, byte copy).
- Default/dev: **`LocalStorage`** (`packages/infrastructure/src/storage/local-storage.ts`), selected via `EvidenceStorageResolver` from `Organization.storageProvider`.
- See `memorybank/gdrive.md` for the full implementation (Phases A–E).

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| File Upload | Implemented | Byte upload → LOCAL/R2; upload publishes an `EvidenceUploaded` event |
| Drive-link | Implemented | `POST /v1/evidence/link-drive` — reference-only, no byte copy (`storageProvider=GOOGLE_DRIVE`) |
| Metadata CRUD | Implemented | Full fields |
| AI Tagging | Orchestrated (heuristic) | Outbox → `evidence.suggest_tags` job; persist idempotency-keyed (release `20260813064828`); workers and Kestra enabled |
| Verification Workflow | Implemented | Full status flow |
| Search | Implemented | Basic search functional |
| Filters | Implemented | All filter options |
| File Preview | Implemented | For supported formats; Drive evidence opens via Google Drive web link |

> **Async ingest (2026-08-13):** `UploadEvidenceHandler` no longer blocks on
> parsing/enqueueing — it publishes an `EvidenceUploaded` domain event. The
> `OutboxEventBus` maps it to `evidence.suggest_tags` via `IJobQueue` (memory
> default; Kestra/BullMQ selectable via `JOB_QUEUE`). Tag persistence is guarded by
> the durable `IdempotencyRecord` store (migration `20260813000000_idempotency`).
| Download | Implemented | Signed URLs |
| Delete | Implemented | Soft delete |

## Pending Enhancements

- [ ] R2 storage wired via env for production (adapter exists, config is a placeholder)
- [ ] Google OCR tagging by `driveFileId` (currently uses byte-based Tika for LOCAL/R2)
- [ ] Bulk file upload (zip import)
- [ ] Evidence linking to multiple activities/indicators
- [ ] Advanced search with extracted text
- [ ] Video/audio file support
- [ ] WhatsApp import
- [ ] Kobo/ODK direct sync
- [ ] Bulk metadata update
- [ ] Evidence batch operations
- [ ] File version history

## Notes

Evidence files respect confidentiality levels. The `sensitivityWarning` flag is set by AI tagging. Sensitive evidence should be excluded from export unless intentionally selected per privacy requirements.
