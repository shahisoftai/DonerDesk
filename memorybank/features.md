# DonorDesk — Global Light/Dark Theming Implementation

**Status:** Deployed to production (donordesk.online), release `20260812163749`
**Date:** 2026-08-12

## 1. Overview

Global light/dark color scheme across the entire web application — Dashboard,
all project pages (activities, evidence, logframe, reports, templates,
compliance), team, auth pages (login, signup, logout), forms, and tables. The
dark theme takes visual inspiration from the marketing front page
(`apps/web/src/app/page.tsx`): slate-950 base with brand-blue → cyan gradients,
glassmorphism, ambient glow, and a subtle tech-grid backdrop.

## 2. Theme infrastructure

| Concern | Where | What |
|---|---|---|
| Dark mode strategy | `apps/web/tailwind.config.ts` | `darkMode: "class"`; added `accent` cyan palette, glow shadows (`shadow-glow`), `animate-fade-in` |
| Design tokens | `apps/web/src/app/globals.css` | CSS variables in `:root` (light) and `.dark` (dark) for background, surface, border, text, glow, grid-line |
| Page backdrop | `globals.css` | `body::before` ambient brand/cyan radial glow; `body::after` 48px tech-grid with radial mask — applied on every page |
| Component classes | `globals.css` | `.btn`, `.btn-secondary`, `.btn-danger`, `.card`, `.input`, `.label`, `.tag*`, `.table-shell`, `.thead`, `.trow` are theme-aware (glass cards, gradient primary buttons) |
| No-FOUC script | `apps/web/src/components/ThemeScript.tsx` | Inline script in `<body>` sets `.dark` on `<html>` before hydration from `localStorage` or `prefers-color-scheme` |
| Toggle | `apps/web/src/components/ThemeToggle.tsx` | Sun/moon icon button; persists to `localStorage["donordesk-theme"]`; respects system preference; toggles `.dark` on `<html>` |
| Wiring | `apps/web/src/app/layout.tsx` | `suppressHydrationWarning` on `<html>`; `ThemeScript` mounted; `color-scheme` set per theme |

## 3. Dashboard redesign (`apps/web/src/app/dashboard/page.tsx`)

- Sticky glass top bar: logo mark, organization name, **light/dark toggle**,
  and New project / Team / Log out actions.
- KPI stat cards with gradient icon tiles, animated progress bars, and an
  urgent (amber/red) variant for reports due within 30 days.
- **Workspace health ring** — SVG conic-gradient ring (brand → cyan stroke,
  cyan glow drop-shadow) computing a derived health score from active projects,
  on-track ratio, and average days remaining.
- Recent project cards with gradient deadline progress bars; glass
  notification list with status tags.

## 4. Coverage across the app

Every page now renders correctly in both themes via the shared component
classes plus targeted `dark:` variants:

- Projects: list, new, detail (incl. tab bar and stat cards)
- Activities: list, new
- Evidence: library (table), upload
- Logframe: hierarchy, indicators table, add item
- Reports: period list, new period, workspace (readiness bar, checklist, exports)
- Templates: list, upload, section editor
- Compliance, Team (table), Logout
- Auth: Login, Signup (toggle placed top-right on pre-auth pages)

The marketing landing page (`app/page.tsx`) intentionally stays always-dark,
matching DonerDesk.online.

## 5. Deployment (2026-08-12, release `20260812163749`)

- Frontend-only change; no Prisma migration required.
- Web standalone built locally with `NEXT_PUBLIC_API_URL=/api` (same-origin
  browser calls through OLS `/api` proxy) and smoke-tested on a temp port.
- Release assembled on Contabo under `/opt/donordesk/releases/20260812163749`
  (unchanged `api/` + `prisma/` copied from previous release; new `web/`
  standalone with `.next/static` copied into the standalone layout).
- `current` symlink atomically switched; `donordesk-web` restarted;
  `donordesk-api` untouched and healthy.
- Verified: loopback 200 on `/`, `/login`, `/signup`; public HTTPS 200 on all
  pages; theme script + toggle aria-label served; dark-variant CSS present in
  production CSS chunks (`html.dark`, both theme tokens).

---

# Frontend Portal Implementation

**Status:** Implemented across Phases 0–7 (blueprint: `memorybank/imp/frontend-imp-plan.md`)
and deployed to `DonerDesk.online` as release `20260812181200` (commit `45a1c96`) on 2026-08-12.

**Post-deployment updates:** A 2026-08-12 UI/UX integration audit added missing
route and shell composition, then dashboard parity follow-up release
`20260812224500` deployed the designed operational dashboard home. See
`memorybank/imp/FRONTEND-UX-INTEGRATION-AUDIT.md`.

## What was delivered

A dependable, accessible, role-aware portal built on a server-only gateway,
`httpOnly` sessions, typed errors, and server-side capability gating. The UI only
exposes what the backend actually supports; stub/unsupported behavior is labeled
honestly, never presented as production.

