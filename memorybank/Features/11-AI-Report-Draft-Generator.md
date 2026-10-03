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
- **MiniMax JSON repair — control chars AND truncation (2026-08-20):**
  MiniMax breaks strict JSON in TWO ways that both caused sections to fall back
  to the stub:
  1. **Literal unescaped control chars inside string values** (real `\n`/`\t`/`\r`
     in markdown-heavy `content`) — fixed by `repairUnescapedControlChars()`
     (string-literal-aware scanner escaping raw `0x00-0x1F` as `\uXXXX`).
  2. **maxTokens truncation** — table-heavy sections exceeded the output
     budget, so MiniMax returned a truncated JSON prefix (cut mid-string,
     unclosed braces). Fixed by `completeTruncatedJson()` (closes unclosed
     strings + structures and retries) and raising `generateSection` `maxTokens`
     to 4096.
  Pipeline in `tryParseSections`: strict → control-char repair → truncation
  completion → stub. **The fix covers the whole report**: `generateSection` is
  called for every plan section in the background loop, and `generateDraft`
  (full report) shares the same `parseSections`. See `memorybank/Fixes.md`
  (2026-08-20) — this MiniMax behaviour has broken generation four times; both
  repair passes are mandatory before any "malformed response" fallback.
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
    fields, and the full plan dump removed — cutting per-call latency
    substantially. `maxTokens` stays at 4096 (sections with tables need the
    headroom; 1500 caused truncation, see above).
  - See `memorybank/Fixes.md` (2026-08-20) and `contabo-ops.md` §26.
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
  - `maxTokens` deliberately stays **4096** (the §26 contabo-ops record documents
    that 8192 caused MiniMax timeouts and burned credits via stub fallback).
  - The stub generator narrates indicator names, targets, previous-period
    comparisons, and performance hints in its tables and summaries.
- **AI Reporter sidecar (2026-08-28, implemented per `../imp/AI-REPORTER-IMPLEMENTATION-PLAN.md`):**
  a new multi-step, evidence-grounded writing pipeline behind the **same**
  `IReportDraftGenerator` port, feature-flagged by `AI_REPORTER_ENABLED=1`. The
  deterministic assurance pipeline is unchanged; it remains the final authority
  (AI writes → deterministic code verifies → humans approve).
  - **TS adapter:** `packages/infrastructure/src/llm/ai-reporter-draft-generator.ts`
    (`AiReporterDraftGenerator`) + `ai-reporter-worker-client.ts` (`HttpWorkerClient`)
    call the Python worker over HTTP. It fulfils `generateDraft`/`generateSection`/
    `rewriteSection`, returns the same `GeneratedSection` shape (LSP), and falls
    back to the stub on any worker/provider failure so generation never 500s.
  - **Python worker:** `apps/workers/app/ai_reporter.py` — versioned writer
    contract (v1), OpenAI-compatible LLM gateway (`AI_REPORTER_PROVIDER/MODEL/
    BASE_URL/API_KEY`), and a **draft → critique → refine** pipeline orchestrated
    with **LangGraph** (falls back to a plain sequential runner if LangGraph is
    not installed). Routes `/v1/ai-reporter/{health,section,rewrite}` behind the
    same `X-Internal-Token` as all worker routes. `langgraph` added to
    `apps/workers/requirements.txt`.
  - **Semantic retrieval (pgvector):** `packages/infrastructure/src/llm/embedding.ts`
    (`IEmbeddingGenerator`/`IEmbeddingStore`), `embedding-generator.ts` (OpenAI +
    Ollama), `repositories/embedding-store.ts` (`PrismaEmbeddingStore`, raw-SQL
    RLS-scoped HNSW cosine search), `semantic-evidence-retriever.ts`
    (`SemanticEvidenceRetriever` behind `IEvidenceRetriever` with lexical fallback),
    and `embedding-backfill.ts` + `embedding:backfill` CLI. DB: `embedding` vector
    column on `EvidenceEmbedding` (`Unsupported("vector(1536)")`) via
    `infra/postgres/pgvector.sql`, dev image `pgvector/pgvector:pg16`.
  - **Historical intelligence:** `packages/infrastructure/src/llm/prior-period.ts`
    (`DeterministicPriorPeriodService` via `IPriorPeriodService`) fetches approved
    prior-period narrative and feeds it to the writer as `priorNarrative` so it
    stays consistent with previously approved reports.
  - **Evaluation (2026-08-28):** golden corpus grown to 8 mechanism cases
    (`packages/infrastructure/test/fixtures/reporting-golden.json`, + period-
    comparison and repetition cases); deterministic `repetition` qualitative metric
    added to `ReportDraftEvaluator` (signal only, never a hard failure). All 8
    cases pass (`reporting:eval`).
  - **Activation:** `pnpm db:migrate` (pgvector), `embedding:backfill`, set
    `AI_REPORTER_ENABLED=1` + worker URL/model/API key + matching `INTERNAL_TOKEN`.

