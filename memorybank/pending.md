# Pending

Outstanding and in-progress items for DonorDesk. Last updated: 2026-08-19T21:40+05:00.

> **Deployment (2026-08-19):** **Excel import templates + report section
> management** — release `20260819163537` (API + web; no migration). xlsx
> template download for Logframe (two sheets: Logframe + Indicators),
> Activities, and Evidence (link-first, Google Drive share link per row) with
> authenticated `/api/templates/*` BFF routes; structured upload imports for
> indicators/activities/evidence with fuzzy header parsers (multi-sheet-safe
> boundary detection, delimiter-aware cells, Excel serial-date rejection,
> type-synonym normalization), code/title resolution, dedup, 1000-row caps,
> and audit events; report section add (`POST /v1/report-sections`) and delete
> (`DELETE /v1/report-sections/:id`, FK-safe ordering, DRAFT-gated); RBAC rules
> for every new route. Typecheck/build/tests green; deployed incrementally and
> verified live (health/ready ok, all new routes registered and auth-gated,
> public HTTPS 200). Rollback: `RELEASE_ID=20260819090000 scripts/rollback.sh`.

> **Deployment (2026-08-19):** **Professional donor reporting hardening** —
> release `20260819090000` (API + web + prisma migration `20260818180000_professional_reporting`).
> The `imp/PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md` (Phases 0–9) is now
> **IMPLEMENTED**: immutable `ReportRevision` with revision-bound `ReportClaim`
> assertions (revision id/hash, text span, numeric atoms, structured reason
> codes), single `IReportRevisionService` mutation pipeline (generation/edit/
> rewrite/shorten always create a new UNASSESSED revision), deterministic
> assertion extraction from final content (an empty writer `claims` array can
> never bypass verification), numeric verification bound to indicator/period/
> unit/entity/role with percentage derivation via domain decimal math, exact
> evidence chunk/hash/source-text integrity validation, entailment
> (supported/contradicted/insufficient/uncertain) + causal human-review policy,
> requirement packs/award overrides with deterministic precedence resolver and
> `IRequirementEvaluator`, immutable `SubmissionSnapshot` sealing, ONE gate
> evaluator shared by approval/preflight/submission/export (structured reason
> enums — no more prose string matching), export intent
> (`INTERNAL_REVIEW` watermarked vs `DONOR_SUBMISSION` snapshot-bound),
> coverage-gap projection into `UNSUPPORTED_REPORT_CLAIM` checklist items,
> neutral evidence-proportionate rewrite prompts, baseline-revision backfill,
> golden corpus + `reporting:eval` CLI + verifier contract suite, and ADRs
> 0005–0009. Full gate green (254 tests). Migration + RLS applied on Contabo;
> baseline revisions backfilled. See `Features/20-report-gen.md` §18,
> `contabo-ops.md` §29, and `Fixes.md`.

> **Deployment (2026-08-18):** **Report Writing Skills full course** — release
> `20260818162955` (web). Created 16 comprehensive donor-reporting lessons across 3 modules:
> - Foundation: Report Writing Fundamentals, Indicators & Evidence, Writing Clearly for Donors, Structuring Your Narrative
> - Donor-Specific: UNHCR, DG ECHO, USAID, Global Fund, GCF, FCDO/Bilateral, EU Grants, Gates Foundation
> - Tools & Templates: Pre-Report Checklist, Donor Comparison Table, Evidence Inventory Guide, Glossary
> All markdown source at `memorybank/docs/support/report-writing-skills/`. Wiki route at
> `apps/web/src/app/support/report-writing-skills/`. Added to wikiCategories, support index, and
> CategoryNav. Build green, all 16 routes verified 200 on donordesk.online.

> **Deployment (2026-08-18):** **Wiki support routes — FILE_MAP path fix** — release
> `20260818155600`. Fixed FILE_MAP path mappings where docs use two naming conventions:
> subfolder (`basic-information/<slug>.md`) vs root (`basic-information-<slug>.md`).
> Restored 18 previously-404ing getting-started articles (indicators-and-targets,
> report-sections/statuses/readiness, reporting-workflow, donor-templates, evidence-verification,
> logframe-hierarchy, storage-file-management). Restored 4 how-to articles
> (set-up-new-organisation, use-the-audit-trail, use-comments-feedback, onboard-team-member,
> prepare-for-donor-visit). Removed 6 orphaned wiki nav entries with no backing docs
> (email-delivery, payment-issues, webhooks, automation-rules, custom-integrations, analytics).
> Full route audit: **101 routes, 0 failures**. Typecheck green.

> **Deployment (2026-08-18):** **Wiki-style Support Center pages** — release
> `20260818152118` (web). Added full wiki-style support category pages:
> - `/support/getting-started` — 23 articles from basic-information
> - `/support/how-to` — 42 articles from how-to folder
> - `/support/troubleshooting` — 17 articles
> - `/support/advanced-features` — 16 articles
> - `/support/account-billing` — 2 articles
> - `/support/security-privacy` — 3 articles (new category added to support hub)
> - Individual article pages: `/support/getting-started/[article]`, `/support/how-to/[article]`, etc.
> - Components: `WikiLayout.tsx`, `CategoryNav.tsx` (client, active route highlighting),
>   `wikiCategories.tsx` (full category + article definitions), `wikiUtils.ts` (server-side
>   markdown loading from memorybank docs)
> - Added `react-markdown`, `remark-gfm`, `rehype-highlight` deps
> - Each article renders full markdown with styled prose (accent-colored per category)
> - Typecheck green; 42 MB incremental transfer (includes .next build)
> - Deployed and verified: all 8 category/index routes + article pages return 200.

