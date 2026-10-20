# Independent assurance: where DonorDesk stands and the path to it

**Position (honest):** DonorDesk holds no ISO 27001, SOC 2 or comparable certification and has not engaged an auditor. The public pages say so. This document is the readiness plan, so the answer to a procurement team's "do you have a SOC 2?" is "no, and here is what we have, what we are doing and when", not silence.

## 1. What exists today (evidence an auditor would ask for)

| Control area | What is in place | Where |
|---|---|---|
| Tenant isolation | Row-level security forced on every tenant table; per-request tenant session; a test fails when a tenant table has no policy | `infra/postgres/rls.sql`, schema↔RLS test |
| Access control | Seven roles, 32 permissions, deny-by-default route table with a coverage test; project membership as an access boundary; role/status re-checked each request | `apps/api/src/middleware/authorization.ts`, `project-boundary.ts` |
| Authentication | bcrypt, 12-character policy, durable lockout, single-use expiring reset tokens, SSO (OIDC/Google), SCIM provisioning | `identity` use cases |
| Audit trail | Hash-chained, append-only (the runtime role cannot UPDATE/DELETE), written in the same transaction as the change for sign-off, role and review actions; nightly chain verification | `audit/`, `donordesk-audit-verify.timer` |
| Change management | CI: build, typecheck, tests, web unit, journey, AI golden corpus, lint, gitleaks, Semgrep, Trivy, CodeQL, SBOM; migrations built from checked-in files; deploy script with preflight and rollback snapshots | `.github/workflows/ci.yml`, `scripts/deploy-fast.sh` |
| Backup and recovery | Nightly encrypted backup, rotation, a recorded restore drill | `scripts/backup.sh`, `restore-backup.sh`, DR runbook |
| Incident response | Runbook with severity model, 72-hour notification workflow, breach register | `runbooks/incident-response.md` |
| Data protection | Published DPA, privacy policy, sub-processor register; PII firewall on the AI path; restricted evidence withheld from the writer; read-time confidentiality enforcement; organisation export | `/dpa`, `/privacy`, `/subprocessors` |
| Vulnerability management | Dependency audit, SAST, secret scanning, image scan in CI | CI |

## 2. Known gaps (the honest list)

No MFA for tenant users. Single host, no failover; backups not yet copied off the host (needs a destination and a second copy of the passphrase). No point-in-time recovery. Evidence files are not encrypted at the application layer. No independent penetration test. No DAST. No formal risk register, policy set, access-review cadence, vendor-review process, or security-awareness record. Retention periods are qualitative. Tenant offboarding is operator-only.

## 3. Which assurance, and when

| Step | Why | Target |
|---|---|---|
| Close the gaps that block any audit: off-host backup, MFA, written policy set (access control, change, incident, backup, vendor, retention), risk register | An auditor cannot test controls that are not defined and recorded | Next two quarters |
| Control matrix mapping each control above to SOC 2 Trust Services Criteria (Security, Availability, Confidentiality) and to ISO 27001 Annex A, with an evidence index | Turns this document into the auditor's starting point | Quarter after |
| Independent penetration test (scoped: web, API, tenant isolation, SCIM, file access) | The single most requested artefact in NGO and donor due diligence; findings feed the matrix | Before the first audit window |
| **SOC 2 Type I** (point-in-time design), then **Type II** (6 months of operation) | Type II needs the controls to have run for the whole window, which these have only recently begun to | Type I within 12 months; Type II 6–9 months after |
| ISO 27001 only if a customer or donor requires it | Heavier (ISMS, management review); do SOC 2 first | On demand |

Owner: the platform owner. Review this document every quarter and after any incident. Do not state or imply a certification, an audit in progress or a target date externally until an auditor is engaged.

## 4. What to say to a buyer today

"We do not hold SOC 2 or ISO 27001. Our security page lists what we do and do not do. We can share our data-processing agreement, sub-processor list, audit-log and backup descriptions, and our readiness plan, and we will support your own security review."
