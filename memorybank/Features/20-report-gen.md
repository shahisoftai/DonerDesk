# Feature 20: Report Intelligence Engine — Implementation Plan

**Updated:** 2026-08-19
**Status:** IMPLEMENTED — core (Phases 0–1 + foundation of 2–4) landed 2026-08-16: domain primitives, decimal-safe indicator analyst, semantics inference, generation-run snapshot, structured claim provenance with evidence-hash snapshots, deterministic tiered claim verifier, approval gates, reject/request-changes transition, report-plan/claim/run/mapping persistence, `DONOR_TEMPLATE` export type, API routes, RLS coverage, and tests. LLM-backed planner/writer/verifier and docxtpl rendering in Python workers remain behind the documented swap points. **2026-08-18:** the analyst/narrator contract was enriched for professional donor reports (indicator metadata + target/baseline, previous-period `comparisonValue`, deterministic `performanceEvaluation`, project/period/template context, per-section guidance) — see §17. **2026-08-19:** the full professional-reporting hardening plan (revision integrity, assertion coverage, structured numeric/evidence verification, requirement packs, submission snapshots, one shared gate, export intent, golden corpus) is IMPLEMENTED and shipped — see §18.

> **Next-stage plan:** [`../imp/PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md`](../imp/PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md)
> is the canonical phased plan for revision-bound assurance, complete assertion
> coverage, structured verification, award-specific requirement precedence,
> submission snapshots, and donor-native rendering — **status IMPLEMENTED
> (2026-08-19)**.

## 1. Objective

DonorDesk does **not** need a new report-writing engine. It needs completion and wiring of its existing reporting architecture so the system performs the work automatically, surfaces only material exceptions, and asks for human judgment once — at the decision boundary.

The happy path for an established project with a mapped donor template is exactly four primary user actions:

```text
Select period → Generate → Review → Submit
```

with **zero** compulsory planner, semantics, mapping, or claim-management screens, and **one** consolidated exception surface at submission.

The implementation must:

- keep the LLM strictly a controlled planner, narrator, and reviewer — never the authority over calculations, provenance, lifecycle, authorization, or approval;
- make the deterministic data analyst the sole source of indicator mathematics;
- guarantee that no failed verification is ever silently converted into a "verified" state;
- guarantee that no evaluative statement is produced from unresolved indicator semantics;
- make every material claim traceable to source evidence and to the exact bytes used at generation time;
- keep every generation run reproducible against an immutable audit snapshot;
- preserve the domain/application/infrastructure dependency direction and honor the `Result<T, DomainError>` convention;
- require no user action except at the submission decision boundary; backend sophistication must never become frontend paperwork.

## 2. Workload UX contract (cross-cutting, non-negotiable)

This contract is an acceptance requirement of every phase, not final-stage UX polish.

### 2.1 Default experience

```text
Select period → Generate → Review → Submit
```

### 2.2 Background behaviour (silent, no user action)

DonorDesk silently:

- infers indicator semantics from type, unit, name, and sector packs;
- falls back to descriptive narrative when inference is unsafe;
- calculates verified findings through the deterministic analyst;
- generates the report plan;
- retrieves and ranks tenant-authorized evidence;
- drafts all sections;
- verifies numbers, units, periods, and citations;
- redrafts deterministic failures;
- runs compliance checks and feeds verdicts into the existing checklist;
- populates the donor template;
- creates the immutable audit snapshot.

### 2.3 Exception experience

At submission, show **one** consolidated panel:

```text
Report readiness: 96%

3 items need a decision
• 1 unsupported result statement
• 1 causal claim with limited evidence
• 1 confidential source included

[Fix automatically] [Review 3 items] [Accept limitations]
```

Internally these remain claim-level records; externally they are grouped into one decision surface. Drill-down traceability is available, never forced.

### 2.4 Gate policy

| Result | Drafting | Internal approval | Submit to donor |
|---|---|---|---|
| Verified | Continue | Allow | Allow |
| Descriptive neutral finding | Continue | Allow | Allow |
| Auto-fixable problem | Fix silently | Allow after fix | Allow |
| Unsupported material claim | Continue | Warn | Block or accept limitation |
| Numeric contradiction | Continue | Block | Block or exclude claim |
| Confidentiality violation | Continue internally | Block | Block until removed/authorized |
| Subjective concern | Continue | Allow | Human decision |
| Missing optional evidence | Continue | Allow | Warn only |

Escape hatches are permission-controlled: accepting a weak causal claim is available to a report manager; overriding a confidentiality violation requires a grants-level authority.

### 2.5 Batch-first rules

- Never require indicator-by-indicator configuration.
- Never require claim-by-claim acknowledgement unless explicitly expanded.
- Auto-apply repeated decisions to equivalent items.
- Allow "apply to this donor/template" so decisions become reusable.
- Remember accepted terminology, style, and mappings.
- Show only unresolved exceptions.

### 2.6 Measurable acceptance criteria

- **0** mandatory configuration screens for mapped donors
- **4** primary user actions: select, generate, review, submit
- **1** consolidated exception surface maximum
- **100%** deterministic checks executed automatically
- **100%** material claims retain provenance
- **0** evaluative statements from unresolved semantics
- **0** silent conversion of failed verification into "verified"
- Mapping and semantics costs amortized per donor/template
- Repeated reports reuse mappings, plans, style, and approved conventions
- User time measured from period selection to submission readiness

### 2.7 Resolution semantics

```ts
type Resolution =
  | "VERIFIED"            // passed independent verification
  | "AI_REDRAFTED"        // failed; auto-redrafted and re-verified
  | "SOURCE_ADDED"        // failed; source attached and re-verified
  | "ACCEPTED_WITH_LIMITATION"  // failed; accepted by authorized user with one aggregate note
  | "EXCLUDED";           // claim removed from the report
```

`ACCEPTED_WITH_LIMITATION` requires one aggregate note, **preserves the failed verification status**, and appears transparently in the audit record. The system assists; it neither bosses the user nor launders uncertainty.

