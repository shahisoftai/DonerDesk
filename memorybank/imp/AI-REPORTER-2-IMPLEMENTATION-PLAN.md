# AI Reporter 2.0 — Implementation Plan (Narrative, Lists, Tables, Charts, Numeric Discipline, Historical Intelligence, Per-Section Reliability)

**Status:** ✅ **IMPLEMENTED AND DEPLOYED** (release `20260828200000`, 2026-08-29)
**Deployed commit:** `a2ffc29 feat(ai-reporter-2): typed artifacts, validators, per-section fallback, 25-case eval` on `0005-report-enhanc-03` (pushed to `origin/0005-report-enhanc-03`).
**Owner:** DonorDesk engineering
**Goal:** Extend the existing AI Reporter (§11 baseline) so every section it
produces is a **structured, evidence-grounded, donor-grade artifact** — with
typed lists, tables, charts, mandatory-Q&A answers, exact-numeric preservation,
and historical deltas — without weakening the deterministic assurance layer.
**Governing principle (unchanged):** *AI writes, deterministic code verifies,
humans approve.*

**Feature flag (post-deploy):** `AI_REPORTER_ENABLED=1` is **off by default**
in `/opt/donordesk/shared/api.env`. The system continues to use
`LlmReportDraftGenerator` for all tenants until the operator flips the flag per
the controlled-rollout plan in §8 below. The new routes (`/v1/ai-reporter/*`)
are registered and reachable on the worker at `127.0.0.1:8092`; the new
artifacts, validators, persistence, and per-section fallback are in the
running api code; only the feature-flag gate remains off.

---

## 0. Scope summary

In one paragraph: we extend the `IReportDraftGenerator` output (`GeneratedSection`)
with a typed `artifacts` array (tables, charts, lists, key/value), a typed
`qa` array (mandatory-question answers), a per-section `chartSpec` slot for
interactive rendering, and a per-section `deltaFromPrior` slot for historical
intelligence. We split the Python worker into SRP modules (writer contract,
LLM gateway, draft writer, critique writer, refiner, graph), introduce a per-
section timeout with per-section fallback so one slow section no longer
demotes the whole draft, harden the writer contract with deterministic
constraints (verbatim numerics, donor-tokens blocklist, repetition guard,
mandatory-Q&A discipline), grow the golden corpus from 8 to 25+ cases covering
artifacts/charts/period-comparison/coherence, and add deterministic artifact
validators (numeric-exactness, table-cell grounding, chart-data grounding,
Q&A completeness). We then ship behind `AI_REPORTER_ENABLED=1`, roll out to
internal-preview tenants, then default.

**Deployment target:** Contabo `vmi2954830.contaboserver.net` (§10, §13 of
`memorybank/contabo-ops.md`). Same host, same systemd units (`donordesk-api`,
`donordesk-web`, `donordesk-workers`), same fast-deploy path (§21.1). No new
public ports. New Python worker modules ship as part of the
`donordesk-workers` artifact (§17 worker unit). No new packages, no
schema-versioned infra changes except a single additive Prisma migration
introducing `ReportArtifact` and `ReportArtifactRow` (§3.3) and the supporting
RLS row in `infra/postgres/rls.sql`.

**Hard non-goals:** never modify the assurance pipeline
(`IReportAssuranceService`, `IClaimVerifier`, `IAssertionExtractor`,
`ReportRevision.commitChange`); never expose chart data that is not in the
retrieval manifest; never let an LLM choose a `dataBinding` without the
deterministic chart-data resolver (`resolveChartData`) being able to rebuild
the same series from verified findings.

---

## 1. Baseline and verification

Everything in §11 of the existing plan remains the baseline. Before starting
new work, **verify** the baseline on the host and in CI:

```bash
# local
pnpm -r typecheck
pnpm -r build
pnpm --filter @donordesk/infrastructure test
pnpm --filter @donordesk/infrastructure reporting:eval     # 8/8
( cd apps/workers && pytest -q )                            # full suite

# remote (per §13 of contabo-ops.md)
ssh contabo 'curl -fsS http://127.0.0.1:4001/health && curl -fsS http://127.0.0.1:4001/ready'
ssh contabo 'curl -fsS http://127.0.0.1:8092/v1/ai-reporter/health'   # worker
ssh contabo 'systemctl is-active donordesk-api donordesk-web donordesk-workers'
```

No baseline item may regress at any phase exit gate.

---

## 2. SOLID discipline (binding for every change)

| Principle | How it shows up in this plan |
|---|---|
| **SRP** | Python `ai_reporter.py` is split into one module per responsibility (§3.1). Each TS module owns one concern (e.g. `SectionOutlineBuilder`, `MandatoryQuestionsResolver`, `NumericAtomExtractor`). |
| **OCP** | New fields on `GeneratedSection` are **additive and optional** (`artifacts?`, `qa?`, `chartSpec?`, `deltaFromPrior?`). No removal of any existing field. Existing consumers continue to work. |
| **LSP** | The new `IReportDraftGenerator` returns are backward-compatible. `StubReportDraftGenerator`, `LlmReportDraftGenerator`, and `AiReporterDraftGenerator` must each produce well-typed optional artifacts; when a generator cannot, it returns the same shape with `artifacts: []` and `qa: []`. |
| **ISP** | Application ports get narrow purpose-built ports: `IChartSuggestionPolicy`, `INumericAtomExtractor`, `IReportArtifactPersister`, `ISectionOutlinePolicy`, `IPerSectionTimeoutPolicy`. |
| **DIP** | Application handlers depend only on ports. The Python worker exposes its capabilities behind Pydantic models; the TS adapter mirrors them. No `langgraph` symbols leak into application code; no Prisma client leaks into the worker; no `pydantic` symbols leak into TS. |

Every new file passes this checklist before merge:

- [ ] One clearly-named responsibility in the module docstring.
- [ ] Zero infrastructure imports in `packages/application`.
- [ ] Zero domain imports in `packages/infrastructure/llm/ai-reporter/...`.
- [ ] Pydantic v2 strict models for every Python wire surface (no `Any` in
      public models except for `telemetry`, which is opaque).
- [ ] Zod schemas added to `packages/contracts` for every new TS wire surface;
      application use-cases import the Zod schema, not the TypeScript type.
