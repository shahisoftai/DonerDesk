# Phase 21: Agent Memory — Implementation Plan (DonorDesk Version 2.0)

**Version:** 2.0 — DonorDesk Version 2.0 ships Agent Memory as its headline
feature. All other version references in this document and its sibling
Feature doc (`../Features/21-Agent-Memory.md`) mean this same release.
**Status:** IMPLEMENTED (Phases 0–3, and a functional slice of Phase 2's
governance UI) on branch `0009-agent-memory`, not yet merged to `master` —
pending the user's explicit review, per this branch's stated purpose. Phase 4
(cross-tenant DB-integration tests, live `reporting:eval` before/after run)
and §9 (DSPy) remain out of scope for this pass; see "Deviations from this
plan" at the end of this document for where implementation departed from the
plan's literal wording and why.
**Owner:** DonorDesk engineering
**Scope:** Let the AI Reporter learn tenant/donor-specific narrative style and
terminology from what human reviewers actually change, and (as a later,
offline-only stage) let engineers optimize section prompts against the
existing golden-corpus eval. The deterministic assurance system remains the
sole authority over facts, figures, and compliance: **memory changes how
sections are *worded*, never what they *claim*.**

This plan was written after (a) auditing the repository as it exists on
2026-09-28, and (b) researching six open-source memory/learning projects
(Mem0, Letta, Graphiti, LangMem, Cognee, DSPy) against DonorDesk's actual
constraints — see §1.

---

## 0. Governing principle

DonorDesk already has a strict, load-bearing boundary: **numbers and facts
are computed and verified deterministically; the LLM only narrates and
critiques.** `grounding.py` / `number-grounding.ts` reject any number the
writer did not receive; the assertion extractor and gate policy make it
architecturally impossible for an ungrounded claim to reach approval.

Agent Memory must sit entirely on the "narration" side of that boundary. It
is a second, much smaller instance of the same idea DonorDesk already uses
for `ReportingProfile` (tone/formatting) and `TemplateSection.authorInstructions`
(org guidance) — except this guidance is *learned* from reviewer behaviour
instead of typed in once, and it is *proposed*, never *applied*, until a
human approves it.

Non-negotiable boundary:

```text
Reviewer edits a GENERATION-origin section → MANUAL_EDIT revision exists
   │  (already true today — packages/domain/.../assurance.ts ChangeOrigin)
   ▼
Agent Memory extraction (deterministic diff classifier; LLM-assisted is opt-in)
   │  produces PROPOSED style/terminology statements, never touches numbers
   ▼
Human review (report manager) — approve / reject / edit the statement
   │
   ▼
APPROVED memory → injected into sectionGuidance for future generations
   (same seam ReportingProfile/authorInstructions already use)
```

If a diff hunk contains a numeric token, a donor figure, a date, or a claim
about an indicator, it is **excluded from extraction outright** — never
proposed, never approved, never learned. This is enforced by reusing the
existing numeric-atom detector, not by trusting the extractor's judgment.

---

## 1. Open-source research — build vs. buy (revisited against this codebase)

