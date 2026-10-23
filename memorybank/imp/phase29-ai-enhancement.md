# Phase 29 — AI enhancement programme: implementation plan

**DonorDesk Version 2.010 (proposed)** · branch `0014-ai-enhancement` (from `0013-programme-management` once merged)

**Status: PROPOSED — not started.** This is the plan for the five-batch AI enhancement programme
(29.1–29.5) derived from the full codebase + memorybank audit and the competitor AI-feature survey
(2026-10-23; sources: `packages/*`, `apps/*`, `memorybank/Features/01–42`,
`memorybank/imp/product-gap-audit-2026-10-20.md`, and a 25-product external landscape review —
TolaData, ActivityInfo, Fluxx, SurveyCTO, Kobo, Sopact, Foundant, Instrumentl, Notion/Asana/Monday/
ClickUp/M365/Gemini AI).

**Goal.** DonorDesk already has the sector's strongest *grounded generation* spine (AI Reporter v6,
claim verification, number grounding, PII firewall, cost ledger). The programme makes the rest of
the product as intelligent as its reporter: evidence that classifies and links itself, data a
person can *ask questions about*, field toil (paper registers, note polishing) removed by
OCR + proposals, the reporting lifecycle (donor Q&A, compliance statements, templates, translation)
AI-assisted end to end, and a published trust posture. Every addition keeps the human in charge:
**AI proposes, a person disposes, numbers stay deterministic.**

**Competitive frame (why now).** Ask-your-data with citations is becoming procurement table stakes
(TolaData pilot GA 2027, Fluxx Finn GA, ActivityInfo MCP GA); nobody has GA anomaly detection;
nobody grounds report numbers claim-by-claim. Batches 29.2–29.4 claim that ground before TolaData's
GA; Batch 29.5 publishes what the engineering already guarantees.

**Rule for the copy.** As with Phase 28: the public site says only what is live and browser-verified
with a real account. Nothing in this plan is claimed publicly until its batch ships and is verified.

**Constraints from `AGENTS.md` apply unchanged.** Domain pure (zero infra deps); application =
handlers + ports, no concrete adapters imported; one repository per aggregate; thin Zod-validated
routes; **every mutation writes `audit_events`**; `Result<T, DomainError>`; new Prisma columns used
in `select/create/where` go into `REQUIRED_PRISMA_FIELDS` in the same change; never `prisma format`;
package tests run against `dist/` (build contracts → domain → application → infrastructure first);
one source per rule; a missing value is never `0`; writers never receive workflow state;
plain-language reasons from one table; counts through `countOf`/`agree`/`stillNeed`; every form
control labelled through `Field`; creates idempotent by key (`useActionState().runCreate`); offline
sends through the outbox; proposals fill, never overwrite, never invent; Prisma `update` ignores
`undefined` (write `?? null`); a Server Component never passes a function to a Client Component;
authorization `RULES` are exhaustive (a route without a rule fails the coverage test; HEAD inherits
GET); tenant-scoped Prisma models get an `rls.sql` entry in the same change; evidence links only
through `IEvidenceLinker` (`EvidenceLinkService`); indicator values never written to a locked
period; LLM text passes the PII firewall at every model-input point; every provider call writes a
`LlmRun` row (model + promptVersion + cost); AI is gated by `Organization.aiEnabled`, per-tenant
credits, the BYO-LLM plan gate, and platform flags; Python/TS mirrored rules are pinned by
string-identity tests.

---

## 0. Programme overview and batch map

| Batch | Scope | Est. dev-days | Depends on | Status |
|---|---|---|---|---|
| 29.1 | Evidence & suggestion intelligence: real LLM tagging, AI link suggestions, human semantic search, activity polisher, indicator-direction suggestion, lessons-learned miner | 15–20 | — | Proposed |
| 29.2 | Ask DonorDesk: cited, permission-aware Q&A assistant + read-only MCP server | 15–20 | 29.1 (embeddings backfilled; tagger UX reused) | Proposed |
| 29.3 | Field & M&E intelligence: register OCR → indicator grid, anomaly/plausibility explainer, offline voice loop, duplicate/stale evidence detection | 15–20 | 29.1 (polisher, link pipeline) | Proposed |
| 29.4 | Reporting lifecycle AI: donor Q&A auto-answer, compliance statement drafting, template review copilot, "what changed since last period", translation & RTL pass | 20–25 | 29.1 (assist infra optional); independent of 29.2/29.3 | Proposed |
| 29.5 | Trust surface: published trust posture, explainable flags, inclusive-language review | 5–7 | 29.1 (flag copy), else independent | Proposed |

**Total: 70–92 dev-days** (~3.5–4.5 months single dev; ~2 months with two devs — 29.2 and 29.4
parallelise cleanly after 29.1). Every batch is independently shippable and independently flagged;
no batch blocks a deploy of another.

Named but **not in this phase** (deliberate): proposal-to-report lifecycle bridge, satellite/remote
sensing evidence, IATI AI authoring, offline app opening and partner screens (still parked from
Phase 28 §16), on-device AI. These stay in the Phase 30 candidate list (§10).

---

## 1. What exists today (baseline)

Labels: **Exists** (production path), **Partial** (built in part, unwired or dormant), **Missing**.

