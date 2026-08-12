# Feature 5: Donor Template Manager

## Overview

Users can upload donor reporting templates in various formats. AI extracts the structure for report generation.

## Specification (from MVP-features.md)

### Upload Donor Template
Supported formats: DOCX, PDF, TXT, Manual copy-paste

### Template Metadata
Fields:
- Template name
- Donor name
- Report type
- Reporting frequency
- Language
- Required annexes
- Notes

Report type options: Monthly report, Quarterly report, Annual report, Final report, Activity report, Situation report, Custom donor report

### AI Template Extraction
Extracts:
- Report title
- Section headings
- Narrative questions
- Required tables
- Required annexes
- Indicator reporting requirements
- Compliance requirements
- Submission instructions

### Human Review of Extracted Template
After AI extraction, user sees editable structured version:
- Section name
- Section description
- Input needed
- Required or optional
- Evidence needed
- Related logframe element (optional)

User can: Accept, Edit, Add missing, Delete incorrect sections, Save as reusable

### Template Versioning
Stores:
- Original uploaded file
- Extracted structured template (JSON)
- Date uploaded
- Uploaded by
- Version number

## Implementation Technical Details

### Data Model

**DonorTemplate Entity** (`packages/domain/src/entities/DonorTemplate.ts`):
- `id: string`
- `tenantId: string`
- `organizationId: string`
- `projectId: string`
- `templateName: string`
- `donorName: string`
- `reportType: ReportType`
- `language: string`
- `originalFileUrl: string`
- `extractedStructureJson: Record<string, any>`
- `version: number`
- `uploadedById: string`
- `createdAt: Date`
- `updatedAt: Date`

**ExtractedTemplateSection**:
```typescript
interface ExtractedTemplateSection {
  id: string;
  sectionTitle: string;
  sectionDescription: string;
  inputNeeded: string;
  required: boolean;
  evidenceNeeded: string[];
  relatedLogframeElementId: string | null;
  order: number;
}
```

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| GET | `/api/donor-templates` | `listDonorTemplates` |
| POST | `/api/donor-templates` | `createDonorTemplate` |
| GET | `/api/donor-templates/:id` | `getDonorTemplate` |
| PATCH | `/api/donor-templates/:id` | `updateDonorTemplate` |
| DELETE | `/api/donor-templates/:id` | `deleteDonorTemplate` |
| POST | `/api/donor-templates/:id/extract` | `extractTemplateStructure` |
| GET | `/api/donor-templates/:id/sections` | `getTemplateSections` |
| PATCH | `/api/donor-templates/:id/sections` | `updateTemplateSections` |

### AI Extraction Handler
- Location: `packages/infrastructure/src/ai/handlers/templateExtractor.ts`
- Currently stub implementation (per `memorybank/pending.md`)
- Real LLM provider wiring pending

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| File Upload | Implemented | LocalStorage backend |
| Template Metadata | Implemented | Full CRUD |
| AI Extraction | Stub | Using `InMemoryJobQueue` stub |
| Section Editor | Implemented | Human review workflow |
| Template Versioning | Implemented | Version number tracked |
| File Format Support | Partial | DOCX/PDF/TXT via parsers |
| Copy-paste Input | Not implemented | Manual text input |

## Pending Enhancements

- [ ] Wire real LLM provider for extraction (`LLM_PROVIDER` pending)
- [ ] Implement DOCX parsing for template content extraction
- [ ] Implement PDF parsing for template content extraction
- [ ] Copy-paste text template input
- [ ] Template comparison/diff view
- [ ] Template library per donor type
- [ ] Required annexes tracking
- [ ] Submission deadline extraction from template

## Notes

Per `memorybank/pending.md`, BullMQ/Redis wiring is pending. AI features use stubs until `LLM_PROVIDER` is configured.
