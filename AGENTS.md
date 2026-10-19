# DonorDesk

**DonorDesk Version 1.93**

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

## Phase 25 invariants (2026-10-06, partly built: see `memorybank/imp/phase25-demo-fixes.md` §0)
- **A missing value is never `0`.** Read a finding through `findingStatus` / `isReportedFinding` (`verified-finding.ts`): only REPORTED findings reach a writer, a table or an export; NOT_MEASURED / UNVERIFIED carry a placeholder `value`. A snapshot without `status` is read as reported. Exports show "Not measured" (`indicatorExportCell(row, key, { notMeasured })`); the workbook leaves the cell empty.
- **When an indicator is due** is `isDueInPeriod` / `expectedInPeriod` (`indicator-frequency.ts`): unrecognised frequency text means every period; a recorded value and the final period are always expected.
- **A section the AI did not write says why, and the reason is stored**: `ReportSection.generationFallback` is set by `ReportRevisionService.commitChange` (any write without one clears it). Reasons and their banner action live in `generation-fallback.ts` (`FALLBACK_ACTION`, exhaustive). `AiReporterDraftGenerator.generateSection` makes **at most one** automatic retry (`recoveryInput`); never add a second.
- **A stub is chosen by section kind** (`sectionKind` over `classificationTitle`, `section-kind.ts`), through an exhaustive table in `StubReportDraftGenerator`; compliance/narrative kinds write from the officer's records, never from indicator values.
- **Donor text never names an id or file name** (`INTERNAL_ID`): `find_internal_ids` (worker) and `findInternalIds` (TS) are one rule with one test table (`INTERNAL_ID_CASES`); it is an integrity issue, so it earns the retry. Indicator codes are deliberately not matched.
- **Percent of target is grounded for the period value, the cumulative value and each recorded cumulative/period achievement** (`grounding.py`, `number-grounding.ts`, `matchDerivedPercent`): change the three together.
- **Creates are idempotent by key** (`Idempotency-Key`, `RequestIdempotencyService`, scoped by tenant + user + route, 24 h; a failed create frees the key; in progress = 503 + Retry-After). Forms use `useActionState().runCreate` (repeats only "unavailable and retryable", always with the same key); `run` never repeats. A create action takes `options: CreateOptions` and forwards `idempotency(options)`. Do not use one key for something a visit may do several times (the export wizard).
- **A period is cancelled, restored or converted to Final only through `period-lifecycle.ts`** (`checkCancelPeriod`, `checkRestorePeriod`, `checkConvertToFinal`); `findByProject` hides cancelled periods unless `{ includeCancelled: true }`, so the calendar, the closing plan and comparisons never see them. `ReportingPeriodRepository.update` persists `reportType` and the cancel fields.
- **Who can sign off is `signOffRoles`** (project fields and active project members); the closing plan and the setup check both use it.
- **State checklist items close when someone reads the checklist or readiness** (`ChecklistReconciler`, `DetectMissingEvidenceHandler.handle(…, { mode: "RECONCILE" })`, audited `checklist.closed_by_data`); reading never raises items.
- **Counts are written with `countOf` / `agree` / `stillNeed`** (`core/plural.ts`); user-visible copy is scanned by `findRawTokens` (`core/copy-lint.ts`, `copy-lint.test.mts`): a label that contains a code, uuid or snake_case key fails the test.
- Deploy: migrations `20261008100000_section_generation_fallback`, `20261008110000_reporting_period_cancel`, `20261008120000_request_idempotency`, then re-run `infra/postgres/rls.sql`; `/ready` requires `ReportSection.generationFallbackReason/Detail`, `ReportingPeriod.cancelledAt/cancelReason`, `RequestIdempotency.responseJson`.
- **Compliance statements** (`StoryContext.sectionNotes`, key = template section id; `section-notes.ts`): only a donor template's compliance sections ask for one (blueprint `bp:` ids never do). `setStoryContext` replaces the context, so any handler saving the five story answers must re-supply `sectionNotes` (`UpdateReportingPeriodStoryHandler` does). The note reaches the writer only as that section's `officerNote` (worker `SectionBrief.officerNote` / TS `AiReporterSectionBrief.officerNote`).
- **Writer contract v5** is selected by `AI_REPORTER_CONTRACT_VERSION=5` (worker and API); structure and not-measured blocks are sent only then. `_WRITER_RULES_V5_ADDITIONS` is mirrored in `contract.ts` and pinned by the mirror test.
- **Default template per report type** is `ReportingProfile.defaultTemplateByType` (`pickDefaultTemplate({ explicitByType })` wins first); uploading or approving a template never changes a default.
- **Approving**: `checkApprover` (second-approver rule) is the only place that decides whether the author may approve; a self sign-off is audited `signoff.self`. Attestations (`isAttestation`) record `attestedById`; bulk attestation is `canBulkAttest` (Admin/PM) only.
- **The contradiction lint counts figures, not names**: `exemptRanges` (`contradiction-lint.ts`) skips dates, hyphenated indicator codes, ages, ids, award numbers (`72061526CA00012`) and letter-prefixed labels (`P25`). A new kind of identifier a report may quote gets a range there and a test, or it is a blocker nobody can clear with a note.
- **A form control always has a label**: `Field` names its single child control itself (generated id); never rely on callers passing `htmlFor`.
- Deploy: migration `20261008130000_phase25_remaining`; `/ready` also requires `ReportSection.summaryCurrentAt`, `ReportingProfile.defaultTemplateByTypeJson/requireSecondApprover/standingStatementsJson`, `ChecklistItem.attestedById`.

