# Professional Donor Reporting — Comprehensive Phased Implementation Plan

**Created:** 2026-08-18  
**Status:** PROPOSED  
**Scope:** Hardening and completing Feature 20 so approved outputs can be treated as donor-submission candidates for institutional funders such as UN agencies, USAID/BHA, DG ECHO/EU, Gavi, the Global Fund, GPE, climate funds, and bilateral donors.

## 1. Purpose and outcome

DonorDesk already has the correct foundation: deterministic indicator analysis,
structured claims, evidence-hash snapshots, generation runs, report plans,
approval gates, editable sections, checklist integration, exports, LLM-provider
abstraction, and audit events. This plan extends those components. It does not
replace them or create parallel reporting machinery.

The target outcome is:

```text
Award requirements + approved template + verified project data
  -> reproducible draft
  -> complete claim verification
  -> controlled human approval
  -> immutable submission snapshot
  -> donor-native export package
```

The default user path remains:

```text
Select period -> Generate -> Review exceptions -> Submit
```

“Submission-ready” means the system can demonstrate that:

1. every material assertion in the current revision was detected;
2. every detected assertion has a current, structured verification result;
3. every source points to the exact evidence bytes used;
4. all numbers, units, periods, entities, and derivations were checked;
5. award-specific requirements override generic donor guidance;
6. the final artifact came from the approved immutable revision;
7. the document preserves the required donor template and annex structure; and
8. every exception, override, approval, and export is auditable.

## 2. Governing product rule: there is no universal donor standard

DonorDesk must model reporting requirements at this identity:

```text
donor + funding mechanism + report type + agreement/template version + language
```

The applicable award agreement always has precedence over a reusable donor
pack. Two awards from the same donor can legitimately have different deadlines,
questions, indicators, annexes, word limits, declarations, and approval rules.

### 2.1 Ruleset precedence

One resolver applies requirements in this order, from highest to lowest:

1. signed award/agreement amendment effective for the reporting period;
2. award-specific reporting schedule and uploaded template version;
3. funding-mechanism rules;
4. donor/report-type pack;
5. organization reporting profile;
6. conservative DonorDesk baseline.

The merge must be deterministic, field-aware, versioned, and explainable. The
resolved snapshot records the source of every rule. Lower-precedence rules may
fill gaps but must never silently override a higher-precedence rule.

### 2.2 Cross-donor baseline vocabulary

Reusable requirement primitives cover the common institutional expectations:

- project, award, period, organization, partner, and geographic identity;
- executive summary;
- outcome/output/indicator progress;
- planned versus achieved results and variance explanations;
- activity implementation;
- beneficiary totals and disaggregation;
- monitoring methodology, evidence, and data-quality limitations;
- risks, assumptions, constraints, and mitigations;
- safeguarding, protection, gender, disability, inclusion, PSEA, and AAP;
- complaints, fraud, incidents, and compliance disclosures;
- partnerships, localization, and stakeholder coordination;
- budget versus expenditure, forecast, and value for money;
- changes requiring donor approval;
- lessons, adaptation, sustainability, exit, or transition;
- communications and visibility obligations;
- required annexes, declarations, financial statements, and supporting files.

These are composable requirement types, not a mandatory universal report.

## 3. Architectural constraints

### 3.1 Layer ownership

| Layer | Owns | Must not own |
|---|---|---|
| `packages/domain` | Requirement precedence, revision validity, assertion and verification states, calculation and gate policies, submission invariants | Prisma, HTTP, provider SDKs, document rendering |
| `packages/application` | Use-case orchestration and narrow ports | Concrete repositories, LLM adapters, DOCX/PDF libraries |
| `packages/infrastructure` | Prisma adapters, retrieval, LLM adapters, document parsing/rendering, storage, audit and queue adapters | Business policy |
| `apps/api` | Authentication, authorization, Zod validation, thin route-to-handler wiring | Report logic |
| `apps/web` | RSC reads, server-action writes, review and exception UX | Reimplementation of gates or calculations |
| `apps/workers` | Bounded parsing/rendering and optional entailment execution | Lifecycle authority or indicator mathematics |
| Kestra | Cross-service execution, retries, schedules, and operational observability | Domain decisions |

All expected failures return `Result<T, DomainError>`. Every mutation is audited.
All aggregate roots remain tenant-scoped and covered by RLS.

