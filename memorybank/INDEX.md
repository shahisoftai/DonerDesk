# DonorDesk MemoryBank Index

**Last updated:** 2026-10-05

Quick reference guide to all memorybank documents. Use `Ctrl+F` / `Cmd+F` to search within files.

---

## Quick Navigation

| Need | Go to |
|------|-------|
| **What is DonorDesk?** | [`base/DonorDesk — Initial Concept Document.md`](base/DonorDesk%20—%20Initial%20Concept%20Document.md) |
| **Why build it? (Executive pitch)** | [`base/DonorDesk — One-Page Concept Note for Approval.md`](base/DonorDesk%20—%20One-Page%20Concept%20Note%20for%20Approval.md) |
| **Full engineering blueprint** | [`imp/DonorDesk — Phased Implementation Plan.md`](imp/DonorDesk%20—%20Phased%20Implementation%20Plan.md) |
| **Professional donor-reporting hardening plan** | [`imp/PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md`](imp/PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md) (status IMPLEMENTED) and [`imp/REPORTING-OWNERSHIP-MAP.md`](imp/REPORTING-OWNERSHIP-MAP.md) |
| **AI Reporter (multi-step report writing, v1)** | [`imp/AI-REPORTER-IMPLEMENTATION-PLAN.md`](imp/AI-REPORTER-IMPLEMENTATION-PLAN.md) (status IMPLEMENTED 2026-08-28) — original multi-step draft/critique/refine, pgvector, prior-period intelligence. **The draft/critique/refine pipeline was collapsed to a single self-reviewing draft call on 2026-09-18** — see the latency-rework row below. |
| **AI Reporter 2 (typed artifacts + validators + per-section fallback)** | [`imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md`](imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md) (status IMPLEMENTED 2026-08-29) and [`imp/AI-REPORTER-2-RESULTS.md`](imp/AI-REPORTER-2-RESULTS.md) (post-deploy retrospective) and [`imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`](imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md) (operator runbook for flag flip) |
| **Product recovery (writer↔verifier↔human boundary)** | [`imp/RECOVERY-PLAN-IMPLEMENTATION.md`](imp/RECOVERY-PLAN-IMPLEMENTATION.md) (status IMPLEMENTED + DEPLOYED 2026-08-30, release `20260829160000`) — parser fixes, writer prompt alignment, tolerant verifier, idempotent checklist projection, workspace claim resolution, draft lifecycle (supersede/versions/cancel), evidence-period tagging, readiness evidence fix |
| **Report-Quality root cause + UX reorganisation (Increments 1–5) + deploy hardening + SaaS→Contabo runtime provisioning** | [`Fixes.md`](Fixes.md) §"Report-Quality root cause + … AI runtime provisioning (2026-08-31 / 2026-09-01)" and [`imp/RUNTIME-PROVISIONING.md`](imp/RUNTIME-PROVISIONING.md) — eligibility/role fixes drop Smart Review noise 109→43; Reporting Period Workspace frozen; structured `Tell the Story`; flexible Excel/CSV + field-report inputs; deploy script hardened (root cause `SSH` missing host, canary preflight, scp-based transfers, API ready-poll); `RuntimeProvisioner` makes sa.donordesk → donordesk env propagation automatic; MiniMax Test-connection `/v1` double-prefix fix. Releases `20260831154253` + `20260901140002`. |
| **Report-quality v4 + Claude/Gemini providers + per-tenant provider selection + tenant-own-provider credit exemption (2026-09-26, DEPLOYED `20260926153744`)** | [`Fixes.md`](Fixes.md) §"Report-quality v4", §"SuperAdmin LLM providers", §"Tenant's own AI provider consumes no DonorDesk AI credits"; [`Features/11-AI-Report-Draft-Generator.md`](Features/11-AI-Report-Draft-Generator.md); [`SUPERADMIN-PORTAL.md`](SUPERADMIN-PORTAL.md) §6; [`CONTABO-DEPLOY.md`](CONTABO-DEPLOY.md) (last deploy). Covers: writer contract v4, number grounding, deterministic tables/charts/deltas, executive summary drafted last, section-relevant retrieval, donor-voice metric, Claude (SDK) + Gemini, one active LLM per scope, resolution per generation. |
| **EERP Q2 end-to-end report run — cumulative-aware verifier, date/count classifier, restricted evidence withheld, indicator semantics API+UI, manual evidence-link UI, DeepSeek truncation (MAX_TOKENS 16384 + JSON salvage) (2026-09-26, DEPLOYED `20260926164318`/`171958`/`174726`)** | [`Fixes.md`](Fixes.md) §"EERP-2026 Q2 end-to-end report run"; [`Features/06-Logframe-And-Indicator-Manager.md`](Features/06-Logframe-And-Indicator-Manager.md) (semantics); [`Features/07-Evidence-Library.md`](Features/07-Evidence-Library.md) (link manager); [`Features/11-AI-Report-Draft-Generator.md`](Features/11-AI-Report-Draft-Generator.md); [`Features/20-report-gen.md`](Features/20-report-gen.md) §22; [`contabo-ops.md`](contabo-ops.md); [`pending.md`](pending.md) §"EERP Q2 run — follow-ups" |
| **Project Setup & Logframe/Indicator Manager UX (2026-09-27)** | [`imp/Phase20_setup_logframe.md`](imp/Phase20_setup_logframe.md) — wizard draft persistence + resume, readiness score breakdown UX, logframe drag-and-drop reorder/re-parent (`sortOrder`, `PUT /v1/logframe-items/:id/position`), indicator baseline/target progress + per-update disaggregation, indicator update history read model (`GET /v1/indicators/:id/updates`), verification pipeline + request-correction/reject routes, and a logframe-item/parent picker for the create forms. One item (A1, project templates) is blocked — see the doc. |
| **Report Editor v2 — document-first report workspace (P0–P6 code complete 2026-09-27, behind `REPORT_EDITOR_V2`; P7 rollout next)** | [`imp/REPORT-EDITOR-V2-IMPLEMENTATION-PLAN.md`](imp/REPORT-EDITOR-V2-IMPLEMENTATION-PLAN.md) — replaces the crowded `/reports/[periodId]` workspace with one continuous document, outline, per-section inspector, single workflow-driven primary action and inline flagged statements. Includes full rich-text editing (TipTap over the export-renderable markdown subset) and single-section regenerate (not previously implemented). Audit findings F1–F16, UX additions U1–U31, phases P0–P7 (~24–32 dev-days), additive backend changes B1–B10. |
| **LLM provider wiring + runtime provisioning (post-deploy)** | [`imp/LLM-PROVIDER-WIRING.md`](imp/LLM-PROVIDER-WIRING.md) §18–19 (runtime provisioning + MiniMax fix) |
| **Frontend portal blueprint** | [`imp/frontend-imp-plan.md`](imp/frontend-imp-plan.md) |
| **Frontend portal status** | [`imp/FRONTEND-UX-INTEGRATION-AUDIT.md`](imp/FRONTEND-UX-INTEGRATION-AUDIT.md) (latest audit) and [`imp/PHASE7-FRONTEND-REPORT.md`](imp/PHASE7-FRONTEND-REPORT.md) |
| **AI report-generation audit + fixes (provider auth, docxtpl donor-template rendering, entailment/backoff)** | [`Fixes.md`](Fixes.md) §"AI Reporter completely non-functional on production" and §"Systematic fix of the 8 AI-report-generation audit findings" (2026-09-17/18) — live outage root-caused and fixed (corrupted token, duplicate env keys, missing timeout, missing trailing newline in env files); full donor-template docxtpl rendering feature built end-to-end (previously data-model-only); shared lexical scorer + entailment bug fix; LLM 429 backoff + total-budget enforcement. |
| **AI Reporter latency rework (single-call pipeline + parallel sections)** | [`Fixes.md`](Fixes.md) §"AI Reporter latency rework — single-call pipeline + parallel sections (2026-09-18)" and [`Features/20-report-gen.md`](Features/20-report-gen.md) §21 — closes out the sequential-generation performance rework deferred by the audit above; collapses draft→critique→refine to one LLM call/section, adds real (thread-cancelled) per-section timeouts, drafts sections with bounded concurrency (default 3) instead of one at a time, and raises the UI's poll-window safety ceiling accordingly. Not yet verified against a live provider or in the browser. |
| **Report types & scope — Activity / Situation / Custom reports name what they cover (2026-10-03)** | [`Features/10-Reporting-Period-Manager.md`](Features/10-Reporting-Period-Manager.md) §"Report types & scope"; [`Features/12-Missing-Evidence-And-Compliance-Checklist.md`](Features/12-Missing-Evidence-And-Compliance-Checklist.md); [`Features/11-AI-Report-Draft-Generator.md`](Features/11-AI-Report-Draft-Generator.md); [`CONTABO-DEPLOY.md`](CONTABO-DEPLOY.md) (last deploy). `ReportingPeriod.scopeJson`, Semi-annual type, scoped writer prompts, per-type checklists; second pass: built-in per-type blueprints (donor template optional), situation series, date-aware grounding, floating AI popup — see §"Production verification & fixes" and [`Fixes.md`](Fixes.md); follow-ups: donor attribution once per report, scoped/corrected report-inputs panel, blueprint titles in fr/ar/ur/ps (§"Follow-ups done"). |
| **Verification demos (live, end to end)** | [`demo/verification-demo-1.md`](demo/verification-demo-1.md) (template manager, WASH PDF), [`demo/verification-demo-2.md`](demo/verification-demo-2.md) (EU nutrition DOCX), [`demo/verification-demo-3.md`](demo/verification-demo-3.md) (completed 6-month Education project, one AI final report; disaggregation, attendance, record-grounded claim verification, roll-up report fixes, 2026-10-05) |
| **Production issues & fixes** | [`Fixes.md`](Fixes.md) |
| **What still needs doing** | [`pending.md`](pending.md) |
| **Contabo host operations** | [`contabo-ops.md`](contabo-ops.md) (live-host inventory, ports, services, db, ops rules) |
| **Deploy to Contabo** | [`CONTABO-DEPLOY.md`](CONTABO-DEPLOY.md) (single fastest procedure: one-liner, preflight, gate, scope control, rollback, token sync, pitfalls) |
| **SuperAdmin portal** | [`SUPERADMIN-PORTAL.md`](SUPERADMIN-PORTAL.md) |
| **Kestra plugins** | [`imp/KESTRA-PLUGINS.md`](imp/KESTRA-PLUGINS.md) |

