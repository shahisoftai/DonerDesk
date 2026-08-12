# DonorDesk — Phased Implementation Plan (SOLID, Multi-Tenant, Future-Ready)

> A comprehensive engineering blueprint. Every choice below is justified by a principle (SOLID, DDD, Clean/Hexagonal, OWASP, 12-Factor, Cloud-Native, FinOps, AI governance). The plan is multi-tenant from day one, and it builds incrementally from a thin MVP to an enterprise-grade, AI-native, event-driven, observable, and policy-compliant platform.

---

## 0. Guiding Principles (the "why" before the "what")

| Principle | How it shows up in this plan |
|---|---|
| **S — Single Responsibility** | Each bounded context exposes one capability; each use case is one class. |
| **O — Open/Closed** | Adding a new evidence type, donor template, or LLM provider requires zero edits to core code (strategy + plugin registry). |
| **L — Liskov Substitution** | All storage, queue, search, and LLM adapters are behind interfaces; swap implementations without breaking callers. |
| **I — Interface Segregation** | Role interfaces (FieldOfficer, MEOfficer, etc.) are split per role; no fat `IUserService`. |
| **D — Dependency Inversion** | Domain owns zero infrastructure dependencies; everything is injected via ports. |
| **DDD (Strategic + Tactical)** | One bounded context per MVP module. Aggregates own invariants. Domain events everywhere. |
| **Hexagonal / Clean Architecture** | `domain` ← `application` ← `infrastructure` ← `api` / `worker`. |
| **Multi-tenancy** | Shared schema with `tenant_id` discriminator + Row-Level Security; tenant context threaded end-to-end. |
| **12-Factor** | Config in env, stateless processes, disposability, dev/prod parity, logs as event streams. |
| **Cloud-Native + IaC** | Everything is reproducible via Terraform/Pulumi; Kubernetes manifests per service; GitOps via ArgoCD/Flux. |
| **Secure-by-default (OWASP ASVS L2+)** | JWT/OIDC, RBAC + ABAC, PII at rest with envelope encryption, secrets in Vault, audit log immutability. |
| **AI Governance** | Source-linked outputs, PII redaction pre-LLM, model registry, prompt versioning, evaluation harness, human-in-loop gates. |
| **Observable-by-default (OpenTelemetry)** | Traces, metrics, logs with tenant + correlation IDs from the first commit. |
| **FinOps** | Per-tenant cost attribution, async AI work, vectorization + caching, model tiering. |
| **Policy-as-code** | OPA bundles for authorization and data residency. |

---

## 1. High-Level Architecture

```
                            ┌─────────────────────────┐
                            │   CDN + WAF (CloudFront │
                            │   / Cloudflare) + DDoS  │
                            └────────────┬────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │   Next.js BFF (Edge)     │
                            │   (RSC + Server Actions)│
                            └────────────┬────────────┘
                                         │ HTTPS / OIDC
                            ┌────────────▼────────────┐
                            │   API Gateway / NestJS  │
                            │   (REST + WebSocket)    │
                            └──┬──────┬──────┬────────┘
                               │      │      │
                ┌──────────────┘      │      └──────────────┐
                ▼                     ▼                     ▼
       ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
       │ Domain Services│   │  Kestra (OSS)  │   │  Async Workers │
       │ (NestJS modular│   │  Orchestration │   │  (Python: AI,  │
       │  monolith OR   │   │  Schedules     │   │   parsing, OCR)│
       │  microservices)│   │  Retries       │   │                │
       └────────┬───────┘   └───────┬────────┘   └────────┬───────┘
                │                   │                     │
                └───────────────────┴─────────────────────┘
                                    │
            ┌──────────┬──────────┬─┴────────┬──────────┬──────────┐
            ▼          ▼          ▼          ▼          ▼          ▼
        Postgres    Object     Vector     Redis      Kafka /     Vault
        (RLS)       Storage    DB         (cache,    NATS        (secrets)
                    (S3/MinIO) (pgvector)  rate-lmt)  (events)
```

**Rule of dependency direction**: `api` → `application` → `domain` ← `infrastructure`. Domain depends on nothing except standard library + its own abstractions.

---

## 2. Multi-Tenancy Model

**Chosen model**: Shared database, shared schema, `tenant_id` discriminator with **Postgres Row-Level Security (RLS)**.

Alternatives considered:
- Database-per-tenant: too heavy for the "small NGOs" tier.
- Schema-per-tenant: breaks shared analytics and AI vector index.

### 2.1 Tenant context propagation

