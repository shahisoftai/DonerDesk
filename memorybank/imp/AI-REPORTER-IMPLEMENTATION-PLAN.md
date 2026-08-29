# AI Reporter — Implementation Plan

**Status:** IMPLEMENTED (2026-08-28) — see §11 below
**Owner:** DonorDesk engineering
**Scope:** Replace the single-shot "narrator" LLM attachment with a small, intelligent
AI Reporter pipeline behind the existing `IReportDraftGenerator` port, backed by real
open-source components (not re-implemented). The deterministic assurance/compliance
system remains the final authority: **AI writes, deterministic code verifies, humans approve.**

> **Superseded by:** [`AI-REPORTER-2-IMPLEMENTATION-PLAN.md`](./AI-REPORTER-2-IMPLEMENTATION-PLAN.md)
> (released `20260828200000`, 2026-08-29). The v1 plan above remains the
> architectural baseline for pgvector, worker wiring, and writer-contract scope;
> v2 adds typed artifacts (tables, charts, lists, Q&A, deltas), per-section
> timeout/fallback, deterministic artifact validators, 25-case eval corpus,
> and additive persistence (`ReportArtifact` / `ReportArtifactRow` tables).

---

## 11. Implementation status (2026-08-28)

All phases implemented and verified: `pnpm -r typecheck` ✓, `pnpm -r build` ✓,
domain/application/infrastructure tests ✓, worker mypy ✓, ruff clean for new files ✓,
`reporting:eval` 8/8 cases correct ✓.

- **Phase 1 — Provider default:** `getReportDraftGenerator` logs a loud warning when it
  degrades to the stub (no `LLM_PROVIDER`, no platform config), so stub is an explicit,
  visible dev-only default, never silent.
- **Phase 2 — Semantic retrieval:** `pgvector` v0.8.6 (dev image `pgvector/pgvector:pg16`,
  SQL in `infra/postgres/pgvector.sql`, wired into `db:migrate`); `embedding` vector column
  on `EvidenceEmbedding` (`Unsupported("vector(1536)")` + HNSW cosine index); ports
  `IEmbeddingGenerator`/`IEmbeddingStore`; `OpenAiEmbeddingGenerator`/`OllamaEmbeddingGenerator`;
  `PrismaEmbeddingStore`; `SemanticEvidenceRetriever` behind `IEvidenceRetriever` with
  lexical fallback; `EmbeddingBackfillJob` + `embedding:backfill` CLI.
- **Phase 3 — AI Reporter worker:** Python `app/ai_reporter.py` (writer contract v1, OpenAI-
  compatible LLM gateway, draft → critique → refine via LangGraph with plain sequential
  fallback), routes `/v1/ai-reporter/{health,section,rewrite}`, wired into `main.py`
  (`langgraph` added to requirements). TS `AiReporterDraftGenerator` + `HttpWorkerClient`
  fulfil `IReportDraftGenerator`, feature-flagged by `AI_REPORTER_ENABLED=1` in `container.ts`.
- **Phase 4 — Historical intelligence:** `IPriorPeriodService` + `DeterministicPriorPeriodService`
  fetch approved prior narrative; fed into the writer brief as `priorNarrative`.
- **Phase 5 — Evaluation:** golden corpus grown to 8 mechanism cases (added period-
  comparison and repetition cases); deterministic `repetition` qualitative metric added to
  `ReportDraftEvaluator` (signal only, never a hard failure).

The deterministic assurance pipeline is unchanged and fully non-regressed.

---

## 0. Governing principle

DonorDesk does **not** have an AI report-writing system today. It has a strong
deterministic reporting/assurance system with an LLM narration attachment
(`LlmReportDraftGenerator` — one prompt per section, strict JSON, keyword-only evidence
selection, regex-patched malformed output, fallback to a deterministic stub).

The core product value is the **assurance shell** (revisions, assertions, numeric
verification, gates, snapshots, audit). That layer is preserved and untouched.

