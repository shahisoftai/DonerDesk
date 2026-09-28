# DonorDesk

Agent guidance for coding on DonorDesk.

## Build / test commands
- Install: `pnpm install`
- DB migrate + seed: `pnpm db:migrate && pnpm db:seed`
- Typecheck everything: `pnpm -r typecheck`
- Build everything: `pnpm -r build`
- Run API + Web together: `pnpm dev`
- Reporting golden-corpus eval: `pnpm --filter @donordesk/infrastructure reporting:eval`
- AI Reporter 2 worker tests (Python): `cd apps/workers && .venv/bin/python -m pytest tests`
- AI Reporter 2 artifact-validator tests (TS): `node --test packages/infrastructure/test/artifact-validators.test.mjs`

## Architecture rules (Phase 1 + 2)
- Domain (`packages/domain`) is pure TypeScript — zero infrastructure deps.
- Application (`packages/application`) defines use case handlers + ports; no concrete
  adapters are imported here.
- Infrastructure (`packages/infrastructure`) implements ports (Prisma, storage,
  LLM, parsers, export builder, audit, notifications). One repository per aggregate.
- API (`apps/api`) wires routes to handlers. Routes are thin; Zod-validated.
- Web (`apps/web`) is Next.js App Router. Server actions for writes, RSC for reads.
- Workers (`apps/workers`) is FastAPI; the AI Reporter lives at
  `apps/workers/app/ai_reporter/` (12 SRP modules — `models`, `writer_contract`,
  `llm_gateway`, `outline`, `chart_suggester`, `draft_writer`, `critique_writer`,
  `refiner`, `artifact_validators`, `timeouts`, `pipeline`, `router`).

## AI Reporter 2 contracts (additive over v1)
- `GeneratedSection` carries optional `artifacts[]`, `qa[]`, `chartSpec?`,
  `deltaFromPrior?` fields (all backward-compatible with v1 generators).
- Artifact kinds: `TABLE | CHART | LIST | KEY_VALUE | QA | DELTA` (Zod schemas in
  `packages/contracts/src/reporting.ts`).
- Writer contract **v4** (report-quality v4; v2/v3 prompts byte-stable) is mirrored in
  `apps/workers/app/ai_reporter/writer_contract.py` (Python SSOT) and
  `packages/infrastructure/src/llm/ai-reporter/contract.ts` (TS mirror, generated
  from the Python lists; pinned by `test_ts_contract_mirror_is_string_identical`).
- Deterministic artifact validators live in
  `apps/workers/app/ai_reporter/artifact_validators.py` (Python, run on the
  worker before responding) and `packages/infrastructure/src/ai/artifact-validators.ts`
  (TS, run in the api on the response). Run `runAll(section, opts)` for the full set.
- Timeouts: `AI_REPORTER_DRAFT_TIMEOUT_MS=90000` per LLM call and
  `AI_REPORTER_TOTAL_DRAFT_TIMEOUT_MS=200000` per section (draft + one feedback retry),
  both enforced by `apps/workers/app/ai_reporter/timeouts.py`. The TS HTTP client uses
  `AI_REPORTER_HTTP_TIMEOUT_MS` (default 2 × draft + 30s), which must exceed the
  worker's section budget. On timeout, the section falls back to deterministic output
  and the rest of the draft continues.
- Numbers: tables, charts and deltas are built deterministically from verified
  findings (`artifact_builder.py`). The writer only writes prose. `grounding.py` /
  `number-grounding.ts` reject any number not in the inputs; percent of target is the
  only derived figure allowed. An ungrounded number that survives the retry gives
  `VALIDATOR_FAILED`, and the API uses the deterministic section.
- Synthesis sections (`isSynthesisSection`: executive summary, conclusion) are
  drafted after all other sections, from their drafted text
  (`GenerateReportDraftInput.draftedSections`).
- Editorial guidance has one source of truth: `buildSectionSpecificGuidance`
  (`llm-report-draft-generator.ts`) feeds both the legacy narrator and the AI
  Reporter brief (`sectionGuidance`).
- Typed artifact persistence: `IReportArtifactRepository` (port) +
  `PrismaReportArtifactRepository` (impl), backing `ReportArtifact` and
  `ReportArtifactRow` tables with RLS forced and `donordesk_app` DML grants.