### 3.2 SOLID compliance

- **Single responsibility:** separate resolvers for requirements, assertions,
  numeric verification, source validation, entailment, gates, snapshots, and
  rendering. A coordinator composes them but implements none of their rules.
- **Open/closed:** donor packs, requirement evaluators, verifier strategies,
  renderers, and LLM providers are registries behind ports. Adding a donor or a
  verification method does not modify orchestration.
- **Liskov substitution:** stub and production adapters share contract suites.
  An adapter cannot return a stronger assurance level than its contract permits.
- **Interface segregation:** read, write, resolution, rendering, and verification
  ports stay narrow. No service receives a repository it does not need.
- **Dependency inversion:** application depends on ports and domain policies;
  infrastructure supplies implementations.

### 3.3 No-duplication map

| Concern | Single source of truth | Required extension |
|---|---|---|
| Indicator mathematics | `computeIndicator` / `IIndicatorAnalyticsService` | Add missing structured checks only here |
| Report structure | `ReportPlan` | Attach resolved requirement IDs and coverage |
| Evidence chunks | existing evidence package/chunker | Add exact chunk lookup and validation; no second chunker |
| Claims/assertions | `ReportClaim` | Evolve it into revision-bound assertions or migrate once to a renamed aggregate |
| Verification policy | `IClaimVerifier` + domain gate rules | Compose narrow verification strategies behind the existing facade |
| Compliance exceptions | existing `ChecklistItem` | Project unresolved verification/requirement failures into existing item types |
| Readiness | existing reporting readiness composition | Consume the same gate/read-model output |
| Template mapping | `DonorTemplateMapping` | Add region fidelity and approval metadata |
| Generation audit | `ReportGenerationRun` + `LlmRun` | Add hashes, retrieval manifest, child rewrite runs |
| Approval | existing section/report handlers | Require current revision assurance |
| Export | `IExportBuilder` / `CreateExportHandler` | Add submission mode and real donor renderer |
| Cost | existing usage ledger and `LlmRun` | Record new AI calls through the same ledger |
| Workflow | application handlers + Kestra | No parallel BullMQ report workflow |

Before adding any model, port, handler, table, or UI state, implementation must
document why the existing owner cannot be extended. Duplicate concepts are a
release blocker.

## 4. Target domain model

Names below are conceptual; implementation must extend current aggregates where
their invariant boundary already matches.

### 4.1 Reporting requirement pack

`ReportingRequirementPack` is a versioned reusable definition keyed by donor,
mechanism, report type, version, and language. It contains typed requirements,
not prose-only instructions.

```ts
type RequirementKind =
  | "SECTION" | "QUESTION" | "FIELD" | "INDICATOR"
  | "ANNEX" | "DECLARATION" | "FINANCIAL"
  | "SAFEGUARD" | "APPROVAL" | "DEADLINE" | "FORMAT";

interface ReportingRequirement {
  id: string;
  kind: RequirementKind;
  required: boolean;
  severity: "INFO" | "WARNING" | "BLOCKING";
  condition?: RequirementCondition;
  evidenceRule?: EvidenceRule;
  wordLimit?: { min?: number; max?: number };
  sourceReference: RequirementSourceReference;
}
```

`AwardReportingOverride` stores award-specific differences and their source
document/hash/effective dates. `ResolvedReportingRequirements` is an immutable
snapshot attached to a reporting period and generation run.

### 4.2 Report revisions

Add an explicit immutable `ReportRevision` boundary. Mutable editing creates a
new revision; it never changes the meaning of previously verified text.

Minimum fields:

- draft, section, tenant, and generation-run IDs;
- revision number and parent revision ID;
- normalized content and content hash;
- change origin: generation, manual edit, rewrite, auto-fix, or merge;
- actor/model/prompt identifiers;
- created timestamp;
- assurance state: `UNASSESSED`, `ASSESSING`, `CURRENT`, `STALE`, `FAILED`.

`ReportSection` points to its current revision. Approval records bind to a
revision ID and hash, never only to a mutable section ID.

### 4.3 Structured assertions

The existing `ReportClaim` becomes revision-bound. “Assertion” is the product
term; retain the database/table name if renaming would create needless churn.

Each assertion stores:

- exact text span and character offsets in the normalized revision;
- type: numeric, factual, qualitative, causal, forecast, recommendation, or
  compliance declaration;
- materiality and extraction origin;
- structured subject, predicate, object, geography, population, and period;
- all numeric atoms with semantic roles (`ACHIEVEMENT`, `TARGET`, `BASELINE`,
  `COMPARISON`, `PERCENT`, `CURRENCY`, `DATE`, `DISAGGREGATION`);
- proposed and validated sources;
- verification-policy version and outcome;
- current/stale status.

### 4.4 Verification result

Verification reasons are enums, never inferred from human-readable strings.

```ts
type VerificationReasonCode =
  | "SOURCE_MISSING" | "SOURCE_NOT_FOUND" | "CHUNK_NOT_FOUND"
  | "SOURCE_TEXT_MISMATCH" | "EVIDENCE_HASH_MISMATCH"
  | "EVIDENCE_UNVERIFIED" | "CONFIDENTIALITY_RESTRICTED"
  | "VALUE_MISMATCH" | "UNIT_MISMATCH" | "PERIOD_MISMATCH"
  | "ENTITY_MISMATCH" | "DERIVATION_INVALID"
  | "ENTAILMENT_FAILED" | "ENTAILMENT_UNCERTAIN"
  | "CAUSAL_REVIEW_REQUIRED" | "COVERAGE_GAP"
  | "REQUIREMENT_UNSATISFIED";
```

Store per-check results and an aggregate assurance level. Human-readable detail
is presentation only. Causal assertions always require an authorized human
decision even if evidence coverage and entailment pass.

### 4.5 Submission snapshot

`SubmissionSnapshot` freezes:

- approved report/section revision IDs and hashes;
- resolved requirement snapshot and coverage result;
- assertion-verification manifest;
- evidence and annex manifest with hashes and confidentiality decisions;
- donor-template and mapping versions;
- approval records and authorized overrides;
- render-engine version and final artifact hashes.

Every donor-facing export references one submission snapshot. Internal previews
may be produced without one but must be visibly watermarked.

## 5. Cross-cutting invariants

1. Editing content invalidates assurance for the changed revision.
2. A rewrite creates a child generation/rewrite run and a new revision.
3. No material assertion may disappear from verification because the writer
   omitted it from its structured response.
4. Every numeric atom is verified; matching one number never validates a sentence.
5. Numeric verification is bound to indicator/entity, unit, period, and role.
6. `sourceText` must match the snapshotted evidence chunk.
7. Evidence count alone never proves support.
8. Causality is never auto-approved.
9. Confidential evidence requires policy authorization independent of relevance.
10. Approval binds to exact revision hashes.
11. Donor submission exports require a valid `SubmissionSnapshot`.
12. Award-specific requirements override reusable donor-pack defaults.
13. LLM output is untrusted data and never controls lifecycle or authorization.
14. Evidence and user-entered narratives are prompt-injection and PII inputs;
    they are delimited, redacted as configured, and never treated as instructions.
15. Every policy, prompt, parser, chunker, retrieval, and renderer version needed
    for reproduction is recorded.

## 6. Phased implementation

### Phase 0 — Baseline, ADRs, and characterization

**Goal:** freeze current behavior and agree ownership before schema changes.

Deliverables:

1. Write ADRs for report revisions, requirement precedence, verification
   composition, submission snapshots, and donor-native rendering.
2. Create a current-component ownership map and migration map for every proposed
   concept; reject duplicate services/tables.
3. Add characterization tests for generation, manual edit, rewrite, claim
   resolution, approval, preflight, export, credit rollback, and partial failure.
4. Capture current API contracts and production-like fixtures.
5. Correct documentation drift, including export types and completed/pending work.
6. Define anonymized golden-report fixture policy and licensing/privacy rules.

Exit gate:

- ADRs approved;
- ownership/no-duplication review complete;
- current behavior covered by tests;
- migration and rollback approach reviewed;
- no production behavior changed.

### Phase 1 — Revision integrity and stale-assurance prevention

**Goal:** content and assurance can never drift apart.

Deliverables:

1. Add `ReportRevision` and bind claims and approvals to revision ID/hash.
2. Centralize all content changes behind one application service/port:
   generation, autosave, manual edit, rewrite, shorten, auto-fix, and import.