| Project | License | What it actually is | Verdict for DonorDesk |
|---|---|---|---|
| [mem0ai/mem0](https://github.com/mem0ai/mem0) | Apache-2.0 | Conversational memory layer: auto-extracts "facts" from chat turns via its own LLM calls, stores/retrieves via its own vector+graph store | **Reject.** DonorDesk has no chat turns to extract from — the signal is a structured revision diff, not a conversation. Mem0's own fact-extraction LLM call would be a second, unaudited place numbers could leak into memory, directly violating §0. Its storage layer would duplicate Prisma/RLS with a parallel persistence model. |
| [letta-ai/letta](https://github.com/letta-ai/letta) | Apache-2.0 | Full agent runtime (core/recall/archival memory tiers) for long-running autonomous agents | **Reject.** DonorDesk's AI Reporter is a stateless per-section HTTP call behind `IReportDraftGenerator`, not a persistent agent process. Adopting Letta means adopting its runtime, not just its memory idea — far larger blast radius than the need. |
| [getzep/graphiti](https://github.com/getzep/graphiti) | Apache-2.0 | Temporal knowledge graph (bi-temporal facts + relationships) | **Reject for now, revisit later.** Donor requirement changes across periods are already modelled by `DonorTemplateVersion` + `ReportingPeriod.templateSnapshotJson` — a simpler, already-audited versioning scheme. Graphiti would be genuinely useful if DonorDesk later wants cross-donor pattern queries ("which donors changed reporting frequency after 2025?"), but that is not this phase's problem. |
| [langchain-ai/langmem](https://github.com/langchain-ai/langmem) | MIT | A set of memory-extraction *prompting patterns* (extract/consolidate/update) plus optional LangGraph store glue | **Adopt the pattern, not the dependency.** DonorDesk's Python worker already depends on `langgraph` (AI Reporter 2) but has zero LangMem-specific storage needs — memory rows are simple, tenant-scoped Prisma rows like every other aggregate. §4 below implements LangMem's extract → dedupe → consolidate shape as native, testable Python functions in `apps/workers/app/ai_reporter/`, so it stays inside the existing SRP module boundary instead of introducing a new framework surface. |
| [topoteretes/cognee](https://github.com/topoteretes/cognee) | Apache-2.0 | Document-to-knowledge-graph ETL framework | **Reject.** Solves "build a searchable knowledge base from documents" — DonorDesk already has that problem solved narrowly and correctly for donor templates (`TocTemplateExtractor`, structured parsers). Cognee would duplicate that pipeline with a less controllable one. |
| [stanfordnlp/dspy](https://github.com/stanfordnlp/dspy) | MIT | Prompt/few-shot optimizer against a metric function | **Adopt, offline-only, as a separate tool — see §9.** `reporting:eval` already is a metric function over a golden corpus. DSPy is genuinely useful for proposing writer-contract/`sectionGuidance` wording changes an engineer can review and version manually. It is **not** wired into the request path, the container, or any runtime dependency — it runs as a standalone script an engineer invokes locally, the same way `embedding:backfill` and `reporting-eval-cli` are standalone CLIs today. |

**Conclusion:** none of the memory frameworks fit without either fighting the
domain/application/infrastructure boundary (Mem0, Letta, Cognee) or solving a
problem DonorDesk doesn't have yet (Graphiti). Agent Memory is built natively,
following the exact port/repository/RLS pattern `ReportArtifact` and
`DonorTemplateMapping` already use. LangMem's *extraction algorithm shape* and
DSPy's *optimization role* are reused as techniques, not dependencies — this
matches the AI Reporter precedent (`AI-REPORTER-IMPLEMENTATION-PLAN.md` §1:
"adopt real repos as dependencies, do not rebuild them" — here the correct
read of that same principle is that there is no real dependency worth taking
on for the storage/governance half of this feature, only for the offline
optimization half).

---

## 2. Architecture and data flow

### 2.1 Seam: the same `sectionGuidance: string[]` array the profile/donor
guidance already flows through

```text
UpdateReportSectionHandler                          ← unchanged
   └─ creates MANUAL_EDIT ReportRevision
        │ (parentRevisionId points at the prior GENERATION/REWRITE revision —
        │  packages/domain/src/contexts/reporting/report-revision.ts)
        ▼
AgentMemoryExtractionJob (NEW, background via BackgroundRunner)
   └─ IRevisionDiffReader.readPair(sectionId)          → (priorContent, editedContent)
   └─ excludeNumericHunks(diff)                        → reuses grounding numeric-atom detector
   └─ IAgentMemoryExtractor.extract(diff, context)      (deterministic default; LLM-assisted opt-in)
   └─ IAgentMemoryRepository.proposeMany(candidates)    → status=PROPOSED, tenantId-scoped

Report manager reviews proposals (new, small UI surface)
   └─ ApproveAgentMemoryHandler / RejectAgentMemoryHandler / DeactivateAgentMemoryHandler

GenerateReportDraftHandler (application)              ← unchanged signature
   └─ IReportDraftGenerator.generateDraft(input)        ← port, unchanged
        └─ AiReporterDraftGenerator.buildSectionRequest()
             ├─ buildSectionSpecificGuidance(section, input)     ← existing SSOT, unchanged
             ├─ donorBriefFields(section)                        ← existing, unchanged
             └─ agentMemoryBriefFields(tenantId, donorId, section)  ← NEW
                    └─ IAgentMemoryRepository.findActiveForContext(...)
                    └─ returns { learnedStyleGuidance?: string[] }
        └─ sectionGuidance = [...guidance, ...specificGuidance, ...learnedStyleGuidance]
```

- Extraction runs **after** the assurance pass already re-verifies the edited
  revision (`UpdateReportSectionHandler` → `assuranceService.assessRevision`),
  so extraction only ever sees content DonorDesk has already re-checked for
  numeric consistency — a second, independent safety net on top of §0's hunk
  filter.
- `AgentMemoryExtractionJob` is dispatched through the **existing**
  `BackgroundRunner` (`packages/application/src/services/background-runner.ts`),
  the same seam `generate-report-draft.ts` and `regenerate-report-section.ts`
  already use, so it is tracked by `container.settleBackgroundWork()` with no
  new job-queue concept.
- The learned-guidance lookup is synchronous and read-only inside
  `buildSectionRequest()` — no new latency-sensitive dependency, no LLM call
  on the hot generation path.

### 2.2 Legacy generator parity

`llm-report-draft-generator.ts` (the non-AI-Reporter path, still the default
when `AI_REPORTER_ENABLED` is off) renders `donorInstructions`/
`authorInstructions` directly into its prompt (lines ~380-389). The same
`agentMemoryBriefFields` lookup is called there too, appended to the same
`buildSectionSpecificGuidance` output list, so a tenant's learned style
applies regardless of which generator is active — no duplicated guidance
logic, one lookup function reused by both call sites.

---

## 3. SOLID mapping

| Unit | Responsibility | Port(s) | SOLID notes |
|---|---|---|---|
| `AgentMemory` (domain entity) | Represents one learned/proposed style statement with scope, provenance, lifecycle | — | SRP: pure data + invariants (e.g. cannot transition PROPOSED→ACTIVE without `approvedById`); zero infra deps |
| `IAgentMemoryRepository` | Persist/query memory rows | application port | ISP: `proposeMany`, `findActiveForContext`, `findPending`, `approve`, `reject`, `deactivate` — no generic CRUD god-interface |
| `PrismaAgentMemoryRepository` | Implements the port over Postgres/RLS | infrastructure | DIP: only infrastructure imports Prisma; identical shape to `PrismaReportArtifactRepository` |
| `IRevisionDiffReader` | Reads a `(GENERATION\|REWRITE → MANUAL_EDIT)` revision pair for a section | application port | SRP: revision-chain traversal only, no extraction logic |
| `IAgentMemoryExtractor` | Turns a filtered diff into candidate `AgentMemoryCandidate[]` | application port | OCP: `DeterministicMemoryExtractor` (default) and `LlmAssistedMemoryExtractor` (opt-in) are interchangeable behind one port; LSP: both return the same candidate shape |
| `ExtractAgentMemoryHandler` | Orchestrates read → filter → extract → propose for one section edit | application use-case | SRP: one workflow, depends only on ports |
| `ApproveAgentMemoryHandler` / `RejectAgentMemoryHandler` / `DeactivateAgentMemoryHandler` | Human-governed lifecycle transitions + audit | application use-cases | SRP: one transition each, mirrors `ResolveReportClaimHandler`'s shape |
| `agentMemoryBriefFields()` | Pure function: active memory rows → `sectionGuidance` strings | infrastructure (llm module) | SRP: formatting only, no persistence, no LLM call; same shape as `donorBriefFields()` |
| `excludeNumericHunks()` | Strips any diff hunk containing a numeric atom, date, or indicator code before it reaches extraction | domain (pure function) | SRP: the one safety gate every extractor path — deterministic or LLM-assisted — must pass through |

---

## 4. Domain model

New context: `packages/domain/src/contexts/memory/agent-memory.ts`.

```ts
export type AgentMemoryScope = "ORGANIZATION" | "DONOR" | "TEMPLATE" | "SECTION_TYPE";
export type AgentMemoryCategory = "TONE" | "STRUCTURE" | "TERMINOLOGY" | "FORMATTING" | "LENGTH";
export type AgentMemoryStatus = "PROPOSED" | "ACTIVE" | "REJECTED" | "SUPERSEDED" | "DEACTIVATED";

export interface AgentMemoryProvenance {
  sourceRevisionId: string;      // the MANUAL_EDIT revision the pattern was observed in
  parentRevisionId: string;      // the GENERATION/REWRITE revision it was edited from
  sectionId: string;
  occurrenceCount: number;       // how many independent edits reinforced this statement
  lastObservedAt: Date;
}

export interface AgentMemory {
  id: string;
  tenantId: string;
  scope: AgentMemoryScope;
  scopeId: string | null;        // donorTemplateId when scope=DONOR/TEMPLATE, section title/inputType when SECTION_TYPE, null for ORGANIZATION
  category: AgentMemoryCategory;
  statement: string;             // short, imperative, e.g. "Prefer passive voice in the executive summary"
  confidence: "LOW" | "MEDIUM" | "HIGH"; // derived from occurrenceCount, never from LLM self-reported confidence
  status: AgentMemoryStatus;
  provenance: AgentMemoryProvenance[];   // every edit that reinforced this statement, append-only
  approvedById: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Invariants (enforced by the entity, not by callers):

- `status` can only reach `ACTIVE` via an explicit transition carrying
  `approvedById` — there is no constructor path that creates an already-active
  memory. This mirrors `ReportingRequirementPack` ("Packs require human review
  before activation") and `DonorTemplate`'s `REVIEWED` gate.
  `PROPOSED → ACTIVE | REJECTED`, `ACTIVE → DEACTIVATED | SUPERSEDED`. No other
  transitions exist.
- `statement` is capped (e.g. 200 chars) and must not match the existing
  numeric-atom / indicator-code regex used by `grounding.py` — a second,
  domain-level belt on top of the extraction-time hunk filter (§0).
- `provenance` is append-only; deactivating or rejecting a memory never
  deletes its provenance, preserving the audit trail (same rule as
  `ReportClaim`'s "claims are deleted and re-created," except here the
  history itself *is* the evidence, so it is retained, not recreated).

Extend `DomainErrorCode` with `AGENT_MEMORY_INVALID_TRANSITION`,
`AGENT_MEMORY_CONTAINS_NUMERIC_CONTENT`.

Add capability `reporting.manage-agent-memory` (report managers), following
the existing `report.resolve-claim` capability pattern.

### 4.1 Tenant-level self-service toggle

Two independent flags gate this feature, at two different levels, with an
AND relationship:

| Flag | Level | Who controls it | Default |
|---|---|---|---|
| `AGENT_MEMORY_ENABLED` | Platform (env var, `container.ts`) | DonorDesk ops, per §8 | off |
| `Organization.agentMemoryEnabled` | Tenant (self-service, Settings UI) | The tenant's own report managers | off |

This mirrors the existing precedent of `Organization.aiEnabled` (a
SuperAdmin/control-plane-managed whole-AI kill switch — see
`packages/domain/src/contexts/identity/organization.ts`), but
`agentMemoryEnabled` is deliberately **tenant self-service**, not
SuperAdmin-managed: a tenant should be able to turn this on or off from their
own Settings page without contacting support, the same way they manage their
own `reportingDefaults` today (`PUT /v1/organization/reporting-defaults`).

Effective state = `AGENT_MEMORY_ENABLED (platform) AND Organization.agentMemoryEnabled (tenant)`.
Both `ExtractAgentMemoryHandler`'s trigger and `agentMemoryBriefFields()`'s
lookup check the combined condition — a tenant turning the feature on has no
effect if the platform flag is off (dark-launch safety), and the platform
flag being on has no effect for a tenant who hasn't opted in (no surprise
behaviour change for existing tenants when the feature ships).

Add `agentMemoryEnabled: Boolean @default(false)` to the `Organization`
Prisma model (additive migration, alongside the `AgentMemory` table
migration in §6) and to the domain `Organization` entity/DTOs, following the
exact shape of the existing `aiEnabled` field.

---

## 5. Ports and use-cases

New file `packages/application/src/ports/agent-memory.ts` (kept separate from
the already-large `reporting.ts`, per the plan's own no-duplication/SRP rule):

```ts
export interface AgentMemoryCandidate {
  scope: AgentMemoryScope;
  scopeId: string | null;
  category: AgentMemoryCategory;
  statement: string;
  provenance: AgentMemoryProvenance;
}

export interface IAgentMemoryRepository {
  proposeMany(tenantId: TenantId, candidates: AgentMemoryCandidate[]): Promise<Result<AgentMemory[], DomainError>>;
  findPending(tenantId: TenantId, scope?: AgentMemoryScope): Promise<Result<AgentMemory[], DomainError>>;
  findActiveForContext(tenantId: TenantId, ctx: { donorTemplateId?: string; sectionTitle: string }): Promise<Result<AgentMemory[], DomainError>>;
  approve(id: string, tenantId: TenantId, actorId: string): Promise<Result<AgentMemory, DomainError>>;
  reject(id: string, tenantId: TenantId, actorId: string, reason?: string): Promise<Result<AgentMemory, DomainError>>;
  deactivate(id: string, tenantId: TenantId, actorId: string): Promise<Result<AgentMemory, DomainError>>;
}

export interface IRevisionDiffReader {
  readEditPair(sectionId: string, tenantId: TenantId): Promise<Result<{ prior: ReportRevision; edited: ReportRevision } | null, DomainError>>;
}

export interface IAgentMemoryExtractor {
  extract(input: {
    tenantId: TenantId;
    sectionTitle: string;
    donorTemplateId?: string;
    priorContent: string;
    editedContent: string;   // already numeric-hunk-filtered by the caller
  }): Promise<Result<AgentMemoryCandidate[], DomainError>>;
}
```

Use-cases (`packages/application/src/use-cases/memory/`):

- `extract-agent-memory.ts` — `ExtractAgentMemoryHandler`: reads the edit
  pair, calls `excludeNumericHunks` (domain), calls the extractor, proposes
  candidates, deduplicates against existing `PROPOSED`/`ACTIVE` memory for
  the same `(scope, scopeId, category)` by bumping `occurrenceCount` instead
  of creating a duplicate row. Triggered by `UpdateReportSectionHandler`
  via `BackgroundRunner` **only** when `changeOrigin === "MANUAL_EDIT"` and
  the parent revision's `changeOrigin` is `"GENERATION"` or `"REWRITE"` (a
  human editing their own prior manual edit is not a signal about AI output
  and is skipped).
- `list-pending-agent-memory.ts`, `approve-agent-memory.ts`,
  `reject-agent-memory.ts`, `deactivate-agent-memory.ts` — one-line handlers
  mirroring `resolve-report-claim.ts`'s permission-check + audit shape.
- `update-agent-memory-settings.ts` — `UpdateAgentMemorySettingsHandler`,
  following the narrow-purpose shape of
  `update-organization-reporting-defaults.ts` exactly (one boolean field, one
  capability check, one audit event `organization.agent_memory_toggled`),
  rather than folding into the larger `OrganizationProfileSchema`/
  `UpdateOrganizationHandler` — keeps the tenant self-service toggle a single,
  reviewable unit separate from general org-profile editing.

`UpdateReportSectionHandler` itself gains **zero** new responsibilities: it
still only commits the revision and runs assurance. The extraction trigger is
wired at the composition root (`container.ts`), which passes a
`BackgroundRunner`-wrapped call to `ExtractAgentMemoryHandler` into the
handler's existing background-work parameter — the same pattern
`generate-report-draft.ts` already uses for section-wise generation. This
keeps Single Responsibility intact: the section-update handler doesn't know
Agent Memory exists.

---

## 6. Persistence and migration

### 6.1 Prisma model

Add to `packages/infrastructure/prisma/schema.prisma`, following the
`ReportArtifact` block exactly:

```prisma
// --------------------------------------------------------------------------- //
// Agent Memory — learned tenant/donor style guidance (additive, RLS-scoped)
// --------------------------------------------------------------------------- //

/// One learned or proposed style/terminology statement. Never stores facts,
/// figures, or claims — only narrative style guidance, gated by human review.
model AgentMemory {
  id              String   @id
  tenantId        String
  scope           String   // ORGANIZATION | DONOR | TEMPLATE | SECTION_TYPE
  scopeId         String?
  category        String   // TONE | STRUCTURE | TERMINOLOGY | FORMATTING | LENGTH
  statement       String
  confidence      String   // LOW | MEDIUM | HIGH
  status          String   // PROPOSED | ACTIVE | REJECTED | SUPERSEDED | DEACTIVATED
  provenanceJson  String   @default("[]")
  approvedById    String?
  approvedAt      DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([tenantId])
  @@index([tenantId, scope, scopeId, status])
}
```

Migration `packages/infrastructure/prisma/migrations/<timestamp>_agent_memory/migration.sql`,
following the `20260927150000_donor_template_manager_v2` convention exactly:
`CREATE TABLE`, `CREATE INDEX "AgentMemory_tenantId_idx"`, the composite
lookup index, and a trailing SQL comment reminding the deployer that
`infra/postgres/rls.sql` must be re-applied.

### 6.2 RLS

Add `'AgentMemory'` to the table array in `infra/postgres/rls.sql` (the
single `FOREACH` loop already grants `donordesk_app` DML, forces RLS, and
creates the `tenant_isolation` policy for every name in that array — no other
change needed there).

### 6.3 Read-model note

`findActiveForContext` filters `status = 'ACTIVE'` and matches the broadest
applicable scope first (`SECTION_TYPE` for this exact section title, then
`TEMPLATE`/`DONOR` for this donor template, then `ORGANIZATION`), capped at a
small number of statements (e.g. 5) per generation to keep prompt size and
"instruction-following degradation with too many rules" risk bounded — the
same discipline `buildSectionSpecificGuidance` already applies by keeping its
own guidance list short and title-scoped.

---

## 7. Guardrails against learning facts (defense in depth)

Three independent layers, none of which trusts the others:

1. **Extraction-time hunk filter** (`excludeNumericHunks`, domain, pure): any
   diff hunk containing a numeric token, currency symbol, percentage, ISO
   date, or indicator code (reusing the existing atom-detection regex from
   `packages/domain/src/contexts/reporting/grounding.ts`) is dropped before
   it ever reaches an extractor — deterministic or LLM-assisted.
2. **Entity invariant** (`AgentMemory.statement` validation): a statement
   matching the same numeric-atom pattern cannot be constructed, so even a
   misbehaving extractor cannot produce a persisted candidate that smuggles a
   figure through as "style."
3. **Human approval gate**: nothing reaches `ACTIVE` — and therefore nothing
   reaches `sectionGuidance` — without a report manager's explicit approval
   (`reporting.manage-agent-memory` capability), reviewable and revocable at
   any time via `deactivate`.

None of these three layers is optional; §11's test matrix requires all three
to be independently exercised (a test that disables layer 1 must still be
caught by layer 2, and so on) — the same "no silent conversion" discipline
Feature 20 already requires for claim verification.

---

## 8. Feature flags (platform + tenant)

`AGENT_MEMORY_ENABLED`, read via the existing `isTruthyFlag()` helper
(`packages/infrastructure/src/observability/feature-flags.ts`), wired in
`container.ts` next to `aiReporterFlagEnabled` with the identical
info/warn-on-garbage-value logging pattern. This is the **platform** switch —
ops-controlled, default off, documented in `/opt/donordesk/shared/api.env`
alongside `AI_REPORTER_ENABLED`.

On top of it, `Organization.agentMemoryEnabled` (§4.1) is the **tenant**
switch — self-service, surfaced in Settings (§10.2), default off. Effective
state is the AND of both. When either is off:

- `ExtractAgentMemoryHandler` is never invoked from `UpdateReportSectionHandler`'s
  background-work wiring (no extraction job runs, no rows are written).
- `agentMemoryBriefFields()` returns `undefined` unconditionally, so
  `sectionGuidance` is byte-identical to today's output — this makes either
  flag flip a strictly additive, reversible change with no migration required
  to turn it back off.
- The "AI Writing Style" Settings tab itself is hidden when the platform flag
  is off (there is nothing for a tenant to configure yet), and shows the
  toggle in an off state, with no suggestions/active-preferences sections
  rendered, when the platform flag is on but the tenant hasn't opted in.

---

## 9. DSPy-based prompt optimization (separate, later, offline-only)

This is explicitly a **second, independent capability**, not a dependency of
§2–§8, and does not ship in the same release.

- A standalone script, `tools/prompt-optimizer/optimize_section_guidance.py`
  (new directory, Python, not part of `apps/workers`' runtime requirements —
  a separate `requirements-dev.txt` so `dspy` never ships to production).
- Input: the existing golden corpus (`packages/infrastructure/test/fixtures/reporting-golden.json`)
  and the existing deterministic evaluator (`createReportDraftEvaluator`,
  reimplemented as a Python metric function or called via a thin JSON-in/
  JSON-out subprocess bridge to the real TS evaluator, so there is exactly
  one scoring implementation, not two).
- Output: a diff against `apps/workers/app/ai_reporter/writer_contract.py`
  (and its TS mirror `contract.ts`) proposing wording changes — **never
  auto-applied**. An engineer reviews the diff, bumps
  `AI_REPORTER_CONTRACT_VERSION`, and runs the existing
  `test_ts_contract_mirror_is_string_identical` gate before merging, exactly
  as any other contract version bump does today.
- Explicit non-goal: DSPy never touches `AgentMemory` rows or the tenant
  runtime path. It only ever proposes changes to the versioned, global writer
  contract — a different artifact with a different, already-existing review
  process.

This section is included in this plan for completeness (it was the other
concrete recommendation from the research in §1) but is **out of scope for
the Phase 21 delivery gate** in §11; it may become its own follow-up plan.

---

## 10. Phased delivery plan

### Phase 0 — Domain and persistence
1. Add `AgentMemory` domain entity + `excludeNumericHunks` pure function +
   domain error codes + `reporting.manage-agent-memory` capability.
2. Add the Prisma model, migration, and `infra/postgres/rls.sql` entry.
3. Add `IAgentMemoryRepository` port + `PrismaAgentMemoryRepository` impl,
   wired once in `container.ts`.

**Gate:** domain tests cover every status transition and the numeric-content
rejection; migration applies cleanly; RLS re-applied and verified
(cross-tenant read returns zero rows in a repository contract test).

### Phase 1 — Extraction pipeline
1. Add `IRevisionDiffReader` + Prisma-backed impl (reads consecutive
   `ReportRevision` rows for a section, filtered to a
   `GENERATION|REWRITE → MANUAL_EDIT` pair).
2. Add `DeterministicMemoryExtractor` (default, no LLM call): rule-based
   classifiers for a small starting set of patterns — tense/voice shift,
   heading-style change, consistent phrase substitution, systematic
   length trimming per section type. Each rule is a pure, independently
   tested function.
3. Add `ExtractAgentMemoryHandler`, wired into `UpdateReportSectionHandler`'s
   background-work parameter at the composition root, gated by
   `AGENT_MEMORY_ENABLED`.

**Gate:** given a fixture pair of (AI-drafted, human-edited) section content
containing both a style change and a numeric correction, the extractor
proposes only the style statement — proven by test, not inspection.

### Phase 2 — Governance UI and API

**Backend:**
1. `list-pending-agent-memory.ts`, `approve-agent-memory.ts`,
   `reject-agent-memory.ts`, `deactivate-agent-memory.ts`,
   `update-agent-memory-settings.ts` (§5) handlers.
2. API routes, thin and Zod-validated, capability-gated by
   `reporting.manage-agent-memory`:
   - `GET /v1/organization` gains `agentMemoryEnabled` in its response (§4.1);
     `PUT /v1/organization/agent-memory-settings` (`{ enabled: boolean }`)
     toggles it — same shape as the existing
     `PUT /v1/organization/reporting-defaults`.
   - `GET /v1/agent-memory?status=PROPOSED|ACTIVE`
   - `POST /v1/agent-memory/:id/approve` (body: `{ scope, scopeId? }` — the
     reviewer's "Applies to" choice at approval time; the extractor proposes
     a default scope, but the human can widen or narrow it before approving)
   - `POST /v1/agent-memory/:id/reject`, `POST /v1/agent-memory/:id/deactivate`
   - No dedicated "pending count" endpoint: the web layer derives the
     Settings-tab badge count from the same `GET /v1/agent-memory?status=PROPOSED`
     list it already needs to render the page, avoiding a second, redundant
     read path for the same data.
   - Each `AgentMemory` returned by the list endpoint includes a resolved
     `provenance[].sectionTitle` / `reportPeriodLabel` (joined server-side via
     the existing `IReportSectionRepository`/`IReportingPeriodRepository`
     reads, not a new port) so the UI can link a suggestion back to the exact
     report/section it came from without a second round-trip.

**Frontend** (new Settings tab, `/settings/ai-style`, tenant-facing label
**"AI Writing Style"** — the internal name "Agent Memory" never appears in
tenant-facing copy):

3. Add the tab to `apps/web/src/app/(portal)/settings/layout.tsx`'s tab list,
   gated by `hasCapability(ctx, "reporting.manage-agent-memory")` (same
   pattern the `Setup`/`Audit log` tabs already use), and hidden entirely
   when the platform flag (§8) is off.
4. Page sections, top to bottom:
   - **On/off toggle**, one sentence of plain-language explanation, bound to
     `PUT /v1/organization/agent-memory-settings`. When off, the rest of the
     page is replaced by the explainer only (§4.1's "nothing to configure
     yet" state) — no suggestions/active list fetched or rendered.
   - **"Suggestions waiting for you (N)"** — one card per `PROPOSED`
     `AgentMemory`, showing: category badge, the section title and how many
     times the pattern recurred ("Seen 3 times"), the before/after excerpt
     from `provenance[0]` (the AI-drafted text vs. the edited text, not an
     abstract description of the rule), an "Applies to" scope selector
     defaulting to the extractor's proposed scope, and Approve/Reject
     buttons. A collapsible "Why was this suggested?" link per card expands
     the full list of `provenance` entries with their resolved section/report
     links (addresses the plan's earlier open question about provenance
     visibility — every suggestion is traceable to real edits, on demand,
     without cluttering the default view).
   - **"Active style preferences (N)"** — one row per `ACTIVE` memory:
     statement text, scope ("Applies to: All reports" / "This donor only" /
     etc.), age ("Added 2 weeks ago"), and two actions: **Pause**
     (→ `DEACTIVATED`, reversible, calls `deactivate`) and **Remove**. Search
     and a category filter once the list is non-trivial.
   - **Empty state** (no proposals yet): reassuring copy explaining that
     suggestions appear as the team's edits accumulate — never a blank page
     that looks broken.
   - **Collapsible "How does this work?"** section, closed by default: a
     4-step plain-language explanation plus one explicit sentence that
     numbers, dates, and facts are never learned this way (directly answers
     the trust concern a donor-compliance-conscious admin will have first).
5. **Settings-tab badge**: the tab label itself shows a small count badge
   ("AI Writing Style •3") when pending suggestions exist, using the same
   count already fetched for the page's own header — sourced from the portal
   layout's existing capability-gated data-fetch pattern (consistent with how
   other Settings-adjacent counts, e.g. checklist/readiness badges, surface
   in the portal shell), not a new polling mechanism.

**Gate:** a report manager can turn the feature on for their own tenant
without SuperAdmin involvement; see why a suggestion exists (the exact
before/after excerpt, expandable to full provenance) with an "Applies to"
choice made at approval time; approve it and see the resulting `ACTIVE` row
with a working Pause action; and a non-report-manager role is denied by the
capability check and never sees the tab.

### Phase 3 — Generation-time injection
1. `agentMemoryBriefFields()` pure function in the `llm` module (mirrors
   `donorBriefFields`), consuming `IAgentMemoryRepository.findActiveForContext`.
2. Wire into `AiReporterDraftGenerator.buildSectionRequest()` and the legacy
   `llm-report-draft-generator.ts` guidance assembly (§2.2), both appending to
   the same `sectionGuidance` array.
3. Extend `apps/workers/app/ai_reporter/models.py` `SectionBrief` only if a
   dedicated field is preferred over folding into `sectionGuidance` directly
   — default recommendation is to fold in, since `sectionGuidance` is
   documented as "One SSOT for editorial guidance" and a second parallel
   field would violate that SSOT the codebase already committed to.

**Gate:** an approved memory statement is present, verbatim, in the worker
request payload for a matching section on the next generation; when the flag
is off, the payload is byte-identical to pre-Phase-21 output (regression
test on the existing AI Reporter contract suite).

### Phase 4 — Multi-tenant and eval verification
1. Cross-tenant isolation tests: tenant A's approved memory never appears in
   tenant B's `findActiveForContext` result, proven at the repository layer
   (RLS) and the application layer (explicit `tenantId` filtering, defense in
   depth per the existing `PrismaReportArtifactRepository` convention).
2. Run `reporting:eval` before/after enabling `AGENT_MEMORY_ENABLED` on a
   tenant with seeded approved memory, confirming no numeric-accuracy or
   grounding regression (memory only ever changes prose style dimensions the
   evaluator already scores separately, e.g. repetition/tone, never the
   deterministic gates).
3. Load/rollback drill: flip `AGENT_MEMORY_ENABLED` off in an env file on a
   staging-equivalent box, confirm generation output reverts exactly (§8).

**Gate:** all §11 tests pass; no regression on Features 11/13/20 golden
corpus cases; flag flip is proven reversible.

### Phase 5 — Merge to master
1. `pnpm -r typecheck && pnpm -r build`, full test suite, `reporting:eval`.
2. Update `memorybank/Features/INDEX.md` (row for Feature 21) and this file's
   status line to IMPLEMENTED.
3. Merge `0009-agent-memory` → `master` only after the above gates and the
   user's explicit review, per this branch's stated purpose ("build in this
   branch till all is verified and working, then commit to main").

---

## 11. Required test matrix

### Domain (pure, no provider)
- Every `AgentMemoryStatus` transition, including all illegal transitions
  rejected (`PROPOSED → DEACTIVATED` directly, `REJECTED → ACTIVE`, etc.).
- `excludeNumericHunks`: numeric tokens, currency, percentages, ISO dates,
  indicator codes each independently trigger exclusion; a hunk with no such
  token passes through unchanged.
- `AgentMemory` constructor rejects a `statement` containing a numeric atom
  even if it somehow reached construction (layer 2 of §7, tested in
  isolation from layer 1).

### Application
- `ExtractAgentMemoryHandler`: only triggers on `MANUAL_EDIT` with a
  `GENERATION`/`REWRITE` parent; a second manual edit of a manual edit is
  skipped; deduplication bumps `occurrenceCount` instead of creating a
  duplicate row for the same `(scope, scopeId, category, statement)`.
- Approve/reject/deactivate handlers: capability enforcement, audit event per
  transition (`agent_memory.proposed`, `agent_memory.approved`,
  `agent_memory.rejected`, `agent_memory.deactivated`), matching the existing
  `report.section.updated`-style event naming.
- `agentMemoryBriefFields`: returns at most the capped count, broadest-scope-first
  ordering, empty when the flag is off or no active memory matches.

### Infrastructure
- `PrismaAgentMemoryRepository` contract tests (same suite shape as
  `IReportArtifactRepository`'s): cross-tenant read isolation, transactional
  `proposeMany`, `findActiveForContext` scope-precedence ordering.
- RLS integration test: a raw `psql` session without `app.current_tenant` set
  returns zero rows against `AgentMemory` (mirrors the existing RLS test
  pattern for other tenant tables).

### API and web
- Capability-gated routes reject non-report-manager roles with 403.
- Learned-suggestions panel renders provenance (before/after excerpt) so a
  reviewer never approves a statement blind.
- Two-flag gating: platform-off/tenant-on, platform-on/tenant-off, and
  platform-off/tenant-off all produce identical (disabled) behaviour to
  today; only platform-on AND tenant-on activates extraction and injection —
  each combination tested explicitly, not inferred.
- `PUT /v1/organization/agent-memory-settings` is tenant-isolated: toggling
  it for tenant A never affects tenant B's `agentMemoryEnabled` value.
- Settings-tab badge count matches the length of the `PROPOSED` list exactly
  (no separate counting logic to drift out of sync).

### Regression
- Full `reporting:eval` corpus before/after, flag on and off — zero change in
  any deterministic (hard-gate) metric; the AI Reporter contract-mirror test
  (`test_ts_contract_mirror_is_string_identical`) stays green since Phase 21
  does not touch the writer contract itself (only §9's separate,
  out-of-scope tool does).

---

## 12. Security and multitenancy

- Every `AgentMemory` row is `tenantId`-scoped, RLS-forced, and additionally
  filtered by `tenantId` in every repository method (defense in depth,
  matching every other tenant table in this codebase).
- Memory is **never** shared across tenants. There is no cross-tenant
  aggregation, pattern-mining, or "learn from all customers" path in this
  plan — the pasted research material's caution about cross-tenant learning
  requiring "explicitly approved, anonymised patterns only" is honored by
  simply not building any cross-tenant path at all; if that is ever wanted,
  it is a distinct, separately-approved feature, not an extension of this
  one.
- Learned statements are treated as **prompt content**, not instructions with
  elevated trust — they pass through the same PII firewall
  (`LLM_PII_POLICY`) as every other piece of context sent to a provider, and
  the writer contract's existing "never invent facts to satisfy [instruction
  fields]" rule (already applied to `donorInstructions`/`authorInstructions`
  in `draft_writer.py`) applies identically to memory-derived guidance.
- Every proposal, approval, rejection, and deactivation is an audit event via
  the existing `PrismaAuditRepository.record()` — no parallel audit path.

---

## 13. Explicit non-goals (no duplication)

- No Mem0/Letta/Cognee/Graphiti runtime dependency (§1).
- No new job-queue or orchestration concept — reuses `BackgroundRunner` and
  `container.settleBackgroundWork()`.
- No new "editorial guidance" channel — folds into the existing
  `sectionGuidance` SSOT rather than adding a second field the worker must
  separately render.
- No cross-tenant memory sharing or aggregation.
- No fact, figure, date, or claim is ever stored, proposed, or learned —
  enforced by three independent layers (§7), not by extractor discipline
  alone.
- DSPy-based prompt optimization (§9) is out of scope for this plan's
  definition of done; it is documented here only so the research question is
  answered in one place, not built here.
- No automatic activation of learned memory — every statement requires
  explicit human approval before it can influence generation.
- No SuperAdmin-only control of the tenant-facing toggle — unlike
  `Organization.aiEnabled` (a control-plane kill switch), a tenant manages
  their own `agentMemoryEnabled` state directly; SuperAdmin involvement is
  limited to the platform-wide `AGENT_MEMORY_ENABLED` rollout flag.

---

## 14. Definition of done

Phase 21 is complete only when:

- an `AgentMemory` row can be proposed from a real reviewer edit, approved by
  a report manager, and observably changes the next generation's
  `sectionGuidance` for a matching section/donor/template — with a test
  proving the byte-for-byte payload difference;
- a diff hunk containing any numeric/date/indicator content is proven, by
  test, to never survive extraction, entity construction, or approval into
  an active memory statement;
- `AGENT_MEMORY_ENABLED=0` (platform) or `Organization.agentMemoryEnabled=false`
  (tenant) — either alone, or both — produces byte-identical generation
  output to pre-Phase-21 behaviour;
- a tenant can self-service enable/disable the feature from the "AI Writing
  Style" Settings tab without SuperAdmin involvement, and the tab is invisible
  to tenants without the `reporting.manage-agent-memory` capability and to
  every tenant when the platform flag is off;
- cross-tenant isolation is proven at both the RLS and repository level;
- every lifecycle transition is audited;
- `pnpm -r typecheck`, `pnpm -r build`, the full test suite, and
  `reporting:eval` all pass with no regression on Features 11/13/20;
- this plan's status line and `memorybank/Features/INDEX.md` are updated to
  IMPLEMENTED before merge to `master`.

---

## 15. Deviations from this plan (recorded during implementation, 2026-09-28)

A pre-implementation audit found several places where this plan's literal
citations did not match the repository as it actually exists. Rather than
block on them, each was resolved with the closest existing convention;
recorded here so a reviewer isn't surprised by the diff.

- **Numeric detector.** `packages/domain/src/contexts/reporting/grounding.ts`
  (cited in §0/§7) does not exist. `excludeNumericHunks` and
  `containsNumericContent` instead reuse `extractNumericAtoms` from the real
  domain-layer file, `numeric-atom.ts` — a same-package domain import, so the
  domain-has-zero-infra-deps rule is unaffected.
- **`IRevisionDiffReader`.** Not implemented as a separate port + Prisma
  adapter. `ExtractAgentMemoryHandler` depends directly on the existing
  `IReportRevisionRepository` (`findById`) — that port already exposes
  everything needed to walk the `parentRevisionId` chain, and adding a second
  abstraction over the same table would have duplicated it (violates this
  plan's own §13 "no duplication" rule).
- **`UpdateReportSectionHandler` background param.** The plan's §2.1/§5
  describe this as "existing"; it did not exist. Added as a 6th/7th
  constructor parameter (`onManualEditCommitted`, `runInBackground`, both
  optional, defaulting to a no-op), following the exact optional-injected-hook
  pattern `GenerateReportDraftHandler`/`RegenerateReportSectionHandler`
  already use for `BackgroundRunner`. The handler still has zero compile-time
  knowledge of Agent Memory — only an injected callback.
- **Capability naming.** Added as `report.manage-agent-memory` (server
  `Permission`) and the same string in the web `Capability` union — matching
  the existing `report.resolve-claim`/`report.override-confidentiality`
  precedent, not the plan's `reporting.manage-agent-memory` (which would have
  been the first `reporting.*`-prefixed server permission; the server-side
  convention is uniformly `report.*`).
- **`update-agent-memory-settings.ts` capability check.** The plan says to
  mirror `update-organization-reporting-defaults.ts` "including one capability
  check," but that handler has zero capability checks (any authenticated
  member may call it). `UpdateAgentMemorySettingsHandler` adds an explicit
  `report.manage-agent-memory` check instead, since its own API route also has
  no other protection and the setting gates whether reviewer edits are read
  for learning purposes at all.
- **`AGENT_MEMORY_INVALID_TRANSITION` / `AGENT_MEMORY_CONTAINS_NUMERIC_CONTENT`.**
  Not added as new `DomainErrorCode` values. No entity in this codebase has
  bespoke per-entity transition/validation codes — `ReportClaim`,
  `DonorTemplate`, and every billing state all reuse the generic
  `INVALID_STATE_TRANSITION`/`VALIDATION_FAILED` codes with a `details`
  payload. `AgentMemory` follows that convention
  (`details: { reason: "numeric_content" }` on the numeric-content rejection)
  rather than introducing the first per-entity code pair.
- **DONOR/TEMPLATE scope plumbing.** `GenerateReportDraftInput`'s
  `TemplateGenerationContext` carries `donorName`/`templateName` strings, not
  a stable `donorTemplateId`, and no id is threaded through generation
  context today. `DeterministicMemoryExtractor` (v1) therefore only ever
  proposes `SECTION_TYPE`-scoped candidates (keyed by section title); the
  `DONOR`/`TEMPLATE` scopes remain fully modelled in the domain type and the
  repository's `findActiveForContext` precedence order for a human reviewer
  to widen a suggestion's scope at approval time (§10 Phase 2's "Applies to"
  selector), and for a future extractor to populate once an id is available.
- **Full-draft (non-section-wise) legacy prompt path.** Agent Memory injection
  was wired into both generators' **section-wise** `generateSection()` methods
  only (the primary path both generators use today). The legacy
  `LlmReportDraftGenerator`'s whole-draft `generateDraft()`/
  `buildNarratorUserPrompt()` path was left untouched — out of scope for this
  pass, not a bug.
- **Phase 4 (DB-integration + live `reporting:eval`) and §9 (DSPy).** Not
  executed in this pass — Phase 4's cross-tenant RLS/repository contract
  tests need a live Postgres instance this environment does not have, and §9
  is explicitly out-of-scope-for-delivery per the plan itself. All
  provider-agnostic tests (domain, application, infrastructure unit tests)
  pass; `pnpm -r typecheck` and `pnpm -r build` are clean across the monorepo.
