# Phase 3 Implementation Audit

**Started:** 2026-08-12  
**Source of truth:** Phase 3 in `DonorDesk — Phased Implementation Plan.md` and repository evidence  
**Audited report:** `PHASE3-COMPLETION.md`  
**Current verdict:** **Not complete** — domain models and isolated algorithms exist, but most registry, tracking, RAG, feedback, OCR, and governance capabilities are not connected to application workflows.

## Findings and remediation

| ID | Severity | Requirement / claim | Evidence and remediation | Status |
|---|---|---|---|---|
| P3-001 | Critical | All AI input passes through a PII firewall | `PiiFirewall` existed but no provider called it. Overlapping recognizers could move the redaction cursor backwards and duplicate/leak text. | **Fixed at generic provider boundary**: overlap-safe detection plus redact/reject/transform policy wrapper and tests. Phase 1 stub services are local and remain separate from the provider factory. |
| P3-002 | Critical | Tenant-isolated AI persistence | `LlmRun`, `LlmFeedback`, `EvidenceChunk`, and `EvidenceEmbedding` carry `tenantId` but were omitted from PostgreSQL RLS. | **Fixed policy list**. Database migration and cross-tenant integration tests remain open under the Phase 1 migration gap. |
| P3-003 | High | Evaluation harness gates merges | No CI command invoked the harness. BLEU returned 0–100 while ROUGE returned 0–1, so averaging and a 0.6 threshold were invalid. | **Fixed baseline**: metrics normalized to 0–1, clipped overlap/standard brevity behavior, golden fixture, CLI gate, CI invocation, and tests. Dataset is too small for Phase 3 completion. |
| P3-004 | High | LLM-as-judge evaluation | Method returned a hard-coded 0.75 without invoking its provider. | **Fixed**: provider is called, JSON is parsed, and score range is enforced. Reliability calibration and prompt/version tracking remain open. |
| P3-005 | High | Tenant can disable AI and still report manually | Report incorrectly treated a stub provider as “AI disabled.” No tenant setting existed. | **Fixed baseline**: organization `aiEnabled` contract/schema/domain/persistence/signup setting; disabled tenants receive blank editable manual sections and drafts are marked non-AI. Settings UI and database migration remain open. |
| P3-006 | High | 100% of generated claims have provenance or are flagged | `ProvenanceTracker` was not called by report generation. Empty claim sets were considered verified; scores/IDs were not validated. | **Primitive fixed**: invalid sources/scores rejected and empty/weak claims flagged. **Runtime integration remains open**. |
| P3-007 | High | Source-linked RAG | Draft generator uses activities/indicators and evidence IDs, not retrieved chunks with relevance scores. No inline claim provenance is rendered in the editor. | **Open**. Existing `sourceReferences` are not RAG provenance. |
| P3-008 | High | Model and prompt registry | Prisma/domain models exist, but no repositories, application ports/use cases, APIs, admin UI, seed data, or active-version resolution are present. | **Open**. A tested compliant cheapest-model selection policy was added, but it is not persistence-backed. |
| P3-009 | High | Every LLM call records run metadata | `LlmRun` table/domain exist but no runtime code writes them. Phase 1 tagger/polisher omit `promptVersion`; report generator is a separate stub. | **Open**. |
| P3-010 | High | Reviewer feedback loop | `LlmFeedback` schema/domain and aggregation exist, but no repository, endpoint, authorization rule, UI action, or link to a real run exists. | **Open**. |
| P3-011 | High | Evidence ingestion, embeddings, and vector retrieval | Chunk/entity schemas exist, but no repository, ingestion handler, embedding job, search adapter, or report retrieval path exists. Vectors remain JSON strings; pgvector is absent. | **Open**. |
| P3-012 | High | OCR pipeline | Worker exposes tagging/template/draft stubs only. No OCR endpoint, Tesseract/Textract/Azure adapter, OCR tests, or ingestion connection exists. | **Open**. |
| P3-013 | High | Prompt versioning is safe | `incrementVersion()` reused the existing entity/DB primary key, conflicting with `(name, version)` history. Rendering silently left required variables unresolved. | **Fixed**: new ID required per version and missing variables fail closed. Repository transaction/version race remains open. |
| P3-014 | High | Embedding correctness and isolation | Domain accepted vector/dimension mismatch, non-finite values, zero vectors, and cross-tenant similarity comparisons. | **Fixed and tested**. Provider/model compatibility checks during search remain open. |
| P3-015 | High | Chunking is safe | `overlap >= chunkSize` could produce a non-advancing infinite loop. | **Fixed and tested** with validated configuration. Semantic/tokenizer-aware chunking remains open. |
| P3-016 | Medium | Model routing is cheapest and compliant | No routing policy existed despite the plan. | **Partially fixed**: `CompliantModelRouter` filters active models by capability, jurisdiction, token capacity and cost. Registry wiring/fallback policy remains open. |
| P3-017 | Medium | Provider factory fails safely | Unknown providers silently became the stub; real providers accepted empty keys; external calls had no timeout; Ollama model listing hid outages by returning the configured name. | **Fixed**: fail-closed configuration, credentials checks, timeouts, URL/model validation, honest Ollama failures, embedding validation. |
| P3-018 | Medium | Domain invariants protect registry/run data | Models accepted negative cost/invalid token limits; runs accepted inconsistent totals and negative metrics; rehydration skipped validation. | **Fixed for model/run/prompt/embedding paths and tested**. |
| P3-019 | Medium | Provider breadth matches architecture | Factory supports stub, OpenAI, Anthropic, and Ollama. Bedrock is declared in the domain/master plan but has no adapter. | **Open or document as an accepted deviation**. |
| P3-020 | Medium | AI outputs expose model and prompt versions | Generic provider results do, but tagger, polisher, template extraction, checklist detection, and report sections do not consistently propagate/persist both values. | **Open**. |
| P3-021 | Medium | Manual operation is complete | Manual report draft creation now works when AI is disabled, but evidence tagging and activity polishing endpoints do not expose explicit disabled behavior, and no organization settings page toggles AI after signup. | **Partial**. |
| P3-022 | Medium | AI quality dataset represents donor workflows | Newly added gate uses two exact-match smoke cases. There is no donor-template golden corpus, hallucination/adversarial set, human labels, or regression history. | **Open**. |