> **Deployment (2026-08-18):** **Support Center with 100+ docs + Report Writing Skills** —
> release `20260818150143` (web-only). New `/support` page with hero, search bar, 6
> category cards, featured Report Writing Skills section (Foundation/Donor-Specific/Tools
> + donor name badges), Popular & Recent guides, and support options. Homepage nav
> gains "Support" link (teal brand color); homepage footer replaced with 4-column
> layout (Brand/Support Center/Report Writing Skills/Legal). `memorybank/docs/support/`
> now contains **104 markdown docs** across 8 categories (basic-information, how-to,
> troubleshooting, advanced-features, reference, account-billing, security-privacy,
> donor-reporting-guidelines). All `legal@donordesk.online` references replaced with
> `support@donordesk.online`. Typecheck + build green; 5.3 MB incremental transfer.
> Deployed and verified: public `/`, `/support`, `/login` all 200; API `/health`+`/ready`
> OK; services active.

> **Deployment (2026-08-18):** **Professional AI report generation** shipped in
> release `20260818074405` (API + web). Verified findings now carry indicator
> name/type/baseline/target, the previous-period `comparisonValue` (previously
> computed then dropped), and a deterministic `performanceEvaluation`
> (POSITIVE/NEGATIVE/NEUTRAL gated by semantics). The narrator prompt gains
> project/reporting-period/donor-template context blocks, per-section guidance
> (input type, mandatory questions, evidence needs, word limits), indicator
> target + period-on-period narration, evidence metadata, participant
> disaggregation, quality-flag caveat language, and a worked example; evidence
> chunks raised 3×600 → 8×800 chars (`maxTokens` stays 4096 for the MiniMax
> timeout constraint). Also fixed a flaky `phase4-security` token-tamper test.
> Full gate green (241 tests, 0 failures); deployed and verified live. See
> `Features/20-report-gen.md` §17, `Features/11-AI-Report-Draft-Generator.md`,
> `Fixes.md`, and `contabo-ops.md` §29.

> **Deployment (2026-08-18):** **Feature 19 — Creem billing is live in
> production (real mode).** Release `20260818053116` shipped Phase 4
> reconciliation (all five handlers + `/internal/billing/*` routes), the shared
> `BillingSubscriptionSynchronizer`, webhook tenant resolution from checkout
> metadata, and the `/thanks` checkout return page with redirect-signature
> verification. Release `20260818061120` shipped the Continue checkout flow
> (pricing **Continue** buttons → `/checkout` → Creem) and removed all 14-day
> trial references (provisioning no longer grants trials; catalog `trialDays`
> nulled; every workspace starts on free STARTER). **2026-08-18 live switch:**
> server `api.env` now runs `BILLING_PROVIDER=creem` + `CREEM_TEST_MODE=false`
> with the production API key `creem_5aLG9DmlM7Uy6j4f7Iu7OF`, live webhook
> secret `whsec_2qlLyneTPFBJP94Y3GIit7`, and four live product IDs
> (`prod_4Rrpmx10tERDoDIPIMc7PS` Team monthly, `prod_56irLwhE9AbS0yQLJTLrDE`
> Team annual, `prod_6DXr5Ppqdkv5Xd86c5OdKi` Growth monthly,
> `prod_7jys5N5qQ3tAORihO9X2rF` Growth annual);
> `BILLING_SUCCESS_BASE_URL=https://donordesk.online`. **OLS vhost gained a
> `/v1` proxy context** so the public webhook
> `https://donordesk.online/v1/webhooks/creem` reaches the Fastify API (the
> `/api` context keeps its prefix, so `/api/v1/*` 404s; `api.donordesk.online`
> has no DNS record). Signed end-to-end webhook verified live (401 unsigned,
> 200 handled signed, inbox rows PROCESSED, cleaned up). Creem dashboard
> webhook must use `https://donordesk.online/v1/webhooks/creem` — NOT
> `https://api.donordesk.online/...`.

> **Deployment (2026-08-15):** Feature 18 — Project Creation Wizard — is
> **deployed to Contabo production as release `20260815054218`** (API + web +
> prisma). Migration `20260815000000_project_bootstrap` applied as
> `donordesk_migrator` (new `ProjectSetup`/`ReportingProfile` tables,
> `Project.workspaceRootId`, `Organization.driveRootFolderId`, unique
> `(tenantId, projectCode)` with legacy dedup, reporting-period snapshot
> columns). RLS extended to 24 tenant tables. Verified: API/web/workers/Kestra
> healthy, new `/v1/projects/:id/setup` + `/reporting-profile` +
> `/workspace/retry|repair` routes registered (auth-gated), no journal errors.
> See `Features/18-Project-Creation-Wizard.md` §16.

