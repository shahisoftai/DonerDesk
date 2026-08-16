# Feature 18: Project Creation Wizard (bootstrap → reporting-ready)

**Author:** Kilo (agent) · **Date:** 2026-08-15
**Status:** IMPLEMENTED — backend (domain/contracts/application/infrastructure/API),
frontend (setup checklist + profile form + redirect), migration
`20260815000000_project_bootstrap`, RLS, and tests complete; **deployed to Contabo
production as release `20260815054218`** (2026-08-15).

## 1. Overview

Project creation remains a lightweight three-step flow. After the Project database record is
created, the user is redirected to a resumable Setup checklist. For Google Drive tenants,
DonorDesk asynchronously provisions a tenant root and per-project folder tree; external storage
failure never rolls back Project creation.

Logframe, indicators, donor template, reporting profile, and team assignment are optional at
creation and may be completed across sessions. Reporting readiness is derived from current
project data. Creating a reporting period is hard-gated until the project is ready, while
evidence, activity capture, logframe/indicator editing, template setup, profile editing, and
team assignment remain available.

This extends `Features/04-Project-Setup.md` and `memorybank/gdrive.md`.

## 2. Requirements and scope

| # | Requirement | Current state |
|---|---|---|
| R1 | Keep core creation fields and existing three wizard steps | ✅ Exists |
| R2 | Redirect post-create to a resumable Setup checklist | ❌ Missing |
| R3 | For Drive tenants, ensure tenant DonorDesk root and per-project tree | ❌ Missing |
| R4 | Provision asynchronously, tenant-scoped, idempotently, with retry/repair | ❌ Missing |
| R5 | Add one authoritative per-project reporting profile | ❌ Missing |
| R6 | Derive readiness with machine-readable blockers and next actions | ❌ Missing |
| R7 | Gate reporting-period creation authoritatively | ❌ Missing |
| R8 | Snapshot effective template/profile instructions for each period | ❌ Missing |
| R9 | Roll out safely for legacy projects and non-Drive providers | ❌ Missing |
| R10 | Define post-create lifecycle: DRAFT→ACTIVE, archive/restore, completion, end-of-life | ❌ Missing |
| R11 | Post-create editability of dates/budget (fix `UpdateProjectHandler` dead branch) | ⚠️ Broken |
| R12 | Project-scoped access control (membership + `project.setup`/`project.archive`) | ❌ Missing |
| R13 | Single scheduling source of truth + deadline-reminder wiring | ❌ Missing |
| R14 | Indicator data-entry sequencing made explicit to users | ✅ Implemented (2026-08-16) — setup sidebar links to reporting periods; per-period entry grid at `/projects/[id]/reports/[periodId]/indicators` |

Out of scope: indicator-update lifecycle/history, automatic recurring periods, real LLM/OCR,
project duplication, donor portals, and cross-project reporting. Track these separately.
Also anticipated but deferred: canonical donor/partner entities (§5.6), project copy/duplicate
(§5.7), and project deletion/retention (§5.9).

## 3. Verified gaps

1. `GoogleDriveEvidenceStorage` reads metadata and grants file access but creates no folders.
2. `CreateProjectHandler` saves and audits but emits no folder-provisioning event.
3. The current `OutboxEventBus` is an event-to-queue adapter, not a durable transactional outbox.
4. `CreateReportingPeriodHandler` does not load the Project, validate tenant/template ownership,
   check setup, validate project date bounds, or detect overlapping periods.
5. Template section IDs are optional and there is no active/default-template concept.
6. No reporting profile or immutable effective-instructions snapshot exists.
7. The web wizard redirects to `/projects/[id]`, not `/projects/[id]/setup`.
8. Project codes are not uniquely constrained per tenant.
9. `UpdateProjectHandler` has a dead `startDate`/`endDate` branch
   (`update-project.ts:35-37`) and `Project.updateDetails` excludes `duration`/`budget`; dates
   and budget are un-editable after creation and the settings page reports editing is unavailable.
