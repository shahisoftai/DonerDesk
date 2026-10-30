# Phase 36 — AI Project Setup Wizard (2026-10-29)

**DonorDesk Version 3.007.** Status: plan only. Nothing here is built.

Goal: a person uploads a project document (proposal, concept note, grant agreement, logframe workbook) and DonorDesk
proposes a complete project setup: project facts, logframe, indicators, reporting periods, planned activities and timeline,
places (maps), funding and budget, risks. The person reviews one screen per area, then applies. Everything lands as
**DRAFT**, with **no indicator values**.

Honest framing: "read, propose, review, apply". Not "fully automatic". A target, a date or an amount the document does
not state is **"Not stated"**, never guessed and never 0.

---

## 0. Decisions made in this plan (change them here first)

| # | Decision | Why |
|---|---|---|
| D1 | **Three phases, three separate use cases**: Extract → Review → Apply. No handler does more than one. | SRP; each is testable and retryable alone. |
| D2 | **The proposal is stored data** (`ProjectSetupProposal`), editable, versioned by `updatedAt`. | The AI never writes project records directly; a person always decides. |
| D3 | **Apply reuses the existing import/create handlers.** No second code path writes a logframe, plan, place or budget. | One writer per aggregate (AGENTS.md); their idempotency, audit and validation come for free. |
| D4 | **Every proposed item carries a verbatim `sourceQuote` and a page/block reference.** An item whose quote is not in the document, or whose figure is not in its quote, is dropped (and counted). | Same rule as Ask `groundAnswer` and template extraction (ungrounded items dropped). |
| D5 | **Opt-in: `Organization.setupAssistEnabled`** (default false), plus `aiEnabled` and a real provider. Off = nothing read, redacted or sent. | Mirrors `askEnabled`. |
| D6 | **The document goes through `redactForLlm`** before any prompt; grounding checks run against the redacted text. | Same as Ask: the model and the check read the same text. |
| D7 | **Extraction runs as background work** through the injected `BackgroundRunner`; the screen polls the run's status. | A long document takes minutes; AGENTS.md requires `BackgroundRunner` for handler background work. |
| D8 | **No new health score, no projection, no invented value.** | Existing invariants. |

---

## 1. Scope

### In
1. Source intake: upload (PDF, DOCX, XLSX, CSV), Drive link, pasted text (reuse `ParseTemplateFileHandler`,
   `registerParseFileRoute`, `assessTextExtraction`, OCR fallback).
2. Extraction of eight areas (sections below).
3. Review UI with per-item source, edit, remove, "Not stated" fill-ins, confidence.
4. Ordered apply with dry run, partial-success report, resume.
5. Audit, caps, golden-corpus evaluation, four-language copy.

### Out (Phase 36 does not build)
- Indicator **values**, evidence, activity records (completed work), beneficiaries, people accounts.
- Donor report templates (already `TocTemplateExtractor`).
- Auto-apply without review.
- Inviting team members (names are proposed as text only; assigning real users stays manual).
- Budget → result linking (no model for it yet, see Phase 35 notes).

---

## 2. Target architecture (layers and dependency direction)

```
apps/web (presentation)  ──►  apps/api (routes)  ──►  application (use cases + ports)  ──►  domain (pure)
                                                              ▲
                                       infrastructure (adapters) implements ports
```

Per AGENTS.md: domain has zero infrastructure deps; application defines ports; infrastructure implements; routes are thin
and Zod-validated; web server actions write, RSC reads. `test/architecture-boundaries.test.mjs` must keep passing.

### 2.1 Domain — `packages/domain/src/contexts/project-setup/` (pure TypeScript)