> **Deployment (2026-08-13):** Kestra plan Phases A–D code is **deployed to
> Contabo production** as release `20260813064828` (internal routes, workers
> refactor, job-queue adapters, outbox, idempotency, scheduled flows; API now
> binds loopback). Migration `20260813000000_idempotency` + RLS applied;
> `INTERNAL_TOKEN`/`INTERNAL_HMAC_SECRET` configured. **`donordesk-workers` is
> ENABLED** on `127.0.0.1:8092` (verified). **`donordesk-kestra` is ENABLED** on
> loopback `8093`/`8094`; its PostgreSQL schema is migrated and seven flows are
> deployed. Kestra→worker and signed Kestra→API smoke executions passed.
> Production API release `20260813081200` now uses `JOB_QUEUE=kestra`; a direct
> production adapter execution completed successfully.
> Off-host backup (`scripts/backup.sh`) remains to be scheduled.
> **Free Kestra plugins (Tika, Redis, JDBC-Postgres, GDrive, SFTP):** pinned
> provisioning (`infra/kestra/`), signed internal routes
> (`/internal/evidence/:id/content`, `/internal/evidence/upload`), five flows
> (`evidence_parse`, `period_cache`, `analytics_snapshot`, `gdrive_ingest`,
> `sftp_ingest`), and a SuperAdmin **Kestra plugins** tab. Kestra itself is
> **OPERATIONAL** on Contabo (7 core flows deployed, `period_cache` running via
> Redis). The five plugin JARs are staged but GATED: plugin flows are NOT yet
> deployed — see `imp/KESTRA-PLUGINS.md` for activation steps. GDrive and SFTP
> are also gated on SuperAdmin `CONNECTOR` credentials + Kestra secrets.
> **Google Drive primary storage (2026-08-13):** the link-first storage setup is
> **implemented** (Phases A–E) — see `gdrive.md`. Evidence can be stored in the
> tenant's own Google Drive (reference-only), Cloudflare R2 (paid), or LOCAL.
> R2 env wiring and per-tenant token store wiring remain to be completed.
> **Google Sign-In (2026-08-14):** login-page Google Sign-In is **implemented** —
> `POST /v1/auth/google` (id_token verified via jose) + web
> `/api/auth/google/start|callback` + login-page button (env-gated
> `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`). Existing accounts only; auto-provisioning
> (sign-up with Google) is a follow-up. See `gdrive.md` §9.

## Frontend portal (implemented — latest web release `20260817082655`)

The portal frontend is implemented across Phases 0–7 of
`memorybank/imp/frontend-imp-plan.md` (reports in `memorybank/imp/PHASE*-FRONTEND-REPORT.md`
and `PHASE0-REPORT.md` / `PHASE1-REPORT.md`) and deployed to `DonorDesk.online`.
Items below that are **backend/API dependencies** are the real remaining work; the
UI deliberately does not claim stub/unsupported behavior as production.

Done (portal; includes the 2026-08-12 post-implementation integration audit in
`imp/FRONTEND-UX-INTEGRATION-AUDIT.md`; latest dashboard parity release is deployed).
Plus 2026-08-13 wire-up: DOCX/PDF parsing for templates, Excel/CSV import for
indicators. **2026-08-17:** logframe Excel/CSV/TXT import now **auto-parses into
structured `LogframeItem` records** with parent resolution + code deduplication
(vs. the prior text-preview UX):
- Server-only gateway, httpOnly session, typed errors, capability gating, no silent zero fallbacks (Phase 0).
- Design system + authenticated shell, route groups without URL changes (Phase 1).
- Auth, onboarding, guided project creation, templates, logframe/indicators (Phase 2).
- Home / My Work / portfolios / notifications / project overview (Phase 3).
- Field activity & evidence (ACT/EVD) — routes exist in code but **no dedicated Phase 4 report was written**.
- Reporting workspace with autosave conflict safety, compliance (Phase 5).
- Review/approval/export preflight + wizard + history, comments (Phase 6).
- Team, settings, audit explorer, hardening (Phase 7).
- Post-Phase-7 shell/route integration: cross-project Reports, Evidence, and Compliance queues; project context metadata; project Team/Settings destinations; indicator detail; and dedicated export center.
- Dashboard parity release `20260812224500`: My Work preview, readiness snapshot,
  deadline bands, evidence/compliance/activity queues, richer project cards,
  notifications, setup/storage notices, and `/my-work` server-render safety fix.
- `Ctrl/Cmd+K` focuses project portfolio search. This is deliberately **not** called global search; NTF-02 remains blocked on a permission-filtered backend contract.

