# DonorDesk Features Index

This directory contains detailed documentation for each of DonorDesk's 19 MVP features.

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
> (per-tenant allowance Set/Increase/Reduce + reset month usage). See
> `11-AI-Report-Draft-Generator.md`, `14-Export-Module.md`, `19-Tiers-And-Payments.md`,
> `20-report-gen.md` §15, `../imp/LLM-PROVIDER-WIRING.md`, and `../SUPERADMIN-PORTAL.md`.

## Features

| # | Feature | Status | Key Files |
|---|---------|--------|-----------|
| 01 | [Authentication and Onboarding](./01-Authentication-And-Onboarding.md) | Implemented | `packages/domain/src/entities/User.ts` |
| 02 | [Organization Workspace](./02-Organization-Workspace.md) | Implemented | `packages/domain/src/entities/Organization.ts` |
| 03 | [User and Role Management](./03-User-And-Role-Management.md) | Implemented | `packages/domain/src/entities/User.ts`, `packages/application/src/permissions/` |
| 04 | [Project Setup](./04-Project-Setup.md) | Implemented (per-project Team + full Settings editor 2026-08-16) | `packages/domain/src/entities/Project.ts` |
| 05 | [Donor Template Manager](./05-Donor-Template-Manager.md) | Implemented (AI extraction heuristic; real LLM pending) | `packages/domain/src/entities/DonorTemplate.ts` |
| 06 | [Logframe and Indicator Manager](./06-Logframe-And-Indicator-Manager.md) | Implemented (data entry 2026-08-16) | `packages/domain/src/contexts/logframe/`, `packages/application/src/use-cases/logframe/`, `packages/application/src/ports/logframe.ts`, `apps/api/src/routes/logframe.ts`, `apps/api/src/routes/reporting.ts`, `apps/web/src/features/reporting/presentation/IndicatorEntryGrid.tsx`, `apps/web/src/app/(portal)/projects/[id]/reports/[periodId]/indicators/page.tsx` |
| 07 | [Evidence Library](./07-Evidence-Library.md) | Implemented | `packages/domain/src/entities/EvidenceFile.ts` |
| 08 | [AI Evidence Tagging](./08-AI-Evidence-Tagging.md) | Orchestrated (heuristic tagger; real AI provider is a stub) | `packages/infrastructure/src/llm/evidence-tagger.ts`, `packages/contracts/src/strategies/heuristic-rules.json` |
| 09 | [Activity Update Capture](./09-Activity-Update-Capture.md) | Implemented | `packages/domain/src/entities/ActivityUpdate.ts` |
| 10 | [Reporting Period Manager](./10-Reporting-Period-Manager.md) | Implemented | `packages/domain/src/entities/ReportingPeriod.ts` |
| 11 | [AI Report Draft Generator](./11-AI-Report-Draft-Generator.md) | Implemented (real LLM via SuperAdmin MiniMax config 2026-08-17; heuristic fallback) | `packages/infrastructure/src/llm/llm-report-draft-generator.ts`, `packages/infrastructure/src/llm/factory.ts`, `packages/infrastructure/src/llm/llm-config-resolver.ts` |
| 12 | [Missing Evidence and Compliance Checklist](./12-Missing-Evidence-And-Compliance-Checklist.md) | Implemented (auto-generation, templates, bulk ops 2026-08-16) | `packages/domain/src/entities/ChecklistItem.ts` |
| 13 | [Review and Approval Workflow](./13-Review-And-Approval-Workflow.md) | Implemented | `packages/domain/src/entities/Comment.ts` |
| 14 | [Export Module](./14-Export-Module.md) | Implemented (report charts embedded in DOCX/PDF 2026-08-17) | `packages/infrastructure/src/export/`, `packages/infrastructure/src/exports/chart-png-renderer.ts` |
| 15 | [Dashboard](./15-Dashboard.md) | Implemented | `apps/web/src/app/(portal)/dashboard/page.tsx` |
| 16 | [Audit Log](./16-Audit-Log.md) | Implemented | `packages/domain/src/entities/AuditLog.ts` |
| 17 | [Basic Settings](./17-Basic-Settings.md) | Implemented | `apps/web/src/app/(portal)/settings/` |
| 18 | [Project Creation Wizard](./18-Project-Creation-Wizard.md) | Implemented (release `20260815054218`) | `packages/application/src/readiness/project-readiness-service.ts`, `packages/infrastructure/src/storage/project-workspace.ts`, `packages/infrastructure/src/storage/workspace-router.ts`, `apps/api/src/routes/project-setup.ts` |
| 19 | [Tiers and Payments](./19-Tiers-And-Payments.md) | Implemented (AI-credit quotas enforced + SuperAdmin credit management 2026-08-17) | `packages/domain/src/contexts/billing/`, `packages/application/src/ports/billing.ts`, `packages/application/src/services/entitlement-service.ts`, `packages/application/src/use-cases/billing/`, `packages/infrastructure/src/billing/`, `packages/infrastructure/src/repositories/billing.ts`, `apps/api/src/routes/billing.ts`, `apps/api/src/routes/webhooks.ts`, `apps/api/src/routes/superadmin.ts` |

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
