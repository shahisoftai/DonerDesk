# LLM Provider Wiring — Implementation Plan

**Status:** PLANNED
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
    `verifiedFindings` and `evidencePackages`; never compute, aggregate, or
    invent numbers; report `qualityFlags` verbatim; return JSON.
  - User prompt: serialised `ReportPlan` sections, `VerifiedFinding[]`,
    `EvidencePackage[]` (id/title/chunks), `ReportingProfileSnapshot`
    (tone/language/rules), and the section titles to draft.
  - Output schema:
    ```json
    { "sections": [ { "title": "...", "content": "...",
        "claims": [ { "text": "...", "type": "NUMERIC|FACTUAL|CAUSAL|QUALITATIVE",
            "proposedSources": [ { "evidenceId": "...", "chunkId": "...", "sourceText": "..." } ] } ],
        "sourceReferences": [ { "type": "indicator|evidence|...", "id": "...", "label": "..." } ] } ] }
    ```
- **Parse + validate**: structural validation of every field; any invalid shape,
  parse error, provider error, or timeout → delegate to `StubReportDraftGenerator`.
- **Rewrite**: same pattern for `rewriteSection` (mode/audience/instructions in
  prompt; malformed/empty → stub).
- **Model identity**: after first successful resolution, cache
  `model = { modelId: provider.name, modelVersion: provider.model, promptVersion: Number(provider.promptVersion) }`; expose as `readonly model`.
- Because downstream `DeterministicClaimVerifier` re-verifies every claim, an
  LLM hallucination cannot reach approval (gate policy in Feature 20 §2.4).

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