| File | Responsibility (single) |
|---|---|
| `proposal.ts` | Types: `ProjectSetupProposal`, one `Proposed<T>` wrapper (`value`, `sourceQuote`, `sourceRef`, `confidence`, `status`), area types. No behaviour. |
| `proposal-areas.ts` | `SETUP_AREAS` — the one exhaustive table: area key → label key, dependency list, apply order. Adding an area = one row (OCP). |
| `grounding.ts` | `groundProposed(item, sourceText)`: quote present verbatim (whitespace-normalised) and every figure/date in `value` appears in the quote. Pure. Reuses `askFigures`-style normaliser (one spelling: `1,200` = `1200`). |
| `proposal-checks.ts` | `checkProposal(proposal)`: cross-area consistency (indicator → existing logframe code, activity → inside project dates, budget currency named, periods inside dates, parent codes exist). Returns problems with `code` + `path` + `params` (translated by the web; never raw English). |
| `apply-plan.ts` | `planApply(proposal, accepted)`: derives the ordered step list from `SETUP_AREAS` dependencies, skipping areas with nothing accepted. Pure, deterministic. |
| `proposal-edit.ts` | Pure edit operations (`acceptItem`, `rejectItem`, `editValue`, `fillNotStated`) returning a new proposal or a reason; same style as `dashboard-templates.ts`. An edited value is marked `EDITED` and no longer needs a quote (a person wrote it). |
| `source-document.ts` | `SourceBlock[]` model (index, page, text) + `normaliseForMatch`. |

Rules enforced here, tested here:
- A missing value is `null` / `"Not stated"`, never 0 or empty string standing in for a number.
- A rate is never given a "% of target".
- Dates are plain days (`plain-date.ts`); never `new Date(string)` in local time.
- Currency is never assumed: a budget row without a named currency is `Not stated`.

### 2.2 Application — `packages/application/src/use-cases/project-setup/`

Ports (new, in `ports/project-setup.ts`; each small and role-specific — ISP):

| Port | Methods |
|---|---|
| `ISetupProposalRepository` | `create`, `findById`, `update(expectedUpdatedAt)`, `listByProject/Tenant` |
| `ISetupRunRepository` | `start`, `progress`, `finish`, `fail`, `find` (extraction/apply run status) |
| `ISourceDocumentReader` | `read(fileRef) → SourceBlock[]` (wraps existing parse handlers; the only place that knows how a file becomes text) |
| `ISetupAreaExtractor` | `area: SetupAreaKey`, `extract(input: ExtractInput) → Promise<Result<ExtractedArea, DomainError>>` — **one implementation per area** |
| `ISetupAreaApplier` | `area: SetupAreaKey`, `dryRun(ctx, projectId, accepted)`, `apply(ctx, projectId, accepted, idempotencyKey)` — **one implementation per area, each delegating to the existing handler** |
| `ISetupLlm` | `completeJson(system, user, {maxTokens, timeoutMs, schema})` — narrow facade over `ILLMProvider` (only what extractors need; DIP) |

Use cases (each one class, one public `handle`):

| Use case | Does exactly this |
|---|---|
| `StartSetupExtractionHandler` | checks permission + opt-in + caps, stores the source, creates a proposal (`EXTRACTING`) and a run, schedules extraction through `BackgroundRunner`. |
| `SetupExtractionOrchestrator` (service, not a handler) | reads blocks, builds the condensed outline view, runs registered `ISetupAreaExtractor`s in dependency order, grounds each item, stores the area, records progress. Knows no area internals: iterates the registry (OCP). |
| `GetSetupProposalHandler` | read model: proposal + run status + problems from `checkProposal`. |
| `EditSetupProposalHandler` | applies one `proposal-edit` operation with `expectedUpdatedAt`; refuses a stale save; audited. |
| `RerunSetupAreaHandler` | re-extract one area (keeps edits of other areas); same caps. |
| `PreviewSetupApplyHandler` | runs `planApply` + every applier's `dryRun`; saves nothing. |
| `ApplySetupProposalHandler` | creates the project (or targets an existing empty one), then runs appliers in `planApply` order, each with its own idempotency key `setup:<proposalId>:<area>`; records per-area result; **stops at the first failed area and reports it; earlier areas stay applied; resume re-runs only unfinished areas** (no all-or-nothing across areas, because each area handler already is all-or-nothing within itself). |
| `DiscardSetupProposalHandler` | deletes proposal + stored source; audited. |

Appliers reuse (never reimplement): `CreateProjectHandler`, `ImportLogframeHandler`, `ImportIndicatorsHandler`,
`periods/create-all`, `ImportWorkPlanHandler` (+ `proposePlanDates`), `ImportPlacesHandler`,
`SaveFundingHandler/ImportRegisterSheetHandler/budget import`, `ProjectRisk` create handler.

Audit: `setup.extraction.started|finished|failed`, `setup.proposal.edited`, `setup.apply.area`, `setup.apply.finished`.
Records the **length** of the document and counts, never the text (as `ask.question`).

### 2.3 Infrastructure — `packages/infrastructure/src/project-setup/`