- [ ] Pure builder / pure validator pairs: any module that produces a value
      has a sibling module that validates it deterministically.

---

## 3. Architecture (delta from §11)

### 3.1 Python worker — split by responsibility

The current `apps/workers/app/ai_reporter.py` (622 LOC, seven concerns in one
file) is decomposed into:

| New module | Responsibility | Public surface |
|---|---|---|
| `apps/workers/app/ai_reporter/__init__.py` | Re-exports | `router`, models |
| `apps/workers/app/ai_reporter/models.py` | Pydantic wire models (strict) | `SectionBrief`, `Context`, `SectionDraftRequest`, `SectionDraftResponse`, `RewriteRequest`, `RewriteResponse`, `Artifact`, `ChartSpec`, `QaItem`, `DeltaFromPrior`, `Telemetry` |
| `apps/workers/app/ai_reporter/writer_contract.py` | Writer contract version, persona rules, donor-tokens blocklist, numeric-verbatim rule | `WRITER_CONTRACT_VERSION`, `system_prompt(version)`, `donor_token_blocklist()`, `BANNED_PHRASES`, `NUMERIC_VERBATIM_RULE` |
| `apps/workers/app/ai_reporter/llm_gateway.py` | Provider-agnostic chat completions, JSON extract, model registry, telemetry shaping | `LlmGateway` class, `ChatResult`, `extract_json(text)`, `resolve_model(provider, model)` |
| `apps/workers/app/ai_reporter/draft_writer.py` | Compose the user prompt; call LLM; coerce to `SectionDraftResponse` | `DraftWriter` |
| `apps/workers/app/ai_reporter/critique_writer.py` | Grounding-conformance critique; emits typed `CritiqueIssue[]` | `CritiqueWriter`, `CritiqueIssue`, `IssueKind` enum |
| `apps/workers/app/ai_reporter/refiner.py` | Apply critique under the same retrieval manifest; one pass only | `Refiner` |
| `apps/workers/app/ai_reporter/outline.py` | Per-`inputType` outline templates | `outline_for(input_type, brief) -> list[OutlineSlot]` |
| `apps/workers/app/ai_reporter/chart_suggester.py` | Apply the deterministic chart heuristic to a brief | `ChartSuggester.suggest(...) -> ChartSpec?` |
| `apps/workers/app/ai_reporter/pipeline.py` | LangGraph wiring (start→draft→critique→refine→end) with `try/except ImportError` fallback to sequential | `run_pipeline(req, section_id) -> SectionDraftResponse` |
| `apps/workers/app/ai_reporter/router.py` | FastAPI routes — does not import LLM code directly | `router` |
| `apps/workers/app/ai_reporter/timeouts.py` | Per-section timeout policy; raises `SectionTimeoutError` | `with_section_timeout(callable, deadline_seconds)` |

The existing `apps/workers/app/ai_reporter.py` is deleted; `main.py` imports
the new `router` from `apps.workers.app.ai_reporter.router`. The route paths
and JSON shapes stay identical (LSP for the TS adapter).

### 3.2 TypeScript — adapter split

| New / moved module | Responsibility |
|---|---|
| `packages/infrastructure/src/llm/ai-reporter/types.ts` | Wire-format types only (mirror Pydantic). No behavior. |
| `packages/infrastructure/src/llm/ai-reporter/contract.ts` | `WRITER_CONTRACT_VERSION` (matches Python). |
| `packages/infrastructure/src/llm/ai-reporter/outline.ts` | TS mirror of `outline_for` for stub fallback and pre-flight checks. |
| `packages/infrastructure/src/llm/ai-reporter/chart-suggester.ts` | Deterministic chart heuristic (matches Python; SSOT is Python and is read once via a generator-emitted JSON snapshot — see §6). |
| `packages/infrastructure/src/llm/ai-reporter/section-brief-builder.ts` | Already exists; extended to inject `outlineSlots`, `mandatoryQuestions[]` resolver, `priorSectionsSummary`, `chartSuggestion?`. |
| `packages/infrastructure/src/llm/ai-reporter/numeric-atom-extractor.ts` | Deterministic numeric extraction (currency, percentages, counts, units). Pure function; reused by evaluator. |
| `packages/infrastructure/src/llm/ai-reporter/per-section-timeout.ts` | Per-call deadline enforcement with cooperative cancellation. |
| `packages/infrastructure/src/llm/ai-reporter/http-worker-client.ts` | Unchanged. |
| `packages/infrastructure/src/llm/ai-reporter-draft-generator.ts` | Extended, not replaced. Maps new typed fields. |

### 3.3 Persistence — additive

A single Prisma migration introduces typed artifact storage. **No existing
column changes.**

| New model | Fields | Why |
|---|---|---|
| `ReportArtifact` | `id, tenantId, sectionId, revisionId, kind (TABLE \| CHART \| LIST \| KEY_VALUE \| QA \| DELTA), ordinal int, caption text?, payloadJson Json, createdAt` | One row per artifact. `kind = CHART` is the typed chart spec; `kind = QA` is one row per mandatory question; `kind = TABLE` / `LIST` / `KEY_VALUE` / `DELTA` follow the same model. |
| `ReportArtifactRow` | `id, tenantId, artifactId, ordinal int, cellsJson Json, sourceRefsJson String[]` | For `kind = TABLE`: row cells; `sourceRefsJson` enforces per-row citation. |

`ReportSection.chartConfigJson` (existing) becomes an ECharts-driven **fallback**
rendering only (used for the user-chosen chart in the section header). The new
`kind = CHART` artifact is the AI Reporter's typed chart, which the interactive
panel renders identically (same ECharts option shape). Both can coexist; user
choice still wins for the section header.

RLS rows are added in `infra/postgres/rls.sql` for both tables with
`tenant_isolation` enabled+forced. `donordesk_app` gets `INSERT/SELECT/UPDATE/DELETE`.

### 3.4 Wire-format additions (additive)