Remaining backend dependencies that unblock the next UI tier (tracked, not claimed):
- **Project-assignment ABAC / cross-project isolation** (FE-B03) — backend must enforce non-admin project membership + integration tests before global lists are fully trusted. Feature 18 added `project.setup`/`project.archive` capabilities and scoped the setup/profile routes; full per-project membership ABAC remains a named dependency (Feature 18 §5.4).
- **Global search (NTF-02)** — no permission-filtered search contract exists.
- **Authoritative global queue read models** — current Reports and Compliance queues are composed server-side from accessible project APIs. Add organization-level paginated contracts before large-scale production use.
- **Indicator detail/history read model** — definition data is available through the project logframe, but period update history and disaggregation are not exposed safely.
- **Complete project settings update contract** — **DONE 2026-08-15 (release `20260815054218`)**. `UpdateProjectHandler` now supports editable dates/budget (ISO-4217 currency) with period-overlap protection (Feature 18 §5.2 / §5.11).
- **Claim-level provenance / source-linking (REP-06)** — **DONE 2026-08-16 (Feature 20 core)**. Structured `ReportClaim`/`ClaimSource` contract with evidence hash + chunker version snapshots, deterministic tiered claim verification, approval gates, reject/request-changes transition, and report plan / generation-run persistence landed in domain, application, infrastructure, and API. **Extended 2026-08-17:** evidence packages now carry the real extracted document text (`EvidenceFile.extractedText`, Tika-persisted), and the generation input includes activity + indicator-update narrative so claims are sourced from actual project records, not titles/stub summaries.
- **Real AI providers / job resources** — all AI handlers are stubs; UI labels them honestly.
- **Email/notification delivery** — in-app only; no delivery claims.
- **Report reject/request-changes endpoint** — **DONE 2026-08-16 (Feature 20 core)**. `POST /v1/report-drafts/:id/reject` returns drafts to DRAFT with an audit trail.

## High priority — production hardening

- [x] **API bind to loopback only.** **DONE 2026-08-13 (release `20260813064828`).**
  API now binds `127.0.0.1:4001`, verified via `ss`.
- [x] **Versioned migrations committed.** Migrations ARE tracked at
  `packages/infrastructure/prisma/migrations/20260812000000_init/migration.sql`.
  The pending.md previously claimed they were untracked — corrected 2026-08-12.
- [ ] **Off-host backups configured.** `scripts/backup.sh` (encrypted, off-host,
  incl. Kestra DB + storage) is **prepared**; execution + rotation + restore-test
  remain a gated operator step. Record destination, retention, last success,
  checksum, and restore-test evidence. Local WAL archive is not DR.
- [x] **`api.env` line-8 stray `O`.** **DONE 2026-08-19** — removed during the
  `20260819090000` release; `api.env` now sources cleanly in bash
  (`DATABASE_ADMIN_URL` reachable). Backup at
  `api.env.bak-strayO-20260819`.
- [ ] **Add the RLS step to the release procedure.** The RLS grants + policy were
  applied manually during the 2026-08-12 fix. Bake `infra/postgres/rls.sql`
  (applied to 21 tenant tables) into the deployment runbook so it runs on
  every release, and keep `infra/postgres/rls.sql` in sync with the schema.
  - Note: pending.md previously said "28 tables" but `infra/postgres/rls.sql`
    lists 21 tables.
- [ ] **Document `API_INTERNAL_URL` and the OLS `Origin` dedupe requirement** in
  the deployment doc so future releases build web with
  `API_INTERNAL_URL=http://127.0.0.1:4001` and keep `src/middleware.ts`.

## Medium priority — async / AI features (Stage B)

- [ ] **Wire BullMQ / Redis.** `InMemoryJobQueue` is always selected. BullMQ
  adapter exists at `packages/infrastructure/src/security/priority-queue.ts` but
  `container.ts:209` always instantiates `InMemoryJobQueue`. Create a dedicated
  Redis ACL user (`dd:*`), wire and test the BullMQ factory, and set
  `JOB_QUEUE=redis` only after the adapter is runtime-wired and tested.
- [x] **Wire real LLM providers.** LLM factory with OpenAI/Anthropic/DeepSeek/
  MiniMax/Ollama adapters exists at `packages/infrastructure/src/llm/factory.ts`.
  **Implemented + deployed 2026-08-17:** SuperAdmin `PlatformConfiguration`
  (category `LLM`) resolves the tenant's provider at runtime
  (`PlatformLlmConfigResolver` + AES-256-GCM `SecretCipher`, TENANT>GLOBAL
  precedence); `LlmReportDraftGenerator` narrates via the configured provider
  with a deterministic stub fallback that is **never billed** (`usedFallback`
  semantics; the reserved AI credit is released and the run recorded as error).
  AI-credit quotas (STARTER 5 / TEAM 100 / GROWTH 500 / ENTERPRISE unlimited)
  are enforced per UTC month; SuperAdmin can set/increase/reduce the allowance
  or reset the month counter (see `../SUPERADMIN-PORTAL.md` and
  `imp/LLM-PROVIDER-WIRING.md` §14–15). Still pending: per-call provider
  rotation when multiple enabled configs exist, and real OpenAI/Anthropic
  runtime testing (MiniMax verified live; `LLM_PROVIDER`/Ollama paths remain
  unexercised in production).
