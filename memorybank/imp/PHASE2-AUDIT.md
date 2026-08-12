# Phase 2 Implementation Audit

**Started:** 2026-08-12  
**Source of truth:** Phase 2 in `DonorDesk — Phased Implementation Plan.md` and repository evidence  
**Audited report:** `PHASE2-COMPLETION.md`  
**Current verdict:** **Not complete** — several useful primitives existed, but major items were unwired, insecure under concurrency or tenant overlap, untested against their real dependencies, or supported only by aspirational documentation.

## Confirmed findings and remediation

| ID | Severity | Requirement / claim | Evidence and remediation | Status |
|---|---|---|---|---|
| P2-001 | Critical | Tamper-evident immutable audit chain | A public hard-coded HMAC key allowed forgery; append used read-then-write without locking, allowing concurrent forks; tests reimplemented a different SHA algorithm and never exercised the repository. | **Fixed in code**: secret key, per-tenant PostgreSQL advisory transaction lock, deterministic ordering, exact-algorithm tests, optional PostgreSQL concurrency/tamper integration test. WORM notarization remains open. |
| P2-002 | Critical | Tenant-aware read replicas preserve RLS | `ReplicaRouter` stored `tenantId` but never applied it to primary or replica sessions. | **Fixed**: every URL receives `app.current_tenant` and an attributed `application_name`; invalid tenant identifiers are rejected and tested. Runtime read routing remains unwired. |
| P2-003 | High | PII vault uses configured derivation material | `kekDerivationSalt` was ignored, so changing it had no cryptographic effect. | **Fixed**: validated salt is included in tenant/region key derivation; tenant and salt isolation tests added. KMS envelope-key storage, versioned rotation, and application persistence remain open. |
| P2-004 | High | Data-residency selector and write enforcement | Contracts/UI exposed no selector, create persistence discarded the domain value, and OPA was not called anywhere. | **Fixed in application path**: signup selector, contracts, persistence, organization response/update, and authenticated write middleware using `DATA_RESIDENCY_REGION`; policy tests added. External OPA decision logging remains open. |
| P2-005 | High | Real-time collaboration is an operational gateway | Gateway was not registered with Fastify and `@fastify/websocket` was absent. Channels and socket maps were not tenant-scoped; non-members could publish edits. | **Fixed baseline**: WebSocket upgrade route registered, JWT authentication supported via authorization/protocol, 64 KiB limit, tenant namespaces, membership checks, and isolation tests. Redis pub/sub, Yjs CRDT, project authorization, origin enforcement, and multi-pod tests remain open. |
| P2-006 | High | Background jobs fail/retry correctly and isolate priorities | Custom worker prefix was ignored, `{success:false}` was treated as completion, and queues leaked on shutdown. | **Fixed adapter semantics**. Runtime container still uses `InMemoryJobQueue`; BullMQ handlers and Redis integration tests remain open. |
| P2-007 | High | Audit verifier CLI ships | Report called a repository method a shipped CLI. | **Fixed**: `audit:verify <tenant-id>` CLI added. Deployment/runbook invocation and CI against seeded audit events still need validation. |
| P2-008 | High | Nightly audit notarization to S3 Object Lock | No Object Lock audit bucket, notarization job, checkpoint format, or restore verifier exists. | **Open**. |
| P2-009 | High | RLS hardening with PgBouncer | RLS script exists, but no PgBouncer configuration or integration evidence exists. Phase 1 audit also records absent repository/endpoint isolation coverage. | **Open**. |
| P2-010 | High | PITR, monthly restores, RPO/RTO evidence | Terraform configures some backup retention, but no restore automation or completed drill artifact exists. Single-region RDS retains 7 days; global configuration uses 30, while the plan elsewhere specifies 35. | **Open**. Runbooks are procedures, not test evidence. |
| P2-011 | High | Cross-region failover tested | `ReplicaRouter` round-robin behavior is not a failover test. No dated test output or automated failover verification exists. | **Open**. The original DoD claim was false. |
| P2-012 | High | SOC 2 Type I evidence collected | A hash chain alone is not SOC 2 evidence collection. No control matrix, evidence index, owner/sign-off, or auditor artifact exists. | **External blocker / open**. |
| P2-013 | High | Breaking-glass admin MFA | A runbook mentions emergency rotation, but no MFA enforcement or tested breaking-glass identity flow exists. | **Open**. |
| P2-014 | Medium | Helm chart deploys the API reliably | ServiceAccount resource was missing, probes targeted nonexistent endpoints, ConfigMap accessed hyphenated keys incorrectly, external Secret naming was inconsistent, and default extra volumes duplicated built-ins. | **Fixed structurally**. Helm binary/dependency charts are unavailable locally, so render/install validation remains open. |
| P2-015 | Medium | CI security gates execute valid commands | Audit job referenced a nonexistent root test path. CodeQL used nonexistent `init-actions`/`analyze-actions` action names. | **Fixed**: package builds/tests and CodeQL v3 actions. Full hosted CI execution remains unverified. |
| P2-016 | Medium | Data residency is internally consistent | The OPA data-residency policy defaults `allow := true`, making its allow decision unsafe for unknown actions; tenant policy contains a cross-region violation rule but does not deny via its `allow` result. | **Open**: add policy tests and deny-by-default semantics before external OPA wiring. |
| P2-017 | Medium | Key rotation runbook is executable | Runbook references missing `scripts/reencrypt-deks.sql`, `scripts/reencrypt-all.js`, internal health endpoints, and schema columns that do not exist. Current PII ciphertext has no key-version envelope. | **Open**; runbook must not be used operationally yet. |
| P2-018 | Medium | Read-replica routing is production-integrated | Router exists but no repository/container uses it, no lag/health fallback exists, and no read-only enforcement test exists. | **Open**. |

