# DonorDesk Frontend — Phase 5 Implementation Report

**Date:** 2026-08-12
**Scope:** Phase 5 "Reporting and compliance" (REP-01…REP-06, CMP-01…CMP-03, shared job handling) from `memorybank/imp/frontend-imp-plan.md`
**Status:** Delivered; backend provenance dependency tracked below.

---

## 1. What was delivered

### Backend read model + conflict contract (enabling the workspace)

- **`GetReportDraftHandler`** (`packages/application/src/use-cases/reporting/get-report-draft.ts`) + `GET /v1/reporting-periods/:id/draft` — the composed read model REP-02 asked for: latest draft + ordered sections (title, order, content, source references, unsupported claims, status, and `updatedAt` as the version token). Registered in the container; RBAC-gated on `report.edit`.
- **Optimistic concurrency for autosave (REP-04):** `UpdateSectionSchema` gained `expectedVersion` (a section `updatedAt` token). `UpdateReportSectionHandler` now rejects with a `DomainError.conflict` (→ HTTP 409 → `kind: "conflict"`) when the token no longer matches the stored section, and returns `{ version }` on success. `PUT /v1/report-sections/:id` returns that new version.

### REP-01 — Reporting pipeline — Done

- `app/.../reports/page.tsx` rewritten as a status-grouped, scannable list (start/end, donor + internal deadlines, readiness, urgency via pure `deadlineUrgency`).
- `NewReportingPeriodForm` (`features/reporting/presentation/`) — coherent-date validation (start ≤ end ≤ deadline; internal ≤ donor) via pure `validateReportDates`, optional donor-template selection with honest guidance when no template exists, and internal-review-deadline field. Server page fetches the project's templates.

### REP-03 — Three-panel workspace — Done

- `features/reporting/presentation/ReportWorkspace.tsx` — left section navigation (status badges), center section editor, right context (readiness + open checklist with links to real components). Responsive: panels collapse to a tab switcher on mobile. Draft header shows status, version, and AI/manual origin.

### REP-04 — Autosave and conflict safety — Done

- `features/reporting/application/autosave-reducer.ts` — pure, unit-tested reducer (idle/dirty/saving/saved/failed/conflict) with `savedText`, `version`, and `recovery`.
- `features/reporting/presentation/SectionEditor.tsx` — debounced (800 ms) autosave via `updateReportSectionAction` sending `expectedVersion`; saving/saved/failed/conflict via `AutosaveStatus`; obsolete requests guarded by a latest-text ref; on conflict shows a recovery copy and a "Load latest version" / "Discard my unsaved changes" path. No silent overwrite of a newer revision. Recovery stays in component memory only (no unapproved localStorage).

### REP-05 — AI generation — Done

- "Generate / Regenerate AI draft" and "Run compliance check" buttons with consistent busy/error handling. When the organization has AI disabled the backend produces blank manual sections, so manual editing is always available; copy labels the draft AI-assisted vs manually created.

### REP-06 — Source linking (honest subset) — Done

- Existing section `sourceReferences` render as section-level chips with an explicit note that paragraph-level provenance is not yet available. No unsupported-claim detector is presented as operational.

### CMP-01/02/03 — Compliance — Done

- `app/.../compliance/page.tsx` — URL-backed period selector, fetches the checklist + readiness for the selected period.
- `features/compliance/presentation/CompliancePanel.tsx` — open items grouped by severity, status/severity filters, per-item type/severity/status/due metadata, and a **readiness explanation** panel that links each weighted component to its real records.
- `features/compliance/presentation/ChecklistResolution.tsx` — Start / Resolve / Accept risk / Not applicable with a required note, and a confirmation step for high/critical risk. No optimistic final state (server confirms, then refresh).
- `lib/shared/compliance-links.ts` — pure, unit-tested discriminated mapping of each checklist type (and linked evidence/activity) to the correct fix destination.

### Shared job handling

- The AI draft/compliance-check/export paths are synchronous in this backend, so there is no live job resource. Shared handling is provided by the consistent `useActionState` (busy/error) reused across generate, detect, and submit-for-review, plus the autosave state machine. No percent-completion is fabricated.

---

## 2. Verification (clean local run)

- `pnpm -r typecheck` — pass (7 packages)
- Backend builds (`application`, `infrastructure`, `api`) — pass
- `pnpm --filter @donordesk/web build` — pass; routes `/reports/new`, `/reports/[periodId]`, `/compliance` updated without regression
- `pnpm --filter @donordesk/web test:unit` — 95 pass, 0 fail (adds autosave-reducer, report-dates, compliance-links, and date/urgency suites)
- API foundation tests (server builds, routes register, RBAC) — 3 pass

> Full API+DB E2E journeys cannot run in this environment (no live PostgreSQL/Keycloak). This is an environment limitation, not a code failure; the new read-model, autosave, date, and compliance logic is covered by unit tests and the routes by the API build/foundation suite.

---

## 3. SOLID and architecture compliance

- **SRP:** read-model loaders/handlers (data), pure reducers/validators/mappers (logic), and route pages (composition) are separate. No page fetches or duplicates gateway calls.
- **OCP:** adding a section/checklist action is a new reducer case or fix-link entry; list and workspace components stay unchanged. New report sections need no workspace edit.
- **ISP:** `SectionEditor`, `ChecklistResolution`, and `CompliancePanel` depend only on the narrow action functions and props they need; pages never import the gateway.
- **DIP:** feature components depend on server-action abstractions; pure modules have zero infrastructure imports (verified under plain Node in unit tests).
- **DRY:** shared `Badge`, `ReadinessGauge`, `AutosaveStatus`, `SourceReferenceList`, tone mappers, and centralised labels/options reused; no duplicated status/color/date logic.
- **No fake data:** readiness uses only the authoritative backend score; deadline urgency and source wording match actual guarantees; failure states are visible, never silent zeros.

---

## 4. Honest exclusions / backend dependencies (tracked, not claimed done)

- **Paragraph-level provenance / claim linking (REP-06):** no backend claim/provenance contract exists. The workspace shows section-level references only and labels them accurately. This is tracked as blocked on backend, per plan.
- **Report approval / request-changes / pre-approval summary (REV-02/03):** these are Phase 6 deliverables, not claimed here.
- **AI generation is synchronous and stub-backed in non-production:** the draft generator is a stub; manual blank drafts are the real fallback when AI is disabled. No source-verified claim is implied.
- **Autosave recovery is in-memory only:** no approved browser storage helper exists, so unsaved recovery copy is held in component state (copyable) rather than written to unapproved storage.

---

## 5. Exit gates status (Phase 5)

| Gate | Status |
|---|---|
| Editor autosave cannot silently overwrite newer content | Done (optimistic `expectedVersion` → 409 conflict, recovery + reload path) |
| AI failure does not block manual editing | Done when AI is disabled (blank manual sections); transient generation errors show a retryable state |
| Readiness links to real components | Done (each weighted component links to its records) |
| Compliance fixes navigate to the correct entity | Done (discriminated fix-link map incl. linked evidence/activity) |
| Source-support wording matches actual provenance guarantees | Done (section-level only, explicit "paragraph-level provenance not available" note) |