- **AI Reporter v2 (2026-08-29, implemented per `../imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md`):**
  extends v1 with typed artifacts, deterministic validators, per-section timeout
  + per-section fallback, and a 25-case eval corpus. The same feature flag
  (`AI_REPORTER_ENABLED=1`) controls activation; the v2 rollout is **off by default**
  pending the controlled rollout per `../imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`.
  - **Worker code (SRP split):** the 622-LOC `apps/workers/app/ai_reporter.py`
    became a 12-module package `apps/workers/app/ai_reporter/`:
    `models` (Pydantic v2 strict wire types), `writer_contract` (v2 persona
    rules, banned-phrase list, numeric-verbatim rule), `llm_gateway` (provider-
    agnostic chat completions + JSON extract), `outline` (per-inputType outline
    slot templates), `chart_suggester` (deterministic chart heuristic),
    `draft_writer`, `critique_writer` (typed `CritiqueIssue` enum), `refiner`,
    `artifact_validators` (Python mirror of TS validators), `timeouts`
    (per-section deadline), `pipeline` (LangGraph wiring + sequential fallback),
    `router` (FastAPI routes). `main.py` now imports `from .ai_reporter.router
    import router as ai_reporter_router`.
  - **Typed artifacts:** `GeneratedSection` carries optional additive fields
    (`artifacts[]`, `qa[]`, `chartSpec?`, `deltaFromPrior?`) — every v1 generator
    continues to work unchanged (LSP holds). Artifact kinds:
    `TABLE | CHART | LIST | KEY_VALUE | QA | DELTA`. Each artifact has a typed
    payload, source references (per-artifact and per-row for tables), and an
    `ordinal` for stable ordering. The writer is **required** to emit a TABLE
    artifact for `INDICATOR_TABLE` sections and a CHART artifact when the brief's
    `chartSuggestion` is non-null.
  - **Deterministic artifact validators:** 9 hard gates mirrored in
    Python (`apps/workers/app/ai_reporter/artifact_validators.py`) and
    TypeScript (`packages/infrastructure/src/ai/artifact-validators.ts`):
    numeric exactness, table citation, chart data grounding, mandatory-Q&A
    coverage, delta from prior, word count, repetition, banned phrases,
    artifact ordering. Each is exported individually for testability and
    aggregated via `runAll`. The worker runs the Python mirror as a self-check
    before returning; on hard fail it retries once with validator output
    appended to the user prompt, then degrades per-section with
    `usedFallback: true, fallbackReason: "VALIDATOR_FAILED"`.
  - **Per-section timeout:** `AI_REPORTER_DRAFT_TIMEOUT_MS=45000` (default)
    enforced by `timeouts.run_with_section_timeout` (Python wall-clock check)
    and `AbortSignal.timeout(this.timeoutMs)` (TS `HttpWorkerClient`). On
    per-section timeout: retry once; on second timeout, the section falls back
    to deterministic output and the rest of the draft continues. **Per-section
    fallback** is a correctness fix: the old behavior demoted the whole draft
    to `usedFallback: true` whenever any one section was slow, even if the
    other sections had drafted successfully.
  - **Persistence:** `ReportArtifact` + `ReportArtifactRow` tables
    (migration `20260828200000_ai_reporter_artifacts`, RLS forced, cross-tenant
    INSERT verified to fail). `IReportArtifactRepository` port +
    `PrismaReportArtifactRepository` impl wired into
    `GenerateReportDraftHandler` and `RewriteReportSectionHandler`
    (best-effort; a failed persistence does not abort the section because the
    prose is already committed and assured). `GetReportDraftHandler` returns
    artifacts alongside content.
  - **Eval corpus (2026-08-29):** grown 8 → 25 cases
    (`packages/infrastructure/test/fixtures/reporting-golden.json`). New
    deterministic metrics in `ReportDraftEvaluator`: `banned-phrase`,
    `qa-coverage`, `narrative-length-vs-target`, `artifact-coverage`,
    `citation-density`. Hard-gated when the brief declares the expectation;
    soft signal otherwise. All 25/25 pass (`reporting:eval`). The full
    deploy timeline, gate results, and lessons learned are in
    `../imp/AI-REPORTER-2-RESULTS.md`.
  - **Activation:** `AI_REPORTER_ENABLED=1` + `AI_REPORTER_URL=http://127.0.0.1:8092`
    (override the legacy `localhost:5000` default) + matching `INTERNAL_TOKEN`
    in `/opt/donordesk/shared/api.env`. Controlled rollout per
    `../imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md` (preview tenant → 2 pilot
    tenants → default). Feature flag defaults to **off** as of 2026-08-29.

