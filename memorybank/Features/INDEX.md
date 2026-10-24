# DonorDesk Features Index

**DonorDesk Version 2.007**

This directory contains detailed documentation for DonorDesk's features: 01–21 are the MVP and its first additions, 23–25 are the programme-management batches, and 26–42 are the October 2026 audit and gap-closure batches (listed in the second table below).

> **Introduced in DonorDesk Version 1.93:** built on branch `0009-agent-memory`. Feature 21
> (Agent Memory) is this release's headline addition — see
> [`21-Agent-Memory.md`](./21-Agent-Memory.md) and
> [`../imp/Phase21-agent-memory.md`](../imp/Phase21-agent-memory.md).

> **Frontend status:** Portal UI for these features is implemented across Phases 0–7
> of `../imp/frontend-imp-plan.md` (reports `../imp/PHASE*-FRONTEND-REPORT.md`).
> Frontend routes live under `apps/web/src/app/(portal)/`. Backend/async statuses
> below are unchanged by the frontend work — see `../pending.md` for remaining deps.
>
> **2026-08-16:** Feature 06 indicator data entry is fully implemented — per-reporting-period
> spreadsheet grid, bulk upsert, unique (indicator, period), per-row verify, and Google
> Sheets import. **2026-08-17:** logframe Excel/CSV/TXT import now auto-parses into
> structured `LogframeItem` records (parent resolution + code dedup). See
> `06-Logframe-And-Indicator-Manager.md` and `pending.md`.
> **2026-08-17 (AI + charts + SuperAdmin billing):** real LLM report drafting is
> LIVE via the SuperAdmin-configured MiniMax provider (STARTER/TEAM/GROWTH/
> ENTERPRISE AI-credit quotas enforced; stub-fallback never billed), user-selectable
> report charts (BAR/LINE/PIE/AREA/RADAR/GAUGE per section, exported identically to
> DOCX/PDF via ECharts SSR→PNG), and the SuperAdmin **Billing & credits** section
> (per-tenant allowance Set/Increase/Reduce + reset month usage). **2026-08-17
> (report data completeness):** AI reports now fully reflect saved project data —
> real evidence document text is persisted (`EvidenceFile.extractedText` via the
> Tika `evidence_parse` flow) and chunked into evidence packages, and the
> generation input carries activity narratives + indicator-update comments/
> dataSource; generated sections carry evidence/activity/indicator source
> references and statement-level sources render in the workspace. See
> `11-AI-Report-Draft-Generator.md`, `07-Evidence-Library.md`,
> `14-Export-Module.md`, `19-Tiers-And-Payments.md`, `20-report-gen.md` §15,
> `../imp/LLM-PROVIDER-WIRING.md`, `../Fixes.md`, and `../SUPERADMIN-PORTAL.md`.
> **2026-08-18 (professional report generation, release `20260818074405`):**
> verified findings now carry indicator names/types/baselines/targets, the
> previous-period `comparisonValue` (was computed but dropped), and a
> deterministic `performanceEvaluation`; the narrator prompt gains project/
> reporting-period/donor-template context blocks, per-section guidance
> (input type, mandatory questions, evidence needs, word limits), indicator
> target + period-on-period narration, evidence metadata, participant
> disaggregation, explicit quality-flag caveat language, and a worked example;
> evidence chunks raised 3×600 → 8×800 chars (`maxTokens` stays 4096 for the
> MiniMax timeout constraint). See `11-AI-Report-Draft-Generator.md`,
> `20-report-gen.md` §16–17, `../Fixes.md`, and `../contabo-ops.md` §26.
> **2026-08-19 (professional donor-reporting hardening, release
> `20260819090000`):** the `../imp/PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md`
> (Phases 0–9, status **IMPLEMENTED**) ships revision-bound assurance
> (`ReportRevision` + single mutation pipeline), complete assertion coverage
> (empty writer claims cannot bypass), structured numeric/period/entity/unit/
> derivation verification, evidence hash/chunk/source-text integrity +
> entailment + causal human-review policy, requirement packs with deterministic
> precedence + `IRequirementEvaluator`, `SubmissionSnapshot` sealing, ONE gate
> evaluator (approval/preflight/submission/export), export intent
> (watermarked internal vs snapshot-bound donor submission), coverage-gap
> checklist projection, neutral rewrite prompts, golden corpus + `reporting:eval`
> + verifier contract suite, and ADRs 0005–0009. Migration
> `20260818180000_professional_reporting` includes a baseline-revision backfill.
> See `20-report-gen.md` §18 and `../contabo-ops.md` §26.
> **2026-08-28 (AI Reporter sidecar):** a new multi-step, evidence-grounded
> report-writing pipeline behind the same `IReportDraftGenerator` port
> (feature-flagged `AI_REPORTER_ENABLED`): Python worker (`apps/workers/app/
> ai_reporter.py`) runs a **draft → critique → refine** loop (LangGraph) under a
> versioned writer contract; **pgvector semantic retrieval**
> (`embedding` column on `EvidenceEmbedding`, HNSW cosine index, OpenAI/Ollama
> embedding generators, `SemanticEvidenceRetriever`, `embedding:backfill` CLI);
> and **prior-period intelligence** (`DeterministicPriorPeriodService`) keeps the
> writer consistent with previously approved narrative. Golden corpus grown to 8
> cases with a `repetition` qualitative metric. Full detail:
> `../imp/AI-REPORTER-IMPLEMENTATION-PLAN.md` (status IMPLEMENTED).

