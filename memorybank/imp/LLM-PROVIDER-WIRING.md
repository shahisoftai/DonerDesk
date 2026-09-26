# LLM Provider Wiring — Implementation Plan

**Status:** IMPLEMENTED (Phase 1–4, 2026-08-17) + AI Reporter sidecar (2026-08-28)
**Date:** 2026-08-17
**Feature reference:** `memorybank/Features/11-AI-Report-Draft-Generator.md`,
`memorybank/Features/20-report-gen.md`, `memorybank/SUPERADMIN-PORTAL.md`

## 1. Problem statement

SuperAdmin (sa.donordesk.online) already manages LLM providers end-to-end
(create/edit/rotate keys, test connection, enable/disable, GLOBAL/TENANT
scoping) via the `PlatformConfiguration` table. The runtime LLM stack does
**not** consume that configuration. Four concrete gaps:

| # | Gap | Evidence |
|---|-----|----------|
| G1 | `createLLMProvider` reads **only env vars** — never `PlatformConfiguration` | `factory.ts:15` — `process.env.LLM_PROVIDER` |
| G2 | Provider catalogue mismatch: SuperAdmin supports `openai/anthropic/deepseek/minimax`; factory implements `stub/openai/anthropic/ollama` | `control-plane.ts:8` vs `factory.ts:7`; DeepSeek/MiniMax have test + UI but **no adapter** |
| G3 | Report drafting is **stub-only** — no real LLM narration, even when a provider is configured | `container.ts:479` wires `StubReportDraftGenerator` unconditionally |
| G4 | Generation-run snapshot + `recordLlmRun` hardcode `modelId: "stub"` | `generate-report-draft.ts:196,352` — real model never recorded |

## 2. Goals

- Wire SuperAdmin LLM configuration into runtime provider resolution with a
  safe fallback chain: **platform config → env vars → stub**.
- Add `deepseek` and `minimax` adapters (OpenAI-compatible chat completions).
- Implement a real LLM-backed `IReportDraftGenerator` (narrator only; the
  deterministic analyst remains the sole authority over numbers).
- Record the real `modelId` / `modelVersion` / `promptVersion` in generation
  runs and `llm_runs`.
- 100% SOLID; zero new typecheck/build/test errors; no regressions in
  features 06/08/09/11/12/13/14/20.

## 3. Verified baseline (2026-08-17)

- `pnpm --filter @donordesk/infrastructure typecheck` — clean.
- `pnpm --filter @donordesk/application typecheck` — clean.
- `pnpm --filter @donordesk/infrastructure test` — 63 pass / 1 skipped.
- `PlatformConfiguration` schema (global, not tenant RLS): `scopeType`,
  `scopeId`, `category`, `provider`, `enabled`, `configurationJson`,
  `secretCiphertext/iv/tag` (AES-256-GCM under `PLATFORM_MASTER_KEY`).
- `PlatformControlPlane.testConfiguration()` already performs LLM live tests for
  all four providers (`control-plane.ts:179-191`).

## 4. Target architecture (SOLID)

```
SuperAdmin portal ──> PlatformConfiguration (LLM, encrypted)
                          │
                          ▼
              PlatformLlmConfigResolver   (SRP: read + decrypt + precedence)
                          │
                          ▼
              ProviderRegistry            (OCP: register per provider, no switches)
                          │
                          ▼
              createLLMProvider(config) → ILLMProvider
                          │
                          ▼
              LlmReportDraftGenerator (LSP/ISP: implements IReportDraftGenerator)
                          │   fallback on any failure
                          ▼
              StubReportDraftGenerator (unchanged)
```

| Principle | Application |
|---|---|
| **S**ingle responsibility | One adapter per provider file; resolver only resolves; generator only drafts; stub only heuristics |
| **O**pen/closed | `ProviderRegistry` map: a new provider = new adapter file + `registerLLMProvider()` call. No switch statements |
| **L**iskov | `LlmReportDraftGenerator` and `StubReportDraftGenerator` both implement full `IReportDraftGenerator`; all adapters implement full `ILLMProvider` |
| **I**nterface segregation | `ILLMProvider.complete()`, `IReportDraftGenerator.generateDraft/rewriteSection`, `ILlmConfigResolver.resolve()` — narrow, independent ports |
| **D**ependency inversion | Application depends only on ports; infrastructure provides adapters; container wires lazily (container stays synchronous) |

### 4.1 Resolution precedence

```
PlatformLlmConfigResolver.resolve(tenantId)
  1. query PlatformConfiguration category=LLM, enabled=true
  2. prefer TENANT scope(scopeId=tenantId) over GLOBAL
  3. decrypt secrets (apiKey) via PLATFORM_MASTER_KEY
  4. map configurationJson → LLMProviderConfig { provider, model, baseUrl, timeoutMs, ... }
  5. none → null
```

Runtime fallback chain per generation call:
```
platform config → (env LLM_PROVIDER / provider keys) → null → StubReportDraftGenerator
```

## 5. File plan

### 5.1 New files (infrastructure)

