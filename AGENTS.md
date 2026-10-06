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
- Provider pacing (`apps/workers/app/ai_reporter/provider_limiter.py`): a process-wide slot
  cap (`AI_REPORTER_MAX_CONCURRENCY`), optional `AI_REPORTER_RPM`, and a shared cooldown after
  any 429. `run_with_section_timeout` takes the slot *before* its deadline starts and the call's
  thread releases it; the HTTP timeout is capped at the draft timeout (`http_timeout_s`), so an
  abandoned call cannot starve the queue. Never acquire a provider slot anywhere else.
- Retry policy (`pipeline.py`): transient errors retry up to `AI_REPORTER_TRANSIENT_RETRIES`
  with exponential backoff; any other error (incl. no-JSON reply) gets one plain retry; the
  feedback retry runs only for integrity issues, `MISSING_QA` and `MISSING_TABLE`
  (`AI_REPORTER_RETRY_ON_STYLE=1` also retries style issues). `draft()` makes exactly one call.
- Prompt layout: `build_user_prompt_parts` returns (report-wide prefix, section suffix); the
  prefix must stay byte-identical across a report's sections (provider prefix caching; Claude
  gets a `cache_control` breakpoint). Put anything section-specific in `_section_prompt`.
- GLM requests send `thinking: {type: disabled}` unless `AI_REPORTER_THINKING=enabled`.
- Report-type blueprints (`packages/domain/src/contexts/reporting/report-type-blueprints.ts`): with no applicable donor template a period is
  structured by its type's built-in blueprint (ACTIVITY/SITUATION accept only a template of their own type). **Never title a blueprint
  section "Overview"/"Abstract"** — worker `outline.py` treats those as Executive Summary. Scope (`ReportingPeriod.scopeJson`) drives
  activity selection, indicator scoping (`scopeIndicatorData` for generation, `periodIndicatorScope` for the indicators list,
  preflight, readiness and the scan) and the writer's `period.scope`. Blueprint titles are translated to the profile language
  but keep an English `canonicalTitle`; **any rule that recognises a section by its title must use `classificationTitle()`**
  (TS) / `brief.canonicalTitle or brief.title` (worker), never the displayed title.
- Donor attribution goes in exactly one section (`attributionSectionTitle`): the prompt names it and
  `SectionGenerationService` enforces it (`placeAttribution`). Keep the visibility block identical across sections.
- Numbers: tables, charts and deltas are built deterministically from verified
  findings (`artifact_builder.py`). The writer only writes prose. `grounding.py` /
  `number-grounding.ts` reject any number not in the inputs (a *written* date such as "20 April 2028" is grounded only by the
  same ISO date in the inputs); percent of target is the
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

## Report-type invariants (2026-10-04)
- A report is only compared with reports of its own kind: use `periodComparability` / `selectComparablePeriods` (`packages/domain/.../period-comparability.ts`) and the
  `PreviousPeriodFilter` of `findPreviousPeriods`; never take "the previous period" of any type. Match sections across reports by `sectionMatchKeys` (blueprint key,
  template id, title), not by the displayed title.
- Semi-annual / annual / final findings carry `lifeOfProject` (cumulative to date, from the indicator's own `aggregation`). Any new place that checks or grounds numbers
  (Python `grounding.py`, `number-grounding.ts`, `NumericAssertionVerifier`) must accept it, and finance figures, or assurance blocks approval.
- Finance: `ReportingProfile.financeDataMode` is DISABLED by default. **Only a VERIFIED `PeriodFinancialSummary` reaches a writer** (`FinanceInputsService.verifiedFor`);
  balance and burn rate are computed in the domain (`summarizeFinance`), never by the writer; any edit drops the verification; switching the mode off keeps stored figures.
- A report's scope is validated in one place, `ReportScopeResolver` (create and edit). Editing it marks drafted sections' assurance STALE and never regenerates.
- `ReportingPeriodRepository.update` must persist every mutable period field (it silently dropped `scopeJson` once): add new mutable fields there and to its test.
- Never run `prisma format` on `schema.prisma` (it rewrites the whole file); edit by hand.

## Claim verification and roll-up reports (2026-10-05)
- A factual/qualitative claim is verified against evidence chunks **and** the project's own records (`RecordChunkBuilder`, `recordChunksFromFindings/Finance/Evidence` in
  `packages/application/src/services/record-chunk-builder.ts`; loaded once per revision by `ReportAssuranceService`). Record chunks have `record:` ids and are **never cited as evidence**.
  New kinds of statement a report may restate (a new input to the writer) should get a record chunk, or they fail as "unsupported".
- Sentences that only disclose a gap in the report's own inputs, or describe the document, are not claims (`isDisclosureOrMeta`, `assertion-extractor.ts`); one carrying a figure always is.
- `VerifiedFinding.disaggregation` is the breakdown of **this period's** value, `lifeOfProject.disaggregation` of the life-of-project value: quote each only beside its own total.
  `MISSING_DISAGGREGATION` means required **and** not recorded. Roll-up reports (SEMI_ANNUAL/ANNUAL/FINAL) evaluate `performanceEvaluation` on the life-of-project value.
- A FINAL report is the closing period of the cadence (cadence types may not overlap; finance exists only for non-monthly, non-custom reports).
- Package tests run against `dist/`: build contracts → domain → application → infrastructure before testing, and gate deploys on a fresh green run.
- Export: only a **donor submission** needs a clean, sealed report; any draft can be downloaded as an `INTERNAL_REVIEW` export (watermark header/banner on every page). Never gate the wizard's draft path on
  preflight blockers. A re-assessment must verify against the period's evidence (`RecordChunkBuilder.evidenceIds`), not only the sources a writer cited.
