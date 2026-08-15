# Feature 18: Project Creation Wizard (bootstrap → reporting-ready)

**Author:** Kilo (agent) · **Date:** 2026-08-15
**Status:** PLANNED — approved for implementation; Phase A (Drive folder scaffolding) is the first build block.

---

## 1. Overview

Turn project creation into a **guided bootstrap**: the user fills the required fields
to create a Project, DonorDesk **auto-provisions a per-project Google Drive folder tree**
inside a tenant-level "DonorDesk" parent folder (in the tenant's own Drive), and the
Project then moves through a **Setup phase**. Logframe, indicators, donor template, and
donor-report special instructions are **optional at creation time** and completed at the
user's discretion — but the **reporting engine (reporting periods, indicator updates
against a period, drafts, exports) is hard-gated until Setup is complete**.

Every Project runs on its own settings: Google Drive folder, donor template, logframe,
indicator set, indicator entry, deadlines, reporting frequency, language, and writing
instructions. Projects report based on their own profile.

This feature extends `Features/04-Project-Setup.md` and builds directly on the Drive
link-first architecture in `memorybank/gdrive.md`.

---

## 2. Product requirements

| # | Requirement | Status today (2026-08-15) |
|---|---|---|
| R1 | Required fields to create a Project (title, code, donor, implementer, country, sector, dates, frequency) | ✅ Exists (`CreateProjectSchema` + `Project.validate()`) |
| R2 | Auto-create a **DonorDesk parent folder** in the tenant's Drive at onboarding | ❌ Missing |
| R3 | Auto-create a **per-project folder + subfolders** (Templates, Logframe, Data, Evidence-Reports, Evidence-Images, Financial, Submitted-Reports) | ❌ Missing |
| R4 | Logframe optional at creation | ✅ Already optional |
| R5 | Donor template optional at creation | ✅ Already optional |
| R6 | **Donor-report special instructions** (structure, word count, language, tone) optional at creation | ❌ Missing (new contract) |
| R7 | **Hard gate:** system must not start (no reporting period) until Drive folder + logframe + template + instructions are complete | ❌ Missing |
| R8 | Many projects, each with own settings, reported per its own profile | ⚠️ Partial (per-project FK chain exists; per-project setup profile does not) |
| R9 | Indicator data-entry system tied to reporting periods | ⚠️ Partial (create + verify routes only; no submit/reject/history read model) |

---

## 3. Current-state gaps (verified in code, 2026-08-15)

1. **No Drive folder creation anywhere.** `GoogleDriveEvidenceStorage`
   (`packages/infrastructure/src/storage/google-drive.ts`) only does `getFile()` +
   `grantReadAccess()` (file-level, reader role). No `files.create` for folders, no
   `driveFolderId` on `Project`, no `driveRootFolderId` on `Organization`.
2. **Per-tenant token wiring is present but untested with real tenants.**
   `PrismaGoogleDriveTokenStore` (`storage/prisma-google-drive-token-store.ts`) reads the
   encrypted `PrismaGoogleDriveCredentialStore` and is already wired into
   `EvidenceStorageResolver` (`container.ts:240-252`). `EnvGoogleDriveTokenStore` fallback
   and R2 config remain env-gated. Folder creation depends on this working for real
   tenants — which needs a Google Cloud project + service account (see §12).
3. **No project setup state machine.** `Project.status` is a static enum
   (`DRAFT|ACTIVE|PAUSED|COMPLETED|ARCHIVED`); `CreateReportingPeriodHandler`
   (`packages/application/src/use-cases/reporting/create-reporting-period.ts`) performs
   **no setup check**.
4. **No reporting-instructions contract.** `CreateDonorTemplateSchema` has `notes` +
   `TemplateSection.description` only — no per-section word counts, no tone/language/voice.
5. **Indicator update lifecycle is incomplete at the API.** Domain supports
   `submit/verify/requestCorrection/reject` (`packages/domain/src/contexts/logframe/indicator-update.ts`)
   but only `create` + `verify` routes exist (`apps/api/src/routes/logframe.ts:53-67`).