| File | Responsibility |
|---|---|
| `src/security/secret-cipher.ts` | Shared AES-256-GCM `encrypt/decrypt` helper (same shape as control-plane / gdrive credential store; standalone — existing private helpers are left untouched to avoid regressions) |
| `src/llm/adapters/openai.ts` | OpenAI adapter (moved from factory.ts) |
| `src/llm/adapters/anthropic.ts` | Anthropic adapter (moved from factory.ts) |
| `src/llm/adapters/deepseek.ts` | DeepSeek adapter — OpenAI-compatible chat completions; default base `https://api.deepseek.com`, default model `deepseek-chat` |
| `src/llm/adapters/minimax.ts` | MiniMax adapter — OpenAI-compatible shape on `/v1/text/chatcompletion_v2`; optional `groupId` from config; reads `usage` |
| `src/llm/adapters/ollama.ts` | Ollama adapter (moved from factory.ts) |
| `src/llm/provider-registry.ts` | `registerLLMProvider(name, factory)` + `createLLMProvider(config)` via `Map` (OCP) |
| `src/llm/llm-config-resolver.ts` | `PlatformLlmConfigResolver implements ILlmConfigResolver` (DIP) |
| `src/llm/llm-report-draft-generator.ts` | `LlmReportDraftGenerator` — builds narrator prompt, calls provider in `jsonMode`, parses/validates JSON, falls back to stub on any error or `null` provider; exposes `model` info |

### 5.2 Modified files

| File | Change |
|---|---|
| `src/llm/factory.ts` | Rewritten to delegate to `ProviderRegistry`; keeps `withPiiFirewall` decoration; preserves export surface for backward compatibility |
| `src/index.ts` | Export new modules (`ProviderRegistry`, `PlatformLlmConfigResolver`, `LlmReportDraftGenerator`) |
| `src/container.ts` | Wire `PlatformLlmConfigResolver` + lazy provider factory + `LlmReportDraftGenerator`; keep `StubReportDraftGenerator` as fallback; Container type uses `IReportDraftGenerator` |

### 5.3 Application layer (small, additive)

| File | Change |
|---|---|
| `src/ports/reporting.ts` | Add optional `readonly model?: { modelId; modelVersion; promptVersion }` to `IReportDraftGenerator` (optional → no breakage) |
| `src/use-cases/reporting/generate-report-draft.ts` | Use `generator.model` for `ReportGenerationRun.create` (`:196`) and `recordLlmRun` (`:352`); fall back to `"stub"` when absent |

## 6. DeepSeek / MiniMax adapter contracts

Both are OpenAI-compatible chat completions (request/response shape), matching
the existing `createOpenAIAdapter` structure. Differences:

- **DeepSeek**: base `https://api.deepseek.com`, path `/chat/completions`,
  `Authorization: Bearer`, model default `deepseek-chat`. Response:
  `choices[0].message.content`, `usage.prompt_tokens/completion_tokens`.
- **MiniMax**: base `https://api.minimax.io/v1`, path
  `/text/chatcompletion_v2`; `groupId` from config appended as `GroupId` query
  param when present; model default `MiniMax-Text-01`. Response:
  `choices[0].message.content`, `usage` (read defensively: total vs
  prompt+completion).

Both fail fast (throw) on missing `apiKey` — consistent with existing
`createOpenAIAdapter` / `createAnthropicAdapter`. Endpoint defaults are
verifiable at implementation time against provider docs; `baseUrl` is always
overridable via SuperAdmin config, which is the production path.

## 7. LLM report generator design (narrator-only)

- **Prompt builder** (pure, inside `llm-report-draft-generator.ts`):
  - System prompt: strict narrator instructions — only narrate the provided
    data; never compute, aggregate, or invent numbers; report `qualityFlags`
    verbatim; return JSON.
  - User prompt: serialised `ReportPlan` sections, `VerifiedFinding[]`,
    `EvidencePackage[]` (id/title/chunks — first 8 chunks, 800 chars each),
    `ActivityGenerationContext[]` (full narrative: summary, achievements,
    challenges, lessonsLearned, nextSteps, participants — including
    male/female/children/disability disaggregation — location, linked
    evidence), `IndicatorUpdateGenerationContext[]` (period/cumulative
    achievements, comments, dataSource, linked evidence),
    `ReportingProfileSnapshot` (tone/language/rules), the section titles to
    draft, an optional `ReportGenerationContext` (project / reporting period /
    donor template), and per-section guidance (input type, mandatory questions,
    evidence needs, word limits). The narrative MUST draw on the activity records
    and indicator updates, describe indicators by name and against target, and
    every section MUST list its source references.
  - Output schema:
    ```json
    { "sections": [ { "title": "...", "content": "...",
        "claims": [ { "text": "...", "type": "NUMERIC|FACTUAL|CAUSAL|QUALITATIVE",
            "proposedSources": [ { "evidenceId": "...", "chunkId": "...", "sourceText": "..." } ] } ],
        "sourceReferences": [ { "type": "indicator|evidence|activity", "id": "...", "label": "..." } ] } ] }
    ```
- **Parse + validate**: structural validation of every field; any invalid shape,
  parse error, provider error, or timeout → delegate to `StubReportDraftGenerator`.
- **Rewrite**: same pattern for `rewriteSection` (mode/audience/instructions in
  prompt; malformed/empty → stub).
- **Model identity**: after first successful resolution, cache
  `model = { modelId: provider.name, modelVersion: provider.model, promptVersion: Number(provider.promptVersion) }`; expose as `readonly model`.