```ts
// packages/application/src/ports/reporting.ts (additive)
export type ArtifactKind = "TABLE" | "CHART" | "LIST" | "KEY_VALUE" | "QA" | "DELTA";

export interface ReportArtifact {
  kind: ArtifactKind;
  caption?: string;
  /** Order within section; lower comes first. */
  ordinal: number;
  /** Kind-specific payload; consumers branch on `kind`. */
  payload: TablePayload | ChartPayload | ListPayload | KeyValuePayload | QaPayload | DeltaPayload;
  sourceReferences: SourceReference[];
}

export interface TablePayload {
  columns: Array<{ key: string; label: string; unit?: string }>;
  rows: Array<{
    cells: Array<string | number | null>;
    sourceReferences: SourceReference[];
  }>;
}

export interface ChartPayload {
  type: "BAR" | "LINE" | "AREA" | "PIE" | "RADAR" | "GAUGE";
  dataBinding: "INDICATOR_COMPARISON" | "INDICATOR_ACHIEVEMENT" | "STATUS_DISTRIBUTION";
  unit?: string;
  title: string;
  caption: string;
  categories: string[];
  series: Array<{ name: string; data: Array<number | string | null>; sourceReferences: SourceReference[] }>;
  sourceReferences: SourceReference[];
}

export interface ListPayload { ordered: boolean; items: Array<{ text: string; sourceReferences: SourceReference[] }>; }
export interface KeyValuePayload { entries: Array<{ key: string; value: string; sourceReferences: SourceReference[] }>; }
export interface QaPayload { question: string; answer: string; sourceReferences: SourceReference[]; }
export interface DeltaPayload { metric: string; fromValue: string; toValue: string; direction: "UP" | "DOWN" | "FLAT"; evidenceSummary: string; sourceReferences: SourceReference[]; }

// GeneratedSection — extended, never replaced
export interface GeneratedSection {
  sectionId: string;
  title: string;
  content: string;        // unchanged; markdown prose
  claims: ReportClaimDraft[];
  sourceReferences: SourceReference[];
  artifacts?: ReportArtifact[];       // NEW, optional; [] when unsupported
  qa?: Array<{ question: string; answer: string; sourceReferences: SourceReference[] }>;  // NEW
  chartSpec?: ChartPayload;           // NEW; convenience pointer into artifacts[kind=CHART]
  deltaFromPrior?: DeltaPayload;      // NEW
}
```

Pydantic mirrors in `apps/workers/app/ai_reporter/models.py`; Zod schemas in
`packages/contracts/src/reporting.ts` (`ReportArtifactSchema`, `TablePayloadSchema`,
etc.); application handlers import the Zod schemas for parse-time validation.

---

## 4. Writer contract v2 (versioned)

`WRITER_CONTRACT_VERSION` bumps from `1` → `2`. Bump only after all backends
report `2` is in production (gated rollout, §11).

New / hardened rules:

| Rule | Type | Mechanism |
|---|---|---|
| Numeric verbatim | HARD | After generation, a deterministic `numeric-atom-extractor` enumerates every numeric substring in `verifiedFindings` + `indicatorUpdates`. The evaluator rejects any value that diverges. In the prompt, the writer inherits the same numeric string back from the brief, so it cannot paraphrase. |
| Donor-token blocklist | HARD | `BANNED_PHRASES` (Python module + TS mirror). Evaluator regex-fails the case if any banned phrase appears in `content`. Includes: "transformative", "life-changing", "lives were changed", "in these challenging times", "fully achieved" (without caveat), "permanent", "dramatically", "game-changer". |
| Repetition guard | HARD (pre-empt) | `SectionBriefBuilder` injects `priorSectionsSummary: string[]` (concise bullets of already-written sections). Writer contract rule: do not repeat; if a value already appears in `priorSectionsSummary`, reference by section name. |
| Mandatory-Q&A discipline | HARD | For every `mandatoryQuestions[]` entry, the writer MUST emit one `qa` slot with at least one `sourceReference`. Missing slot → section retry once with explicit reminder, then `usedFallback` per section (not whole draft). |
| Mandatory-Question overlap with assurance | HARD | `QAArtifact` answer is verified against `assertionExtractor` output; mismatch → claim `FAILED` + retry. |
| Tables when ≥3 indicators or ≥3 activities share scope | HARD | Writer must emit one `kind=TABLE` artifact with ≥3 rows; every row must cite evidence. |
| Charts when conditions met (see §5) | HARD | Writer must emit one `kind=CHART` artifact. Numbers must come from `verifiedFindings` exactly. |
| Cliché block | HARD | Banned phrase list above. |
| Delta articulation when prior exists | HARD | When `priorNarrative[]` non-empty for this section, writer MUST emit one `kind=DELTA` artifact with `fromValue`/`toValue`/`direction`. |
| Tone for `audience: DONOR` | SOFT | No enforcement; kept as prompt hint. |
| Word-count discipline | HARD | `minWords`/`maxWords` per section → deterministic length check (eval metric). |

The contract rules live in `writer_contract.py` as a list of typed `Rule`
objects (id, severity, description, examples, validator_kind). The TS mirror
reads them from `contract.ts`. The evaluator loads them via
`pnpm --filter @donordesk/infrastructure reporting:eval` and asserts each
hard rule on every case.

---

## 5. Chart suggestion heuristic (deterministic)

Applied in both `apps/workers/app/ai_reporter/chart_suggester.py` and
`packages/infrastructure/src/llm/ai-reporter/chart-suggester.ts`. SSOT = Python.
The TS mirror is read once at worker startup and cached; mismatch raises a
build-time error.

| Input condition | Suggested chart |
|---|---|
| ≥1 indicator with baseline/target/achievement for the current period | `INDICATOR_COMPARISON`, `BAR` |
| ≥2 periods for the same indicator (from `priorNarrative`) | `INDICATOR_ACHIEVEMENT`, `LINE` |
| ≥3 disaggregation categories (gender, district, donor) for one indicator | `INDICATOR_ACHIEVEMENT`, `BAR` (stacked) |
| Activity output vs. target ratio | `INDICATOR_COMPARISON`, `GAUGE` (single indicator) |
| Status distribution (verified/needs review/draft) for ≥3 claims | `STATUS_DISTRIBUTION`, `PIE` |
| None of the above | `null` (no chart suggested) |