- `prisma-setup-proposal-repository.ts`, `prisma-setup-run-repository.ts` (one repository per aggregate).
- `llm-setup-adapter.ts` implements `ISetupLlm` over the tenant's provider (`resolveAskLlm`-style resolution; stub provider = feature unavailable, never fake output).
- Extractors (`extractors/*.ts`), one class per area, each with its own prompt module `prompts/<area>.ts` (versioned `promptVersion`, recorded per run):
  `ProjectFactsExtractor`, `LogframeExtractor`, `IndicatorExtractor`, `PeriodExtractor`, `ActivityPlanExtractor`,
  `PlaceExtractor`, `FundingBudgetExtractor`, `RiskExtractor`.
- Deterministic first: if the document is a **spreadsheet with recognisable columns** (the existing logframe/work-plan/budget header sets) the extractor uses the existing parsers (`parseLogframeText`, `parseWorkPlanText`, `recordSheetTemplate`-style headers) and **calls the model only for what is left**. Cheaper, exact, auditable.
- Appliers (`appliers/*.ts`), thin adapters over the existing handlers.
- Composition in `container/project-setup-module.ts` (as `finance-module.ts`): registries `SETUP_EXTRACTORS`, `SETUP_APPLIERS` built from arrays; the orchestrator depends on the arrays, not on concrete classes.
- Shared by all extractors: `outline-view.ts` (condensed document view reused from `renderOutlineView`), `json-repair.ts` (reuse `tryParseJson`), `retry-policy.ts` (one transient retry, backoff; same rules as AI Reporter pacing — **never a second retry**).

### 2.4 API — `apps/api/src/routes/project-setup.ts`

Thin routes; Zod schemas in `packages/contracts/src/project-setup.ts`. All in `RULES` (authorization-coverage test).