| Area | Item | State | Where |
|---|---|---|---|
| Platform | LLM provider factory, 8 providers, SuperAdmin config, BYO-LLM gate | Exists | `llm/factory.ts`, `llm-config-resolver.ts`, `container.ts` `gateTenantLlm` |
| Platform | PII firewall (default redact) on every model-input path | Exists | `core/pii-firewall.ts`, `withPiiFirewall` |
| Platform | Cost ledger, spend monitor, per-tenant credits, `aiEnabled` kill switch | Exists | `LlmRun`, `llm-pricing.ts`, `spend-monitor.ts`, `monthlyAiDraftCredits` |
| Platform | Deterministic fallback for every AI feature (stub provider + stub writers) | Exists | `llm/stub.ts`, `StubReportDraftGenerator` |
| Reports | AI Reporter v6 (grounded, typed artifacts, per-section fallback) | Exists | `apps/workers/app/ai_reporter/`, `ai-reporter-draft-generator.ts` |
| Reports | Rewrite / Shorten / Ask-AI selection (fact-preserving) | Exists | `rewrite-report-section.ts`, worker `/v1/ai-reporter/rewrite` |
| Reports | Verification engine (assertions, numeric binding, entailment, lint, record chunks) | Exists | `assertion-extractor.ts`, `claim-verifier.ts`, `contradiction-lint.ts`, `record-chunk-builder.ts` |
| Templates | TOC-first LLM extraction + heuristic fallback, grounded | Exists | `llm/template-extraction/toc-extractor.ts` |
| Evidence | AI tagging | **Partial: keyword stub** (`StubEvidenceTagger`); `acceptTags()` does not apply; no batch mode | `llm/evidence-tagger.ts`, use-cases `suggest/persist/accept-evidence-tags.ts` |
| Evidence | Link suggestions | Partial: deterministic title similarity, human confirm | `evidence/link-suggestions.ts`, `GET /v1/evidence/:id/suggest-links` |
| Evidence | Semantic retrieval (pgvector) | **Partial: built, dormant** — lexical fallback runs for every tenant; no human-facing search | `semantic-evidence-retriever.ts`, `embedding-store.ts`, `embedding-backfill-cli.ts` |
| Evidence | OCR fallback parse (no text layer / images) | Exists (parse-time only) | `workers/app/ocr.py`, `ocr-fallback-parser.ts` |
| Evidence | Duplicate/staleness detection | Missing | — |
| Suggestions | Activity-from-narrative, field-report extraction, indicator entry, plan dates/links, story-from-plan, donor indicator auto-match | Exists (all deterministic, propose→confirm) | `activity-narrative.ts`, `field-report-extraction.ts`, `indicator-entry-suggestions.ts`, … |
| Suggestions | Activity narrative polisher | Partial: `StubActivityPolisher`, no LLM path | `llm/activity-polisher.ts`, worker `/v1/polish` mirror |
| Suggestions | Indicator direction (semantics) suggestion | Missing — every rate indicator reviewed by hand | `effectiveIndicatorSemantics`, checklist `INDICATOR_SEMANTICS_UNREVIEWED` |
| Learning | Lessons-learned miner | **Partial: dead code** — `LessonPattern` table + miner, no route, no UI | `lessons-learned-miner.ts` |
| Learning | Agent Memory (writing style) | Partial: dual-flagged off, deterministic extractor | `contexts/memory/agent-memory.ts`, `agent-memory-brief.ts` |
| Assistant | In-app ask-your-data / copilot / chat | Missing (only third-party marketing-site widget) | — |
| Assistant | MCP server / agent connector | Missing | — |
| Reporting | Donor mandatory-question answering | Partial: questions extracted and shown to the writer; answers typed by hand | `SectionBrief.mandatoryQuestions`, QA artifacts |
| Reporting | Compliance statements | Partial: `StoryContext.sectionNotes`, hand-written per section per period | `section-notes.ts`, `SectionBrief.officerNote` |
| Reporting | Template review | Partial: human section-by-section review gate; no source diff; scanned templates degraded | `TemplateWorkspace` lifecycle |
| Reporting | Period comparison for reviewers | Missing (RP-12); prior narrative exists for the writer only | `prior-period.ts`, `period-comparability.ts` |
| Reporting | Translation / RTL | Missing — 5 profile languages (en/ar/ur/fr/ps), English-only UI, Arabic-script PDF export broken | export builders |
| Flags | Plain-language reason copy | Partial: `VERIFICATION_REASON_PLAIN` (codes), misleading on some compound flags | `flag-classification.ts`, `reporting-copy.ts` |

---

## 2. SOLID architecture for the programme (applies to every batch)

No new architectural style is introduced. Every feature is the same shape the codebase already
uses, and the five principles are enforced by **structure and tests**, not by intention:

### 2.1 Single Responsibility — one capability, one module, one reason to change

- Each AI capability is its own small module chain: a **domain rule** (pure: thresholds, shapes,
  classification), an **application handler** (one use case), an **infrastructure adapter** (the
  model/OCR/embedding call), a **route**. There is no `AiService` god object and none may be added.
- Worker-side: one new `app/<capability>/` package per Python capability (mirroring `ai_reporter/`),
  never growth of an existing module's responsibility. `ai_reporter/` files are not touched except
  where a batch explicitly extends the writer contract (29.4 does, additively, as v7 rules — v6
  byte-stable).
- Copy lives in one table per surface (`reporting-copy.ts` style), scanned by `findRawTokens`.

### 2.2 Open/Closed — extend by adding a row or a strategy, never by branching

- Model access extends through the **provider registry** (`factory.ts`) — no feature imports a
  provider SDK directly.
- Suggestion surfaces extend by **new source rows** (the `AssignmentQueue`/`TASK_KINDS` pattern):
  e.g. a new proposal kind in the entry grid is a new kind constant + builder, not an `if` in the
  grid. New checklist/flag reasons are new rows in the exhaustive tables (tests fail until filled).
- Versioned contracts: any new writer rule ships as `_WRITER_RULES_V7_ADDITIONS` (Python SSOT ↔
  `contract.ts` mirror, pinned by the mirror test); v2–v6 stay byte-stable. New prompts carry a new
  `promptVersion` recorded on every `LlmRun`.
- Feature flags flip the *adapter*, not the call sites: ports stay; only the container wires stub →
  LLM adapter. This is how the stub provider keeps working everywhere.

### 2.3 Liskov Substitution — every path must run on the weakest implementation

- Every new port must have a **deterministic stub implementation that satisfies the same contract**
  (the `StubLLMProvider` / `StubReportDraftGenerator` rule). A feature that only works with a live
  provider is a design failure: dev, CI, demo tenants and provider outages all run the stub.
- Substitutability is *tested*: each port's contract test runs against the stub and (quarantined,
  opt-in via env, like `WORKPLAN_VERIFY_DATABASE_URL`) against one live provider.
- Mirrored Python/TS rules stay string-identical (mirror tests); a rule that cannot be mirrored
  exactly lives on one side only, documented in this plan.

### 2.4 Interface Segregation — narrow, role-shaped ports

New ports are small and client-specific; no client sees a method it does not call:

```
IEvidenceTagger            (file → typed tag suggestions + confidence)         — 29.1
IEvidenceLinkRanker        (file + candidates → ranked link proposals)         — 29.1
ISemanticIndex             (index/search; already ~exists as IEmbeddingStore)   — 29.1
INarrativePolisher         (text + audience → polished text, diff-safe)        — 29.1
ISemanticsSuggester        (indicator def → direction proposal + reason)       — 29.1
ILessonMiner               (records → lesson patterns)                         — 29.1
IAssistantAnswerer         (question + scope → cited answer)                   — 29.2
ITableExtractor            (document → typed table cells + confidence)         — 29.3
IAnomalyExplainer          (detection → plain-language explanation)             — 29.3
IDonorQaDrafter            (question + record chunks → draft answer + cites)   — 29.4
IComplianceDrafter         (section + records → draft statement)               — 29.4
ISectionTranslator         (markdown + language → translated markdown)         — 29.4
IFlagExplainer             (reason code + context → plain sentence)            — 29.5
```

Each wraps `ILLMProvider` internally (adapters may compose the provider port; handlers never do).

### 2.5 Dependency Inversion — arrows point inward, as always

- **Domain**: pure rules and value objects only (a detection, a threshold, a suggestion shape, a
  citation type). No model, HTTP, Prisma or React. `test/architecture-boundaries.test.mjs` fails
  otherwise.
- **Application**: handlers + the ports above; no adapter imports.
- **Infrastructure**: adapters (provider-backed + stub-backed), repositories (one per new
  aggregate), PII firewall application, `LlmRun` recording.
- **API**: thin routes; Zod schemas in `contracts`; exhaustive `RULES` entries; audit writes.
- **Web**: `features/*/domain` modules stay pure; client components receive ids/booleans/strings.

### 2.6 The AI feature chassis — every batch item walks the same 12 steps

1. Domain rule + types (pure, unit-tested; one source per rule).
2. Port (ISP-sized, above) in application.
3. Stub adapter (deterministic; default in dev/CI).
4. LLM adapter in infrastructure (provider registry + PII firewall + `UsageRecordingLlmProvider`
   with a `promptId`).
5. Handler(s) returning `Result<T, DomainError>`; mutations audited; creates idempotent by key.
6. Route + Zod contract + authorization `RULES` row (+ coverage test).
7. Credit/quota gate (per-call metering; `aiCreditsExhausted` behaviour defined) + `aiEnabled` gate.
8. Flag (platform env, written by `runtime-provisioner.ts`; org toggle where person-facing).
9. Web surface (labelled `Field`s, propose→confirm UI, offline through the outbox if field-facing).
10. Mirrors pinned (Python/TS) where a rule exists on both sides.
11. Tests: unit (domain), handler, stub-contract, copy-lint, authorization coverage, RLS coverage,
    architecture boundaries; golden-corpus case where report text is touched.
12. Support article draft (`docs/support/_unpublished-phase29/`) — published only after the live
    browser check.

---

## 3. Batch 29.1 — Evidence & suggestion intelligence (15–20 days)

### 29.1.1 Real LLM evidence tagging (+ batch mode, accept applies)

**Purpose / roles.** Replace the keyword stub: classify type, suggest activity/indicator links and
sensitivity from extracted text; make "accept" actually apply. Field Officer + ME_Officer daily
toil (demos linked 12–18 files/month by hand).

