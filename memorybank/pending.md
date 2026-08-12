# Pending

Outstanding and in-progress items for DonorDesk. Last updated: 2026-08-12.

## Frontend portal (implemented — release `20260812181200`)

The portal frontend is implemented across Phases 0–7 of
`memorybank/imp/frontend-imp-plan.md` (reports in `memorybank/imp/PHASE*-FRONTEND-REPORT.md`
and `PHASE0-REPORT.md` / `PHASE1-REPORT.md`) and deployed to `DonerDesk.online`.
Items below that are **backend/API dependencies** are the real remaining work; the
UI deliberately does not claim stub/unsupported behavior as production.

Done (portal; includes the 2026-08-12 post-implementation integration audit in
`imp/FRONTEND-UX-INTEGRATION-AUDIT.md`; those latest changes are local until separately deployed):
- Server-only gateway, httpOnly session, typed errors, capability gating, no silent zero fallbacks (Phase 0).
- Design system + authenticated shell, route groups without URL changes (Phase 1).
- Auth, onboarding, guided project creation, templates, logframe/indicators (Phase 2).
- Home / My Work / portfolios / notifications / project overview (Phase 3).
- Field activity & evidence (ACT/EVD) — routes exist in code but **no dedicated Phase 4 report was written**.
- Reporting workspace with autosave conflict safety, compliance (Phase 5).
- Review/approval/export preflight + wizard + history, comments (Phase 6).
- Team, settings, audit explorer, hardening (Phase 7).
- Post-Phase-7 shell/route integration: cross-project Reports, Evidence, and Compliance queues; project context metadata; project Team/Settings destinations; indicator detail; and dedicated export center.
- `Ctrl/Cmd+K` focuses project portfolio search. This is deliberately **not** called global search; NTF-02 remains blocked on a permission-filtered backend contract.

Remaining backend dependencies that unblock the next UI tier (tracked, not claimed):
- **Project-assignment ABAC / cross-project isolation** (FE-B03) — backend must enforce non-admin project membership + integration tests before global lists are fully trusted.
- **Global search (NTF-02)** — no permission-filtered search contract exists.
- **Authoritative global queue read models** — current Reports and Compliance queues are composed server-side from accessible project APIs. Add organization-level paginated contracts before large-scale production use.
- **Indicator detail/history read model** — definition data is available through the project logframe, but period update history and disaggregation are not exposed safely.
- **Complete project settings update contract** — the route exists, but editing remains unavailable rather than simulating unaudited writes.
- **Claim-level provenance / source-linking (REP-06)** — no backend claim/provenance contract; UI shows section-level references only.
- **Real AI providers / job resources** — all AI handlers are stubs; UI labels them honestly.
- **Email/notification delivery** — in-app only; no delivery claims.
- **Report reject/request-changes endpoint** — backend `approve` route only accepts `APPROVE`; no separate reject transition surfaced.

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

Items below are **backend/async** gaps. The portal UI for each feature is
implemented (see the frontend phase reports) but only exposes what the backend
actually supports; unsupported controls are omitted rather than simulated.

### Feature 01 — Authentication and Onboarding
- [ ] Complete password reset flow with email delivery
- [ ] Email verification on signup
- [ ] Onboarding wizard progress persistence
- **Frontend:** login/signup hardened, honest forgot-password guidance, derived
  onboarding checklist (Phase 2). Reset/verification require backend + email delivery.

### Feature 05 — Donor Template Manager
- [ ] Copy-paste text template input
- [ ] DOCX parsing for template content extraction
- [ ] PDF parsing for template content extraction
- **Frontend:** list, upload ("review sections"), section editor with honest
  extraction labeling (Phase 2). Parser/runtime for PDF/DOCX remains a backend dep.