- Feature flag: `AI_REPORTER_ENABLED=1` in `/opt/donordesk/shared/api.env` (default
  off). When off, the api uses `LlmReportDraftGenerator` for all tenants.
- Worker URL: `AI_REPORTER_URL=http://127.0.0.1:8092` (overrides the
  `HttpWorkerClient` default of `localhost:5000`).

## Architecture rules (Phase 1)
- Domain (`packages/domain`) is pure TypeScript — zero infrastructure deps.
- Application (`packages/application`) defines use case handlers + ports; no concrete
  adapters are imported here.
- Infrastructure (`packages/infrastructure`) implements ports (Prisma, storage,
  LLM, parsers, export builder, audit, notifications). One repository per aggregate.
- API (`apps/api`) wires routes to handlers. Routes are thin; Zod-validated.
- Web (`apps/web`) is Next.js App Router. Server actions for writes, RSC for reads.
- Workers (`apps/workers`) is FastAPI; it mirrors the same stub strategies so
  Kestra flows can call them.

## Conventions
- All aggregate roots carry `tenantId` (or `tenantIdValue` when persisted).
- Use the `Result<T, DomainError>` shape — no exceptions for expected failures.
- Domain events are emitted via `pullEvents()` on aggregates; the outbox pattern
  is wired in `PrismaAuditRepository.record()` (Phase 2 will promote to a real outbox).
- Every API mutation writes to `audit_events`.
- Every LLM response records `model` + `promptVersion` (ready for `llm_runs` table).

## Report section content = a fixed markdown subset (editor/export invariant)
- Section content is stored as markdown limited to what every exporter renders:
  paragraphs, `###`/`####` headings, `-`/`1.` lists, `>` quotes, GFM tables,
  `**bold**`, `*italic*`, `` `code` ``, `[label](url)`.
- `normalizeSectionMarkdown` (`packages/domain/src/contexts/reporting/section-markdown.ts`)
  runs on every manual save (`UpdateReportSectionHandler`); the rich-text editor
  (`apps/web/src/features/report-editor/rich-text/`) only enables these constructs
  and converts its output with `toStorageMarkdown` (`markdown-io.ts`).
- Adding a construct to the editor? First teach all three renderers:
  `packages/infrastructure/src/exports/markdown-renderer.ts` (DOCX/PDF),
  `apps/workers/app/donor_template/markdown_docx.py` (donor templates) and
  `StaticSectionView` — then extend the parity/round-trip tests
  (`test/export-markdown-renderer.test.mjs`, `tests/test_donor_template.py`,
  `apps/web/tests/unit/rich-text-roundtrip.test.mts`).

## Report Editor v2 invariants
- Section version = stored `ReportSection.updatedAt` (persisted by the repository); handlers
  return the version read back after assurance. Clients send it as `expectedVersion`.
- Claims are deleted and re-created by every assurance pass: never hold a claim id across a
  save/resolve/re-check — use the id returned by `resolve`. Decisions follow the fingerprint.
- `EXCLUDED` = left out: exports strip it via `omitExcludedStatements`.
- Background work started by a handler (section-wise generation, section regenerate) must go
  through the injected `BackgroundRunner`; the api awaits `container.settleBackgroundWork()`
  before disconnecting the request's Prisma client.
- Writer contract: `SectionBrief.userInstruction` (Python) ↔ `AiReporterSectionBrief.userInstruction`
  (TS) and `buildAuthorInstructionBlock` (legacy narrator) — only emitted when present.

## Prisma client vs schema drift (deploy invariant)
- The api ships `@donordesk/infrastructure`'s generated Prisma client in
  `node_modules/.pnpm/`. The `apps/api` tree has no `schema.prisma`, so
  the `@prisma/client` postinstall is a no-op there.
- `scripts/deploy-fast.sh` always re-runs
  `prisma generate --schema ${REMOTE_APP}/packages/infrastructure/prisma/schema.prisma`
  on the host (Stage B2) before restarting the api, so the running
  client is guaranteed to match the just-shipped schema.
