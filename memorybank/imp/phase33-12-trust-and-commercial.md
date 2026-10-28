# Phase 33.12 — Trust and commercial (2026-10-29)

Four things: two-step sign-in a whole organisation can be required to use (built), a free-trial review (findings and fixes), an ISO/IEC 27001 readiness checklist (an honest map of what exists and what does not), and the self-hosting question (a decision memo, not code).

**Nothing here is a certification claim.** DonorDesk is not ISO 27001 certified and has not started a certification audit. The checklist is for preparing one.

---

## 1. Two-step sign-in, required per organisation (built)

- An administrator (`org.manage`) can require it from a chosen day: now, in a week, in two weeks, in a month (`Organization.mfaRequiredFrom`, migration `20261029140000_organization_mfa_required`). Settings → Security shows who has not set it up.
- **Before the day** everyone without it sees a reminder (a banner on every page, and on Security). **From the day**, a person without it can reach only their own two-step routes and sign-out: the API refuses anything else with `MFA_SETUP_REQUIRED` (`authMiddleware`, checked on every request, so a session opened earlier is held to it too), and the portal sends them to Security. After setting it up and saving the recovery codes they sign in again, now with a code.
- **Outside partners are covered**: the requirement applies to every user of the organisation, and partners now have a "Security" entry in their menu (the routes always worked for them; the menu never offered it).
- **No lock-out**: an administrator cannot require it before turning it on for themselves; while it is required nobody can turn their own off (an administrator can still reset someone who lost their phone: `ResetUserMfaHandler`).
- **Single sign-on** (`AUTH_PROVIDER=oidc`): the identity provider owns two-step sign-in, so the requirement is refused and has no effect.
- Pinned by: `packages/domain/test/mfa-requirement.test.mjs`, `packages/application/test/mfa-requirement.test.mjs`.
- Public wording: `/security` still says it "cannot yet be required for a whole organisation" and "is not yet available to outside partners". **Update that page when this is deployed** (it is true only after deploy).

## 2. Free-trial review

How it works today: `ProvisionTenantHandler` grants a `TRIAL` entitlement (14 days, TEAM or GROWTH) when sign-up asks for one, one per email fingerprint, only if the server flag `TRIALS_ENABLED=1` is set; expiry is lazy (the entitlement calculator ignores an ended window), the account falls back to the permanent free STARTER grant with all data kept, and a paid subscription supersedes the trial.

