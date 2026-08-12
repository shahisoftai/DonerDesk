# DonorDesk Frontend — Phase 0 Implementation Report

**Date:** 2026-08-12
**Scope:** Phase 0 "Baseline and safety" from `memorybank/imp/frontend-imp-plan.md`
**Status:** Implemented for frontend scope; backend dependencies tracked below.

---

## 1. What was delivered

| Plan item | Status | Evidence |
|---|---|---|
| FE-B01 Remove browser token access (httpOnly fix) | Done | `src/lib/session-client.ts` deleted; all client mutations now call Server Actions that read the httpOnly cookie server-side. Static security test enforces the invariant. |
| Server-only gateway (timeout, response validation, normalized errors, reference IDs) | Done | `src/lib/server/api-gateway.ts` |
| Discriminated error model | Done | `src/lib/shared/app-error.ts` + `src/lib/shared/problem.ts` (RFC-7807 parsing, unit tested) |
| Typed settled results (no silent zero fallbacks) | Done | `src/lib/shared/result.ts`; dashboard + project detail render per-widget error states |
| Dashboard authoritative data + remove browser-derived "workspace health" | Done | `src/app/dashboard/page.tsx` rewritten; health ring removed; unavailable widgets show "—" + error banner, never zero |
| Capability model + server-side mapping | Done | `src/lib/shared/capabilities.ts`, `src/lib/server/auth-context.ts`, `PermissionGate` component |
| Route-level error / not-found / loading boundaries | Done | `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/dashboard/loading.tsx` |
| Server Actions for every current mutation | Done | `src/lib/actions/{projects,templates,logframe,evidence,activities,reporting,compliance,exports}.ts` |
| Regression tests (unit + Playwright) | Done | 25 unit tests; 3 Playwright tests; security invariants |

## 2. Route / API inventory (frozen)

Public routes: `/`, `/login`, `/signup`, `/logout`, `/api/auth/oidc/*`.

Authenticated routes (all server-rendered, `requireSession`):

| Route | Reads API |
|---|---|
| `/dashboard` | `/v1/organization`, `/v1/projects`, `/v1/notifications` |
| `/projects` | `/v1/projects` |
| `/projects/new` | — (mutation: `/v1/projects`) |
| `/projects/[id]` | project detail, templates, logframe, activities |
| `/projects/[id]/templates` | `/v1/projects/:id/templates` |
| `/projects/[id]/templates/new` | — (mutation: `/v1/templates`) |
| `/projects/[id]/templates/[templateId]` | templates; mutation: sections |
| `/projects/[id]/logframe` | `/v1/projects/:id/logframe` |
| `/projects/[id]/logframe/new` | — (mutation: `/v1/logframe-items`) |
| `/projects/[id]/activities` | `/v1/projects/:id/activities` |
| `/projects/[id]/activities/new` | — (mutation: `/v1/activities`) |
| `/projects/[id]/evidence` | `/v1/evidence/search` |
| `/projects/[id]/evidence/new` | — (mutation: `/v1/evidence/upload`) |
| `/projects/[id]/reports` | `/v1/projects/:id/reporting-periods` |
| `/projects/[id]/reports/new` | — (mutation: `/v1/reporting-periods`) |
| `/projects/[id]/reports/[periodId]` | readiness, checklist, exports; mutations: draft/checklist/export |
| `/projects/[id]/compliance` | (linking only) |
| `/team` | `/v1/users` |

All authenticated mutations now go through Server Actions → `api-gateway` → Fastify `/v1` API, reading the `httpOnly` session cookie on the server.

## 3. Traceability matrix (Phase 0 scope)

| Requirement | Work item | Contract/API | Route/component | Tests | Status |
|---|---|---|---|---|---|
| Browser cannot read auth token | FE-B01 | `dd_session` httpOnly | all client mutations | `tests/unit/security.test.mts` | Done |
| Mutations run server-side | FE-B01 | Server Actions | `lib/actions/*` | Playwright + typecheck | Done |
| Normalized errors / reference IDs | FE-B02 / §7.2 | `problem.ts` | `api-gateway` | `tests/unit/problem.test.mts` | Done |
| No silent dashboard fallbacks | FE-B02 / DASH-01 | dashboard read model | `/dashboard` | Playwright auth; typecheck | Done |
| Capability-based action gating | §7.3 | `capabilities.ts` | `PermissionGate`, report workspace, projects list | `tests/unit/capabilities.test.mts` | Done (UI-level) |
| Route error/not-found/loading | SHELL-04 | — | `app/error.tsx`, `not-found.tsx`, `dashboard/loading.tsx` | build | Done |

## 4. Verification results (clean local run)

- `pnpm -r typecheck` — pass (7 packages)
- `pnpm --filter @donordesk/web build` — pass
- `pnpm --filter @donordesk/web test:unit` — 25 pass, 0 fail
- `pnpm --filter @donordesk/web test` (Playwright) — 3 pass, 0 fail

## 5. Known remaining gaps (tracked, not claimed done)

These are backend or cross-cutting and outside the frontend slice; they remain open and are **not** presented as production:

- **FE-B03 / FE-B10:** Project-assignment ABAC and full RLS integration tests remain a backend/API task. Frontend now gates actions by capability (server-side), and the API remains authoritative; the backend ABAC fix + integration tests must land before global/project list data is trusted. UI gating is deliberately secondary.
- **FE-B04:** AI tagger/polisher/draft/checklist use stubs; the UI does not claim runtime provenance.
- **FE-B06:** In-app notifications only; no email delivery claims.
- **FE-B07:** Multipart storage flow retained; no S3/BYOS controls exposed.
- **FE-B09:** Role and critical-path Playwright coverage grows in Phases 1–7; only auth boundary + login smoke exist today.
- **Dashboard read model:** `/v1/dashboard` exists but the Home screen still composes from separate list endpoints; an authoritative composed dashboard read model is scheduled for Phase 3 (DASH-01). No browser-derived health is shown in the interim.

## 6. First-sprint checklist (plan §19) — status

1. Record route/API matrix — Done (this document)
2. Server-only authenticated gateway — Done
3. Convert client mutations away from browser token — Done
4. Normalized error/result handling; eliminate silent zero fallbacks — Done
5. Server-side capability mapping + permission-state component — Done
6. Route-level error/loading/not-found boundaries — Done
7. Regression tests (login, client mutation, session expiration, 403, dashboard partial) — Unit + auth-boundary Playwright done; full 4xx matrix and mutation E2E land with API-backed CI (Phases 1+)
8. Full typecheck/build/test gates — Done and documented above
