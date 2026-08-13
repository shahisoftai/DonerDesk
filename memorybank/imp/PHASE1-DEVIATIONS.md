# Phase 1 deviations from the master plan

This file documents pragmatic engineering decisions made for Phase 1 to ship a working MVP
on a developer laptop without Docker/Kubernetes. Every deviation is a swap-point: the
production target lives behind an interface.

| Concern | Phase 1 (dev) | Phase 2 target (prod) | Swap cost |
|---|---|---|---|
| Database | PostgreSQL 16 via Prisma | Managed PostgreSQL 16 | Connection-string and deployment change only. |
| Multi-tenancy isolation | Repository tenant filters plus PostgreSQL RLS | Same, with managed connection pooling | Deployment/configuration change only. |
| Auth | JWT (HS256) issued by API; bcrypt password hashes | OIDC via Keycloak/Auth0 | Implement `OIDCAuthProvider` against the `IAuthProvider` port; no caller changes. |
| Object storage | Local filesystem (`./storage/`) | S3 + SSE-KMS | Implement `S3StorageAdapter` against `IStorage`; controllers don't change. |
| Queue / jobs | In-process memory queue (default) | Kestra (or BullMQ) via `JOB_QUEUE` | Selectable in `createJobQueue`: `memory` (default) → runs handlers in-process; `redis` → BullMQ adapter; `kestra` → Kestra flow trigger. Use-cases only call `IJobQueue.enqueue`. Production recommends `JOB_QUEUE=kestra` with `memory` as rollback. |
| LLM provider | Deterministic stub (rule-based fallback) | OpenAI / Anthropic / Bedrock via strategy | Set `LLM_PROVIDER=openai` + env keys; no code change. |
| Observability | Structured pino logs + request ID | OTel → Tempo/Prometheus/Loki | Add `@opentelemetry/sdk-node` boot; same span API. |
| Email | Logged to console (dev transport) | Postmark / SES | Implement `PostmarkEmailAdapter`. |

The hexagonal boundaries (domain → application → infrastructure → api) guarantee that
no business logic leaks into these infra choices.

**Kestra plugins (2026-08-13):** The free plugin set is now provisioned for the
Kestra adapter above — Apache Tika (document/OCR parsing), Redis (caching),
JDBC-Postgres (read-only analytics), and Google Drive + SFTP (inbound ingestion).
See `imp/KESTRA-PLUGINS.md`. GDrive/SFTP and the JDBC analytics flow are gated on
credentials/grants and are staged, not yet operational.