## 3. Verified current codebase baseline

This plan is based on the repository as it exists on 2026-08-16.

| Area | Current implementation | Consequence for this feature |
|---|---|---|
| Report draft lifecycle | `ReportDraft` DRAFT→UNDER_REVIEW→APPROVED→EXPORTED→SUBMITTED; per-section NOT_STARTED→DRAFTED→NEEDS_EVIDENCE→NEEDS_REVIEW→APPROVED | Gates plug into existing transitions; `approve()` currently has no gate and no reject path |
| Section model | `ReportSection` carries `sourceReferences: SourceReference[]` and `unsupportedClaims: string[]` | Claim provenance replaces the flat string array with structured claim records |
| Generator port | `IReportDraftGenerator.generateDraft` accepts string summaries (logframe/indicators/activities) and returns sections | Must be replaced with `GenerateReportDraftInput` of `VerifiedFinding[]`; see §6.2 |
| Generator impl | `StubReportDraftGenerator` (heuristic, no LLM) | Real generator wired only after provider + contract exist |
| Indicator model | `Indicator` has `type` (NUMBER/PERCENTAGE/YES_NO/TEXT/RATIO/CURRENCY/CUSTOM), string `baseline`/`target`, `disaggregationRequired` | No aggregation, direction, numerator/denominator, or cumulative semantics exist |
| Indicator updates | `IndicatorUpdate` stores `periodAchievement` + `cumulativeAchievement`, `verificationStatus`, `attachedEvidenceIds`, per-(indicator,period) unique | Period-vs-cumulative is explicit; no deterministic analyst consumes it |
| Evidence | `EvidenceFile` has `confidentialityLevel` + `isSensitive()`, `verificationStatus`, link-first Drive support | Confidentiality gate and source hashing are feasible today |
| Chunker / provenance | `EvidenceChunker` and `ProvenanceTracker` exist but are not wired into generation | Reuse both for claim provenance; do not rewrite |
| PII firewall | `PiiFirewall` with reject/redact/transform/allow policies wraps the LLM provider | Reuse for confidential-source checks in the verifier |
| Compliance checklist | `ChecklistItem` types include `UNSUPPORTED_REPORT_CLAIM` and `SENSITIVE_DATA_WARNING`; statuses include `RESOLVED`, `ACCEPTED_RISK`, `NOT_APPLICABLE` | Exception surface composes existing checklist items + claim records; no parallel decision system |
| Approval handler | `ApproveReportHandler` approves unconditionally (approve-report.ts:15) | Must gate on checklist items, claim resolutions, and semantics before `draft.approve()` |
| Reject transition | No reject/request-changes transition on `ReportDraft` (tracked in `memorybank/pending.md`) | Must be added for Block outcomes to be actionable |
| Reporting profile | `ReportingProfile` has tone, language, formatting rules, per-section word-count `sectionOverrides`, `version` | Source of planner style/limits; version feeds the generation snapshot |
| Template sections | `TemplateSection` has `inputType`, `required`, `evidenceNeeded`, `minWords`/`maxWords` | Planner input; word-limit verification source |
| Reporting period | `ReportingPeriod` snapshots `reportingProfileSnapshotJson` + `templateSnapshotJson` at creation; stores `donorTemplateId` | Profile/template snapshot exists; generation run must snapshot the rest (indicator updates, evidence, findings, model/prompt) |
| Analytics | Materialized views for indicator progress, compliance, evidence, activities, risk trend, lessons learned | Deterministic analyst can be built on SQL + pure domain math, not LLM |
| LLM plumbing | `ILLMProvider` port; OpenAI/Anthropic/Ollama adapters exist; `CompliantModelRouter`, `LlmRun` (model + promptVersion), AI-credit billing | Provider wiring is a swap point; every run records `LlmRun` |
| Exports | `IExportBuilder` (WORD/PDF/EXCEL_INDICATORS/EVIDENCE_CHECKLIST/EVIDENCE_PACK_ZIP) via docx/pdfkit/exceljs/archiver | Add `DONOR_TEMPLATE` export type; docxtpl rendering lives in Python workers |
| Workers | FastAPI workers with `/v1/draft-section`, `/v1/rewrite-section`, `python-docx` already installed | `docxtpl` is the one new Python dependency; bounded AI helpers live here |
| Jobs | `IJobQueue` (memory/BullMQ/Kestra); production uses Kestra with deployed flows | Kestra owns report lifecycle orchestration; BullMQ excluded unless a separate low-latency case emerges |
| Capabilities | `project.setup`/`project.archive` capability-gate routes; `abac-field-policy.ts` masks financial fields by role | Permission-controlled escape hatches extend this pattern (`report.resolve-claim` capability) |
| Audit | `PrismaAuditRepository.record()` writes every mutation to `audit_events` | Claim resolutions, generation runs, and gates are audited through the existing path |

Principal paths to change:

- `packages/application/src/ports/reporting.ts`
- `packages/application/src/use-cases/reporting/generate-report-draft.ts`
- `packages/application/src/use-cases/reporting/approve-report.ts`
- `packages/application/src/use-cases/reporting/approve-report-section.ts`
- `packages/infrastructure/src/llm/report-draft-generator.ts`
- `packages/infrastructure/src/container.ts`
- `packages/infrastructure/src/analytics/`
- `packages/infrastructure/src/llm/factory.ts`
- `packages/infrastructure/src/exports/builder.ts`
- `apps/workers/app/`
- `apps/api/src/routes/reporting.ts`
- `apps/web/src/features/reporting/`

## 4. Architecture and SOLID principles

### 4.1 Dependency direction

`domain` (pure TypeScript, zero infrastructure deps) ← `application` (use-case handlers + ports) ← `infrastructure` (Prisma, storage, LLM, parsers, export builder, audit, notifications) ← `api` (thin Zod-validated routes) / `web` (RSC + server actions) / `workers` (FastAPI mirrors).

### 4.2 SOLID mapping for this feature