---

## By Category

### 📋 Concepts & Vision
| File | Purpose |
|------|---------|
| [`base/DonorDesk — Initial Concept Document.md`](base/DonorDesk%20—%20Initial%20Concept%20Document.md) | Full product concept, problem statement, MVP scope, user roles, business model, roadmap (902 lines) |
| [`base/DonorDesk — One-Page Concept Note for Approval.md`](base/DonorDesk%20—%20One-Page%20Concept%20Note%20for%20Approval.md) | Executive summary for approval (190 lines) |
| [`base/MVP-features.md`](base/MVP-features.md) | MVP feature list |
| [`imp/MVP-features.md`](imp/MVP-features.md) | Implementation-phase MVP features |

### 🏗️ Architecture & Engineering
| File | Purpose |
|------|---------|
| [`imp/DonorDesk — Phased Implementation Plan.md`](imp/DonorDesk%20—%20Phased%20Implementation%20Plan.md) | **Main engineering blueprint** — 6-phase plan, SOLID, DDD, hexagonal, multi-tenancy (649 lines) |
| [`imp/frontend-imp-plan.md`](imp/frontend-imp-plan.md) | **Frontend portal blueprint** — layers, SOLID, design-system workstreams, feature phases 0–7 (1399 lines) |
| [`imp/frontend-implementation.md`](imp/frontend-implementation.md) | Frontend source product specification |
| [`imp/FRONTEND-UX-INTEGRATION-AUDIT.md`](imp/FRONTEND-UX-INTEGRATION-AUDIT.md) | Post-Phase-7 route, shell, and UI/UX integration audit/fix report |
| [`docs/architecture/decisions/0001-multi-tenancy.md`](docs/architecture/decisions/0001-multi-tenancy.md) | ADR: shared-schema + Postgres RLS |
| [`docs/architecture/decisions/0002-llm-strategy.md`](docs/architecture/decisions/0002-llm-strategy.md) | ADR: LLM provider abstraction via strategy pattern |
| [`docs/architecture/decisions/0003-fastify-over-nestjs.md`](docs/architecture/decisions/0003-fastify-over-nestjs.md) | ADR: Fastify over NestJS for Phase 1 |
| [`docs/architecture/decisions/0004-async-job-orchestration.md`](docs/architecture/decisions/0004-async-job-orchestration.md) | ADR: async job ownership (memory/BullMQ/Kestra via `JOB_QUEUE`) |
 | [`imp/KESTRA-IMPLEMENTATION-PLAN.md`](imp/KESTRA-IMPLEMENTATION-PLAN.md) | Kestra orchestration implementation plan (Phases A–F) |