| Route | Permission | Handler |
|---|---|---|
| `POST /v1/project-setup/proposals` (multipart or drive ref) | `project.create` + opt-in | Start |
| `GET /v1/project-setup/proposals/:id` | `project.create` | Get |
| `PATCH /v1/project-setup/proposals/:id` | `project.create` | Edit |
| `POST /v1/project-setup/proposals/:id/areas/:area/rerun` | `project.create` | Rerun |
| `POST /v1/project-setup/proposals/:id/preview` | `project.create` | Preview |
| `POST /v1/project-setup/proposals/:id/apply` | `project.create` (+ each area's own permission re-checked by its handler) | Apply |
| `DELETE /v1/project-setup/proposals/:id` | owner or `org.manage` | Discard |
| `PUT /v1/organization/setup-assist` | `org.manage` | `UpdateSetupAssistSettingsHandler` (audited) |

Not on `EXTERNAL_ALLOWED` (partners cannot use it). A proposal is private to its creator and `org.manage`.

### 2.5 Web — `apps/web/src/features/project-setup/`

- `domain/` (pure, no React/Next): `review-state.ts` (which areas are ready, counts, "next problem"), `setup-copy.ts` (typed catalogue, four languages), reuses domain `proposal-edit`.
- `presentation/`: `SetupWizard` (steps: Upload → Reading… → Review → Preview → Apply → Done), `AreaReview` (generic table driven by `SETUP_AREAS`, one component for all areas, area-specific cell renderers registered in a map), `SourceQuotePopover`, `ProblemList`, `ApplyProgress`.
- Entry points: "Set up from a document" on `/projects/new` beside the manual wizard; the manual wizard stays unchanged.
- Server actions in `lib/actions/project-setup.ts` (every export `async function`; schemas in `lib/server/schemas-project-setup.ts`; create actions forward `Idempotency-Key`).
- Never import the domain root from `"use client"` files; use subpath exports added to `packages/domain/package.json`.
- Mobile: review is a list, not a wide table, under 640 px.
- Accessibility: every control labelled (`Field`), state never colour-only, keyboard review (↑/↓ item, A accept, R reject, E edit).

---

## 3. SOLID — how each principle is met, and how a test proves it

| Principle | Design decision | Enforcement |
|---|---|---|
| **S — Single responsibility** | One extractor per area; one applier per area; one use case per phase; grounding, consistency checks, edit ops and apply planning are separate pure modules; the orchestrator only sequences. Prompts live apart from extractor logic. | A file-size and export-count check in `architecture-boundaries.test.mjs` (no setup file > 300 lines, one public class per file). |
| **O — Open/closed** | New area = one `SETUP_AREAS` row + one extractor + one applier + one review cell renderer. Orchestrator, apply planner, review table and route are **not edited**. | `setup-areas.test.mjs` walks the table and fails until every area has an extractor, applier, copy keys and a golden case (`assertExhaustive`). |
| **L — Liskov** | Every `ISetupAreaExtractor`/`ISetupAreaApplier` honours one contract: never throws for expected failures (returns `Result`), never mutates input, `dryRun` writes nothing, `apply` is idempotent for the same key, extraction output is always groundable. | Shared contract suites `test/support/setup-extractor-contract.mjs` and `setup-applier-contract.mjs` run against **every** implementation (same pattern as `assignment-source-contract.mjs`). |
| **I — Interface segregation** | Small ports: repositories, document reader, narrow `ISetupLlm`, extractor, applier. An extractor sees `ExtractInput` (blocks + upstream areas it declared), not the whole container. Appliers get only their handler. | Port files each < 40 lines; a test asserts extractors import nothing from `ports/billing`, `ports/identity`, etc. |
| **D — Dependency inversion** | Domain knows no I/O. Application depends on ports; orchestrator receives `ISetupAreaExtractor[]`, `ISetupAreaApplier[]`, `ISetupLlm`, `BackgroundRunner`, clock, id generator by constructor. Concrete adapters are wired only in `container/project-setup-module.ts`. | `test:architecture` (domain imports nothing outside itself; application imports no infrastructure/Prisma/Next). Unit tests run the orchestrator with fake extractors and a fake LLM. |

Additional discipline:
- No `if (area === …)` anywhere outside the registries (a grep test fails on it).
- No static singletons, no time/randomness inside domain (clock and ids injected).
- Errors are `Result<T, DomainError>`; no exceptions for expected failures.
- Composition over inheritance: no abstract base extractor; shared steps are small functions (`groundAll`, `withRetry`).

---

## 4. Data model (one additive migration, before the code)

Migration `20261101090000_project_setup_proposals`:

- `ProjectSetupProposal`: `id`, `tenantId`, `createdById`, `status` (`EXTRACTING | READY | APPLYING | APPLIED | PARTIAL | FAILED | DISCARDED`), `sourceName`, `sourceStorageKey` (encrypting storage), `sourceHash`, `sourceLength`, `proposalJson` (areas), `problemsJson`, `appliedProjectId?`, `promptVersion`, `model`, `createdAt`, `updatedAt`, `expiresAt` (30 days; stored source is deleted at expiry or on discard).
- `ProjectSetupRun`: `id`, `tenantId`, `proposalId`, `kind` (`EXTRACT | APPLY`), `area?`, `status`, `detailJson` (counts, dropped, timings; **no document text**), `startedAt`, `finishedAt`.
- `Organization.setupAssistEnabled Boolean @default(false)`.

Rules: RLS forced on both tables (add to `rls.sql`, check `rowsecurity` per table; `rls-coverage.test.mjs` must pass); `donordesk_app` DML grants; included in organisation export **except** `sourceStorageKey` content (list in `ORG_EXPORT_EXCLUDED` with the reason: source documents); edit by hand, never `prisma format`; `/ready` requires `ProjectSetupProposal.proposalJson` and `Organization.setupAssistEnabled` (add to `REQUIRED_PRISMA_FIELDS`); repository `update` writes every mutable field with `?? null` and a test pins it.

---

## 5. The proposal shape (contract, abbreviated)

```ts
Proposed<T> = {
  value: T | null                  // null = "Not stated"
  sourceQuote: string | null       // verbatim, ≤ 400 chars; null only when EDITED/ADDED by a person
  sourceRef: { block: number; page?: number } | null
  confidence: "HIGH" | "MEDIUM" | "LOW"   // from grounding (exact quote + figures = HIGH), never model self-rating alone
  status: "PROPOSED" | "ACCEPTED" | "REJECTED" | "EDITED"
}
ProjectSetupProposal = {
  facts:      { name, code?, donor?, countries[], sectors[], startDate, endDate, currency, summary }
  logframe:   LogframeNode[]       // level GOAL|OUTCOME|OUTPUT|ACTIVITY, code, title, description, parentCode
  indicators: IndicatorDef[]       // code, title, logframeCode, type, unit, baseline, target, targetSchedule?, frequency, direction?, disaggregation[], meansOfVerification?
  periods:    PeriodDef[]          // type (cadence), start, end — or a cadence rule
  plan:       PlannedActivityDef[] // title, logframeCode?, start?, end?, location?, lead (text only)
  places:     PlaceDef[]           // name, adminLevel?, parentName?, pin? (only if the document states coordinates)
  funding:    FundingDef[]         // source name, amount, currency
  budget:     BudgetLineDef[]      // category, amount, currency, logframeCode? (text only)
  risks:      RiskDef[]            // kind, title, seriousness?, mitigation
}
```

Zod mirrors in `packages/contracts`. Direction / semantics of an indicator are **proposed but remain "unreviewed"** (`effectiveIndicatorSemantics`; confirming stays a person's act — never invent a direction).

---

## 6. Extraction pipeline (detail)

1. **Intake** (`ISourceDocumentReader`): reuse parsers; `assessTextExtraction` decides "readable"; unreadable = a plain refusal, nothing sent to a model. Result: `SourceBlock[]` with page numbers. Size cap (default 300 pages / 2 MB text) with a plain message.
2. **Redact** with `redactForLlm` (policy `LLM_PII_POLICY`); the grounding text is the redacted text.
3. **Outline view** of the whole document (`renderOutlineView`) used as the shared, cache-friendly prefix (byte-identical across passes for provider prefix caching; Claude gets `cache_control`).
4. **Passes** in dependency order (declared by each extractor; orchestrator topologically sorts from `SETUP_AREAS`):
   1. facts → 2. logframe → 3. indicators (given logframe codes) → 4. periods (given dates) → 5. plan (given logframe codes, dates) → 6. places (given plan locations + facts countries) → 7. funding/budget (given currency) → 8. risks.
   Independent areas (places, risks, funding) run concurrently under the provider limiter (`AI_REPORTER_MAX_CONCURRENCY`-style slot cap; **one place acquires slots**).
5. **Large documents**: each pass receives only the relevant blocks (selected by headings/keywords + the outline), chunked to the token budget; chunk results are merged by code, duplicates collapsed (same code + title).
6. **Ground** every item (`groundProposed`); drop and count the ungrounded; items keep `confidence`.
7. **Deterministic shortcuts**: spreadsheet logframes/plans/budgets go through existing parsers first.
8. **Cross-check** (`checkProposal`) → problems list (never blocks viewing; blocks Apply only for hard problems: cycle in parents, duplicate codes, end before start).
9. **Timeouts and retries**: per-call timeout, one transient retry with backoff, **a failed area leaves the others intact** and is re-runnable (`RerunSetupAreaHandler`); reasoning-model calls pass large `maxTokens` and `timeoutMs` (too small a budget returns empty content: detect and report, never silently produce nothing).
10. **Cost control**: caps (`SETUP_ASSIST_RUNS_PER_DAY`, default 10 per organisation; `SETUP_ASSIST_MAX_PAGES`), the `SETUP_OPERATION` is recorded in the LLM ledger (`llm-pricing.ts`), over the cap → `RATE_LIMITED`.

Prompt rules (all extractors): answer only from the document; JSON only; each item has a verbatim quote; use `null` for anything not stated; never compute totals; never invent codes (if absent, the **domain** assigns standard codes later by `proposeCodes`, flagged `GENERATED`, shown as such); dates ISO only when the document gives day, month and year.

---

## 7. Apply (detail)

Order (from `SETUP_AREAS`): project → logframe → indicators → periods → plan → places → funding/budget → risks.

- **Preview** (`PreviewSetupApplyHandler`): each applier's `dryRun` returns counts, skips, warnings; nothing is saved.
- **Create**: project in DRAFT status via `CreateProjectHandler` (honours entitlement project limits; a refusal is shown before anything else is applied). Optionally apply into an existing project **only when it is empty** (same rule as `CopyProjectSetupHandler`: refuses a non-empty target).
- **Per area**: the applier maps accepted items to the existing handler's input and calls it with `Idempotency-Key = setup:<proposalId>:<area>`; the existing "any bad row blocks the whole area" behaviour holds, the failure names the row, the person fixes it in the review screen and resumes.
- **Resume**: `ProjectSetupRun` rows say which areas finished; Apply skips finished ones.
- **Not applied**: indicator values, evidence, activity records. Planned activities start `NOT_STARTED`; leads are not assigned (text kept as a note); finance rows are DRAFT register entries needing a decision by someone with `finance.approve`.
- **After apply**: project setup checklist (`GetProjectSetup`) shows what the person still must confirm: indicator semantics, targets stated "Not stated", places "to confirm", budget approval.
- **Undo**: the existing demo-project delete is not reused for real projects; offer "Archive project" (existing) and state plainly that apply is not reversible area by area.

---

## 8. Security, privacy, honesty

- Opt-in and entitlements: `setupAssistEnabled` + `aiEnabled` + non-stub provider. AI credits are charged through the existing ledger.
- Redaction before the model; the same text is the grounding reference.
- The source file is stored encrypted (`EVIDENCE_ENCRYPTION_KEYS` path), kept at most 30 days, deleted on discard; never exported or sent anywhere else; never reaches a report writer.
- Tenant isolation: RLS, tenant-scoped repositories, proposal visible only to creator and `org.manage`.
- Prompt-injection: document text is data. Extractors take only schema-validated JSON; the output can only fill proposal fields; **the model has no tools and cannot trigger Apply**; text from the document is never shown as an instruction, only as quoted source (escaped).
- Audit never contains document text; logs never contain it.
- Public copy: the site says "Set it up from your project document" only after the golden corpus meets the bar in §10 and a person has checked it in a browser (AGENTS.md "public copy stays honest"). The `/security` page gets a line on this feature and what it sends to the model.

---

## 9. Batches (each ends green: build contracts → domain → application → infrastructure, then tests)

### 36.0 — Domain and contracts (no I/O)
- `contexts/project-setup/*` (§2.1) + Zod contracts + subpath exports.
- Tests: grounding table (verbatim quote, figure spelling, dates, near-miss quotes), `checkProposal` table (one row per problem code), `planApply` ordering/skips, edit-operation table, exhaustiveness of `SETUP_AREAS`.
- Done when: all pure and `test:architecture` green.

### 36.1 — Persistence, ports, orchestrator (fake extractors)
- Migration, RLS, repositories, ports, `StartSetupExtraction`, orchestrator, `Get`, `Edit`, `Discard`, opt-in handler, caps.
- Tests: orchestrator with fake extractors/LLM (order, failure isolation, rerun, background settle), repository contract tests on a scratch DB (`SETUP_VERIFY_DATABASE_URL`, opt-in like other repo tests), `rls-coverage`, `authorization-coverage`.
- Done when: a fake document yields a stored, editable proposal end to end.

### 36.2 — Extractors (the AI work)
- `ISetupLlm` adapter, prompts, eight extractors, deterministic spreadsheet shortcuts, outline prefix, chunking and merge, retry/limiter, ledger.
- Contract suite for extractors run on all eight; recorded-response fixtures (no live model in CI).
- **Golden corpus** `packages/infrastructure/test/setup-corpus/` (8–10 real, anonymised proposals: USAID, EU, FCDO-style, a UN concept note, a logframe workbook, a scanned PDF) with expected JSON; `pnpm --filter @donordesk/infrastructure setup:eval` reports per-area precision/recall/dropped-ungrounded (same pattern as `reporting:eval`).
- Done when: eval runs against the real model and the numbers are recorded in the memory bank.

### 36.3 — Appliers and apply orchestration
- Eight appliers over existing handlers, `Preview`, `Apply` (+ resume, idempotency), `CreateProject` integration, audit.
- Contract suite for appliers on all eight; a DB-backed journey test (`test:journey-db` style): fixture proposal → apply → logframe, indicators, periods, plan, places, budget exist; apply twice → no duplicates; a bad row in plan → earlier areas stay applied, resume completes.
- Done when: apply is idempotent and each area refuses bad rows with a named row.

### 36.4 — Web
- Wizard, review table, source popover, problem list, apply progress, settings toggle, entry points, four-language copy (`setup-copy.ts`, catalogue test), copy lint, mobile list, keyboard.
- Browser harness `pnpm --filter @donordesk/web test:setup-wizard` (real components, stubbed actions; ≥ 12 checks: upload → progress → edit an item → reject → problem navigation → preview → apply → resume after failure).
- Done when: harness green and `next build` clean.

### 36.5 — Hardening and release
- Adversarial documents (injection text, 400 pages, empty, scanned, wrong language, conflicting figures, duplicate codes), quota/limit tests, load of one large document, cost report per document.
- Docs: Feature spec `memorybank/Features/25-AI-Project-Setup.md`, runbook, support article draft in `_unpublished-phase36/`, AGENTS.md invariants section, memory entry.
- Deploy per §11. Real-account browser verification before any public claim.

---

## 10. Quality bar (must be met and recorded before it is advertised)

| Measure | Bar |
|---|---|
| Ungrounded items shown to a person | **0** (by construction; tested) |
| Invented figure/date in an accepted-by-default item | **0** on the corpus |
| Logframe nodes found (recall) | ≥ 90 % on structured proposals, ≥ 75 % on narrative concept notes |
| Indicator target/baseline exact-match | ≥ 90 % where the document states them |
| Activities with dates (where stated) | ≥ 85 % |
| Median review time to apply, 25-activity project | ≤ 10 minutes (observed with a person) |
| Extraction wall time, 60-page document | ≤ 4 minutes median |
| Cost per 60-page document | recorded; shown to the administrator before the run |

If a bar is missed, the UI keeps working but the area is labelled "check carefully" and public copy does not claim it.

---

## 11. Deploy

- Migration `20261101090000_project_setup_proposals` (additive, **before** the code), after a fresh backup; then `rls.sql` per table (`ProjectSetupProposal`, `ProjectSetupRun`; verify `relrowsecurity`/`relforcerowsecurity`); `/ready` requires `ProjectSetupProposal.proposalJson`, `Organization.setupAssistEnabled`.
- Env: `SETUP_ASSIST_RUNS_PER_DAY` (default 10), `SETUP_ASSIST_MAX_PAGES` (default 300), `SETUP_ASSIST_MODEL` (optional override). No new secrets.
- Ship api and web together (`SCOPE=both`). Workers unchanged (extraction runs in the api through the LLM provider).
- Feature stays off in every organisation until an administrator enables it in Settings.
- After deploy: run the corpus eval on the production provider configuration, then one real-account browser pass.

---

## 12. Risks and open decisions

| # | Risk / question | Plan |
|---|---|---|
| R1 | A confident but wrong target or date is accepted by a hurried reviewer. | Quote beside every figure, confidence from grounding, required explicit "Accept all" per area with a count of LOW items, "Not stated" highlighted. |
| R2 | Document has no codes or a different hierarchy vocabulary (Impact/Result/Activity). | `proposeCodes` (domain) with `GENERATED` flag; a vocabulary map (`LEVEL_ALIASES`) kept as one table. |
| R3 | Long proposals exceed context. | Outline + block selection + chunk/merge (§6.5); the area reports "partly read" instead of silently truncating. |
| R4 | Places the gazetteer does not know. | Proposed as text, resolved at read time, "To confirm"; never guess a pin; coordinates only if the document states them. |
| R5 | Currency and amount formats (1.234,56 vs 1,234.56). | One locale-aware amount parser in domain with an ambiguity flag; ambiguous = "Not stated" + problem. |
| R6 | Provider outage mid-run. | Per-area runs, resumable; failed area shows a plain reason and "Try again". |
| R7 | Entitlement limits (project count) hit at Apply. | Checked in Preview, refused before anything is created. |
| O1 | Create the project first, or only on Apply? | **Only on Apply** (no half-created projects while reviewing). |
| O2 | Allow applying into an existing empty project? | Yes, empty only (reuse the copy-setup guard). |
| O3 | Allow AI to propose team members? | No (names as notes only). Revisit with partner access. |
| O4 | Multi-document input (proposal + budget workbook + logframe)? | Design `sources[]` from the start (blocks carry a document id); UI ships single-document first, multi in 36.5 if time allows. |

---

## 13. Invariants to add to AGENTS.md when built

- The assistant proposes; **only Apply writes**, and only through the existing handlers; no handler other than an applier writes project records from a proposal.
- Every proposed item has a verbatim quote and passes `groundProposed`, or it is dropped; an edited item is the person's own.
- Extractors and appliers are registered in `SETUP_AREAS` and pass the shared contract suites; no code branches on an area name outside the registries.
- A missing value is "Not stated", never 0; currency is never assumed; indicator semantics stay unreviewed.
- The source document is stored encrypted, expires, and never reaches a writer, an export or a log.