- A `TenantContext` (AsyncLocalStorage in Node / ContextVars in Python) is set by the auth middleware from the JWT `org_id` claim.
- Every repository method receives `TenantContext` via constructor injection (DIP).
- A NestJS `APP_GUARD` (`TenantGuard`) validates the JWT, sets the context, and refuses cross-tenant access.
- Postgres session sets `app.current_tenant = $tenantId` before each query; RLS policies filter every row.
- Webhooks from Kestra include a signed `X-Tenant-Id` header + HMAC; the worker verifies before mutating.

### 2.2 Tenancy invariants

- Every aggregate root has `tenantId` as the **first** field and includes it in equality.
- Every domain event carries `tenantId` and `occurredAt`.
- Background workers must read tenant from a signed token, never from URL.
- Audit log is partitioned by `tenant_id` for fast export and deletion (GDPR right-to-erasure).

---

## 3. Repository / Project Structure (Clean + DDD, monorepo)

```
donordesk/
├── apps/
│   ├── web/                     # Next.js (App Router, RSC)
│   ├── api/                     # NestJS HTTP + WebSocket
│   └── workers/                 # Python (FastAPI) — AI, parsing, OCR
├── packages/
│   ├── domain/                  # Pure TS: entities, VOs, domain events, policies
│   ├── application/             # Use cases (commands/queries), ports (interfaces)
│   ├── infrastructure/          # Postgres, S3, Redis, Kafka, LLM, OCR adapters
│   ├── contracts/               # Zod schemas + OpenAPI, shared by api + web + workers
│   ├── ui/                      # shadcn/ui components, Tailwind tokens
│   └── sdk/                     # Generated TS client for partners
├── infra/
│   ├── terraform/               # AWS/GCP modules, Kestra cluster, RDS, S3, IAM
│   ├── helm/                    # K8s charts per service
│   ├── argocd/                  # GitOps apps
│   └── policies/                # OPA bundles, Kyverno policies
├── workflows/
│   └── kestra/                  # *.yml flows (versioned)
├── docs/
│   ├── architecture/            # C4 model, ADRs
│   ├── api/                     # OpenAPI
│   └── runbooks/
├── .github/workflows/           # CI: lint, type, test, security, IaC plan
├── AGENTS.md
└── turbo.json / pnpm-workspace.yaml
```