| [`imp/AI-REPORTER-IMPLEMENTATION-PLAN.md`](imp/AI-REPORTER-IMPLEMENTATION-PLAN.md) | AI Reporter v1: multi-step (draft→critique→refine) report writing behind `IReportDraftGenerator`, pgvector semantic retrieval, prior-period intelligence — **status: IMPLEMENTED (2026-08-28)**, superseded by v2 below |
| [`imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md`](imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md) | AI Reporter v2: typed artifacts (tables, charts, lists, Q&A, deltas), per-section timeout + per-section fallback, deterministic artifact validators, 25-case eval corpus, additive persistence (`ReportArtifact` + `ReportArtifactRow`) — **status: IMPLEMENTED (2026-08-29)**, feature-flagged `AI_REPORTER_ENABLED=1` (off by default) |
| [`imp/AI-REPORTER-2-RESULTS.md`](imp/AI-REPORTER-2-RESULTS.md) | AI Reporter v2 post-deploy retrospective: deploy timeline, gate results, lessons learned, ADR-style notes on the api-tar tree-layout fix and the per-section fallback semantics |
| [`imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`](imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md) | Operator runbook for AI Reporter v2: how to flip `AI_REPORTER_ENABLED` for a preview tenant, canary rollout, validation, monitoring, rollback |
| [`imp/PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md`](imp/PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md) | Phased plan for revision-safe assurance, award-specific requirements, donor-native rendering, and validated submission snapshots — **status: IMPLEMENTED (2026-08-19)** |
| [`imp/REPORTING-OWNERSHIP-MAP.md`](imp/REPORTING-OWNERSHIP-MAP.md) | Professional-reporting component ownership map (no-duplication review) |
| [`docs/architecture/decisions/0005-report-revisions.md`](docs/architecture/decisions/0005-report-revisions.md) | ADR: report revisions and revision-bound assurance |
| [`docs/architecture/decisions/0006-requirement-precedence.md`](docs/architecture/decisions/0006-requirement-precedence.md) | ADR: reporting requirement precedence |
| [`docs/architecture/decisions/0007-verification-composition.md`](docs/architecture/decisions/0007-verification-composition.md) | ADR: verification composition and structured reason codes |
| [`docs/architecture/decisions/0008-submission-snapshots.md`](docs/architecture/decisions/0008-submission-snapshots.md) | ADR: immutable submission snapshots |
| [`docs/architecture/decisions/0009-donor-native-rendering.md`](docs/architecture/decisions/0009-donor-native-rendering.md) | ADR: donor-native rendering behind the export builder |
| [`imp/KESTRA-PLUGINS.md`](imp/KESTRA-PLUGINS.md) | **Free Kestra plugins** (Tika, Redis, JDBC-Postgres, GDrive, SFTP) — implementation + gating |
| [`gdrive.md`](gdrive.md) | **Google Drive primary storage (link-first) + R2 optional tier** — status, architecture, implementation (Phases A–E), **+ login-page Google Sign-In (§9)** |
| [`docs/security/threat-model.md`](docs/security/threat-model.md) | Security threat model |
| [`docs/api/openapi-3.1.json`](docs/api/openapi-3.1.json) | OpenAPI spec |