3. On change, create a revision and mark it `UNASSESSED`; never carry forward a
   prior verification result as current.
4. Create child `ReportGenerationRun`/section-run records for rewrites, recording
   exact prompt hash, provider parameters, response hash, and parent run.
5. Make section approval require `CURRENT` assurance for its current revision.
6. Make report approval bind to the current approved section revisions.
7. Add transactional persistence or an explicit resumable generation state
   machine so draft/run/sections/claims/plan/credit updates cannot leave a
   user-visible partial success.

Exit gate:

- every mutation path creates a revision;
- stale claims cannot approve a section;
- concurrent edit tests and rollback tests pass;
- failed generation leaves either no visible draft or a clearly recoverable
  failed run;
- existing data is migrated without losing provenance.

### Phase 2 — Complete assertion discovery and coverage

**Goal:** every material statement in the revision enters the assurance pipeline.

Deliverables:

1. Add `IAssertionExtractor` with deterministic detectors first and optional LLM
   extraction behind the same port.
2. Extract assertions from final normalized content after generation or editing;
   do not trust only the writer-provided `claims` array.
3. Reconcile writer claims with extracted assertions using stable spans and
   semantic fingerprints.
4. Define materiality rules: all numeric, causal, compliance, safeguarding,
   incident, budget, target-performance, and donor-commitment assertions are
   material by default.
5. Calculate coverage metrics per section and report.
6. Block section approval when any material assertion is unregistered,
   unassessed, stale, or unresolved.
7. Project coverage gaps into existing `UNSUPPORTED_REPORT_CLAIM` checklist
   items using deterministic deduplication keys.

Exit gate:

- 100% detected material-assertion coverage in the golden corpus;
- a model response with empty claims cannot bypass verification;
- manual and rewrite paths automatically re-extract assertions;
- offsets remain correct through normalization and supported rich-text edits.

### Phase 3 — Structured numeric and consistency verification

**Goal:** verify every quantitative statement against the correct authority.

Deliverables:

1. Decompose numeric assertions into typed numeric atoms.
2. Bind each atom to indicator ID, reporting period, unit, and semantic role.
3. Extend the current deterministic verifier through narrow strategies:
   source identity, numeric value, unit, period, entity, derivation, and
   disaggregation consistency.
4. Verify all numbers in a sentence, including baseline, target, achievement,
   percentage, previous-period value, dates, participant groups, and currency.
5. Recompute derived percentages, variance, target progress, totals, and ratios
   through domain decimal math only.
6. Detect ambiguous matches and fail safely.
7. Reconcile total beneficiaries with disaggregated groups without assuming
   overlapping categories are additive.
8. Replace gate classification based on `verificationDetail` text with reason
   enums; remove contradiction double-counting.

Exit gate:

- multi-number and multi-indicator golden tests pass;
- wrong period/unit/entity cannot pass because another indicator shares a value;
- raw JavaScript floating-point is absent from report calculations;
- all gate decisions consume structured reason codes.

### Phase 4 — Evidence validity, retrieval, and entailment

**Goal:** prove that cited evidence actually supports each assertion.

Deliverables:

1. Add exact evidence/chunk existence, hash, source-text, parser-version, and
   chunker-version validation before semantic verification.
2. Add `IEvidenceRetriever` using section requirements, entities, dates,
   indicators, evidence type, verification status, and confidentiality policy.
3. Replace fixed first-chunk truncation with section-aware retrieval, diversity,
   reranking, token budgeting, and a persisted retrieval manifest.
4. Add `IEntailmentVerifier` as a bounded strategy behind `IClaimVerifier`.
   It returns supported, contradicted, insufficient, or uncertain with cited
   spans and confidence; it never directly approves a report.
5. Require temporal, geographic, population, and project alignment.
6. Require verified evidence where the requirement pack says so.
7. Make causal claims require both stronger evidence checks and human approval.
8. Redact configured PII before external-model calls and prevent evidence text
   from being interpreted as prompt instructions.

Exit gate:

- arbitrary attached evidence cannot make an unrelated claim pass;
- nonexistent/mutated chunks fail deterministically;
- retrieval recall and citation precision meet defined thresholds on the corpus;
- prompt-injection and PII-redaction security tests pass;
- provider failure yields `UNCERTAIN`/manual review, never `PASSED`.