| Principle | Application |
|---|---|
| **S**ingle responsibility | One port per capability: `IReportPlanner`, `IIndicatorAnalyticsService`, `IReportDraftGenerator`, `IClaimVerifier`, `IGenerationRunRepository`, `IDonorTemplateMappingRepository`. No god interfaces. |
| **O**pen/closed | All AI and analytical capabilities are ports; stub adapters are swapped for real adapters without touching domain or use cases (`LLM_PROVIDER`, `JOB_QUEUE` swap points). |
| **L**iskov substitution | Every adapter satisfies the full port contract; stubs and real implementations are interchangeable and tested against the same contract tests. |
| **I**nterface segregation | The generator port accepts `VerifiedFinding[]` and `EvidencePackage[]`, never raw repositories or the entire database; the verifier receives claim + finding inputs, never write access. |
| **D**ependency inversion | Domain defines semantics + gate rules; application defines ports and orchestrates; infrastructure implements persistence/LLM/export. Use cases depend on ports only. |

### 4.3 No-duplication rules (single source of truth)

- **Indicator mathematics** exists only in the domain calculator; nothing else computes achievements, including the LLM.
- **Claim verification** reuses existing checklist types (`UNSUPPORTED_REPORT_CLAIM`, `SENSITIVE_DATA_WARNING`); no parallel decision system.
- **Generation snapshot** is the single audit boundary for a run; no parallel audit records per claim/section.
- **Provenance** reuses `EvidenceChunker` + `ProvenanceTracker`; do not reimplement chunking or thresholding.
- **Word limits** come from `TemplateSection.minWords/maxWords` + `ReportingProfile.sectionOverrides`; no duplicated limit storage.
- **Profile/template snapshots** already live on `ReportingPeriod`; `ReportGenerationRun` snapshots the remaining inputs and references them — it does not duplicate them.
- **Export** extends `IExportBuilder` with a `DONOR_TEMPLATE` type; no parallel export path.
- **Cost tracking** flows through the existing `LlmRun`/usage ledger; the feature records runs, never a second meter.
- **Orchestration** is owned by application handlers + Kestra; BullMQ is excluded unless a separate low-latency case emerges.
- **Resolution semantics** exist once in the domain; the generator contract, verifier, checklist adapter, readiness UI, and approve-handler gate all share them.

## 5. Domain model additions

### 5.1 Indicator semantics

Add to `packages/domain/src/contexts/logframe/indicator.ts`:

```ts
export type AggregationMethod = "SUM" | "AVERAGE" | "LATEST" | "MIN" | "MAX" | "RATIO" | "PERCENTAGE";
export type PerformanceDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" | "NEUTRAL";
export type SemanticsStatus = "CONFIGURED" | "INFERRED" | "REQUIRES_REVIEW";

export interface IndicatorSemantics {
  aggregation: AggregationMethod;
  direction: PerformanceDirection;
  reportingBasis: "PERIOD" | "CUMULATIVE";
  scale?: number;
  numeratorIndicatorId?: string;
  denominatorIndicatorId?: string;
  status: SemanticsStatus;
}
```

Defaults are **never silent authorities**:

- `NUMBER → SUM` is a reasonable initial aggregation default.
- `NUMBER → higher-is-better` is unsafe (mortality, disease incidence, complaints, response time, cost overruns are lower-is-better).
- `PERCENTAGE → AVERAGE` is unsafe without denominators (percentages often require weighted aggregation).

Legacy defaults use `direction: NEUTRAL` and `status: REQUIRES_REVIEW`. DonorDesk may calculate **descriptive** results, but it must not label performance positive or negative until semantics are approved (`CONFIGURED`/`INFERRED` + direction). `REQUIRES_REVIEW` semantics always produce neutral descriptive narrative.

Semantics are optional fields on `Indicator`; `update(patch)` already supports partial updates. A backfill migration derives conservative defaults (`SUM`/`NEUTRAL`/`REQUIRES_REVIEW`) for existing rows.

### 5.2 Verified finding

Add to `packages/domain/src/contexts/reporting/verified-finding.ts`:

```ts
export interface VerifiedFinding {
  indicatorId: string;
  indicatorCode: string;
  value: string;            // decimal string, never float
  unit?: string;
  calculationMethod: string; // e.g. "SUM:higher-is-better:cumulative"
  reportingPeriodId: string;
  comparisonPeriodId?: string;
  sourceRecordIds: string[]; // IndicatorUpdate IDs consumed
  qualityFlags: Array<"LOW_COVERAGE" | "MISSING_DENOMINATOR" | "MISSING_DISAGGREGATION" | "STALE" | "UNIT_MISMATCH" | "NEEDS_REVIEW">;
  computedAt: Date;
}
```

> **Implementation note (2026-08-18):** the live `VerifiedFinding` extends the
> spec above with **optional** enrichment snapshots so narrators can describe
> progress and change without recomputing anything: `indicatorName`,
> `indicatorType`, `baseline`, `target`, `semantics` (resolved
> `IndicatorSemantics`), `comparisonValue` (previous-period value), and
> `performanceEvaluation` (`PerformanceEvaluation` — POSITIVE/NEGATIVE/NEUTRAL
> produced deterministically by `evaluatePerformance`). All enrichment fields are
> optional for backward compatibility with persisted generation-run snapshots and
> are always populated by the live analyst. `PerformanceEvaluation` lives in
> `verified-finding.ts` and is re-exported from `indicator-calculator.ts`.

All arithmetic uses decimal-safe math (integer minor-unit scaling or a decimal library) — **never raw JavaScript floating point**.

### 5.3 Report plan

Add to `packages/domain/src/contexts/reporting/report-plan.ts`:

```ts
export interface ReportPlanSection {
  templateSectionId: string;
  title: string;
  inputType: SectionInputType;
  required: boolean;
  wordLimit?: { min?: number; max?: number };
  mandatoryQuestions: string[];
  evidenceNeeds: string[];
  relatedLogframeElement?: string;
}

export interface ReportPlan {
  id: string;
  tenantId: string;
  projectId: string;
  reportingPeriodId: string;
  version: number;
  sections: ReportPlanSection[];
  style: { tone: ProfileTone; language: string; formattingRules: string[] };
  generatedBy: "INFERRED" | "LLM" | "MANUAL";
}
```