### 🚀 Implementation Phases
| Phase | Status | Completion Report | Audit |
|-------|--------|-------------------|-------|
| Phase 0 — Foundation | ✅ Complete | [`imp/PHASE0-COMPLETION-REPORT.md`](imp/PHASE0-COMPLETION-REPORT.md) | [`imp/PHASE0-AUDIT.md`](imp/PHASE0-AUDIT.md) |
| Phase 1 — MVP Core | ✅ Complete | [`imp/PHASE1-COMPLETION.md`](imp/PHASE1-COMPLETION.md) | [`imp/PHASE1-AUDIT.md`](imp/PHASE1-AUDIT.md) |
| Phase 2 — Trust & Scale | ✅ Complete | [`imp/PHASE2-COMPLETION.md`](imp/PHASE2-COMPLETION.md) | [`imp/PHASE2-AUDIT.md`](imp/PHASE2-AUDIT.md) |
| Phase 3 — AI-Native | ✅ Complete | [`imp/PHASE3-COMPLETION.md`](imp/PHASE3-COMPLETION.md) | [`imp/PHASE3-AUDIT.md`](imp/PHASE3-AUDIT.md) |
| Phase 4 — Integrations | ✅ Complete | [`imp/PHASE4-COMPLETION.md`](imp/PHASE4-COMPLETION.md) | [`imp/PHASE4-AUDIT.md`](imp/PHASE4-AUDIT.md) |
| Phase 5 — Enterprise | ✅ Complete | [`imp/PHASE5-COMPLETION.md`](imp/PHASE5-COMPLETION.md) | [`imp/PHASE5-AUDIT.md`](imp/PHASE5-AUDIT.md) |

### 🎨 Frontend Portal (per [`imp/frontend-imp-plan.md`](imp/frontend-imp-plan.md))
| Phase | Scope | Status | Report |
|-------|-------|--------|--------|
| Phase 0 | Baseline & safety (httpOnly, gateway, errors, capability) | ✅ Delivered | [`imp/PHASE0-REPORT.md`](imp/PHASE0-REPORT.md) |
| Phase 1 | Design system + shell (DS, SHELL) | ✅ Delivered | [`imp/PHASE1-REPORT.md`](imp/PHASE1-REPORT.md) |
| Phase 2 | Auth, onboarding, project setup (AUTH, PROJ-01, TPL, LOG) | ✅ Delivered | [`imp/PHASE2-FRONTEND-REPORT.md`](imp/PHASE2-FRONTEND-REPORT.md) |
| Phase 3 | Home, My Work, portfolios (DASH, NTF-01, PROJ-02/03) | ✅ Delivered | [`imp/PHASE3-FRONTEND-REPORT.md`](imp/PHASE3-FRONTEND-REPORT.md) |
| Phase 4 | Field activity & evidence (ACT, EVD) | ⚠️ In code; no dedicated report | — |
| Phase 5 | Reporting & compliance (REP, CMP, jobs) | ✅ Delivered | [`imp/PHASE5-FRONTEND-REPORT.md`](imp/PHASE5-FRONTEND-REPORT.md) |
| Phase 6 | Review, approval, export (REV, EXP) | ✅ Delivered | [`imp/PHASE6-FRONTEND-REPORT.md`](imp/PHASE6-FRONTEND-REPORT.md) |
| Phase 7 | Admin, search, hardening (ADM) | ✅ Delivered | [`imp/PHASE7-FRONTEND-REPORT.md`](imp/PHASE7-FRONTEND-REPORT.md) |

