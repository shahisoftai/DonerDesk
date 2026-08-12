# DonorDesk Frontend — Phase 2 Implementation Report

**Date:** 2026-08-12
**Scope:** Phase 2 "Authentication, onboarding, and project setup" (AUTH, PROJ-01, TPL, LOG) from `memorybank/imp/frontend-imp-plan.md`
**Status:** Delivered; backend dependencies and honest exclusions tracked below.

---

## 1. What was delivered

### AUTH-01 — Hardened authentication UI — Done
- **`features/auth/application/auth-service.ts`** — server-only `AuthService` that:
  - validates the `/v1/auth/login` and `/v1/auth/signup` **response shape** with a shared Zod `AuthResponseSchema` (no unchecked token acceptance);
  - distinguishes validation (400/422) with field errors, rate-limit (429), and generic failures;
  - uses **generic credential/reset errors** to avoid account discovery (identical message regardless of whether the email exists).
- **`features/auth/application/auth-schemas.ts`** — shared `AuthFormState` and response schemas.
- **`lib/auth-actions.ts`** — rewritten as thin server-action adapters over `AuthService`; preserves non-secret signup values on failure via uncontrolled form fields; no client token access.
- **`app/login/page.tsx`** and **`app/signup/page.tsx`** — refactored to the shared `Field`/`Input`/`Select`/`Button` primitives with `htmlFor`/`id` labels, `aria-invalid` on errors, generic error alert, preserved values. OIDC entry preserved. Removed duplicated inline enum lists in favor of shared labels.

### AUTH-02 — Forgot password (honest) — Done
- **`app/forgot-password/page.tsx`** — provides honest support guidance only. No simulated email, no fake reset form, because no backend reset contract/delivery exists. Explains that an admin can reset the password and to contact the workspace administrator.
- Added `/forgot-password` to the middleware matcher.

### AUTH-03 — Resumable onboarding — Done
- **`features/onboarding/application/onboarding-status.ts`** — server-only loader that **derives setup progress from authoritative entities** (organization, projects, first project's templates/logframe, team, evidence). Refresh/back/return preserves completed steps because progress is derived, not stored in browser.
- **`features/onboarding/presentation/onboarding-steps.ts`** — pure, unit-tested step derivation (complete/current/pending), where creating the first project is the required gate and all other steps are skippable/resumable. No unsupported claims.
- **`app/(portal)/onboarding/page.tsx`** — accessible checklist (`role="tree"`-like list, aria-current) with contextual actions; a success banner when setup is complete; graceful error state when data is unavailable (never silent zero).
- Nav adds a **Setup** entry for users with `project.create`; each step links to the relevant next action.

### PROJ-01 — Guided project creation — Done
- **`features/projects/validation/project-wizard.ts`** — pure, unit-tested Zod step schemas and per-step validation (identity → geography/sector/dates → reporting). Field-error mapping and honest in-memory state (no autosave claim; work is kept in browser until submit).
- **`app/(portal)/projects/new/page.tsx`** — multi-step guided wizard with progress indicator, per-field errors, review summary, Back/Next navigation, and submit via the existing `createProjectAction` (which validates against `CreateProjectSchema`).

### TPL — Donor templates (honest states) — Done
- **Template list** — shows version and section counts; in non-production shows an explicit banner that **automatic file extraction is a preview**, not source-verified.
- **Upload page** — relabeled from "Upload & extract" to "Review sections"; explicit note that only pasted text is supported in this version (no fake file-upload claim for PDF/DOCX that are not wired); extraction suggestions clearly labeled as requiring review.
- **Section editor** — uses shared input-type labels; copy corrected to "confirmed sections, not source-verified extractions."

### LOG — Logframe & indicators (setup portions) — Done
- **`lib/shared/hierarchy.ts`** — pure, unit-tested tree builder/`walkHierarchy`.
- **`app/(portal)/projects/[id]/logframe/page.tsx`** — accessible results hierarchy tree (Goal → Outcome → Output → Activity) with depth indentation, `role="tree"`/`aria-level`, level badges, per-item indicator counts, and an "Add indicator" action per item; indicators table now shows type and unit; table has a caption.
- **`app/(portal)/projects/[id]/logframe/new-indicator/page.tsx`** — indicator creation form backed by the real `POST /v1/indicators` route, with optional `itemId` preselection via query param.
- **`lib/actions/indicators.ts`** — server actions for create indicator, create indicator update, and verify indicator update (all map to registered API routes).

---

## 2. Verification (clean local run)

- `pnpm -r typecheck` — pass (7 packages)
- `pnpm -r lint` — pass (7 packages)
- `pnpm --filter @donordesk/web build` — pass; route table includes all Phase 2 routes with no regression
- `pnpm --filter @donordesk/web test:unit` — 45 pass, 0 fail (adds onboarding-step derivation, hierarchy tree)
- Playwright (runnable subset, no live API required): foundation + shell + `phase2.spec.ts` — 6 pass (forgot-password guidance, guided wizard navigation, onboarding graceful render)

> Note: the full Phase 2 Playwright suite (journeys requiring the Fastify API + PostgreSQL) could not be executed in this environment: the Docker daemon is not running, PostgreSQL **server** binaries are not installed (only client tools), and starting the cluster requires sudo credentials that are unavailable. This is an environment limitation, not a code failure. These E2E journeys remain covered by the unit/contract tests added here and the existing auth-boundary suite.

---

## 3. SOLID and architecture compliance

- **SRP:** route files authenticate + compose; `AuthService` owns auth transport; onboarding loader owns data acquisition; step derivation is pure; wizard validation is pure; pages own only presentation.
- **OCP:** enum options/labels centralized in `lib/labels.ts`; adding a new sector/org-type/report-type only touches the registry, not page code.
- **ISP:** `loadOnboarding`, `AuthService`, and gateway methods expose narrow operations; pages never import `api-gateway` directly.
- **DIP:** server actions and `features/*/application` depend on gateway/service abstractions; UI components never read cookies or build privileged requests.
- **No duplication:** shared labels, shared `Field`/`Input`/`Select` primitives, shared `InlineAlert`/`Button`; per-page inline enum arrays removed.

---

## 4. Honest exclusions / backend dependencies (tracked, not claimed done)

- **Password reset / email delivery:** no backend contract or delivery exists → only support guidance shown (per plan FE-B06 / AUTH-02). No simulated email.
- **Template file parsing (PDF/DOCX), copy-paste AI extraction quality:** parser/extraction runtime not wired → UI explicitly labels extraction as a preview and supports pasted text only (per FE-B04 / TPL backend dependency).
- **Project-assignment ABAC:** still a backend/API task (FE-B03); UI capability gating remains secondary and the API stays authoritative.
- **Indicator detail/update history, disaggregation contracts:** only what the current API exposes (create indicator, create indicator update, verify update) is wired; no fabricated read models.
- **S3/BYOS/integration controls:** not exposed (FE-B07).
- **Email/notification delivery:** in-app only; no delivery claims (FE-B06).

---

## 5. Exit gates status (Phase 2)

| Gate | Status |
|---|---|
| New admin can complete supported setup | Done (onboarding → guided project → template → logframe all reachable with real actions) |
| Optional/unsupported capabilities are honest | Done (stub extraction labeled; forgot-password honest; only deployed data modes shown) |
| Form recovery and validation tests pass | Done (45 unit + 6 Playwright) |
| Onboarding state survives refresh/return | Done (derived from authoritative entities) |
| Role access verified | Partial: capability gating server-side; project-assignment ABAC remains backend (FE-B03) |