6. **No indicator-update history read model.** Indicator detail page
   (`apps/web/src/app/(portal)/projects/[id]/indicators/[indicatorId]/page.tsx`) explicitly
   states the API does not expose it.

---

## 4. Target data model

**Migration:** `20260815000000_project_bootstrap` (naming follows the existing
`YYYYMMDDHHMMSS_name` convention in `packages/infrastructure/prisma/migrations/`).

```prisma
// ---- schema.prisma additions ----

model Project {
  // ...existing fields...
  driveFolderId             String?   // root of THIS project's Drive tree
  reportingLanguage         String    @default("en")
  reportingInstructionsJson String    @default("{}")   // runtime snapshot of instructions

  setup         ProjectSetup?
  instructions  ReportingInstruction?
}

model ProjectSetup {
  id                 String   @id
  tenantId           String
  projectId          String   @unique
  driveFolderReady   Boolean  @default(false)
  donorTemplateReady Boolean  @default(false)
  logframeReady      Boolean  @default(false)
  instructionsReady  Boolean  @default(false)
  teamReady          Boolean  @default(false)
  markedComplete     Boolean  @default(false)   // user-confirmed "setup done"
  completedAt        DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([tenantId])
}

model ReportingInstruction {
  id                        String   @id
  tenantId                  String
  projectId                 String   @unique
  language                  String
  tone                      String   // "FORMAL" | "CONCISE" | "NARRATIVE" | "TECHNICAL"
  writingStyle              String?
  audienceNotes             String?
  formattingRulesJson       String   @default("[]")
  specialRequirementsJson   String   @default("[]")
  wordCountsJson            String   @default("{}")   // { "sectionId": { "min": 200, "max": 400 } }
  createdById               String
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  @@index([tenantId])
}

model Organization {
  // ...existing fields...
  driveRootFolderId String?   // the tenant's "DonorDesk" root folder in Drive
}
```

> **Design note:** `ReportingInstruction` is intentionally a **separate entity from
> DonorTemplate**. A template defines *what* to report; instructions define *how* to write
> it. `wordCountsJson` keys reference `TemplateSection.id`s, so per-section word limits
> live in one place without changing `TemplateSectionSchema`.

---

## 5. New subsystem: `ProjectDriveFolderService` (infrastructure)

**File:** `packages/infrastructure/src/storage/project-drive-folders.ts`
**Port:** `packages/application/src/ports/infrastructure.ts` — `IProjectDriveFolderService`

```typescript
export interface IProjectDriveFolderService {
  /** Ensure the tenant "DonorDesk" root folder exists; returns its Drive id. */
  ensureRootFolder(tenantId: string): Promise<Result<string, DomainError>>;
  /** Ensure THIS project's tree exists; returns the project root folder id. */
  ensureProjectFolder(projectId: string): Promise<Result<string, DomainError>>;
  /** Grant the DonorDesk service account reader access to a folder tree. */
  grantTreeReadAccess(folderId: string): Promise<Result<void, DomainError>>;
}
```

**Behavior:**
- **Lazy + idempotent, never eager.** No Drive call inside the create-project DB
  transaction. Folder setup is scheduled via `OutboxEventBus` (job `project.drive.setup`)
  and additionally ensured on-demand from the evidence upload/link handlers and a manual
  "Create folder now" button.
- **Idempotency by lookup:** `files.list` with
  `q = name='X' and '<parentId>' in parents and mimeType='application/vnd.google-apps.folder'`
  → reuse existing; else `files.create`. Same `409`-tolerant pattern as the existing
  `grantReadAccess` (`google-drive.ts:105-120`).
- **Folder tree** (project root named `{Project title} ({Project code})`):

```
DonorDesk/                                ← tenant root (Organization.driveRootFolderId)
└── {Title} ({Code})/                     ← Project.driveFolderId
    ├── 01-Donor-Templates/
    ├── 02-Logframe/
    ├── 03-Data-Files/
    ├── 04-Evidence-Reports/
    ├── 05-Evidence-Images/
    ├── 06-Financial/
    └── 07-Submitted-Reports/
```

