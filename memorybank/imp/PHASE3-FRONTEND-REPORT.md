# DonorDesk Frontend — Phase 3 Implementation Report

**Date:** 2026-08-12
**Scope:** Phase 3 "Operational Home and role queues" (DASH, NTF-01, PROJ-02/03) from `memorybank/imp/frontend-imp-plan.md`
**Status:** Delivered; backend dependency tracked below.

---

## 1. What was delivered

### DASH-01 — Authoritative dashboard read model — Done
- **`features/dashboard/application/dashboard-read-model.ts`** — server-only loader that composes authoritative data **from real per-resource endpoints** (projects, notifications, per-project reporting-period deadlines, evidence-pending-review counts). It does **not** consume the `/v1/dashboard` endpoint, which hard-codes zeros for several metrics; no fake or browser-derived health is shown.
- Per-widget `DashboardWidget<T>` result type (`{ ok, value, error }`) so each widget fails independently and never degrades to zero silently.
- `features/dashboard/presentation/deadline-bands.ts` — pure, unit-tested `classifyBand` (overdue/today/soon/later).

### DASH-02 — Home — Done
- `app/(portal)/dashboard/page.tsx` — "My Work"-first operational home with:
  - deadline bands (overdue/today/within-3-days/on-track) linked to each report workspace;
  - linked count cards (active projects, reports needing attention, pending evidence, unread notifications) each drilling to a filtered destination;
  - honest per-widget error/empty states (`—`, never zero);
  - My Work + notification previews.

### DASH-03 — My Work — Done
- `features/work-items/domain/work-item.ts` — discriminated `WorkItem` union (report/checklist/evidence/activity/notification) with a pure `urgencyOf` + `compareUrgency`.
- `features/work-items/application/work-items-read-model.ts` — composes reports, checklist gaps, pending evidence, activities, and unread notifications across the user's projects, ordered by urgency.
- `features/work-items/presentation/work-items-view.ts` — pure, unit-tested filter (type/project/due), pagination, and per-kind href/title/meta.
- `app/(portal)/my-work/page.tsx` — URL-backed filters, urgency ordering, pagination, contextual primary actions; added to nav.

### DASH-04 — Project portfolio — Done
- `features/projects/presentation/project-portfolio.ts` — pure, unit-tested search/filter/sort/pagination; archived hidden by default.
- `app/(portal)/projects/page.tsx` — URL-backed search form, status/sector/sort selects, archived toggle, desktop table + mobile cards, inline error on data failure (controls always render).

### NTF-01 — Notification inbox — Done
- `app/(portal)/notifications/page.tsx` — full inbox with read/unread/all filters (URL-backed), grouped dates, no email-delivery claims.
- `app/(portal)/notifications/MarkReadButton.tsx` + `lib/actions/notifications.ts` — mark-read via the audited `POST /v1/notifications/:id/read` server action.
- Added to nav.

### PROJ-02/03 — Project overview — Done
- `features/projects/application/project-overview-read-model.ts` — composed read model (project + reporting periods + authoritative readiness breakdown + checklist gaps + pending evidence + activity count).
- `app/(portal)/projects/[id]/page.tsx` — overview UI with active-period selector, readiness gauge + weighted component breakdown, open compliance gaps, setup card when no period exists, and static navigation to templates/logframe.

---

## 2. Verification (clean local run)

- `pnpm -r typecheck` — pass (7 packages)
- `pnpm -r lint` — pass (7 packages)
- `pnpm --filter @donordesk/web build` — pass; route table includes `/my-work` and `/notifications`, no regression
- `pnpm --filter @donordesk/web test:unit` — 52 pass, 0 fail (adds deadline-band, portfolio filter/sort, work-item filter/pagination/urgency suites)
- Playwright (runnable subset, no live API): foundation + shell + phase2 + phase3 — 12 pass (dashboard home, projects portfolio, notifications inbox, project detail graceful degradation)

> Full API+DB E2E journeys cannot run in this environment (Docker daemon down; PostgreSQL **server** binaries absent; no sudo to start a cluster). This is an environment limitation, not a code failure; the composed read-model logic is covered by unit tests and the pages by the runnable Playwright subset.

---

## 3. SOLID and architecture compliance

- **SRP:** read-model loaders (data acquisition), pure view-model/filter modules (logic), and route pages (composition) are separate. No page fetches directly or duplicates gateway calls.
- **OCP:** adding a new work-item kind requires extending the discriminated union + its view mapper — list pages stay unchanged. New dashboard widgets register via the widget result type.
- **ISP:** `loadDashboard`, `loadWorkItems`, and `loadProjectOverview` expose narrow composed queries; pages never import the gateway.
- **DIP:** feature application depends on gateway abstractions; pure domain/presentation modules have zero infra imports (verified by unit tests running them under plain Node).
- **DRY:** shared `Badge`, `Pagination`, `InlineError`, `EmptyState`, tone mappers, and labels reused; no duplicated status/color logic.
- **No fake data:** the composed dashboard reads real endpoints; per-widget availability is explicit; failure never renders as zero.

---

## 4. Honest exclusions / backend dependencies (tracked, not claimed done)

- **Project-assignment ABAC / cross-project isolation** (plan FE-B03, DASH acceptance): the backend does not yet enforce non-admin project membership. The frontend composes from the authenticated API (which is tenant-scoped) and gates actions by capability, but the backend ABAC fix + integration tests must land before global lists are fully trusted. This remains a backend task, not claimed complete here.
- **Global search (NTF-02):** no permission-filtered global-search contract exists → not implemented (per plan, blocked).
- **Email/notification delivery:** in-app only; no delivery claims.
- **Readiness:** uses the authoritative `/v1/reporting-periods/:id/readiness` endpoint only.

---

## 5. Exit gates status (Phase 3)

| Gate | Status |
|---|---|
| Authoritative data only | Done (composed from real endpoints; `/v1/dashboard` zero-stubs not used) |
| Each card drills to filtered records | Done |
| Partial failure is visible | Done (per-widget `DashboardWidget`, inline errors, `—` never zero) |
| Each role reaches priority work within two interactions | Done (My Work first, linked counts, contextual actions) |
| Global views cannot leak unassigned projects | Blocked on backend ABAC (FE-B03) — documented, not claimed |