**SOLID design.**
- Port `IEvidenceTagger` (new, ISP-narrow; today's stub logic moves behind it unchanged → LSP).
- `LlmEvidenceTagger` (infrastructure): one provider call per file over PII-redacted extracted text
  (redact, never reject — tagging must not fail on PII), structured JSON tags with per-tag
  confidence; unknown/low-confidence → fall back to the heuristic table for that field. Stub
  adapter = today's keyword tagger (dev/CI/fallback path — unchanged behaviour, no provider).
- Domain: `evidence/tag-proposal.ts` — merge + confidence ranking rules (LLM beats heuristic above
  threshold; ties → heuristic; deterministic, one source). `TagSource` enum
  (`HEURISTIC | AI | OFFICER`) stored per suggestion.
- Handlers: extend `suggest-evidence-tags` (accept `mode: "ai"|"heuristic"`), new
  `BatchSuggestEvidenceTagsHandler` (per period or per activity group; `BackgroundRunner` job — the
  api awaits `settleBackgroundWork()`), and **fix** `accept-evidence-tags` to apply links through
  `EvidenceLinkService` and persist tags in one audited mutation (`evidence.tags_applied`).
- Worker: no change (`tagging.py` heuristic mirror stays the Kestra/quota fallback).

**Data model.** Migration `20261101100000_evidence_tag_source`: `EvidenceFile.tagSource`,
`EvidenceFile.tagConfidence` (nullable; `?? null` on write) → add both to
`REQUIRED_PRISMA_FIELDS`. No new table (suggestions stay JSON per current shape).

**Flags / credits.** `EVIDENCE_TAGGING_MODE=ai|heuristic` (platform env, provisioner-written;
default `heuristic` until the eval passes). AI calls metered, `promptId=evidence-tagger`; batch
jobs capped by the existing daily extraction-quota pattern (`extraction-quota.ts` precedent).

**Tests.** Port contract test (stub + AI adapter with recorded fixtures); merge-rule unit tests;
handler tests (audit row, idempotent batch job); golden fixtures for tag quality (20 files,
`docs/…` corpus); authorization rows; copy-lint on all new strings.

**Acceptance.** A 20-file mixed corpus (photos of registers, PDFs, XLSX) tags with ≥90% type
accuracy vs hand labels; accept applies links + tags in one click; heuristic path byte-identical to
today (regression fixtures).

### 29.1.2 AI evidence link suggestions

**Purpose / roles.** Rank link proposals (activity / indicator / indicator-update / period) from
extracted text, not filename only. ME + Field Officer.

**SOLID design.** Port `IEvidenceLinkRanker`; domain `link-suggestions.ts` stays the candidate
generator (one source for *what can link*); the ranker only orders (SRP split: candidates vs
ranking). `LlmEvidenceLinkRanker`: one call over redacted text + top-N candidates → scores +
one-line reason per proposal. Stub = current `scoreSimilarity` ranking. **Application is only ever
through `EvidenceLinkService`** (invariant); suggestions never auto-apply; UI adds the ranker's
reason under each proposal.

**Data model / routes.** None new (`GET /v1/evidence/:id/suggest-links` response grows a `reason`).

**Tests.** Ranking parity suite (stub ordering unchanged when `EVIDENCE_LINK_RANKING=heuristic`);
fixtures where LLM reranking fixes a known bad rank (photo titled `IMG_2041.jpg` → correct period).

### 29.1.3 Human semantic search (wake the pgvector index)

**Purpose / roles.** Evidence search today is filename-contains. Backfill embeddings; add
"search inside evidence text" for every role (respecting confidentiality). All roles; biggest ME
win ("find the attendance sheet that mentions X").

**SOLID design.**
- Reuse `IEmbeddingStore` + `SemanticEvidenceRetriever` untouched; new read model
  `EvidenceSearchService` (application) composing: permission filter (`CONFIDENTIALITY_READERS` —
  one source) → pgvector nearest → lexical rerank → snippets with `EvidenceFile` provenance.
- Backfill: `embedding-backfill-cli.ts` promoted to a BackgroundRunner job + SuperAdmin button
  ("Build search index"); incremental on upload/parse (outbox event `evidence.text_extracted`).
- Web: search box in the Evidence library; results show snippet + highlighted span + confidentiality
  badge; nothing opens without the read check (the bytes route already enforces it).

**Data model.** None (uses `EvidenceEmbedding`). Operational: enable the embedding generator in the
production env (`EMBEDDING_PROVIDER` + key; cost noted per file, one-off).

**Flags / credits.** `EVIDENCE_SEMANTIC_SEARCH=1`; embeddings are not LLM-chat calls — metered per
1k tokens through `LlmRun` with `promptId=evidence-embedding`, cost visible on the AI usage page.

**Tests.** Retrieval quality suite (30 queries over the demo corpus); permission test: a VIEWER
never sees SENSITIVE+ hits even if semantically top-1 (this is the security property to pin).

**Acceptance.** Index built for the demo tenant; ≥80% top-3 relevance on the query suite; lexical
fallback automatic when a file has no embedding.

### 29.1.4 Activity polisher (LLM path)

**Purpose / roles.** Field notes → report-ready sentences, on request, diff-style accept. Field
Officer (their words stay theirs), ME (cleaner inputs).

**SOLID design.** Port `INarrativePolisher` (exists as stub). `LlmActivityPolisher`: rewrites only
the free-text fields of a *draft* activity record; facts (counts, dates, participants) are
forbidden from changing — enforced by a domain diff guard (`activity-polish.ts`: a change to any
numeric/date/participant token rejects the whole proposal; mirrors the rewrite fact-preservation
pattern). Never touches accepted records. Worker `/v1/polish` mirrors the guard (string-identical
rule table, mirror test).

**Routes / audit.** `POST /v1/activities/:id/polish-preview` (no save) + accept folds into the
existing update handler (audited once, `activity.polished` detail). Idempotency key on preview not
needed (no create).

**Flags / credits.** `AI_ACTIVITY_POLISH=1` + `aiEnabled`; metered, `promptId=activity-polisher`.

### 29.1.5 Indicator direction (semantics) suggestion

**Purpose / roles.** Every imported rate indicator needs hand-set direction ("Calculation needs
review"). ME_Officer.

**SOLID design.** Port `ISemanticsSuggester`; domain `semantics-suggestion.ts` proposes a direction
from name/unit/wording with a one-line reason and confidence; confirm copies the suggested
semantics through the **existing** confirm flow (`effectiveIndicatorSemantics` never invents — the
suggestion is a default the officer sees, not an applied change). Checklist item
`INDICATOR_SEMANTICS_UNREVIEWED` keeps closing only on the person's confirm (invariant).
Stub = lexical rules (higher/lower/increase/decrease/% per …). Batch endpoint suggests for all
unreviewed indicators of a project in one call.

**Routes.** `GET /v1/indicators/semantics-suggestions?projectId=…` (+ per-indicator confirm through
the existing route). No schema change.

### 29.1.6 Lessons-learned miner activation

**Purpose / roles.** `LessonPattern` + `lessons-learned-miner.ts` are dead code. Wire them: mine
recurring challenges/lessons from activity records across periods; surface as suggestions in
Tell-the-story "lessons" and on the Overview. PM + ME.

**SOLID design.** The miner is deterministic (frequency + recurrence of phrases) — **no LLM in
detection**; add `ILessonNarrator` (tiny port) that phrases a pattern in one sentence for the
suggestion card (stub: templated sentence via `countOf`; LLM adapter optional, metered). Suggestion
follows the fill-only rule on Tell-the-story (alongside `suggestStoryFromPlan`).
Route `GET /v1/projects/:id/lessons` + one "Suggest" affordance; audited accept
(`story.lesson_applied`).

**Batch 29.1 deploy.** Migration `20261101100000_evidence_tag_source` (additive) + `rls.sql`
unchanged (no new tables); `/ready` += `EvidenceFile.tagSource/tagConfidence`; flags
`EVIDENCE_TAGGING_MODE`, `EVIDENCE_LINK_RANKING`, `EVIDENCE_SEMANTIC_SEARCH`, `AI_ACTIVITY_POLISH`
written by the provisioner; SCOPE=both.

---

## 4. Batch 29.2 — Ask DonorDesk: cited Q&A assistant + MCP (15–20 days)

### 29.2.1 The assistant

**Purpose / roles.** Table-stakes gap: "Which outputs are behind schedule in Nepal?", "What did we
report about teacher attendance in Q2?", "Which evidence backs the 4,512 figure?". Answers
**cited** (evidence chunk / report section / record), permission-inheriting, PII-firewalled. PM,
ME, Grants, Admin (+ Viewer scoped to published reports).

**SOLID design.**
- Port `IAssistantAnswerer`. Adapter: retrieval (pgvector evidence + record chunks + structured
  read models) → context assembly with **citations first** → provider call → answer with inline
  citations; a claim with no retrieval hit is answered "I can't find that in your records" (no
  generation from model memory — the product's core differentiator, made user-facing).
- **Domain**: `assistant/answer.ts` — citation types (`EVIDENCE | SECTION | RECORD | INDICATOR`),
  scope rules, and the *answer policy*: numbers may only be echoed from a citation (deterministic
  post-check reusing `number-grounding.ts` logic — LSP: same rule as the reporter, shared function,
  not a copy).
- **Application**: `AskDonorDeskHandler` — resolves the caller's data scope (org-wide vs project),
  applies confidentiality (`CONFIDENTIALITY_READERS`) and role filters *before* retrieval (the
  index never returns what the caller may not read), persists thread + messages
  (`AssistantThread`/`AssistantMessage`, RLS-forced, DML granted — new aggregate, one repository),
  meters the call, writes `LlmRun` (`promptId=assistant`).
- **API**: `POST /v1/assistant/ask`, `GET /v1/assistant/threads`, `DELETE /v1/assistant/threads/:id`
  (mutation → audit `assistant.thread_deleted`; asks are reads, ledgered in the thread itself).
  Zod contract `AssistantAskSchema` (max length, language).
- **Trust posture carried over**: PII policy `redact` (answers never quote redacted spans — they
  cite instead); evidence text is **untrusted input** (prompt-injection defence: retrieved chunks
  are fenced as data, never as instructions; system prompt states the assistant only answers from
  the provided context); no training on tenant data (existing provider terms + firewall).
- **Web**: `AskDonorDesk` panel (⌘K palette + per-project panel), answers render with citation chips
  that deep-link (evidence file, section, record). Suggested questions from the caller's assignment
  queue (one query builder, no second source).

**Data model.** Migration `20261102100000_assistant_threads`: `AssistantThread` (tenantId, userId,
projectId?, title, createdAt), `AssistantMessage` (threadId, role, content, citationsJson,
llmRunId) — RLS forced, `donordesk_app` grants; both models + fields to `REQUIRED_PRISMA_FIELDS`
where selected; `rls-coverage` and authorization-coverage tests extended.

**Flags / credits.** Dual gate like Agent Memory: platform `AI_ASSISTANT_ENABLED` (provisioner) +
`Organization.assistantEnabled` (default **off**, admin toggle in Settings → AI). Metered per ask
against AI credits with a soft monthly cap (`assistant.daily_ask_limit`, default 50/user/day);
over-limit = plain "quota reached today" (retryable, never an error page).

**Tests.** Citation-grounding suite (an answer without citations for a factual claim fails the
handler — deterministic post-check); scope matrix (every role × confidentiality level × project
membership); injection corpus (10 malicious chunks, e.g. "ignore instructions and…", must be
echoed-as-data, never obeyed); thread persistence + RLS cross-tenant test; quota test.

**Acceptance.** On the demo tenant: 30-question suite (facts across evidence, reports, indicators,
plan) answered with correct citations ≥85%; zero cross-scope leaks in the matrix test.

### 29.2.2 MCP server (read-only agent connector)

**Purpose / roles.** The ActivityInfo/SurveyCTO/Fluxx pattern: orgs connect their own
Claude/ChatGPT safely. Technical orgs, AI-mature funders; low build cost, high signalling.

**SOLID design.**
- **Own encapsulated Fastify context** (the SCIM precedent — never a hook on the root instance):
  `apps/api/src/mcp/` with its own authentication. Endpoint `/mcp` (JSON-RPC 2.0, streamable HTTP).
- Credentials: `POST /v1/mcp/credentials` (admin, `users.manage`-style permission `mcp.manage`;
  SHA-256 token stored, shown once — the SCIM credential pattern, new table `McpCredential` with
  `lastUsedAt`, revocation).
- Tools (v1, **read-only**, smallest set that is useful):
  `list_projects`, `get_indicator_values` (period-scoped), `get_report_status`,
  `search_evidence_metadata` (metadata + snippets only — **no bytes**), `get_plan_summary`.
  Scoping: the credential carries an explicit scope (org-wide read of PUBLIC/INTERNAL evidence
  metadata only; SENSITIVE+ never leaves through MCP). Numbers returned are the verified values
  from the read models — deterministic, no model in the loop server-side.
- Ledger: every tool call → `PlatformAuditEvent` (`mcp.tool_called`) + rate limit per credential.

**Data model.** Migration `20261102110000_mcp_credentials` (RLS-forced, tenant-scoped by org).
`/ready` += `McpCredential.tokenHash`.

**Flags.** `MCP_SERVER_ENABLED=1` (platform, default off); org must also have issued a credential.

**Tests.** JSON-RPC conformance suite; scope test (SENSITIVE file never in tool output);
revocation test; rate-limit test; the authorization-coverage test asserts the encapsulated context
is *not* inside the authenticated scope (its auth is its own).

---

## 5. Batch 29.3 — Field & M&E intelligence (15–20 days)

### 29.3.1 Register OCR → indicator grid proposals

**Purpose / roles.** The #1 manual toil: attendance sheets/registers re-typed by hand. Photo →
table extraction → proposed indicator values (person confirms). ME + Field Officer.

**SOLID design.**
- Port `ITableExtractor` (application). Worker package `apps/workers/app/table_extract/`:
  OCR (existing `ocr.py`, one scan at a time) → grid detection (deterministic, line/word geometry)
  → optional LLM header-mapping (columns → disaggregation/sex-age groups, `aiEnabled`-gated) →
  typed `ExtractedTable { headers, rows, cells: {value, confidence} }`. TS mirror holds only the
  *shape validation* (`table-proposal.ts`, domain: cell confidence thresholds, date parsing,
  group-name normalisation through the existing disaggregation vocabulary — one source).
- Proposal flow reuses **field-report extraction** end to end: `ProposeRegisterExtractionHandler`
  (no persistence; returns indicator-value proposals with `FOUND | SUGGESTED` certainty, mapped to
  the period by `periodForDate` — never assigned to an uncovered date) → grid UI shows them beside
  the input cells as fill-only suggestions → the only write path is the existing
  `BulkUpsertIndicatorUpdatesHandler` (drafts arrive as drafts; locked periods refused as today).
- Human confirm everywhere; low-confidence cells arrive empty with the image cropped beside the
  cell (never a guessed number — the missing-value rule).

**Data model.** None (proposals are ephemeral; accepted values are ordinary indicator updates).
Optional `EvidenceFile.tableExtractedAt` for the "already processed" badge —
migration `20261103100000_evidence_table_extracted`, `/ready` += the field.

**Flags / credits.** `REGISTER_OCR_PROPOSALS=1`; OCR is free (local), header-mapping call metered
(`promptId=table-mapper`).

**Tests.** Fixture corpus (10 scanned registers: clean, skewed, crossed-out rows, two languages);
extraction never emits a value for a crossed-out cell (or flags it `SUGGESTED` with low confidence);
period-assignment tests; grid fill-only tests; audit trail on accept = the existing bulk-upsert
audit.

### 29.3.2 Anomaly / plausibility explainer

**Purpose / roles.** "This indicator looks wrong — here's why": trend breaks, disaggregation sums
≠ total, cumulative arithmetic breaks, duplicates, out-of-range vs target schedule. **GA white
space — TolaData has it on roadmap only.** ME + PM.

**SOLID design.**
- **Domain, deterministic, no LLM**: `indicators/anomaly-rules.ts` — ordered rule table
  (`ANOMALY_RULES`, exhaustive-checked) producing typed detections
  (`TREND_BREAK | DISAGGREGATION_MISMATCH | CUMULATIVE_MISMATCH | OUT_OF_RANGE | SUSPECTED_DUPLICATE`),
  each with the involved values. Runs on every indicator-upsert response and on the grid load
  (read-time detection, nothing stored — no new gate, **never changes `verificationResult`**; the
  flag-classification invariant extended: anomaly banners are presentation-only).
- Port `IAnomalyExplainer` (tiny, ISP): detection → one plain sentence (`aiEnabled`-gated LLM
  phrasing; stub = templated sentence from `VERIFICATION_REASON_PLAIN`-style table in
  `reporting-copy.ts`). Detection and phrasing are separate responsibilities (SRP); phrasing never
  invents values (post-checked against the detection payload — numbers deterministic).
- UI: grid badge + panel ("11 + 4 ≠ 15 — the sex disaggregation does not sum to the total"),
  checklist **advice only** (1 point, never in SUBMISSION — the plan-delivery precedent).

**Tests.** Rule unit tests (each rule fires/not-fires); explainer echo test (every number in the
sentence appears in the detection payload); presentation-only test (no state change).

### 29.3.3 Offline field voice loop

**Purpose / roles.** Dictation exists; extend it into a capture loop that works offline and
proposes a full activity entry on sync. Field Officer.

**SOLID design.** No second speech implementation (invariant): reuse `useDictation`. New outbox
kind `activity-transcript` (a transcript + rough fields) → `OutboxProvider` sender
`createActivityTranscriptSender` → on sync, the **existing** `proposeActivityFromNarrative` +
`applyNarrativeProposal` fill the form (fill-only, never invent) and 29.1's polisher offers a
one-tap cleanup. Offline entry parks in `needs-attention` on refusal (existing behaviour). No new
server surface beyond the existing activity create (idempotency key = outbox entry id, as today).

**Tests.** Outbox contract test (the existing sender suite); round-trip: dictated offline → synced
→ proposed → confirmed; never-overwrite test on re-sync.

### 29.3.4 Duplicate & stale evidence detection

**Purpose / roles.** Content-hash duplicate warning at upload; staleness warning when a report
period cites evidence much older than the period. ME + Compliance.

**SOLID design.** Domain `evidence/duplicate-rules.ts`: SHA-256 content hash computed at upload
(storage adapter already reads the bytes), warning (never a block) when the same hash exists in the
org, with a link to the existing file. `stale-rules.ts`: a deterministic age rule
(period start − evidence date > `EVIDENCE_STALE_DAYS`, default 365) surfaced as a non-blocking
readiness advice row (`READINESS_BLOCKER_RULES` row, 1 point, DRAFTING/IN_REVIEW only).
Migration `20261103110000_evidence_content_hash` (`EvidenceFile.contentHash`, indexed) + backfill
job (BackgroundRunner) + `/ready` field.

**Batch 29.3 deploy.** Migrations `20261103100000`, `20261103110000` (additive); SCOPE=both (worker
ships `table_extract/`); flags `REGISTER_OCR_PROPOSALS`; `/ready` additions listed above.

---

## 6. Batch 29.4 — Reporting lifecycle AI (20–25 days)

### 29.4.1 Donor mandatory-question auto-answer

**Purpose / roles.** Draft answers to donor `mandatoryQuestions` from grounded record + evidence
chunks, with citations; the writer confirms/edits before it enters the section. Grants + ME.

**SOLID design.**
- Port `IDonorQaDrafter`. Adapter: for each unanswered question, retrieval over record chunks +
  evidence chunks (the assistant's retrieval layer, reused — 29.2 dependency optional: the layer
  lives in infrastructure either way) → draft answer + citations → **numeric echo post-check**
  (the shared grounding walker; a number without a source drops the answer to "no grounded answer").
- Application: `ProposeDonorQaAnswersHandler` (read-only proposal on the section editor: question →
  draft + cites). Accept copies the text into the section (audited through the normal section save;
  the QA then lives as ordinary section content and is claim-checked by the existing engine on the
  next assurance pass — **no new verification path**). Unanswerable questions stay visibly
  unanswered ("no grounded answer found") — never invented (the product's differentiator).
- Writer contract: the *report writer* keeps writing Q&A itself (v6 behaviour); this feature is an
  editor-side assistant, no contract change.

**Tests.** Golden-corpus cases (+4: grounded answer, partially grounded, none, conflicting figures);
grounding post-check unit tests; UI confirm flow.

### 29.4.2 Compliance statement drafting

**Purpose / roles.** One compliance statement per donor compliance section, today hand-written
every period. Drafts from the officer's own records. PM + Compliance.

**SOLID design.** Port `IComplianceDrafter`; proposal on the compliance section's note editor
(`sectionNotes` key = template section id — invariant kept: `setStoryContext` handlers re-supply
the full context; the draft fills only the empty note). Source material: record chunks
(`record:scope|activity|plan|finance`) + standing statements (`standingStatementsJson`) — the draft
cites what it used; the note itself is stored as the officer's statement (human attribution).
Accept audited (`compliance.note_drafted` detail on the existing story-update audit).

**Tests.** Fill-only test (existing note never overwritten); grounding; golden cases (+3).

### 29.4.3 Template review copilot

**Purpose / roles.** After extraction (NEEDS_REVIEW), a side-by-side "donor source vs extracted
template" diff with LLM-flagged misses: mandatory questions or required tables in the source that
are absent from the draft; word limits per section; instructions dropped by grounding. Also accept
scanned/image donor templates via the existing OCR fallback (today degraded). Grants.

**SOLID design.**
- Worker `apps/workers/app/template_review/`: source blocks (parser output) + extracted draft →
  LLM comparison returning typed `TemplateGap { kind: MISSING_QUESTION | MISSING_TABLE |
  MISSING_INSTRUCTION | WORD_LIMIT | LEVEL_MISMATCH, blockRefs[] }` — every gap must cite source
  block indices; uncited gaps are dropped (the `SourceGrounding` rule reused verbatim).
- TS side: `template-review.ts` (domain: gap types + presentation copy), `ReviewTemplateHandler`
  extension returns gaps for the review pane; the REVIEWED gate stays exactly as is (a person
  reviews; the copilot only highlights — OCP: the lifecycle state machine is untouched).
- Scanned templates: route the upload through `OcrFallbackDocumentParser` before the TOC extractor
  (parse-only change; `assessTextExtraction` verdict shown so the officer knows the source was OCR).

**Flags / credits.** `TEMPLATE_REVIEW_COPILOT=1`; metered per template (`promptId=template-review`).

**Tests.** Gap-grounding test (a gap without block refs is dropped); fixture: the WASH/EU demo
templates produce N known gaps; OCR-template end-to-end (image PDF → extraction → review).

### 29.4.4 "What changed since last period" (reviewer diff)

**Purpose / roles.** Reviewers/approvers see a narrative + figure diff against the comparable
prior period (RP-12). PM approvers, Grants.

**SOLID design.** Pure domain + read model — **no LLM** (deterministic, cheap): `period-diff.ts`
pairs sections via `sectionMatchKeys` (invariant: never the displayed title) and `selectComparablePeriods`;
output = per-section {status: NEW | CHANGED | UNCHANGED, figure deltas from verified findings,
claim-flag deltas}. `GetPeriodDiffHandler` + route `GET /v1/reporting-periods/:id/diff` (GET rule
only). Web: a "Compare with previous" tab in the review workspace. The writer's prior-period input
is untouched (different consumer, same domain pairing rule — one source).

**Tests.** Pairing tests (own type only, cancelled excluded); delta arithmetic (cumulative vs
period values per the roll-up rules); no-leak (a period with no comparable prior renders empty).

### 29.4.5 Translation & RTL pass

**Purpose / roles.** Profile languages exist (en/ar/ur/fr/ps); reports and exports are English-only
and Arabic-script PDF export is broken. Kobo/SurveyCTO ship GA translation — table stakes for
humanitarian. Grants (donor reports), Field (cross-language reading).

**SOLID design.**
- Port `ISectionTranslator`: translates the storage-markdown subset **token-wise** — paragraphs and
  sentences only; tables/lists/numbers/code/URLs pass through untouched (deterministic segmentation
  in domain `translation/segment.ts`; the model never sees a number it could alter — segmentation
  post-check re-assembles and diffs non-text tokens; mismatch = reject that section).
- Storage: migration `20261104100000_section_translations`: `ReportSectionTranslation`
  (sectionId, language, contentJson (per-segment), status `MACHINE | REVIEWED`, reviewerId,
  reviewedAt) — RLS forced; a translation is exported **only** in `REVIEWED` state for donor
  submissions (export preflight warning `TRANSLATION_UNREVIEWED`, non-blocking for internal review
  exports — the DATA_CHARTS precedent). UI: translate action per section → side-by-side review
  editor → mark reviewed (audited `report.translation_reviewed`).
- RTL: export builders (`markdown-renderer.ts`, `markdown_docx.py`) gain bidirectional run support
  for ar/ur/ps (DOCX `bidi` + PDF font/shaping fix — a renderer bug fix, shipped first and
  independently: **this sub-item is a prerequisite bug fix, scheduled at the front of the batch**).
- App-UI translation is explicitly **out of scope** (product UI stays English; this is report
  content translation).

**Flags / credits.** `AI_TRANSLATION=1` + org toggle; metered per section (`promptId=translator`);
quality: a "machine-translated — review before submission" banner state is mandatory.

**Tests.** Segmentation round-trip (numbers/tables byte-identical after translate+assemble, corpus
in `rich-text-roundtrip` style); reviewed-state gate on export; RTL render fixtures (ar/ur) for
DOCX+PDF; translator stub (identity) keeps CI green.

**Batch 29.4 deploy.** Migration `20261104100000_section_translations`; `/ready` +=
`ReportSectionTranslation.status`; flags above; SCOPE=both; writer contract unchanged (v6).

---

## 7. Batch 29.5 — Trust surface (5–7 days)

### 29.5.1 Published trust posture

The engineering exists; competitors publish it and we do not. One page (`/ai-trust`, web) +
support article stating exactly what the code does: per-org `aiEnabled` opt-in (default on, one
switch off), PII firewall default-redact on every model input, numbers in AI drafts deterministically
grounded (every figure traceable to a verified finding/evidence chunk), claim verification gates
approval, no training on tenant data, per-tenant cost ledger visible to the org admin, BYO-LLM
consumes no platform credits, audit trail on every AI-assisted change. Facts sourced from
`LEGAL`-style one place (`apps/web/src/lib/ai-trust-facts.ts`) — the refund-policy precedent: the
page may only claim what the code does, tested by a fact-vs-code checklist in the page test.

### 29.5.2 Explainable flags

Fix the "does not add up" confusion (demo-11 F-16): for every flag, the panel shows the
deterministic reason *in the caller's words* — compound flags get a composed explanation from the
reason table; `IFlagExplainer` (LLM phrasing, `aiEnabled`-gated; stub = composed table sentence)
with the same numbers-echo post-check as 29.3.2. One source: explanations read from
`VERIFICATION_REASON_PLAIN` (+ new rows for any new reason code — the exhaustiveness test fails
until filled). No change to `verificationResult` or the gate (presentation only — invariant).

### 29.5.3 Inclusive-language review

A pre-export lint (deterministic word/phrase table in domain, `inclusive-language.ts`, one
extensible table + tests) flagging non-inclusive phrasing in report text (the Foundant Fia Equity
Analyzer pattern, deterministic and cheap). Non-blocking advisory in the export wizard; writer
contract v7 additions optional follow-up (defer unless the corpus shows need).

**Batch 29.5 deploy.** Web + api only; no migrations except none; copy-lint on all new public copy.

---

## 8. Cross-cutting concerns

**Cost & credits.** Every metered call: `LlmRun` row (model, promptId, promptVersion, tokens,
cost) → AI usage page; tenant credits debited through the existing entitlement path
(`aiCreditsExhausted` → plain retryable message); `AI_MONTHLY_COST_ALERT_USD` covers org spend;
platform-level daily quotas (extraction-quota pattern) for tagging and translation batches. The
built-in price table gains entries for the embedding model and any newly used models
(`LLM_PRICES_JSON` override; unpriced = 0 + reported unpriced — never a silent 0 in cost reports).

**Feature flags.** All platform flags written by `runtime-provisioner.ts` (a hand edit is
reverted); org-level toggles: `assistantEnabled`, `translationEnabled` (Settings → AI, one screen).
Defaults: every new AI capability **off** in production until its batch's eval + live browser check
pass (the AI Reporter rollout precedent).

**Determinism & grounding.** LLM output never becomes a stored number without passing the shared
grounding walker (one implementation, reused; Python/TS mirrors pinned). Proposals are ephemeral
until a person accepts; accepted content enters the existing audited write paths and the existing
verification engine — no parallel trust system is created.

**Security.** PII firewall at every model-input point (new adapters declare their redaction point
in the chassis checklist); retrieved evidence text is untrusted input (29.2's injection corpus
becomes a reusable test fixture); MCP and any external surface carry their own encapsulated auth;
confidentiality filters run *before* retrieval everywhere.

**Offline.** Only 29.3.3 touches offline: it uses the existing outbox, entry id = idempotency key,
parked refusal behaviour unchanged.

**Observability.** `ai-run-summary.ts` outcome classification extended with the new promptIds
(TAGGED / ANSWERED / TRANSLATED / EXPLAINED …); SuperAdmin AI tab shows per-capability usage.

**Docs & copy.** Support article drafts in `docs/support/_unpublished-phase29/`, published +
registered (`FILE_MAP` + `wikiCategories.tsx`) only after the live check; all user-visible strings
through the copy tables, scanned by `findRawTokens`.

---

## 9. Sequencing, dependencies, and deploy plan

```
29.1.1 tagging ──┬─► 29.2.1 assistant ──► 29.2.2 MCP
29.1.2 links ────┤        │
29.1.3 search ───┘        └─► (retrieval layer reused) 29.4.1 donor Q&A
29.1.4 polisher ─► 29.3.3 voice loop
29.1.5 semantics ─► 29.3.1 OCR grid (independent, can parallel)
29.1.6 lessons    ─► (independent)
29.3.2 anomaly ─► 29.5.2 flag explanations (reason-table extension)
29.4.5 RTL fix ships FIRST in 29.4 (prereq bug fix)
```

Suggested calendar (1 dev; compress ~2× with two devs after 29.1):

| Weeks | Work |
|---|---|
| 1–3 | 29.1 (tagging → links → search → polisher → semantics → lessons); ship 29.1 |
| 4–6 | 29.2 assistant + MCP; ship 29.2 |
| 7–9 | 29.3 (OCR grid, anomaly, voice loop, dedupe); ship 29.3 |
| 10–13 | 29.4 (RTL fix first; Q&A, compliance, copilot, diff, translation); ship 29.4 |
| 14 | 29.5 trust surface; programme verification demos |

**Deploys.** One deploy per batch (`deploy-fast.sh`, SCOPE=both; the worker restarts matter for
29.1 tagger quotas, 29.3 `table_extract/`, 29.4 `template_review/`). Migrations (all additive,
applied by hand as `donordesk_migrator` before the code, then `rls.sql` re-run):
`20261101100000_evidence_tag_source`, `20261102100000_assistant_threads`,
`20261102110000_mcp_credentials`, `20261103100000_evidence_table_extracted`,
`20261103110000_evidence_content_hash`, `20261104100000_section_translations`.
`/ready` gains: `EvidenceFile.tagSource/tagConfidence/tableExtractedAt/contentHash`,
`AssistantThread.citationsJson` (+Message fields), `McpCredential.tokenHash`,
`ReportSectionTranslation.status`. New RLS entries: `AssistantThread`, `AssistantMessage`,
`McpCredential`, `ReportSectionTranslation` (the `rls-coverage` test enforces the rest).

**Verification.** Each batch: full `pnpm -r build && pnpm -r test && pnpm test:architecture`,
`reporting:eval` where the corpus grew, worker pytest, then a live browser run with a real account
per role touching every new surface (the Phase 28 rule), recorded in
`memorybank/demo/verification-demo-12-ai.md` (or next free number).

---

## 10. Risks and deliberate non-goals

| Risk | Mitigation |
|---|---|
| Tagging/translation quality below useful | Eval fixtures gate the flag flip (off until green); deterministic fallbacks keep the UX identical to today |
| Assistant cost overrun | Per-user daily ask cap, org toggle default off, credits, spend alert, quota ledger |
| Prompt injection via evidence text | Chunks fenced as data; system prompt contract; injection corpus in CI; answers citation-only |
| hallucinated numbers in new surfaces | Shared grounding walker post-check on every LLM surface (assistant, Q&A, explainer, translator segmentation) |
| Translation quality in fr/ar/ur/ps | REVIEWED-state gate before donor export; native-speaker review pass scheduled before GA claim; banner states machine origin |
| Scope creep into a chatbot platform | This plan's assistant answers **only** from tenant data with citations; no free-form generation, no tool-use agent loop, in this phase |
| Second speech/OCR implementation | Reuse `useDictation` / `ocr.py` — invariants already forbid duplicates; architecture tests extended |

**Deliberate non-goals (Phase 30 candidates):** proposal-to-report lifecycle bridge (carry a won
proposal's logframe into setup); satellite/remote-sensing evidence; IATI AI-assisted publishing;
offline app opening + partner screens (parked from Phase 28); on-device AI; app-UI localisation;
beneficiary register (data-protection work first); autonomous scheduled drafting (RP-09 stays
user-triggered; a "draft ready Monday 07:00" convenience can follow once 29.x is verified).

---

## 11. Definition of done (programme level)

1. Every batch shipped, flag-flipped only after its eval + live role-based browser check.
2. Every new port has a stub; the whole product works with zero providers configured (LSP proof).
3. Golden corpus, authorization-coverage, RLS-coverage, architecture-boundaries, copy-lint all
   green in CI for the new code; Python mirrors string-identical where they exist.
4. AI usage page shows every new capability's cost; the trust page claims exactly what runs.
5. Support articles published and registered; public-site copy updated only after verification.
6. `memorybank/INDEX.md` + a Features doc (43-AI-Enhancements) updated with the as-built state.