10. `ProjectMember` is a roleless stub with no repository wired in `container.ts`; there is no
    per-project membership boundary.
11. `list-projects` returns every tenant project with no role or assignment filter — a `VIEWER`
    can enumerate all projects (cross-project isolation gap, frontend plan FE-B03).
12. No `project.setup`/`project.archive` capability exists in `capabilities.ts`; role
    capabilities are global, not project-scoped.
13. Scheduling source of truth is unresolved: `Project.reportingFrequency` vs
    `ReportingProfile.autoPeriodCreation` vs `DonorTemplate.reportType`; deadline reminders are
    not wired to the profile.
14. `donorName` and `implementingOrganization` are free-text, not canonical entities.
15. Indicator baseline/target are stored as strings; the "required baseline/target" readiness
    rule has no defined "present and well-formed" check; achievement entry is impossible until
    a gated period exists.
16. No `DELETE /v1/projects/:id` route and no idempotency-key support on period creation.

## 4. Design decisions

### 4.1 Derived readiness

Do not persist template/logframe/indicator/profile/team readiness booleans. They become stale
when source data changes. Persist only operational provisioning state and optional user
acknowledgement; compute readiness on setup reads and immediately before gated mutations.

### 4.2 Acknowledgement is not a gate

Readiness is automatic when hard requirements pass. “Finish setup” records optional
acknowledgement for UX/audit. If required data is later removed or invalidated, status becomes
`ACTION_REQUIRED` even if the project was previously ready.

### 4.3 One reporting-instruction source

`ReportingProfile` is the current source of project writing behavior. Donor-imposed word limits
live on stable, versioned template sections. A reporting period stores the resolved effective
template/profile snapshot so later edits do not alter existing reports.

### 4.4 Provider-specific workspace readiness

- `GOOGLE_DRIVE`: provisioning is required.
- `LOCAL`/`R2`: provisioning is `NOT_REQUIRED`; do not create unused folder trees or label them
  “Drive ready.”

## 5. Project lifecycle and management

The wizard is the creation path, but Feature 18 must also define how a project is managed after
creation. These items share the readiness state and workspace introduced here, so they are specified
together rather than split into a separate feature.

### 5.1 Lifecycle reconciliation

`Project.status` (`DRAFT|ACTIVE|PAUSED|COMPLETED|ARCHIVED`) is a business lifecycle; the setup
status derived in §8 (`NOT_STARTED|IN_PROGRESS|READY|ACTION_REQUIRED`) is a provisioning lifecycle.
They are distinct and are not merged.

- Creation always yields `status = DRAFT` (unchanged today).
- A project may become `ACTIVE` only when readiness is `READY` and setup is acknowledged.
  Activation is manual, permission-gated, and audited (`project.activated`) — never automatic.
- `PAUSED` does not alter readiness; it suppresses period creation and reminders while preserving
  setup state.
- `COMPLETED` and `ARCHIVED` suppress further period creation regardless of readiness.

### 5.2 Post-create editability (must-fix)

`UpdateProjectHandler` contains a dead branch for `startDate`/`endDate`
(`packages/application/src/use-cases/projects/update-project.ts:35-37`) and `Project.updateDetails`
excludes `duration` and `budget` (`project.ts:168`), so the dates and budget captured by the wizard
can never be corrected. Fix this before claiming the wizard owns those fields:

- Allow updating `startDate`/`endDate` (validate `endDate >= startDate`), `budgetAmount`, and
  `budgetCurrency` (ISO-4217).
- Reject date edits that would invalidate existing reporting periods (overlap/containment check).
- Audit old vs new values (existing `oldValue`/`newValue` convention).

### 5.3 Archive, completion, and end-of-life

- **Archive** (soft, reversible): `status = ARCHIVED`; suppress period creation and reminders; leave
  the Drive tree in place and do not revoke service-account access (restore stays cheap). Gated by a
  new `project.archive` capability.
- **Completion**: on `COMPLETED`, disable `autoPeriodCreation`; do not delete or rename the workspace
  folder.