### Phase 5 — Requirement packs and award-specific compliance

**Goal:** model what this award and this reporting cycle actually require.

Deliverables:

1. Add versioned `ReportingRequirementPack`, `AwardReportingOverride`, and
   `ResolvedReportingRequirements` using the precedence model in section 2.
2. Extend template extraction to propose typed requirements from instructions,
   headings, tables, fields, declarations, annex lists, and deadlines.
3. Require human review before a newly extracted pack or override becomes active.
4. Add `IRequirementResolver` and pluggable `IRequirementEvaluator` strategies.
5. Attach requirement IDs to `ReportPlan` sections and calculate coverage.
6. Reuse existing checklist items for unmet requirements; store requirement and
   source-document references on each item.
7. Seed conservative, versioned starter packs for selected mechanisms only from
   licensed/public guidance. Label them as defaults, not controlling agreements.
8. Add award-effective dates and amendment handling.

Exit gate:

- award overrides demonstrably win over donor defaults;
- every resolved rule shows its provenance;
- no pack is keyed only by a broad label such as `USAID` or `UN`;
- template/instruction version changes require review and produce a new snapshot.

### Phase 6 — Professional narrative and donor-quality content

**Goal:** produce evidence-proportionate professional prose without overstating results.

Deliverables:

1. Move prompts into the existing versioned prompt registry; persist exact
   prompt/template hashes and parameters.
2. Replace “positive, impact-focused” rewrite language with neutral,
   evidence-proportionate donor language.
3. Prohibit rewrite operations from removing caveats unless the underlying
   verification/checklist item has been resolved.
4. Treat activity/evidence text as data to synthesize, not instructions and not
   content that must always be copied verbatim.
5. Provide structured narrative inputs for variance, methodology, data quality,
   risk/mitigation, partnerships/localization, safeguards/AAP, budget/forecast,
   adaptation, sustainability, and visibility compliance.
6. Prevent output-level evidence from being described as outcome or impact
   evidence unless the logframe relationship and verification permit it.
7. Add section-level regenerate/tone/shorten actions through the single revision
   pipeline, preserving limitations and re-running assurance.
8. Enforce mandatory questions and word limits deterministically after drafting.

Exit gate:

- no unresolved caveat is silently removed;
- every generated section answers its applicable mandatory questions or exposes
  a blocking gap;
- output/outcome/impact terminology passes hierarchy checks;
- all rewrite paths produce new runs, revisions, assertions, and verification.

### Phase 7 — Approval and donor-submission gates

**Goal:** distinguish internal working documents from authorized submissions.

Deliverables:

1. Introduce export intent: `INTERNAL_REVIEW` or `DONOR_SUBMISSION`.
2. Reuse one application gate evaluator for report approval, readiness,
   submission preflight, and server-side export enforcement.
3. Donor submission requires:
   - approved current revisions;
   - complete material-assertion coverage;
   - current verification results;
   - verified required indicators/evidence;
   - satisfied mandatory requirements and annexes;
   - authorized claim limitations/exclusions;
   - resolved critical/high checklist items per policy;
   - completed sensitive-data authorization;
   - correct template/mapping versions.
4. Internal exports remain possible with permission and a visible watermark.
5. Capture override reason, authority, policy version, and expiry/scope.
6. Build `SubmissionSnapshot` transactionally before rendering.
7. Update UI to show one consolidated, batch-first exception surface.

Exit gate:

- direct API calls cannot bypass preflight;
- unapproved donor submissions are impossible;
- internal exports are unmistakably marked;
- readiness and export return identical decisions for identical inputs;
- snapshot creation is idempotent and fully audited.

### Phase 8 — Donor-native rendering and package fidelity

**Goal:** generate the donor’s required artifact, not a generic approximation.

Deliverables:

1. Complete `DONOR_TEMPLATE` exposure in preflight and UI.
2. Extend the existing `IExportBuilder`; do not add a separate export workflow.
3. Wire worker-based `docxtpl` rendering to approved `DonorTemplateMapping`.
4. Preserve headers, footers, logos, styles, numbering, tables, fields, page
   breaks, orientation, captions, cross-references, and annex references.
5. Validate mandatory placeholders and table cells before producing a donor
   submission artifact.
6. Build annex manifests, declarations, indicator tables, financial attachments,
   and evidence packages from the submission snapshot.