> **Deployment status (2026-08-29):** Latest release `20260828200000` (commit
  > `a2ffc29`, **AI Reporter v2**) is live on `donordesk.online`. All five services
  > (API `4001`, web `3002`, workers `8092`, Kestra `8093`/`8094`, SuperAdmin `3012`)
  > are **enabled and active**. **AI Reporter v2 (2026-08-29):** the 622-LOC
  > `apps/workers/app/ai_reporter.py` was split into a 12-module SRP package
  > (`models`, `writer_contract`, `llm_gateway`, `outline`, `chart_suggester`,
  > `draft_writer`, `critique_writer`, `refiner`, `artifact_validators`, `timeouts`,
  > `pipeline`, `router`). Writer contract v2 (`WRITER_CONTRACT_VERSION=2`; **v4 since 2026-09-26**)
  > adds banned-phrase list, numeric verbatim rule, repetition guard,
  > mandatory-Q&A discipline, and table/chart/delta mandates. Typed artifacts
  > (`TABLE | CHART | LIST | KEY_VALUE | QA | DELTA`) persist in two new tables
  > (`ReportArtifact` + `ReportArtifactRow`, migration
  > `20260828200000_ai_reporter_artifacts`, RLS forced + cross-tenant INSERT
  > verified to fail). Deterministic artifact validators (9 hard gates)
  > are mirrored Python + TS (`artifact_validators.py` +
  > `src/ai/artifact-validators.ts`). Per-section timeout
  > (`AI_REPORTER_DRAFT_TIMEOUT_MS=45000` at the time — **90000 since v4, 2026-09-26**) with **per-section fallback**
  > — a single slow section no longer demotes the whole draft. Eval corpus
  > grown 8 → 25 cases; deterministic metrics added for
  > `banned-phrase`, `qa-coverage`, `narrative-length-vs-target`,
  > `artifact-coverage`, `citation-density`. Full gate green: 137 TS tests
  > (136 pass + 1 pre-existing skip), 55 Python tests, 25/25 eval cases.
  > **Feature flag:** `AI_REPORTER_ENABLED=1` is **off by default** in
  > `/opt/donordesk/shared/api.env`; the system continues to use
  > `LlmReportDraftGenerator` for all tenants until the operator flips the
  > flag per the controlled-rollout plan in
  > `imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`. Deploy script
  > (`scripts/deploy-fast.sh`) was rewritten to ship the api tree layout
  > (`apps/api/{dist,node_modules}`), plus a separate workspace-packages tar
  > and a pnpm-store tar; the api systemd unit's WorkingDirectory was
  > updated to `/opt/donordesk/app/apps/api` so workspace `@donordesk/*`
  > symlinks resolve correctly. Full detail in `contabo-ops.md` §26 (2026-08-29),
  > `Fixes.md` (deploy log), and `imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md` §14.
  > **Earlier releases:**
  > 2026-08-28 shipped **AI Reporter sidecar v1** (multi-step draft/critique/refine +
  > pgvector semantic retrieval + prior-period intelligence) — see
  > `Features/11-AI-Report-Draft-Generator.md`, `imp/LLM-PROVIDER-WIRING.md` §16,
  > `imp/AI-REPORTER-IMPLEMENTATION-PLAN.md` (status: superseded 2026-08-29 by v2).
  > 2026-08-19 shipped **professional donor reporting hardening**
  > (`PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md` Phases 0–9): immutable
  > `ReportRevision` with revision-bound `ReportClaim` assertions,
  > `IReportRevisionService` single mutation pipeline, deterministic assertion
  > extraction, structured numeric/period/entity/unit/derivation verification,
  > evidence hash/chunk/source-text integrity, entailment + causal human-review
  > policy, requirement packs/overrides, `SubmissionSnapshot` sealing, one gate
  > evaluator shared by approval/preflight/submission/export, export intent,
  > coverage-gap projection into `UNSUPPORTED_REPORT_CLAIM` checklist items,
  > neutral rewrite prompts, golden corpus + `reporting:eval`, and ADRs 0005–0009.
  > Migration `20260818180000_professional_reporting` (additive; includes
  > baseline-revision backfill) + RLS applied. Full gate green (254 tests).
  > See `Features/20-report-gen.md` §18, `Features/19-Tiers-And-Payments.md`,
  > `Fixes.md`, and `contabo-ops.md` §26.
  > **Gated (not deployed):** the five plugin-referencing Kestra flows and plugin
  > JARs (stage/verify against Kestra 1.3.30 + add the `donordesk` datasource
  > first). See `contabo-ops.md` §25 and `imp/KESTRA-PLUGINS.md`.
  > **2026-08-20 (demo data + data-shape fixes):** seeded the **USAID Emergency
  > Education Response Programme (EERP-2026)** demo project for tenant
  > `mnpiracha@gmail.com` (GEC) and fixed three data-shape bugs it exposed —
  > template `sectionsJson` shape ("Section title required"), invalid
  > `COMPLETED` period status ("Invalid ReportStatus"), and the closed
  > reporting-period readiness gate (missing `ProjectSetup`/`ReportingProfile`/
  > `REVIEWED` sections). See `contabo-ops.md` §26 (2026-08-20), `Fixes.md`,
  > and `Features/18-Project-Creation-Wizard.md` §4.5.
  > **2026-08-20 (deployed, release `20260820125717`):** **section-wise AI
  > report generation** — fixes the Generate-AI-draft timeout by splitting
  > generation into a fast skeleton-creation phase + a background per-section
  > drafting loop (see `Features/11-AI-Report-Draft-Generator.md`, `Fixes.md`,
  > and `contabo-ops.md` §26).