Plans are generated automatically and are only surfaced for editing when the user opens them.

### 5.4 Claim provenance

Add to `packages/domain/src/contexts/reporting/report-claim.ts`:

```ts
export type ClaimType = "NUMERIC" | "FACTUAL" | "CAUSAL" | "QUALITATIVE";

export type VerificationResult =
  | "PASSED"
  | "FAILED"
  | "ACCEPTED_WITH_LIMITATION"
  | "EXCLUDED";

export interface ClaimSource {
  evidenceId: string;
  chunkId: string;
  sourceText: string;
  evidenceHash: string;
  evidenceUpdatedAt: Date;
  chunkerVersion: string;
}

export interface ReportClaim {
  id: string;
  tenantId: string;
  sectionId: string;
  text: string;
  type: ClaimType;
  sources: ClaimSource[];
  verificationResult: VerificationResult;
  verificationDetail: string;
  resolutionNotes?: string;
  resolvedById?: string;
  resolvedAt?: Date;
}
```

The durable relationship is:

```text
ReportClaim → ClaimSource → EvidenceChunk → EvidenceFile → original file/version (hash)
```

`evidenceHash` snapshots the bytes used at generation so later evidence changes cannot silently alter an approved report. `chunkerVersion` records the chunking logic version, because identical bytes can produce different chunks after chunking changes.

### 5.5 Generation run snapshot

Add to `packages/domain/src/contexts/reporting/generation-run.ts`:

```ts
export interface GenerationRunSnapshot {
  id: string;                 // generationRunId
  tenantId: string;
  projectId: string;
  reportingPeriodId: string;
  draftId: string;
  templateVersion: number;
  profileVersion: number;
  mappingVersion?: number;
  plannerVersion: number;
  indicatorUpdateIds: string[];
  evidenceIds: string[];
  verifiedFindings: VerifiedFinding[];
  modelId: string;
  promptVersion: number;
  generationParams: Record<string, string>;
  createdAt: Date;
}
```

`ReportGenerationRun` is the immutable audit boundary. Rewrites create child runs or section-run records referencing the original run; the audit snapshot is never mutated.

### 5.6 Donor template mapping

Add to `packages/domain/src/contexts/templates/donor-template-mapping.ts`:

```ts
export interface TemplateRegionMapping {
  regionId: string;            // heading/table/field in the donor DOCX
  templateSectionId: string;   // DonorDesk section
  placeholderKey: string;      // docxtpl placeholder
  mappedBy: "AUTO" | "MANUAL";
  status: "DRAFT" | "REVIEWED" | "APPROVED";
}

export interface DonorTemplateMapping {
  id: string;
  tenantId: string;
  templateId: string;
  version: number;             // increments per approved revision
  regions: TemplateRegionMapping[];
  approvedById?: string;
  approvedAt?: Date;
}
```

`ReportingPeriod` gains `donorTemplateVersion` and `mappingId` snapshot columns (in addition to the existing `templateSnapshotJson`). Mappings are cached by `templateId:version`.

### 5.7 Domain errors and capabilities

- Extend `DomainErrorCode` with `REPORT_GATE_BLOCKED`, `REPORT_CLAIM_VERIFICATION_FAILED`, `REPORT_SEMANTICS_UNRESOLVED`, `REPORT_TEMPLATE_MAPPING_MISSING`.
- Add capability `report.resolve-claim` (report managers) and grants-level capability `report.override-confidentiality`.

## 6. Port and use-case changes

### 6.1 New application ports

In `packages/application/src/ports/reporting.ts` and adjacent port files:

- `IIndicatorAnalyticsService` — `computeFindings(input): Promise<Result<VerifiedFinding[], DomainError>>`; deterministic; no LLM.
- `IReportPlanner` — `plan(input): Promise<Result<ReportPlan, DomainError>>`; inferred/LLM/manual.
- `IClaimVerifier` — `verify(claim, findings, evidence): Promise<Result<ClaimVerification, DomainError>>`; tiered, deterministic-first.
- `IGenerationRunRepository` — create/find generation runs.
- `IDonorTemplateMappingRepository` — create/find by `(templateId, version)`.

### 6.2 Generator contract change (first commit)

Replace the string-summary input of `IReportDraftGenerator.generateDraft` (reporting.ts:27-38):

```ts
interface GenerateReportDraftInput {
  reportPlan: ReportPlan;
  verifiedFindings: VerifiedFinding[];
  evidencePackages: EvidencePackage[];
  reportingProfileSnapshot: ReportingProfileSnapshot;
  generationRunId: string;
}
```

All string-based analytical summaries are removed. The LLM narrates verified findings; it never computes. `SourceReference` extends to carry `claimId`/`chunkId`, and sections return structured claims alongside prose:

```ts
interface GeneratedSection {
  sectionId: string;
  title: string;
  content: string;
  claims: ReportClaimDraft[];  // each with text + type + proposed ClaimSource
  sourceReferences: SourceReference[];
}
```

### 6.3 Approval gate and reject transition

- `ApproveReportHandler` (approve-report.ts:15): before `draft.approve()`, evaluate the gate policy against checklist items (`UNSUPPORTED_REPORT_CLAIM`, `SENSITIVE_DATA_WARNING`), claim resolutions, and semantics status. Block on numeric contradiction / confidentiality / unresolved semantics.
- Add a reject/request-changes transition to `ReportDraft` + handler (closes the `pending.md` gap) so Block outcomes are actionable.
- `ApproveReportSectionHandler`: gate section approval on the section's claim resolutions.
- Add `RejectReportHandler` and `RequestReportChangesHandler` (or one handler with a `REJECT` action) with audit events.

### 6.4 Claim verification tiers (ordered by cost)

