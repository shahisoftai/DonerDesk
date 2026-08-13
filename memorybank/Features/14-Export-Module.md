# Feature 14: Export Module

## Overview

Export reports and evidence packages in multiple formats for donor submission.

## Specification (from MVP-features.md)

### Export Types
- Word report export
- PDF report export
- Excel indicator table export
- Evidence checklist export
- Evidence pack ZIP export

### Export Package Contents
A full export package may include:
- Final donor report
- Indicator table
- Evidence checklist
- Annex list
- Selected evidence files
- Compliance summary
- Report metadata

### Export History
Each export stores:
- Export type
- Exported by
- Export date
- Project
- Reporting period
- Report version
- Files included

### Export Warning
Before export, display warnings:
- Unresolved critical checklist items
- Unsupported claims
- Unverified indicators
- Sensitive evidence included
- Missing annexes

User can proceed only if they have permission.

### Evidence Pack Folder Structure
```
Project Name/
Reporting Period/
  01_Final_Report/
  02_Indicator_Table/
  03_Evidence_Checklist/
  04_Attendance_Sheets/
  05_Photos/
  ...
```

## Implementation Technical Details

### Data Model

**ExportPackage Entity** (`packages/domain/src/entities/ExportPackage.ts`):
- `id: string`
- `tenantId: string`
- `projectId: string`
- `reportingPeriodId: string`
- `exportType: ExportType`
- `fileUrl: string | null`
- `version: number`
- `exportedById: string`
- `filesIncluded: string[]`
- `warningsShown: string[]`
- `createdAt: Date`

### Export Types Enum
```typescript
type ExportType =
  | 'word_report'
  | 'pdf_report'
  | 'excel_indicators'
  | 'evidence_checklist'
  | 'evidence_pack_zip';
```

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| POST | `/api/reporting-periods/:id/export/report` | `exportReport` |
| POST | `/api/reporting-periods/:id/export/pdf` | `exportReportPdf` |
| POST | `/api/reporting-periods/:id/export/indicators` | `exportIndicatorsExcel` |
| POST | `/api/reporting-periods/:id/export/checklist` | `exportEvidenceChecklist` |
| POST | `/api/reporting-periods/:id/export/evidence-pack` | `exportEvidencePack` |
| GET | `/api/exports/:id` | `getExport` |
| GET | `/api/exports/:id/download` | `downloadExport` |
| GET | `/api/projects/:id/export-history` | `getExportHistory` |

### Export Builder
- Location: `packages/infrastructure/src/export/`
- WordBuilder, PdfBuilder, ExcelBuilder, ZipBuilder

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Word Export | Implemented | Basic implementation |
| PDF Export | Implemented | Basic implementation |
| Excel Indicators | Implemented | Table format |
| Evidence Checklist | Implemented | List with metadata |
| Evidence Pack ZIP | Implemented | Folder structure |
| Export History | Implemented | Full audit trail |

> **Scheduled export (2026-08-13, deployed):** `export.run` is a real scheduled
> entry point — `POST /internal/export/run` → `RunExportHandler` →
> `CreateExportHandler` (delegates to the existing export builder). The Kestra
> flow `export_on_close.yml` triggers it on period close (flow prepared; Kestra
> not yet enabled).
| Pre-export Warnings | Implemented | Critical item checks |
| Permission Checks | Implemented | Role-based |

## Pending Enhancements

- [ ] Enhanced formatting for donor-specific templates
- [ ] Export progress tracking
- [ ] Scheduled exports
- [ ] Automated export on period close
- [ ] Custom export templates
- [ ] Partial evidence pack (selected items only)
- [ ] Export to Google Drive/Dropbox
- [ ] Public download links with expiry
- [ ] S3 storage for exported files

## Notes

Export history is retained per reliability requirements. AI failures should not block manual report editing.

Sensitive evidence is included only when intentionally selected per privacy requirements.