The suggested chart is **fed to the writer as a brief hint** (it MUST emit it
when present). The writer cannot freely invent a chart binding outside this
list. If the writer emits a chart the brief did not suggest, the evaluator
flags a soft warning (signal only).

---

## 6. Deterministic artifact validators

Pure, side-effect-free validators live in
`packages/infrastructure/src/ai/artifact-validators.ts` (TS) and are
re-implemented in `apps/workers/app/ai_reporter/artifact_validators.py`
(Python) so the worker can self-check before returning.

| Validator | Determinism | Rule |
|---|---|---|
| `assertNumericExactness(section, verifiedFindings)` | hard gate | Every numeric token in `verifiedFindings` (and `indicatorUpdates`) MUST appear verbatim in either `content` or `artifacts[kind=TABLE|LIST|KEY_VALUE].payload` cells. |
| `assertTableCitation(section)` | hard gate | Every `rows[i].cells` non-empty cell must have ≥1 `sourceReference` from the retrieval manifest. |
| `assertChartDataGrounding(section, verifiedFindings)` | hard gate | Every `series[j].data[k]` must equal a numeric atom from `verifiedFindings` (exact equality, parsed number compare). |
| `assertMandatoryQuestionsAnswered(section, brief)` | hard gate | Every `mandatoryQuestions[]` entry has exactly one matching `qa[]` entry; each `qa.answer` has ≥1 `sourceReference`. |
| `assertDeltaFromPrior(section, priorNarrative)` | soft | When `priorNarrative[]` non-empty, `deltaFromPrior` is present and consistent with the comparator. |
| `assertWordCount(section, brief)` | hard gate | `minWords ≤ words(content) ≤ maxWords`. |
| `assertRepetition(section, priorSectionsSummary)` | hard gate | No sentence in `content` may share ≥70% token overlap with any `priorSectionsSummary` sentence. |
| `assertBannedPhrases(section)` | hard gate | No banned phrase from `BANNED_PHRASES` appears in `content`. |
| `assertArtifactOrdering(section)` | hard | `artifacts[].ordinal` strictly increasing, no gaps > 1. |

These validators run in three places:
1. **Worker-side self-check** before returning the response (Python
   `artifact_validators.py`); on hard fail the worker retries once with the
   validator output appended to the user prompt, then degrades per-section to
   `usedFallback: true` with reason `VALIDATOR_FAILED` (added to the enum).
2. **Eval harness** (`reporting-eval-cli.ts`): every hard validator is
   asserted per case. Soft validators are reported but never fail a case.
3. **Application-side** (`IReportRevisionService.commitChange`): unchanged —
   the assurance pipeline keeps the final say.

---

## 7. Eval corpus growth (8 → 25 cases)

New fixture format: every case extends the existing
`ReportGoldenCase` with:

```ts
interface ReportGoldenCase {
  // ... existing fields
  artifacts?: {
    tables?: Array<{ columns: string[]; rows: Array<{ cells: string[]; mustCiteAnyOf: string[] }> }>;
    charts?: Array<{ type: string; dataBinding: string; mustEqualVerified: string[] }>;
    qa?: Array<{ question: string; answerMustContain: string[]; mustCiteAnyOf: string[] }>;
    delta?: { metric: string; fromValue: string; toValue: string; direction: "UP"|"DOWN"|"FLAT" };
  };
  mandatoryQuestions?: string[];
  brief?: { minWords: number; maxWords: number; bannedPhrases?: string[] };
}
```

Cases to add (17 new = 25 total):

| # | Case name | Coverage |
|---|---|---|
| 9 | `un-ocha-annual-table-disaggregation` | Mandates `kind=TABLE` for ≥3 indicators. |
| 10 | `gavi-gf-chart-line-time-series` | Mandates `kind=CHART` LINE with prior period. |
| 11 | `echo-budget-mandatory-qa` | 3 mandatory questions; each must be answered with source refs. |
| 12 | `usaid-bha-banned-phrase-rejection` | Section contains "transformative" → must fail. |
| 13 | `gavi-gf-numeric-paraphrase-rejection` | Writer paraphrases "1,200" as "approximately twelve hundred" → must fail. |
| 14 | `climate-fund-chart-pie-status` | Status distribution → PIE chart. |
| 15 | `gpe-education-cross-section-repetition` | Two sections, second repeats first → first must reference, second must not duplicate. |
| 16 | `echo-budget-shorten-rewrite-preserve-numbers` | Rewrite SHORTEN mode keeps all numbers. |
| 17 | `un-ocha-annual-delta-from-prior` | Prior narrative exists → `deltaFromPrior` slot filled. |
| 18 | `un-ocha-annual-no-prior-baseline` | No prior → section must say "baseline period". |
| 19 | `gavi-gf-audience-donor-tone` | DONOR audience → tone shifts; numbers preserved. |
| 20 | `gavi-gf-audience-internal-tone` | INTERNAL audience → terser; numbers preserved. |
| 21 | `echo-budget-per-section-timeout` | Worker hits timeout on one section → that section falls back; rest of draft succeeds. |
| 22 | `un-ocha-contradictory-chunks` | Two retrieved chunks disagree → writer picks verified and footnotes the other. |
| 23 | `climate-fund-no-figures-no-chart` | No numeric data → no chart artifact emitted. |
| 24 | `echo-budget-word-count-tight` | `maxWords: 80` exceeded → must fail. |
| 25 | `gavi-gf-malformed-artifact-recovery` | LLM emits `payload = "raw string"`; worker coerces to typed `LIST` artifact with source refs. |

Each new case must:
- Use real donor template names (UN OCHA, USAID BHA, ECHO, Gavi/GF, GPE, Adaptation Fund).
- Reference evidence IDs present in the existing chunk fixture set.
- Declare `expected: "pass" | "fail"` for each hard validator.

---

## 8. Per-section timeout + per-section fallback

Today, if one section times out, the whole draft demotes to `usedFallback: true`.
This is wrong: it punishes the user for one slow LLM call. New behavior:

- `ai_reporter.DRAFT_TIMEOUT_MS` (default 45_000) — per section.
- `ai_reporter.TOTAL_DRAFT_TIMEOUT_MS` (default 240_000) — per draft (wall clock).
- On per-section timeout: the worker returns `usedFallback: true,
  fallbackReason: "PROVIDER_TIMEOUT"` for that section only. `DraftGenerator`
  maps this to a section-level fallback (`usedFallback: true` on the
  `GeneratedSectionResult`, not on `GeneratedDraftResult`).
- The `GenerateReportDraftHandler` (existing) is updated to:
  - record each section result into its own `llm_runs` row (already true),
  - aggregate draft-level `usedFallback = sections.some(s => s.usedFallback)` —
    same as today,
  - **not** flip `generatedByAi = false` for a per-section timeout if at least
    one section succeeded (today it does).
- A new metric `report.draft.section.fallback` (audit event) is added.

Implementation: `apps/workers/app/ai_reporter/timeouts.py` plus
`packages/infrastructure/src/llm/ai-reporter/per-section-timeout.ts`. No
external dependency on `asyncio.timeout` is allowed to leak into TS — TS uses
`AbortSignal.timeout` (already in `http-worker-client.ts`) plus a wall-clock
check.

---

## 9. Retrieval improvements

These are minor extensions to existing ports — no port changes:

- **`NumericTableRetriever`**: a sibling of `SemanticEvidenceRetriever` that
  emits typed `{ indicatorId, period, value, unit, evidenceId }` rows. The
  writer brief includes a `numericTable: NumericRow[]` block; the writer
  references it for `kind=TABLE` and `kind=CHART` payloads.
- **`ContradictionDetector`**: when two chunks for the same
  indicator/period disagree, both are surfaced to the writer with
  `conflict: true`; the writer contract rule requires the writer to choose
  the verified (assertion-extracted) value and footnote the other.
- **Per-brief budget cap**: `SectionBriefBuilder` caps each prompt at 14k
  tokens; truncates retrieved chunks symmetrically (head + tail) to fit.
- **Citation density contract**: ≥1 `sourceReference` per 60 words AND per
  table row AND per chart data point. Deterministic check in
  `assertCitationDensity(section, brief)` (new validator).

---

## 10. Implementation phases

Each phase ends with: `pnpm -r typecheck`, `pnpm -r build`, full test suites,
worker `pytest`, `reporting:eval` ≥ current case pass count, contabo preflight
(§12), and a release commit. No phase changes the assurance pipeline or
existing public contracts.

### Phase 0 — Test scaffolding (≤1 day)

- Add `packages/infrastructure/src/llm/ai-reporter/__tests__/numeric-atom-extractor.test.ts` and 4 sibling tests (Jest/Vitest — confirm framework in repo; the explore agent saw no existing TS tests, so we add the framework if absent).
- Add `apps/workers/tests/test_ai_reporter.py` with: `test_extract_json`, `test_donor_token_blocklist`, `test_numeric_verbatim_rule`, `test_writer_contract_v2_system_prompt`. These run without an LLM.
- Add `apps/workers/tests/test_artifact_validators.py`.
- Exit gate: green in CI; no behavior change on Contabo.

### Phase 1 — Wire-format additive (no behavioral change)

1. Add Pydantic models in `apps/workers/app/ai_reporter/models.py`.
2. Add Zod schemas in `packages/contracts/src/reporting.ts`.
3. Extend `GeneratedSection` in `packages/application/src/ports/reporting.ts` with optional fields.
4. Update TS wire mirror `packages/infrastructure/src/llm/ai-reporter/types.ts`.
5. Update `apps/workers/app/ai_reporter.py` route response to include
   `artifacts: []`, `qa: []`, `chartSpec: null`, `deltaFromPrior: null`
   defaults (worker still emits no artifacts in this phase; the field is
   always present but empty).
6. Exit gate: `pnpm -r typecheck`, full pytest, full eval (8/8), no schema
   migration needed.

### Phase 2 — Python worker SRP split + writer contract v2

1. Create the 11 Python modules in §3.1; delete `ai_reporter.py` (one big
   refactor commit; tests gate it).
2. Implement `writer_contract.py` rules + `BANNED_PHRASES`.
3. Implement `outline.py` per-`inputType` slot templates.
4. Implement `chart_suggester.py`.
5. Re-run the existing 8-case eval via the new modules; **must remain 8/8**.
6. Exit gate: pytest green; worker `/v1/ai-reporter/health` 200; deploy worker-only
   via `scripts/deploy-fast.sh SCOPE=api` (the worker ships inside the api tar).

### Phase 3 — Artifact generators + validators

1. Implement `apps/workers/app/ai_reporter/draft_writer.py` to emit
   `artifacts[]`, `qa[]`, `chartSpec`, `deltaFromPrior` when the brief
   requests them.
2. Implement `apps/workers/app/ai_reporter/critique_writer.py` with typed
   `CritiqueIssue` (kind: `BANNED_PHRASE | NUMERIC_PARAPHRASE | MISSING_TABLE
   | MISSING_CHART | MISSING_QA | MISSING_DELTA | DUPLICATE | WORD_LIMIT`).
3. Implement `apps/workers/app/ai_reporter/refiner.py` (single pass; same
   retrieval manifest constraint).
4. Implement `apps/workers/app/ai_reporter/artifact_validators.py` (Python
   mirror of §6).
5. Implement `packages/infrastructure/src/ai/artifact-validators.ts`.
6. Wire validators into `apps/workers/app/ai_reporter/router.py` (self-check
   + one retry on hard fail + per-section fallback).
7. Wire validators into `packages/infrastructure/src/ai/reporting-eval.ts`
   (the eval CLI now consumes the new fixture shape).
8. Exit gate: existing 8 cases still pass; new validators are unit-tested
   but not yet gated on existing 8.

### Phase 4 — Corpus growth (8 → 25) + new metrics

1. Add 17 new cases to `packages/infrastructure/test/fixtures/reporting-golden.json` per §7.
2. Add new deterministic metrics in `ReportDraftEvaluator`:
   - `citation-density` (hard),
   - `artifact-coverage` (hard when brief mandates artifacts),
   - `banned-phrase` (hard),
   - `numeric-verbatim` (hard),
   - `qa-coverage` (hard when brief has mandatory questions),
   - `delta-coverage` (hard when prior exists).
3. Soft metrics (signal only, never fail): `tone-donor`, `tone-internal`,
   `cross-section-coherence`.