- **StorageProvider matrix:** `GOOGLE_DRIVE` → real Drive scaffold; `LOCAL`/`R2` → no-op
  (a local scaffold at `STORAGE_ROOT/projects/{id}/...`; `driveFolderReady` set true).
- **Reuse `PrismaGoogleDriveTokenStore`** (already wired in `container.ts:240`) — do **not**
  add another token path. Leave `GoogleDriveEvidenceStorage` untouched.
- **Read-time resolution:** `GET /v1/projects/:id` returns `driveFolderId` so the UI can
  deep-link to the project's Drive folder.

---

## 6. Project setup state machine (application layer)

**New domain entity:** `packages/domain/src/contexts/projects/project-setup.ts`

```
ProjectSetupStatus = "NOT_STARTED" | "SETUP_IN_PROGRESS" | "READY"
```

Derived (never stored directly; `ProjectSetup` booleans are the source of truth):
- `driveFolderReady` ← folder service ok (or LOCAL scaffold ok)
- `donorTemplateReady` ← `DonorTemplate.count(projectId) > 0`
- `logframeReady` ← `LogframeItem.count(projectId) >= 4` (one per level:
  Goal/Outcome/Output/Activity) **and** `Indicator.count(projectId) > 0`
- `instructionsReady` ← `ReportingInstruction` exists (or defaults generated at template
  upload)
- `teamReady` ← assigned staff (`projectManagerId`/`meOfficerId`/`reportingOfficerId` or
  `ProjectMember`) ≥ 1 — soft
- `markedComplete` ← user explicitly checks "Setup complete"

**Hard gate (the "system will not start" rule) — one change in one handler:**

```typescript
// CreateReportingPeriodHandler.handle()
const setup = await this.setup.getForProject(input.projectId);
if (!setup?.isReportingReady()) {
  return {
    ok: false,
    error: new DomainError(
      "PROJECT_SETUP_INCOMPLETE",
      "Project setup incomplete: donor template, logframe, and reporting instructions " +
      "are required before creating a reporting period.",
    ),
  };
}
```

`isReportingReady()` = `driveFolderReady && donorTemplateReady && logframeReady && instructionsReady`.

**Soft gates (explicitly allowed during Setup):** evidence upload/link, activity capture,
logframe/indicator CRUD, template upload, team invite.
**Blocks:** `POST /v1/reporting-periods`, `POST /v1/indicator-updates` (requires a period),
draft generation, exports, checklist generation, deadline reminders.

**New read model — extend `GET /v1/projects/:id/overview`:**

```typescript
setup: {
  status: "NOT_STARTED" | "SETUP_IN_PROGRESS" | "READY";
  driveFolder: { ready: boolean; folderId: string | null; deepLink?: string };
  donorTemplate: { ready: boolean };
  logframe: { ready: boolean; itemCount: number; indicatorCount: number };
  instructions: { ready: boolean };
  team: { ready: boolean; memberCount: number };
  markedComplete: boolean;
}
```

**Audit events:** `project.setup.updated`, `project.setup.marked_complete`, `project.folder.created`.

---

## 7. Reporting instructions contract

**File:** `packages/contracts/src/reporting-instructions.ts`

```typescript
import { z } from "zod";

export const ToneSchema = z.enum(["FORMAL", "CONCISE", "NARRATIVE", "TECHNICAL"]);

export const ReportingInstructionsSchema = z.object({
  projectId: z.string().min(1),
  language: z.string().min(2).max(10).default("en"),
  tone: ToneSchema.default("FORMAL"),
  writingStyle: z.string().max(1000).optional(),
  audienceNotes: z.string().max(1000).optional(),
  formattingRules: z.array(z.string().max(200)).default([]),
  specialRequirements: z.array(z.string().max(200)).default([]),
  wordCounts: z
    .record(z.object({ min: z.number().int().min(0), max: z.number().int().positive() }))
    .default({}),
});
export type ReportingInstructionsInput = z.infer<typeof ReportingInstructionsSchema>;
```

**Extension to templates** (`packages/contracts/src/templates.ts`): add `minWords` /
`maxWords` (optional nonnegative ints) to `TemplateSectionSchema` so per-section limits can
be authored at template setup; `ReportingInstruction.wordCountsJson` is the runtime source.