- Because downstream `DeterministicClaimVerifier` re-verifies every claim, an
  LLM hallucination cannot reach approval (gate policy in Feature 20 §2.4).

> **2026-08-17 (data completeness):** the generation input was extended from
> findings+evidence to the full period record set — evidence packages now carry
> the real extracted document text (`EvidenceFile.extractedText`, Tika-persisted
> via the `evidence_parse` Kestra flow through `POST /internal/evidence/:id/tags`),
> plus `ActivityGenerationContext[]` and `IndicatorUpdateGenerationContext[]`.
> The stub generator narrates activity records/achievements/challenges/lessons
> verbatim and attaches evidence chunks to claims; the LLM prompt includes
> `# Activity Records` and `# Indicator Updates` sections and mandates per-section
> `sourceReferences`. See `../Features/11-AI-Report-Draft-Generator.md` and
> `../Fixes.md`.
>
> **2026-08-18 (professional context):** `VerifiedFinding` now carries
> `indicatorName`, `indicatorType`, `baseline`, `target`, resolved `semantics`,
> the previous-period `comparisonValue` (was computed then dropped), and a
> deterministic `performanceEvaluation` (POSITIVE/NEGATIVE/NEUTRAL gated by
> `evaluatePerformance`). The prompt adds `# Project Context` / `# Reporting
> Period` / `# Donor Template` blocks, formatting rules, per-section guidance
> (input type, mandatory questions, evidence needs, word limits, related logframe
> element), indicator-name + target + period-on-period narration instructions,
> evidence metadata (type/verification/confidentiality), participant
> disaggregation, quality-flag caveat language, performance-evaluation gating
> rules, and a worked example in the system prompt. Evidence chunks raised to 8 ×
> 800 chars; `maxTokens` stays **4096** (see the timeout record in
> `../contabo-ops.md` §26). Deployed `20260818074405`. See
> `../Features/20-report-gen.md` §17.

## 8. Container wiring (container.ts, synchronous)

```ts
const llmConfigResolver = new PlatformLlmConfigResolver(prisma, masterKey);
const reportDraftGenerator = new LlmReportDraftGenerator(
  async (tenantId) => {
    const cfg = await llmConfigResolver.resolve(tenantId);
    if (cfg) return createLLMProvider(cfg);
    if (process.env.LLM_PROVIDER) return createLLMProvider();       // env fallback
    return null;                                                     // stub fallback
  },
  new StubReportDraftGenerator(),
);
```

`createContainer` stays synchronous (resolution is lazy per generation call).
`RewriteReportSectionHandler` already takes the same port — no handler change.

## 9. Phases & gates

### Phase 1 — Provider registry + adapters (OCP)
1. Add `secret-cipher.ts`.
2. Move `openai/anthropic/ollama` adapters out of `factory.ts` into
   `src/llm/adapters/` (pure move — same behaviour).
3. Add `deepseek.ts`, `minimax.ts`.
4. Add `provider-registry.ts`; rewrite `factory.ts` to delegate; keep exports.
5. **Gate:** `pnpm --filter @donordesk/infrastructure typecheck && test`; new
   adapter unit tests (mock `fetch`) pass.

### Phase 2 — Config resolver (SRP/DIP)
1. Add `ILlmConfigResolver` port (application `ports/infrastructure.ts` or keep
   the interface local to infrastructure — finalised at implementation to avoid
   a breaking app-port change).
2. Implement `PlatformLlmConfigResolver` (precedence, decrypt, map).
3. **Gate:** resolver unit tests (mock prisma) pass: GLOBAL vs TENANT
   precedence, disabled excluded, missing key → null, decrypt round-trip.

### Phase 3 — LLM report generator (LSP/ISP)
1. Implement `LlmReportDraftGenerator` + prompt builder + JSON validator +
   stub fallback + model identity.
2. Extend `IReportDraftGenerator` with optional `readonly model`.
3. Update `generate-report-draft.ts` to record real model info.
4. **Gate:** generator tests pass — happy path, malformed JSON → stub, null
   provider → stub, rewrite fallback; existing `report-intelligence` tests green.

### Phase 4 — Container + verification
1. Wire container (lazy provider factory).
2. Full verification suite:
   - `pnpm -r typecheck`
   - `pnpm -r build`
   - `pnpm -r test`
   - `pnpm -r lint`
3. Update `memorybank/pending.md` (strike "Wire real LLM providers") and this
   doc's status.
4. **Gate:** zero errors, all existing + new tests pass.

## 10. Test matrix

| Layer | Tests |
|---|---|
| Adapters | Request shape (URL, headers, body), response parsing, missing-key throw, usage mapping, `fetch` mock for deepseek/minimax/openai/anthropic/ollama |
| Registry | `createLLMProvider` resolves registered names; unknown name → stub/throw per existing behaviour |
| Resolver | precedence (TENANT > GLOBAL), disabled filter, decrypt, `null` when unset |
| Generator | happy path (mock provider returns valid JSON), malformed JSON → stub, provider error → stub, null provider → stub, rewrite fallback, model identity exposure |
| Regression | existing `report-intelligence.test.mjs`, `phase-d.test.mjs`, `feature18-setup.test.mjs` remain green |

## 11. Non-goals (explicit)

- No routing through `CompliantModelRouter` / `LlmModel` table (jurisdiction-aware
  routing stays a follow-up; platform-config `model` is authoritative).
