# DonorDesk MemoryBank Index

**Last updated:** 2026-08-17

Quick reference guide to all memorybank documents. Use `Ctrl+F` / `Cmd+F` to search within files.

---

## Quick Navigation

| Need | Go to |
|------|-------|
| **What is DonorDesk?** | [`base/DonorDesk — Initial Concept Document.md`](base/DonorDesk%20—%20Initial%20Concept%20Document.md) |
| **Why build it? (Executive pitch)** | [`base/DonorDesk — One-Page Concept Note for Approval.md`](base/DonorDesk%20—%20One-Page%20Concept%20Note%20for%20Approval.md) |
| **Full engineering blueprint** | [`imp/DonorDesk — Phased Implementation Plan.md`](imp/DonorDesk%20—%20Phased%20Implementation%20Plan.md) |
| **Frontend portal blueprint** | [`imp/frontend-imp-plan.md`](imp/frontend-imp-plan.md) |
| **Frontend portal status** | [`imp/FRONTEND-UX-INTEGRATION-AUDIT.md`](imp/FRONTEND-UX-INTEGRATION-AUDIT.md) (latest audit) and [`imp/PHASE7-FRONTEND-REPORT.md`](imp/PHASE7-FRONTEND-REPORT.md) |
| **Production issues & fixes** | [`Fixes.md`](Fixes.md) |
| **What still needs doing** | [`pending.md`](pending.md) |
| **Contabo host operations** | [`contabo-ops.md`](contabo-ops.md) |
| **SuperAdmin portal** | [`SUPERADMIN-PORTAL.md`](SUPERADMIN-PORTAL.md) |
| **Kestra plugins** | [`imp/KESTRA-PLUGINS.md`](imp/KESTRA-PLUGINS.md) |
| **Deploy to Contabo** | [`contabo-ops.md`](contabo-ops.md) (sections 14–29: model, environments, services, migrations, release paths, rollback) |

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

> **Deployment status (2026-08-17):** Latest release `20260817180500` (commit
> `be8ef33`) is live on `donordesk.online`. All five services (API `4001`, web
> `3002`, workers `8092`, Kestra `8093`/`8094`, SuperAdmin `3012`) are **enabled
> and active**. Today's releases ship: **real LLM report drafting** via the
> SuperAdmin-configured MiniMax provider with per-tier AI-credit quotas
> (STARTER 5 / TEAM 100 / GROWTH 500 / ENTERPRISE unlimited; stub fallback is
> free and never billed), **user-selectable report charts**
> (BAR/LINE/PIE/AREA/RADAR/GAUGE per indicator section, exported identically to
> DOCX/PDF via ECharts SSR→sharp PNG), the **SuperAdmin Billing & credits**
> section (per-tenant allowance Set/Increase/Reduce + reset month usage), plus
> credit/timeout/section-switching fixes. Migration `20260817183000_report_charts`
> applied. **2026-08-17 (report data completeness — not yet deployed):** AI report
> generation now fully consumes saved project data — evidence document text is
> persisted (`EvidenceFile.extractedText`, migration
> `20260817200000_evidence_extracted_text`) and cited via evidence packages, and
> activity narratives + indicator-update comments/dataSource feed the narrator;
> statement-level sources render in the report workspace. See
> `Features/11-AI-Report-Draft-Generator.md`, `Features/07-Evidence-Library.md`,
> `Features/08-AI-Evidence-Tagging.md`, and `Fixes.md`. **Gated (not deployed):**
> the five plugin-referencing Kestra flows and plugin JARs (stage/verify against
> Kestra 1.3.30 + add the `donordesk` datasource first). See `contabo-ops.md` §28
> and `imp/KESTRA-PLUGINS.md`.

### 🛠️ Operations & Deployment
| File | Purpose |
|------|---------|
| [`SUPERADMIN-PORTAL.md`](SUPERADMIN-PORTAL.md) | **SuperAdmin portal** — security boundary, capabilities, API, encrypted configuration, production topology, TLS, operations, rollback, and limitations |
| [`contabo-ops.md`](contabo-ops.md) | **Live-host inventory + deployment runbook** — verified Contabo server state, ports, services, DOs/DON'Ts, preflight, systemd units, migrations/RLS, release paths, rollback, backup, acceptance, security sign-off, production record, change log (single source of truth; former `docs/CONTABO-LEAN-DEPLOYMENT.md` + `docs/CONTABO-FAST-DEPLOYMENT.md` merged in) |
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

---

## Searchable Topic Index

**Jump to:** `Ctrl+F` / `Cmd+F`

| Topic | Locations |
|-------|-----------|
| Multi-tenancy / RLS | [`0001-multi-tenancy.md`](docs/architecture/decisions/0001-multi-tenancy.md), [`contabo-ops.md`](contabo-ops.md) §5.3, [`pending.md`](pending.md) |
| LLM / AI | [`0002-llm-strategy.md`](docs/architecture/decisions/0002-llm-strategy.md), [`imp/LLM-PROVIDER-WIRING.md`](imp/LLM-PROVIDER-WIRING.md), [`pending.md`](pending.md) (BullMQ) |
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
| Contabo ports / preflight | [`contabo-ops.md`](contabo-ops.md) §4, §12 |
| DonorDesk deployment ports | [`contabo-ops.md`](contabo-ops.md) §4 (table), §10 |
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
├── contabo-ops.md                   Live-host inventory & operations
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
    │       └── 0003-fastify-over-nestjs.md
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
| [`contabo-ops.md`](contabo-ops.md) | Deploying or troubleshooting production |
| [`Fixes.md`](Fixes.md) | Investigating signup/login/auth issues |
| [`imp/frontend-imp-plan.md`](imp/frontend-imp-plan.md) | Frontend portal architecture and phase scope |
| [`imp/DonorDesk — Phased Implementation Plan.md`](imp/DonorDesk%20—%20Phased%20Implementation%20Plan.md) | Architecture questions, adding new features |
| [`contabo-ops.md`](contabo-ops.md) | Deploying to Contabo (host inventory + release procedure) |