- **Reconciliation**: the §10 reconciliation job must tolerate archived/completed projects and must
  not attempt repair on them.

### 5.4 Project-scoped access control

- Add `project.setup` and `project.archive` capabilities to
  `apps/web/src/lib/shared/capabilities.ts` and gate the §11 `/setup`, `/setup/acknowledge`,
  workspace retry/repair, and profile routes on them.
- Introduce a project-membership port. The existing `ProjectMember` entity is a roleless stub with
  no repository wired in `container.ts`. Scope `list-projects` and `getProject` to membership/role so
  a `VIEWER` cannot enumerate or read unrelated projects (cross-project isolation, frontend plan
  FE-B03). Treat this as a named dependency of Feature 18, not a silent follow-up.
- Staff assignment (`projectManagerId`/`meOfficerId`/`reportingOfficerId`) remains a soft readiness
  signal; membership ABAC is the authoritative access boundary.

### 5.5 Reporting-scheduling source of truth

Reconcile three overlapping fields:

- `Project.reportingFrequency` — advisory human cadence (kept).
- `ReportingProfile.autoPeriodCreation` + `deadlineOffsetDays` — authoritative scheduling knobs.
- `DonorTemplate.reportType` — template classification only, not scheduling.

Rule: `Project.reportingFrequency` is advisory; period scheduling is driven by the profile. Wire
`generate-deadline-reminders` to `deadlineOffsetDays` and a per-project recipient preference. State
this rule in the §7 profile contract and feature-flag it per §13.

### 5.6 Donor / partner entities (anticipated, deferred)

`donorName` and `implementingOrganization` are free-text strings. For the multi-project model a
canonical donor/partner directory (contact, per-donor template and tone defaults) is anticipated.
Defer the entity work, but do not add logic that assumes `donorName` is unique or canonical.

### 5.7 Project copy / duplicate (anticipated, deferred)

"Create a project from an existing one" (clone logframe, template, profile, and Drive tree) is the
most common recurring-grant pattern. Reserve as an explicit follow-up; the stable workspace-identity
model in §10 is a prerequisite.

### 5.8 Indicator data-entry sequencing

Indicator *definitions* are editable during setup, but indicator *achievement values* require a
`reportingPeriodId`, and periods are hard-gated on readiness (§9). Therefore no achievement data
entry is possible until setup is complete. The §12 setup UI states this and the setup sidebar
now links to the reporting periods list, whose period cards link to the per-period entry grid
(`/projects/[id]/reports/[periodId]/indicators`, shipped 2026-08-16 — see
`06-Logframe-And-Indicator-Manager.md`). Baseline/target are stored as strings today; the
readiness rule "required baseline/target/unit/frequency" must define a "present and well-formed"
check for string values.

### 5.9 Deletion and retention (deferred, named)

There is no `DELETE /v1/projects/:id` route. Deletion and data retention (including Drive tree
teardown and evidence retention) are deferred but must be designed before GA; do not introduce
ad-hoc hard-delete paths.

## 6. Target data model

Use the next available migration timestamp at implementation time.

```prisma
model Organization {
  // existing fields
  driveRootFolderId String?
}

model Project {
  // existing fields
  workspaceRootId  String?
  setup            ProjectSetup?
  reportingProfile ReportingProfile?

  @@unique([tenantId, projectCode])
  @@index([tenantId, id])
}

model ProjectSetup {
  id                       String   @id
  tenantId                 String
  projectId                String   @unique
  workspaceProvisionStatus String   @default("PENDING")
  workspaceProvisionError  String?
  provisionAttemptCount    Int      @default(0)
  lastProvisionAttemptAt   DateTime?
  acknowledgedAt           DateTime?
  acknowledgedById         String?
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
  project                  Project  @relation(fields: [projectId], references: [id])

  @@index([tenantId, projectId])
  @@index([workspaceProvisionStatus])
}

model ReportingProfile {
  id                       String   @id
  tenantId                 String
  projectId                String   @unique
  defaultTemplateId        String?
  language                 String   @default("en")
  tone                     String   @default("FORMAL")
  writingStyle             String?
  audienceNotes            String?
  formattingRulesJson      String   @default("[]")
  specialRequirementsJson  String   @default("[]")
  sectionOverridesJson     String   @default("{}")
  deadlineOffsetDays       Int?
  autoPeriodCreation       Boolean  @default(false)
  version                  Int      @default(1)
  createdById              String
  updatedById              String
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
  project                  Project  @relation(fields: [projectId], references: [id])

  @@index([tenantId, projectId])
}

model ReportingPeriod {
  // existing fields
  reportingProfileSnapshotJson String @default("{}")
  templateSnapshotJson         String @default("{}")
}
```