4. Add `narrative-length-vs-target` (hard when ±10% of word target violated).
5. Exit gate: 25/25 pass for the structural cases; LLM-judge metrics are
   non-blocking. Confirm in CI.

### Phase 5 — Per-section timeout + per-section fallback

1. Implement `apps/workers/app/ai_reporter/timeouts.py`.
2. Implement `packages/infrastructure/src/llm/ai-reporter/per-section-timeout.ts`.
3. Update `packages/application/src/use-cases/reporting/generate-report-draft.ts`
   `generateSectionsInBackground` (lines 427–608) to compute
   `generatedByAi` per draft as
   `sections.some(s => s.usedFallback === false && !s.deterministicReason)`.
4. Add audit event `report.draft.section.fallback`.
5. New enum value `VALIDATOR_FAILED` in
   `GeneratedDraftResult["fallbackReason"]`.
6. Exit gate: new eval case #21 passes (timeout case); existing 8 still pass.

### Phase 6 — Persistence (additive migration)

1. Generate `prisma migrate dev --create-only` for `ReportArtifact` and
   `ReportArtifactRow` (`@db.Text` for `payloadJson`/`cellsJson` initially;
   migrate to `JsonB` later if querying becomes necessary).
2. Add rows to `infra/postgres/rls.sql` with `tenant_isolation` enabled+forced.
3. Verify `donordesk_app` has `INSERT/SELECT/UPDATE/DELETE` and no `BYPASSRLS`.
4. Implement `packages/infrastructure/src/repositories/report-artifact-repository.ts`
   (interface in `packages/application/src/ports/reporting.ts` as
   `IReportArtifactRepository`).
5. Wire persistence into `packages/application/src/use-cases/reporting/generate-report-draft.ts`:
   after each successful `commitChange`, persist `artifacts[]` via
   `IReportArtifactRepository.saveMany(...)`.
6. Implement read API for artifacts in
   `packages/application/src/use-cases/reporting/get-report-draft.ts`:
   the existing handler now returns `artifacts` alongside content.
7. Exit gate: cross-tenant isolation tests pass; existing GET tests pass.

### Phase 7 — Reader UI (web)

1. Render `artifacts` in `apps/web` per `kind`:
   - `TABLE` → existing TanStack table (reuse).
   - `CHART` → ECharts renderer reusing the existing `buildChartOption`
     (§3.1 of `chart-config.ts`).
   - `LIST` / `KEY_VALUE` → minimal presentational components.
   - `QA` → rendered as a styled FAQ block with source refs inline.
   - `DELTA` → inline metric chip with ↑/↓/→ arrow + source tooltip.
2. Charts respect `dataBinding` resolution through the existing
   `resolveChartData` builder — pixel-identical to the user-chosen chart.
3. Per-artifact "regenerate" button calls `rewriteSection` (existing port) with
   `mode: "REWRITE"` and the artifact's caption as `instructions`.
4. Exit gate: existing UI tests pass; new component tests cover each kind.

### Phase 8 — Rollout

1. **Internal preview:** `AI_REPORTER_ENABLED=1` only on the DonorDesk-internal
   tenant. Eval corpus run nightly; per-tenant dashboard (Grafana, namespaced)
   for `report.draft.section.fallback` rate, `validator.failed` rate,
   per-section latency p50/p95/p99.
2. **Controlled pilot:** two external tenants; one ECHO template, one Gavi/GF
   template; on/off comparison vs. `LlmReportDraftGenerator` baseline for 2
   weeks.
3. **Default:** flip the flag for all tenants; remove the legacy
   `LlmReportDraftGenerator` factory path (keep the class for emergency
   rollback). Bump `WRITER_CONTRACT_VERSION` to 2.

### Phase 9 — Documentation

1. Update `memorybank/imp/AI-REPORTER-IMPLEMENTATION-PLAN.md` §11 status table.
2. New file `memorybank/imp/AI-REPORTER-2.md` for the v2 design (this file is
   its source).
3. Update `memorybank/contabo-ops.md` §26 with the new release ID and any
   per-tenant flag notes.
4. `AGENTS.md` updated with the new artifact validators and CLI commands.

---

## 11. Rollout gating matrix

| Gate | Trigger to pass before next phase |
|---|---|
| Typecheck | `pnpm -r typecheck` exits 0 |
| Build | `pnpm -r build` exits 0 |
| Worker tests | `(cd apps/workers && pytest -q)` exits 0; `ruff check` exits 0; `mypy` exits 0 |
| TS tests | `pnpm -r test` exits 0 (add Vitest if missing) |
| Eval | `pnpm --filter @donordesk/infrastructure reporting:eval` reports all cases match `expected` |
| Contabo preflight | §12 of `contabo-ops.md` exits 0; candidate ports 3002/4001/8092 free |
| Schema | `pnpm db:migrate && pnpm db:seed` exits 0 on a fresh DB; RLS verified as `donordesk_app` |
| Backups | off-host backup ≤24h old; last restore-test ≤30 days old (§23 of `contabo-ops.md`) |
| Smoke | public HTTPS `/`, `/login`, `/api/health`, `/api/ready`, worker `/v1/ai-reporter/health` all 2xx |
| Audit | every mutation in §19 of `contabo-ops.md` is logged |

---

## 12. Deployment to Contabo

The deployment follows `scripts/deploy-fast.sh` (§21.1) and the rules in
`memorybank/contabo-ops.md`. Each phase ships as one release commit.

### 12.1 Pre-deploy (operator)