- [x] **Google Drive primary storage (link-first) + R2 tier.** Implemented across
  Phases A–E: per-tenant `storageProvider` (`GOOGLE_DRIVE` / `R2` / `LOCAL`),
  `IEvidenceStorage` + `EvidenceStorageResolver`, `GoogleDriveEvidenceStorage`
  (reference-only, no byte copy), `R2EvidenceStorage` (S3-compatible, SigV4),
  onboarding OAuth connect step, `POST /v1/evidence/link-drive`, read-time
  resolution, and a reference-only Kestra `gdrive_ingest.yml`. See
  `memorybank/gdrive.md`.
- [ ] **Wire R2 config via env for production.** `R2EvidenceStorage` exists; the
  resolver passes `undefined` R2 config (placeholder). Add `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` env and instantiate it.
- [ ] **Wire the Drive token store to the encrypted credential store at runtime.**
  `GoogleDriveEvidenceStorage` currently reads OAuth tokens from env
  (`EnvGoogleDriveTokenStore`); the `PrismaGoogleDriveCredentialStore` persists the
  tenant refresh token encrypted. Point the resolver's token store at the
  credential store so per-tenant tokens are used.
- [ ] **Wire email/notification delivery.** Postmark adapter exists at
  `packages/infrastructure/src/comms/email.ts` but `container.ts` wires
  `LoggingNotificationAdapter` which only logs. Wire Postmark and set
  `EMAIL_PROVIDER=postmark` only when ready.
- [x] **Integrate worker service.** Workers refactored, token-authenticated
  `/v1/*` routes, `/health`+`/ready`, loopback `127.0.0.1:8092`, and a systemd unit.
  **ENABLED and verified in production** (2026-08-13; venv under
  `/opt/donordesk/workers/.venv`).
- [x] **Kestra flow.** The contracts/routes/modules exist (Phases A–D), and the
  seven flow YAMLs are deployed. **Resolved:** the correct Kestra 1.3.30 core
  migration command is `sys database migrate` with `datasources.postgres`; the
  `kestra migrate` command is a group command (subcommands `default-tenant`,
  `metadata`) that does not run core migrations, and `server standalone` does not
  auto-migrate. Kestra 1.3.30 is now enabled with its dedicated PostgreSQL
  database, Java 21, a 1 GiB heap cap, loopback listeners, and pinned Python
  task plugin 1.3.1.
- [x] **Free Kestra plugins (Tika, Redis, JDBC-Postgres, GDrive, SFTP).** Pinned
  provisioning (`infra/kestra/plugins.manifest.tsv` + `install-plugins.sh`),
  signed internal routes (`/internal/evidence/:id/content`, `/internal/evidence/upload`),
  five flow YAMLs (`evidence_parse`, `period_cache`, `analytics_snapshot`,
  `gdrive_ingest`, `sftp_ingest`), and a SuperAdmin **Kestra plugins** tab
  (`/superadmin/kestra`). Kestra core + 7 flows are operational on Contabo.
  **Plugin flows are GATED** — JARs staged but not deployed until verified.
  See `imp/KESTRA-PLUGINS.md`.
- [ ] **Deploy plugin flows.** Confirm each JAR loads under Kestra 1.3.30, add the
  `donordesk` datasource to the deployed `kestra.application.yml`, then run
  `workflows/kestra/sync-flows.sh`. A premature run hung Kestra (verified 2026-08-13).
  Smoke-execute `evidence_parse`, `period_cache`, and `analytics_snapshot` after.
- [ ] **Provision GDrive/SFTP connector credentials.** `gdrive_ingest` and
  `sftp_ingest` are wired but gated on SuperAdmin `CONNECTOR` records + Kestra
  secrets (`GDRIVE_SERVICE_ACCOUNT_JSON` + `GDRIVE_FOLDER_ID` or SFTP key/host/user).
  Add credentials, test the connection, then enable the trigger.
- [ ] **Verify `donordesk_app` grants + RLS for the JDBC analytics flow.** The
  `analytics_snapshot` flow is gated on the `donordesk` datasource, the
  `DONORDESK_APP_DB_PASSWORD` Kestra secret, and read-only `SELECT` grants;
  it must never be granted writes.

## Observability / operations

- [ ] **OTel tracing.** OTel is implemented but disabled by default (`OTEL_ENABLED`
  env var). Code at `apps/api/src/observability.ts:50-58` requires `OTEL_ENABLED=true`
  plus `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`. Set exact enable/endpoint variables
  and test trace ingestion before adding Tempo.
- [ ] **Loki/Alloy pipeline.** Loki runs in dev (`infra/docker-compose.dev.yml`)
  and is configured as a Grafana datasource, but no application logs are shipped
  to Loki. Implement fully or omit.

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
- [x] **Google Sign-In on login page** — `POST /v1/auth/google` + web
  `/api/auth/google/start|callback` + login button (env-gated). Existing
  accounts only, matches by email. See `gdrive.md` §9.
- [x] **Onboarding wizard is account-wide only (2026-08-15)** — removed the
  project-specific steps (Create a project, Add a donor template, Add a
  logframe, Upload evidence) from the account onboarding. They live in the
  per-project setup checklist (Feature 18). Added an account-wide **Default
  reporting profile** step (`/onboarding/reporting-defaults`) that seeds every
  new project's `ReportingProfile` from `Organization.reportingDefaults`
  (tone, language, formatting rules, deadline offset, auto-period). Route
  `PUT /v1/organization/reporting-defaults`; migration
  `20260815060000_onboarding_reporting_defaults`.