- The contradiction lint accepts figures the records state (`LintGrounding`, `toLintFindingData`); a new kind of figure a report may legitimately quote must be added there, or it is a blocker nobody can clear with a note.
- Charts are derived from the tables in a section's final text (`chartsForSection`), one per table, never from "all indicators": a new kind of table that should be charted needs a classifier and builder in
  `packages/domain/src/contexts/reporting/table-charts.ts` (and a `DerivedChartBinding` + allowed types in `chart-config.ts`). Never plot a missing value as 0 or put different units on one raw axis;
  a roll-up report charts cumulative-to-date against the project target. The worker does not draw charts.

## User-friendliness invariants (Phase 23, 2026-10-05)
- **One source per rule.** Which periods may be created (`period-type-rules.ts`) is enforced by `CreateReportingPeriodHandler` *and* explained by `GetPeriodOptionsHandler`/`PeriodTypeGuide` through the same functions; never add a period rule to only one of them. The closing-report steps (`closing-report-plan.ts`) and the period checklist share `missingCumulativeFields`.
- **How an indicator is read** is `effectiveIndicatorSemantics` + `describeSemantics` (domain). The UI, the checklist (`INDICATOR_SEMANTICS_UNREVIEWED`), project-setup warnings and the closing plan all use it; confirming copies the effective semantics and never invents a direction.
- **Evidence has one linker.** `IEvidenceLinker` (`EvidenceLinkService`) is the only code that attaches/detaches a file to an activity or an indicator update. `EvidenceFile.indicatorId` = the indicator, `EvidenceFile.indicatorUpdateId` = the period value it proves. Upload/import/Drive-link call `linkOnUpload`; creating an indicator value calls `attachPendingFor`.
- **Flag classification is presentation only** (`flag-classification.ts`): it never changes `verificationResult`, the gate or approval. Unknown or missing reason codes fall to `NEEDS_DECISION`. A new `VerificationReasonCode` needs a rule (the exhaustiveness test fails otherwise) and plain-language copy (`reporting-copy.ts`, also tested). `ResolveSectionFlagsHandler` accepts only UNCONFIRMED flags, with a mandatory note, through `ResolveReportClaimHandler`.
- **Readiness** has stages (`DRAFTING | IN_REVIEW | SUBMISSION`); SUBMISSION equals the pre-Phase-23 formula and must stay golden-pinned. Advice comes from `READINESS_BLOCKER_RULES`; add a rule, do not branch.
- A new tour/help rule goes in `workflow-rules.ts` only; the tour, `/help/how-it-works` and hints read from it.
- Activity records may point at a logframe ACTIVITY node (`ActivityUpdate.logframeActivityId`); the pair with `outputId` is validated by `resolveActivityNodeLink` through `ActivityLinkResolver`. Participant-count hints (`participants-consistency.ts`) never block and never reach the writer.
- Deploy: migrations `20261006100000_evidence_indicator_update_link` and `20261006110000_activity_logframe_activity_link`; `/ready` requires `EvidenceFile.indicatorUpdateId` and `ActivityUpdate.logframeActivityId`.

## Phase 24 invariants (2026-10-07)
- **Which evidence a report covers has one rule**: `periodEvidenceMode` / `isEvidenceInPeriodScope` (domain) applied by `PeriodEvidenceScope`. Generation, readiness, the inputs panel, the export wizard and the export pack all use it; a roll-up report (semi-annual / annual / final) covers the project's evidence. Evidence linked to an activity inherits the activity's period unless one was given explicitly (`resolveEvidencePeriod`).
- **The default template per report type has one rule**: `pickDefaultTemplate` via `DefaultTemplateResolver` (period creation, closing plan, new-period form). `useBuiltInStructure` is an explicit "no template". Never read `profile.defaultTemplateId` directly to decide a period's template.
- **Writers never receive workflow state** (`WRITER_EXCLUDED_PERIOD_KEYS`, mirrored in `contract.ts`) and donor text is linted for workflow vocabulary (`WORKFLOW_VOCABULARY`). A new context field that describes the reporting workflow must not be added to a prompt.
- **Every checklist item type is classified** (`CHECKLIST_KIND`, exhaustive): STATE items close from data (`CHECKLIST_STATE_RULES`) and are not raised when already satisfied; ATTESTATION items are only ever decided by a person and a decided one is not raised again unless a different item (new title) is raised.
- **Activity status changes go through `ACTIVITY_TRANSITIONS`** in the aggregate; the UI asks `canApplyActivityAction`. Reviewer notes live at the end of the summary and are separated with `splitReviewerNotes`; they never reach a report. `isOpenActivity` decides what still needs attention (WITHDRAWN does not).
- **Indicators are retired, not deleted, once values exist** (`archivedAt`; `findByProject` hides archived unless asked). Moving or removing one is refused when an approved report used it (`IIndicatorApprovalGuard`); archived ones are listed and restored from the Logframe page (never restore beside an active indicator with the same code). Prisma `update` ignores `undefined`: write `?? null` when a field must be clearable.
- **Plain-language reasons come from one table** (`VERIFICATION_REASON_PLAIN`); a raw reason code must not appear in any user-visible string.
- **Export indicator tables are defined once** (`indicatorExportColumns` / `indicatorExportRow`): a roll-up report shows this period, life of project and % of target.
- Deploy: migrations `20261007100000_evidence_period_from_activity`, `20261007110000_indicator_archive`, `20261007120000_activity_superseded`; `/ready` requires `Indicator.archivedAt` and `ActivityUpdate.supersededById`.
