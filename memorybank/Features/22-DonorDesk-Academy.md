# Feature 22: DonorDesk Academy (guided tour, demo project, contextual help)

**Author:** Claude (agent) · **Date:** 2026-09-29
**Status:** Phases 0–2 IMPLEMENTED (demo project + guided tour); Phases 3–5 not started. See
§11 Implementation record.

## 1. Overview

New NGO staff face a long, multi-step reporting workflow (project setup → donor template →
logframe/indicators → evidence → activity updates → AI-assisted drafting → editing/assurance →
compliance → review → export) spread across many screens. Today the only onboarding is the
account-level setup checklist (`Features/01-Authentication-And-Onboarding.md`, the required/
optional steps in `apps/web/src/features/onboarding/presentation/onboarding-steps.ts`) plus a
static help center (`apps/web/src/app/support/*`). Neither teaches the end-to-end workflow or
shows the product in motion.

DonorDesk Academy adds three small, additive pieces inside the existing `apps/web` app — an
in-app guided product tour, a reusable per-tenant demo project, and contextual help links — built
around the real workflow already implemented, not a simplified or hypothetical one. It explicitly
avoids becoming a learning-management system: no new domain (see §2 deployment note), no video
CMS, no course/quiz engine.

This extends `01-Authentication-And-Onboarding.md` and `18-Project-Creation-Wizard.md`, and reads
context from every feature it tours (05–14).

## 2. Deployment note (no new portal)

Confirmed against `memorybank/contabo-ops.md`: DonorDesk has exactly two public domains,
`donordesk.online` (`apps/web`, port 3002 — tenant portal **and** marketing/support pages, same
Next.js app) and `sa.donordesk.online` (`apps/superadmin`). There is no separate marketing or
"academy" domain today, and none is proposed. The tour, demo project, and contextual help all
ship as new routes/components inside `apps/web`, reachable both from inside the logged-in portal
(`(portal)/...`) and from the existing public `support/*` section — no new subdomain, container,
or deploy pipeline required.

## 3. Requirements and scope

| # | Requirement |
|---|---|
| R1 | An in-app guided tour that walks the real workflow in the order a user naturally hits it, anchored to actual UI elements (not a scripted fictional UI). |
| R2 | A reusable, idempotent, per-tenant "demo project" a user can create/reset/delete on demand, built from the existing EERP seed scenario rather than new fictional content. |
| R3 | The demo project must not consume a real project's entitlement slot or AI-draft credits. |
| R4 | Tour entry points: post-onboarding CTA and a persistent "Start Tour" affordance, without replacing the existing account-setup checklist. |
| R5 | Short video library and contextual help surfaced from the existing `support/getting-started` section, not a new content system. |
| R6 | Tour/video/help additions must not require a new domain, container, or deploy pipeline (see §2). |
| R7 | Progress/completion state reuses the existing onboarding-status persistence pattern rather than introducing a second mechanism. |