| Phase | Scope | Highlights | Report |
|-------|-------|-----------|--------|
| 0 | Baseline & safety | httpOnly fix, server gateway, discriminated errors, capability model, error boundaries | `PHASE0-REPORT.md` |
| 1 | Design system + shell | semantic tokens/tones, UI + feedback + data + editor primitives, `(portal)` route group + `AppShell` + side nav | `PHASE1-REPORT.md` |
| 2 | Auth, onboarding, setup | hardened auth, honest forgot-password, derived onboarding, guided project wizard, templates, logframe/indicators | `PHASE2-FRONTEND-REPORT.md` |
| 3 | Home, My Work, portfolios | authoritative dashboard read model, work-item queue, project portfolio, notifications, project overview | `PHASE3-FRONTEND-REPORT.md` |
| 4 | Field activity & evidence | activity capture + AI assistance, evidence search/upload/detail/verification (in code) | *(no dedicated report)* |
| 5 | Reporting & compliance | three-panel workspace, autosave with optimistic-concurrency conflict safety, compliance resolution + readiness | `PHASE5-FRONTEND-REPORT.md` |
| 6 | Review, approval, export | comments thread, submit/approve lifecycle, pre-approval summary, export preflight/wizard/history | `PHASE6-FRONTEND-REPORT.md` |
| 7 | Admin & hardening | team, settings (AI control), audit explorer with redaction; global search blocked on backend | `PHASE7-FRONTEND-REPORT.md` |

### Post-Phase-7 UI/UX integration

- Added cross-project Reports, Evidence, and Compliance queues and primary-nav entries.
- Repaired the dashboard evidence destination.
- Reworked the dashboard home to show My Work, readiness, deadline bands,
  evidence/compliance/activity queues, richer project cards, notifications, and
  setup/storage notices.
- Fixed `/my-work` server rendering by removing a client-only `onChange` handler
  from the Server Component page.
- Added complete shared project context, project Team/Settings destinations,
  indicator detail, and a dedicated reporting-period Export Center.
- Fixed nested project-tab selection and replaced the project-only top-bar action
  with a context-aware Create menu.
- Added a `Ctrl/Cmd+K` shortcut to project portfolio search. Permission-filtered
  global search remains blocked and is not claimed.

## Verification (per clean local run)

- `pnpm -r typecheck` and `pnpm -r lint` pass (7 packages).
- `pnpm --filter @donordesk/web build` passes; route table shows no regression.
- Unit tests grew to **113 passing** across phases (tone, navigation, onboarding,
  hierarchy, deadline bands, work-items, autosave reducer, compliance links,
  pre-approval, downloads, team, audit redaction).
- Playwright runnable subset (no live API/DB) passes each phase; full API+DB
  E2E journeys were environment-blocked (no PostgreSQL/Keycloak available), not
  code failures.

## Honest limits (tracked in `pending.md`)

- Backend dependencies remain: project-assignment ABAC, global search, email
  delivery, report-reject endpoint.
- **AI draft generation is now real (2026-08-17):** the report draft handler runs
  the SuperAdmin-configured LLM (MiniMax verified live; DeepSeek adapter present)
  with per-tier AI-credit quotas and a free, never-billed stub fallback. **2026-08-17
  (data completeness):** generated reports now cite the project's real records —
  evidence `extractedText` (Tika-persisted) is chunked into evidence packages, and
  activity narratives + indicator-update comments/dataSource feed the narrator;
  statement-level sources render in the report workspace. **2026-08-18
  (professional report generation, release `20260818074405`):** verified findings
  carry indicator name/type/baseline/target, the previous-period `comparisonValue`,
  and a deterministic `performanceEvaluation`; the narrator prompt gains
  project/reporting-period/donor-template context blocks, per-section guidance,
  indicator target + period-on-period narration, evidence metadata, participant
  disaggregation, quality-flag caveat language, and a worked example (evidence
  chunks 8×800; `maxTokens` stays 4096 for the MiniMax timeout constraint). The evidence
  tagger/polisher/checklist handlers remain heuristic-stub backed, and the export
  builder embeds charts but remains otherwise deterministic
  (see `imp/LLM-PROVIDER-WIRING.md`, `Features/19-Tiers-And-Payments.md`).
- **Creem billing live in test mode (2026-08-18, Feature 19):** `BILLING_PROVIDER=creem`
  + `CREEM_TEST_MODE=true` with four test product IDs are wired in production.
  Phase 4 reconciliation handlers (`reconcile-billing-subscriptions`,
  `reconcile-managed-storage`, `release-stale-usage-reservations`,
  `retry-billing-inbox`) + a shared `BillingSubscriptionSynchronizer` are
  deployed as `/internal/billing/*` Kestra routes; the webhook resolves tenants
  from checkout metadata. Pricing **Continue** buttons route Team/Growth signups
  through a new `/checkout` route to the hosted Creem checkout, and the `/thanks`
  page (with redirect-signature verification) guides setup. **All 14-day trial
  references were removed** — every workspace starts on free STARTER and pays to
  upgrade. See `Features/19-Tiers-And-Payments.md`.
- Report sections support user-selectable charts (2026-08-17); dashboard-level
  trend widgets remain roadmap.
- Phase 4 (ACT/EVD) routes exist but no dedicated Phase 4 frontend report was written.
- Cross-project Reports/Compliance currently compose accessible per-project API
  responses; authoritative paginated organization read models remain pending for scale.
- Complete project editing and the per-indicator *update history* read model
  (`GET /v1/indicators/:id/updates`) remain blocked on safe, audited backend
  contracts. Per-reporting-period indicator **data entry** is done (2026-08-16):
  spreadsheet grid at `/projects/[id]/reports/[periodId]/indicators`, bulk
  upsert (`POST /v1/indicator-updates/bulk`), unique (indicator, period),
  per-row submit/verify, and Google Sheets import
  (`POST /v1/indicator-updates/parse-sheet`). See
  `Features/06-Logframe-And-Indicator-Manager.md`.