1. Numeric exact match against `VerifiedFinding` (deterministic, zero LLM cost — the common case).
2. Unit and period match (deterministic).
3. Factual entailment (chunker + LLM, evidence-backed).
4. Qualitative evidence coverage (minimum source-count threshold).
5. Elevated causal-claim review (higher threshold; report-manager decision).

Unsupported claims are **blocked from approval**, not merely labelled.

### 6.5 Orchestration ownership

- **Application handlers** own the business workflow (plan → analyze → draft → verify → gate → export).
- **Kestra** owns cross-service/scheduled/operational execution (report lifecycle flows, retries).
- **BullMQ** is excluded unless a separate low-latency application job genuinely requires it.
- **Python workers** handle document parsing/rendering (`docxtpl`) and bounded AI helpers; the deterministic analyst runs in the TypeScript domain/application, testable with no provider.

## 7. Persistence and migration

### 7.1 New Prisma models

Add to `packages/infrastructure/prisma/schema.prisma`:

- `ReportPlan` — `id`, `tenantId`, `projectId`, `reportingPeriodId`, `version`, `sectionsJson`, `styleJson`, `generatedBy`, timestamps; unique `(reportingPeriodId, version)`.
- `ReportClaim` — `id`, `tenantId`, `sectionId`, `text`, `type`, `sourcesJson`, `verificationResult`, `verificationDetail`, `resolutionNotes`, `resolvedById`, `resolvedAt`, timestamps.
- `ReportGenerationRun` — `id`, `tenantId`, `reportingPeriodId`, `draftId`, `snapshotJson`, `createdAt`; immutable; index `(draftId)`.
- `DonorTemplateMapping` — `id`, `tenantId`, `templateId`, `version`, `regionsJson`, `approvedById`, `approvedAt`, timestamps; unique `(tenantId, templateId, version)`.

### 7.2 Existing schema changes

- `Indicator` — add optional `semanticsJson`; backfill conservative defaults.
- `ReportSection` — keep `sourceReferences`/`unsupportedClaims` for UI compatibility; claims become the structured source of truth.
- `ReportingPeriod` — add `donorTemplateVersion` and `donorTemplateMappingId`.
- `ReportDraft` — no schema change (reject transition is a domain state machine change).

## 8. Phased delivery plan

### Phase 0 — Contracts and analytical integrity

**Goal:** correctness boundary for numbers before any LLM involvement.

1. Add domain primitives: `IndicatorSemantics`, `VerifiedFinding`, `Resolution` enum, gate-rule definitions, domain error codes, `report.resolve-claim` capability.
2. **Change the generator port first** (`GenerateReportDraftInput` with `VerifiedFinding[]`; §6.2). Everything downstream depends on the contract.
3. Implement the pure `computeIndicator()` calculator with decimal-safe math and golden tests:
   - aggregation methods (incl. weighted percentage via numerator/denominator);
   - direction-aware wording gating (`NEUTRAL`/`REQUIRES_REVIEW` → descriptive only);
   - baseline applicability, target type (period/annual/cumulative/endline);
   - numerator/denominator validation, unit/scale handling;
   - quality flags: low coverage, missing denominator, missing disaggregation, stale, unit mismatch.
4. Add silent inference (`INFERRED` from type/unit/name/sector packs) and descriptive fallback (`REQUIRES_REVIEW`).
5. Add previous-period repository queries (`findByReportingPeriod` across adjacent periods) and period-on-period comparison.
6. Add `ReportGenerationRun` immutable snapshot (persist at run start; never mutate).
7. Add application `IIndicatorAnalyticsService` + repository wiring; `list-period-indicators.ts` remains the read model feeding the analyst.

**Gate:** all calculator tests pass with no provider; migration on production-like snapshot; previous-period queries return correct deltas; snapshot immutability proven by test.

### Phase 1 — Claim provenance and verification

**Goal:** every material claim is traceable and independently verified; approval gates enforced.

1. Add `ReportClaim`/`ClaimSource` domain + Prisma model + repository.
2. Wire `EvidenceChunker` + `ProvenanceTracker` into generation; store `chunkerVersion`.
3. Implement tiered `IClaimVerifier` (deterministic tiers first; LLM tiers behind provider swap).
4. Compute `evidenceHash` at generation time; persist `sourceText` snapshots.
5. Wire `ApproveReportHandler` gate + section-approval gate; add reject/request-changes transition.
6. Feed verdicts into existing checklist items (`UNSUPPORTED_REPORT_CLAIM`, `SENSITIVE_DATA_WARNING`).
7. Close `REP-06` (`memorybank/pending.md`).

**Gate:** verification integration tests prove 0 silent conversion (claim status never mutates to VERIFIED without passing verification); audit events cover every resolution; approval blocked on numeric contradiction/confidentiality.

### Phase 2 — Planner, writer, and verifier via Kestra

**Goal:** real generation with the LLM strictly as narrator/planner/reviewer.

1. Implement `IReportPlanner` (inferred default; LLM optional; manual override).
2. Wire the real LLM provider (`LLM_PROVIDER`; container wiring) and `CompliantModelRouter` for the drafting/verification capabilities.
3. Replace `StubReportDraftGenerator` with a real generator that consumes `GenerateReportDraftInput`, emits structured claims + prose, and records `LlmRun` for every run.
4. Route drafting and verification through Kestra flows (report lifecycle); deterministic analyst stays synchronous in application.
5. Add `ReportPlan` persistence + read model.

**Gate:** generated sections contain only claims supported by verified findings; every run records model/prompt/tokens/cost; Kestra retry/idempotency verified; a Kestra failure cannot create a second draft (idempotency keys).

### Phase 3 — Readiness and resolution UX

**Goal:** one consolidated decision surface at submission; batch-first rules.