- **Product recovery — writer ↔ verifier ↔ human boundary (2026-08-30, release
  `20260829160000`):** the end-to-end user audit found the AI writer produced
  prose the deterministic verifier rejected at scale (400–500 unsupported-claim
  items per draft) and the review UX leaked internal assurance terminology. The
  recovery (see `../imp/RECOVERY-PLAN-IMPLEMENTATION.md`) fixed the boundary
  without touching the core pipeline:
  - **Number parser fixed** (`packages/domain/.../numeric-atom.ts`):
    thousands separators ("3,251" → one atom `3251`), digits embedded in codes
    ("OUT-1" → no spurious `-1`), ambiguous tokens rejected ("12,5").
  - **Writer prompt aligned**: temporary "Number discipline" rules (quote
    finding values exactly, never derive percentages, never quote targets as
    numbers, never substitute `periodAchievement` for NOT_CALCULABLE findings)
    and a verifier-safe worked example. P1-2 then relaxed these once the
    verifier became tolerant (derived percentages + target figures allowed).
  - **Tolerant verifier** (`verifier-strategies.ts`): target/baseline figures
    are accepted as references once a sentence binds a real value; derived
    percentages accept 1- and 2-decimal rounding; combined indicators verify
    naturally. Negative guards: a bare target/baseline figure without a matched
    value still fails.
  - **Human-readable verification detail**: numeric failures now explain
    expected vs actual (e.g. "78% could not be verified … denominator was not
    recorded (OUT-7, OUT-9)").
  - **Fallback surfaced**: per-section `generatedWithAi` (from the current
    revision's `modelId`) drives a "drafted without AI — review carefully"
    banner; generation shows a live ETA and a **Stop generation** button
    (`POST /v1/reporting-periods/:id/cancel-generation`, loop aborts on the
    superseded marker).
  - **Claim resolution in the workspace**: per-statement Accept-with-note /
    Exclude inline (reuses `report.resolve-claim`); aggregated **Review** view;
    rendered **Preview** view; "What to do next" panel; Edit/Review/Preview/
    Versions tab bar.

- **Report-quality v4 (2026-09-26, not yet deployed):** a code audit found that the
  AI Reporter path produced *lower*-quality reports than the legacy narrator. It also
  found that several of its quality mechanisms were dead code. Full defect list:
  `../Fixes.md` ("Report-quality v4"). Summary of the new behaviour:
  - **Flow per section (worker):**
    1. `draft()` writes the prose, claims and Q&A (writer contract **v4**).
    2. `artifact_builder.attach()` adds the indicator TABLE (also written into
       INDICATOR_TABLE content as markdown), a CHART and a DELTA, all built
       deterministically from verified findings.
    3. `run_all()` runs the checks: no invented numbers (`grounding.py`), Q&A
       coverage, banned phrases, max words, repetition, and required tables, plus
       donor-voice *warnings*.
    4. One retry follows, using the previous draft and all feedback, and the better
       attempt is kept.
    5. An ungrounded number that survives the retry makes the section
       `VALIDATOR_FAILED`, and the API substitutes the deterministic section. Style
       issues keep the AI prose and are recorded as `qualityIssues`.
  - **Context parity:** the brief now carries section-specific guidance (shared
    `buildSectionSpecificGuidance`), "Tell the Story", donor visibility lines, tone,
    outline slots by section kind, and indicator/activity IDs.
  - **Executive summary last:** synthesis sections (`isSynthesisSection`) are drafted
    after all other sections, from their drafted text (`draftedSections`). Other
    sections see sibling excerpts, so they don't repeat facts. This applies to both
    the AI Reporter and the legacy narrator (`promptVersion` 5).
  - **Retrieval:** section-relevant lexical ranking over the full brief when
    embeddings are absent, then linked evidence, then verified files.
  - **Timeouts:** worker 90s per call / 200s per section. API HTTP timeout is
    `AI_REPORTER_HTTP_TIMEOUT_MS` (default 2 × draft + 30s; the provisioner writes
    240000).
  - **Eval:** new soft `donor-voice` metric; the corpus is still 28/28 correct.
  - **Web preview:** renders markdown tables and typed artifacts.

- **Provider selection (2026-09-26, not yet deployed):** every generation resolves
  the tenant's own enabled SuperAdmin LLM row, else the single enabled
  all-tenants row. Supported providers: Claude, Gemini, DeepSeek, MiniMax, OpenAI.
  The resolved provider and key are sent to the AI Reporter worker per request,
  and generators are cached by config fingerprint, so changes need no restart.
  See `../Fixes.md` ("SuperAdmin LLM providers").

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Report Draft CRUD | Implemented | Full lifecycle |
| AI Generation | Implemented | Real LLM via SuperAdmin MiniMax/DeepSeek config; stub fallback free + never billed (2026-08-17); professional context enrichment (indicator metadata/targets, project/period/template context, period-over-period narration, performance gating) 2026-08-18; AI Reporter sidecar (multi-step draft/critique/refine + pgvector semantic retrieval + prior-period intelligence) behind `IReportDraftGenerator`, feature-flagged `AI_REPORTER_ENABLED` 2026-08-28; **AI Reporter v2** (typed artifacts + validators + per-section fallback + 25-case eval) shipped behind the same flag 2026-08-29 — feature flag still defaults to off pending the controlled rollout |
| Section Editing | Implemented | Rich text |
| Source References | Implemented | Populated from activities/indicators/evidence; statement-level sources rendered in the workspace (2026-08-17); indicator labels include human-readable names (2026-08-18) |
| Unsupported Claims | Implemented | Flagged per section and surfaced in compliance |
| AI Rewrite/Shorten | Implemented | Real LLM rewrite via configured provider; tolerates plain-text output (2026-08-17) |
| Donor-friendly Mode | Implemented (heuristic) | Audience-aware rewrite in the section editor (2026-08-16) |
| Section Status | Implemented | All 5 statuses |
| Version Tracking | Implemented | Version number |
| Typed Artifacts | Implemented (2026-08-29; v4 2026-09-26) | TABLE / CHART / DELTA built deterministically from verified findings (v4); rendered in the web Preview (v4); interactive chart remains the section chart panel |
| Deterministic Validators | Implemented (2026-08-29; v4 2026-09-26) | v4: number grounding (no invented numbers), Q&A coverage, banned phrases (word-boundary), max words, repetition (+ paraphrase), required tables, delta (results sections only); donor-voice + min-words as warnings; mirrored Python + TS |
| Per-section Timeout | Implemented (2026-08-29; v4 2026-09-26) | v4: `AI_REPORTER_DRAFT_TIMEOUT_MS=90000` per call, 200s per section, API HTTP timeout derived (2× + 30s) |
| Executive summary synthesis | Implemented (2026-09-26) | Drafted last, from the other drafted sections |
| Regenerate one section | Implemented (2026-09-27, Report Editor v2 B7) | `POST /v1/report-sections/:id/regenerate` with optional author instruction (`userInstruction`, ≤500 chars, TS↔Python mirror, prompt text only when present); keeps the text on fallback/timeout; `REGENERATION` revision; 10 per draft per hour, not metered |
| Ask AI on a selection | Implemented (2026-09-27, B10) | Rewrite endpoint `selection` + `preview` returns a suggestion without saving |

## Report Editor v2 additions (2026-09-27)

- Shared generation services: `ReportGenerationContextBuilder` (period, generator/credit policy, template, findings, updates, activities, evidence) and `SectionGenerationService` (draft one section + telemetry; persist revision + artifacts + assurance), used by full drafts and single-section regenerate.
- Background work runs through an injected `BackgroundRunner`; the api awaits it before closing the request's database client.
- Section regenerate / "Leave out" / evidence corrections: see `20-report-gen.md` §"Report Editor v2" and `../Fixes.md` (2026-09-27).

## EERP Q2 run fixes (2026-09-26)

See `../Fixes.md` §"EERP-2026 Q2 end-to-end report run". In summary:
- **Verifier:** cumulative-to-date figures verify (`cumulativeValue`), and prior-cumulative is a tolerated reference. DATE/COUNT atoms (day-of-month, "6-month", "N result(s)", "N performed") are no longer checked as indicator values.
- **Writer inputs:** sensitive evidence is excluded from evidence packages (`excludeRestrictedEvidence`) in both generate and rewrite.
- **Worker token limit:** `AI_REPORTER_MAX_TOKENS` default is now 16384. With 4096, DeepSeek JSON truncated and most sections silently fell back to deterministic text.
- **Worker parsing:** `extract_json` salvages output truncated inside trailing lists (only if `content` is complete), and `draft()` retries once on a no-JSON answer.
- **How to tell whether the AI actually wrote a section:** the workspace banner "This section was drafted without AI (deterministic fallback)", or worker journal `POST /v1/ai-reporter/section … 500`. Always check this after generating; a completed draft does not mean the AI wrote it.

## Pending Enhancements

- [x] Wire real LLM provider for generation (2026-08-17 — SuperAdmin MiniMax/DeepSeek)
- [x] Actual source reference population from evidence (2026-08-17 — extracted text
  persisted + cited; activity/indicator narrative context in the generation input)
- [x] Previous period comparison text (2026-08-18 — `VerifiedFinding.comparisonValue`
  is no longer dropped and the narrator describes period-on-period change)
- [x] AI Reporter multi-step writing + semantic retrieval + prior-period intelligence
  (2026-08-28 — see the section above and `../imp/AI-REPORTER-IMPLEMENTATION-PLAN.md`)
- [x] **AI Reporter v2 — typed artifacts, validators, per-section fallback, 25-case eval**
  (2026-08-29 — see the section above and `../imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md`).
  **Feature flag still OFF by default**; controlled rollout per
  `../imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`.
- [x] **Frontend artifact renderers** (2026-09-26): the Preview renders markdown
  tables and TABLE / CHART (as a data table) / DELTA / QA / LIST / KEY_VALUE
  artifacts. Still open: an interactive ECharts view of the CHART artifact inside
  the editor.
- [ ] **Controlled rollout** (Phase 8 of AI Reporter 2): preview tenant
  → 2 pilot tenants → default. Procedure in
  `../imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`.
- [ ] Unsupported claim warning UI
- [ ] AI regenerate individual sections
- [ ] AI tone adjustment (donor-specific)
- [x] Indicator table auto-insertion (2026-09-26: deterministic verified table for INDICATOR_TABLE sections, AI Reporter path)
- [x] Executive summary auto-generation (2026-09-26: drafted last, synthesising the drafted sections)
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

**Report scope (2026-10-03):** activity/situation/custom reports pass a one-paragraph focus (`period.scope`, built by
`describeReportScope`) to both writers — the legacy narrator's "Reporting Period" block and the AI Reporter's `ContextPeriod`
(report-wide prefix, so prefix caching is unaffected; omitted for cadence reports). Activity reports draft only from the selected
activities. See Feature 10 "Report types & scope".

**Date-aware number grounding (2026-10-03):** `grounding.py` and its TS mirror `number-grounding.ts` accept a *written* date ("20 April 2028",
"April 20th, 2028", "12 March") only when that exact date appears as an ISO date (`2028-04-20`) in the inputs; the day/year are then not separate
numeric claims. Bare numbers are unchanged. Before this, a section naturally restating an activity date was rejected as `UNGROUNDED_NUMBER` and
fell back to deterministic text. Also: never title a section "Overview" (worker `outline.py` treats it as an Executive Summary) — see Feature 10.