### 🛠️ Operations & Deployment
| File | Purpose |
|------|---------|
| [`SUPERADMIN-PORTAL.md`](SUPERADMIN-PORTAL.md) | **SuperAdmin portal** — security boundary, capabilities, API, encrypted configuration, production topology, TLS, operations, rollback, and limitations |
| [`contabo-ops.md`](contabo-ops.md) | **Live-host inventory** — verified Contabo server state, ports, services, DOs/DON'Ts, systemd units, migrations/RLS, security findings, backup, acceptance, change log (former `docs/CONTABO-LEAN-DEPLOYMENT.md` + `docs/CONTABO-FAST-DEPLOYMENT.md` merged in) |
| [`CONTABO-DEPLOY.md`](CONTABO-DEPLOY.md) | **Single fastest deploy procedure** — one-liner, preflight, gate, scope control, snapshot/xfer/verify breakdown, rollback, token sync, common pitfalls |
| [`docs/runbooks/DISASTER-RECOVERY.md`](docs/runbooks/DISASTER-RECOVERY.md) | DR procedures |
| [`docs/runbooks/BYOC-DEPLOYMENT.md`](docs/runbooks/BYOC-DEPLOYMENT.md) | Bring-your-own-cloud deployment |
| [`docs/runbooks/alerts.md`](docs/runbooks/alerts.md) | Alert definitions |
| [`docs/runbooks/key-rotation.md`](docs/runbooks/key-rotation.md) | Key rotation runbook |

### 🐛 Issues & Tracking
| File | Purpose |
|------|---------|
| [`Fixes.md`](Fixes.md) | Applied fix log — frontend integration plus production signup/login, RLS, OLS Origin, and advisory-lock fixes |
| [`pending.md`](pending.md) | **Outstanding items** — production hardening, async/AI features, observability (136 lines) |
| [`features.md`](features.md) | Theme + portal feature tracking (light/dark theme; portal implementation summary) |
| [`Features/INDEX.md`](Features/INDEX.md) | 18 MVP feature specs index with statuses |

---

## Key Decisions (ADRs)

| # | Decision | File |
|---|----------|------|
| 1 | Shared-schema PostgreSQL + RLS for multi-tenancy | [`0001-multi-tenancy.md`](docs/architecture/decisions/0001-multi-tenancy.md) |
| 2 | LLM strategy pattern with provider abstraction | [`0002-llm-strategy.md`](docs/architecture/decisions/0002-llm-strategy.md) |
| 3 | Fastify over NestJS for Phase 1 | [`0003-fastify-over-nestjs.md`](docs/architecture/decisions/0003-fastify-over-nestjs.md) |
| 4 | Async job ownership (memory/BullMQ/Kestra) | [`0004-async-job-orchestration.md`](docs/architecture/decisions/0004-async-job-orchestration.md) |
| 5 | Report revisions and revision-bound assurance | [`0005-report-revisions.md`](docs/architecture/decisions/0005-report-revisions.md) |
| 6 | Reporting requirement precedence | [`0006-requirement-precedence.md`](docs/architecture/decisions/0006-requirement-precedence.md) |
| 7 | Verification composition and structured reason codes | [`0007-verification-composition.md`](docs/architecture/decisions/0007-verification-composition.md) |
| 8 | Immutable submission snapshots | [`0008-submission-snapshots.md`](docs/architecture/decisions/0008-submission-snapshots.md) |
| 9 | Donor-native rendering behind the export builder | [`0009-donor-native-rendering.md`](docs/architecture/decisions/0009-donor-native-rendering.md) |

---

## Searchable Topic Index

**Jump to:** `Ctrl+F` / `Cmd+F`