- [ ] Sign-up with Google (auto-provisioning) — needs a `googleSubject` column +
  org creation flow
- [ ] Complete password reset flow with email delivery
- [ ] Email verification on signup
- [ ] Onboarding wizard progress persistence
- **Frontend:** login/signup hardened, honest forgot-password guidance, derived
  onboarding checklist (Phase 2). Reset/verification require backend + email delivery.

### Feature 05 — Donor Template Manager
- [x] Copy-paste text template input — working in UI at `/projects/[id]/templates/new`
- [x] DOCX parsing for template content extraction — **WIRED**. `POST /v1/templates/parse-file`
  uses `TolerantDocumentParser` with `mammoth`. Frontend has "Upload DOCX/PDF" button
  that parses file and populates the textarea.
- [x] PDF parsing for template content extraction — **WIRED**. Same endpoint handles PDF
  via `pdf-parse`. Same UI as DOCX.
- **Frontend:** text paste input works; file upload button parses DOCX/PDF and fills
  the textarea for review. Parser wired via `apps/api/src/routes/templates.ts`.

### Feature 06 — Logframe and Indicator Manager
- [x] Excel/CSV logframe file import — **STRUCTURED**. `POST /v1/logframe/import`
  (`ImportLogframeTextSchema`) runs `ImportLogframeHandler` which calls
  `parseLogframeText` (domain parser: tabular CSV/TSV with fuzzy Level/Code/Title/
  Description header detection + line-based text with GOAL/OUTCOME/OUTPUT/ACTIVITY
  keywords, dotted/lettered codes, indentation, em-dash split) then creates actual
  `LogframeItem` records with parent resolution by level rank and code deduplication.
  Frontend: `importLogframeTextAction` + "Create logframe items" button at
  `/projects/[id]/logframe/import` → created/skipped count, warnings, item list,
  "View logframe" link. Drive import (`POST /v1/projects/:id/drive/import-logframe`)
  routes through the same handler.
- [ ] AI logframe structuring from pasted text — **NOT in UI**. Add logframe item
  form is manual entry only; no AI structuring option.
- [x] Disaggregation tracking (Male/Female/Children/Disability) — **IMPLEMENTED in UI**.
  `NewActivityForm.tsx` has fields for `participantsMale`, `participantsFemale`,
  `participantsChildren`, `participantsDisability`. Detail page displays these.
- [x] Bulk indicator import from Excel — **WIRED**. `POST /v1/indicators/parse-file` uses
  `TolerantDocumentParser`. Frontend has "Import indicators" button at
  `/projects/[id]/logframe/indicators/import` that accepts XLSX/CSV/TXT and shows
  extracted text for review.
- **Frontend:** results hierarchy tree, linked indicator definition/detail,
  indicator creation + update + verify wired to real routes (Phase 2 plus the
  post-implementation integration audit). Excel/CSV import wired for both logframe
  items and indicators. AI structuring remains backend.
- [x] **Spreadsheet-style indicator data entry** — **WIRED**. Per-reporting-period
  grid at `/projects/[id]/reports/[periodId]/indicators` (linked from the reports
  list, report workspace, and setup page). Rows come from the project logframe;
  bulk upsert is one call per sheet (`POST /v1/indicator-updates/bulk`), one
  `IndicatorUpdate` per (indicator, period) enforced by a new unique constraint,
  verified rows are locked, and Google Sheets import (`POST /v1/indicator-updates/
  parse-sheet`) previews a mapped sheet before applying it to the grid. See
  `Features/06-Logframe-And-Indicator-Manager.md`.

### Feature 07 — Evidence Library
- [x] **Google Drive primary storage (link-first)** — `storageProvider=GOOGLE_DRIVE`;
  `POST /v1/evidence/link-drive` links Drive files without a byte copy. See `gdrive.md`.
- [ ] R2 storage wired via env for production (adapter exists, config placeholder)
- [ ] Google OCR tagging by `driveFileId` (currently byte-based Tika for LOCAL/R2)
- [ ] Bulk file upload (zip import)
- [ ] Video/audio file support
- [ ] Evidence batch operations
- [x] **Inbound ingestion (GDrive/SFTP)** — signed `/internal/evidence/upload`
  route + `gdrive_ingest`/`sftp_ingest` Kestra flows wired and deployed; `gdrive_ingest`
  is now **reference-only** (sends `driveFileId`, no base64 copy). Gated on
  SuperAdmin `CONNECTOR` credentials + Kestra secrets. See `imp/KESTRA-PLUGINS.md`.
- **Frontend:** project search/list, upload queue, detail + preview, verification,
  plus the organization evidence queue (Phase 4 in code plus the post-implementation
  integration audit). Drive evidence opens via Google Drive web link. R2/zip/media
  remain backend.