## Implemented changes in this audit

- Hardened PII derivation and added isolation tests.
- Enforced tenant session settings on every replica connection.
- Made audit appends secret-keyed, transactional, serialized, and verifiable via CLI.
- Added a real PostgreSQL audit-chain integration test path for CI.
- Added data-residency contracts, signup UI, persistence, API output, and write middleware.
- Installed and registered the Fastify WebSocket transport.
- Added tenant/channel isolation, membership checks, payload validation, and gateway tests.
- Corrected BullMQ failure, prefix, and shutdown behavior.
- Corrected CI audit commands and CodeQL action names.
- Repaired key Helm deployment defects and aligned probes with implemented endpoints.
- Reopened the inaccurate Phase 2 completion report.

## Validation ledger

| Gate | Result during audit |
|---|---|
| Focused infrastructure build/tests | **Passed** |
| Contracts build/tests | **Passed** |
| API build/tests | **Passed**, including residency and collaboration tests |
| Workspace typecheck and lint | **Passed** on 2026-08-12 |
| Workspace production build | **Passed** on 2026-08-12 |
| Non-browser workspace tests | **Passed** on 2026-08-12 |
| Playwright | **Passed** — one Chromium login smoke test; Phase 2 browser coverage remains absent |
| PostgreSQL audit integration test | Configured for CI; skipped when `AUDIT_INTEGRATION_DATABASE_URL` is absent |
| Helm rendering | **Not run** — Helm executable/dependency charts unavailable locally |
| Terraform validation | **Not run** — Terraform executable unavailable locally |
| Redis/BullMQ integration | **Not present** |
| Multi-region failover/restore drill | **No evidence present** |

## Exit criteria

Phase 2 may be marked complete only after:

1. PII encryption is integrated into actual PII persistence with KMS/Vault-backed, versioned envelope keys and tested rotation.
2. Audit checkpoints are notarized nightly to retention-locked object storage and restore verification is tested.
3. PgBouncer/RLS and cross-tenant integration suites prove deny-by-default behavior.
4. Collaboration uses Redis pub/sub plus Yjs (or the plan is formally revised), enforces resource authorization, and passes multi-instance tests.
5. Production jobs use BullMQ priority pools with Redis integration/retry tests.
6. Read repositories use replica routing with read-only, lag, failure, and primary-fallback tests.
7. Terraform and Helm validate/render in CI, PITR is configured to the agreed retention, and a dated restore/failover drill meets RPO/RTO.
8. Breaking-glass MFA and key rotation execute against real, versioned keys.
9. OPA policies are deny-by-default, tested, wired into decisions, and retain decision logs.
10. A SOC 2 control/evidence matrix is reviewed and signed off by the responsible organization.