1. Compose the readiness panel from checklist items + claim records + semantics status (§2.3).
2. Implement resolution flows with permission-controlled escape hatches:
   - `VERIFIED`, `AI_REDRAFTED`, `SOURCE_ADDED` auto-resolve;
   - `ACCEPTED_WITH_LIMITATION` requires one aggregate note + `report.resolve-claim` capability;
   - `EXCLUDED` requires the `report.override-confidentiality` capability for confidential sources.
3. Batch-first: "Fix automatically", "Review 3 items", "Accept limitations", "apply to this donor/template".
4. Wire reject/request-changes UI path.
5. Audit every resolution through `PrismaAuditRepository`.

**Gate:** four-action happy path (`Select → Generate → Review → Submit`) has zero mandatory screens; the readiness panel shows only unresolved exceptions; Playwright covers the panel, bulk actions, and permission denials.

### Phase 4 — Donor-template mapping and export

**Goal:** populate real donor templates with versioned, approved mappings.

1. Add `DonorTemplateMapping` domain + Prisma model + repository.
2. Template-onboarding flow (once per donor template):
   1. Upload donor template (existing `TolerantDocumentParser`).
   2. Parse headings, tables, fields, and instructions.
   3. Auto-map regions to DonorDesk sections by heading similarity (cacheable, LLM-assisted).
   4. Insert/generate docxtpl placeholders.
   5. Preview populated output.
   6. Manual correction.
   7. Version and approve the mapping.
   8. Lock the approved template version + mapping ID onto `ReportingPeriod`.
3. Add `DONOR_TEMPLATE` to `ExportType` and `IExportBuilder`; render via `docxtpl` in the Python workers (one new dependency).
4. Cache parsed mappings by `templateId:version`; do not reparse on every export.
5. Visual fidelity verification for DOCX and PDF.

**Gate:** mapping onboarding works end-to-end for a real donor DOCX; approved mapping is immutable and locked to the period; export renders placeholders with verified findings; version changes require re-approval.

### Phase 5 — End-to-end validation and rollout

1. Validate the four-action happy path through end-to-end simulation on a seeded project with a mapped donor template.
2. Verify §2.6 metrics as automated acceptance checks (e2e + golden tests).
3. Roll out by tenant cohort; monitor generation success, gate block rates, acceptance-with-limitation rates, and user time from period selection to submission.

**Gate:** all §2.6 acceptance criteria pass; no regression in features 06/11/12/13/14; release runbook complete.

## 9. Required test matrix

### Domain (pure, no provider)

- Semantics: every aggregation method, weighted percentage, direction gating, `REQUIRES_REVIEW` → descriptive-only invariant ("0 evaluative from unresolved").
- Decimal safety: boundary cases, rounding, ratio with zero denominator, unit/scale conversion.
- Gate rules: every row of the §2.4 table as a pure function test.
- Claim model: resolution transitions, `ACCEPTED_WITH_LIMITATION` preserves failed status, source hash immutability.
- ReportPlan and GenerationRun invariants.

### Application

- `IIndicatorAnalyticsService`: previous-period deltas, quality flags, source-record IDs.
- Generator contract: inputs are `VerifiedFinding[]`; no string analytics; generated claims map to findings.
- Approve gate: block on numeric contradiction/confidentiality/unresolved semantics; allow verified/descriptive; warn on missing optional evidence.
- Claim verifier tier order and cost (deterministic tiers short-circuit LLM).
- Reject/request-changes transitions; audit events for every resolution.

### Infrastructure

- Chunker/provenance integration; `chunkerVersion` change invalidates old claims correctly.
- `LlmRun` recorded for every generation/verification run; idempotency prevents duplicate drafts on Kestra retry.
- `docxtpl` rendering + mapping cache invalidation on version bump.

### API and web

- Readiness panel shows only unresolved exceptions; bulk actions; permission-controlled escape hatches.
- Four-action happy path (Playwright); export preflight includes `DONOR_TEMPLATE`.

## 10. Definition of done

Feature 20 is complete only when:

- the four-action happy path works with zero mandatory configuration screens for a mapped donor template;
- all deterministic checks execute automatically and all material claims retain provenance;
- zero evaluative statements arise from unresolved semantics;
- no failed verification is ever silently converted to "verified";
- every generation run is reproducible from an immutable `ReportGenerationRun` snapshot;
- approval and submission are blocked by the gate policy and rejection returns to a draft state;
- claim resolutions, gates, and generation runs are fully audited;
- donor-template mappings are versioned, approved, and locked to the reporting period;
- migrations, tests, typechecks, builds, runbooks, and rollback pass;
- features 06/11/12/13/14 remain non-regressed.

## 11. Explicit non-goals (no duplication)

- No external research agents (STORM/GPT Researcher) in the core — donor reports use monitored DonorDesk data.
- No PandasAI/Data Formulator as the analytical authority — the deterministic analyst is native domain math.
- No LangChain/LangGraph dependency — the workflow pattern is implemented in TS ports/handlers + Kestra.
- No parallel claim-decision engine — the checklist system composes the exception surface.
- No second cost meter — `LlmRun`/usage ledger is the only meter.
- No parallel export path — `IExportBuilder` gains a type.
- No BullMQ in the report lifecycle unless a separate low-latency case emerges.

## 15. Report charts (IMPLEMENTED 2026-08-17)

Users can attach a chart to any indicator-named report section and switch its
type (BAR / LINE / PIE / AREA / RADAR / GAUGE) before finalising the report.

Design decisions:

- **One engine, two render targets.** `buildChartOption` (pure, in
  `packages/domain/src/contexts/reporting/chart-config.ts`) produces an
  ECharts option object. The interactive `ReportChartPanel` (web client)
  renders it live; the export path (`chart-png-renderer.ts`) runs the same
  function through ECharts SSR (`renderer: "svg", ssr: true`) and rasterises
  to PNG with `sharp`. The exported image is therefore pixel-identical to
  what the user approved.
- **Shared data, no new queries.** Chart series come from the existing
  period-indicators endpoint (baseline / target / periodAchievement / status).
  `resolveChartData` is a pure, decimal-safe transform.