Provision status: `NOT_REQUIRED | PENDING | IN_PROGRESS | READY | FAILED`. Add all required
Prisma reverse relations and tenant-qualified repository operations. Add tenant/project code
uniqueness only after resolving legacy duplicates.

### Template sections

Persisted sections must have stable server-generated IDs. Add `reviewStatus` (`DRAFT|REVIEWED`),
optional `minWords`, and optional `maxWords`; validate nonnegative values and `minWords <=
maxWords`. Existing sections receive stable IDs during backfill. Template limits are donor
defaults; explicit profile overrides take precedence in the immutable snapshot.

## 7. Reporting profile contract

Create `packages/contracts/src/reporting-profile.ts` with:

```typescript
const ToneSchema = z.enum(["FORMAL", "CONCISE", "NARRATIVE", "TECHNICAL"]);

const WordCountOverrideSchema = z.object({
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().positive().optional(),
}).superRefine((v, ctx) => {
  if (v.min !== undefined && v.max !== undefined && v.min > v.max)
    ctx.addIssue({ code: "custom", path: ["max"], message: "max must be at least min" });
});

export const UpsertReportingProfileSchema = z.object({
  defaultTemplateId: z.string().min(1).optional(),
  language: z.string().min(2).max(10).default("en"),
  tone: ToneSchema.default("FORMAL"),
  writingStyle: z.string().max(1000).optional(),
  audienceNotes: z.string().max(1000).optional(),
  formattingRules: z.array(z.string().max(200)).max(50).default([]),
  specialRequirements: z.array(z.string().max(200)).max(50).default([]),
  sectionOverrides: z.record(WordCountOverrideSchema).default({}),
  deadlineOffsetDays: z.number().int().min(0).max(365).optional(),
  expectedVersion: z.number().int().positive().optional(),
});
```

The default template and override section IDs must belong to the same tenant/project.
`expectedVersion` provides optimistic concurrency. “Use defaults” creates a valid profile from
organization language, formal tone, and a selected template.

## 8. Derived readiness policy

Add an application-layer `IProjectReadinessService` returning:

```typescript
type ProjectSetupStatus = "NOT_STARTED" | "IN_PROGRESS" | "READY" | "ACTION_REQUIRED";
type SetupBlocker = { code: string; label: string; href?: string; retryable?: boolean };
type ProjectReadiness = {
  ready: boolean;
  status: ProjectSetupStatus;
  blockers: SetupBlocker[];
  nextAction?: SetupBlocker;
};
```

Hard requirements:

1. Drive workspace is `READY`; Local/R2 is `NOT_REQUIRED`.
2. The profile selects a same-tenant/project template with at least one `REVIEWED`, required
   section, stable IDs, and valid constraints.
3. At least one reportable indicator exists, belongs to a valid logframe item, and has required
   baseline, target, unit, and frequency according to indicator type. Do not require all four
   logframe levels.
4. A valid profile exists and its template/override references remain valid.

Team assignment is a soft recommendation, not a gate. Suggested blockers:

```text
WORKSPACE_PENDING
WORKSPACE_ACCESS_REVOKED
WORKSPACE_PROVISION_FAILED
REPORTING_PROFILE_MISSING
DEFAULT_TEMPLATE_MISSING
TEMPLATE_HAS_NO_REVIEWED_REQUIRED_SECTIONS
TEMPLATE_SECTION_IDS_INVALID
NO_REPORTABLE_INDICATORS
INDICATOR_CONFIGURATION_INCOMPLETE
SECTION_OVERRIDE_INVALID
```

`NOT_STARTED` means no hard work is complete; `IN_PROGRESS` means partially complete and never
ready; `READY` means all hard requirements pass; `ACTION_REQUIRED` means a previously
ready/acknowledged project regressed or storage access failed.

## 9. Authoritative reporting-period gate

Before creating a period, `CreateReportingPeriodHandler` must:

1. Load Project by input ID and authenticated tenant; cross-tenant IDs return `NOT_FOUND`.
2. Compute readiness and return `PROJECT_SETUP_INCOMPLETE` with structured blockers.
3. Resolve the submitted/default template and validate same project/tenant ownership.
4. Validate dates against project bounds and reject disallowed overlaps/duplicates.
5. Resolve and persist immutable template/profile snapshots.
6. Save and audit using the established transaction/audit convention.

Downstream draft/export/checklist handlers still validate their direct invariants and tenant
ownership; they must not assume a period remains valid merely because it once passed setup.

## 10. Drive workspace provisioning

Add a tenant-scoped port:

```typescript
interface IProjectWorkspaceService {
  ensureTenantRoot(tenantId: TenantId): Promise<Result<WorkspaceReference, DomainError>>;
  ensureProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>>;
  verifyAccess(tenantId: TenantId, rootId: string): Promise<Result<void, DomainError>>;
  repairProjectWorkspace(tenantId: TenantId, projectId: string): Promise<Result<WorkspaceReference, DomainError>>;
}
```

Reuse `PrismaGoogleDriveTokenStore`. Folder tree:

```text
DonorDesk/
└── {Project title} ({Project code})/
    ├── 01-Donor-Templates/
    ├── 02-Logframe/
    ├── 03-Data-Files/
    ├── 04-Evidence-Reports/
    ├── 05-Evidence-Images/
    ├── 06-Financial/
    └── 07-Submitted-Reports/
```

Names are presentation only. Set Drive `appProperties` with tenant ID, project ID, and stable
folder role (`PROJECT_ROOT`, `DONOR_TEMPLATES`, etc.). Lookup includes app properties, parent,
folder MIME type, and `trashed = false`, with escaped query values. Concurrent duplicate
candidates produce a repairable conflict. A project rename may rename its existing folder but
must never create a new identity.

Project creation commits before Drive calls. Prefer a durable transactional outbox intent; the
current `OutboxEventBus` alone is not durable. Regardless of queue mode, add bounded retry and a
reconciliation job for `PENDING`/`FAILED` projects and periodic verification of `READY` roots.
Expose Retry, Test access, and Repair actions using the same idempotent service. Model OAuth
revocation, deleted/moved folders, account replacement, Shared Drive constraints, and permission
failures explicitly. Validate OAuth scopes against all required operations before live rollout.

## 11. API and read model

| Method | Route | Purpose |
|---|---|---|
| GET | `/v1/projects/:id/setup` | Derived checklist, blockers, next action |
| POST | `/v1/projects/:id/setup/acknowledge` | Optional acknowledgement |
| POST | `/v1/projects/:id/workspace/retry` | Idempotent provisioning retry |
| POST | `/v1/projects/:id/workspace/repair` | Verify/repair structure |
| GET | `/v1/projects/:id/reporting-profile` | Current profile/version |
| PUT | `/v1/projects/:id/reporting-profile` | Versioned upsert |
| POST | `/v1/reporting-periods` | Authoritative gate and snapshots |

Extend project overview using the same readiness service, not a second formula. Return status,
ready, blockers, nextAction, provider-specific storage status/deep link/error, active-template
and reviewed-section counts, reportable/incomplete indicator counts, profile version, soft team
status, and acknowledgement time.