## Phase 26 invariants (demo 7, 2026-10-07)
- **The contradiction lint compares like with like.** `SAME_METRIC_DIVERGENCE` keys on the noun phrase after a figure; the phrase stops at the next figure or clause break, and participles ("targeted"), time words ("to date"), comparison words ("against"), sex groups and currency words are never a metric. A divergence finding points at a section that states one of the figures. Every occurrence of a date is exempt. A new false positive gets a regression test in `contradiction-lint.test.mjs`, never a wider exemption.
- **Writer contract v5 was what production ran until 28.9 (v6, which includes all v5 rules, from 2026-10-18).** `runtime-provisioner.ts` writes `AI_REPORTER_CONTRACT_VERSION=6` into the api and worker env on every api start (a hand edit is reverted); `deploy-fast.sh` compares the worker's running environment with `workers.env` and restarts the worker on a mismatch. v5 rules: rate indicators are never judged as percent of target; a previous value is quoted beside its own indicator; a NEUTRAL evaluation is never mentioned; monthly totals are "during the month", never "on <record date>".
- **Prose is cleaned deterministically before validation** (`scrub.py`): bookkeeping sentences ("no performance judgement", "disaggregation list") and echoed donor questions are removed; over a donor word limit after the retry, `trim_to_word_limit` drops figure-free sentences from the end (a sentence with a figure is never dropped).
- **Rates are not "% of target".** `_is_rate` (PERCENTAGE type or unit %) shows "—" in the table's % of target columns; baseline, target and change are the yardstick.
- **Outcome and output tables stay apart.** `VerifiedFinding.level` (logframe level, set by `IndicatorAnalyticsService`) travels as `logframeLevel`; `_scoped_findings` gives an outcome/impact section the GOAL/OUTCOME rows and a sibling progress section the rest. Without levels or without an outcome section every finding is shown.
- **A cause the officer's own records state is not a new decision.** `CausalReviewPolicy`: a SUPPORTED causal claim whose every cited span is a `record:` chunk (story, activity record) needs no extra human decision; anything else causal still does. Recorded breakdowns are also stated as a plain sentence ("Of the 15 staff, 11 female and 4 male").
- **Period status moves with the report**: `ReportingPeriod.advanceStatus` (forward only) is called on draft generation and approval; the reports list reads it.
- **Data can settle a few attestations** (`DATA_SETTLED_ATTESTATIONS`): a verified procurement document settles "final procurement records available". Writing-style rules from a template (`isWritingStyleRule`) are guidance for the writer, never checklist items. A figure conflict explains itself in the checks panel (`referenceFor`); "Review confidentiality" opens the period's compliance list when no single file is named.
- **An activity record may cover a span** (`ActivityUpdate.activityEndDate`, optional, never before `activityDate`; the form's "Through (optional)" with an "End of month" button). The writer receives `endDate`; the record sentence reads "from <date> to <date>"; a record with no end date and monthly totals is "during the month". Deploy: migration `20261008140000_activity_end_date` (additive, apply before the code ships); `/ready` requires `ActivityUpdate.activityEndDate`.

## Version 2.001 — simplification invariants (branch `0011-version2-simplification`)
- **Derive, don't ask.** A date's reporting period is `periodForDate` (domain) for the activity form *and* the activity import (each row by its own date; the input period is only a fallback). Never re-implement it in a component.
- **One import screen.** Logframe/indicator/evidence/activity imports are `TextImportPanel` (file, paste or dictate); a new import passes its action and item renderer, it does not copy a page.
- **Dictation is `<Textarea dictate>`** (Web Speech API, `useDictation`); it writes through the native setter, so controlled and uncontrolled fields both see it. The TipTap toolbar uses the same hook. Never add a second speech implementation.
- **Proposals fill, never overwrite, never invent.** `proposeActivityFromNarrative` (domain, pure, clock passed in) and `applyNarrativeProposal` only fill empty fields with what the words state.
- **Indicator grid suggestions** come from `indicator-entry-suggestions.ts`: `previous` (latest earlier period's value) and `aggregation` are returned by `ListPeriodIndicatorsHandler`; a running total is suggested only for SUM indicators and never replaces a typed value.
- **Project defaults** are `projectWizardDefaults` / `wizardDataFromProject` (suggestions only, every field stays free text). `planLogframeCopy` + `CopyProjectSetupHandler` copy definitions only (never values, evidence, activities, archived indicators or people) and refuse a non-empty target.
- **Offline.** Server calls go through `guardNetwork` (offline or dropped fetch = retryable `unavailable`, never an exception). A finished activity is queued in the per-user IndexedDB outbox (`features/offline`); the entry id is the create's idempotency key, progress is saved after each step, a refused entry is parked (`needs-attention`), never retried by itself. New offline-capable kinds add a sender in `OutboxProvider`.
- **Drafts.** `createDraftStore` (generic, injected storage) backs the activity form draft; the project wizard keeps its own store with a `baseline` (the defaults it was given).
- Deploy: no migration. API additions are additive (`POST /v1/projects/:id/copy-setup`, `GET /v1/users/invitations`, `limit` on `periods/create-all`, optional `reportingPeriodId` on `activities/import`, `previous`/`aggregation` on period indicator rows) - ship api and web together (`SCOPE=both`).
- Not built (needs a schema change or field testing): assigned attestations in My work, a service worker for opening the app offline, server-side readiness history.

## Phase 27 invariants (demo 8 fixes, branch `0012-demo8-fixes`, Version 2.002)
- **What the user typed when creating a report is a record.** A situation/custom/activity report's scope (event, place, dates, summary, affected-population figures with source, needs) becomes `record:scope:*` chunks (`scopeStatements`, `record-chunk-builder.ts`), so claims quoting it are supported and the contradiction lint accepts its figures. `scopeProblems` (domain) reports half-filled rows and over-long need lines; nothing the user typed is dropped silently. `eventStartDate` gives a situation report its window.
- **One sentence for a validation failure.** `describeValidationIssue` (contracts) names a known field by its label; the API title and `flattenZodFields` both use it. Add a field to `FIELD_LABELS` when a form gains one; never show a raw path.
- **A date no period covers is never assigned to a period.** The activity form starts with no period chosen and asks (with a link to create it) when the date is in none.
- **A blocker names its cause.** The confidentiality gate has two causes (`confidentialityCause`): an open checklist item (title "A confidentiality check is still open", action opens the period's checklist) and a cited restricted source. `smartReviewTarget` is the one place a Smart Review item becomes a link. `approverEligibility` (same `checkApprover` the approval enforces) decides whether the Approve button is offered.
- **Undoing an accepted activity goes through one rule.** `ACTIVITY_TRANSITIONS` allows WITHDRAW/REQUEST_REVISION/REJECT from ACCEPTED; `checkUndoAllowed` + `IActivityApprovalGuard` refuse (naming the report) when an approved report used the record. `isLiveActivity` (not WITHDRAWN) is the only counting/link-picker filter. The import column is "Logframe Code (Output or Activity)" and rows without a code are reported.
- **A draft that is stale can be rewritten, not only re-checked.** The inputs-changed banner has "Re-check statements only" and a confirmed "Rewrite affected sections" (single-section regenerate per section). `generationWarning` asks for confirmation when no indicator value is verified.
- **Per-outcome sections show their own indicators.** `VerifiedFinding.outcomeCode/outcomeTitle` (`owningOutcome`) travel to the worker; `_per_outcome_findings` matches "Outcome N" in a section title. An indicator that is not due is not "not measured" (`scopeNotMeasured`, `VerifiedFinding.frequency`). A roll-up report has no previous-period delta.
- **Finance is cumulative to the period end.** The writer block says so and amounts carry thousands separators (`_finance_block`); the entry form says "expenditure to date". Writer contract v5 gained finance, file-stem and exact-name rules (Python SSOT + `contract.ts` mirror, pinned by the mirror test); hyphenated document stems are INTERNAL_ID (Python/TS case tables in lockstep); `restore_proper_names` re-spells a mangled donor/organisation/project name exactly.
- **Exports follow the report's rules.** `isRateIndicator` (type PERCENTAGE/RATIO or unit %) shows "—" in "% of target" in the workbook as in the table. A donor-submission checklist CSV has no resolution notes (`checklistCsvLines`); the evidence pack contains the files (`EvidencePackFileLoader`, 150 MB cap, Drive/unreadable files named in the README).
- **A form is not typed into before it is ready.** `useHydrated` disables the reporting-profile form and the second-approver toggle (which saves at once and says so); the wizard labels a still-suggested sector/country (`suggestionHint`); the invite page records the Terms acceptance itself.
- Deploy: no migration, no new env. Ship api, web and workers together (`SCOPE=both`); the worker needs `outcomeCode`/`outcomeTitle` on `Finding` and the new writer rules, so restart `donordesk-workers` and confirm the contract version in `/proc/<pid>/environ`.

## Data Center (branch `0012-demo8-fixes`)
- **One sheet, one read.** `GetProjectDataSheetHandler` returns all non-cancelled periods, live indicators, every recorded value and (only when `financeDataMode` is on, and only for quarterly-or-longer periods) finance figures. Rows, pivot, CSV and the import preview are pure functions in `packages/domain/src/contexts/reporting/data-sheet.ts`; a missing value is `""`, never `0`, and a rate has no "% of target".
- **Editing is deep-linked, not inline**: the page links to the period's Inputs page. The only bulk write is the import, which goes through `BulkUpsertIndicatorUpdatesHandler` per period (closed periods refused, audited). An empty cell in an uploaded file never clears a stored value; any row with a problem blocks the whole import. Imported values arrive as drafts.
- **Charts are specs, not stored data**: `buildDataChart(sheet, spec)` (`data-charts.ts`) draws through `optionForType`; each template lists the chart types that suit it (`DATA_CHART_TEMPLATES`). Different units never share a raw axis (drawn as % of target with a note), rates are left out of progress charts, gaps are `null`. A new template needs a case in `buildDataChart` and a test in `data-center.test.mjs`.
- Not built: saving a chart spec or inserting a Data Center chart into a report section (report charts are still derived from section tables).
- Deploy: no migration, no env. Ship api and web together; new routes `GET /v1/projects/:id/data-sheet`, `GET …/data-sheet/export`, `POST …/data-sheet/import` (multipart `apply` then `file`).

## Data Center charts in reports (Phase 4)
- A chart added from the Data Center is a stored `CHART` artifact whose payload carries `dataCenter { id, spec, builtAt, points, unverified, notes }` plus the dataset it drew (`dataBinding: "DATA_CENTER"`, which keeps its chart type: no coercion). `isDataCenterChart` marks it; **table-derived charts are rebuilt on every text save, these are not** (`SectionChartService.refresh`, `SectionGenerationService` keep them via `dataCenterChartsToKeep`). Artifact ids change on every `replaceForSection`: identify a chart by `dataCenter.id`.
- `SectionDataChartsHandler` (list/add/update/refresh/remove/move) follows the text-edit rules: the draft must be `DRAFT` and not superseded; an approved section is reopened. A chart is a snapshot: `stale` is computed on read by redrawing from its spec; only Update (or an edit) changes it.
- Draft values are plotted on purpose (user decision), with `unverified/points` stored, a note under the chart in the report, a badge in the chart panel and the non-blocking export-preflight warnings `DATA_CHARTS_OUT_OF_DATE` / `DATA_CHARTS_UNVERIFIED`. The exported image itself carries no such note.
- Not covered: the donor-template (Python) Word export draws no charts at all (table-derived ones included).
- Deploy: no migration. Routes `GET/POST /v1/report-sections/:id/data-charts`, `PUT/DELETE …/:chartId`, `POST …/:chartId/refresh|move`; permission `report.edit`.

## Data Center tables in reports
- The section editor's "Insert table from data" (`DataTableDialog`, only when `projectId` is passed to `RichSectionEditor`) builds a GFM table with `buildDataTable` (`packages/domain/.../data-tables.ts`) from the Data Center sheet and inserts it after the cursor's block. It is a **snapshot of ordinary section text** (no artifact, no stale tracking): editing, claim checks, exports and table-derived charts treat it like any typed table. The summary layout's headers (`Code`, `Target`, `Cumulative…`, `% of target`) are deliberately recognised by `classifyTable`, so it is charted; keep them in step.
- A gap is "Not measured", never 0; a rate shows "—" for % of target. A cell never contains `|` (the editor's parser does not read `\|`): it is written as " / ". Pinned by `data-center.test.mjs` and the corpus in `rich-text-roundtrip.test.mts`.
- Deploy: web only, no migration, no API change.

## Phase 28 invariants — programme management (Batches 28.0–28.9, branch `0013-programme-management`, Version 2.005)
- **Two nouns, never mixed.** A *planned activity* is work planned ahead (`PlannedActivity`, `packages/domain/src/contexts/workplan/`); a *completed activity* is the entry made after doing it (`ActivityUpdate`); a *request* and a *milestone* are the other two. All user copy comes from `workplan-copy.ts`, scanned by `findRawTokens` and `findForbiddenWorkplanTerms` (no "record" for an entry, "baseline", "delivery state", "series", "assignment", "subject").
- **Delivery state is derived, never stored.** `deliveryState(item, facts, today)` (ordered `DELIVERY_STATE_RULES`) → `deliverySignal` (On time / Late / Done / Cancelled) + `deliveryReason`. `toWorkPlanRow` (application) is the **one** place a row is built, so the project plan and My week cannot disagree about "late". A milestone is a planned activity with start = end and goes through the same table, no special case.
- **Status changes follow one table**: `PLAN_STATUS_TRANSITIONS` / `canApplyPlanAction` (the aggregate enforces it, the UI asks it). Completed activities only *suggest* a status (`suggestPlanStatus`); a person confirms. Cancelling needs a reason.
- **Plan dates are plain days** (`plain-date.ts`, `YYYY-MM-DD`, stored as `DATE`). Never build a plan date from `new Date(string)` in local time; use `toPlainDate`/`addDays`/`daysBetween`. `originalStart/originalEnd` are set once and never change ("moved from …"); there is no baseline step.
- **Who may do what is one function**: `canActOnPlanItem(actor, item, action)` (`PLAN_ITEM_ACTION_RULES`, exhaustive). Handlers load through `PlanAccess.load`; the web asks the same function. Only manager-only routes are in `middleware/authorization.ts`; item-level routes (status, update) are **deliberately not** there because a lead without `workplan.manage` may use them. Web capabilities mirror domain permissions (`workplan.manage`, `workplan.update-own`).
- **Every plan change is a revision and an audit event** through `PlanRecorder` (append-only `PlanRevision`; the reasons are the project's decision history). "Why?" is asked only when `reasonRequired` (original end passed, or a report covers it); the list read model carries `reasonRequired` per row from one query (`reportCoveredRanges`).
- **Repeats are real rows** (`expandRecurrence`, cap 120, `createMany` is one statement so a series or the wizard plan is created all or not at all). Moving "this and later ones" keeps each later row's distance from the one moved.
- **A completed activity links to a planned one through `resolvePlanLink` / `PlanLinkResolver`** (same project; same logframe activity when both name one; an empty logframe link is filled, never overwritten). `ActivityUpdate.plannedActivityId` is persisted by `PrismaActivityUpdateRepository` create **and** update.
- **Start from my logframe**: dates come from `proposePlanDates` (one rule); a row switched to Monthly clears its own dates so the server's monthly proposal applies. `apply: false` previews and saves nothing; the wizard refuses a project that already has planned activities.
- **Import = `parseWorkPlanText` + `ImportWorkPlanHandler`.** Any bad row blocks the whole import and names its row; exact repeats (title + dates) are skipped. Do **not** `trim()` a line before splitting (a leading empty cell would shift every column); `splitDelimited`/`normalizeHeader` live in `core/delimited.ts` and are shared with the activity parser.
- **Copying a project's setup can copy its plan** through its own `CopyWorkPlanHandler` (not by growing `CopyProjectSetupHandler`): logframe activities are matched by code, dates move with the new project's start, leads/statuses/completed activities are never copied, and a non-empty target plan is refused.
- **"Show work planning"** (`Project.showWorkPlanning`, Admin only via `SetWorkPlanningVisibilityHandler`): off hides every plan screen and keeps the data. `activitiesTabMode` (pure) decides the Activities tab and is pinned by a test for every role: a project without a plan, and a project with planning hidden, look exactly as before. **`PrismaProjectRepository.update` must write `showWorkPlanning`** (it once did not; a persistence test now pins it).
- **Roles see only their own buttons** (hidden, not disabled): `ROLE_SURFACES` (exhaustive over `Role`), `BUTTON_CAPABILITY`, `showsButton`; a test pins that no surface offers a button its capabilities lack. `ROLE_SURFACES[role].home` decides the Home landing (field officer → My week); a later batch adds rows, never branches.
- **A Server Component never passes a function to a Client Component** (it fails at render, not at compile or build). Pass ids, booleans and strings (`changeableIds`, `movableIds`). `tests/unit/server-client-boundary.test.mts` fails any non-client `page.tsx`/`layout.tsx` that does.
- **Timeline/drag/calendar/My-week layout is pure** (`timeline-layout.ts`, `timeline-drag.ts`, `calendar-layout.ts`, `my-week.ts`, `delivery-overview.ts`): no React, no clock (today is passed in), table-tested. Nothing is saved until Save in the confirm bar; the keyboard does the same (←/→ a day, Shift+←/→ the end). Done and cancelled activities and people who cannot move have no drag handles. The Timeline is not offered under 640 px; the List is shown.
- **My week is always the caller's own** (`GetMyWeekHandler` takes no user id; `GET /v1/me/week`). It appears on Home only for a role that lands on it **and** only once the person has planned work (`shouldShowMyWeek`). Status changes made offline are kept in the outbox as kind `plan-status` (`createPlanStatusSender`); a change the server later refuses is parked, never retried by itself.
- **Architecture is tested, not trusted**: `test/architecture-boundaries.test.mjs` (`pnpm test:architecture`, part of `pnpm test`) fails if domain imports outside itself, application imports infrastructure/Prisma/Next, or a web `features/*/domain` module imports React/Next/server code. Exhaustive tables are checked with `assertExhaustive(table, keys)`.
- **Overview cards** (`PlanOverviewCards`, only when a plan exists and planning is shown): plain counts (no health band or score until Batch 28.4) and, per output, activities done of planned beside the indicator's latest % of target (`outputProgress`; a rate has none, an unrecorded value is absent, never 0).
- **Repository contract tests need a real Postgres and are opt-in**: set `WORKPLAN_VERIFY_DATABASE_URL` to a scratch database that has had `prisma migrate deploy` and `infra/postgres/rls.sql` (with a `donordesk_app` role) applied; without it they skip. See the scratch-DB note in the memory bank. Never run `prisma format`.
- **Deploy** (deployed 2026-10-18, `releaseId=20261018172624`, `SCOPE=both`): migrations `20261019100000_work_plan`, `20261019110000_project_tasks`, `20261019120000_reminders`, `20261019130000_risk_register` (all additive, applied by hand as `donordesk_migrator` before the code), then re-run `infra/postgres/rls.sql` (adds `PlannedActivity`, `PlanRevision`, `ProjectTask`, `ReminderLedgerEntry`, `ProjectRisk`; RLS forced), then `deploy-fast.sh`. `/ready` requires `ActivityUpdate.plannedActivityId`, `PlannedActivity.plannedEnd/ownerUserId/originalEnd/requiredFiles`, `Project.showWorkPlanning`, `ProjectTask.assigneeId`, `ProjectRisk.ownerId`, `Organization.timeZone`. The reminders script is **not** shipped by `deploy-fast.sh`: `install -m 0755 scripts/run-reminders.sh /opt/donordesk/shared/bin/`, copy `infra/systemd/donordesk-reminders.{service,timer}` to `/etc/systemd/system/`, `systemctl daemon-reload && systemctl enable --now donordesk-reminders.timer` (runbook `memorybank/docs/runbooks/reminders.md`). Routes: see `memorybank/Features/23-Work-Plan.md` and `24-Programme-Management.md`.
- **Public copy stays honest**: the site says "Set it up", not "Plan it", until the features are checked in a browser with the user's account (plan §12). Support-article drafts live in `memorybank/docs/support/_unpublished-phase28/` and are registered (`FILE_MAP` + `wikiCategories.tsx`) only when published.
- **One assignment queue, many sources (28.3).** What a person "has to do" is the union of `IAssignmentSource`s composed by `AssignmentQueue` (plan items, tasks/requests, checklist items, report deadlines, evidence review, activity review, activity fix, indicator values due, risk reviews). A new kind of work is a new source plus one row in `TASK_KINDS`/`ASSIGNMENT_KINDS`; every source passes the shared contract `test/support/assignment-source-contract.mjs`. `TaskReconciler` closes STATE tasks from data; a request (`ProjectTask`) is for one person, due on one day, closed by the work being done (never by a button when data can say so). Who may be asked is `Permissions` + `TASK_KINDS[kind].requires`, never a web-side table.
- **Reminders without setup (28.5).** One hourly timer calls `POST /internal/reminders/run` per organisation (HMAC-signed like Kestra's calls); the API acts only in an organisation's own 07:00 hour (`Organization.timeZone`), sends **one** summary per person (`ReminderPlanner`, pure) and escalates a late item once after 7 days; `ReminderLedgerEntry` makes a repeat run a no-op. People choose `notificationEmailMode` (always / only urgent / never); the in-app note is always written (`PersonNotifier`). The old deadline-reminder handler is gone; `/internal/reminders/deadline` is a thin deprecated alias.
- **Delivery health and risk snapshots (28.4).** `deliveryHealth`/`healthBand` (domain) give a project one of three plain labels from late plan items and overdue indicator values (`indicator-collection.ts`: `collectionDue`); a "behind target" signal is deliberately **not** part of it (per-period analytics own that). `ProjectHealthService` feeds the risk-trend snapshots (`plan_slip`, `value_overdue` factors). `indicatorEntryDueDays` is read-only (no UI yet).
- **Files the work needs (28.6).** `PlannedActivity.requiredFiles` are suggested from the title (`suggestRequiredFiles`), never block anything, and coverage is `evidenceCoverage` over the linked completed activities' files; accepting without them asks one question ("Accept anyway"). Wording: `file-needs-view.ts` (acronym kinds keep their capitals).
- **Problems and risks (28.7).** `ProjectRisk` has four fields people fill (kind, title, seriousness, action) plus an optional owner; one list on the project Overview, never on the writer path (**risks never reach a report writer**). `reviewByFor` sets a 30-day review date; `canActOnRisk` is the one permission function; closing records how it ended.
- **Comments where the work is (28.8).** `COMMENTABLE_ENTITIES` (domain) is the one table of what carries a comment and who is told ("MENTIONS" or "PEOPLE" = the owners too); `ICommentTargets` resolves a thing inside the organisation (an unknown or other-tenant id is a NOT_FOUND, nothing is saved); the author is never told and nobody twice. A comment surface is `CommentsDisclosure` ("Add a comment" until opened).
- **Reports read the plan (28.9).** `summarizePlanDelivery` (domain, pure) is the one rule for "planned / held / not held / moved / cancelled" in a period (an activity counts in the period of its **planned end**; cancelled ones are counted apart); `PlanDeliveryService` adds the recorded reasons. It reaches: the writer as `context.deliveryPlan` (**counts and the officer's recorded reasons only**; no names, statuses or workflow words), claim verification and the contradiction lint as `record:plan:*` chunks (`RecordChunkBuilder`, never cited as evidence), "Suggested from your plan" on *Tell the story* (`suggestStoryFromPlan`; fills only empty fields), and one non-blocking readiness advice rule (`plan`, 1 point so it never moves a score, only when `plannedNotHeld` is supplied: never in SUBMISSION). **Writer contract v6** (`_WRITER_RULES_V6_ADDITIONS` ↔ `WRITER_RULES_V6_ADDITIONS`, pinned by the mirror test; v5 byte-stable) is selected by `AI_REPORTER_CONTRACT_VERSION=6`, which `runtime-provisioner.ts` now writes. Numbers in `deliveryPlan` are grounded by the existing request walk (Python `allowed_numbers`, TS `allowedNumbers`); a project without a plan sends nothing.
- **Consent from every place (demo 9 fix).** The legal-consent route validates with `RecordConsentSchema` (contracts, `CONSENT_SOURCES`); every `source` the web sends must be listed there (the invite page's `invitation` was once rejected and the failure swallowed, leaving invitees stuck on onboarding).
- **Plan link suggestions rank by owner, logframe activity, typed-title match, then date** (`suggestPlanLinks`); the form also passes the title typed so far.
- **Not built (Phase 29 or later)**: budget lines, offline app opening, partner access; saving the indicator-entry due days; moving a planned activity's logframe link after creation; series-wide lead change; a completion date for backfilled activities.