## Features

| # | Feature | Status | Key Files |
|---|---------|--------|-----------|
| 01 | [Authentication and Onboarding](./01-Authentication-And-Onboarding.md) | Implemented | `packages/domain/src/entities/User.ts` |
| 02 | [Organization Workspace](./02-Organization-Workspace.md) | Implemented | `packages/domain/src/entities/Organization.ts` |
| 03 | [User and Role Management](./03-User-And-Role-Management.md) | Implemented | `packages/domain/src/entities/User.ts`, `packages/application/src/permissions/` |
| 04 | [Project Setup](./04-Project-Setup.md) | Implemented (per-project Team + full Settings editor 2026-08-16) | `packages/domain/src/entities/Project.ts` |
| 05 | [Donor Template Manager](./05-Donor-Template-Manager.md) | v2 implemented and verified live 2026-09-27/28 (LLM extraction with heuristic fallback, structure-preserving DOCX/PDF/XLSX/CSV parsing, lifecycle + versioning, donor instructions reach the AI writer) — see [`05-Donor-Template-Manager-Plan.md`](./05-Donor-Template-Manager-Plan.md) and [`../demo/verification-demo-1.md`](../demo/verification-demo-1.md) | `packages/domain/src/contexts/templates/donor-template.ts` |
| 06 | [Logframe and Indicator Manager](./06-Logframe-And-Indicator-Manager.md) | Implemented (data entry 2026-08-16) | `packages/domain/src/contexts/logframe/`, `packages/application/src/use-cases/logframe/`, `packages/application/src/ports/logframe.ts`, `apps/api/src/routes/logframe.ts`, `apps/api/src/routes/reporting.ts`, `apps/web/src/features/reporting/presentation/IndicatorEntryGrid.tsx`, `apps/web/src/app/(portal)/projects/[id]/reports/[periodId]/indicators/page.tsx` |
| 07 | [Evidence Library](./07-Evidence-Library.md) | Implemented (real extracted text persisted for search/reporting 2026-08-17) | `packages/domain/src/entities/EvidenceFile.ts` |
| 08 | [AI Evidence Tagging](./08-AI-Evidence-Tagging.md) | Orchestrated (heuristic tagger; real AI provider is a stub) | `packages/infrastructure/src/llm/evidence-tagger.ts`, `packages/contracts/src/strategies/heuristic-rules.json` |
| 09 | [Activity Update Capture](./09-Activity-Update-Capture.md) | Implemented | `packages/domain/src/entities/ActivityUpdate.ts` |
| 10 | [Reporting Period Manager](./10-Reporting-Period-Manager.md) | Implemented | `packages/domain/src/entities/ReportingPeriod.ts` |
| 11 | [AI Report Draft Generator](./11-AI-Report-Draft-Generator.md) | Implemented (real LLM via SuperAdmin MiniMax config; full evidence/activity/indicator context 2026-08-17; professional context — indicator metadata/targets, project/period/template, performance gating 2026-08-18; **AI Reporter sidecar — draft/critique/refine + pgvector semantic retrieval + prior-period intelligence — 2026-08-28**) | `packages/infrastructure/src/llm/llm-report-draft-generator.ts`, `packages/infrastructure/src/llm/report-draft-generator.ts`, `packages/infrastructure/src/llm/ai-reporter-draft-generator.ts`, `packages/infrastructure/src/llm/semantic-evidence-retriever.ts`, `packages/infrastructure/src/llm/embedding.ts`, `apps/workers/app/ai_reporter.py`, `packages/infrastructure/src/llm/factory.ts`, `packages/infrastructure/src/llm/llm-config-resolver.ts`, `packages/infrastructure/src/ai/evidence-package-builder.ts`, `packages/application/src/use-cases/reporting/generate-report-draft.ts`, `packages/domain/src/contexts/reporting/verified-finding.ts`, `packages/domain/src/contexts/reporting/indicator-calculator.ts` |
| 12 | [Missing Evidence and Compliance Checklist](./12-Missing-Evidence-And-Compliance-Checklist.md) | Implemented (auto-generation, templates, bulk ops 2026-08-16) | `packages/domain/src/entities/ChecklistItem.ts` |
| 13 | [Review and Approval Workflow](./13-Review-And-Approval-Workflow.md) | Implemented | `packages/domain/src/entities/Comment.ts` |
| 14 | [Export Module](./14-Export-Module.md) | Implemented (report charts embedded in DOCX/PDF 2026-08-17) | `packages/infrastructure/src/export/`, `packages/infrastructure/src/exports/chart-png-renderer.ts` |
| 15 | [Dashboard](./15-Dashboard.md) | Implemented | `apps/web/src/app/(portal)/dashboard/page.tsx` |
| 16 | [Audit Log](./16-Audit-Log.md) | Implemented | `packages/domain/src/entities/AuditLog.ts` |
| 17 | [Basic Settings](./17-Basic-Settings.md) | Implemented | `apps/web/src/app/(portal)/settings/` |
| 18 | [Project Creation Wizard](./18-Project-Creation-Wizard.md) | Implemented (release `20260815054218`) | `packages/application/src/readiness/project-readiness-service.ts`, `packages/infrastructure/src/storage/project-workspace.ts`, `packages/infrastructure/src/storage/workspace-router.ts`, `apps/api/src/routes/project-setup.ts` |
| 19 | [Tiers and Payments](./19-Tiers-And-Payments.md) | Implemented — AI-credit quotas + SuperAdmin credit/tier management (2026-08-17); **Creem live in test mode, Phase 4 reconciliation, webhook tenant resolution, `/thanks` + `/checkout` flow, trial removal (2026-08-18)** | `packages/domain/src/contexts/billing/`, `packages/application/src/ports/billing.ts`, `packages/application/src/services/entitlement-service.ts`, `packages/application/src/services/billing-subscription-synchronizer.ts`, `packages/application/src/use-cases/billing/`, `packages/infrastructure/src/billing/`, `packages/infrastructure/src/repositories/billing.ts`, `apps/api/src/routes/billing.ts`, `apps/api/src/routes/webhooks.ts`, `apps/api/src/routes/internal.ts`, `apps/api/src/routes/superadmin.ts`, `apps/web/src/app/checkout/`, `apps/web/src/app/thanks/` |
| 21 | [Agent Memory](./21-Agent-Memory.md) | **Introduced in Version 1.93.** Implemented on branch `0009-agent-memory` (not yet merged to `master`) — learns tenant/donor narrative style and terminology from reviewer edits to AI-drafted sections, subject to human approval; never learns facts/figures (three independent guard layers); two-flag gated (`AGENT_MEMORY_ENABLED` platform + self-service "AI Writing Style" Settings tab) | `packages/domain/src/contexts/memory/agent-memory.ts`, `packages/application/src/ports/agent-memory.ts`, `packages/application/src/use-cases/memory/`, `packages/infrastructure/src/repositories/agent-memory-repository.ts`, `packages/infrastructure/src/memory/deterministic-memory-extractor.ts`, `apps/api/src/routes/agent-memory.ts`, `apps/web/src/app/(portal)/settings/ai-style/` — see [`../imp/Phase21-agent-memory.md`](../imp/Phase21-agent-memory.md) |
| 22 | [DonorDesk Academy](./22-DonorDesk-Academy.md) | Guided tour and demo project are in the app (`/tour`, `/help/how-it-works`, the Academy demo project; the demo's first quarter is [Feature 42](./42-Demo-Project-Content.md)). The design doc is kept as the record of the plan | `apps/web/src/features/tour/` (new), `apps/web/src/features/onboarding/`, `packages/infrastructure/src/db/seed-eerp.ts`, `packages/application/src/services/entitlement-service.ts` |
| 23 | [Work plan](./23-Work-Plan.md) | **Deployed 2026-10-18 (Batches 28.0–28.2; demo 9)** — planned activities inside the Activities tab, Start-from-logframe wizard, import, List and Timeline (drag to reschedule), My week for field officers, Overview cards, "Show work planning" setting; plan-link on completed activities | `packages/domain/src/contexts/workplan/`, `packages/application/src/use-cases/workplan/`, `packages/infrastructure/src/repositories/workplan.ts`, `apps/api/src/routes/workplan.ts`, `apps/web/src/features/workplan/` — see [`../imp/phase28-new-management.md`](../imp/phase28-new-management.md) |
| 24 | [Programme management](./24-Programme-Management.md) | **Deployed 2026-10-18 (Batches 28.3–28.9; demo 9)** — requests and My Work by person, Team tab, reminders (daily summary, escalation), delivery health, files the work needs, problems and risks, comments, reports that read the plan (writer contract v6) | `packages/domain/src/contexts/{tasks,risks,workplan}/`, `packages/application/src/{services,use-cases}/`, `packages/infrastructure/src/repositories/`, `apps/api/src/routes/tasks.ts`, `apps/web/src/features/tasks/`, `apps/workers/app/ai_reporter/` — see [`../imp/phase28-new-management.md`](../imp/phase28-new-management.md) §15 |

## Status Legend

- **Implemented**: Feature complete and functional
- **Partial**: Partially implemented, some components missing
- **Stub**: AI/business logic uses temporary stub implementations
- **Not Implemented**: Not yet started

## Common Async / AI Status (2026-08-13)

These items affect multiple features and are tracked in `memorybank/pending.md` and
`memorybank/contabo-ops.md`:

1. **Job queue — WIRED.** `createJobQueue(logger)` supports `memory` (default) /
   `redis` (BullMQ adapter over `PriorityJobQueue`) / `kestra` (Kestra flow trigger),
   behind a single `IJobQueue` port, plus a `JobDispatcher` and an `OutboxEventBus`
   mapping domain events → jobs. Writes are idempotency-keyed (`IdempotencyRecord`;
   migration `20260813000000_idempotency` applied in production).
2. **Kestra orchestration — Phases A–D implemented and DEPLOYED** (release
   `20260813064828`). `donordesk-workers` (127.0.0.1:8092) and `donordesk-kestra`
   (127.0.0.1:8093) are prepared with systemd units but **not enabled** (gated).
3. **LLM Provider — still a stub.** All AI features use the deterministic
   heuristic tagger/polisher; real providers are a `LLM_PROVIDER` swap point.
4. **Evidence storage — Google Drive (link-first) implemented; R2 tier present.**
   Per-tenant `storageProvider` (`GOOGLE_DRIVE`/`R2`/`LOCAL`) via
   `EvidenceStorageResolver`. See `../gdrive.md`. R2 env wiring remains.
5. **Google Sign-In on the login page — implemented** (env-gated
   `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`); existing accounts only. See `gdrive.md` §9.
6. **Email Delivery — logs only** (not delivered). Deadline reminders generate
   in-app notifications.

## Feature Relationships

```
Authentication
    ↓
Organization Workspace ← User Management
    ↓
Project Setup ← Donor Template Manager
    ↓              ↓
Logframe     Evidence Library ← AI Evidence Tagging
    ↓              ↓
Indicators ← Activity Updates
    ↓
Reporting Period Manager ← AI Report Generator
    ↓                      ↓
Compliance Checklist ← Review/Approval Workflow
    ↓
Export Module
    ↓
Dashboard ← Audit Log
    ↑
Settings
```

## Batch 3 features (2026-10-21)

| # | Feature | Status | Source |
|---|---|---|---|
| 26 | [Logframe versioning](26-Logframe-Versioning.md) | Built, tested, deployed 2026-10-20; history page browser check pending | H-1 |
| 27 | [Programmes and grants](27-Programmes-And-Grants.md) | Built, tested, deployed 2026-10-20; browser check pending | H-2 |
| 28 | [Outside partners](28-Outside-Partners.md) | Built, tested, deployed 2026-10-20; partner screens and trimmed menu open | H-15 |
| 29 | [Organisation export](29-Organisation-Export.md) | Built, tested, deployed 2026-10-20 | H-11 |
| 30 | [Donor requirements](30-Donor-Requirements.md) | Built, tested, deployed 2026-10-20; authoring page check pending | H-8, H-9, H-10 |
| 31 | [Account security and project access](31-Account-Security-And-Access.md) | Built, tested, deployed 2026-10-20; optional two-step sign-in added 2026-10-21 (no MFA for partners) | H-12, H-14 |
| 32 | [Report locks and reopening](32-Report-Locks-And-Reopening.md) | Built, tested, deployed 2026-10-20 | H-4 |
| 33 | [AI cost and usage](33-AI-Cost-And-Usage.md) | Built, tested, deployed 2026-10-20; price is an estimate until set | H-19 |
| 34 | [Background jobs and retries](34-Background-Jobs-And-Retries.md) | Built, tested, deployed 2026-10-20; default queue still in-process | H-18 |

Existing features updated for batch 3: 01, 03, 06, 07, 10, 11, 12, 13, 14, 16, 25. Plan and status of every High finding: `memorybank/imp/product-gap-audit-2026-10-20.md` §5.2 and §14.



## Gap-closure features (2026-10-21, Version 2.007)

Built from `../imp/product-gap-audit-2026-10-20.md` (status ledger in §18). Each doc lists what is built, the rules that matter, the code map and what is left over.

| # | Feature | Audit items | Doc |
|---|---|---|---|
| 35 | Target schedule and variance | ME-02, ME-11 | [35-Target-Schedule-And-Variance.md](./35-Target-Schedule-And-Variance.md) |
| 36 | Portfolio dashboard and double-count guard | PM-07, PM-08, ME-07 | [36-Portfolio-Dashboard-And-Roll-Up-Guard.md](./36-Portfolio-Dashboard-And-Roll-Up-Guard.md) |
| 37 | Donor indicator mapping | AI-04 | [37-Donor-Indicator-Mapping.md](./37-Donor-Indicator-Mapping.md) |
| 38 | Scanned documents (OCR) and encryption at rest | AI-03, SE-03 | [38-Scanned-Documents-And-Encryption-At-Rest.md](./38-Scanned-Documents-And-Encryption-At-Rest.md) |
| 39 | Evidence review and evidence filters | EV-06, RP-06 | [39-Evidence-Review-And-Filters.md](./39-Evidence-Review-And-Filters.md) |
| 40 | Comment threads | CG-10 | [40-Comment-Threads.md](./40-Comment-Threads.md) |
| 41 | Management report and changes of plan | RP-05, PM-09 | [41-Management-Report-And-Changes-Of-Plan.md](./41-Management-Report-And-Changes-Of-Plan.md) |
| 42 | Demo project with a first quarter | UX-03 | [42-Demo-Project-Content.md](./42-Demo-Project-Content.md) |
| 31 | (addendum) two-step sign-in, lockout | H-12 | [31-Account-Security-And-Access.md](./31-Account-Security-And-Access.md) |

Also in this batch, documented in the audit and `CONTABO-DEPLOY.md` rather than a feature file: off-host backup to Google Drive (SE-06), help articles inside the app (UX-10), sales and privacy mail through the host's mail server (MK-10, SE-09), PDF indicator lines on the shared column definition (RP-08), and the audit-verification schedule (CG-07). Support-centre articles for these features are in `../docs/support/`.

## Phase 30 — site maps (2026-10-24)

Maps on the project plan and the project Overview: a **Map** view beside List and Timeline, a **"Where we work"** Overview section, places resolved from the officer's own location text against a bundled offline gazetteer (never guessed; unmatched places are listed), hand-placed pins for places no gazetteer knows, and one uploaded GeoJSON of the workspace's own boundaries (districts, sub-districts) that every map draws instead of the built-in outlines.

| # | Feature | Doc |
|---|---|---|
| 43 | Site maps (plan Map view, Overview "Where we work", pins, custom boundaries) | [43-Site-Maps.md](./43-Site-Maps.md) |

Plan, rules and deployment: `../imp/phase30-maps.md` (§10 = batch 30.1). Invariants: `AGENTS.md` → "Phase 30 invariants — maps". Support articles, unpublished until the live check: `../docs/support/_unpublished-phase30/`.
