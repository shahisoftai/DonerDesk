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
| PATCH | `/api/report-sections/:id/chart` | `updateReportSectionChart` |
| POST | `/api/reports/:sections/:id/regenerate` | `regenerateSection` |
| POST | `/api/reports/:sections/:id/ai-rewrite` | `aiRewriteSection` |
| POST | `/api/reports/:sections/:id/ai-shorten` | `aiShortenSection` |
| POST | `/api/reports/:sections/:id/ai-donor-friendly` | `aiMakeDonorFriendly` |

### AI Report Generator Handler
- Location: `packages/infrastructure/src/llm/llm-report-draft-generator.ts` (real
  LLM via configured provider) with `packages/infrastructure/src/llm/report-draft-generator.ts`
  as the deterministic stub/heuristic fallback.
- Orchestration (2026-08-13, deployed): the `report.draft_section` job and the
  workers `/v1/draft-section` route exist; the job queue is wired
  (memory/BullMQ/Kestra via `JOB_QUEUE`).
- **Real LLM wiring (2026-08-17, deployed):** the generator resolves the tenant's
  provider from SuperAdmin `PlatformConfiguration` (category `LLM`, enabled,
  TENANT>GLOBAL precedence) via `PlatformLlmConfigResolver` + `SecretCipher`
  (AES-256-GCM); deepseek + minimax adapters are registered in the OCP
  `factory.ts`. On provider failure/empty/unparseable response the generator
  reports `usedFallback=true` and returns the stub — the handler then **releases
  the reserved AI credit, records an error run, and marks the draft
  `generatedByAi=false`** (stub-fallback is never billed). `maxTokens=4096`
  (verified MiniMax completes the full prompt in ~38s). See
  `../imp/LLM-PROVIDER-WIRING.md` §13–14.
- **Evidence/activity/indicator context (2026-08-17):** the generation input now
  carries the project's full record set so reports reflect saved data:
  - `EvidencePackage.extractedText` — the raw document text extracted by Tika is
    persisted on `EvidenceFile.extractedText` (migration
    `20260817200000_evidence_extracted_text`) and chunked into evidence packages
    (falling back to `aiSummary`/`title`). Kestra `evidence_parse.yml` sends the
    extracted text through `POST /internal/evidence/:id/tags`.
  - `GenerateReportDraftInput.activities` — full activity narrative
    (`summary`, `achievements`, `challenges`, `lessonsLearned`, `nextSteps`,
    participants, location, linked evidence) snapshotted per period.
  - `GenerateReportDraftInput.indicatorUpdates` — raw achievement strings,
    `comments`, `dataSource`, linked evidence per indicator.
  - The stub narrates activity records/achievements/challenges/lessons verbatim and
    attaches evidence chunks to claims; the LLM prompt includes
    `# Activity Records`, `# Indicator Updates`, and expanded `# Evidence Packages`
    (first 8 chunks, 800 chars each) and mandates per-section `sourceReferences`.
  - The report workspace renders statement-level sources (claim evidence chips +
    verification status); `ReportGenerationRun` snapshots `activityIds`.
- **Section-wise generation (2026-08-20):** `GenerateReportDraftHandler` no
  longer blocks on a single full-report LLM call (which pushed MiniMax past the
  180s adapter timeout and raced the web gateway's 180s limit, so the stub
  fallback never reached the browser). The flow is now two-phase:
  - **Phase 1 (fast, synchronous):** the handler builds the plan/findings/
    evidence context, creates the draft + generation run, persists **every plan
    section as a `NOT_STARTED` placeholder**, saves the plan, and returns
    immediately `{ draftId, sectionIds, generating: true, totalSections }`.
    The UI renders the full report skeleton (greyed-out left column) at once.
  - **Phase 2 (background, per-section):** the handler spawns an in-process
    `generateSectionsInBackground` loop that drafts one section per LLM call via
    the new `IReportDraftGenerator.generateSection(input, planSection)` port
    method (slim single-section prompts, `maxTokens=1500`, well within the 180s
    adapter timeout). Each section is committed through the revision pipeline +
    assessed as it completes; sections flip `NOT_STARTED → DRAFTED` in place.
    The stub generator implements `generateSection` by reusing its per-title
    builders; the LLM generator builds a single-section prompt
    (`buildSectionNarratorUserPrompt`) and falls back to the stub per section.
  - **Resume-safety:** the loop skips sections already `DRAFTED`, so a
    re-click or an API restart mid-run regenerates only the remaining
    `NOT_STARTED` sections.
  - **Credit/run accounting:** the AI credit is reserved in Phase 1; the
    background loop reconciles it at completion — a real AI draft (no section
    fell back) consumes the credit, otherwise it is released, the draft is
    marked `generatedByAi=false`, and an error run is recorded.
  - **Frontend:** `ReportWorkspace` polls `GET /v1/reporting-periods/:id/draft`
    (via the new `getReportDraftAction`) every 4s while `generating`; pending
    sections render greyed/disabled with a pulsing dot + "Not started" badge,
    flipping to normal as they complete. Polling stops when all sections are
    drafted or after ~8 minutes (in which case the user is told generation is
    still running and can keep editing completed sections).
- **MiniMax literal control-char JSON repair (2026-08-20, release
  `20260820141254` follow-up):** the parser-hardening release caused **every
  section to fall back to the stub** ("AI content disappeared") because MiniMax
  emits **literal unescaped `\n`/`\t`/`\r` INSIDE JSON string values** (real
  newlines in markdown-heavy `content` fields). Strict `JSON.parse` throws on
  raw control chars in strings, so all responses were rejected. Fix:
  `repairUnescapedControlChars()` — a string-literal-aware scanner that escapes
  raw `0x00-0x1F` chars inside strings as `\uXXXX`; `tryParseSections` and
  `parseRewrite` retry with the repaired text before falling back. See
  `memorybank/Fixes.md` (2026-08-20) — the same MiniMax behaviour has broken
  generation three times; the repair pass is now mandatory before any
  "malformed response" fallback is accepted.
