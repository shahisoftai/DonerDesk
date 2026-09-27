# Donor Template Manager — Remediation & Completion Plan (2026-09-27)

Goal: a fully working Template Manager. It extracts **everything** a donor template
asks for (the report structure, each section's instructions and questions, tables,
annexes, compliance rules, formatting, and submission and deadline rules). It then lets a
human review and edit all of it, and feeds it into (a) the report sections in the
Report Workspace and (b) the per-section AI brief used during generation.

---

## 1. Current state (verified against code, not the feature doc)

End-to-end flow today:

1. `templates/new/page.tsx` accepts pasted text or a `.docx/.pdf` file (accept list only).
2. The file goes to `POST /v1/templates/parse-file`, then `TolerantDocumentParser`
   (`packages/infrastructure/src/parsers/document-parser.ts`). DOCX uses
   `mammoth.extractRawText`, which drops headings, tables and styles, so the output is
   **flat text**. The file bytes are then **discarded**.
3. `POST /v1/templates` runs `UploadTemplateHandler` (`packages/application/src/use-cases/templates/upload-template.ts`).
   If no sections are sent, it calls `StubTemplateExtractionService`
   (`packages/infrastructure/src/llm/template-extraction.ts`). That service is **regex heuristics only**,
   with no LLM call. When nothing matches it falls back to a hardcoded list of 9 generic sections.
4. The sections are persisted immediately in `DonorTemplate.sectionsJson`. The user then
   edits them in `templates/[templateId]/SectionEditor.tsx`.
5. `CreateReportingPeriod` writes `templateSnapshotJson`. However, **generation reads the live
   template** (`report-generation-context.ts:118`), not that snapshot.
6. `ReportPlanner.plan` (`packages/application/src/services/report-planner.ts:40-53`) maps
   template sections to `ReportPlanSection` values. It sets `mandatoryQuestions: []` and
   **drops `description` entirely**, so donor instructions never reach the legacy narrator
   (`buildSectionGuidance`) or the AI Reporter `SectionBrief`.
7. The template-level fields sent to the AI are only name, donor, language, annexes and notes (`buildTemplateBlock`).

### Issue register

| # | Severity | Issue | Location |
|---|---|---|---|
| I1 | **Critical** | Section `description`/instructions never reach the AI; `mandatoryQuestions` always `[]` | `report-planner.ts:40-53` |
| I2 | **Critical** | "AI extraction" is regex-only, and the 9-section canonical fallback silently replaces the real structure | `template-extraction.ts` |
| I3 | High | DOCX parsed flat, losing heading levels, tables and numbering, so heuristics guess structure from plain text | `document-parser.ts:11` |
| I4 | High | Original file never stored; `originalFileUrl` is always null | `new/page.tsx`, `upload-template.ts` |
| I5 | High | Generation uses the live template, not the period's `templateSnapshotJson`. Editing a template mid-period changes in-flight reports. | `report-generation-context.ts:118` |
| I6 | High | `createSection()` hardcodes `order: 0`; every repository read resets order | `template-section.ts:44`, `repositories/templates.ts:102` |
| I7 | High | `toDomain` uses strict `createSection` (throws), not `normalizeSection`. One bad row breaks the whole project's template list. | `repositories/templates.ts:101-102` |
| I8 | High | `version` never bumps (`bumpVersion()` has no callers), so submission-snapshot version checks are meaningless | `donor-template.ts:106`, `create-submission-snapshot.ts:115` |
| I9 | Medium | Heuristic disclaimer hidden in production (`IS_STUB` = non-prod) | `new/page.tsx:15,79-86` |
| I10 | Medium | Zod `title.min(1)` vs domain `>= 2`, so the domain error surfaces late | `packages/contracts/src/templates.ts:28` |
| I11 | Medium | No `GET /v1/templates/:id`, no metadata `PATCH`, no re-extract endpoint; `existingSections` merge path is dead | `apps/api/src/routes/templates.ts` |
| I12 | Medium | PDF parse failure returns `""` silently; unknown types return the filename as "text" | `document-parser.ts:34-45` |
| I13 | Medium | Extraction lacks: report title, sub-sections, required tables (columns), indicator requirements, compliance rules, formatting/page limits, submission instructions, deadlines, structured annexes | domain + extractor |
| I14 | Medium | `evidenceNeeded` is a single string; the planner wraps it as one-item array | `template-section.ts`, `report-planner.ts:51` |
| I15 | Medium | No pre-save review: sections are persisted before the user sees them | `new/page.tsx` → `upload-template.ts` |
| I16 | Low | No section reorder (drag/drop / up-down) in `SectionEditor` | `SectionEditor.tsx` |
| I17 | Low | Requirement resolver derives `donorKey`/`mechanismKey` by slugging names; extracted compliance rules never become a requirement pack | `requirement-resolver.ts:108-118` |
| I18 | Low | `UI accept=".docx,.pdf"` although parser supports TXT/XLSX/CSV; no size limit or type check on parse-file | `new/page.tsx:111`, `routes/templates.ts:49` |
| I19 | Low | No "save as reusable / template library"; templates are strictly per-project | domain |
| I20 | Docs | Feature doc cites non-existent paths/routes/handlers; its pending list contradicts its status table; the docxtpl mapping-wizard feature is undocumented | `05-Donor-Template-Manager.md` |