### Feature 06 — Logframe and Indicator Manager
- [ ] Excel/CSV logframe file import
- [ ] AI logframe structuring from pasted text
- [ ] Disaggregation tracking (Male/Female/Children/Disability)
- [ ] Bulk indicator import from Excel
- **Frontend:** results hierarchy tree, linked indicator definition/detail,
  indicator creation + update + verify wired to real routes (Phase 2 plus the
  post-implementation integration audit). Update history/import/AI/disaggregation remain backend.

### Feature 07 — Evidence Library
- [ ] S3 storage backend implementation
- [ ] Bulk file upload (zip import)
- [ ] Video/audio file support
- [ ] Evidence batch operations
- **Frontend:** project search/list, upload queue, detail + preview, verification,
  plus the organization evidence queue (Phase 4 in code plus the post-implementation
  integration audit). S3/zip/media remain backend.

### Feature 08 — AI Evidence Tagging
- [ ] Real confidence scoring from LLM
- [ ] Real sensitivity detection
- [ ] Low-confidence highlighting in UI
- [ ] Batch tagging for multiple files
- **Frontend:** tag review requires human confirmation; shows only real
  confidence/sensitivity when supplied (stub backend, honestly labeled).

### Feature 09 — Activity Update Capture
- [ ] Wire real LLM provider for AI polishing
- [ ] Bulk activity update import
- [ ] Recurring activity templates
- [ ] Photo gallery view for activity evidence
- **Frontend:** capture form, AI assistance with original-vs-suggestion, review
  (Phase 4 in code). Real LLM/bulk/recurring remain backend.

### Feature 11 — AI Report Draft Generator
- [ ] Actual source reference population from evidence
- [ ] Unsupported claim warning UI
- [ ] Executive summary auto-generation
- [ ] Donor-specific tone adjustment
- **Frontend:** generate/regenerate AI draft + manual blank fallback; section-level
  source references only, accurately labeled (Phase 5). Claim provenance remains backend.

### Feature 12 — Missing Evidence and Compliance Checklist
- [ ] Automated checklist generation on period start
- [ ] Real-time checklist updates as evidence uploaded
- [ ] Checklist item templates by donor type
- [ ] Email notifications for critical items
- **Frontend:** checklist view grouped by severity, resolution (start/resolve/accept
  risk/N/A) with required note + confirmation, readiness explanation (Phase 5).

### Feature 13 — Review and Approval Workflow
- [ ] Email notifications for mentions
- [ ] Review deadline tracking
- [ ] Automated reminders for pending reviews
- [ ] External reviewer access (donor portal)
- **Frontend:** comments thread, submit/approve lifecycle, pre-approval summary
  (Phase 6). No reject endpoint exists; email/reminders remain backend.

### Feature 14 — Export Module
- [ ] Enhanced formatting for donor-specific templates
- [ ] Export progress tracking
- [ ] Automated export on period close
- [ ] Export to Google Drive/Dropbox
- **Frontend:** preflight, guided wizard, history, protected download, and a
  dedicated period export center route (Phase 6 plus the post-implementation audit).
  Export builder is stub-backed in non-production.

### Feature 15 — Dashboard
- [ ] Customizable dashboard widgets
- [ ] Comparative metrics (vs previous period)
- [ ] Trend charts over time
- **Frontend:** authoritative Home (My Work first, deadline bands, linked counts),
  My Work queue, project portfolio (Phase 3). Widgets/charts remain roadmap.

### Feature 17 — Basic Settings
- [ ] Email notification delivery (currently logs only)
- [ ] Two-factor authentication
- [ ] Session management UI
- [ ] Data export (GDPR compliance)
- **Frontend:** org profile + AI-enabled control, capability-gated (Phase 7).
  Email/2FA/session-management/GDPR export remain backend.

## Notes
- Signup/login 500 errors are fixed; see `memorybank/Fixes.md`.
- The `LlmModel` / `LlmPrompt` tables are global (no `tenantId`) and are
  intentionally not RLS-tenant-isolated.
- All 17 MVP features documented in `memorybank/Features/`