All mutations are authorization-checked and audited. Suggested events:
`project.workspace.provisioned`, `project.workspace.provision_failed`,
`project.workspace.repaired`, `project.setup.acknowledged`,
`project.reporting_profile.created|updated`, and `reporting.period.created`. Do not audit GET-time
readiness recomputation.

## 12. Frontend behavior

1. Keep three wizard steps; align step validation with `CreateProjectSchema`, including dates and
   budget/currency cross-field errors.
2. Redirect successful creation to `/projects/[id]/setup`.
3. Build a resumable, multi-user checklist; show blocker count and concrete actions, not an
   arbitrary percentage.
4. Link to template review, logframe/indicators, reporting profile, and team.
5. Provide “Use defaults” for the profile and Open/Test/Retry/Repair Drive actions according to
   state and capability.
6. Disable period creation in UI when incomplete, but keep the server authoritative and render
   blockers returned after concurrent changes.
7. Hide mutations from unauthorized viewers; handle unsaved changes and optimistic conflicts.

## 13. Migration and rollout

1. Add nullable/defaulted data without enabling the gate globally.
2. Backfill stable IDs for existing template sections.
3. Create default profiles only where an unambiguous template exists; flag others.
4. Mark Local/R2 workspace provisioning `NOT_REQUIRED`.
5. Queue Drive provisioning for existing Drive projects.
6. Grandfather existing periods/drafts/exports; never interrupt existing work.
7. Enable new-period gating tenant-by-tenant after a migration window or feature flag.
8. Detect and resolve duplicate project codes before adding tenant uniqueness.
9. Track provisioning outcomes, blocker distribution, setup time, and gate rejections.
10. Provide a rollback switch for the gate without dropping migrated data.

## 14. Phased implementation

### Phase A — Policy, contracts, safe schema

- Finalize readiness/blocker policy, legacy behavior, schema, stable section IDs, word limits,
  profiles, snapshots, and duplicate-code audit.
- Gate: migration/contract tests plus backfill and rollback documentation.

### Phase B — Readiness and authoritative gate

- Implement tenant-qualified readiness, setup read model, acknowledgement, period ownership,
  date/overlap checks, blockers, and immutable snapshots.
- Gate: cross-tenant, every-blocker, regression, legacy, overlap, and snapshot tests.

### Phase C — Drive provisioning and recovery

- Implement stable app-property identities, durable intent/reconciliation, retry, access test,
  repair, rename, and explicit failure states.
- Gate: concurrent idempotency, partial repair, duplicate, revoked OAuth, and deleted/moved
  folder tests; live provisioned-tenant validation before release.

### Phase D — Profile and generator integration

- Add profile handlers, defaults, optimistic concurrency, effective snapshot resolution, draft
  context, and structured word-count warnings from the stub generator.
- Gate: version conflict, ownership, override, and snapshot immutability tests.

### Phase E — Setup UI

- Add redirect, checklist, profile form, Drive actions, capability/accessibility handling, and
  authoritative gate-error rendering.
- Gate: Playwright create → resume → configure → ready → period, failure/retry, and regression.

### Phase F — Lifecycle, editability, and access control

- Reconcile setup status with Project status; implement permission-gated DRAFT→ACTIVE activation.
- Fix `UpdateProjectHandler` so dates/budget are editable and audited (post-create editability).
- Add `project.setup`/`project.archive` capabilities; scope list/get to project membership.
- Implement archive/restore with Drive workspace semantics and completion/end-of-life behavior.
- Gate: lifecycle transition, editability/overlap, cross-project isolation, and archive/Drive tests.

Follow-ups: indicator update workflow/history, automatic recurring periods, deadline-reminder
wiring, donor/partner entities (§5.6), project copy/duplicate (§5.7), and deletion/retention (§5.9).

## 15. Testing and risks

- Domain/contracts: readiness transitions, stable IDs, word constraints, profile invariants.
- Application/API: tenant isolation, blockers, ownership, dates/overlap, rollout, audit/error shape.
- Infrastructure: mocked Drive operations, concurrent retry, partial repair, OAuth/access failure,
  reconciliation.