---

## 2. Target model

### 2.1 `TemplateSection` (domain, persisted in `sectionsJson`, `schemaVersion: 2`)

Existing fields are kept. All new fields are optional, so v1 rows parse via `normalizeSection`.

```ts
interface TemplateSection {
  id; title; description; inputType; required; order; reviewStatus;
  minWords?; maxWords?; relatedLogframeElement?;
  // v2
  parentId?: string;              // sub-sections (e.g. 2.1 under 2)
  level?: number;                 // 1..4 heading depth
  numbering?: string;             // "2.1", "B.", "Annex C"
  instructions?: string;          // donor guidance for this section, verbatim-ish → AI brief
  mandatoryQuestions?: string[];  // "Describe…", "Explain how…", "?" prompts → AI brief
  evidenceNeeded: string[];       // was string; normalized from legacy string
  requiredTables?: Array<{ title: string; columns: string[]; notes?: string }>;
  pageLimit?: number;
  authorInstructions?: string;    // org's OWN extra guidance for AI (never from donor)
  includeInReport?: boolean;      // default true; false = reference-only (e.g. cover guidance)
  source?: { excerpt: string; page?: number; headingPath?: string[] }; // provenance
  confidence?: number;            // 0..1 from extractor
}
```

### 2.2 Template-level requirements (new `requirementsJson` column on `DonorTemplate`)

```ts
interface TemplateRequirements {
  reportTitle?: string;
  reportingFrequency?: "MONTHLY"|"QUARTERLY"|"SEMI_ANNUAL"|"ANNUAL"|"FINAL"|"AD_HOC";
  submission?: { instructions: string[]; deadlineRule?: string; deadlineOffsetDays?: number; channel?: string; format?: string };
  formatting?: { rules: string[]; maxPages?: number; font?: string; language?: string };
  annexes: Array<{ id; name; required: boolean; description?: string; source? }>; // supersedes string[] requiredAnnexes
  indicatorRequirements: Array<{ text: string; disaggregation?: string[]; source? }>;
  compliance: Array<{ id; text: string; severity: "INFO"|"WARN"|"BLOCK"; source? }>;
  generalInstructions: string[];   // whole-report guidance to AI (tone, audience, do/don't)
}
```

### 2.3 New columns on `DonorTemplate` (Prisma migration)

These are `requirementsJson`, `extractionMetaJson` (method `LLM|HEURISTIC|MANUAL`, model,
promptVersion, warnings[], durationMs), `status` (`EXTRACTING|NEEDS_REVIEW|REVIEWED|ARCHIVED`),
`originalFileName`, `originalFileMime`, `originalFileHash`, `sectionsSchemaVersion`, and
`isLibrary` (for reuse). Add every field the app `select`s to `REQUIRED_PRISMA_FIELDS` in
`apps/api/src/routes/health.ts` in the same PR.