- No refactor of existing private encrypt/decrypt in `control-plane.ts` /
  `google-drive-credentials.ts` (out of scope; new shared helper is additive).
- No worker (FastAPI) LLM wiring in this pass — `drafting.py`/`compliance.py`
  remain heuristic mirrors of the TS stub; a real worker LLM path can reuse the
  same provider config later through Kestra secrets.
- No web UI changes; existing `generateDraftAction` and API routes are unchanged.

## 12. Definition of done

- [x] SuperAdmin LLM config (GLOBAL/TENANT, enabled) is consumed at runtime
- [x] DeepSeek + MiniMax adapters live, registered, unit-tested
- [x] Report drafting narrates via the configured provider with stub fallback
- [x] Generation runs and `llm_runs` record the real model/prompt version
- [x] `pnpm -r typecheck`, `pnpm -r build`, `pnpm -r test`, `pnpm -r lint` all pass
- [x] `memorybank/pending.md` updated; no regressions in features 06/08/09/11/12/13/14/20

## 13. Production incidents found in live verification (2026-08-17)

Live regeneration produced **stub text with no AI narrative** because of four
stacked production issues, all now fixed:

1. **Malformed stored MiniMax config** (`baseUrl: "https://minimax.io-v1"`
   — DNS fails — and `model: "Minimax-2.7"` — MiniMax returns `base_resp=2013`
   with empty content). Correct values: `https://api.minimax.io/v1` +
   `MiniMax-Text-01`. Every LLM call threw → silent stub fallback.
   - `llm-config-resolver.ts` now validates `baseUrl` defensively (valid
     scheme + plausible TLD) and drops malformed values back to defaults.
   - `control-plane.ts testProvider` now tests the **stored** `baseUrl` (with
     per-provider path) instead of always the default URL, so a broken
     endpoint surfaces in SuperAdmin instead of passing a false "verified".
2. **`parseSections` discarded claims/sourceReferences** (always `[]`) and
   accepted empty content. Now it preserves both with type validation and
   rejects sections without non-empty title/content. Covered by
   `test/llm-report-draft-generator.test.mjs` (5 tests).
3. **Silent LLM failures**: `LlmReportDraftGenerator` now logs provider
   errors / empty responses / parse failures before falling back to the
   stub (logger injected from container).
4. **`llm_runs` ledger broken by missing grants + FK**: `LlmModel` and
   `LlmPrompt` have no `tenantId` (global reference tables) and were absent
   from `infra/postgres/rls.sql` → `recordRun` upsert/insert failed
   `permission denied`. Added plain DML grants to `rls.sql` and applied on
   prod. `recordRun` also now upserts the `LlmPrompt` row ("report-drafter")
   so the `LlmRun.promptId` FK succeeds.

## 14. Production incident 2: credits burned on stub fallback (2026-08-17)

**Symptom:** "AI draft credits exhausted for the current billing month" after
the tenant's STARTER quota (5) was hit, while every draft contained only stub
text.

**Root cause:** MiniMax timed out on the full report prompt (maxTokens=8192
forced an oversized generation; real call exceeded the 120s adapter timeout).
`LlmReportDraftGenerator` caught the failure and silently returned stub
sections, but `GenerateReportDraftHandler` recorded the run as
`status="success"` + `billableUnits=1` + `modelId=minimax`. Five timeouts =
five consumed credits, all for stub content.

**Fixes (commit `4145408`):**
- `IReportDraftGenerator.generateDraft` now returns `{ sections, usedFallback }`.
  Stub generator always reports `usedFallback=true`; the LLM generator reports
  the actual per-call outcome.
- Handler: a stub-fallback draft is NOT AI-generated — the reserved credit is
  released, the run is recorded as `status="error"` (never billed), the
  draft's `generatedByAi` is corrected to false, and the audit event includes
  `fallback=true`.
- `maxTokens` 8192 → 4096 for report drafting. Verified live: MiniMax
  completes the realistic full prompt in ~38s (previously timed out at >120s).
- Rewrite parsing tolerates plain-text output from MiniMax (it sometimes
  narrates without the JSON wrapper).
- `ReportPlan` version allocation moved to `createNextVersion` — a P2002
  retry loop — so concurrent regenerations cannot collide on the same version
  (previously raised Prisma unique-violation as an unhandled 500).

**Production data correction:** the 5 mislabeled success runs (timestamps
13:30–14:38 exactly match the timeout events) were re-marked `error` with
`billableUnits=0`; the `AI_DRAFT_CREDITS` counter was reset to 0. The tenant
can now regenerate up to its real monthly quota, and each generation that
actually completes will consume exactly one credit.

## 15. SuperAdmin Billing & credits (IMPLEMENTED 2026-08-17)

- `GET /superadmin/billing` — one row per tenant: effective plan (resolved
  with the same MANUAL > ENTERPRISE_CONTRACT > GRANDFATHERED >
  CREEM_SUBSCRIPTION > TRIAL > DEFAULT precedence the app uses), AI-credit
  allowance, current-month used/reserved, override flag, subscription.
- `POST /superadmin/tenants/:id/credits {mode: SET|INCREASE|DECREASE, value}`
  — writes an append-only MANUAL `EntitlementGrant` with a full PlanLimits
  override (only the AI-credit bucket changes). Takes effect immediately
  (highest precedence). Audit-trailed.
