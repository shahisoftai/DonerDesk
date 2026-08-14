# DonorDesk

Agent guidance for coding on DonorDesk.

## Build / test commands
- Install: `pnpm install`
- DB migrate + seed: `pnpm db:migrate && pnpm db:seed`
- Typecheck everything: `pnpm -r typecheck`
- Build everything: `pnpm -r build`
- Run API + Web together: `pnpm dev`

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

## Phase 1 deviations
Each swap point is an interface with a production target behind it. Current
state: PostgreSQL via Prisma, JWT auth, local file storage (dev default) with
Google Drive link-first primary / R2 optional via per-tenant
`Organization.storageProvider`, Kestra-or-BullMQ via `JOB_QUEUE` (memory
in-process default), stub LLM (dev default), pino logs, console email.