## Changes made during this audit

- Corrected BLEU/ROUGE scaling and overlap calculations.
- Added a checked-in evaluation fixture, executable gate, and CI step.
- Replaced the fake LLM judge with validated provider-driven scoring.
- Fixed PII overlap handling and enforced PII policy at provider boundaries.
- Made provider selection/configuration fail closed and added timeouts.
- Hardened Ollama URL, model, embedding, and health/failure semantics.
- Added tenant AI opt-out with manual report-draft fallback.
- Extended RLS policy coverage to Phase 3 tenant tables.
- Hardened model, prompt, run, embedding, chunking, and provenance invariants.
- Added compliant model routing logic.
- Added focused domain and infrastructure regression tests.
- Reopened and corrected the inaccurate Phase 3 completion status.

## Validation ledger

| Gate | Result during audit |
|---|---|
| Domain build/tests | **Passed** |
| Contracts build/tests | **Passed** |
| Application build | **Passed** |
| Infrastructure build/tests | **Passed** |
| API build | **Passed** |
| AI evaluation gate | **Passed** for the current smoke dataset |
| Workspace typecheck and lint | **Passed** on 2026-08-12 |
| Workspace production build | **Passed** on 2026-08-12 |
| Non-browser workspace tests | **Passed** on 2026-08-12 |
| Playwright | **Passed** — one Chromium login smoke test; no Phase 3 browser workflow coverage |
| Real LLM/Ollama integration | **Not run** — no configured service/API credentials |
| OCR/embedding/RAG end-to-end | **Not implemented** |
| pgvector integration | **Not implemented** |

## Exit criteria

Phase 3 may be marked complete only after:

1. Registry repositories/use cases/APIs persist models and immutable prompt versions and route every AI task through the compliant model policy.
2. A governed execution service applies PII policy, records every successful/error/timeout run with model and prompt versions, and attributes cost to the tenant.
3. Feedback endpoints/UI persist reviewer signals linked to actual runs and feed evaluation reports.
4. Evidence ingestion parses/OCRs, chunks, embeds, and indexes content idempotently with tenant-isolated pgvector search.
5. Report generation retrieves chunks and stores inline claim-level provenance; unsupported claims are automatically flagged and visible in the editor.
6. AI opt-out covers all AI endpoints and can be changed from organization settings without blocking manual workflows.
7. The golden dataset includes representative donor templates, adversarial PII/hallucination cases, human labels, and meaningful regression thresholds.
8. Real-provider and self-hosted Ollama contract tests pass, including timeout, malformed response, residency, and failure scenarios.
9. OCR accuracy and fallback behavior are tested on representative PDF/image fixtures.
10. Database migrations and RLS integration tests cover all Phase 3 tables.