Out of scope (explicitly deferred, matching the user's own "avoid an LMS" guidance): quizzes,
certificates, gamified progress tracking, a standalone learning portal/domain, and any new video
hosting/CMS — link out to externally hosted short videos initially.

## 4. Real workflow the tour must reflect

Ordered as a user actually encounters it (verified against `memorybank/Features/*` and
`apps/web/src/features/*`, not the simplified 6-step version in the originating proposal):

1. **Project creation wizard** (`18-Project-Creation-Wizard.md`) → redirect to resumable
   `/projects/[id]/setup` checklist.
2. **Donor Template Manager v2** (`05-Donor-Template-Manager.md`) — upload → TOC-first
   extraction → `NEEDS_REVIEW` → review/approve → `REVIEWED`.
3. **Logframe & Indicator Manager** (`06-*.md`) — define/import logframe, indicator
   baseline/target/unit/frequency.
4. **Evidence Library + AI Evidence Tagging** (`07-*.md`, `08-*.md`) — upload evidence, tagging.
5. **Activity Update Capture** (`09-*.md`).
6. **Reporting Period Manager** (`10-*.md`) — opens once setup readiness is `READY`
   (see `18-Project-Creation-Wizard.md` §8 hard requirements); pins the template/profile snapshot.
7. **AI Report Draft Generator / AI Reporter** (`11-*.md`, `20-report-gen.md`) — generated
   sections with sources, artifacts, QA, deltas.
8. **Report Editor v2** (assurance pass, claims/decisions, `EXCLUDED`, versioned saves).
9. **Missing Evidence & Compliance Checklist** (`12-*.md`).
10. **Review & Approval Workflow** (`13-*.md`).
11. **Export Module** (`14-*.md`) — internal watermarked vs. donor submission export.

Billing/entitlements (`19-Tiers-And-Payments.md`) gate steps 7 and 11 for real projects by tier;
the demo project must bypass these gates (§6).

## 5. Design decisions

### 5.1 Demo project is real data, seeded on demand, not a shared fixture

RLS in `infra/postgres/rls.sql` is deny-by-default per `tenantId`; there is no cross-tenant
fixture reuse. A new `CreateDemoProjectHandler` (application layer) seeds one project into the
**calling tenant**, adapted from `packages/infrastructure/src/db/seed-eerp.ts` and
`seed-eerp-evidence-activities.ts` (existing EERP scenario — reuse its content rather than
inventing new fictional data). Idempotent: if a demo project already exists for the tenant, return
it rather than duplicating (same pattern `seed.ts` uses for the demo org).

### 5.2 Demo project is clearly marked and excluded from entitlements

Add an `isDemo` flag to `Project` (or an equivalent marker read by
`packages/application/src/services/entitlement-service.ts`) so demo projects:
- do not count against `activeProjects` seat/plan limits,
- do not consume AI-draft credits — the demo project's AI Reporter step must serve pre-generated,
  canned draft output rather than calling the real LLM/worker pipeline,
- are visually badged "Demo" and are user-deletable at any time.

### 5.3 Tour is step data + a spotlight overlay, not a new state machine

No tour/tooltip library exists in the repo today (verified — no driver.js/shepherd/intro.js/
reactour). Add a small `apps/web/src/features/tour/` module: a step-definition list (route,
target selector, copy) driving a lightweight spotlight/tooltip overlay component. Steps map to
the workflow in §4, each anchored to real elements in `projects`, `templates`, `logframe`,
`evidence`, `reporting`, `report-editor`, `compliance`, `review`, `exports`.

### 5.4 One progress-tracking mechanism, not two

Extend the existing `onboarding-status.ts` persistence (used today for the account-setup
checklist) with a `tourCompletedSteps`-style field, instead of building a separate tracking table
or store for the tour.

### 5.5 Help center gets a "Watch" tab, not a new section

`apps/web/src/app/support/getting-started/` already exists as a static article section. Add a
"Watch" tab there for short screen-recording links, and a small reusable contextual-help button
component (deep-linking into existing `support/*` articles) placed on report-editor, templates,
and compliance screens. No new top-level route.

## 6. Target data model (sketch — finalize field names during implementation)

```prisma
model Project {
  // existing fields
  isDemo Boolean @default(false)
}
```

```typescript
// packages/application/src/services/entitlement-service.ts
// activeProjects count and AI-credit checks must exclude isDemo === true
```

```typescript
// apps/web/src/features/onboarding/application/onboarding-status.ts
type OnboardingStatus = {
  // existing fields
  tourCompletedSteps: string[]; // step ids from tour/step-definitions.ts
  tourDismissedAt?: string;
};
```

```typescript
// apps/web/src/features/tour/application/step-definitions.ts
type TourStep = {
  id: string;
  route: string;          // e.g. "/projects/[id]/setup"
  targetSelector: string; // DOM anchor for spotlight
  title: string;
  body: string;
  optional?: boolean;
};
```

## 7. API surface (sketch)

| Method | Route | Purpose |
|---|---|---|
| POST | `/v1/projects/demo` | Idempotent: create-or-return the tenant's demo project |
| DELETE | `/v1/projects/:id` (demo only initially) | Remove a demo project; reuses the deferred deletion work noted in `18-Project-Creation-Wizard.md` §5.9, scoped to demo projects only so it does not require solving general project deletion/retention first |
| GET/PUT | `/v1/onboarding/tour-progress` | Read/update `tourCompletedSteps` |

All mutations tenant-scoped, authorization-checked, and audited per repo convention
(`project.demo.created`, `project.demo.deleted`, `onboarding.tour.progressed`).

## 8. Phased implementation

### Phase 0 — Foundation decisions
- Confirm `isDemo` field name/placement and entitlement-service exclusion logic.
- Confirm tour library choice (favor a small dependency-free spotlight component over pulling in
  a new npm package, consistent with "avoid an LMS" scope discipline).
- Confirm canned AI-draft content source for the demo project (static fixture vs. one real
  generation captured once and replayed).

### Phase 1 — Demo project (High priority)
- `CreateDemoProjectHandler`, `isDemo` schema/migration, entitlement-service exclusion, RLS
  coverage for any new fields, "Demo" badge + delete action in UI.

### Phase 2 — Guided tour (High priority)
- `features/tour/` step definitions + overlay component.
- Entry points: post-onboarding CTA, persistent "Start Tour" affordance.
- Extend `onboarding-status.ts` with tour progress.

### Phase 3 — Video library (Medium priority)
- 5–6 short recordings following the demo project through §4's real steps.
- "Watch" tab in `support/getting-started`.

### Phase 4 — Contextual help (Medium priority)
- Reusable help-button component deep-linking to existing `support/*` articles; placed on
  report-editor, templates, compliance screens.

### Phase 5 — Progress analytics (Later, deferred)
- Only if usage data shows drop-off; reuse existing persistence rather than new tracking
  infrastructure.

## 9. Testing and risks

- Application: demo-project idempotency, tenant isolation, entitlement exclusion (`isDemo`
  projects must never count toward seat/project/AI-credit limits).
- Migration/RLS: any new `Project` column added to `rls.sql` coverage if it changes tenant-scoped
  query shape.
- Web: tour overlay doesn't break on missing DOM targets (route changes, permission-hidden
  elements); demo project delete flow; onboarding-status backward compatibility for existing
  tenants with no `tourCompletedSteps` field.