| # | Finding | Action |
|---|---|---|
| T1 | **Trials are switched off in production** (`TRIALS_ENABLED` is not set in `/opt/donordesk/shared/api.env`; the public flag `NEXT_PUBLIC_TRIALS_ENABLED` is a separate, web-only switch). Sign-up offering a trial grants nothing. | **Decision for the owner**: switch on or keep off. Nothing to change in code. Turn it on only together with T2 and after reading T3. |
| T2 | **The one-trial rule was trivially bypassed**: the fingerprint was the lower-cased address, so `name+2@…` or `n.a.m.e@gmail.com` started another trial. | Fixed: `canonicalEmail` drops the `+tag` everywhere and, for Gmail, the dots (and maps googlemail.com to gmail.com). Trials recorded the old way still count (`legacyEmailFingerprint`). Pinned in `trial-reminders.test.mjs`. |
| T3 | **The domain fingerprint is stored and never checked.** A company can still start a trial per colleague. | Not changed: it is a business rule. Options: allow (today), or cap trials per non-free-mail domain (say 3). Free-mail domains must never be blocked by domain. Owner decides. |
| T4 | **Nobody was told the trial was ending.** The only signal was a line on the billing page, so a workspace silently dropped to the free limits. | Fixed: administrators are told three days before, within a day before, and once after it ended (`dueTrialNotice`, sent from the hourly reminder run in the organisation's morning, once each through the reminder ledger; not sent to organisations that have subscribed). The message says nothing was deleted and where to choose a plan. |
| T5 | **What "falls back to free" means for work in progress** (projects over the free limit, storage, AI credits) is shown by `overLimit` in the entitlement, but the notice does not list it. | Not changed. Worth a line in the ended-trial notice once the free plan's limits are final. |
| T6 | A trial can be extended or ended by a platform administrator (`extendTrial` / `endTrial` in the control plane); both mutate the window in place and are audited there. | None. |
| T7 | No trial-to-paid conversion measurement (how many trials subscribe, when). | Out of scope here; needs an event on first subscription after a trial. |

## 3. ISO/IEC 27001:2022 readiness checklist

**How to read it.** Annex A has 93 controls in four themes. The table lists the controls that matter for this product and where the evidence is. Status: **In place** (built and tested or running), **Partial** (some of it), **Gap** (nothing yet), **Org** (a decision or policy for the organisation to make, not software). A certification also needs an ISMS around these: scope, risk assessment and treatment, a Statement of Applicability, internal audit and management review. **None of those exists yet.** Ask accredited certification bodies for a Stage 1 scope review before spending on more.

### Organizational (A.5)

| Control | Status | Evidence / what is missing |
|---|---|---|
| 5.1 Policies for information security | Gap | Engineering rules are in `AGENTS.md`; there is no approved security policy set (acceptable use, access control, cryptography, backup, incident). |
| 5.2–5.3 Roles, segregation of duties | Partial | Roles and a second-approver rule exist in the product (`checkApprover`, `Permissions`). No named security owner or written responsibilities for running the service. |
| 5.7 Threat intelligence | Gap | None. |
| 5.9–5.13 Asset inventory and classification | Partial | Evidence confidentiality levels with one reader table (`CONFIDENTIALITY_READERS`). No inventory of hosts, services and data stores outside `memorybank/contabo-ops.md`. |
| 5.15–5.18 Access control, identity, authentication, access rights | In place | Authorization table exhaustive by construction (a test fails if a route has no rule); project membership boundary; outside partners limited to a listed set of routes; SCIM; per-request check of role and status; sign-in lockout; passwords 12+ characters; two-step sign-in (required per organisation from this phase). Access *reviews* are manual (Team page). |
| 5.19–5.23 Suppliers and cloud services | Gap | Suppliers: Contabo (hosting), Creem (payments), the AI provider(s), Google (Drive, sign-in), mail. `/subprocessors` lists them publicly. No supplier register with assessments, contracts and exit plans. |
| 5.24–5.28 Incident management | Partial | Audit trail, runbooks (`runbooks/disaster-recovery.md`, `audit-verification.md`), health checks. No incident response procedure, severity scale, notification duty (GDPR 72 h) or contact tree. |
| 5.29–5.30 Continuity, ICT readiness | Partial | Encrypted scheduled backup, restore script that restores into a scratch database and records the test, off-host copy. Single host, single database, **no point-in-time recovery**, no tested recovery-time objective. |
| 5.31–5.34 Legal, privacy, IP | Partial | Terms, Privacy, DPA, sub-processors, refund policy pages; organisation data export; PII redaction before AI calls. No records of processing, DPIA, or retention schedule. |
| 5.35–5.36 Independent review, compliance with policies | Gap | No internal audit, no external penetration test. |
| 5.37 Documented operating procedures | Partial | Deploy and ops runbooks exist and are kept current in `AGENTS.md` / `memorybank`. |

### People (A.6)

| Control | Status | Evidence / what is missing |
|---|---|---|
| 6.1–6.6 Screening, terms, awareness, disciplinary, leaving | Org | Not software. Needed: written terms for staff and contractors, security awareness, an offboarding checklist (remove access to the host, repository, provider consoles). |
| 6.7 Remote working | Org | Admin access is by SSH key to one host; no written remote-work rule. |
| 6.8 Reporting security events | Gap | No channel stated for staff; customers use support mail. |

### Physical (A.7)

| Control | Status | Evidence / what is missing |
|---|---|---|
| 7.1–7.14 | Org | Inherited from the hosting provider's data centre; ask Contabo for its certificates (they publish ISO 27001 status for their data centres; verify, do not assume). The developers' own laptops (disk encryption, screen lock) are not covered by anything written. |

### Technological (A.8)

| Control | Status | Evidence / what is missing |
|---|---|---|
| 8.1–8.2 Endpoint, privileged access | Partial | Root SSH to the host (key); no bastion, no session recording. |
| 8.3 Information access restriction | In place | Row-level security forced on every tenant table (a test compares `schema.prisma` with `rls.sql`); evidence read rules shared by list, record and download. |
| 8.4 Source code access | Org | Git hosting access not documented. |
| 8.5 Secure authentication | In place | See 5.15–5.18; throttled in the database; TOTP with recovery codes; per-key hashes for API keys and share links. |
| 8.7 Malware protection | Partial | Uploads are limited by type and size, collection-form attachments are typed by their bytes; no virus scanning of uploads. |
| 8.8 Technical vulnerabilities | Gap | No scheduled dependency audit or patch routine for the host, Node, Python or the database is documented. |
| 8.9 Configuration management | Partial | Infra files copied into `infra/` (nginx, systemd, RLS); host drift is not detected. |
| 8.10 Information deletion | Partial | Deleting a demo project; evidence archive; no tenant-deletion procedure end to end, and backups keep deleted data until they rotate (`BACKUP_RETENTION_DAYS`). |
| 8.11 Data masking | In place | The PII firewall redacts names, e-mail addresses, phone numbers and similar before text reaches an AI provider; `LLM_PII_POLICY` is explicit. |
| 8.12 Data leakage prevention | Partial | Public links (collection, dashboard, share) are hash-only, expiring, revocable and rate limited; webhooks carry ids only; finance never leaves through a public link. |
| 8.13 Backup | In place | `scripts/backup.sh` refuses an unencrypted backup unless forced, rotates, records a run; `restore-backup.sh` proves a restore. Keys for evidence encryption at rest are not yet in use (the key needs a copy off the host first). |
| 8.15–8.17 Logging, monitoring, clock | Partial | Append-only audit log (database privileges revoked on update/delete), hash chain verified on a timer; application logs. No central log store, alerting or uptime monitoring documented. |
| 8.20–8.23 Network and web filtering | Partial | nginx in front, API bound to loopback, database not published, per-address and per-key rate limits on public routes, SSRF checks on outbound webhooks and connectors. No web application firewall. |
| 8.24 Cryptography | Partial | TLS (Let's Encrypt via the panel), bcrypt for passwords, AES-256-GCM for two-step secrets and connector keys, HMAC-signed webhooks. Evidence encryption at rest is built but off. No key-management policy; the master keys live in one environment file. |
| 8.25–8.29 Secure development and testing | In place | Domain / application / infrastructure / API / web suites; architecture boundaries tested; migration drift check; CI gate; deployment gate on a fresh green run. No static analysis or dependency scanning in CI, and changes are not peer reviewed (single developer). |
| 8.30 Outsourced development | n/a | None used. |
| 8.31–8.32 Environments, change management | Partial | Local → production only; there is no staging environment. Deploys snapshot the previous release and verify `/ready`; rollback is automatic on a failed verify. |
| 8.33 Test information | Partial | Demo tenant is marked and kept apart; production data is not used locally. |
| 8.34 Audit testing | Gap | No process for protecting production during an audit. |

### Order of work if certification is the goal

1. Decide the scope (the hosted service, one region, one production host) and name an owner for it.
2. Write the 8–10 policies above and a one-page risk assessment; build the Statement of Applicability from the table.
3. Close the cheap gaps that help every customer anyway: dependency audit and patch routine, uptime monitoring and alerts, an incident procedure, a supplier register, a second admin with access to the host, and an external penetration test.
4. Run one internal audit and one management review, then ask a certification body for Stage 1.

## 4. Self-hosting — decision memo

**The question.** Some customers (ministries, large INGOs, donors with data-sovereignty rules) ask to run DonorDesk themselves. Do we offer it?

**What a self-hosted DonorDesk would have to include today:** the Next.js web app, the Fastify API, the Python worker (FastAPI, OCR dependencies), PostgreSQL 16 with `pgvector`, an AI provider key (or a local model), a mail relay, optional Kestra, and nginx. Migrations are applied with Prisma as an owner role and then `infra/postgres/rls.sql` must be applied (the DO block stops at the first table the role does not own, so new tables are applied one by one today: that is not something a customer can be asked to do). Secrets live in `/opt/donordesk/shared/*.env`. Billing is Creem-based and assumes our hosted plan catalogue.

| Option | What it is | For | Against |
|---|---|---|---|
| A. Hosted only | Today. | One version, fast fixes, we control security and support. | Loses buyers who cannot use a shared service. |
| B. Dedicated hosted instance | The same software on a separate host or database per customer, run by us, on request (Enterprise). | Answers most "our own environment / our region" requests; we still operate, patch and back it up; no packaging work beyond a second deploy target. | More hosts to run; per-customer upgrades; needs the deploy script parametrised by target. |
| C. Customer self-hosted | A packaged release the customer runs. | Full sovereignty; air-gapped possible. | Large support and security burden (their patching, their backups, our bugs on hardware we cannot see); migrations and RLS application must become a single safe command; licensing and billing must change; AI needs a local model or their own key; version skew across customers. |

**Recommendation.** Offer **B** on request now (price it as Enterprise), and **do not build C** until there are at least three signed or paid-for requests, or one large one that funds it. Before C is ever promised, these prerequisites must exist: (1) one command that migrates, applies RLS to every tenant table and verifies the result (`pnpm db:migrate:deploy` is close; the per-table RLS step is not); (2) a container or compose bundle with an environment template and a preflight that refuses a bad configuration; (3) backup and restore scripts that work without our host's layout; (4) a licence key with an expiry that degrades to read-only, never to data loss; (5) an upgrade path with a migration check and rollback; (6) no calls home unless the customer allows them; (7) a support policy that states what we do and do not fix on their hardware.

**Decision needed from the owner:** B yes/no and its price; C not before the trigger above. Nothing is built for either in this phase.