- **Section-wise hardening (2026-08-20):** the first section-wise release
  exposed two defects that are now fixed:
  - **Raw JSON stored as content.** `parseSections` treated an unparseable
    JSON-ish response as narrative prose, so MiniMax responses wrapped in a
    prose preamble / trailing text / fences-with-surrounding-text were
    persisted as the **whole `{"sections":[...]}` blob**. The parser now:
    strips fences anywhere; strict-parses first; detects a `"sections"`
    wrapper anywhere and runs a balanced-brace JSON extractor; and **never**
    falls back to narrative for anything JSON-like (returns `null` → stub).
    A `looksLikeRawJson()` post-parse guard rejects any section whose content
    is still a JSON object, in both `generateDraft` and `generateSection`.
  - **113–142s per section.** The per-section prompt dumped the full plan +
    all findings + all indicator updates + all activity narratives + all
    evidence (8×800 chars each) into every section call. It is now lean:
    evidence ≤ 4 packages × 4 chunks × 400 chars, activities ≤ 6 with 250-char
    fields, no full plan dump, `maxTokens` 2048 → 1500. Sections carry only a
    bounded, relevant context slice, cutting per-call latency substantially.
  - See `memorybank/Fixes.md` (2026-08-20) and `contabo-ops.md` §29.
- **Professional report context (2026-08-18, deployed `20260818074405`):** the
  narrator now receives the context a professional donor report needs:
  - `VerifiedFinding` enrichment — each finding carries `indicatorName`,
    `indicatorType`, `baseline`, `target`, the resolved `semantics`, the
    previous-period `comparisonValue` (previously computed by the analyst but
    dropped by `computeIndicator`), and a deterministic `performanceEvaluation`
    (`POSITIVE`/`NEGATIVE`/`NEUTRAL`, gated by `evaluatePerformance` so evaluative
    wording is only ever produced from resolved semantics + a baseline/target).
  - `GenerateReportDraftInput.reportContext` — an optional snapshot of the
    **project** (title, code, donor, implementing/partner organizations, country,
    region, district, sector, duration, budget, description, reporting frequency),
    the **reporting period** (report type, dates, deadlines, readiness score,
    days until deadline), and the **donor template** (name/version, donor,
    language, required annexes, notes) — built by `GenerateReportDraftHandler`.
  - Prompt additions: `# Project Context` / `# Reporting Period` / `# Donor
    Template` blocks, per-section guidance (input type, mandatory questions,
    evidence needs, word limits, related logframe element), formatting rules,
    indicator names + target progress + period-on-period narration, evidence
    metadata (`evidenceType`, `verificationStatus`, `confidentialityLevel`),
    participant disaggregation (male/female/children/disability), explicit
    quality-flag caveat language per flag, performance-evaluation gating rules,
    and a worked example section in the system prompt.
  - `maxTokens` deliberately stays **4096** (the §29 contabo-ops record documents
    that 8192 caused MiniMax timeouts and burned credits via stub fallback).
  - The stub generator narrates indicator names, targets, previous-period
    comparisons, and performance hints in its tables and summaries.

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Report Draft CRUD | Implemented | Full lifecycle |
| AI Generation | Implemented | Real LLM via SuperAdmin MiniMax/DeepSeek config; stub fallback free + never billed (2026-08-17); professional context enrichment (indicator metadata/targets, project/period/template context, period-over-period narration, performance gating) 2026-08-18 |
| Section Editing | Implemented | Rich text |
| Source References | Implemented | Populated from activities/indicators/evidence; statement-level sources rendered in the workspace (2026-08-17); indicator labels include human-readable names (2026-08-18) |
| Unsupported Claims | Implemented | Flagged per section and surfaced in compliance |
| AI Rewrite/Shorten | Implemented | Real LLM rewrite via configured provider; tolerates plain-text output (2026-08-17) |
| Donor-friendly Mode | Implemented (heuristic) | Audience-aware rewrite in the section editor (2026-08-16) |
| Section Status | Implemented | All 5 statuses |
| Version Tracking | Implemented | Version number |

## Pending Enhancements

- [x] Wire real LLM provider for generation (2026-08-17 — SuperAdmin MiniMax/DeepSeek)
- [x] Actual source reference population from evidence (2026-08-17 — extracted text
  persisted + cited; activity/indicator narrative context in the generation input)
- [x] Previous period comparison text (2026-08-18 — `VerifiedFinding.comparisonValue`
  is no longer dropped and the narrator describes period-on-period change)
- [ ] Unsupported claim warning UI
- [ ] AI regenerate individual sections
- [ ] AI tone adjustment (donor-specific)
- [ ] Indicator table auto-insertion
- [ ] Executive summary auto-generation
- [ ] Risk and mitigation section suggestions
- [ ] Export to DOCX with formatting

## Notes

Per `memorybank/pending.md`, BullMQ/Redis are pending; the real LLM provider is
now wired via SuperAdmin config (2026-08-17) with per-tier AI-credit quotas and a
free, never-billed stub fallback. Report sections must be editable before export.

The readiness score calculation includes approval score (10% weight).

As of 2026-08-17 the generator consumes the project's saved Indicators (verified
findings + update comments/dataSource), Evidence (real extracted document text,
chunked and cited), and Activities (full narrative) — previously evidence was only
titles/stub summaries and activities were only evidence-ID sources. See
`../Fixes.md` ("AI report generation ignored evidence content and
activity/indicator narratives").
