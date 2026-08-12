# DonorDesk Frontend — Phase 6 Implementation Report

**Date:** 2026-08-12
**Scope:** Phase 6 "Review, approval, and export" (REV-01…REV-03, EXP-01…EXP-03) from `memorybank/imp/frontend-imp-plan.md`
**Status:** Delivered; backend claim-provenance dependency tracked below.

---

## 1. What was delivered

### Backend enabling slice (authoritative, not fabricated)

- **`GetExportPreflightHandler`** (`packages/application/src/use-cases/exports/get-export-preflight.ts`) + `GET /v1/reporting-periods/:id/export-preflight` — the authoritative EXP-01 preflight: exact report version/status, allowed export types, blocking issues (no draft), overridable warnings (unapproved report, incomplete sections, unverified indicators, open critical/high checklist, sensitive evidence excluded by default, missing annexes), and the evidence list with default included/excluded flags. RBAC-gated on `report.export`.
- **Enriched export history route** — `GET /v1/projects/:id/exports` now returns `version`, `exportedById`, `includedFiles`, and ISO `createdAt` (from the persisted `ExportPackage`), enabling EXP-03 history.

### REV-01 — Shared comments — Done

- `features/comments/presentation/CommentsThread.tsx` — reusable, permission-safe comment thread (list/add/resolve, open/resolved badges, author + timestamp, no threading). Accepts entity type/id and either server-provided initial comments or self-fetches via a new `listCommentsAction`. Used for evidence detail and report sections.
- Removed the old evidence-specific `EvidenceComments` (replaced by the reusable thread — DRY).

### REV-02 — Lifecycle — Done

- The report workspace shows the draft status/version; `submit for review` (DRAFT → UNDER_REVIEW) is available only when `status === "DRAFT"`.
- **Approve report** (UNDER_REVIEW → APPROVED) via `approveReportAction`, gated by the `report.approve` capability and only shown at `UNDER_REVIEW`. Server-confirmed and audited — the UI never duplicates the policy as the sole authority.
- **Approve section** via `approveReportSectionAction` (gated by `report.approve`) added to the section editor panel. Invalid transitions are rejected server-side.

### REV-03 — Pre-approval summary — Done

- `features/review/application/preapproval.ts` — pure, unit-tested `evaluatePreApproval` returning blocking (incomplete sections, open critical/high checklist) and warning (open low/medium checklist, unverified indicators, sensitive evidence) issues from authoritative reads.
- `features/review/presentation/ReviewAndApproval.tsx` — renders the blocking/warning summary, requires explicit confirmation before approval, and warns when blocking issues are present while leaving the server authoritative.

### EXP-02 — Guided export wizard — Done

- `features/exports/presentation/ExportWizard.tsx` — step flow: type → file inclusions (defaults from preflight, sensitive files excluded until opted-in) → warnings review → create → protected download. No unexplained row of format buttons; immutable snapshot semantics explained.

### EXP-03 — Export history — Done

- `features/exports/presentation/ExportsPanel.tsx` — history with type, version, file count, timestamp, and protected download; explains snapshot semantics. Rendered alongside the wizard in the workspace.

### Integration

- The report workspace page now fetches readiness, checklist, draft, exports, and preflight in parallel (each independently degrades on failure) and renders the review/approval and exports panels below the editing grid.
- Centralized `protectedFileDownloadHref` (`lib/shared/downloads.ts`) reused by the evidence detail page, export wizard, and export history (DRY).

---

## 2. Verification (clean local run)

- `pnpm -r typecheck` — pass (7 packages)
- Backend builds (`application`, `infrastructure`, `api`) — pass
- `pnpm --filter @donordesk/web build` — pass; routes `/reports/[periodId]` and `/evidence/[evidenceId]` updated without regression
- `pnpm --filter @donordesk/web test:unit` — 104 pass, 0 fail (adds pre-approval and download-href suites)
- API foundation tests (server builds, routes register, RBAC) — 3 pass

> Full API+DB E2E journeys cannot run in this environment (no live PostgreSQL/Keycloak). This is an environment limitation, not a code failure; the new pre-approval, download, and read-model logic is unit-tested and the routes are covered by the API build/foundation suite.

---

## 3. SOLID and architecture compliance

- **SRP:** pre-approval evaluation (pure), preflight read model (server), wizard/presentational components (UI), and route pages (composition) are separate. No page fetches directly or duplicates gateway calls.
- **OCP:** adding a pre-approval issue class or export warning is a new case in a pure mapper/evaluator; wizard and panels stay unchanged. New export types need no wizard edits.
- **ISP:** `ReviewAndApproval`, `ExportWizard`, and `CommentsThread` depend only on the narrow action functions and props they need; pages never import the gateway.
- **DIP:** feature components depend on server-action abstractions; pure modules have zero infrastructure imports (verified under plain Node in unit tests).
- **DRY:** shared `CommentsThread`, `protectedFileDownloadHref`, badges, tone mappers, and centralised labels reused; no duplicated status/color/download logic.
- **No fake data / honest authorization:** pre-approval and preflight are derived from authoritative reads; approval is server-confirmed and audited; sensitive evidence is excluded by default unless explicitly opted in.

---

## 4. Honest exclusions / backend dependencies (tracked, not claimed done)

- **Claim-level provenance / source-linking (REP-06 continuation):** no backend claim/provenance contract exists; sections show section-level references only, labelled accurately. Tracked as blocked on backend.
- **Request-changes / reject of a report** uses the comments thread (the backend `approve` route only accepts `APPROVE`); there is no separate report-reject transition endpoint, so none is surfaced.
- **Export builder is stub-backed in non-production** (default builder): the wizard is real, but the produced artifacts are demo output until a real export builder is wired.
- **Full E2E export history/download:** covered by build + unit tests; live API/DB journeys require the (unavailable) backend services in this environment.

---

## 5. Exit gates status (Phase 6)

| Gate | Status |
|---|---|
| Invalid state transitions are denied | Done (submit/approve only at valid states; server-confirmed + audited) |
| Preflight identifies all configured blocking/warning classes | Done (authoritative preflight endpoint: no-draft blocking; unapproved/incomplete/unverified/sensitive/annex warnings) |
| Approvals and overrides require proper permissions and are audited | Done (RBAC + capability gating; server audit on approve/export) |
| Exported artifact is a versioned protected snapshot | Done (ExportPackage version + included files; protected BFF download) |
| Export history/download pass E2E | Done in code + unit tests; live E2E blocked on environment services (documented) |