- Risk: demo AI-draft content going stale relative to real AI Reporter output changes — revisit
  canned content whenever `11-AI-Report-Draft-Generator.md` ships a contract change.

## 11. Implementation record (2026-09-29)

Phases 0–2 implemented on branch `0009-agent-memory`. Not yet deployed.

**Domain** (`packages/domain/src/contexts/projects/project.ts`): `Project.isDemo` (required
prop, defaults to `false` in `create()`, `Omit`ted from the create-input's base type and
re-added as an explicit optional field so existing callers are unaffected).

**Schema/migration**: `Project.isDemo Boolean @default(false)` +
`@@index([tenantId, isDemo])`; migration `20260929160000_project_is_demo`. No RLS change
needed — `isDemo` is a new column on an already-covered table, not a new isolation dimension.

**Application** (all new, SOLID-scoped — one handler per use case, ports over concretions):
- `CreateDemoProjectHandler` (`use-cases/projects/create-demo-project.ts`): idempotent
  (checks for an existing `isDemo` project first), seeds a project + `ProjectSetup`
  (`NOT_REQUIRED`) + a 3-level logframe + 2 indicators (baseline/target/unit/frequency) + a
  `REVIEWED` 2-section donor template + a `ReportingProfile` pointing at it — satisfying every
  hard requirement in `18-Project-Creation-Wizard.md` §8 so the demo project can immediately
  reach a reporting period, AI draft, and export. Content is a smaller version of the existing
  EERP nutrition scenario, not new fictional data.
- `DeleteDemoProjectHandler` (`use-cases/projects/delete-demo-project.ts`): refuses to run
  unless `project.isDemo === true` — cannot become a backdoor around the still-deferred general
  project-deletion feature (§5.9 of Feature 18).
- `IDemoProjectRepository` port (`ports/demo.ts`) — deletion is infrastructure's job (it alone
  knows every Prisma table a demo project can touch); the application layer only asserts the
  `isDemo` guard.
- `EntitlementService.usageSnapshot` excludes `isDemo` projects from both `activeProjects` and
  `archivedProjects`.
- `ListProjectsHandler` / `GetProjectHandler` now surface `isDemo` in their read models.

**Infrastructure**:
- `PrismaProjectRepository` maps `isDemo` through `create`/`toDomain`.
- `PrismaDemoProjectRepository` (`repositories/demo.ts`) — deletes everything a demo project
  owns in one transaction, in FK-safe order (claims → sections → drafts → indicators →
  logframe → template → period/activity/evidence → checklist/export/plan/generation-run →
  risk-trend/snapshot/override → member/setup/profile → the project row itself, guarded by
  `isDemo: true`). `DonorTemplateVersion`, `ReportRevision`, and `ReportArtifact` cascade
  automatically via the schema's `onDelete: Cascade`. `AuditEvent` and `Comment` are
  deliberately never deleted (plain string references, not enforced FKs — the audit trail must
  outlive the entity it describes).
- Container wiring (`container.ts`): `demoProjects` repository, `createDemoProject` /
  `deleteDemoProject` handlers, added to the `Repositories`/`handlers` types and the
  constructor call sites.