**Draft generator wiring** (`packages/infrastructure/src/llm/report-draft-generator.ts` and
`GenerateReportDraftHandler` at `container.ts:335`): pass instructions as prompt context.
`StubReportDraftGenerator` should **validate word counts** and emit warning metadata when a
section is out of range, so behavior is testable without a real LLM.

---

## 8. API surface changes

| Method | Route | Handler | Notes |
|---|---|---|---|
| GET | `/v1/projects/:id/setup` | `GetProjectSetupHandler` | new |
| PATCH | `/v1/projects/:id/setup` | `UpdateProjectSetupHandler` | set `markedComplete`, re-derive status |
| POST | `/v1/projects/:id/drive-folder` | `EnsureProjectFolderHandler` | manual "create folder now" (idempotent) |
| PUT | `/v1/projects/:id/instructions` | `UpsertReportingInstructionsHandler` | new |
| GET | `/v1/projects/:id/instructions` | `GetReportingInstructionsHandler` | new |
| POST | `/v1/reporting-periods` | `CreateReportingPeriodHandler` | **+ setup gate** |
| POST | `/v1/indicator-updates` | `CreateIndicatorUpdateHandler` | unchanged (period FK already required) |
| POST | `/v1/indicator-updates/:id/submit` | `SubmitIndicatorUpdateHandler` | new (domain `submit()` exists) |
| POST | `/v1/indicator-updates/:id/request-correction` | `RequestIndicatorCorrectionHandler` | new (domain `requestCorrection()` exists) |
| GET | `/v1/indicators/:id/updates` | `ListIndicatorUpdatesHandler` | new history read model |

All mutations write `audit_events` per existing convention.

---

## 9. Frontend changes (`apps/web`)

1. **Wizard stays 3 steps** (`apps/web/src/features/projects/validation/project-wizard.ts`
   unchanged) — required fields only. No scope creep on the wizard itself.
2. **Post-create transition:** after `createProjectAction`, redirect to
   `/projects/[id]/setup` (new route) — a **checklist, not a wizard** (logframe/template
   work is multi-session and iterative).
3. **`/projects/[id]/setup` page:** mirrors the `onboarding-steps.ts` pattern — per-item
   status chips (Drive folder, template, logframe+indicators, instructions, team),
   deep-links to existing `/logframe`, `/templates/new`, `/team`, and a new `/instructions`
   form; "Mark setup complete" disabled until hard-gate items are green.
4. **Instructions form** (`/projects/[id]/instructions`): structured fields (language,
   tone select, style/audience text, formatting rules list, per-section word counts driven
   by template sections when present).
5. **Project overview** (`app/(portal)/projects/[id]/page.tsx` +
   `features/projects/application/project-overview-read-model.ts`): render the `setup`
   block; replace the static "setup checklist if no period exists" hint with live status.
6. **Drive deep-link:** "Open in Drive" from project header when `driveFolderId` present.
7. **Indicator history:** new panel on
   `app/(portal)/projects/[id]/indicators/[indicatorId]/page.tsx` consuming
   `GET /v1/indicators/:id/updates` (replaces the "not exposed" message at line 21).

---

## 10. Phased build order with gates

### Phase A — Drive folder scaffolding (foundation)
- [ ] Migration `20260815000000_project_bootstrap` (Project/Organization/ProjectSetup/ReportingInstruction)
- [ ] `ProjectDriveFolderService` (ensureRoot / ensureProject / grantTreeReadAccess) + `IProjectDriveFolderService` port
- [ ] Domain `ProjectSetup` entity + `PrismaProjectSetupRepository`
- [ ] Wire into `container.ts`; `OutboxEventBus` job `project.drive.setup` (idempotent)
- [ ] `POST /v1/projects/:id/drive-folder`; `GET /v1/projects/:id` returns `driveFolderId` + deep link
- **Gate A:** unit tests against mocked Drive API (files.list/create, 409 tolerance);
  `pnpm -r typecheck` + `pnpm -r build` green.