Tooling: **pnpm + Turborepo + Nx-compatible caching**. **TypeScript strict** everywhere (`"strict": true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

---

## 4. Bounded Contexts (Strategic DDD)

| Context | Aggregate Roots | Core Domain Events |
|---|---|---|
| **Identity & Access** | `Organization`, `User`, `Invitation`, `Role` | `UserInvited`, `UserActivated`, `RoleChanged` |
| **Projects** | `Project`, `ProjectMember` | `ProjectCreated`, `ProjectStatusChanged` |
| **Templates** | `DonorTemplate`, `TemplateVersion` | `TemplateUploaded`, `TemplateExtracted` |
| **Logframe** | `Logframe`, `Indicator`, `IndicatorUpdate` | `IndicatorUpdated`, `IndicatorVerified` |
| **Evidence** | `EvidenceFile`, `EvidenceTag` | `EvidenceUploaded`, `EvidenceTagged`, `EvidenceVerified` |
| **Activities** | `ActivityUpdate` | `ActivitySubmitted`, `ActivityApproved` |
| **Reporting** | `ReportingPeriod`, `ReportDraft`, `ReportSection` | `DraftGenerated`, `SectionApproved`, `ReportApproved` |
| **Compliance** | `Checklist`, `ChecklistItem` | `ChecklistItemResolved`, `ReadinessScoreChanged` |
| **Exports** | `ExportPackage` | `ExportRequested`, `ExportCompleted` |
| **Notifications** | `Notification`, `Reminder` | `ReminderScheduled`, `NotificationSent` |
| **Audit** | `AuditEvent` (append-only) | (writes only) |
| **Billing (later)** | `Subscription`, `Invoice` | `PlanChanged` |

**Context map**: `Projects` is the kernel. `Evidence`, `Logframe`, `Templates`, `Activities`, `Compliance`, `Reporting` are supporting. `Billing` and `Notifications` are generic. ACLs between Reporting ↔ Evidence and Compliance ↔ Reporting keep domains decoupled.

---

## 5. Phase Plan (6 phases, each independently shippable)

Each phase ends with a **Definition of Done** + measurable success criteria. No phase is "done" until observability, security, and tests are in.

### PHASE 0 — Foundation (1–2 weeks)

**Goal**: Empty shippable skeleton with multi-tenancy, auth, CI, IaC, observability. Zero business logic.

- pnpm + Turborepo monorepo.
- `packages/domain` skeleton (no entities yet, just `Entity<TId>` base + `Result<T,E>`).
- NestJS API skeleton with `/health`, `/ready`, `/metrics`, `/v1/ping`.
- Next.js BFF with login page + OIDC.
- Postgres + RLS policies (already enforced even on empty tables).
- GitHub Actions: lint (ESLint + Prettier), typecheck (tsc), unit (Vitest), e2e (Playwright), security (Trivy, Gitleaks, npm audit, Semgrep), IaC plan (Terraform).
- OpenTelemetry SDK in api + workers (traces → Tempo, metrics → Prometheus, logs → Loki).
- Sentry with PII scrubbing.
- Kestra OSS running in `infra/docker-compose.dev.yml`.

**DoD**: A PR to main triggers full pipeline green; `/v1/ping` returns 200 with `tenantId` header; OTel traces appear in Tempo for a synthetic request.

---

### PHASE 1 — MVP (Phase 1 + 2 from `MVP-features.md`)

**Scope**: Org + Project + Donor Template + Logframe + Evidence upload (manual tagging) + Activity Update + AI report draft + Missing-evidence checklist + PDF/Word export.

#### 5.1 Domain (in `packages/domain`)

```ts
// Base
export abstract class Entity<TId> { /* id, equals by id */ }
export class Result<T, E = DomainError> { /* ok/err, no exceptions for expected failures */ }
export abstract class DomainEvent { readonly occurredAt = new Date(); readonly eventId; }

// Example: Evidence aggregate
export class EvidenceFile extends Entity<EvidenceId> {
  private constructor(
    id: EvidenceId,
    readonly tenantId: TenantId,
    private props: EvidenceProps,
    private tags: EvidenceTag[],
    private version: number,
  ) { super(id); }

  static create(input: CreateEvidenceInput): Result<EvidenceFile> { /* invariants */ }
  attachTag(tag: EvidenceTag): Result<void>            // OCP
  verify(by: UserId): Result<void>                     // state machine
  changeConfidentiality(level): Result<void>           // policy check
  pullEvents(): DomainEvent[]                         // for outbox
}
```

Each aggregate:
- Validates invariants in `create` and state transitions.
- Emits **domain events** collected in an in-memory list, written via **outbox pattern**.
- Exposes only behavior, never raw setters (encapsulation, SRP).

**Value Objects** (immutable, validated): `TenantId`, `UserId`, `ProjectId`, `EvidenceId`, `Money`, `DateRange`, `Email`, `Url`, `IndicatorCode`, `ReportStatus`.

#### 5.2 Application layer (`packages/application`)

Use cases are **single-method command/query handlers** (CQRS-lite, no over-engineering):

```ts
export class UploadEvidenceHandler {
  constructor(
    private readonly tx: UnitOfWork,                 // DIP
    private readonly storage: IEvidenceStorage,      // port
    private readonly events: IEventBus,              // port
    private readonly tenant: TenantContext,          // ambient
    private readonly policy: EvidencePolicy,         // policy object
  ) {}

  async handle(cmd: UploadEvidenceCommand): Promise<Result<EvidenceId>> { /* ... */ }
}
```

Ports (interfaces) live next to use cases, not in `infrastructure`. Adapters in `infrastructure` implement them.

#### 5.3 Infrastructure (`packages/infrastructure`)

- **Postgres** via Prisma (typed, migrations). RLS enforced by `SET LOCAL app.current_tenant` in a `TenantScopedConnection`.
- **S3/MinIO** via presigned URLs; direct browser upload (zero-trust, never proxy file bytes through API).
- **Redis** for idempotency keys + read-through cache.
- **LLM provider** behind `ILLMProvider` with strategy registry (OpenAI, Anthropic, Bedrock, local Ollama). Source-citation prompt template lives in `infrastructure/llm/prompts/`.
- **Outbox relay** polls `outbox_events` table, publishes to Kafka/NATS.

#### 5.4 API (`apps/api`, NestJS)

- Modular: one folder per bounded context.
- Controllers thin → delegate to handlers.
- Global `ValidationPipe` with Zod schemas from `packages/contracts`.
- `AuthGuard` (JWT/OIDC), `TenantGuard`, `RoleGuard`, `PolicyGuard` (OPA).
- `Idempotency-Key` middleware backed by Redis.
- `HttpExceptionFilter` maps domain errors → RFC 7807 problem+json.
- Versioned routes: `/v1/...`.

#### 5.5 Web (`apps/web`, Next.js)

- App Router + RSC for read paths; Server Actions for writes (smaller bundle, same code path as API).
- shadcn/ui + Tailwind + Radix primitives. Tokens per tenant (logo, brand color) via CSS variables + `next/font` self-hosted.
- Optimistic UI for evidence uploads with TanStack Query + rollback.
- Offline-friendly field-officer form using IndexedDB queue + background sync (Service Worker).

#### 5.6 Workers (`apps/workers`, Python FastAPI)

- AI-heavy tasks (DOCX/PDF/XLSX parsing, OCR via Tesseract/Vision, LLM calls, embedding generation).
- Communicate via Kafka/NATS, not HTTP to API.
- Idempotent, retried with exponential backoff via Kestra.

#### 5.7 Orchestration (Kestra)

YAML flows in `workflows/kestra/`:

```yaml
id: extract_donor_template
namespace: donor_desk.phase1
inputs:
  - id: evidenceId
    type: STRING
tasks:
  - id: fetch
    type: io.kestra.plugin.core.http.Request
    uri: "{{ secrets.donordesk_api }}/internal/evidence/{{ inputs.evidenceId }}"
    headers:
      X-Internal-Token: "{{ secrets.kestra_internal_token }}"
  - id: parse
    type: io.kestra.plugin.scripts.python.Script
    script: |
      from app.parsers import parse
      parse(fetch.outputs.body)
  - id: tag
    type: io.kestra.plugin.scripts.python.Script
    script: |
      from app.tagging import suggest_tags
      suggest_tags(parse.outputs.text)
  - id: persist
    type: io.kestra.plugin.core.http.Request
    uri: "{{ secrets.donordesk_api }}/internal/evidence/{{ inputs.evidenceId }}/tags"
    method: POST
    body: "{{ tag.outputs | json }}"
```

Triggers: webhook on `evidence.uploaded`, scheduled nightly readiness recompute, deadline-based reminders.

#### 5.8 Security (Phase 1 baseline)

- OIDC via Keycloak (or Auth0/Cognito). JWT with `org_id`, `roles`, `scope`.
- RBAC via roles + ABAC via OPA policies (`data.donordesk.allow`).
- Secrets in HashiCorp Vault, injected via Kestra `secrets` and Kubernetes `ExternalSecret`.
- Object storage: SSE-KMS, bucket policy denies public access, presigned URLs max 15 min.
- Postgres: TLS in transit, pgcrypto for envelope encryption of PII columns, daily logical backups + 35-day retention.
- Rate limiting per tenant via Redis token bucket.
- PII redaction layer pre-LLM (emails, phone, IDs via Presidio).

#### 5.9 Observability (Phase 1 baseline)

- OpenTelemetry: traces (`http.route`, `tenant_id`, `user_id` attributes), metrics (`report_draft_duration_seconds`, `evidence_ai_tag_total`), structured JSON logs (`pino` / `structlog`).
- RED metrics per service: Rate, Errors, Duration.
- Audit log: append-only Postgres table + weekly export to S3 Object Lock (WORM) for tamper evidence.
- SLOs: dashboard-ready, alert rules in Prometheus.

#### 5.10 Testing strategy

- **Unit**: domain invariants (no mocks of domain), application handlers with in-memory adapters.
- **Integration**: Testcontainers (Postgres, Redis, MinIO, Kafka) per handler.
- **Contract**: Pact between `api` and `web`, plus async contract tests against Kestra webhooks.
- **E2E**: Playwright critical paths (sign up → create project → upload evidence → generate draft → export).
- **Property-based**: `fast-check` for invariants (date ranges, disaggregation sums).
- **AI eval harness**: golden dataset per donor template; regression block in CI.
- **Load**: k6 on `/exports` and `/ai/draft`.

**DoD for Phase 1**: 1 NGO pilot produces a real donor report with full evidence trail; readiness score correctly reflects state; audit log captures every mutation; p95 draft generation < 60s for ≤ 50 evidence items.

---

### PHASE 2 — Trust, Compliance, and Scale

**Goal**: SOC2/ISO 27001 readiness, multi-region, real-time collaboration.

- **PII vault** with deterministic encryption + searchable hashes (so we can find a record without decrypting all rows).
- **Data residency** selector per organization (EU/US/Africa/Asia); OPA policy denies cross-region egress.
- **RLS hardening**: deny by default, per-tenant connection pooling via PgBouncer with `app_name` carrying tenant.
- **Key rotation** runbook; quarterly KMS rotation; breaking-glass admin MFA.
- **Audit log immutability**: hash-chain (each row contains `prev_hash`), nightly notarization to S3 Object Lock.
- **Real-time**: WebSocket gateway (NestJS Gateway + Redis pub/sub) for collaborative report editing (Y.js CRDT).
- **Read replicas** with per-tenant read-only routing for heavy dashboards.
- **Background job isolation**: separate worker pool per priority (interactive drafts vs. bulk exports).
- **Backups**: PITR enabled, restore drills monthly, RPO 5 min / RTO 1 h documented.

**DoD**: SOC2 Type I evidence collected; OPA bundle versioned in CI; cross-region failover tested; audit hash chain verifier CLI ships.

---

### PHASE 3 — AI-Native Features

**Goal**: Make AI the durable moat without compromising trust.

- **Model registry** in DB (model id, version, provider, capabilities, cost, jurisdiction). Routing policy chooses cheapest compliant model.
- **Prompt registry** versioned, A/B tested; outputs include `promptVersion` and `modelVersion`.
- **Source-linked RAG**: every claim in a generated paragraph carries `[evidenceId, chunkId, score]`. Report editor shows inline provenance.
- **Evaluation harness**: BLEU/ROUGE + LLM-as-judge + human spot-checks on golden dataset; CI fails if score drops.
- **Feedback loop**: reviewers accept/reject AI suggestions → stored as preference signal → offline fine-tuning dataset.
- **Vector store**: pgvector (start), Qdrant or Weaviate (scale). Tenant-isolated namespaces; hybrid search (BM25 + dense).
- **OCR pipeline**: textract/Azure FR → embeddings → chunked (512 tokens, 50 overlap) → indexed.
- **PII firewall**: Microsoft Presidio + custom recognizers; reject/transform policy per tenant.
- **Self-host option**: swap `ILLMProvider` for `OllamaProvider` for the Private/Local Workspace tier.
- **Hallucination guard**: claim must be supported by ≥ 1 evidence chunk above threshold, else marked "Needs verification".

**DoD**: AI eval harness gates merges; 100% of generated claims have provenance or are flagged; tenant can disable AI features and still produce a manual report.

---

### PHASE 4 — Integrations & Ecosystem

**Goal**: Become the operating layer between NGO systems and donors.

- **Inbound**: Google Drive, OneDrive, Dropbox, SharePoint, S3 (file watchers → Kestra triggers).
- **Field data**: KoboToolbox, ODK Central, CommCare (webhook → Kestra → evidence ingest + indicator update).
- **HMIS**: DHIS2 routine data import; routine data reconciler (Kobo totals vs. DHIS2 totals).
- **Identity**: SCIM 2.0 provisioning for enterprise customers; SSO (SAML + OIDC).
- **Comms**: Slack/Teams/Email/WhatsApp Business for notifications.
- **Analytics**: Power BI / Metabase export via read-only materialized views.
- **Public API** + Webhooks for partners (e.g., country offices feeding HQ).
- **Donor portal** (read-only) with time-limited signed links for auditors.

**DoD**: 3 integrations in pilot; public API documented (OpenAPI 3.1, Postman collection, SDK in TS + Python).

---

### PHASE 5 — Enterprise & Sector Intelligence

**Goal**: Sell to INGOs and UN agencies; expand into sector intelligence.

- **Multi-region active-active** (Postgres logical replication per region, conflict-free aggregates per tenant).
- **Custom deployment** (BYOC: customer's own AWS/GCP account, our Helm chart, our control plane).
- **Sector template packs**: Nutrition, Food Security, WASH, Protection, Education — out-of-the-box donor templates + indicators.
- **Lessons-learned miner**: across projects, surface recurring challenges + mitigation patterns (cluster by sector + donor).
- **Risk trend analysis**: feed missing-evidence history + deadline slips into a risk score.
- **Advanced permissions**: ABAC with field-level redaction (e.g., finance officer sees money fields, M&E does not).
- **White-label** + custom domain + custom email sender (DMARC enforced).
- **Disaster recovery**: regional failover with documented RPO/RTO, quarterly game-days.

**DoD**: First INGO paid contract; SOC2 Type II report; ISO 27001 cert initiated.

---

### PHASE 6 — Continuous Evolution

- **Domain observability for code**: split into microservices per bounded context when a module's team grows (Conway's Law).
- **AI agents** (with human approval) for: weekly digest drafting, risk spotting, donor-template onboarding.
- **Open data**: anonymized, aggregated insights published for the humanitarian sector (with consent).
- **Policy updates**: follow IASC, OECD-DAC, Grand Bargain reporting standards as they evolve.

---

## 6. Cross-Cutting Concerns (apply in every phase)

### 6.1 SOLID applied concretely

| Principle | Concrete rule | Enforced by |
|---|---|---|
| SRP | One reason to change per class. Use cases = one class. | Code review checklist + ESLint `max-lines-per-function`. |
| OCP | New donor template / evidence type / LLM = new file, not edit of existing. | Plugin registry pattern; PR rule: no edits to closed modules. |
| LSP | All adapters must pass `AdapterContract` tests. | Contract test suite per port. |
| ISP | `IFieldOfficerUseCases`, `IMEUseCases`, `IProjectManagerUseCases` — not one fat interface. | TypeScript structural typing + review. |
| DIP | Domain depends on ports only. Imports from `infrastructure` are forbidden. | `dependency-cruiser` rule + ESLint `no-restricted-imports`. |

### 6.2 Clean Architecture layers (per bounded context)

```
src/contexts/evidence/
  domain/         # entities, VOs, events, policies (pure TS)
  application/    # use cases, ports (interfaces)
  infrastructure/ # adapters: Prisma, S3, LLM
  api/            # controllers, DTOs, mappers
```

`dependency-cruiser` forbids `domain` → `application/infrastructure/api`.

### 6.3 Multi-tenancy enforcement

- `TenantGuard` at every API entry (including webhooks).
- `TenantAwareRepository` base class auto-injects `WHERE tenant_id = $current`.
- Integration tests must include a `crossTenant.spec.ts` that fails if any endpoint leaks data.

### 6.4 Security baseline (OWASP ASVS L2 → L3)

- AuthN: OIDC, MFA for admins, short-lived access tokens + rotating refresh.
- AuthZ: OPA bundles per tenant tier.
- Input validation: Zod schemas at the edge (API + Server Action).
- Output encoding: React (default), explicit `Content-Type` on downloads.
- CSRF: SameSite=strict cookies + double-submit token for state-changing Server Actions.
- Dependency security: Renovate + weekly `npm audit --omit=dev` job + SBOM (CycloneDX) on release.
- SAST: Semgrep + CodeQL in CI.
- DAST: OWASP ZAP baseline scan nightly against staging.
- Secrets: Gitleaks pre-commit + Vault at runtime; no `.env` in prod.
- Logging: never log PII; `pino` redaction list enforced.

### 6.5 Data protection

- PII columns: encrypted via `pgcrypto` with per-tenant DEKs, KEK in KMS.
- Right to erasure: anonymize (do not delete) to preserve audit chain; user mapping table maps `userId → null` on erasure.
- Data export: signed URLs, expiring, audit-logged downloads.
- Backups encrypted with separate KMS key.

### 6.6 Performance budgets

- API p95 < 250 ms for non-AI endpoints.
- Evidence search p95 < 800 ms for 100k files / tenant.
- AI draft generation p95 < 90 s for 50 evidence items.
- Background: Kestra worker scales to 0 when idle (FinOps).

### 6.7 FinOps

- Per-tenant cost attribution via tagged AWS resources + OTel metrics → Grafana cost dashboard.
- Model tiering: small model for tagging, large for drafting.
- Embedding cache: skip re-embedding unchanged files (hash check).
- Spot instances for workers; on-demand for API.

### 6.8 Disaster recovery

- Postgres PITR, cross-AZ replicas.
- Object storage cross-region replication for disaster-recovery bucket only (cost).
- Kestra flows stateless; state in Postgres.
- Quarterly restore drill with documented RTO.

### 6.9 Internationalization & accessibility

- All UI strings via ICU MessageFormat; 5 languages from day one (English, Arabic, Urdu, French, Pashto — per concept doc).
- RTL-first layout; logical CSS properties (`margin-inline-start`).
- WCAG 2.2 AA enforced: axe-core in Playwright, keyboard navigation, screen-reader labels.

---

## 7. Concrete Tech Choices (justified)

| Concern | Choice | Why |
|---|---|---|
| Monorepo | pnpm + Turborepo | Fast, deterministic, cached. |
| Frontend | Next.js 15 App Router + RSC | SSR for SEO marketing, RSC for tenant dashboards, Server Actions reduce API surface. |
| UI | shadcn/ui + Tailwind + Radix | Accessible, headless, copy-paste so we own it. |
| API | NestJS (modular) → split per context later | DI built-in, fits SOLID, easy modular monolith → microservices. |
| Domain language | TypeScript (domain + application) | Same language as frontend reduces context-switch; pure TS strict mode. |
| Workers | Python FastAPI | Best AI/ML ecosystem; out-of-process so it never blocks API. |
| DB | PostgreSQL 16 + RLS + pgvector | ACID, JSONB for flexible fields, pgvector removes a service early. |
| ORM | Prisma (typed) + raw SQL for RLS policies | DX vs. control trade-off. |
| Migrations | Prisma Migrate + separate SQL files for RLS/policies | Policies not representable in Prisma schema. |
| Cache + rate-limit | Redis 7 | Battle-tested. |
| Object storage | S3 (prod) / MinIO (dev) | Standard, KMS-integrated. |
| Queue / Events | Kafka (prod) / NATS JetStream (dev) | Durable, replayable for outbox + audit. |
| Orchestration | Kestra OSS | Declarative, IaC-friendly, replaces bespoke queue. |
| Secrets | HashiCorp Vault + External Secrets Operator | No secrets in env at rest in K8s. |
| Auth | Keycloak (self-host) or Auth0/WorkOS (SaaS) | OIDC + SCIM + MFA. |
| AuthZ | OPA + decision logs | Versioned policies, auditable. |
| Observability | OpenTelemetry → Grafana Tempo + Prometheus + Loki + Sentry | Vendor-neutral, OTLP. |
| CI | GitHub Actions → build → push → ArgoCD | GitOps from day one. |
| IaC | Terraform + Helm + ArgoCD Apps | Mature, auditable. |
| Policy-as-code | OPA + Kyverno | Cluster admission + tenant policy. |
| LLM | Strategy: OpenAI, Anthropic, Bedrock, Ollama | Tenant-tier flexibility. |
| Vector | pgvector (start) → Qdrant (scale) | One less service early. |
| OCR | Tesseract (cheap) + AWS Textract / Azure FR (hard cases) | Tiered by cost. |
| PII | Microsoft Presidio | Open, extensible. |
| Test | Vitest + Playwright + Testcontainers + Pact + k6 | All layers covered. |
| Quality gates | SonarQube + CodeQL + Semgrep + Dependabot | Defense in depth. |
| Email | Postmark (transactional) + SES fallback | Deliverability for NGOs. |
| Background jobs SDK | BullMQ in-process (Phase 1) → Kestra (Phase 1+) | Smooth migration path. |

---

## 8. Data Model Highlights (additions over MVP spec)

- `outbox_events(id, tenant_id, aggregate_id, event_type, payload, created_at, published_at)` — transactional outbox.
- `audit_log(id, tenant_id, actor_id, action, entity_type, entity_id, before, after, prev_hash, hash, created_at)` — hash-chained.
- `llm_runs(id, tenant_id, model_id, prompt_version, input_hash, output, cost_usd, latency_ms, status, created_at)` — cost + governance.
- `embeddings(tenant_id, evidence_id, chunk_index, vector vector(1536), text_hash)` — pgvector.
- `webhooks(id, tenant_id, url, secret_hash, events[], created_at)` — outbound partner webhooks.
- `feature_flags(tenant_id, key, enabled, variant)` — gradual rollout.
- `policies(id, tenant_id, tier, region, data_residency, ai_allowed, version)` — driven by billing + tenant choice.

---

## 9. API Conventions (REST + WebSocket + Webhooks)

- REST: `/v1/{context}/{action}` (resource-oriented), JSON, problem+json errors, idempotency keys for writes.
- WebSocket: `/v1/ws` with JWT in query, multiplexed channels per `reportingPeriodId` for collaborative editing.
- Webhooks outbound: signed (HMAC SHA-256), timestamped, retried with exponential backoff via Kestra.
- Internal: service-to-service via mTLS + service tokens (no shared secrets across services).
- Versioning: URL-based for now; deprecation policy: 6 months notice + `Sunset` header.

---

## 10. AI Governance & Safety

- **Prompt registry** with versions + change log.
- **Model card** per registered model (capabilities, limits, jurisdiction, cost).
- **Output schema** enforced (Zod) for every AI call → invalid outputs are retried or fall back to template.
- **Provenance**: every AI-generated paragraph carries source IDs.
- **Confidence + uncertainty**: low-confidence claims flagged in UI.
- **PII firewall**: pre-LLM scrubbing + post-LLM detection; abort on leak.
- **Human-in-loop gates** on: template extraction, report draft, export with sensitive data.
- **Bias + quality eval**: golden dataset per sector; CI gate.
- **Tenant controls**: per-tenant "AI allowed" flag; per-feature toggles.

---

## 11. CI/CD & Release

- Trunk-based development, short-lived feature branches, conventional commits.
- CI pipeline (every PR): install → lint → typecheck → unit → integration → contract → build → SBOM → security scans → preview deploy.
- CD: merge to `main` → image built and signed (cosign) → pushed to registry → ArgoCD syncs to staging → manual approval → production (blue/green).
- Migrations: forward-only; backward-compatible for 1 release; online `ddl` where possible; expand-and-contract pattern.
- Feature flags for risky rollouts.
- Database: shadow writes + read replica comparison for risky migrations.

---

## 12. Documentation as Code

- `docs/architecture/decisions/*.md` — ADRs (MADR template) for every major choice.
- OpenAPI 3.1 generated from Zod → `packages/contracts`.
- Storybook for UI components.
- TypeDoc for domain + application packages.
- Runbooks in `docs/runbooks/` per alert.
- `AGENTS.md` for AI coding agents; this very plan referenced.

---

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Tenant data leak | RLS + cross-tenant test suite + OPA policy test in CI. |
| AI hallucination in donor reports | Source-linked claims + human approval gate + eval harness. |
| PII exposure to LLM | Presidio redaction + per-tenant AI flag + audit of LLM calls. |
| Vendor lock-in (LLM) | Strategy pattern + model registry + on-prem option. |
| Cost overrun (LLM) | Model tiering + embedding cache + per-tenant budget alerts. |
| Long-running jobs blocking API | Kestra + dedicated worker pool + backpressure. |
| Multi-region complexity | Start single-region with multi-AZ; add regions only when paid demand exists. |
| Pilot NGO churn | Service-assisted pilot, weekly feedback loop, dedicated CSM. |

---

## 14. Team Topology (Conway's Law applied)

- **Team A — Core Platform**: auth, multi-tenancy, infra, payments.
- **Team B — Reporting & Evidence**: bounded contexts `Evidence`, `Logframe`, `Activities`, `Reporting`, `Compliance`.
- **Team C — AI & Integrations**: workers, prompt registry, eval harness, partner integrations.
- **Team D — Web & Design**: Next.js, design system, accessibility, i18n.

Each team owns one or more bounded contexts end-to-end (you build it, you run it, you support it).

---

## 15. Definition of Done (per phase, generic)

- [ ] Code merged with passing pipeline (lint, types, tests, security).
- [ ] OpenAPI updated; Postman collection regenerated.
- [ ] OTel traces + dashboards updated.
- [ ] ADRs written for non-obvious decisions.
- [ ] Threat model updated (`docs/security/threat-model.md`).
- [ ] Runbooks updated for new alerts.
- [ ] Feature flag default = off; gradual rollout plan documented.
- [ ] Pilot NGO feedback channel (Slack/email) ready.
- [ ] Cost projection (FinOps) recorded.

---

## 16. Immediate Next Steps (concrete, this week)

1. Bootstrap monorepo with pnpm + Turborepo + Next.js + NestJS + FastAPI skeletons.
2. Wire Postgres + RLS on a single `organizations` table; write the first cross-tenant test.
3. Stand up Kestra in `docker-compose.dev.yml`; deploy `hello_donordesk` flow.
4. Author the first ADR: "Why shared-schema multi-tenancy with RLS".
5. Create `docs/architecture/c4/` with the 4 C4 diagrams.
6. Write the first golden dataset for AI eval (10 sample donor templates).
7. Set up Sentry + Grafana Cloud free tier; instrument `apps/api` with OTel.

---

## 17. North-Star Metrics (revisited quarterly)

- **Adoption**: MAOs, projects/org, reports/org/month.
- **Reliability**: 99.9% API uptime, p95 draft < 90s, cross-tenant tests 0 failures.
- **Trust**: % AI claims with provenance, audit chain verified monthly, PII leaks = 0.
- **Speed**: median report ready-to-submit time, evidence-to-draft latency.
- **Unit economics**: AI cost / report, gross margin per tier.

---

## 18. Closing Note

This plan is **ambitious but sequenced**. Phase 0–1 ships value in 6–10 weeks. Phases 2–5 are gated by real customer demand, not by premature optimization. Every phase adheres to the same engineering bar: SOLID, hexagonal boundaries, multi-tenant by default, observable by default, secure by default, AI-governed by default.

The moat will not be "we use AI." It will be:
1. **Trust** (source-linked outputs, audit chain, data residency, human-in-loop).
2. **Workflow** (one workspace replacing 6 tools).
3. **Compliance** (the readiness score becomes the donor's first question: "what's your DonorDesk score?").

Build that, and the rest follows.