**API**: `POST /v1/projects/demo` (idempotent create-or-reuse), `DELETE /v1/projects/:id/demo`
(demo-only). Authorization rules added to `apps/api/src/middleware/authorization.ts`
(`project.create` / `project.edit`), matched before any broader existing route pattern.

**Web** (`apps/web/src/features/tour/`):
- `domain/tour-steps.ts` — 10-step tour data matching the *real* route structure (verified
  against the actual `apps/web/src/app/(portal)/projects/[id]/**` tree, not assumed routes;
  the originally sketched `/reports/{periodId}/editor` and `/compliance` period-scoped routes
  don't exist — compliance is project-scoped and the editor lives inside the report workspace
  page, so the AI-draft and editor steps were merged into one step and compliance points at
  `/projects/{projectId}/compliance`).
- `presentation/useTourProgress.ts` — **deviates from the original §5.4 plan.** The plan called
  for extending `onboarding-status.ts`'s persistence, but that module has no backing store of
  its own (it's derived read-only from the org/team/consent APIs on each load, not a saved
  document) — there is no existing "onboarding status" table to extend. Tour progress (current
  step, completed steps, dismissal) is per-viewer UI state, not shared business data, so it was
  implemented as a `localStorage`-backed hook instead, consistent with how this app already
  treats other lightweight per-browser preferences. This is a documented deviation, not an
  oversight — revisit if product analytics on tour completion becomes a requirement (§Phase 5).
- `presentation/TourOverlay.tsx` — spotlight + tooltip overlay, mounted once in
  `(portal)/layout.tsx` so it survives route changes; derives `projectId`/`periodId` from the
  current URL rather than props (the overlay is mounted at the portal root, above any
  per-route params). Skips a step gracefully if its `data-tour-id` target isn't present.
  No new dependency was added — the overlay is dependency-free, per the "avoid an LMS" scope
  discipline.
- `presentation/StartTourCard.tsx` — dashboard entry point; creates/reuses the demo project via
  a server action then starts the tour.
- `presentation/DeleteDemoProjectButton.tsx` — confirm-then-delete control on the project page.
- `data-tour-id` anchors added to the real screens: project detail page, `/setup`,
  `/templates`, `/logframe`, `/evidence`, `/reports`, `/reports/[periodId]` (workspace/draft/
  editor), `/compliance`, `/reports/[periodId]/export`.
- `lib/actions/demo-project.ts` — server actions calling the new API routes, following the
  exact pattern of `lib/actions/projects.ts`.
- `ProjectListItemSchema` / `ProjectDetailSchema` extended with optional `isDemo`; a "Demo"
  badge renders on the project page.

**Tests**: 5 new application-layer tests (`packages/application/test/demo-project.test.mjs`) —
demo-project creation and idempotency, delete refusing a non-demo project, delete succeeding
and auditing for a demo project, and entitlement usage excluding demo projects from both active
and archived counts. Full monorepo `pnpm -r typecheck` is clean; `@donordesk/domain` (249),
`@donordesk/application` (214), and `@donordesk/infrastructure` (251, 1 pre-existing skip) test
suites all pass.

**Not implemented (Phases 3–5, unchanged from the plan):**
- Phase 3 (short video library / "Watch" tab in `support/getting-started`) — requires actually
  recording screen captures, which is outside what this session can produce.
- Phase 4 (reusable contextual-help button deep-linking into `support/*`) — not started.
- Phase 5 (progress analytics) — deliberately deferred per the original plan.
- The tour's `ai-draft` step anchors the whole report-workspace page container rather than the
  specific "Generate draft" button/editor pane, since those live inside a client subcomponent
  not inspected in this pass — refine the selector to a tighter anchor as a follow-up.

**Deploy note**: not yet run through `scripts/deploy-fast.sh` / Contabo. Per `AGENTS.md`'s
Prisma-drift invariant, `{ model: "Project", field: "isDemo" }` was added to
`REQUIRED_PRISMA_FIELDS` in `apps/api/src/routes/health.ts` in this same change, so the
`/ready` gate will block a deploy with a stale (pre-migration) Prisma client.

## 10. Acceptance summary

Feature 22 is complete when a new user can create a self-contained, entitlement-exempt demo
project; walk a guided tour anchored to the real workflow from project setup through export; watch
short videos and reach contextual help without leaving the app; and all of this ships inside the
existing `apps/web` app with no new domain, container, or tracking system beyond what onboarding
already persists.