### Phase B — Setup state machine + hard gate
- [ ] `GetProjectSetupHandler` / `UpdateProjectSetupHandler`
- [ ] `setup` block in `GET /v1/projects/:id/overview`
- [ ] **`CreateReportingPeriodHandler` hard gate** (`PROJECT_SETUP_INCOMPLETE`)
- [ ] Audit events `project.setup.*`
- **Gate B:** application tests — period creation blocked pre-setup, allowed post-setup;
  soft paths (evidence, logframe CRUD) still work during setup.

### Phase C — Reporting instructions
- [ ] `ReportingInstructionsSchema` + `Upsert/GetReportingInstructionsHandler`
- [ ] `minWords`/`maxWords` on `TemplateSectionSchema`; template upload populates defaults
- [ ] Draft generator consumes instructions; stub validates word counts
- **Gate C:** contract tests + generator tests with per-section word counts.

### Phase D — Frontend
- [ ] `/projects/[id]/setup` checklist page + server actions
- [ ] `/projects/[id]/instructions` form
- [ ] Overview setup block UI + Drive deep-link
- [ ] Wizard redirect + post-create UX
- **Gate D:** Playwright flows — create project → setup checklist → complete
  logframe+template+instructions → mark complete → create period. Maintain 45+ unit / 6+
  Playwright parity.

### Phase E — Indicator update lifecycle + history
- [ ] `submit` / `request-correction` routes (domain already supports both)
- [ ] `GET /v1/indicators/:id/updates` history read model
- [ ] Indicator detail history UI
- **Gate E:** full verification workflow e2e (DRAFT → SUBMITTED → VERIFIED /
  NEEDS_CORRECTION → REJECTED).

### Phase F — Per-project reporting profile + auto-periods
- [ ] Project-level reporting profile: `reportingFrequency`, `language`, `instructions`,
      `deadlineOffsetDays`, `autoPeriodCreation`
- [ ] Auto-create next period on current-period close (respects hard gate)
- [ ] Deadline reminders read the profile
- **Gate F:** schedule test with a `QUARTERLY` project auto-generating periods.

---

## 11. Testing strategy

- **Domain:** pure unit tests for `ProjectSetup.isReportingReady()` transitions;
  `ReportingInstruction` invariants (wordCount min ≤ max).
- **Application:** handler tests with in-memory repos (existing pattern
  `packages/application/test/*.mjs`).
- **Infrastructure:** `ProjectDriveFolderService` against a mocked `fetch` (files.list/create
  responses, 409 idempotency); extend `packages/infrastructure/test/storage.test.mjs`.
- **Contracts:** Zod schema tests for instructions + template word counts.
- **Web:** extend the existing Playwright suite; accessibility tree for the setup checklist.

---

## 12. Risks & dependencies

| Risk | Mitigation |
|---|---|
| **No real Google tenant yet** — Drive folder code can't be e2e-verified until a Google Cloud project + service account + tenant provisioning exist (`gdrive.md` §8, `pending.md`) | Build against the Drive REST shape; mock `fetch` in tests; keep the LOCAL scaffold path as the testable default |
| **Hard gate could annoy early teams** | Soft gates everywhere except period creation; clear setup checklist + "mark complete" confirmation |
| **Token store still partially env-based** (`EnvGoogleDriveTokenStore` fallback, R2 placeholder) | Phase A uses the already-wired `PrismaGoogleDriveTokenStore`; R2 env wiring stays a tracked item in `pending.md` |
| **Drive API rate limits on `files.list` idempotency lookups** | Cache `driveFolderId` on Project/Organization rows; only query Drive when the id is absent |
| **Logframe import is text-only today** | Keep manual CRUD as the setup path; do not block setup on import quality |

---

## 13. Follow-ups (out of scope, tracked in `pending.md`)

- Real LLM provider for draft generation (instructions become more valuable once real)
- R2 env wiring for production (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`)
- Auto-provisioning "sign up with Google" (`googleSubject` column + org creation flow)
- Cross-project ABAC / project membership enforcement (FE-B03) — relevant to `teamReady`
- Donor portal / external reviewer access