- `apps/api/src/routes/health.ts` `/ready` endpoint introspects
  `prisma._runtimeDataModel` and asserts a small allowlist of
  `Model.field` pairs the application code relies on
  (`REQUIRED_PRISMA_FIELDS`). A 503 with `missingPrismaFields` means
  the client is stale and must be regenerated.
- **Adding a new schema column the app uses in a `select`/`create`/where?**
  Add the model+field pair to `REQUIRED_PRISMA_FIELDS` in the same
  PR. The `/ready` gate will block the deploy otherwise.

## Phase 1 deviations
Each swap point is an interface with a production target behind it. Current
state: PostgreSQL via Prisma, JWT auth, local file storage (dev default) with
Google Drive link-first primary / R2 optional via per-tenant
`Organization.storageProvider`, Kestra-or-BullMQ via `JOB_QUEUE` (memory
in-process default), stub LLM (dev default), pino logs, console email.

## Donor Template Manager v2 (2026-09-27)
- Template sections (`TemplateSection`, domain) carry the donor's `instructions`, `mandatoryQuestions`,
  `evidenceNeeded[]`, `requiredTables`, `pageLimit`, hierarchy (`parentId`/`level`/`numbering`),
  `authorInstructions` (org guidance) and `includeInReport` (guidance-only sections are excluded).
  Report-wide rules live in `TemplateRequirements` (`DonorTemplate.requirementsJson`).
- Lifecycle: `EXTRACTING → NEEDS_REVIEW → REVIEWED` (`EXTRACTION_FAILED` recoverable). Every edit is a
  new version snapshotted in `DonorTemplateVersion`. A full draft requires a REVIEWED template and pins
  it into `ReportingPeriod.templateSnapshotJson` (`PeriodTemplateResolver`); section regenerate uses the pin.
- Extraction: `FallbackTemplateExtractionService` = `LlmTemplateExtractor` (tenant LLM, source-grounded,
  ungrounded items dropped) → `HeuristicTemplateExtractor` (outline-based; `CANONICAL` outline is always
  flagged). Structured parsing: `packages/infrastructure/src/parsers/structured/`.
- `ReportPlanner.toPlanSection` carries donor fields into the plan; both writers render them only when
  present (legacy `buildSectionGuidance`, AI Reporter `SectionBrief.donorInstructions/requiredTables/
  authorInstructions/pageLimit` + `ContextTemplate` requirement lists — Python and TS kept in lockstep).
- Deploy: apply migration `20260927150000_donor_template_manager_v2`, then re-run `infra/postgres/rls.sql`.

## Template extraction v2 — table of contents first (2026-09-28)
- `TocTemplateExtractor` (`template-extract-v2`, default) = pass 1: one call over a condensed view of the
  WHOLE document (`renderOutlineView`) returns the TOC (≤ 4 levels) as block indices; `validateToc` grounds
  titles, orders entries and makes levels contiguous. Pass 2: guidance per group of top-level branches
  (`summary` → `TemplateSection.description`, plus instructions/questions/tables) + report-level requirements.
  A failed pass-2 call keeps the outline and uses `analyzeSection` for that part. `TEMPLATE_EXTRACTION_PROMPT=v1`
  restores `LlmTemplateExtractor`.
- Reasoning models spend thinking tokens from `max_tokens`: extraction calls pass large `maxTokens` and a
  per-call `LLMCompletionInput.timeoutMs` (adapters use the longer of it and the provider timeout). Too small a
  budget returns empty content and silently falls back to the heuristic extractor.
- Heading levels from formatting: templates without heading styles carry `DocumentBlock.style`
  (`docx-styles.ts` reads run size/bold/colour from the DOCX XML; PDFs give font size), and
  `assignLevelsFromStyle` nests each heading under the nearest more prominent one. Only used when all
  headings share one level.
- Report sections keep the hierarchy: `ReportSection.level/numbering/templateSectionId` (migration
  `20260928120000_report_section_hierarchy`), set by `planHierarchy` in `GenerateReportDraftHandler`. The
  parent is implicit (nearest earlier section one level up). The workspace outline (`outline-tree.ts`,
  `OutlineNav`) and exports (Heading 2–5) render it; `sectionTitle` still starts with the donor numbering.