Versioning: add a new `DonorTemplateVersion` table (`templateId, version, sectionsJson,
requirementsJson, createdById, createdAt, changeNote`). Every section or requirements save
**appends a version** and bumps `DonorTemplate.version` through the existing `bumpVersion()`.
`ReportingPeriod` keeps `donorTemplateId` plus `donorTemplateVersion`, and generation reads
**that version** (fixes I5/I8).

---

## 3. Work plan (phased; each phase is shippable)

### Phase A: Correctness fixes (small, no schema change) — I6, I7, I9, I10, I12, I18
1. Make `createSection` accept an optional `order` (default 0). In `toDomain`, use
   `normalizeSection(s, i)` after sorting by stored `order`. Wrap each section so a bad
   section is **dropped with a logged warning** instead of throwing.
2. Contracts: `title: z.string().trim().min(2).max(300)`; add `.max()` caps on description and evidence.
3. `TolerantDocumentParser`: return `Result` errors (`UNSUPPORTED_TYPE`, `PARSE_FAILED`,
   `EMPTY_DOCUMENT`); the parse-file route returns 422 with a user-readable message.
   Enforce 20 MB max size and a MIME/extension allowlist.
4. UI: accept `.docx,.pdf,.txt,.md,.xlsx,.csv`. Always show an extraction-method banner driven
   by `extractionMeta.method` (not `NODE_ENV`).
5. Tests: domain order and legacy parsing, repository round-trip, contract rejections, parser errors.

### Phase B: Instructions reach the AI (the most important fix) — I1, I14
1. `ReportPlanSection` gains `instructions?: string`, `requiredTables?`, `authorInstructions?`, `subsectionTitles?`.
2. `ReportPlanner.plan` maps `instructions` (falling back to `description`), `mandatoryQuestions`,
   `evidenceNeeded[]`, `requiredTables`, `pageLimit`, and `authorInstructions`.
3. Legacy narrator (`buildSectionGuidance`) emits `Donor instructions:`, `Mandatory questions:`,
   `Required tables:`, and `Organisation guidance:` lines, only when present.
4. AI Reporter: add `donorInstructions: str|None`, `requiredTables`, `authorInstructions`
   to **both** `SectionBrief` (Python, `extra="forbid"`) and `AiReporterSectionBrief` (TS).
   Render them in `writer_contract.py` as **writer contract v5**, keeping v2–v4 prompts
   byte-stable. Regenerate the TS mirror; update `test_ts_contract_mirror_is_string_identical`.
   Required tables feed `artifact_builder.py` as table *shape* hints only. Numbers remain
   deterministic, and grounding rules are unchanged.
5. `buildTemplateBlock` and `ContextTemplate` add `generalInstructions`, `formatting.rules`,
   `indicatorRequirements`, and `compliance` (text only).
6. Tests: planner mapping, prompt snapshots (legacy + v5), Python brief validation,
   reporting golden-corpus eval (`reporting:eval`) must not regress.

### Phase C: Structure-preserving parsing — I3
1. New `IStructuredDocumentParser` returns `DocBlock[]` (`HEADING{level,text,numbering}`,
   `PARAGRAPH`, `LIST_ITEM`, `TABLE{rows}`, `PAGE_BREAK{page}`).
   - DOCX: reuse the `mammoth.convertToHtml` + style-map walker already in
     `donor-template-structure-parser.ts` (extract the shared walker, no duplication).
     Keep numbering, bold-only "pseudo headings", and tables with header rows.
   - PDF: `pdf-parse` per-page text, with heading inference by numbering/caps and a page number on each block.
   - XLSX/CSV: each sheet is a TABLE block; the first row is the header.
   - TXT/MD: markdown headings (`#`) plus numbering.
2. Keep `parse-file` returning flat text for the textarea, and also return `blocks` for extraction.