- `POST /superadmin/tenants/:id/credits/reset` — zeroes the current UTC-month
  `AI_DRAFT_CREDITS` UsageCounter. Audit-trailed.
- Dashboard "Billing & credits" tab with Set / Increase / Reduce / Reset
  actions per tenant.
- Timezone note: MANUAL grants must be written via the typed Prisma client,
  not raw SQL with JS Date params — the host DB session timezone
  (Europe/Berlin) would store CEST wall time and the effective-date filter
  would read a 2h future-dated grant as inactive. Verified live: INCREASE +7
  resolves to MANUAL/override immediately, reset zeroes the counter, and test
  grants were cleaned up afterwards.

## 16. AI Reporter sidecar (IMPLEMENTED 2026-08-28)

A new, higher-level writing pipeline sits **above** the provider wiring and
behind the **same** `IReportDraftGenerator` port, feature-flagged by
`AI_REPORTER_ENABLED=1`. It reuses the existing platform-provider config and
adds an OpenAI-compatible LLM path in the worker plus an embedding path for
semantic retrieval.

- **TS adapter:** `src/llm/ai-reporter-draft-generator.ts` (`AiReporterDraftGenerator`)
  + `src/llm/ai-reporter-worker-client.ts` (`HttpWorkerClient`, sends
  `X-Internal-Token`) — fulfils `generateDraft`/`generateSection`/`rewriteSection`,
  returns the same `GeneratedSection` shape, and falls back to the stub on any
  worker/provider failure. Wired in `container.ts` `getReportDraftGenerator`
  (feature-flagged) alongside the existing `LlmReportDraftGenerator`.
- **Python worker:** `apps/workers/app/ai_reporter.py` — versioned writer
  contract, OpenAI-compatible LLM gateway, and a **draft → critique → refine**
  pipeline orchestrated with **LangGraph** (plain sequential fallback if
  LangGraph is absent). Routes `/v1/ai-reporter/{health,section,rewrite}` behind
  `X-Internal-Token`. `langgraph` added to `apps/workers/requirements.txt`.
- **Embeddings (new provider-adjacent stack):**
  - `src/llm/embedding.ts` — `IEmbeddingGenerator` / `IEmbeddingStore` ports.
  - `src/llm/embedding-generator.ts` — `OpenAiEmbeddingGenerator` +
    `OllamaEmbeddingGenerator` (selected via `EMBEDDING_PROVIDER`, default
    ollama for a zero-external-API baseline).
  - `src/repositories/embedding-store.ts` — `PrismaEmbeddingStore` (raw-SQL,
    RLS-scoped HNSW cosine search over pgvector).
  - `src/llm/semantic-evidence-retriever.ts` — `SemanticEvidenceRetriever`
    behind `IEvidenceRetriever` (lexical fallback when embeddings unavailable).
  - `src/llm/embedding-backfill.ts` + `embedding:backfill` CLI.
- **DB:** `embedding` vector column on `EvidenceEmbedding`
  (`Unsupported("vector(1536)")`) via `infra/postgres/pgvector.sql` (wired into
  `db:migrate`); dev image `pgvector/pgvector:pg16`.
- **Historical intelligence:** `src/llm/prior-period.ts`
  (`DeterministicPriorPeriodService`) feeds approved prior-period narrative into
  the writer brief.
- **Runtime provider note:** the worker resolves its own LLM from
  `AI_REPORTER_PROVIDER/MODEL/BASE_URL/API_KEY` (independent of the TS platform
  config). Keep the worker's `INTERNAL_TOKEN` in sync with the API's.

Full detail: `../imp/AI-REPORTER-IMPLEMENTATION-PLAN.md` §11.

---

## 17. AI Reporter v2 (IMPLEMENTED 2026-08-29)

The v1 sidecar in §16 is extended by **typed artifacts**, **deterministic
artifact validators**, **per-section timeout + per-section fallback**,
and a **25-case eval corpus**. The same `AI_REPORTER_ENABLED=1` feature flag
controls activation; the rollout is **off by default** pending the
controlled rollout per `../imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`.

### 17.1 Wire-format additions (additive)

`GeneratedSection` (in `packages/application/src/ports/reporting.ts`) now
carries four optional additive fields:

```ts
export interface GeneratedSection {
  // ... existing fields
  artifacts?: GeneratedArtifact[];
  qa?: GeneratedQaItem[];
  chartSpec?: GeneratedChartSpec;
  deltaFromPrior?: GeneratedDelta;
}

export type GeneratedArtifact =
  | { kind: "TABLE";       ordinal: number; payload: GeneratedTablePayload; sourceReferences: SourceReference[] }
  | { kind: "CHART";       ordinal: number; payload: GeneratedChartSpec;   sourceReferences: SourceReference[] }
  | { kind: "LIST";        ordinal: number; payload: GeneratedListPayload;  sourceReferences: SourceReference[] }
  | { kind: "KEY_VALUE";   ordinal: number; payload: GeneratedKeyValuePayload; sourceReferences: SourceReference[] }
  | { kind: "QA";          ordinal: number; payload: GeneratedQaItem;     sourceReferences: SourceReference[] }
  | { kind: "DELTA";       ordinal: number; payload: GeneratedDelta;      sourceReferences: SourceReference[] };
```

