# DonorDesk

AI-assisted donor reporting, evidence management, and compliance platform for NGOs and humanitarian programmes.

## Monorepo layout

```
apps/
  api/        Fastify HTTP API (modular monolith — one module per bounded context)
  web/        Next.js BFF + Server Actions
  workers/    Python FastAPI — document parsing + AI helpers
packages/
  domain/         Pure TS: entities, value objects, domain events, policies
  application/    Use cases (CQRS-lite handlers) + ports
  infrastructure/ Prisma, storage, LLM, auth adapters
  contracts/      Zod schemas + OpenAPI (shared API surface)
  ui/             Tailwind tokens + reusable React components
  sdk/            Generated TS client for partners
infra/         Terraform, Helm, ArgoCD, OPA policies
workflows/     Kestra flows
docs/          ADRs, threat model, runbooks
```

## Quick start

```bash
# Install
pnpm install

# Start PostgreSQL, OIDC, Kestra, and observability dependencies
docker compose -f infra/docker-compose.dev.yml up -d

# Database (PostgreSQL 16 with tenant RLS)
pnpm db:migrate
pnpm db:seed

# Deploy the versioned Kestra flows
./workflows/kestra/sync-flows.sh

# Run all apps
pnpm dev

# Web:        http://localhost:3000
# API:        http://localhost:4000
# Workers:    http://localhost:5000
# Keycloak:   http://localhost:8081
# Kestra:     http://localhost:8080
# Grafana:    http://localhost:3001
```

Default seed login: `admin@example.org` / `password123`.

On Linux hosts running `ufw`, allow Prometheus to scrape the host-run API:

```bash
sudo ufw allow in on docker0 to any port 4000 proto tcp
```

## Engineering principles

- **SOLID** + Clean/Hexagonal architecture. Domain owns zero infra deps.
- **Multi-tenant by default** — every aggregate carries `tenantId`; every repository enforces it.
- **AI is an assistant, not an author** — every AI output is reviewable, editable, source-linked, and human-approved.
- **Observable + secure by default** — structured logs, request IDs, audit log on every mutation.

See `docs/architecture/decisions/` for ADRs and `memorybank/base/` for the full phased plan.

## Phase status

- [x] **Phase 0** — Foundation; implemented and runtime-accepted (see `memorybank/imp/PHASE0-AUDIT.md`)
- [x] **Phase 1** — MVP (Org + Project + Template + Logframe + Evidence + Activity + AI Draft + Checklist + Export)
- [ ] **Phase 2** — Trust, Compliance, and Scale (Postgres+RLS, SOC2)
- [ ] **Phase 3** — AI-Native Features
- [ ] **Phase 4** — Integrations
- [ ] **Phase 5** — Enterprise
- [ ] **Phase 6** — Continuous Evolution

## License

Proprietary — © DonorDesk.Online.