### Phase D: Real LLM extraction with heuristic fallback — I2, I13
1. New `LlmTemplateExtractionService implements ITemplateExtractionService` in
   `packages/infrastructure/src/llm/template-extraction-llm.ts`:
   - Provider from `PlatformLlmConfigResolver` (tenant provider or platform), wrapped in
     `withPiiFirewall`, with credits charged the same way as report generation, and
     `model` + `promptVersion` recorded.
   - Input is the structured blocks, chunked by top-level heading (about 12k tokens per chunk), plus one document-level pass for the template requirements.
   - Output must be strict JSON validated by Zod (`ExtractedTemplateSchema`) into
     `TemplateSection[]` and `TemplateRequirements`. The prompt says to **quote, not invent**:
     each section, question, instruction and compliance item carries a `source.excerpt`.
   - **Grounding check**: reject any item whose excerpt is not found (normalized fuzzy
     match) in the source text. Set `confidence` accordingly and record rejects in
     `extractionMeta.warnings`.
   - Treat template content as data, not instructions (prompt-injection guard in the system prompt).
2. Fallback chain: LLM, then an improved heuristic over blocks (headings from real styles),
   then the canonical 9 sections **only when the user explicitly opts in**. A fallback is never
   silent: `method` and warnings are shown in the UI.
3. Container: choose the implementation by AI availability; type the field as the **interface**
   (currently the concrete stub, `container.ts:285`).
4. Eval: `packages/infrastructure/test/fixtures/donor-templates/` with 6–8 real templates
   (USAID, ECHO, FCDO, UN OCHA/CBPF, EU INTPA, GIZ, a UNICEF PCA, one plain-text), plus
   expected JSON. Add a `pnpm --filter @donordesk/infrastructure templates:eval` script measuring section recall/precision,
   instruction coverage, and hallucination rate (ungrounded items). Gate: no ungrounded items; section recall ≥ 0.9.

### Phase E: Async extraction plus pre-save review flow — I4, I11, I15
1. Upload stores the original through the storage port (`Organization.storageProvider`:
   local/Drive/R2). Save `originalFileUrl`, name, MIME and hash. Add a download route.
2. New use cases and routes (thin, Zod-validated, audited):
   - `POST /v1/templates` creates the template with `status=EXTRACTING` and starts extraction via the
     injected `BackgroundRunner` (the api awaits `settleBackgroundWork()`). Extraction ends in `NEEDS_REVIEW`.
   - `GET /v1/templates/:id` (full template + requirements + extractionMeta + version list)
   - `PATCH /v1/templates/:id` (metadata)
   - `PUT /v1/templates/:id/sections` (existing; now versions and bumps)
   - `PUT /v1/templates/:id/requirements`
   - `POST /v1/templates/:id/extract` re-extracts with `{ mode: "replace" | "merge" }`. Merge keeps
     REVIEWED and user-edited sections and only proposes new or changed ones (revives the dead
     `existingSections` path).
   - `POST /v1/templates/:id/review` sets the status to REVIEWED. Only then can it be attached to a period.
   - `GET /v1/templates/:id/versions`, `GET /v1/templates/:id/original`