7. Produce artifact hashes and record renderer/template/mapping versions.
8. Add DOCX structural tests and PDF/image visual-diff tests with tolerances.
9. Ensure `CreateExportHandler` selects only explicitly requested evidence;
   inclusion semantics and sensitive-file behavior must be unambiguous.

Exit gate:

- real representative donor templates render without structural degradation;
- unmapped required regions block submission;
- final artifacts reproduce from the same snapshot;
- golden visual and structural comparisons pass.

### Phase 9 — Evaluation, security, reliability, and rollout

**Goal:** demonstrate quality before making submission-readiness claims.

Deliverables:

1. Build an anonymized golden corpus covering representative UN partnership,
   USAID/BHA award-specific, DG ECHO/EU, Gavi/Global Fund, education, and climate
   reporting patterns. These are mechanism fixtures, not universal donor packs.
2. Score factuality, assertion recall, verification precision, citation
   correctness, numeric accuracy, requirement coverage, limitation disclosure,
   terminology, template fidelity, and reviewer effort.
3. Add adversarial fixtures: prompt injection, conflicting evidence, stale
   sources, altered files, ambiguous units, overlapping disaggregation,
   hidden instructions, PII, and malicious DOCX content.
4. Add contract suites for all interchangeable adapters.
5. Add observability for generation/retrieval/verification/render stages without
   logging sensitive source text.
6. Load-test large evidence sets, long templates, concurrent regeneration, and
   export retries.
7. Roll out behind tenant feature flags: internal preview, controlled pilot,
   submission snapshot, then donor-native submission.
8. Publish an operational runbook, rollback plan, and known-limitations statement.

Exit gate:

- agreed evaluation thresholds pass with no critical security findings;
- full typecheck/build/test/migration/rollback gates pass;
- pilot reviewers sign off on traceability and template fidelity;
- production metrics and alerts are active;
- product wording accurately reflects the achieved assurance level.

## 7. Required ports and composition

Extend existing ports where possible. The likely target composition is:

```text
Generate/Change Section Handler
  -> IReportRevisionService
  -> IAssertionExtractor
  -> IClaimVerifier (existing facade)
       -> ISourceIntegrityVerifier
       -> INumericAssertionVerifier
       -> IConsistencyVerifier
       -> IEntailmentVerifier
       -> ICausalReviewPolicy
  -> IRequirementEvaluator
  -> existing checklist projection
  -> existing audit repository
```

Additional narrow ports may include:

- `IRequirementResolver`;
- `IRequirementPackRepository`;
- `IReportRevisionRepository`;
- `ISubmissionSnapshotRepository`;
- `IEvidenceRetriever`;
- `IDonorTemplateRenderer` behind the existing export builder.

Do not expose Prisma rows, provider response types, or document-library objects
through application ports.

## 8. Persistence and migration strategy

1. Prefer additive migrations and dual-read/dual-write only for the shortest
   controlled compatibility window.
2. Backfill a baseline revision from each current section and bind existing
   claims to it. Mark assurance `CURRENT` only when the content hash can be
   safely associated with the existing claim set; otherwise mark `UNASSESSED`.
3. Preserve existing claim and generation-run IDs and audit history.
4. Add RLS, tenant indexes, unique revision constraints, and immutable-snapshot
   protections in the same migration series.
5. Use normalized relational columns for lifecycle/query-critical fields;
   reserve JSON for versioned immutable payloads and flexible manifests.
6. Store SHA-256 hashes for normalized content, prompts, responses, evidence,
   requirement sources, snapshots, and final artifacts.
7. Test migrations against a production-like anonymized database and provide a
   forward-fix rollback strategy for every phase.

## 9. API and UX contract

The API remains thin and capability-gated. Suggested resource additions:

- read current revision assurance and assertion coverage;
- list assertion verification details and cited spans;
- request re-assessment of a revision;
- resolve authorized limitations/exclusions;
- resolve and preview effective reporting requirements;
- create/read a submission snapshot;
- create an export with explicit intent and snapshot ID.

The web experience should:

- show normal users only actionable exceptions;
- show source excerpts, verification reason, affected text, and suggested action;
- offer batch auto-fixes where deterministic;
- require one consolidated authorized limitation note where policy permits;
- clearly distinguish “AI-generated,” “verification current,” “approved,” and
  “donor-submission snapshot created”;