```bash
# 0. Same-day preflight (cancels the deploy if anything is wrong).
ssh contabo '
  set -eu
  date --iso-8601=seconds
  ss -lntup | head -40
  for p in 3002 4001 8092; do
    if ss -lntH "sport = :$p" | grep -q .; then
      echo "BLOCKED: port $p occupied" >&2; exit 1
    fi
  done
  systemctl is-active postgresql@16-main redis-server lshttpd nghttpx docker fail2ban
  pg_lsclusters
  /usr/local/lsws/bin/litespeed -t 2>&1 | tail -20
'

# 1. Confirm the latest off-host backup + restore-test status (scripts/backup.sh).
ssh contabo 'ls -1t /opt/donordesk/shared/backups-status/ | head -5'

# 2. Apply the additive Prisma migration as donordesk_migrator (Phases 6+):
#    Always before the API/web deploy; deploy script does not run migrations.
ssh contabo '
  set -a; . /root/donordesk-migrator.env; set +a
  cd /opt/donordesk/app
  DATABASE_URL="$DATABASE_ADMIN_URL" \
    /opt/donordesk/app/node_modules/.bin/prisma migrate deploy \
    --schema /opt/donordesk/app/prisma/schema.prisma
'
psql "$DATABASE_ADMIN_URL" --set ON_ERROR_STOP=1 \
  --file /opt/donordesk/app/prisma/rls.sql

# 3. Confirm off-host backup completed in the last 24h, last restore ≤30d.
```

### 12.2 Build + ship

```bash
# Local: typecheck + full build (SCOPE=both is required when the worker changed).
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)" scripts/deploy-fast.sh SCOPE=both

# Worker-only deploy (no schema change): SCOPE=api is fine — the worker ships in
# the api tar via the application package.
```

The deploy script streams the api tar (now containing the updated Python
worker code under `apps/workers/app/ai_reporter/`) into
`/opt/donordesk/app/apps/workers/app/ai_reporter/`. The systemd worker unit
(`donordesk-workers.service`) reads from `/opt/donordesk/workers` (its own
working dir) — we copy the new files via:

```bash
ssh contabo '
  set -eu
  # Mirror the shipped worker tree over the systemd-managed one
  rsync -a --delete \
    /opt/donordesk/app/apps/workers/app/ai_reporter/ \
    /opt/donordesk/workers/app/ai_reporter/
  systemctl restart donordesk-workers
'
```

This `rsync` step is **added to `scripts/deploy-fast.sh`** under the
"worker changed" branch (detected when `git diff` covers
`apps/workers/app/ai_reporter/`). All other apps are unaffected.

### 12.3 Feature flag

```bash
# Enable for one tenant (preview).
ssh contabo '
  set -a; . /opt/donordesk/shared/api.env; set +a
  # The AI Reporter flag is read once per request from process.env, so we
  # append (not overwrite) to the file and restart the API.
  grep -q "^AI_REPORTER_ENABLED=" /opt/donordesk/shared/api.env \
    && sed -i "s/^AI_REPORTER_ENABLED=.*/AI_REPORTER_ENABLED=1/" /opt/donordesk/shared/api.env \
    || echo "AI_REPORTER_ENABLED=1" >> /opt/donordesk/shared/api.env
  systemctl restart donordesk-api
'
```

Tenant scoping uses the existing `llmConfigResolver` plus a new
`aiReporterTenantsAllowlist` env (`AI_REPORTER_TENANT_ALLOWLIST=tenant_a,tenant_b`).
Default: empty (off everywhere).

### 12.4 Post-deploy verification

```bash
ssh contabo '
  ss -lntp | grep -E "127.0.0.1:(3002|4001|8092)"
  curl -fsS http://127.0.0.1:4001/health
  curl -fsS http://127.0.0.1:4001/ready
  curl -fsS http://127.0.0.1:8092/v1/ai-reporter/health
  systemctl --no-pager --full status donordesk-api donordesk-web donordesk-workers
  df -h /
  free -h
'
# Public acceptance (§13, §24 of contabo-ops.md)
curl -fsS https://donordesk.online/login
curl -fsS https://donordesk.online/api/health
```

### 12.5 Rollback

Rollback is a single `tar xzf` per §22 of `contabo-ops.md`:

```bash
ssh contabo '
  PRE=$(ls -1t /opt/donordesk/backups/dd-app-pre-*.tgz | head -1)
  rm -rf /opt/donordesk/app
  tar -xzf "$PRE" -C /opt/donordesk
  systemctl restart donordesk-api donordesk-web donordesk-workers
'
```

The fast-deploy script does **not** auto-rollback on verify failure (2026-08-28
lesson). On any failure the operator runs the rollback command above, then
records the failure mode in §26 of `contabo-ops.md`.

**Database rollback:** migrations are additive; rolling back the application
does not require a DB rollback. If Phase 6 introduced the migration and we
need to reverse it, run the inverse migration script stored at
`infra/postgres/migrations/<id>_down.sql` (we ship one for every additive
migration).

---

## 13. Failure modes & mitigations

| Failure | Detection | Mitigation |
|---|---|---|
| LLM emits paraphrased numerics | `assertNumericExactness` | retry once with `numeric_verbatim_rule` reminder; per-section fallback |
| Banned phrase leaks through | `assertBannedPhrases` | retry once with rule reminder; per-section fallback |
| Per-section LLM call exceeds 45s | `timeouts.py` | per-section fallback (not whole-draft); audit event |
| LangGraph raises mid-pipeline | `except Exception` in `pipeline.run` | sequential fallback already in place; log + retry; per-section fallback |
| Retrieval returns zero chunks | brief includes empty `retrievedEvidence` + `INSUFFICIENT_INPUT` flag | writer returns deterministic short section with that flag; assurance surfaces it |
| Contradictory chunks | `ContradictionDetector` | brief marks both; writer picks verified + footnotes |
| Tenant flag mismatch | factory logs + falls back to stub | loud warning, same as today |
| Worker unreachable | `HttpWorkerClient.post` returns `Result.err` | `AiReporterDraftGenerator` falls back to `StubReportDraftGenerator` per the existing constructor |
| `WRITER_CONTRACT_VERSION` mismatch | TS reads `contractVersion` from response; logs warning if != env | log only; no fallback (response always parses) |
| Chart data diverges from verified | `assertChartDataGrounding` | retry once with hint; per-section fallback |
| Word count out of band | `assertWordCount` | retry once; per-section fallback |
| Cross-section repetition | `assertRepetition` | retry once; per-section fallback |

---

## 14. Definition of done (per phase, plus release)

- All phase exit gates from §11 green.
- `pnpm --filter @donordesk/infrastructure reporting:eval` ≥ current case
  count.
- Contabo preflight + post-deploy verification recorded in §26 of
  `contabo-ops.md`.