### Feature 08 — AI Evidence Tagging
- [ ] Real confidence scoring from LLM
- [ ] Real sensitivity detection
- [ ] Low-confidence highlighting in UI
- [ ] Batch tagging for multiple files
- [x] **Real document text for tagging** — `evidence_parse` Kestra flow fetches
  the actual file bytes (`/internal/evidence/:id/content`) and runs Apache Tika
  text/OCR extraction before the worker suggests tags; **staged (gated)** on the
  Tika plugin being loaded and the flow deployed. See `imp/KESTRA-PLUGINS.md`.
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
- [x] Real LLM drafting (2026-08-17 — SuperAdmin MiniMax/DeepSeek config, live in production)
- [x] AI-credit metering — stub fallback never billed (2026-08-17)
- [x] Actual source reference population from evidence (2026-08-17 — real document
  text persisted as `EvidenceFile.extractedText` via the Tika `evidence_parse` flow
  and cited through `EvidencePackageBuilder`; activity + indicator-update narrative
  context now feeds the generator; statement-level sources render in the workspace)
- [x] **Previous-period comparison text (2026-08-18)** — `VerifiedFinding.comparisonValue`
  is emitted by `computeIndicator` (was computed then dropped) and the narrator
  describes period-on-period change; indicator names/types/baselines/targets,
  deterministic `performanceEvaluation` gating, project/period/donor-template
  context blocks, per-section guidance (input type, mandatory questions, evidence
  needs, word limits), evidence metadata, participant disaggregation, and a
  worked example also shipped (release `20260818074405`). See
  `Features/20-report-gen.md` §17.
- [x] **Structured claim verification with reason codes (2026-08-19)** — gate
  decisions consume `VerificationReasonCode` enums (`gateKindForReason`), never
  prose detail; revision-bound assertions carry `revisionId`/`revisionHash`,
  span offsets, numeric atoms, and materiality. Coverage gaps project into
  `UNSUPPORTED_REPORT_CLAIM` checklist items with deterministic dedup keys.
- [ ] Unsupported claim warning UI (API + checklist projection done; the
  consolidated exception surface in the web UI is a tracked follow-up)
- [ ] Executive summary auto-generation
- [ ] Donor-specific tone adjustment
- **Frontend:** generate/regenerate AI draft + manual blank fallback; section-level
  and statement-level source references, accurately labeled (Phase 5 + 2026-08-17).

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
- [x] Report charts embedded in DOCX/PDF exports (2026-08-17 — ECharts SSR→sharp PNG, `chart-png-renderer.ts`)
- [x] **Export intent + submission snapshot binding (2026-08-19)** — `POST /v1/exports`
  accepts `exportIntent` (`INTERNAL_REVIEW` watermark vs `DONOR_SUBMISSION`
  requiring a sealed `SubmissionSnapshot`); the export builder enforces the
  invariants server-side.
- [ ] Enhanced formatting for donor-specific templates (real `docxtpl` worker
  fidelity remains a documented swap point — `DONOR_TEMPLATE` is placeholder-aware)
- [ ] Export progress tracking
- [ ] Automated export on period close
- [ ] Export to Google Drive / Dropbox destination
- **Frontend:** preflight, guided wizard, history, protected download, and a
  dedicated period export center route (Phase 6 plus the post-implementation audit).
  Export builder is stub-backed in non-production.

### Feature 15 — Dashboard
- [ ] Customizable dashboard widgets
- [ ] Comparative metrics (vs previous period)
- [x] Report section charts (2026-08-17 — per-section BAR/LINE/PIE/AREA/RADAR/GAUGE in the report workspace; dashboard trend charts remain roadmap)
- **Frontend:** authoritative Home (My Work first, deadline bands, linked counts),
  My Work queue, project portfolio (Phase 3). Widgets/charts remain roadmap.

### Feature 17 — Basic Settings
- [ ] Email notification delivery (currently logs only)
- [ ] Two-factor authentication
- [ ] Session management UI
- [ ] Data export (GDPR compliance)
- **Frontend:** org profile + AI-enabled control, capability-gated (Phase 7).
  Email/2FA/session-management/GDPR export remain backend.

## Feature 18 — Project Creation Wizard (implemented 2026-08-15)

**Deployed:** release `20260815054218`; migration `20260815000000_project_bootstrap`;
RLS on 24 tables. See `Features/18-Project-Creation-Wizard.md`.Implemented:
- Derived readiness (`ProjectReadinessService`) with machine-readable blockers;
  authoritative reporting-period gate (ownership, readiness, date bounds, overlap,
  immutable template/profile snapshots); Local + Google Drive project workspace
  provisioning (idempotent, retryable, repairable, stable appProperties identities);
  per-project reporting profile (tone, language, formatting rules, word-count
  overrides, deadline offset, auto-period flag); setup checklist + profile form UI;
  wizard redirect to `/projects/[id]/setup`; editable dates/budget; lifecycle
  (DRAFT→ACTIVE, archive/restore, completion); `project.setup`/`project.archive`
  capabilities.

Remaining follow-ups (tracked here, not claimed):
- [x] **Account-wide reporting defaults** — implemented 2026-08-15: new projects
  are seeded with a `ReportingProfile` from `Organization.reportingDefaults`
  (default tone, language, formatting rules, deadline offset, auto-period
  creation). Configured at `/onboarding/reporting-defaults`.