- **Persistence.** `ReportSection.chartConfigJson` (migration
  `20260817183000_report_charts`), updated via
  `PATCH /v1/report-sections/:id/chart` with optimistic concurrency.
- **Performance.** ECharts is `import()`-ed lazily so the initial route chunk
  never includes it; the SSR renderer is content-hash cached in memory
  (`renderChartPngCached`), so re-exports of an unchanged finalized report are
  instant.
- **Client-bundle hygiene.** The web client imports
  `@donordesk/domain/contexts/reporting/chart-config.js` (subpath export),
  never the domain index — the index pulls `domain-event.ts` which imports
  `node:crypto` and would break the webpack client build.

Scope notes: chart rendering intentionally avoids headless browsers
(no Puppeteer); SVG -> PNG via sharp keeps the export path dependency-light.
Status-distribution and indicator-comparison bindings ship; per-indicator
disaggregation (M/F/children) is future work (Feature 06 pending).

## 16. Report data completeness — evidence/activity/indicator context (IMPLEMENTED 2026-08-17)

Deep audit finding: generated drafts effectively ignored saved Evidence and
Activities. Evidence packages carried only `aiSummary`/`title` (stub summaries,
never document content), and activity narratives never reached the narrator.
Fixed end-to-end (see `../Fixes.md` for the full finding list):

1. **Evidence: real document text persisted + cited.**
   - `EvidenceFile.extractedText` column (migration
     `20260817200000_evidence_extracted_text`), mapped in the Prisma repo + DTO.
   - `POST /internal/evidence/:id/tags` accepts `extractedText`
     (`PersistTagsBodySchema`); `PersistEvidenceTagsHandler` stores it via
     `EvidenceFile.setExtractedText`.
   - Kestra `evidence_parse.yml` sends the Tika-extracted text in the persist body.
   - `EvidencePackageBuilder` chunks `extractedText || aiSummary || title`, so the
     narrator sees the actual document content; claims carry
     `proposedSources` (evidenceId/chunkId/sourceText) and claim verification
     passes on real coverage.
2. **Activities: full narrative in the generation input.**
   - `GenerateReportDraftInput.activities: ActivityGenerationContext[]`
     (summary, achievements, challenges, lessonsLearned, nextSteps, participants,
     location, linked evidence, status) built by `GenerateReportDraftHandler`.
   - Stub narrates activity records, achievements, challenges, and lessons
     verbatim with `activity` source references; the LLM prompt gains
     `# Activity Records`.
3. **Indicators: update detail in the generation input.**
   - `GenerateReportDraftInput.indicatorUpdates: IndicatorUpdateGenerationContext[]`
     (period/cumulative achievements, comments, dataSource, linked evidence).
   - Indicator sections surface M&E comments/dataSource; the LLM prompt gains
     `# Indicator Updates`.
4. **Citations render.** The report workspace shows statement-level sources
   (claims with evidence chips + verification status) replacing the
   "paragraph-level provenance not available yet" note. `ReportClaim.sources`
   already carried the hashed chunk provenance from Phase 1.
5. **Reproducibility.** `ReportGenerationRun` snapshots now include `activityIds`.

Verification: `pnpm -r typecheck` and `pnpm -r build` pass; 74 infrastructure
tests + 32 workers tests pass. Requires migration
`20260817200000_evidence_extracted_text` on deploy; existing evidence rows get
`extractedText` when the `evidence_parse` flow re-runs for them.

## 17. Professional report context — indicator metadata, project/period/template, performance gating (IMPLEMENTED 2026-08-18)

Deep review of the AI report pipeline found the narrator received thin findings
(code + value only), no project/donor context, no targets/baselines, and no
previous-period values — so drafts could not describe "IND-001 (Beneficiaries
trained) reached 85% of its 1,000 target, up from 500 last period." Fixed
end-to-end (release `20260818074405`, API + web; see `../Fixes.md`):

1. **Indicator metadata reaches the finding.**
   - `VerifiedFinding` gains optional `indicatorName`, `indicatorType`,
     `baseline`, `target`, and `semantics`; `computeIndicator` emits them from
     the `Indicator` definition.
   - **Bug fix:** the analyst computed the previous-period value
     (`comparisonPeriodFindingValue`) but `computeIndicator` only stored
     `comparisonPeriodId` — the value was silently dropped. It is now emitted as
     `comparisonValue`, so narrators can state "up from X in the previous period".
2. **Deterministic performance gating.**
   - `computeIndicator` now calls `evaluatePerformance` (pure, direction-aware)
     and emits `performanceEvaluation` (`POSITIVE`/`NEGATIVE`/`NEUTRAL`). The
     narrator is allowed evaluative wording only when the finding permits it;
     `NEUTRAL`/unresolved always stays descriptive — preserving the
     "0 evaluative statements from unresolved semantics" invariant from §2.6.
3. **Project/period/template context.**
   - `GenerateReportDraftInput` gains optional `reportContext`
     (`ReportGenerationContext`: project identity/geography/sector/duration/
     budget/description/reporting frequency; reporting period type/dates/
     deadlines/readiness; donor template name/version/language/required annexes/
     notes). `GenerateReportDraftHandler.buildReportContext` threads the real
     domain entities; legacy callers without the field degrade gracefully.