| Topic | Locations |
|-------|-----------|
| Multi-tenancy / RLS | [`0001-multi-tenancy.md`](docs/architecture/decisions/0001-multi-tenancy.md), [`contabo-ops.md`](contabo-ops.md) §5.3, [`pending.md`](pending.md) |
| LLM / AI | [`0002-llm-strategy.md`](docs/architecture/decisions/0002-llm-strategy.md), [`imp/LLM-PROVIDER-WIRING.md`](imp/LLM-PROVIDER-WIRING.md), [`imp/AI-REPORTER-IMPLEMENTATION-PLAN.md`](imp/AI-REPORTER-IMPLEMENTATION-PLAN.md), [`pending.md`](pending.md) (BullMQ) |
| AI credits / quotas | [`Features/19-Tiers-And-Payments.md`](Features/19-Tiers-And-Payments.md), [`imp/LLM-PROVIDER-WIRING.md`](imp/LLM-PROVIDER-WIRING.md) §14–15 |
| Report charts | [`Features/20-report-gen.md`](Features/20-report-gen.md) §15, [`Features/11-AI-Report-Draft-Generator.md`](Features/11-AI-Report-Draft-Generator.md) |
| Readiness percentages (evidence/approval/overall) | [`Fixes.md`](Fixes.md) (readiness fix log), [`Features/10-Reporting-Period-Manager.md`](Features/10-Reporting-Period-Manager.md) |
| Settings nav (Setup/Settings/Audit tabs) | [`Fixes.md`](Fixes.md) (readiness fix log), [`imp/frontend-imp-plan.md`](imp/frontend-imp-plan.md) |
| Evidence extracted text / report data completeness | [`Features/07-Evidence-Library.md`](Features/07-Evidence-Library.md), [`Features/08-AI-Evidence-Tagging.md`](Features/08-AI-Evidence-Tagging.md), [`Features/11-AI-Report-Draft-Generator.md`](Features/11-AI-Report-Draft-Generator.md), [`Fixes.md`](Fixes.md) |
| SuperAdmin billing & credits | [`SUPERADMIN-PORTAL.md`](SUPERADMIN-PORTAL.md) §5/§7, [`imp/LLM-PROVIDER-WIRING.md`](imp/LLM-PROVIDER-WIRING.md) §15 |
| API bind (0.0.0.0 issue) | [`contabo-ops.md`](contabo-ops.md) §4, §10, [`pending.md`](pending.md) |
| OpenLiteSpeed / Origin header | [`Fixes.md`](Fixes.md) §2, [`contabo-ops.md`](contabo-ops.md) §7 |
| SuperAdmin / platform control plane | [`SUPERADMIN-PORTAL.md`](SUPERADMIN-PORTAL.md) |
| PostgreSQL advisory lock | [`Fixes.md`](Fixes.md) §3 |
| RLS / table privileges | [`Fixes.md`](Fixes.md) §4, [`contabo-ops.md`](contabo-ops.md) §5.3 |
| Backup / DR | [`contabo-ops.md`](contabo-ops.md) §9, [`pending.md`](pending.md) |
| Contabo ports / preflight | [`contabo-ops.md`](contabo-ops.md) §4, [`CONTABO-DEPLOY.md`](CONTABO-DEPLOY.md) §4 |
| DonorDesk deployment ports | [`contabo-ops.md`](contabo-ops.md) §4 (table), [`CONTABO-DEPLOY.md`](CONTABO-DEPLOY.md) §4 |
| Versioned migrations | [`pending.md`](pending.md) |
| BullMQ / Redis | [`pending.md`](pending.md) |
| Evidence storage (Google Drive / R2 / LOCAL) | [`gdrive.md`](gdrive.md), [`pending.md`](pending.md) |
| Indicator data entry (per period) | [`Features/06-Logframe-And-Indicator-Manager.md`](Features/06-Logframe-And-Indicator-Manager.md), [`Features/10-Reporting-Period-Manager.md`](Features/10-Reporting-Period-Manager.md), [`contabo-ops.md`](contabo-ops.md) §14 |
| Kestra flows | [`pending.md`](pending.md) |
| Kestra plugins (Tika/Redis/JDBC/GDrive/SFTP) | [`imp/KESTRA-PLUGINS.md`](imp/KESTRA-PLUGINS.md), [`pending.md`](pending.md) |
| SSH hardening | [`contabo-ops.md`](contabo-ops.md) §8, [`pending.md`](pending.md) |
| Frontend portal | [`imp/frontend-imp-plan.md`](imp/frontend-imp-plan.md), [`features.md`](features.md) |

---

## File Tree

