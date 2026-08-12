# ADR 0001 — Why shared-schema multi-tenancy with Postgres RLS (Phase 2 target)

## Context
DonorDesk is multi-tenant by design. The master plan compares database-per-tenant,
schema-per-tenant, and shared-schema-with-RLS approaches.

## Decision
Phase 2 target: shared-schema PostgreSQL with Row-Level Security, enforced by
`SET LOCAL app.current_tenant = $tenantId` inside a `TenantScopedConnection`.

Phase 1 dev convenience: SQLite via Prisma, with application-layer `WHERE tenantId`
in every repository. The `TenantContext` port is identical in both modes, so the
swap is a single connection-wrapper change.

## Consequences
- Every aggregate root carries `tenantId` as its **first** field.
- Every repository method receives `TenantContext` via constructor injection (DIP).
- Postgres session sets `app.current_tenant` before each query; RLS policies filter
  every row.
- Webhooks from Kestra include a signed `X-Tenant-Id` header + HMAC; the worker
  verifies before mutating.
- Audit log is partitioned by `tenant_id` for fast export and deletion
  (GDPR right-to-erasure).