We build a **small AI Reporter** behind the existing port. It *thinks about the report,
retrieves the right information, writes, critiques and improves*. The deterministic
system then acts as the fact-checker, compliance engine, and audit authority.

Boundary:

```text
REPORT DATA (plan + findings + evidence + prior periods + template)
   │
   ▼
┌────────────────────────────┐
│  AI REPORTER (Python worker)│
│  LangGraph:                 │
│  1. section brief           │
│  2. retrieve (already done) │
│  3. draft                   │
│  4. critique (grounding)    │
│  5. refine (one pass)       │
└────────────────────────────┘
   │   returns GeneratedSection (same shape)
   ▼
┌────────────────────────────┐
│ EXISTING ASSURANCE PIPELINE │  ← unchanged
│ assertions / verification /│
│ claims / gates / revision / │
│ audit / snapshot            │
└────────────────────────────┘
```

---

## 1. Open-source repos to adopt (download, do NOT rebuild)

Everything below is a real, maintained, permissive-licensed repo that we consume as a
dependency. We do not re-implement their functionality.

| Repo | Version | License | Used for | Do NOT rebuild |
|---|---|---|---|---|
| [pgvector/pgvector](https://github.com/pgvector/pgvector) | v0.8.6 | PostgreSQL License (permissive) | Semantic retrieval over evidence chunks via HNSW index in our existing PostgreSQL 16 | NN-search, HNSW/IVFFlat indexes, cosine ops |
| [pgvector/pgvector-python](https://github.com/pgvector/pgvector-python) | latest | BSD-3 | Optional Python helper to register pgvector types with psycopg (only if the worker ever queries vectors directly) | vector adapter |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | `pip install langgraph` (MIT) | MIT | Durable, stateful orchestration of draft → critique → refine; resume on failure | the state machine, checkpoints, graph edges |
| [langchain-ai/langchain](https://github.com/langchain-ai/langchain) (langchain-core + provider pkgs) | latest | MIT | Provider-agnostic LLM gateway + guaranteed structured output (`with_structured_output`) | provider SDK wrappers (OpenAI/Anthropic/Ollama/DeepSeek) |
| [pydantic/pydantic](https://github.com/pydantic/pydantic) | 2.9.x (already a dep) | MIT | Typed request/response contracts for the worker | data validation |
| [ollama/ollama](https://github.com/ollama/ollama) | latest (optional) | MIT | Self-hosted embeddings + LLM when a zero-external-API deployment is required | embedding/chat serving |

**Embedding model:** not a repo — a model. Choose one:
- OpenAI `text-embedding-3-small` (hosted, paid) — via existing provider, or
- Ollama `nomic-embed-text` / `mxbai-embed-large` (local, MIT stack).

**Explicitly NOT adopted** (keeps the stack small and the plan focused): STORM,
LlamaIndex, Instructor, Outlines, Haystack, and any vector DB other than pgvector.

---

## 2. Architecture and data flow

### 2.1 Seam: `IReportDraftGenerator`

The existing application port (`packages/application/src/ports/reporting.ts`) defines
`generateDraft`, `generateSection`, and `rewriteSection`. The handler
(`GenerateReportDraftHandler`) and the entire assurance pipeline depend only on this
interface. This is our Open/Closed seam: add a new implementation, change nothing else.

Current wiring (`packages/infrastructure/src/container.ts:556`): `getGenerator` returns a
`LlmReportDraftGenerator` built from a `createLLMProvider()` provider.

### 2.2 New components and data flow

```text
GenerateReportDraftHandler (application)   ← unchanged
   └─ IReportDraftGenerator                 ← port, unchanged
        └─ AiReporterDraftGenerator (infrastructure, NEW)
             │
             ├─ IEvidenceRetriever.retrieve(...)      (NEW SemanticEvidenceRetriever)
             │     └─ IEmbeddingStore / IEmbeddingGenerator   (ports)
             │           └─ pgvector (HNSW) + evidence chunk rows
             ├─ PriorPeriodService.fetch(...)          (NEW: Phase 4)
             │     └─ approved prior revisions for project/indicators
             ├─ build SectionBrief (requirements + mandatory Qs + word limits + manifest)
             └─ WorkerClient.draftSection(brief)       (HTTP → Python worker)
                   └─ LangGraph: draft → critique → refine (one critique pass)
                   └─ returns GeneratedSection JSON (pydantic-validated)
```

- **Retrieval stays in TypeScript infrastructure** (it owns Prisma + pgvector via raw SQL).
  The worker is a stateless prose engine and never touches the database.
- The worker's only inputs are the section brief and retrieved/prior context. Its only
  output is the same `GeneratedSection` shape, so LSP holds: the assurance pipeline cannot
  tell it apart from the old generator.

### 2.3 Worker API contract

`apps/workers` (FastAPI) gains:

- `POST /v1/ai-reporter/section`
  Request (pydantic): `section` (title, inputType, word limits, mandatoryQuestions,
  evidenceNeeds, relatedLogframeElement), `context` (project/period/template),
  `verifiedFindings`, `indicatorUpdates`, `activities`, `retrievedEvidence[]`,
  `priorNarrative[]` (Phase 4), `writerContractVersion`, `modelParams`.
  Response: `GeneratedSection` (`title`, `content`, `claims[]`, `sourceReferences[]`) +
  telemetry (`promptHash`, `responseHash`, `inputTokens`, `outputTokens`, `latencyMs`,
  `parseOutcome`).
- `POST /v1/ai-reporter/rewrite` — rewrite/shorten preserving facts + source refs.
- `GET /v1/ai-reporter/health`.

Contract suites (LSP tests) assert the worker output round-trips through the same
`parseSections`/verification path as the old generator.

---

## 3. SOLID mapping

Every new unit has one responsibility (SRP), is open for extension via a port (OCP),
is substitutable behind a shared contract (LSP), exposes narrow ports (ISP), and
inverts dependencies toward ports (DIP).

| Unit | Responsibility | Port(s) it implements | SOLID notes |
|---|---|---|---|
| `AiReporterDraftGenerator` | Adapter: turn `GenerateReportDraftInput` + section into a worker call, map result back to `GeneratedSectionResult` | `IReportDraftGenerator` | OCP: new generator, zero handler change. LSP: same result shape, same fallback semantics |
| `SemanticEvidenceRetriever` | Rank evidence chunks by semantic relevance + metadata/period filters | `IEvidenceRetriever` (existing) | OCP: replaces `DeterministicEvidenceRetriever` behind same port. LSP: same `RetrievedEvidence[]` |
| `EmbeddingStore` (PrismaAdapter) | Persist/query chunk vectors via pgvector raw SQL | `IEmbeddingStore` | ISP: only `upsert`/`nearestNeighbors`. DIP: infra-only |
| `EmbeddingGenerator` (Ollama/OpenAI) | Produce embedding vectors for text | `IEmbeddingGenerator` | OCP: model swappable |
| `EmbeddingBackfillJob` | Backfill embeddings for chunks missing them | — (job) | SRP: one-time + incremental; idempotent |
| `PriorPeriodService` | Assemble approved prior narrative + trajectory for a section | `IPriorPeriodService` | SRP: historical intelligence only (Phase 4) |
| `SectionBriefBuilder` (TS) | Compose brief (requirements, mandatory Qs, word limits, retrieval manifest) from plan + resolved requirements | internal | SRP: composition, not planning (plan stays authoritative) |
| `WorkerClient` | HTTP transport to the worker | `IWorkerClient` | DIP: app depends on port, not HTTP |
| Python `SectionBrief` model | Typed, validated worker input | — | pydantic |
| Python `WriterContract` | Versioned prompt rules (persona contract) | `IWriterContract` | OCP: prompt versions swappable |
| Python `LlmGateway` | Provider-agnostic chat + structured output | `ILlmGateway` | DIP: uses langchain providers; model-swappable |
| Python `DraftWriter` | Write one section from brief | `IDraftWriter` | SRP |
| Python `CritiqueWriter` | Critique draft against retrieval manifest (grounding, not style) | `ICritiqueWriter` | SRP; the critique is evidence-conformance |
| Python `Refiner` | Apply critique (exactly one pass) under the same evidence constraints | `IRefiner` | SRP |
| LangGraph graph | Orchestrate draft → critique → refine with durable checkpoints | — | DIP: uses repo, no domain logic in graph |

---

## 4. Writer contract (persona/contract, versioned)

Moved from the inline `buildSystemPrompt()` in `llm-report-draft-generator.ts` into a
versioned contract (`writerContractVersion`), stored in the existing `LlmPrompt` domain
registry and enforced by evaluation.

The writer MUST:
- never invent facts, causes, targets, dates, partners, incidents, or outcomes;
- preserve verified numbers exactly (no computation, aggregation, or inference);
- distinguish achievement from explanation, and evidence from interpretation;
- identify gaps rather than fill them (never write a missing denominator as zero);
- use only evidence-proportionate, donor-appropriate language (no humanitarian clichés);
- not repeat the same information across sections;
- maintain consistency with previous approved reports (Phase 4);
- cite evidence by `evidenceId`/`chunkId` from the retrieval manifest only;
- explicitly flag unsupported claims;
- keep all caveats/limitations from the retrieval manifest.

This contract is **evaluated** in Phase 5, not merely stated. Different models
(MiniMax, Claude, GPT, DeepSeek, Ollama) become interchangeable engines behind the same
contract rather than each having its own personality.

---

## 5. Data & schema changes (pgvector)

Prisma does not natively model the `vector` type. Use `Unsupported("vector(1536)")` in the
schema plus a raw SQL migration, and query nearest-neighbor with `$queryRaw`. Existing
`EvidenceEmbedding` rows currently store `vector` as a JSON string (TEXT). We migrate to a
true pgvector column.

Migration (single additive migration series):

```sql
-- 1. enable the extension (v0.8.6, already bundled in dev via pgvector/pgvector:pg16 image)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. real vector column on the existing EvidenceEmbedding table
ALTER TABLE "EvidenceEmbedding" ADD COLUMN embedding vector(1536);
-- keep provenance columns (modelId, provider, dimensions) as-is

-- 3. tenant-scoped HNSW index (cosine)
CREATE INDEX CONCURRENTLY IF NOT EXISTS evidence_embedding_hnsw_idx
  ON "EvidenceEmbedding" USING hnsw (embedding vector_cosine_ops);

-- 4. backfill later embeddings from the JSON text column where present, else NULL
```

- **Tenancy**: vectors are RLS-scoped like every aggregate (`tenantId`). HNSW is an
  approximate global index; tenant filtering is applied after scan. For large
  multi-tenant volume, document pgvector list-partitioning by `tenantId` as the scaling
  option. Iterative scans (`hnsw.iterative_scan`) mitigate filtered-recall loss.
- **Dev infra**: change the postgres image in `infra/docker-compose.dev.yml` from
  `postgres:16.4-alpine` to `pgvector/pgvector:pg16` so the extension is present.
- **Prod (Contabo, native Postgres 16)**: `sudo apt install postgresql-16-pgvector` (PGDG
  repo) or build `pgvector` v0.8.6 per upstream instructions, then `CREATE EXTENSION vector`.

---

## 6. Phased implementation

Each phase ends with `pnpm -r typecheck && pnpm -r build`, affected unit/integration/API
tests, and a reviewable diff. No phase changes the assurance pipeline.

### Phase 1 — Turn on real AI (no architecture rewrite)
- Get one good provider working through the existing interface; correct the default so
  `LLM_PROVIDER=stub` is an explicit dev-only choice, not a silent production path.
- Keep `LlmReportDraftGenerator`; fix the worst narrative-quality gaps in its prompt and
  tone handling via the writer contract.
- Exit gate: a real model produces a full report end-to-end with `usedFallback=false`,
  reasonable latency, and no malformed-JSON stub fallbacks.

### Phase 2 — Real evidence retrieval
- Enable pgvector (migration above), add `IEmbeddingStore`/`IEmbeddingGenerator`,
  `EmbeddingBackfillJob`, and `SemanticEvidenceRetriever` behind `IEvidenceRetriever`.
- Replace keyword scoring + `4×4×400` truncation with semantic retrieval + metadata +
  period filtering + ranking.
- Exit gate: retrieval recall/citation-precision thresholds on a seeded corpus; LSP
  contract suite for `IEvidenceRetriever`; RLS on all vector queries.

### Phase 3 — Writer pipeline (the AI Reporter)
- Stand up the worker endpoints + LangGraph draft → critique → refine graph behind
  `AiReporterDraftGenerator` (kept alongside the legacy generator behind a factory flag).
- Critique is grounding-focused (does it stay within the manifest, preserve numbers,
  keep caveats, avoid duplication), not style-only. Exactly one refine pass.
- Exit gate: same `GeneratedSection` shape round-trips verification; `usedFallback`
  semantics preserved on worker/provider failure; worker contract suites pass.

### Phase 4 — Historical intelligence
- Add `IPriorPeriodService`: assemble approved prior narrative + indicator trajectory +
  current findings into a `priorNarrative[]` passed into the brief.
- Writer must remain consistent with prior approved reports and articulate what changed
  and why, grounded in evidence.
- Exit gate: period-comparison metric present in eval; consistency with prior approved
  narrative verified on corpus.

### Phase 5 — Evaluation
- Grow the golden corpus from the 6 mechanism fixtures toward 20–30 real, human-approved
  reports (source data, evidence, indicators, prior reports, donor/template, final
  narrative).
- Metrics: factual accuracy, numeric accuracy, evidence grounding, evidence coverage,
  period comparison, completeness, coherence, repetition, donor quality, unsupported
  claims.
- Add an LLM-judge for qualitative metrics, **guarded**: deterministic metrics (numeric
  accuracy, grounding, unsupported claims) remain hard gates; LLM-judge metrics are signal
  only.
- Exit gate: objective before/after answers to "did v2 actually improve report writing?"

---

## 7. Security

- Reuse the existing PII firewall (`LLM_PII_POLICY`) before external-model calls; the
  worker treats evidence and user narrative as data, never as instructions (prompt
  injection).
- Vector queries are RLS-scoped; never leak cross-tenant embeddings.
- All worker calls record `promptHash`/`responseHash`/retrieval manifest for reproduction.
- LLM output remains untrusted data and never controls lifecycle or authorization.

## 8. Rollout

- Feature flag / per-tenant toggle (existing pattern): internal preview → controlled
  pilot → default. `AiReporterDraftGenerator` and `SemanticEvidenceRetriever` are
  registered in `container.ts` behind config, with the legacy generator as fallback.
- No UI change initially (Phase 3+ ships the same `GET /draft` polling).

## 9. Risks

- **Latency/cost** of a multi-step pipeline vs. single-shot. Mitigate: one critique pass,
  retrieval only over required chunks, token budgets, streaming later.
- **pgvector index + RLS recall** at multi-tenant scale. Mitigate: iterative scans,
  partition by tenant when needed.
- **Embedding backfill** volume. Mitigate: incremental, idempotent, background job.
- **Critique pass introducing errors.** Mitigate: critique is grounding-conformance;
  refine constrained to the same retrieval manifest; deterministic verification remains
  the authority.
- **Golden-corpus build cost.** Mitigate: start with existing fixtures, grow iteratively.

## 10. Definition of done

- AI Reporter runs behind `IReportDraftGenerator`; assurance pipeline unchanged and
  non-regressed.
- Semantic retrieval replaces keyword truncation; pgvector enabled with RLS-scoped HNSW.
- Writer contract versioned and enforced; one evidence-grounded critique pass.
- Historical intelligence active (prior approved narrative + trajectory).
- Golden-corpus eval answers "did it improve?" objectively.
- All phases pass `pnpm -r typecheck`, `pnpm -r build`, and affected tests; security and
  LSP contract suites green.
- `LLM_PROVIDER=stub` is explicitly a dev-only default, never a silent production path.