Every v1 generator (`StubReportDraftGenerator`, `LlmReportDraftGenerator`)
continues to produce sections with these fields absent; consumers
iterate `section.artifacts ?? []` safely. **LSP is preserved.**

The TS-side wire mirror is in `packages/contracts/src/reporting.ts`
(Zod schemas for every field, exported as `ReportArtifactSchema`,
`ReportArtifactListSchema`, `ReportChartSpecSchema`, etc.).

### 17.2 Worker code (12-module SRP split)

The 622-LOC `apps/workers/app/ai_reporter.py` was replaced by a 12-module
package at `apps/workers/app/ai_reporter/`:

| Module | Responsibility |
|--------|----------------|
| `models.py` | Pydantic v2 strict wire types (additive over v1) |
| `writer_contract.py` | Persona rules, banned phrases (`BANNED_PHRASES`), numeric verbatim rule |
| `llm_gateway.py` | Provider-agnostic chat completions + JSON extract |
| `outline.py` | Per-inputType outline slot templates |
| `chart_suggester.py` | Deterministic chart heuristic (LINE / PIE / BAR / GAUGE) |
| `draft_writer.py` | Builds the user prompt; calls LLM; coerces to `GeneratedSection` |
| `critique_writer.py` | Typed `CritiqueIssue` enum (BANNED_PHRASE / NUMERIC_PARAPHRASE / MISSING_TABLE / MISSING_CHART / MISSING_QA / MISSING_DELTA / DUPLICATE / WORD_LIMIT / UNSUPPORTED_CLAIM / MISSING_CAVEAT / OTHER) |
| `refiner.py` | Single-pass refinement under the same retrieval manifest |
| `artifact_validators.py` | Python mirror of TS validators; `runAll(section, req, opts)` aggregates 9 hard gates |
| `timeouts.py` | Per-section deadline policy; raises `SectionTimeoutError` |
| `pipeline.py` | LangGraph wiring (`START → draft → critique → refine → END`); plain sequential fallback |
| `router.py` | FastAPI routes (`/v1/ai-reporter/{health,section,rewrite}`) |

`apps/workers/app/main.py` now imports `from .ai_reporter.router import router
as ai_reporter_router` and `v1.include_router(ai_reporter_router)`.

### 17.3 Writer contract v2 (`WRITER_CONTRACT_VERSION=2`)

New / hardened rules (mirrored in `packages/infrastructure/src/llm/ai-reporter/contract.ts`):

| Rule | Type | Mechanism |
|------|------|-----------|
| Numeric verbatim | HARD | After generation, `numeric-atom-extractor` enumerates every numeric substring in `verifiedFindings` + `indicatorUpdates`. Evaluator rejects any value that diverges. |
| Donor-token blocklist | HARD | `BANNED_PHRASES` list. Evaluator regex-fails the case if any banned phrase appears in `content`. Includes "transformative", "life-changing", "in these challenging times", etc. |
| Repetition guard | HARD (pre-empt) | `SectionBriefBuilder` injects `priorSectionsSummary` (concise bullets of already-written sections). Writer rule: do not repeat; reference by section name. |
| Mandatory-Q&A discipline | HARD | For every `mandatoryQuestions[]` entry, the writer MUST emit one `qa` slot with ≥1 `sourceReference`. Missing slot → retry once, then per-section fallback. |
| Tables when ≥3 indicators / activities share scope | HARD | Writer must emit one `TABLE` artifact with ≥3 rows; every row must cite evidence. |
| Charts when conditions met | HARD | Writer must emit one `CHART` artifact (numbers must come from `verifiedFindings` exactly). |
| Cliché block | HARD | Banned phrase list. |
| Delta articulation when prior exists | HARD | When `priorNarrative[]` is non-empty, writer must emit one `DELTA` artifact with `fromValue` / `toValue` / `direction`. |
| Tone for `audience: DONOR` | SOFT | No enforcement; kept as prompt hint. |
| Word-count discipline | HARD | `minWords` / `maxWords` per section → deterministic length check. |

### 17.4 Deterministic artifact validators

9 hard gates implemented in **both** Python and TypeScript, with
parity verified by `apps/workers/tests/test_ai_reporter.py` and
`packages/infrastructure/test/artifact-validators.test.mjs`:

| Validator | Type | Behavior |
|-----------|------|----------|
| `assertNumericExactness` | HARD gate | Every numeric in `verifiedFindings` appears verbatim in `content` or artifact payload. |
| `assertTableCitation` | HARD gate | Every non-empty TABLE row has ≥1 `sourceReference`. |
| `assertChartDataGrounding` | HARD gate | Every CHART data point equals a numeric atom from `verifiedFindings` (exact equality, parsed number compare). |
| `assertMandatoryQuestionsAnswered` | HARD gate | Every `mandatoryQuestions[]` has exactly one matching `qa[]` entry; each `qa.answer` has ≥1 `sourceReference`. |
| `assertDeltaFromPrior` | HARD gate | When `priorNarrative` non-empty, `deltaFromPrior` is present. |
| `assertWordCount` | HARD gate | `minWords ≤ words(content) ≤ maxWords`. |
| `assertRepetition` | HARD gate | No sentence shares ≥70% token overlap with any `priorSectionsSummary` sentence. |
| `assertBannedPhrases` | HARD gate | No banned phrase from `BANNED_PHRASES` appears in `content`. |
| `assertArtifactOrdering` | HARD gate | `artifacts[].ordinal` strictly increasing, no gaps > 1. |