- [ ] **Account-wide notification preferences** (deadline reminder recipients /
  lead time), **timezone**, and **default currency** onboarding steps —
  anticipated, deferred.
- [ ] **Indicator-update submit / request-correction / reject routes** — domain
  supports them; API only exposes create + verify (Feature 18 §8).
- [ ] **Indicator-update history read model** — `GET /v1/indicators/:id/updates`
  (Feature 18 §8); UI indicator page still shows the "not exposed" note. The
  per-period grid (`GET /v1/reporting-periods/:id/indicators`) now covers the
  primary data-entry read path.
- [ ] **Automatic recurring reporting periods** — `autoPeriodCreation` flag stored
  on the profile; scheduling job not yet implemented (Feature 18 §5.5).
- [ ] **Deadline-reminder wiring to the reporting profile** — `deadlineOffsetDays`
  stored; `generate-deadline-reminders` not yet profile-aware (Feature 18 §5.5).
- [ ] **Per-project membership ABAC enforcement** — `ProjectMember` is fully
  implemented (role + status, repo, API, Team UI, audit; 2026-08-16) but
  `list-projects` is still tenant-wide, not filtered by membership (Feature 18
  §5.4, FE-B03).
- [ ] **Google Drive project folders need real OAuth client credentials** — code is
  live but tenant provisioning requires the Google Cloud project + service account
  (pending.md "Wire the Drive token store"); Local/R2 tenants are NOT_REQUIRED.
- [ ] **Project copy/duplicate, donor/partner entities, deletion/retention** —
  deferred per Feature 18 §5.6/§5.7/§5.9.

## Feature 19 — Tiers and Payments (Creem live in test mode 2026-08-18)

**Deployed:** releases `20260818053116` (Phase 4 reconciliation + thanks page) and
`20260818061120` (Continue checkout flow + trial removal). See
`Features/19-Tiers-And-Payments.md`.

Implemented:
- Entitlements, AI-credit quotas, usage counters, SuperAdmin credit + tier
  management (2026-08-17).
- Creem billing adapter live in **test mode** (`BILLING_PROVIDER=creem`,
  `CREEM_TEST_MODE=true`) with four test product IDs, API key, webhook secret,
  and `POST /v1/webhooks/creem` raw-body HMAC verification.
- Phase 4 reconciliation: `ReconcileBillingSubscriptionsHandler`,
  `ReconcileManagedStorageUsageHandler`, `ReleaseStaleUsageReservationsHandler`,
  `RetryBillingInboxHandler` (+ dormant `ExpireLocalTrialsHandler`), all exposed
  as `/internal/billing/*` Kestra routes; shared `BillingSubscriptionSynchronizer`.
- Webhook tenant resolution from checkout `metadata.tenant_id` with local-mapping
  fallback (both Creem and stub adapters parse metadata).
- Checkout return page `/thanks` with redirect-signature verification and quick
  setup links; `/checkout` route creates the Creem session server-side.
- Pricing **Continue** buttons (Team/Growth) → signup → `/checkout` → Creem;
  Google paid signups route the same way.
- **14-day trials removed** — every workspace starts on free STARTER; no trial
  grants, no trial copy, `trialDays` nulled, `isPlanForTrial` false.

Remaining (tracked here, not claimed):
- [ ] **Fix live product prices on creem.io** — live products are priced
  $59.99/$590.99/$149.99 (Growth Yearly is correct at $1,490) but the catalog
  (`PLAN_CATALOG` in `packages/domain/src/contexts/billing/plan.ts`) and the
  pricing UI advertise $59/$590/$149/$1,490. Align creem.io prices to 5900 /
  59000 / 14900 / 149000 cents so charged amounts match what customers see.
- [ ] **Verify Creem webhook URL + secret on the dashboard** — the webhook
  registered on creem.io now uses the live secret `whsec_2qlLyneTPFBJP94Y3GIit7`
  and Endpoint URL `https://donordesk.online/v1/webhooks/creem` (verified
  end-to-end 2026-08-18: signed webhook → 200 handled, wrong secret → 401;
  `api.donordesk.online` subdomain has no DNS record; the `/v1` OLS context was
  added 2026-08-18 so the main-domain path is live). Merch approval,
  payout/countries, portal UX verification, and Terms/DPA wording are Phase 0
  follow-ups.
- [ ] **Wire Kestra schedules for reconciliation** — the `/internal/billing/*`
  handlers are deployed but the Kestra flows that trigger them hourly/daily are
  not yet created.
- [ ] **Enterprise custom contract provisioning** — not yet implemented.
- [ ] **Reconciliation metrics/alerts + failed-event runbook** — Phase 4
  remaining item.
- [ ] **Seven-day past-due grace runbook verification** — Phase 4 remaining item.
- [ ] **Controlled enforcement (Phase 6)** — report-mode comparison, cohort
  enablement, conversion/margin monitoring — not started.

## Notes
- Signup/login 500 errors are fixed; see `memorybank/Fixes.md`.
- The `LlmModel` / `LlmPrompt` tables are global (no `tenantId`) and are
  intentionally not RLS-tenant-isolated.
- All 17 MVP features documented in `memorybank/Features/`
