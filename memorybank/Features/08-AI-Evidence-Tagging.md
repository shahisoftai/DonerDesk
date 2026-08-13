# Feature 8: AI Evidence Tagging

## Overview

AI assists users by classifying uploaded evidence and suggesting metadata tags. Human approval is required before tags become final.

## Specification (from MVP-features.md)

### AI Suggested Tags
For each uploaded file, AI may suggest:
- Evidence type
- Related project
- Related activity
- Related output
- Related indicator
- Related location
- Reporting period
- Possible donor requirement
- Summary of content
- Potential sensitivity warning

### Human Approval Required
User can:
- Accept all suggestions
- Accept selected suggestions
- Edit suggestions
- Reject suggestions
- Mark evidence for later review

### AI Confidence Score
- High confidence
- Medium confidence
- Low confidence

Low-confidence suggestions highlighted for manual review.

### Sensitive Data Warning
AI flags: Beneficiary names, Phone numbers, CNIC/National ID/passport numbers, Children's information, Medical records, Financial records, Location-sensitive data, Protection case details

Warning message: "This file may contain sensitive personal data. Please verify access level before sharing or exporting."

## Implementation Technical Details

### AI Handler
- Location: `packages/infrastructure/src/llm/evidence-tagger.ts` (stub/heuristic)
- Rules are the single source of truth in
  `packages/contracts/src/strategies/heuristic-rules.json` (shared with the Python
  workers via a generator → `apps/workers/app/_strategy_data.py`).
- **Orchestration (2026-08-13, deployed):** uploading evidence publishes an
  `EvidenceUploaded` domain event; the `OutboxEventBus` maps it to the
  `evidence.suggest_tags` job (`IJobQueue`). Tag persistence
  (`POST /internal/evidence/:id/tags`) is idempotency-keyed
  (`IdempotencyRecord`, migration `20260813000000_idempotency`). The workers
  service (`apps/workers`, `/v1/suggest-tags`) and Kestra are prepared but **not
  enabled** on Contabo (gated). Real AI providers remain a stub (`LLM_PROVIDER`
  swap point).

### Suggested Tags Schema

```typescript
interface AISuggestedTags {
  evidenceType: {
    value: EvidenceType;
    confidence: 'high' | 'medium' | 'low';
  };
  relatedActivity: {
    value: string;
    confidence: 'high' | 'medium' | 'low';
  };
  relatedIndicator: {
    value: string;
    confidence: 'high' | 'medium' | 'low';
  };
  location: {
    value: string;
    confidence: 'high' | 'medium' | 'low';
  };
  reportingPeriod: {
    value: string;
    confidence: 'high' | 'medium' | 'low';
  };
  summary: string;
  sensitivityWarnings: SensitivityWarning[];
}

interface SensitivityWarning {
  type: 'beneficiary_names' | 'phone_numbers' | 'national_id' | 'children_info' | 'medical_records' | 'financial_records' | 'location_sensitive' | 'protection_cases';
  description: string;
  confidence: 'high' | 'medium' | 'low';
}
```

### API Endpoints

| Method | Endpoint | Handler |
|--------|----------|---------|
| POST | `/api/evidence/:id/tag` | `requestAITags` |
| GET | `/api/evidence/:id/tags` | `getSuggestedTags` |
| PATCH | `/api/evidence/:id/tags` | `updateTags` |
| POST | `/api/evidence/:id/tags/accept` | `acceptTags` |

### Audit Logging
AI tag acceptance/rejection logged to `audit_events` per architecture rules.

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Tagging Handler | Stub | Using InMemoryJobQueue |
| Confidence Scores | Stub | Static values in stub |
| Human Approval | Implemented | Accept/edit/reject workflow |
| Sensitivity Warnings | Stub | Basic flag only |
| Tag History | Implemented | Audit trail |
| Low-confidence Highlighting | Not implemented | UI pending |

## Pending Enhancements

- [ ] Wire real LLM provider (`LLM_PROVIDER` pending)
- [ ] Actual confidence scoring from LLM
- [ ] Real sensitivity detection
- [ ] Automatic low-confidence highlighting in UI
- [ ] Batch tagging for multiple files
- [ ] Tag suggestion training from accepted tags
- [ ] Cross-reference with donor requirements

## Notes

Per `memorybank/pending.md`:
- BullMQ/Redis wiring pending
- LLM provider wiring pending

AI tags must not become final automatically - human approval is always required.