3. The report generation gate blocks on `status !== REVIEWED` with a clear message ("Review the
   donor template before generating").

### Phase F: Template editor UI (full human review)
The template detail page gets these tabs:
1. **Sections**: a tree with sub-sections. Drag/drop and up/down reorder, indent/outdent (I16).
   Per section: title, numbering, input type, required, include-in-report, word/page limits,
   **Donor instructions**, **Mandatory questions** (list editor), **Evidence needed** (list),
   **Required tables** (title + columns), logframe link (picker from the project logframe),
   **Organisation guidance for AI**, a confidence badge, and a "Show source" popover with the
   excerpt and page. Also per-section "Accept" (REVIEWED), bulk accept, and "Accept all high-confidence".
2. **Requirements**: report title, frequency, submission instructions and deadline rule,
   formatting rules and page limit, annexes (name, required, description), indicator
   requirements, compliance rules (severity), and general AI instructions.
3. **Source**: the original file download, the extracted text, and blocks side by side, with
   click-to-highlight from a section.
4. **Versions**: the version list with a diff between any two (sections added, removed or
   changed; field-level diff).
5. **AI brief preview**: per section, shows exactly what will be sent to the AI (a new dry-run
   endpoint that renders the brief without an LLM call).
6. The unsaved-changes guard and optimistic concurrency (`expectedVersion`) match Report Editor v2.

### Phase G: Downstream wiring — I5, I8, I17, I19
1. **Workspace sections**: when a draft is created, each template section with
   `includeInReport !== false` becomes a `ReportSection` (keeping hierarchy/numbering and
   `templateSectionId`), in template order. Required tables pre-seed an empty GFM table
   skeleton, which follows the markdown-subset invariant.
2. **Generation reads the pinned version** (`period.donorTemplateVersion` → `DonorTemplateVersion`).
   Attaching a newer version to an open period is an explicit "Update template" action with a diff preview.
3. **Readiness/compliance**: `calculate-readiness`, `detect-missing-evidence` and the checklist
   detector consume structured annexes, evidence lists, compliance rules (BLOCK severity becomes a
   gate), and the submission deadline. `ReportingProfile.deadlineOffsetDays` is prefilled from the extracted rule.
4. **Requirement pack bridge**: "Publish as requirement pack" converts the template requirements and
   sections into a DRAFT `ReportingRequirementPack` with an explicit donorKey/mechanismKey chosen by
   the user, replacing the name-slug guess in `requirement-resolver.ts`.
5. **Library/reuse**: "Save to library" (`isLibrary=true`, tenant-scoped, no project) and
   "Create from library" (copy into a project at version 1 with a `sourceTemplateId` provenance field).
6. The docxtpl mapping wizard keys off the same `templateSectionId`s. Verify that the
   mapping is invalidated or flagged when sections change in a new version.

### Phase H: Docs & ops
- Rewrite `05-Donor-Template-Manager.md` with real paths, routes and handlers. Document the
  mapping wizard as its own feature doc. Update `AGENTS.md` (writer contract v5, new brief fields,
  and the `templates:eval` command).
- Data migration: backfill `requirementsJson` from `requiredAnnexes`/`notes`, backfill
  `status=REVIEWED` for existing templates in use by periods, and create version 1 rows in
  `DonorTemplateVersion`. Run on staging DB copy first.
- Deploy via `scripts/deploy-fast.sh` (Prisma generate on host; `/ready` field gate).

---

## 4. Sequencing & sizing

| Phase | Depends on | Size | Ship value |
|---|---|---|---|
| A fixes | — | S (1 PR) | Stops data loss/crashes |
| B instructions → AI | A | M | **Biggest quality win**: donor guidance actually used |
| C structured parse | A | M | Better input for any extractor |
| D LLM extraction + eval | C | L | Accurate extraction of everything |
| E async + storage + routes | A, D | M | Real upload/review lifecycle |
| F editor UI | E | L | Full human control |
| G downstream + versions | B, E | L | Workspace/readiness/compliance/library |
| H docs/migration/deploy | all | S | — |

Recommended order: A, then B, then C, then D, then E, then F, then G, then H. A and B can ship in the first
iteration without schema changes except the new brief fields. B fixes the "instructions never
reach the AI" defect even with today's heuristic extractor.

## 5. Acceptance criteria
- Uploading a real USAID/ECHO/FCDO template yields its actual sections (not the canonical 9)
  with each section's instructions and questions, and every item links to a source excerpt.
- Every extracted or edited instruction appears in the section's AI brief preview and in the
  worker `SectionBrief` for that section; editing it changes the next generation.
- The Report Workspace sections match the template tree and order exactly; editing the template
  does not change an in-flight period unless the user explicitly updates it.
- Annexes, evidence, compliance and deadlines show up in readiness and the checklist.
- No crash on legacy `sectionsJson`; order persists; versions increment on every save.
- `pnpm -r typecheck`, all unit tests, worker pytest, `reporting:eval` (no regression) and
  `templates:eval` (thresholds) all pass.
