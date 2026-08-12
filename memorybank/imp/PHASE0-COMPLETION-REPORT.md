# DonorDesk Phase 0 Completion Report

**Report date:** 11 August 2026  
**Phase:** Phase 0 — Foundation  
**Assessment basis:** `memorybank/base/DonorDesk — Phased Implementation Plan.md`  
**Overall status:** **Completed and accepted**  
**Acceptance environment:** Linux host, Docker Engine 29.1.3, Docker Compose 2.40.3, Node 22.12.0, pnpm 10.34.5

## 1. Executive summary

The Phase 0 foundation has been implemented across architecture, tenancy, authentication, observability, infrastructure, CI/CD, security scanning, and automated testing.

All locally executable build, type, lint, unit, API, worker, browser, Compose-validation, and high/critical dependency-security checks pass. The application targets PostgreSQL 16 with forced Row-Level Security, supports OIDC authentication, exports OpenTelemetry traces, exposes Prometheus metrics, and includes reproducible development and cloud infrastructure definitions.

The runtime acceptance procedure in Section 8 has now been executed against the Compose stack. Tenant isolation was proven both at the API boundary and directly in PostgreSQL using the non-superuser application role, a real Authorization Code + PKCE browser login was completed against Keycloak, traces were confirmed in Tempo, and Kestra loaded the versioned workflow. Eight defects were found and fixed during the run; they are listed in `memorybank/imp/PHASE0-AUDIT.md`. Phase 1 may proceed.

## 2. Scope and definition of done

Phase 0 requires:

- A pnpm/Turborepo monorepo with strict architectural boundaries.
- A pure TypeScript domain foundation with entity and result abstractions.
- API health, readiness, metrics, and tenant-aware ping endpoints.
- Next.js authentication through OIDC.
- PostgreSQL with tenant Row-Level Security.
- OpenTelemetry traces, Prometheus metrics, structured logs, and Sentry PII controls.
- A reproducible local Kestra and observability environment.
- CI gates for formatting/linting, type checks, tests, security analysis, and infrastructure planning.
- Evidence that an authenticated request carries tenant context and produces an observable trace.

## 3. Implementation delivered

### 3.1 Monorepo and architecture

- pnpm workspace structure is operational across API, web, workers, domain, application, contracts, and infrastructure packages.
- Strict TypeScript checking is enabled, including unchecked-index and exactness protections.
- Domain code remains independent of infrastructure packages.
- Application handlers depend on ports; concrete adapters remain in infrastructure.
- Fastify is used in place of NestJS under the documented architecture decision.

### 3.2 API foundation

The API provides:

- `GET /health` for process liveness.
- `GET /ready` with an actual database query and `503` failure behavior.
- `GET /metrics` using the Prometheus exposition format.
- Authenticated `GET /v1/ping`, returning tenant context in both the body and `X-Tenant-Id` header.
- RFC 7807-style validation, domain, authorization, and internal error responses.
- Request identifiers and structured request logging.
- Graceful API and telemetry shutdown on `SIGINT` and `SIGTERM`.

### 3.3 Multi-tenancy and PostgreSQL

- PostgreSQL 16 is the active Prisma provider.
- A non-superuser `donordesk_app` runtime role is provisioned.
- Tenant tables have RLS enabled and forced.
- Policies deny access when `app.current_tenant` is absent and constrain reads and writes to the current tenant.
- Authenticated requests receive tenant-scoped Prisma connections configured with the tenant session value.
- Repository-level tenant filters remain as defense in depth.
- Tenant identifiers are constrained to a safe character set before use in connection options.
- Database migration and seed scripts now use consistent PostgreSQL connections.

### 3.4 Authentication and session security

- OIDC access tokens are verified using remote JWKS, issuer, audience, role, and `org_id` validation.
- The web application implements Authorization Code Flow with PKCE, state verification, and short-lived callback cookies.
- Session cookies are HTTP-only, `SameSite=Strict`, and secure in production.
- Keycloak realm configuration includes DonorDesk roles, client configuration, and an `org_id` claim mapper.
- Local HS256 JWT authentication remains available only as an explicit development fallback.
- Local login and signup are disabled when OIDC mode is active.
- Production startup rejects a missing JWT secret when the fallback provider is used.

### 3.5 Authorization and storage security

- API mutation routes enforce the defined role-permission matrix.
- Sensitive application handlers also enforce authorization independently of HTTP routing.
- Stored evidence and exports require authentication and matching tenant ownership.
- Local storage rejects path traversal outside the configured root.
- Credentialed CORS uses an explicit origin allowlist.
- File upload size is bounded.

### 3.6 Observability

- OpenTelemetry Node auto-instrumentation is enabled through configuration.
- Traces are exported using OTLP/HTTP to Tempo.
- Prometheus default process metrics, request totals, status labels, and duration histograms are exposed.
- Structured Fastify/Pino request logs include request correlation identifiers.
- Sentry integration disables default PII collection and removes cookies, request data, authorization headers, and cookie headers before transmission.
- Prometheus alert rules cover API availability and elevated server-error rates.
- Grafana datasource provisioning includes Prometheus, Tempo, and Loki.

### 3.7 Reproducible infrastructure

The development Compose environment defines:

- PostgreSQL 16
- Redis 7
- Keycloak
- Kestra
- Tempo
- Loki
- Prometheus
- Grafana

Terraform defines an AWS foundation with:

- A dedicated VPC and private subnets.
- An encrypted PostgreSQL 16 RDS instance.
- A database security group and subnet group.
- A private S3 evidence bucket.
- Public-access blocking, encryption, and bucket versioning.

### 3.8 CI/CD and security gates

The GitHub Actions workflow includes:

- Frozen-lockfile dependency installation.
- PostgreSQL service startup, migration, RLS application, and seed.
- TypeScript and Python type checking.
- TypeScript static checks and Python Ruff checks.
- Production builds.
- Node, Pytest, and Playwright test execution.
- Official npm production dependency audit.
- Gitleaks secret scanning.
- Semgrep static analysis.
- Trivy filesystem and dependency scanning.
- Terraform formatting, initialization, validation, and plan.

## 4. Automated test coverage added

Executable tests now exist for every workspace area:

| Area | Coverage introduced |
|---|---|
| Domain | Tenant identifiers, date ranges, permissions, and evidence state behavior |
| Contracts | Authentication input validation |
| Application | Handler-level authorization and repository non-access after denial |
| Infrastructure | Storage path-containment protection |
| API | Health, Prometheus metrics, authentication enforcement, and tenant-aware ping |
| Workers | Health response, model metadata, and sensitive-data warning behavior |
| Web | Playwright browser validation of accessible login controls and keyboard operation |

These tests replace the previous placeholder or manual-only test commands.

## 5. Verification results

The following checks passed during the completion audit:

| Check | Result |
|---|---|
| TypeScript builds | Passed |
| Next.js production build | Passed on Next.js 15.5.21 |
| TypeScript type checks | Passed |
| Python Mypy strict checks | Passed |
| Python Ruff checks | Passed |
| Domain tests | Passed |
| Contract tests | Passed |
| Application tests | Passed |
| Infrastructure tests | Passed |
| API foundation tests | Passed |
| Worker tests | 2 passed |
| Playwright browser test | 1 passed |
| Docker Compose configuration validation | Passed |
| Production dependency audit | No high or critical findings; seven moderate findings remain |
| Compose stack startup (8 services) | Passed |
| Prisma migration and RLS application | Passed; 18 tenant tables enabled and forced |
| Database seed | Passed |
| `GET /health`, `GET /ready` | `200`; `database: ok` |
| Unauthenticated `GET /v1/ping` | `401` |
| OIDC-authenticated `GET /v1/ping` | `200` with `x-tenant-id: demo-tenant` |
| Browser Authorization Code + PKCE login | Passed; dashboard renders tenant data |
| PostgreSQL cross-tenant denial (application role) | Passed; reads return 0 rows and writes raise a policy violation |
| API cross-tenant denial | Passed; `404` on read and update, empty list |
| Audit event on mutation | Passed |
| Trace visible in Tempo | Passed |
| Prometheus alert rules loaded | Passed |
| Kestra workflow loaded | Passed |

## 6. Security remediation completed

The audit identified and resolved vulnerable framework and infrastructure dependencies, including outdated Next.js, Fastify, multipart, OpenTelemetry, Archiver, PostCSS, Sharp, Glob, Protobuf, and Jaeger propagation dependency paths.

The final production dependency audit reports:

- Critical: **0**
- High: **0**
- Moderate: **7**
- Low: not used as a release-blocking threshold

CI is configured to fail on high or critical production dependency findings.

## 7. Deviations and limitations

### Accepted implementation decisions

- Fastify replaces NestJS under ADR 0003.
- Local filesystem storage, stub LLM behavior, logged development email, and local job execution remain Phase 1 swap-point decisions and are not Phase 0 acceptance blockers.
- HS256 authentication remains available for isolated local development, while OIDC is the intended deployed mode.

### Outstanding acceptance limitation

None. The runtime acceptance procedure in Section 8 was executed successfully. Two items
remain outside the application's control and are not acceptance blockers:

- Prometheus scraping the host-run API requires the host firewall to permit Docker-to-host
  traffic on port 4000 (`sudo ufw allow in on docker0 to any port 4000 proto tcp`). Rule
  evaluation itself was verified, since `DonorDeskApiDown` fired correctly while the port was
  blocked.
- The complete CI workflow still requires a green run on a pull request, which cannot be
  produced from a local host.

Defects discovered and fixed during the acceptance run are itemised in
`memorybank/imp/PHASE0-AUDIT.md`.

## 8. Runtime acceptance procedure

Run the following on a host where Docker Engine and Docker Compose are available:

```bash
docker compose -f infra/docker-compose.dev.yml up -d
docker compose -f infra/docker-compose.dev.yml ps
pnpm db:migrate
pnpm db:seed
./workflows/kestra/sync-flows.sh
pnpm dev
```

Then verify:

1. `GET /health` returns `200`. — **Passed**
2. `GET /ready` returns `200` with `database: ok`. — **Passed**
3. An unauthenticated `GET /v1/ping` returns `401`. — **Passed**
4. An OIDC-authenticated `GET /v1/ping` returns `200`, contains the expected tenant ID, and emits `X-Tenant-Id`. — **Passed**
5. A token for tenant A cannot read or mutate tenant B records, including through direct database queries using the application role. — **Passed**
6. Prometheus reports the API target as healthy. — **Requires the host firewall rule in Section 7**
7. A synthetic API request is visible as a trace in Tempo through Grafana. — **Passed**
8. Kestra starts successfully and loads the versioned workflows. — **Passed**
9. The complete CI workflow passes on a pull request. — **Pending; cannot be produced locally**

Evidence for each check is recorded in `memorybank/imp/PHASE0-AUDIT.md`.

## 9. Exit decision

**Implementation decision:** Phase 0 engineering work is complete.  
**Acceptance decision:** Phase 0 is accepted as of 11 August 2026 on the environment recorded at the top of this report.  
**Recommendation:** Phase 1 may commence. Apply the host firewall rule in Section 7 to complete the Prometheus scrape check, and confirm the CI workflow on the first pull request.
