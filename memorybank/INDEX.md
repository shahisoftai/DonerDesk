# DonorDesk MemoryBank Index

**Last updated:** 2026-08-12

Quick reference guide to all memorybank documents. Use `Ctrl+F` / `Cmd+F` to search within files.

---

## Quick Navigation

| Need | Go to |
|------|-------|
| **What is DonorDesk?** | [`base/DonorDesk — Initial Concept Document.md`](base/DonorDesk%20—%20Initial%20Concept%20Document.md) |
| **Why build it? (Executive pitch)** | [`base/DonorDesk — One-Page Concept Note for Approval.md`](base/DonorDesk%20—%20One-Page%20Concept%20Note%20for%20Approval.md) |
| **Full engineering blueprint** | [`imp/DonorDesk — Phased Implementation Plan.md`](imp/DonorDesk%20—%20Phased%20Implementation%20Plan.md) |
| **Production issues & fixes** | [`Fixes.md`](Fixes.md) |
| **What still needs doing** | [`pending.md`](pending.md) |
| **Contabo host operations** | [`contabo-ops.md`](contabo-ops.md) |
| **Deploy to Contabo** | [`docs/CONTABO-LEAN-DEPLOYMENT.md`](docs/CONTABO-LEAN-DEPLOYMENT.md) |

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
| [`docs/architecture/decisions/0001-multi-tenancy.md`](docs/architecture/decisions/0001-multi-tenancy.md) | ADR: shared-schema + Postgres RLS |
| [`docs/architecture/decisions/0002-llm-strategy.md`](docs/architecture/decisions/0002-llm-strategy.md) | ADR: LLM provider abstraction via strategy pattern |
| [`docs/architecture/decisions/0003-fastify-over-nestjs.md`](docs/architecture/decisions/0003-fastify-over-nestjs.md) | ADR: Fastify over NestJS for Phase 1 |
| [`docs/security/threat-model.md`](docs/security/threat-model.md) | Security threat model |
| [`docs/api/openapi-3.1.json`](docs/api/openapi-3.1.json) | OpenAPI spec |

### 🚀 Implementation Phases
| Phase | Status | Completion Report | Audit |
|-------|--------|-------------------|-------|
| Phase 0 — Foundation | ✅ Complete | [`imp/PHASE0-COMPLETION-REPORT.md`](imp/PHASE0-COMPLETION-REPORT.md) | [`imp/PHASE0-AUDIT.md`](imp/PHASE0-AUDIT.md) |
| Phase 1 — MVP Core | ✅ Complete | [`imp/PHASE1-COMPLETION.md`](imp/PHASE1-COMPLETION.md) | [`imp/PHASE1-AUDIT.md`](imp/PHASE1-AUDIT.md) |
| Phase 1 Deviations | ⚠️ See doc | [`imp/PHASE1-DEVIATIONS.md`](imp/PHASE1-DEVIATIONS.md) | — |
| Phase 2 — Trust & Scale | ✅ Complete | [`imp/PHASE2-COMPLETION.md`](imp/PHASE2-COMPLETION.md) | [`imp/PHASE2-AUDIT.md`](imp/PHASE2-AUDIT.md) |
| Phase 3 — AI-Native | ✅ Complete | [`imp/PHASE3-COMPLETION.md`](imp/PHASE3-COMPLETION.md) | [`imp/PHASE3-AUDIT.md`](imp/PHASE3-AUDIT.md) |
| Phase 4 — Integrations | ✅ Complete | [`imp/PHASE4-COMPLETION.md`](imp/PHASE4-COMPLETION.md) | [`imp/PHASE4-AUDIT.md`](imp/PHASE4-AUDIT.md) |
| Phase 5 — Enterprise | ✅ Complete | [`imp/PHASE5-COMPLETION.md`](imp/PHASE5-COMPLETION.md) | [`imp/PHASE5-AUDIT.md`](imp/PHASE5-AUDIT.md) |

### 🛠️ Operations & Deployment
| File | Purpose |
|------|---------|
| [`contabo-ops.md`](contabo-ops.md) | **Live-host inventory** — verified Contabo server state, ports, services, DOs/DON'Ts, preflight checks (488 lines) |
| [`docs/CONTABO-LEAN-DEPLOYMENT.md`](docs/CONTABO-LEAN-DEPLOYMENT.md) | Step-by-step Contabo deployment runbook (732 lines) |
| [`docs/runbooks/DISASTER-RECOVERY.md`](docs/runbooks/DISASTER-RECOVERY.md) | DR procedures |
| [`docs/runbooks/BYOC-DEPLOYMENT.md`](docs/runbooks/BYOC-DEPLOYMENT.md) | Bring-your-own-cloud deployment |
| [`docs/runbooks/alerts.md`](docs/runbooks/alerts.md) | Alert definitions |
| [`docs/runbooks/key-rotation.md`](docs/runbooks/key-rotation.md) | Key rotation runbook |