- never imply that an LLM confidence score is approval.

## 10. Test pyramid and quality gates

### Domain

- requirement precedence and conditional applicability;
- revision and approval hash invariants;
- every gate-policy row and resolution transition;
- numeric atoms, units, periods, derivations, and decimal boundaries;
- assertion materiality and causal-review invariants;
- submission-snapshot completeness.

### Application

- every content mutation invalidates/rebuilds assurance;
- extraction reconciliation and coverage gating;
- verifier strategy order and failure propagation;
- requirement-to-checklist projection deduplication;
- approval/readiness/preflight/export decision parity;
- transaction/idempotency and credit reconciliation.

### Infrastructure

- evidence/chunk/hash integrity;
- retrieval quality and persisted manifests;
- LLM/provider contract suites and failure modes;
- Prisma tenant isolation and RLS;
- docxtpl rendering, malformed document handling, and artifact hashing;
- prompt/response/retrieval audit metadata without sensitive logging.

### API/web/e2e

- role and capability denial paths;
- edit -> stale -> reassess -> approve lifecycle;
- empty-writer-claims bypass attempt;
- internal versus donor-submission export;
- award override over donor default;
- four-action happy path and exception path;
- template version/mapping mismatch;
- immutable snapshot reproduction.

### Mandatory release gate per phase

```bash
pnpm -r typecheck
pnpm -r build
```

Run all affected unit, integration, API, worker, and Playwright suites. A phase
cannot ship with skipped assurance, tenancy, migration, or export-fidelity tests.

## 11. Evaluation thresholds

Initial release thresholds, to be refined from the baseline corpus:

- 100% recall for numeric and causal assertions;
- 100% verification of numeric atoms in donor-submission snapshots;
- 0 approvals against stale revisions;
- 0 silent evidence-hash/source-text mismatches;
- 0 evaluative statements where indicator semantics prohibit evaluation;
- 0 donor submissions with unresolved blocking requirements;
- 100% required template-region population or an explicit blocking decision;
- >= 95% material factual-assertion recall, with every miss blocking corpus sign-off;
- >= 95% citation precision and entailment precision on the curated corpus;
- 100% reproducibility of artifact hashes for deterministic render inputs;
- 0 cross-tenant access in integration and RLS tests.

No aggregate score may hide a critical factuality, confidentiality, tenancy, or
submission-gate failure.

## 12. Delivery dependencies and sequencing

The phases are ordered by assurance dependency:

```text
Revision integrity
  -> assertion completeness
  -> numeric/evidence verification
  -> requirement compliance
  -> narrative quality
  -> submission gate/snapshot
  -> donor-native rendering
  -> validated rollout
```

Rendering can be prototyped in parallel after Phase 0, but donor-submission
enablement must not precede Phases 1–7. Donor-pack authoring can begin during
Phase 4, but packs cannot control production reports until Phase 5 gates pass.

## 13. Definition of done

This initiative is complete only when:

- all cross-cutting invariants in section 5 are enforced in domain/application
  code and tested;
- edits and rewrites cannot retain stale verification;
- every material assertion is detected and current;
- numeric and evidence verification checks meaning, identity, unit, period,
  entity, derivation, and source integrity;
- award-specific requirements deterministically override donor defaults;
- report approval, readiness, preflight, and export use one gate policy;
- donor-facing artifacts use immutable submission snapshots;
- real donor templates are rendered with approved versioned mappings;
- golden, adversarial, tenancy, migration, rollback, and fidelity gates pass;
- all mutations are audited and all AI calls use the existing ledger;
- Features 05, 06, 07, 10, 11, 12, 13, 14, and 20 remain non-regressed;
- documentation and product claims state the precise assurance boundary.

## 14. Explicit non-goals

- No universal “UN,” “USAID,” or “EU” template.
- No autonomous donor submission or portal login.
- No LLM as calculation, authorization, lifecycle, or approval authority.
- No second claim, checklist, readiness, audit, cost, export, or job system.
- No automatic causal approval.
- No unsupported inference of impact from activity/output data.
- No scraping or redistributing donor templates without permission.
- No promise that DonorDesk approval guarantees donor acceptance; it guarantees
  the documented internal assurance and compliance checks were satisfied.