These run in three places:
1. **Worker self-check** (Python `artifact_validators.py`); on hard fail
   the worker retries once with validator feedback appended to the user
   prompt, then degrades per-section with `usedFallback: true,
   fallbackReason: "VALIDATOR_FAILED"`.
2. **Eval harness** (`reporting:eval-cli.ts`): every hard validator is
   asserted per case. Soft validators are reported but never fail a case.
3. **Application-side** (`IReportRevisionService.commitChange`): unchanged
   — the assurance pipeline keeps the final say.

### 17.5 Per-section timeout + per-section fallback

- `ai_reporter.DRAFT_TIMEOUT_MS` (default `45_000`) — per-section cap.
- `ai_reporter.TOTAL_DRAFT_TIMEOUT_MS` (default `240_000`) — per-draft wall clock.
- On per-section timeout: retry once; on second timeout, the section
  returns `usedFallback: true, fallbackReason: "PROVIDER_TIMEOUT"` for
  that section only. **The rest of the draft continues.**
- `GenerateReportDraftHandler.generateSectionsInBackground` aggregates
  `usedFallback = sections.some(s => s.usedFallback)` for the draft
  level, but the successful sections keep their AI-generated content.
- `GeneratedDraftResult.fallbackReason` enum extended with `"VALIDATOR_FAILED"`.

This is a **correctness fix** over v1: the old behavior demoted the
whole draft to `usedFallback: true` whenever any one section was slow,
even if the other sections had drafted successfully (the same pattern
that caused "all-sections-fallback-to-stub" 2026-08-20, recorded in
`pending.md`).

### 17.6 Persistence (`ReportArtifact` + `ReportArtifactRow`)

New Prisma models + migration
`packages/infrastructure/prisma/migrations/20260828200000_ai_reporter_artifacts/migration.sql`.
RLS forced on both tables; cross-tenant INSERT verified to fail.
`IReportArtifactRepository` port +
`PrismaReportArtifactRepository` impl wired into
`GenerateReportDraftHandler` (best-effort, non-blocking) and
`RewriteReportSectionHandler` (best-effort). `GetReportDraftHandler`
returns artifacts alongside content.

### 17.7 Eval corpus growth (8 → 25 cases)

`packages/infrastructure/test/fixtures/reporting-golden.json` grew to 25
cases. New deterministic metrics in `ReportDraftEvaluator`:
`banned-phrase`, `qa-coverage`, `narrative-length-vs-target`,
`artifact-coverage`, `citation-density`. Hard-gated when the brief
declares the expectation; soft signal otherwise.

All 25/25 pass locally. `pnpm --filter @donordesk/infrastructure
reporting:eval` returns:
```
Eval: 25/25 cases correct
```

### 17.8 Activation (off by default)

Same flag as v1 (`AI_REPORTER_ENABLED=1`); same env wiring as v1 plus
`AI_REPORTER_URL=http://127.0.0.1:8092` to override the legacy
`localhost:5000` default. The worker and api use **different**
`INTERNAL_TOKEN`s — `/opt/donordesk/shared/api.env` and
`/opt/donordesk/shared/workers.env`. Match them when debugging 401s.

The feature flag is **OFF** in `/opt/donordesk/shared/api.env` as of
2026-08-29. The controlled rollout (preview → 2 pilots → default) is the
next step. Procedure in `../imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`.

### 17.9 Deploy specifics (from `CONTABO-DEPLOY.md` §9)

The deploy script (`scripts/deploy-fast.sh`) now ships four api-scoped
tars instead of one:
- `apps/api/{dist,node_modules,package.json,tsconfig.json}` (tree layout).
- `packages/{contracts,domain,application,infrastructure}/{dist,package.json,prisma,scripts}`.
- `node_modules/.pnpm/` (pnpm virtual store).
- `apps/workers/app/` (Python worker tree, excluding `.venv/`).

The api systemd unit now uses
`WorkingDirectory=/opt/donordesk/app/apps/api` so the workspace symlinks
resolve correctly. Both files are checked in
(`infra/systemd/donordesk-api.service`).

Full detail:
- `../imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md` — the design plan
- `../imp/AI-REPORTER-2-RESULTS.md` — post-deploy retrospective
- `../imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md` — operator runbook

### 18. Runtime provisioning — SaaS control-plane → Contabo runtime envs (2026-09-01, release `20260901140002`)

The implementation plan above closed the SuperAdmin → generation-runtime gap
*for the api's resolution path*. It did **not** close the same gap for the
AI Reporter sidecar, which reads only its worker-side env file. Selecting
DeepSeek / MiniMax on `sa.donordesk.online` still required an operator to
copy secrets into `/opt/donordesk/shared/workers.env`. That manual step
was never done, so reports kept falling through to the deterministic stub.

**New: `packages/infrastructure/src/platform/runtime-provisioner.ts`
(`RuntimeProvisioner`)** — atomic, idempotent env-file writer + scoped
restart. Wired into `PlatformControlPlane.upsertConfiguration` /
`deleteConfiguration` for GLOBAL enabled LLM configs, and called by an
api-boot backfill so a provider selected on sa.donordesk reaches
donordesk.online automatically.