### 🐛 Issues & Tracking
| File | Purpose |
|------|---------|
| [`Fixes.md`](Fixes.md) | **Production fixes applied** — signup/login 500 errors, RLS, OLS Origin header, advisory lock (69 lines) |
| [`pending.md`](pending.md) | **Outstanding items** — production hardening, async/AI features, observability (64 lines) |
| [`features.md`](features.md) | Feature tracking (currently empty) |

---

## Key Decisions (ADRs)

| # | Decision | File |
|---|----------|------|
| 1 | Shared-schema PostgreSQL + RLS for multi-tenancy | [`0001-multi-tenancy.md`](docs/architecture/decisions/0001-multi-tenancy.md) |
| 2 | LLM strategy pattern with provider abstraction | [`0002-llm-strategy.md`](docs/architecture/decisions/0002-llm-strategy.md) |
| 3 | Fastify over NestJS for Phase 1 | [`0003-fastify-over-nestjs.md`](docs/architecture/decisions/0003-fastify-over-nestjs.md) |

---

## Searchable Topic Index

**Jump to:** `Ctrl+F` / `Cmd+F`

| Topic | Locations |
|-------|-----------|
| Multi-tenancy / RLS | [`0001-multi-tenancy.md`](docs/architecture/decisions/0001-multi-tenancy.md), [`contabo-ops.md`](contabo-ops.md) §5.3, [`pending.md`](pending.md) |
| LLM / AI | [`0002-llm-strategy.md`](docs/architecture/decisions/0002-llm-strategy.md), [`pending.md`](pending.md) (BullMQ, real LLM) |
| API bind (0.0.0.0 issue) | [`contabo-ops.md`](contabo-ops.md) §4, §10, [`pending.md`](pending.md) |
| OpenLiteSpeed / Origin header | [`Fixes.md`](Fixes.md) §2, [`contabo-ops.md`](contabo-ops.md) §7 |
| PostgreSQL advisory lock | [`Fixes.md`](Fixes.md) §3 |
| RLS / table privileges | [`Fixes.md`](Fixes.md) §4, [`contabo-ops.md`](contabo-ops.md) §5.3 |
| Backup / DR | [`contabo-ops.md`](contabo-ops.md) §9, [`pending.md`](pending.md) |
| Contabo ports / preflight | [`contabo-ops.md`](contabo-ops.md) §4, §12 |
| DonorDesk deployment ports | [`contabo-ops.md`](contabo-ops.md) §4 (table), §10 |
| Versioned migrations | [`pending.md`](pending.md) |
| BullMQ / Redis | [`pending.md`](pending.md) |
| S3 storage | [`pending.md`](pending.md) |
| Kestra flows | [`pending.md`](pending.md) |
| SSH hardening | [`contabo-ops.md`](contabo-ops.md) §8, [`pending.md`](pending.md) |

---

## File Tree

```
memorybank/
├── INDEX.md                          ← YOU ARE HERE
├── Fixes.md                          Production fixes applied
├── pending.md                        Outstanding items
├── features.md                       Feature tracking
├── contabo-ops.md                   Live-host inventory & operations
├── base/
│   ├── DonorDesk — Initial Concept Document.md
│   ├── DonorDesk — One-Page Concept Note for Approval.md
│   └── MVP-features.md
├── imp/
│   ├── DonorDesk — Phased Implementation Plan.md
│   ├── MVP-features.md
│   ├── PHASE0-COMPLETION-REPORT.md
│   ├── PHASE0-AUDIT.md
│   ├── PHASE1-COMPLETION.md
│   ├── PHASE1-AUDIT.md
│   ├── PHASE1-DEVIATIONS.md
│   ├── PHASE2-COMPLETION.md
│   ├── PHASE2-AUDIT.md
│   ├── PHASE3-COMPLETION.md
│   ├── PHASE3-AUDIT.md
│   ├── PHASE4-COMPLETION.md
│   ├── PHASE4-AUDIT.md
│   ├── PHASE5-COMPLETION.md
│   └── PHASE5-AUDIT.md
└── docs/
    ├── CONTABO-LEAN-DEPLOYMENT.md
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
| [`imp/DonorDesk — Phased Implementation Plan.md`](imp/DonorDesk%20—%20Phased%20Implementation%20Plan.md) | Architecture questions, adding new features |
| [`docs/CONTABO-LEAN-DEPLOYMENT.md`](docs/CONTABO-LEAN-DEPLOYMENT.md) | Deploying to Contabo |
