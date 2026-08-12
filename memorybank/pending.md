# Pending

Outstanding and in-progress items for DonorDesk. Last updated: 2026-08-12.

## High priority — production hardening

- [ ] **API bind to loopback only.** `donordesk-api` currently listens on
  `0.0.0.0:4001` instead of `127.0.0.1:4001`. Make the API respect `HOST`
  (default loopback in production) and re-verify via `ss`.
  - Repo evidence: API server hard-codes `0.0.0.0`; see `docs/CONTABO-LEAN-DEPLOYMENT.md` §4.
- [ ] **Versioned migrations committed.** Generate, review, commit, and test the
  Prisma migrations (currently `packages/infrastructure/prisma/migrations/` is
  untracked). Use `prisma migrate deploy` only — never
  `db push --accept-data-loss`.
- [ ] **Off-host backups configured.** Implement encrypted off-host backup for the
  `donordesk` PostgreSQL database and `/opt/donordesk/shared/storage` before
  accepting production data. Record destination, retention, last success,
  checksum, and restore-test evidence. Local WAL archive is not DR.
- [ ] **Add the RLS step to the release procedure.** The RLS grants + policy were
  applied manually during the 2026-08-12 fix. Bake `infra/postgres/rls.sql`
  (extended to all 28 tenant tables) into the deployment runbook so it runs on
  every release, and keep `infra/postgres/rls.sql` in sync with the schema.
- [ ] **Document `API_INTERNAL_URL` and the OLS `Origin` dedupe requirement** in
  the deployment doc so future releases build web with
  `API_INTERNAL_URL=http://127.0.0.1:4001` and keep `src/middleware.ts`.

## Medium priority — async / AI features (Stage B)

- [ ] **Wire BullMQ / Redis.** `InMemoryJobQueue` is always selected. Create a
  dedicated Redis ACL user (`dd:*`), wire and test the BullMQ factory, and set
  `JOB_QUEUE=redis` only after the adapter is runtime-wired and tested.
- [ ] **Wire real LLM providers.** LLM handlers currently use stubs (evidence
  tagger, activity polisher, report draft generator, checklist detector). Wire
  provider-specific implementations and set `LLM_PROVIDER` only when ready.
- [ ] **Implement S3 storage.** Only `LocalStorage` exists. Implement object
  storage before claiming `STORAGE_BACKEND=s3`.
- [ ] **Implement email/notification delivery.** Notifications currently log
  only. Implement production email/in-app delivery before enabling.
- [ ] **Integrate worker service.** FastAPI worker routes exist but have no
  production caller. Authenticate and integrate, or omit the service.
- [ ] **Kestra flow.** The checked-in flow references nonexistent internal
  routes/modules. Replace with tested contracts, or omit.

## Observability / operations

- [ ] **OTel tracing.** OTel is disabled by default; set exact enable/endpoint
  variables and test trace ingestion before adding Tempo.
- [ ] **Loki/Alloy pipeline.** No pipeline or persistence exists. Implement fully
  or omit Loki.

## Lower priority / shared-host hardening (separate, reviewed changes)

- [ ] **PostgreSQL loopback trust → SCRAM.** `pg_hba.conf` trusts all IPv4
  loopback. Change to `scram-sha-256` in a separately tested window (affects all
  colocated apps).
- [ ] **SSH hardening.** Root login + password auth enabled. Schedule a tested,
  recovery-safe change.
- [ ] **Investigate NeureCore backend restarts** (4,822 observed) before relying
  on aggregate host headroom.

## Feature-specific pending work

### Feature 01 — Authentication and Onboarding
- [ ] Complete password reset flow with email delivery
- [ ] Email verification on signup
- [ ] Onboarding wizard progress persistence

### Feature 05 — Donor Template Manager
- [ ] Copy-paste text template input
- [ ] DOCX parsing for template content extraction
- [ ] PDF parsing for template content extraction

### Feature 06 — Logframe and Indicator Manager
- [ ] Excel/CSV logframe file import
- [ ] AI logframe structuring from pasted text
- [ ] Disaggregation tracking (Male/Female/Children/Disability)
- [ ] Bulk indicator import from Excel

### Feature 07 — Evidence Library
- [ ] S3 storage backend implementation
- [ ] Bulk file upload (zip import)
- [ ] Video/audio file support
- [ ] Evidence batch operations

### Feature 08 — AI Evidence Tagging
- [ ] Real confidence scoring from LLM
- [ ] Real sensitivity detection
- [ ] Low-confidence highlighting in UI
- [ ] Batch tagging for multiple files

### Feature 09 — Activity Update Capture
- [ ] Wire real LLM provider for AI polishing
- [ ] Bulk activity update import
- [ ] Recurring activity templates
- [ ] Photo gallery view for activity evidence

### Feature 11 — AI Report Draft Generator
- [ ] Actual source reference population from evidence
- [ ] Unsupported claim warning UI
- [ ] Executive summary auto-generation
- [ ] Donor-specific tone adjustment

### Feature 12 — Missing Evidence and Compliance Checklist
- [ ] Automated checklist generation on period start
- [ ] Real-time checklist updates as evidence uploaded
- [ ] Checklist item templates by donor type
- [ ] Email notifications for critical items

### Feature 13 — Review and Approval Workflow
- [ ] Email notifications for mentions
- [ ] Review deadline tracking
- [ ] Automated reminders for pending reviews
- [ ] External reviewer access (donor portal)

### Feature 14 — Export Module
- [ ] Enhanced formatting for donor-specific templates
- [ ] Export progress tracking
- [ ] Automated export on period close
- [ ] Export to Google Drive/Dropbox

### Feature 15 — Dashboard
- [ ] Customizable dashboard widgets
- [ ] Comparative metrics (vs previous period)
- [ ] Trend charts over time

### Feature 17 — Basic Settings
- [ ] Email notification delivery (currently logs only)
- [ ] Two-factor authentication
- [ ] Session management UI
- [ ] Data export (GDPR compliance)

## Notes
- Signup/login 500 errors are fixed; see `memorybank/Fixes.md`.
- The `LlmModel` / `LlmPrompt` tables are global (no `tenantId`) and are
  intentionally not RLS-tenant-isolated.
- All 17 MVP features documented in `memorybank/Features/`