```
memorybank/
├── INDEX.md                          ← YOU ARE HERE
├── SUPERADMIN-PORTAL.md              SuperAdmin portal canonical reference
├── Fixes.md                          Production fixes applied
├── pending.md                        Outstanding items
├── features.md                       Feature tracking (theme + portal)
├── contabo-ops.md                   Live-host inventory & operations (host facts, ports, services, db, ops rules)
├── CONTABO-DEPLOY.md                Single fastest deploy procedure (one-liner, preflight, gate, scope, pitfalls, rollback)
├── Features/
│   ├── INDEX.md                     18 MVP feature specs index
│   ├── 18-Project-Creation-Wizard.md  Project bootstrap wizard + Drive folders + setup gates
│   └── 01..17-*.md                  Per-feature specs
├── base/
│   ├── DonorDesk — Initial Concept Document.md
│   ├── DonorDesk — One-Page Concept Note for Approval.md
│   └── MVP-features.md
├── imp/
│   ├── DonorDesk — Phased Implementation Plan.md
│   ├── MVP-features.md
│   ├── frontend-imp-plan.md         Frontend portal blueprint
│   ├── frontend-implementation.md   Frontend source spec
│   ├── KESTRA-IMPLEMENTATION-PLAN.md  Kestra orchestration plan (Phases A–F)
│   ├── KESTRA-PLUGINS.md              Free Kestra plugins implementation + gating
│   ├── PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md  Professional donor reporting (IMPLEMENTED 2026-08-19)
│   ├── AI-REPORTER-IMPLEMENTATION-PLAN.md            AI Reporter multi-step writing + semantic retrieval (IMPLEMENTED 2026-08-28)
│   ├── AI-REPORTER-2-IMPLEMENTATION-PLAN.md           AI Reporter v2 — typed artifacts, per-section fallback, validators, 25-case eval (IMPLEMENTED 2026-08-29)
│   ├── AI-REPORTER-2-RESULTS.md                      AI Reporter v2 post-deploy retrospective
│   ├── AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md           AI Reporter v2 operator runbook (flag flip, canary, rollback)
│   ├── REPORTING-OWNERSHIP-MAP.md     Professional-reporting ownership map
│   ├── PHASE0-COMPLETION-REPORT.md
│   ├── PHASE0-AUDIT.md
│   ├── PHASE0-REPORT.md             Frontend Phase 0
│   ├── PHASE1-COMPLETION.md
│   ├── PHASE1-AUDIT.md
│   ├── PHASE1-REPORT.md             Frontend Phase 1
│   ├── PHASE2-COMPLETION.md
│   ├── PHASE2-AUDIT.md
│   ├── PHASE2-FRONTEND-REPORT.md    Frontend Phase 2
│   ├── PHASE3-COMPLETION.md
│   ├── PHASE3-AUDIT.md
│   ├── PHASE3-FRONTEND-REPORT.md    Frontend Phase 3
│   ├── PHASE4-COMPLETION.md
│   ├── PHASE4-AUDIT.md
│   ├── PHASE5-COMPLETION.md
│   ├── PHASE5-AUDIT.md
│   ├── PHASE5-FRONTEND-REPORT.md    Frontend Phase 5
│   ├── PHASE6-FRONTEND-REPORT.md    Frontend Phase 6
│   └── PHASE7-FRONTEND-REPORT.md    Frontend Phase 7
└── docs/
    ├── api/
    │   └── openapi-3.1.json
    ├── architecture/
    │   └── decisions/
    │       ├── 0001-multi-tenancy.md
    │       ├── 0002-llm-strategy.md
    │       ├── 0003-fastify-over-nestjs.md
    │       ├── 0004-async-job-orchestration.md
    │       ├── 0005-report-revisions.md
    │       ├── 0006-requirement-precedence.md
    │       ├── 0007-verification-composition.md
    │       ├── 0008-submission-snapshots.md
    │       └── 0009-donor-native-rendering.md
    ├── runbooks/
    │   ├── DISASTER-RECOVERY.md
    │   ├── BYOC-DEPLOYMENT.md
    │   ├── alerts.md
    │   └── key-rotation.md
    └── security/
        └── threat-model.md
```

---

## Most-Referenced Files

| File | Read when... |
|------|--------------|
| [`pending.md`](pending.md) | Starting a session — check what needs doing |
| [`CONTABO-DEPLOY.md`](CONTABO-DEPLOY.md) | Deploying to Contabo (single fastest procedure) |
| [`contabo-ops.md`](contabo-ops.md) | Looking up live-host facts (ports, services, db rules, security findings) |
| [`Fixes.md`](Fixes.md) | Investigating signup/login/auth issues |
| [`imp/frontend-imp-plan.md`](imp/frontend-imp-plan.md) | Frontend portal architecture and phase scope |
| [`imp/DonorDesk — Phased Implementation Plan.md`](imp/DonorDesk%20—%20Phased%20Implementation%20Plan.md) | Architecture questions, adding new features |
| [`contabo-ops.md`](contabo-ops.md) | Looking up live-host facts during deploy or troubleshooting |
| [`CONTABO-DEPLOY.md`](CONTABO-DEPLOY.md) | Deploying to Contabo (single fastest procedure) |
