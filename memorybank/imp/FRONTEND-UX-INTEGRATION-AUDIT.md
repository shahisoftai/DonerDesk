# DonorDesk Frontend UI/UX Integration Audit and Fix Report

**Date:** 2026-08-12  
**Scope:** Post-Phase-7 audit of the implemented portal against `frontend-imp-plan.md` and `frontend-implementation.md`  
**Status:** Integration gaps fixed and deployed; dashboard parity follow-up deployed as web release `20260812224500`.

## 1. Audit outcome

The frontend compiled before this audit, but several implemented workflows were not consistently reachable or reflected in the application shell. The main defects were route-composition and navigation gaps rather than TypeScript failures.

Fixed findings:

| ID | Finding | Resolution |
|---|---|---|
| UX-01 | Dashboard linked to `/evidence`, but no organization evidence route existed. | Added a data-backed, permission-scoped cross-project evidence queue. |
| UX-02 | The portal sidebar omitted the specified Reports, Evidence, and Compliance operational queues. | Added all three primary navigation entries and their routes. |
| UX-03 | No cross-project report pipeline existed. | Added `/reports`, composed from accessible projects and reporting-period APIs, ordered by deadline. Partial failures remain visible. |
| UX-04 | No cross-project compliance queue existed. | Added `/compliance`, aggregating accessible open checklist items and ordering them by severity. Partial failures remain visible. |
| UX-05 | Project context showed only the title. | Added code, donor, country, sector, status, duration, and reporting frequency to the shared project header. |
| UX-06 | Project Team and Settings tabs from the route map were absent. | Resolved end-to-end (2026-08-16, release `20260816094257`): the Team tab renders real per-project assignments (assign/change-role/remove, audit + notification) and Settings is a full audited editor (identity/dates/budget/status + archive/complete). |
| UX-07 | Indicator rows had no detail destination. | Added links and `/projects/[id]/indicators/[indicatorId]` with definition, measurement, and verification information. History is not fabricated because no safe history read model exists. |
| UX-08 | Export functionality was embedded but lacked the specified dedicated route. | Added `/projects/[id]/reports/[periodId]/export`, preflight warnings, export history, and a workspace link. |
| UX-09 | Nested project routes could leave the wrong tab selected when prefix matching. | Changed tab resolution to select the longest matching route. |
| UX-10 | The top bar had a permanently dominant project-only create action and no search affordance. | Added a context-aware Create menu and a `Ctrl/Cmd+K` shortcut that focuses the existing project search entry point. This is not represented as permission-filtered global search. |
| UX-11 | Production `/dashboard` still showed the thin Phase 3 home screen instead of the designed operational dashboard. | Reworked `/dashboard` to load My Work, readiness, deadline bands, verification/compliance/activity queues, richer project cards, notifications, and setup/storage notices. |
| UX-12 | Production `/my-work` could throw because a Server Component passed an `onChange` handler to a `<select>`. | Replaced the project selector with server-rendered filter links. |

## 2. Files and route coverage

New portal destinations:

- `/reports`
- `/evidence`
- `/compliance`
- `/projects/[id]/team`
- `/projects/[id]/settings`
- `/projects/[id]/indicators/[indicatorId]`
- `/projects/[id]/reports/[periodId]/export`

Shared integration updates include the authenticated portal layout, `AppShell`, project layout, nested tabs, project search focus behavior, logframe indicator links, and evidence response validation.

## 3. Verification

Completed after the fixes:

- `pnpm --filter @donordesk/web typecheck` — pass.
- `pnpm --filter @donordesk/web test:unit` — 23 test files pass, 0 fail.
- `pnpm --filter @donordesk/web build` — optimized Next.js production build passes.
- `git diff --check` — pass.
- Production release `20260812224500` verified on Contabo: `current` symlink
  points to the new release, `donordesk-web` is active on `127.0.0.1:3002`,
  public HTTPS `/dashboard` redirects unauthenticated users to login, `/login`
  returns 200, and the deployed server bundle contains the new dashboard sections.

Browser E2E was not claimed because this audit did not run against a live API/database/identity stack.

## 4. Honest remaining dependencies

- NTF-02 permission-filtered global search remains blocked on a backend search contract. The current shortcut focuses project portfolio search only.
- FE-B03 project-assignment ABAC remains a backend release dependency before cross-project queues can be considered production-trusted for non-admin roles.
- Complete project settings editing needs a registered update contract and audit semantics.
- Indicator update/history/disaggregation needs a tenant/project-scoped detail and history read model
  (`GET /v1/indicators/:id/updates`). The per-period **data entry** gap is closed (2026-08-16): the
  spreadsheet grid at `/projects/[id]/reports/[periodId]/indicators` reads
  `GET /v1/reporting-periods/:id/indicators` and saves via `POST /v1/indicator-updates/bulk`
  (see `../Features/06-Logframe-And-Indicator-Manager.md`).
- Global queue performance should eventually use authoritative organization-level read models instead of server composition across projects.
- Real AI, provenance, email delivery, object storage, and background job limitations remain as recorded in `pending.md`.

## 5. Release note

The route/shell integration was deployed in release `20260812220349`. The
dashboard parity and `/my-work` runtime fix were deployed as web-only release
`20260812224500` on 2026-08-12. Existing production release identifiers older
than `20260812224500` must not be interpreted as containing the redesigned
dashboard home.