4. **Prompt engineering.**
   - `# Project Context`, `# Reporting Period`, and `# Donor Template` blocks;
     formatting rules surfaced from the profile.
   - Per-section guidance: input type (NARRATIVE/TABLE/ANNEX/INDICATOR_TABLE/
     COMPLIANCE), mandatory questions, evidence needs, word limits, related
     logframe element — so INDICATOR_TABLE sections are tables, ANNEX sections
     list files, COMPLIANCE sections state compliance status.
   - Evidence packages carry `evidenceType`, `verificationStatus`,
     `confidentialityLevel` and are truncated at **8 chunks × 800 chars** (was
     3 × 600).
   - Activity records carry participant disaggregation
     (male/female/children/disability).
   - Quality flags map to explicit caveat language (LOW_COVERAGE → "based on
     partial records"; NEEDS_REVIEW → "requires verification"; etc.).
   - System prompt gains a worked example section.
5. **Stub parity.** The stub narrator now shows indicator names, targets,
   previous-period values, and performance hints in summaries and tables.
6. **No timeout regression.** `maxTokens` stays **4096** (see §29 change log in
   `../contabo-ops.md`: 8192 caused MiniMax timeouts that burned credits via stub
   fallback). The larger prompt fits the 120 s MiniMax adapter + 180 s web-gateway
   budgets already in production.

Verification: full release gate green (`pnpm -r typecheck`, `pnpm -r build`,
241 tests across contracts/domain/application/infrastructure/api with 0
failures); release-package smoke tests passed; deployed `20260818074405` and
verified live — deployed dist contains the enriched prompt + `buildReportContext`
handler, `/health` + `/ready` OK, web `/login` 200, no journal errors.

## 18. Professional donor-reporting hardening (IMPLEMENTED 2026-08-19)

The phased plan `../imp/PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md` (Phases
0–9, status **IMPLEMENTED**) is shipped in release `20260819090000` (API + web +
migration `20260818180000_professional_reporting`). It hardens Feature 20 so
approved outputs can be treated as donor-submission candidates:

- **Revision integrity (Phase 1).** Immutable `ReportRevision` (content hash,
  parent/child numbering, change origin, actor/model/prompt, assurance state
  `UNASSESSED→ASSESSING→CURRENT|FAILED`, `STALE`). All content mutations go
  through one `IReportRevisionService`; section approval requires `CURRENT`
  assurance bound to the exact revision. Rewrites create child generation runs
  with prompt/response hashes. A baseline revision is backfilled for every
  pre-existing section and its claims are bound to it (`UNASSESSED` until a
  re-assessment produces a SHA-256 revision).
- **Assertion coverage (Phase 2).** `IAssertionExtractor`
  (`DeterministicAssertionExtractor`) re-extracts assertions from the final
  normalized content after every generation/edit/rewrite and reconciles them
  with the writer's `claims` by stable fingerprint — an empty `claims` array can
  never bypass verification. Materiality: numeric/causal/compliance
  (safeguarding, incident, budget, target-performance, donor-commitment) are
  material by default; factual/qualitative/forecast/recommendation only when
  they carry a numeric atom. Coverage gaps project into
  `UNSUPPORTED_REPORT_CLAIM` checklist items with deterministic dedup keys.
- **Structured numeric verification (Phase 3).** Every numeric atom is bound to
  indicator, reporting period, unit, entity, and semantic role
  (ACHIEVEMENT/TARGET/BASELINE/COMPARISON/PERCENT/CURRENCY/DATE); percentages can
  be derived from value/target or value/baseline via domain decimal math only.
  All reason codes are enums (`VerificationReasonCode`) consumed by gates via
  `gateKindForReason` — never prose string matching.
- **Evidence validity and entailment (Phase 4).** Exact evidence/chunk existence,
  hash, source-text, parser/chunker-version validation runs before semantic
  verification; `DeterministicEvidenceRetriever` ranks evidence; entailment
  returns supported/contradicted/insufficient/uncertain; causality is never
  auto-approved. Evidence text is data (prompt-injection/PII tests).
- **Requirement packs (Phase 5).** Versioned `ReportingRequirementPack`,
  award-specific `AwardReportingOverride`, and immutable
  `ResolvedReportingRequirements` snapshots merged by a deterministic precedence
  resolver (award/amendment → schedule → mechanism → donor pack → org profile →
  baseline) with full provenance; `IRequirementEvaluator` computes coverage
  (exact `requirementKeys`, title match, word limits). Packs require human
  review before activation.
- **Narrative quality (Phase 6).** Rewrite prompts are neutral and
  evidence-proportionate (no "positive, impact-focused" instruction), preserve
  caveats, and record prompt/response hashes.
- **Submission gates and snapshots (Phase 7).** ONE `evaluateReportGate` policy
  is shared by report approval, export preflight, submission-snapshot creation,
  and server-side export enforcement. `SubmissionSnapshot` freezes approved
  revision IDs/hashes, the resolved requirement snapshot + coverage,
  assertion/evidence/annex manifests, approval records, and authorized
  overrides. `POST /v1/exports` accepts `exportIntent`; donor submissions
  require a sealed snapshot and are never watermarked, internal previews are
  always watermarked. Template/mapping version correctness and open
  critical/high + sensitive-data checklist items block submission.
- **Donor-native rendering (Phase 8).** `DONOR_TEMPLATE` stays worker-backed
  (`docxtpl`); the TS-side export builder enforces intent/watermark invariants.
  Deep template fidelity (headers/logos/numbering) remains the documented
  worker swap point.
- **Evaluation and security (Phase 9).** Anonymized golden corpus (UN OCHA,
  USAID/BHA, DG ECHO, Gavi/GF, GPE, climate) with a deterministic
  `reporting:eval` CLI (`pnpm --filter @donordesk/infrastructure reporting:eval`),
  a shared `IClaimVerifier` contract suite, and adversarial security tests.

API additions: `GET /v1/report-drafts/:id/assurance`,
`POST /v1/report-sections/:id/reassess`,
`POST /v1/reporting-periods/:id/resolve-requirements`,
`POST /v1/reporting-requirement-packs` (+ `/:id/activate`),
`POST /v1/award-reporting-overrides`,
`POST /v1/report-drafts/:id/submission-snapshot`, and `exportIntent`/
`submissionSnapshotId` on `POST /v1/exports`.

ADRs: `docs/architecture/decisions/0005-report-revisions.md` through
`0009-donor-native-rendering.md`; ownership map at
`../imp/REPORTING-OWNERSHIP-MAP.md`.

Remaining known follow-ups (non-blocking): transactional generation state
machine, LLM-backed entailment/extraction swap-ins, worker `docxtpl` fidelity +
visual diffs, and the consolidated web exception surface (API contract live).
