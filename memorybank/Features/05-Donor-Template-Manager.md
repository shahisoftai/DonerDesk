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

**ExtractedTemplateSection** (AI-extraction review shape; NOT the persisted shape):
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

> **Persisted shape (canonical — 2026-08-20):** `DonorTemplate.sectionsJson` stores
> the domain `TemplateSection` shape, **not** the `ExtractedTemplateSection` fields
> above. `PrismaDonorTemplateRepository.toDomain` parses it with `createSection()`,
> which requires per section: `title` (≥2 chars), `description`, `inputType`
> (`NARRATIVE` | `TABLE` | `ANNEX` | `INDICATOR_TABLE` | `COMPLIANCE`), `required`,
> `evidenceNeeded` (string), `order`, `reviewStatus` (`DRAFT` | `REVIEWED`), plus
> optional `id`, `relatedLogframeElement`, `minWords`, `maxWords`. Persisting the
> UI-facing names (`sectionTitle`, `sectionDescription`, `inputNeeded`) throws
> "Section title required" on every template read (see `memorybank/Fixes.md`,
> 2026-08-20). The `ExtractedTemplateSection` shape is the intermediate result of
> AI extraction only; it must be mapped to `TemplateSection` before save.
> Reference: `packages/domain/src/contexts/templates/template-section.ts`,
> `packages/infrastructure/src/repositories/templates.ts`.

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
| AI Extraction | Implemented (heuristic) | Multi-pass heading detection + canonical fallback (2026-08-16); real LLM provider pending |
| Section Editor | Implemented | Human review workflow |
| Template Versioning | Implemented | Version number tracked |
| File Format Support | Implemented | DOCX/PDF/TXT/XLSX/CSV via parsers |
| Copy-paste Input | Implemented | Manual text input wired |

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