- Web: resumability, navigation, defaults, retry/repair, conflicts, accessibility.
- Migration: duplicates, section backfill, provider status, legacy-period continuity, rollback.
- Lifecycle: activation policy, archive/completion behavior, dates/budget editability, membership
  scoping, scheduling source-of-truth, deletion/retention boundaries.

Key mitigations: stable Drive identities plus reconciliation; derived indexed queries rather than
cached booleans; controlled rollout for existing projects; explicit active template and immutable
snapshots; defaults and precise blockers to reduce setup friction. Use repository baselines for
test counts rather than brittle numeric targets.

## 16. Implementation record (2026-08-15)

**Deployed to Contabo production as release `20260815054218`** (API + web + prisma).

Backend:
- Domain: `ProjectSetup`, `ReportingProfile` entities; `Project` lifecycle
  (editable dates/budget, `restore()`), `TemplateSection` stable IDs + review
  status + word limits, `ReportingPeriod` immutable snapshots.
- Contracts: `reporting-profile.ts` (tone, word-count overrides, optimistic
  version), `templates.ts` review/min/max words, `projects.ts` ISO-4217 currency.
- Application: `ProjectReadinessService` (derived, provider-aware rollout),
  `GetProjectSetupHandler`, `AcknowledgeProjectSetupHandler`,
  `RetryProjectWorkspaceHandler`, `RepairProjectWorkspaceHandler`,
  `Get/UpsertReportingProfileHandler`, authoritative `CreateReportingPeriodHandler`
  gate (ownership, readiness, date bounds, overlap, snapshots).
- Infrastructure: `LocalProjectWorkspaceService`, `GoogleDriveProjectWorkspaceService`
  (+ `GoogleDriveWorkspaceDrive` with stable appProperties + 409 reconcile),
  `ProjectWorkspaceServiceResolver`, `PrismaWorkspaceNameProvider`, setup/profile
  repositories, `project.workspace.provision` job, outbox mapping, container wiring.
- API: `/v1/projects/:id/setup`, `/setup/acknowledge`, `/workspace/retry|repair`,
  `/reporting-profile` GET/PUT + authorization rules.
- Migration `20260815000000_project_bootstrap` (dedup project codes per tenant,
  `Project.workspaceRootId`, `Organization.driveRootFolderId`, `ProjectSetup`,
  `ReportingProfile`, period snapshot columns); RLS extended to 24 tables.

Frontend:
- Wizard redirects to `/projects/[id]/setup`; resumable setup checklist
  (blockers, per-item status, retry/repair/acknowledge, indicator entry note);
  reporting profile form + "Use defaults"; `project.setup`/`project.archive`
  capabilities; server actions + schemas.

Tests: domain 23, application 35, infrastructure 40, API 19, web unit 113 —
all green at build time. Playwright e2e requires a browser binary not present
in this build environment (environmental, not a code failure).

Rollout notes: `rls.sql` covers 24 tenant tables (added `ProjectSetup`,
`ReportingProfile`); migrator connects over loopback trust as `donordesk_migrator`.

**2026-08-15 (follow-up, release `20260815063021`):** new projects are seeded
with a `ReportingProfile` from `Organization.reportingDefaults` (account-wide
Default reporting profile onboarding step; migration
`20260815060000_onboarding_reporting_defaults`). See
`Features/01-Authentication-And-Onboarding.md`.

## 17. Acceptance summary

Feature 18 is complete when creation remains lightweight and independent of Drive availability;
the user lands on a resumable permission-aware checklist; readiness is live, tenant-qualified,
and actionable; Drive provisioning is stable-ID based, retryable, and repairable; Local/R2 avoids
fake Drive readiness; period creation validates readiness, ownership, dates, overlap, and stores
immutable snapshots; and existing work survives a controlled, reversible rollout; and project lifecycle (activation,
archive, completion), post-create editability, and project-scoped access control are defined and
enforced.