- Pre-deploy tar at `/opt/donordesk/backups/dd-app-pre-<id>.tgz`.
- Off-host backup ≤24h old; restore-test recorded.
- No new public ports; no unrelated OLS validation errors; no
  global-runtime upgrade.
- `report.draft.section.fallback` rate ≤5% in Grafana for the pilot tenants
  over a 7-day window before default rollout.

**Status of these gates (release `20260828200000`):**
- ✅ All phase exit gates green: TS typecheck (8 pkgs), TS build, Python
  mypy (22 files), Python pytest 55/55, TS infra tests 136/137 (1 pre-existing
  skip), eval corpus 25/25.
- ✅ Contabo preflight + post-deploy verification: see §26 entry for
  `2026-08-29` in `memorybank/contabo-ops.md`.
- ✅ Pre-deploy tar created: `dd-app-pre-20260828200000.tgz` (rotated with
  last 3 kept).
- ⚠ Off-host backup: not configured (per §23 of `contabo-ops.md` — no
  automated off-host DonorDesk backup is scheduled yet); the on-host
  pre-deploy tarball is the rollback target.
- ✅ No new public ports (worker `127.0.0.1:8092` was already exposed;
  api/web ports unchanged).
- N/A `report.draft.section.fallback` rate: only relevant after
  `AI_REPORTER_ENABLED=1` is flipped for at least one tenant. Currently OFF.

**For the final 2.x release (post-deploy, gated rollout):**
- ⏳ `AI_REPORTER_ENABLED=1` enabled by default for all tenants after
  Phase 8 (controlled rollout per §8) completes successfully.
- ⏳ Legacy `LlmReportDraftGenerator` factory path removed (class retained
  for emergency rollback) after the default rollout is stable for ≥1 week.
- ✅ 25-case eval passes; results in §26 (`memorybank/contabo-ops.md`).
- ⏳ One full week of zero `report.draft.section.fallback` rate >5%, zero
  `validator.failed` events in the audit log — measured after default
  rollout.
- ⏳ Backup & restore drill on Contabo (§23 of `contabo-ops.md`) green —
  depends on the off-host backup being scheduled (separate workstream).

---

## 15. Open questions for product (not blocking code)

1. **Audience-aware `dataBinding`.** Should `audience: INTERNAL` ever produce a
   chart? (Default: no — internal narrative only.)
2. **Per-tenant disabling of `kind=DELTA`.** Some donors don't want period
   deltas surfaced if they don't fund the comparison period. Decision needed
   before Phase 8.
3. **`GAUGE` chart in exported PDF.** The existing export renderer
   (ECharts SSR) supports GAUGE; confirm via a manual export test before
   Phase 7.
4. **Charts per section vs. one chart per draft.** The plan emits one chart
   per section when conditions are met. If multiple sections meet conditions
   for the same indicator, do we still emit one per section, or coalesce?
   Plan: per section (matches the existing user-chosen chart behavior).

---

## 16. File index (final list of touched files)

```
# Phase 1 (wire-format, additive)
packages/contracts/src/reporting.ts
packages/application/src/ports/reporting.ts
packages/infrastructure/src/llm/ai-reporter/types.ts
apps/workers/app/ai_reporter.py                            # delete
apps/workers/app/ai_reporter/                              # new dir
  __init__.py
  models.py
  writer_contract.py
  llm_gateway.py
  draft_writer.py
  critique_writer.py
  refiner.py
  outline.py
  chart_suggester.py
  pipeline.py
  router.py
  timeouts.py
apps/workers/app/main.py                                   # import path change

# Phase 2 (writer contract v2)
apps/workers/app/ai_reporter/writer_contract.py
apps/workers/app/ai_reporter/outline.py
apps/workers/app/ai_reporter/chart_suggester.py

# Phase 3 (artifacts + validators)
apps/workers/app/ai_reporter/draft_writer.py
apps/workers/app/ai_reporter/critique_writer.py
apps/workers/app/ai_reporter/refiner.py
apps/workers/app/ai_reporter/artifact_validators.py
packages/infrastructure/src/ai/artifact-validators.ts
packages/infrastructure/src/ai/reporting-eval.ts           # extend
packages/infrastructure/src/ai/reporting-eval-cli.ts       # extend

# Phase 4 (corpus growth)
packages/infrastructure/test/fixtures/reporting-golden.json

# Phase 5 (per-section timeout)
apps/workers/app/ai_reporter/timeouts.py
packages/infrastructure/src/llm/ai-reporter/per-section-timeout.ts
packages/application/src/use-cases/reporting/generate-report-draft.ts
packages/application/src/ports/reporting.ts                # enum extension

# Phase 6 (persistence)
packages/infrastructure/prisma/schema.prisma               # add ReportArtifact + ReportArtifactRow
packages/infrastructure/prisma/migrations/<ts>_ai_reporter_artifacts/migration.sql
infra/postgres/rls.sql
packages/application/src/ports/reporting.ts                # IReportArtifactRepository
packages/application/src/use-cases/reporting/get-report-draft.ts
packages/infrastructure/src/repositories/report-artifact-repository.ts

# Phase 7 (UI)
apps/web/...                                               # new artifact renderers

# Deploy plumbing
scripts/deploy-fast.sh                                     # add worker-rsync step + AI_REPORTER_TENANT_ALLOWLIST hint
infra/systemd/donordesk-api.service                        # WorkingDirectory=/opt/donordesk/app/apps/api (workspace symlinks resolve here)
infra/systemd/donordesk-workers.service                    # unchanged (rsync keeps the file in place)

# Docs
memorybank/imp/AI-REPORTER-IMPLEMENTATION-PLAN.md          # §11 status table bump
memorybank/imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md        # new (this file)
memorybank/contabo-ops.md                                  # §26 entries per release
AGENTS.md                                                   # commands + validators
```

---

## 17. End state (one sentence)

A donor sees, for every report section: prose with verbatim numbers, a typed
table of disaggregated achievements, a typed chart that exactly matches the
underlying indicators, an explicit delta from the prior period when one
exists, and a per-question source-cited answer — produced by an LLM that
failed its deterministic self-checks for *that section only* if anything went
wrong, with the assurance pipeline unchanged and every artifact persisted
under RLS.