Key design points:
- **Atomic write**: temp file → `chmod 0640` → `chown donordesk:donordesk`
  → rename. Preserves existing ownership on re-provision.
- **Idempotent managed block**
  (`# dd-managed:LLM:GLOBAL:<provider>:<scopeId>` … `# dd-end-managed:LLM`)
  — updates replace cleanly; re-applies are a no-op.
- **Security**: secret value is written ONLY into the env file, never into
  the command line / argv / log / audit. Restart via `execFile` of
  `/usr/bin/sudo` + `/usr/bin/systemctl restart …` with no shell.
- **Host (operator one-time, root)**:
  - `/etc/sudoers.d/donordesk-restart` (`0440`, root):
    `donordesk ALL=(root) NOPASSWD: /usr/bin/systemctl restart
    donordesk-api, /usr/bin/systemctl restart donordesk-workers`.
  - `donordesk-api.service` `ReadWritePaths=/opt/donesk/shared
    /opt/donordesk/shared/storage` (expanded so the api process,
    `User=donordesk`, can write the env files).
  - `/opt/donordesk/shared/{api,workers}.env` chowned to
    `donordesk:donordesk` mode `0640` so the api can write them;
    systemd (root) still reads them via `EnvironmentFile`.
- **Regression tests**
  (`packages/infrastructure/test/runtime-provisioner.test.mjs`, 5 tests):
  inserts/updates/idempotent managed block, remove targeted block,
  render block content, `provisionGlobalLlm` writes env files + scoped
  restart + **no secret in logs**, `deprovisionGlobalLlm` removes blocks
  + restarts.

### 19. MiniMax "Test connection" 404 → fix (2026-09-01)

`PlatformControlPlane.testProvider` (used by the SuperAdmin's "Test
connection" button → api route `POST /superadmin/configurations/:id/test`)
built the test URL as `baseUrl + paths[provider]`. For MiniMax,
`paths["minimax"] = "/v1/models"`. The operator saved
`baseUrl = "https://api.minimax.io/v1"` (correct for the **worker**'s
`llm_gateway.py`, which does `f"{base_url}/chat/completions"` →
`.../v1/chat/completions`). But the Test-connection path then appended
`/v1/models` → **`https://api.minimax.io/v1/v1/models` → HTTP 404**.
Direct probes confirmed `https://api.minimax.io/v1/models` → 200 vs
`.../v1/v1/models` → 404.

Fix in `control-plane.ts testProvider`: strip a trailing `/v1` segment from
`baseUrl` before appending the provider path, so the path's leading `/v1`
doesn't double:

```ts
config.baseUrl.trim().replace(/\/(v1)\/?$/, "").replace(/\/+$/, "")
```

Verified via the actual UI path (login as superadmin + `POST
/superadmin/configurations/:id/test` for both providers):

```
minimax → { "status": "SUCCESS", "message": "Connection and credentials verified" }
deepseek → { "status": "SUCCESS", "message": "Connection and credentials verified" }
```

The MiniMax draft endpoint also produces real AI content (Executive
Summary on OUT-1 30/120, `parseOutcome: VALID, critiqueIssues: 0,
validatorIssues: []`).

## 20. Claude + Gemini, one active provider per scope, resolution per generation (IMPLEMENTED + DEPLOYED 2026-09-26, `20260926153744`)

- **Providers:** `anthropic` (official SDKs: `@anthropic-ai/sdk` in `factory.ts`, `anthropic` in the worker `llm_gateway._chat_anthropic`) and `gemini` (OpenAI-compatible, `https://generativelanguage.googleapis.com/v1beta/openai`, model required, no `response_format`) join deepseek/minimax/openai.
- **Claude rules:**
  - Default model `claude-opus-5`.
  - No `temperature`; `max_tokens ≥ 16000`; no prefill.
  - Optional `effort` sent as `output_config.effort`.
  - `stop_reason: "refusal"` raises, giving a deterministic fallback.
  - `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) for `claude-opus-5` / `claude-fable-5-1`.
  - 429/5xx/529 map to `TransientProviderError`.
- **Resolution:** `PlatformLlmConfigResolver.resolve({tenantId})` returns a `ResolvedLlmConfig` (`scope` TENANT|GLOBAL, `configId`, `fingerprint`). `container.getReportDraftGenerator` resolves it on every generation and caches per tenant by fingerprint.
  - The AI Reporter sends `{provider, model, baseUrl, apiKey, effort}` in each worker request.
  - Env credentials are used only when the request names the same provider as the env.
- **Control plane:** one enabled LLM per scope (`configuration.superseded` audit). Enabling a saved card provisions it with the stored secret. `describeModelAvailability` makes Test connection validate the model.
- **Credits:** see `Features/19-Tiers-And-Payments.md` §8.4 (a tenant's own provider is not metered).
- **Tests:** `apps/workers/tests/test_ai_reporter_providers.py`, `packages/infrastructure/test/llm-providers.test.mjs`, `packages/application/test/tenant-own-ai-provider.test.mjs`.
- **Production state 2026-09-26:** the GLOBAL default is `anthropic` / `claude-sonnet-4-6` (DeepSeek and MiniMax disabled). A production smoke test through the real api → worker path resolved every tenant to it correctly, but **Anthropic returned 400 "credit balance is too low"**. Until the Anthropic account is funded, sections fall back to the deterministic draft.
