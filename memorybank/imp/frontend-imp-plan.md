# DonorDesk Frontend Portal — Comprehensive Implementation Plan

**Application:** `apps/web`  
**Framework:** Next.js 15 App Router, React 18, TypeScript, Tailwind CSS  
**Source product specification:** `memorybank/imp/frontend-implementation.md`  
**Plan status:** Implementation blueprint  
**Prepared:** 2026-08-12

---

## 1. Objective

Implement the DonorDesk frontend as a dependable, accessible, role-aware portal that guides NGO and humanitarian teams from project setup through evidence-backed donor reporting, review, approval, and controlled export.

The implementation must:

- make the next required action obvious;
- preserve source traceability and human control over AI output;
- remain usable when AI, parsing, preview, or background processing is unavailable;
- enforce tenant, project, role, confidentiality, and export boundaries at the API—not merely in the UI;
- follow SOLID and clean-architecture principles throughout the frontend;
- introduce no knowingly broken, simulated, unsafe, or misleading behavior;
- pass all defined quality gates before a phase is considered complete.

“No errors” is treated as a release discipline: no known type, build, lint, test, accessibility-critical, authorization, data-loss, or primary-workflow defects may remain at release. No engineering plan can prove the absence of every future defect, so prevention, automated verification, observability, failure recovery, and honest release gates are mandatory.

---

## 2. Sources reviewed and authority order

Implementation decisions use this precedence:

1. repository code and executable tests;
2. current audit reports in `memorybank/imp/PHASE*-AUDIT.md`;
3. `memorybank/pending.md` and `memorybank/Fixes.md`;
4. `memorybank/imp/frontend-implementation.md`;
5. feature specifications in `memorybank/Features/`;
6. base concept and MVP documents in `memorybank/base/`;
7. older completion reports, which may contain superseded or overstated claims.

Where documentation conflicts with runtime evidence, the repository and latest audits win. The UI must never claim that a stub, interface, schema, or unregistered adapter is an operational feature.

---

## 3. Verified starting point

### 3.1 Existing frontend

The current web application includes:

- landing, login, signup, and logout pages;
- organization dashboard;
- project list and creation;
- project overview;
- donor template list/upload/section editor;
- logframe list and item creation;
- activity update list and creation;
- evidence list and upload;
- reporting period list/create/workspace;
- compliance checklist;
- team list/invitation;
- light/dark theme infrastructure;
- shared API and session helpers;
- one Playwright login-page smoke test.

Most pages currently implement feature slices directly in route files. Shared UI/layout/feature boundaries are minimal, several headers are duplicated, status presentation is partly raw, and portal-wide loading/error/permission behavior is not established.

### 3.2 Existing API surface usable by the frontend

Registered `/v1` routes currently cover:

- signup/login and OIDC integration;
- organization read/update;
- user list/invite/role change;
- project list/create/read/update;
- organization and project dashboards;
- template list/create/section update;
- logframe listing, item creation, indicator creation/update/verification;
- activity list/create/polish/review;
- evidence upload/search/accept-tags/verify;
- reporting-period list/create, draft generation, section update/approval, draft review/approval;
- checklist list/generation/resolution and readiness;
- comments create/list/resolve;
- exports create/list;
- notifications list/mark-read;
- audit log;
- protected file download.

The exact request/response bodies must be taken from `packages/contracts` and handler code before each screen is built. Do not implement from memorybank endpoint examples alone.

### 3.3 Mandatory baseline defects and gaps

These are implementation blockers for the relevant frontend work:

| ID | Finding | Required resolution |
|---|---|---|
| FE-B01 | `dd_session` is set `httpOnly`, but client mutation code calls `document.cookie` through `session-client.ts`; the token cannot be read by browser JavaScript. | Replace browser token access with same-origin BFF route handlers or Server Actions that read the server cookie. Remove client-token dependency. |
| FE-B02 | Dashboard calls often convert API failures into empty arrays/zero-like states. | Introduce typed settled results and visible partial/error states. Never treat unavailable data as zero. |
| FE-B03 | Project-assignment authorization remains incomplete according to Phase 1 audit. | Backend ABAC/project membership must be fixed and integration-tested before global/project lists are trusted. UI gating remains secondary. |
| FE-B04 | AI tagger, polisher, draft generator, and checklist detector use stubs; source-linked RAG/provenance is not runtime-wired. | Label stub/demo behavior in non-production; hide unsupported claims; do not present generated text as source-verified until backend provenance exists. |
| FE-B05 | Several frontend screens proposed by the product spec have no current route or adequate API read model. | Deliver contracts/use cases/API before or in the same vertical slice; do not fabricate client aggregates. |
| FE-B06 | Email/notification delivery is not operational. | Present in-app notification behavior only; do not claim email delivery or reminders until verified. |
| FE-B07 | Local storage is the current file backend and direct object-storage upload is absent. | Build against a storage/upload interface and current multipart flow; do not expose S3/BYOS controls unless deployed. |
| FE-B08 | AI opt-out exists in domain/API baseline, but settings UI and complete manual behavior are partial. | Add organization setting only after contract is verified; every AI entry point must have a manual path and explicit disabled state. |
| FE-B09 | Browser coverage is only a login smoke test. | Add complete role and critical-path Playwright coverage phase by phase. |
| FE-B10 | Checked-in non-destructive Prisma migration history and full RLS integration coverage remain open. | Frontend release cannot be called production-ready until platform release gates are satisfied. |

### 3.4 Scope exclusions

Do not include these in the initial portal implementation unless separately authorized and runtime-ready:

- donor external portal;
- SCIM management UI;
- external drive/Kobo/ODK/DHIS2/WhatsApp integrations;
- real-time multi-user document collaboration;
- sector intelligence, risk trends, or lesson-mining dashboards;
- white labeling;
- billing/subscription management;
- customizable dashboard widgets;
- advanced charts or GIS;
- offline sync/mobile application.

Interfaces may preserve future extension points, but YAGNI applies: no speculative framework or placeholder controls.

---

## 4. Architecture principles

### 4.1 Frontend layers

```text
Next.js route composition
        ↓
Feature presentation/controllers
        ↓
Frontend application services / query and command interfaces
        ↓
API gateway adapters (server-only)
        ↓
Shared contracts and API
```

Dependencies point inward. UI components do not know URLs, cookies, Fastify, Prisma, or transport response shapes. Route handlers and Server Actions adapt HTTP to feature commands/queries.

### 4.2 Layer responsibilities

| Layer | Owns | Must not own |
|---|---|---|
| `app/` routes | route params, metadata, auth boundary, server composition, loading/error boundaries | business rules, reusable UI internals, raw fetch duplication |
| `features/*/presentation` | feature components, view state, user events, accessible interaction | direct cookies, hard-coded endpoint URLs, cross-feature internals |
| `features/*/application` | feature queries/commands, view-model mapping, orchestration interfaces | JSX styling, database models, browser globals |
| `features/*/domain` | frontend-only pure value objects/policies when genuinely needed | copies of backend aggregate logic |
| `lib/server` | server session, gateway adapters, error normalization, correlation IDs | React presentation |
| `components/ui` | generic accessible primitives | DonorDesk business language or API access |
| `packages/contracts` | transport schemas and shared DTO definitions | frontend display logic |

Do not duplicate backend domain entities in the frontend. Use contract DTOs at the gateway boundary, validate them, then map them into screen-specific view models.

---

## 5. SOLID compliance rules

SOLID is a design constraint and a review checklist, not a slogan.

### 5.1 Single Responsibility Principle

- A route file authenticates, obtains route/search parameters, invokes a query, and composes a screen.
- A gateway method performs one remote operation and validates its response.
- A mapper converts one transport model to one view model.
- A component has one reason to change: visual primitive, feature presentation, or orchestration—not all three.
- A status-label module maps labels; a tone module maps semantic presentation; neither calls APIs.
- Upload coordination, progress presentation, file validation, and metadata editing are separate units.
- Report autosave, editor UI, AI job status, source linking, and comment workflows remain separate controllers/components.

Review rule: a component that fetches data, contains business branching, and renders a large page must be decomposed.

### 5.2 Open/Closed Principle

- Use semantic variants (`success`, `warning`, `danger`, `ai`) instead of spreading raw Tailwind conditionals.
- Use typed registries for status labels, icons, work-item renderers, export formats, and job-stage descriptions.
- Extend supported entities through registered adapters, not central switch statements scattered across pages.
- Filters implement a common serialization interface so new filters do not rewrite list pages.
- New evidence preview types implement `EvidencePreviewAdapter`; existing review UI remains unchanged.

Do not over-engineer plugin systems for capabilities that have one implementation. Extract extension points only at observed volatility boundaries.

### 5.3 Liskov Substitution Principle

- All gateway implementations honor identical success/error/cancellation semantics.
- A stub/demo gateway cannot claim stronger guarantees than a production gateway; demo output is explicitly identified.
- All storage preview adapters return the same permission-safe preview result union.
- Components accept semantic interface contracts and work with loading, available, unavailable, forbidden, and failed results.
- Button, input, dialog, and list variants preserve base accessibility behavior.

Contract tests must run against every implementation of a shared interface.

### 5.4 Interface Segregation Principle

Prefer narrow interfaces:

```ts
interface ProjectReader {
  getProject(id: string, signal?: AbortSignal): Promise<ProjectDetailDto>;
}

interface ProjectWriter {
  updateProject(command: UpdateProjectCommand): Promise<ProjectDetailDto>;
}

interface EvidenceVerifier {
  verify(command: VerifyEvidenceCommand): Promise<VerificationResultDto>;
}
```

- Read-only screens never depend on mutation capabilities.
- Field-officer components do not receive admin services.
- Report editor services are split into section persistence, AI generation, source linking, comments, and approval.
- Generic UI primitives expose minimal props and do not accept entire feature records.

### 5.5 Dependency Inversion Principle

- Feature application code depends on `ProjectReader`, `EvidenceSearch`, `ReportSectionWriter`, `JobStatusReader`, etc.
- Server-only HTTP adapters implement these ports using the `/v1` API.
- Time, navigation, telemetry, and feature flags are injected at controller boundaries where deterministic testing benefits.
- Components do not import `api.ts` directly.
- Client components call Server Actions/BFF endpoints, never read session tokens or construct privileged API requests.

### 5.6 Additional design rules

- **DRY:** share stable behavior, not coincidental markup.
- **KISS:** prefer explicit composition over generic meta-component frameworks.
- **YAGNI:** build only approved current workflows.
- **Composition over inheritance:** use React composition and narrow functions.
- **Tell, don't ask:** pass allowed actions/capabilities to presentation; do not spread role comparisons across components.
- **Functional core, imperative shell:** keep urgency, labels, score display, filter parsing, and preflight interpretation pure and exhaustively tested.

---

## 6. Target project structure

```text
apps/web/src/
  app/
    (public)/
      page.tsx
    (auth)/
      login/
      signup/
      forgot-password/
    (portal)/
      layout.tsx
      loading.tsx
      error.tsx
      dashboard/
      my-work/
      projects/
      reports/
      evidence/
      compliance/
      notifications/
      team/
      audit/
      settings/
    api/                    # same-origin BFF endpoints only when Server Actions are unsuitable

  components/
    ui/                     # generic accessible primitives
    layout/                 # shell/navigation/context
    feedback/               # empty/error/permission/job states
    icons/                  # centralized SVGs

  features/
    auth/
    onboarding/
    dashboard/
    work-items/
    projects/
    templates/
    logframe/
    indicators/
    activities/
    evidence/
    reporting/
    compliance/
    reviews/
    exports/
    notifications/
    team/
    audit/
    settings/

    <feature>/
      application/         # ports, commands, queries, view-model mapping
      presentation/        # screens/components/client controllers
      validation/          # UI schemas derived from contracts
      tests/

  lib/
    server/
      api-gateway.ts
      session.ts
      auth-context.ts
      problem-details.ts
      correlation.ts
    client/
      form-state.ts
      focus.ts
      safe-storage.ts
    shared/
      dates.ts
      labels.ts
      tone.ts
      filters.ts
      result.ts
      exhaustive.ts
```

Migration to route groups should preserve URLs. Perform it incrementally and verify every route after moves.

---

## 7. Cross-cutting technical design

### 7.1 Authentication and mutation transport

The session token remains in a secure `httpOnly`, `secure`-in-production, `sameSite=strict` cookie. Browser JavaScript must not access it.

Preferred mutation path:

```text
Client interaction
  → typed Server Action
  → server reads httpOnly session
  → server-only API gateway
  → Fastify API
  → normalized action state / redirect / revalidation
```

Use a same-origin Next.js route handler when streaming, upload progress, or download proxying makes Server Actions unsuitable. That handler reads the server cookie and forwards only approved headers/body. It must enforce method, content length, content type, timeout, and response streaming rules.

Tasks:

- retire `getSessionToken()`/`getClientToken()` from browser code;
- mark server gateway modules with `server-only`;
- create `requireSession()` returning a typed auth context;
- preserve intended route during session expiration;
- add CSRF analysis/tests for every BFF mutation path;
- never place tokens in local storage, URLs, client props, logs, or error messages.

### 7.2 API gateway and errors

Create one server-only gateway with:

- base URL resolution and validation;
- bearer injection;
- request timeout/abort;
- accepted content types;
- Zod response validation;
- RFC/problem-style error parsing;
- safe fallback errors;
- correlation/request ID propagation;
- no-store defaults for mutable operational data;
- optional Next revalidation tags only for safe cacheable reads.

Use a discriminated error model:

```ts
type AppError =
  | { kind: "validation"; message: string; fields: Record<string, string[]>; referenceId?: string }
  | { kind: "unauthenticated"; message: string }
  | { kind: "forbidden"; message: string; referenceId?: string }
  | { kind: "not_found"; message: string; referenceId?: string }
  | { kind: "conflict"; message: string; referenceId?: string }
  | { kind: "rate_limited"; message: string; retryAfter?: number; referenceId?: string }
  | { kind: "unavailable"; message: string; retryable: boolean; referenceId?: string }
  | { kind: "unexpected"; message: string; referenceId?: string };
```

No page may catch every exception and silently render empty data.

### 7.3 Authorization and capabilities

The API is authoritative. The frontend uses returned capabilities or one server-side capability mapper to avoid offering impossible actions.

- Do not scatter `role === "ADMIN"` checks.
- Define semantic capabilities such as `project.edit`, `evidence.verify`, `report.approve`, `risk.accept`, `audit.view`.
- Pass allowed actions to presentation components.
- Treat 403 as expected and recoverable because access may change after render.
- Do not leak restricted filenames/counts through aggregate cards or search.
- Block release of cross-project/global pages until project-assignment ABAC is integration-tested.

### 7.4 Validation

- Parse route params and search params.
- Validate all API responses at the gateway boundary.
- Derive form schemas from `packages/contracts` where compatible; create explicit form schemas only for presentation-specific intermediate states.
- Convert form values deliberately—dates, numbers, empty optional fields, arrays, and booleans.
- Map API field errors back to controls.
- Focus first invalid control after submission.
- Preserve values after server failures.
- Validate file type, size, count, and zero-byte files on client for feedback and again on server/API for security.

### 7.5 State ownership

| State type | Owner |
|---|---|
| Authoritative domain data | API/database |
| Initial page state | Server Component/query |
| Filters, sort, pagination, selected period/tab | URL |
| Short-lived widget state | Local React state |
| Form state | Native/React action state or focused form controller |
| Upload/job progress | Client controller backed by server job/upload state |
| Report draft text | Server-persisted version with local unsaved buffer |
| Theme | Existing local preference + system preference |

Do not introduce global client state unless a proven cross-route requirement cannot be served by URL/server state.

### 7.6 Dates and time zones

- Store/transport ISO timestamps.
- Render using organization/user time-zone policy.
- Show absolute date plus relative urgency.
- Centralize date parsing/formatting; never use ad hoc `new Date(...).toLocale...` throughout components.
- Test daylight-saving boundaries, midnight, invalid dates, overdue/today thresholds, and locale formatting.

### 7.7 Status, labels, and tones

- Generate exhaustive maps for known contract enums where possible.
- Unknown server values render “Unknown status” safely and generate telemetry; they must not crash the page.
- Semantic tone is independent of the transport enum.
- All status indicators include readable text; icons/colors are supplementary.

### 7.8 Long-running jobs

Standardize template extraction, evidence tagging, activity polishing, report generation, checklist detection, and export:

```text
idle → queued → running(stage, progress?) → succeeded(result) | failed(error, retryable) | cancelled
```

- Prefer a backend job resource with stable ID and status endpoint.
- Poll with bounded exponential backoff initially; pause when document is hidden.
- Abort polling on unmount/navigation.
- Prevent duplicate submissions with idempotency keys.
- Allow safe navigation and surface completion in notifications.
- Never synthesize percent completion when the backend provides only stages.
- Manual work remains available when AI jobs fail or AI is disabled.

### 7.9 File handling and privacy

- Keep uploads tenant/project scoped.
- Use the current multipart route until a real direct-upload contract exists.
- Stream downloads through protected server/API routes; never expose filesystem paths.
- Use permission-safe previews and `Content-Disposition`/content-type defenses.
- Obscure sensitive previews by default.
- Exclude sensitive evidence from export by default.
- Do not send restricted/opted-out content to AI.
- Avoid logging filenames, extracted text, beneficiary information, report prose, or tokens.

### 7.10 Telemetry

Track technical and usability signals without sensitive content:

- route/API latency and error kind;
- action success/failure;
- upload size bucket and failure stage;
- job type/duration/result;
- autosave failure/conflict;
- search latency/result-count bucket;
- Core Web Vitals;
- accessibility/test failures in CI.

Use identifiers only where approved and tenant-safe. Never record document text or beneficiary data.

---

## 8. Shared design system work breakdown

### DS-01 Tokens and foundations

Implement semantic CSS variables and Tailwind mappings for surfaces, text, borders, focus, success, warning, danger, information, and AI. Retain existing brand/accent palettes and dark mode.

Acceptance:

- no feature component uses unexplained arbitrary colors for domain status;
- both themes meet contrast requirements;
- focus styling is visible;
- reduced-motion behavior is implemented;
- dense working surfaces favor legibility over glass effects.

### DS-02 Interaction primitives

Build `Button`, `IconButton`, inputs, textarea, select, checkbox, radio group, switch, field wrapper, error text, and form summary.

Acceptance:

- correct labels/descriptions/errors;
- 44px recommended mobile targets for primary controls;
- pending and disabled states remain distinguishable;
- no disabled control is used where an explanation is required;
- keyboard and screen-reader tests pass.

### DS-03 Overlays and feedback

Build dialog, drawer, popover, tooltip, toast, inline alert, banner, skeleton, spinner, job progress, empty/error/permission states, and confirmation dialog.

Prefer a proven accessible primitive dependency if implementing focus management correctly would otherwise be risky. Any new dependency requires bundle, maintenance, license, accessibility, and server-rendering review.

### DS-04 Navigation and data display

Build breadcrumbs, tabs, pagination, filter bar, active-filter chips, data table, responsive data list, status/severity/AI badges, progress bar, readiness gauge, timeline, activity feed, comments, and source chips.

Acceptance:

- filters and tabs are URL-addressable;
- tables expose headers/captions and mobile alternative;
- gauges have equivalent text and linked underlying data;
- row click is never the only way to access an action.

### DS-05 File and editor primitives

Build file dropzone/queue, preview container, autosave status, unsaved-changes guard, source-reference list, and safe rich-text container.

Do not build a custom rich-text engine. Evaluate a mature editor only when section formatting requirements are confirmed; until then, retain a simple controlled textarea/content model with safe rendering.

---

## 9. Application shell work breakdown

### SHELL-01 Route groups and authenticated layout

- Introduce public/auth/portal route groups without URL changes.
- Add server-side session boundary.
- Add skip link, semantic landmarks, responsive layout, and global error boundary.
- Ensure landing remains independently styled.

### SHELL-02 Top bar and side navigation

- Add organization identity, context-sensitive Create menu, search, notifications, help, theme, and user menu.
- Add Home, My Work, Projects, Reports, Evidence, Compliance, Team, Audit, Settings with capability filtering.
- Add responsive drawer and focus restoration.

### SHELL-03 Project context

- Add breadcrumb and project navigation.
- Fetch minimal project context once per project layout.
- Add reporting-period selector where appropriate.
- Preserve context on mobile.

### SHELL-04 Global system states

- Add route-level `loading.tsx`, `error.tsx`, `not-found.tsx`.
- Add session-expired flow returning to intended route.
- Add partial-data component for composed dashboards.
- Add service/job banners only when backed by actual status.

---

## 10. Feature implementation workstreams

Each feature is a vertical slice: contract → application/API support → server gateway → view model → UI → accessibility → tests → documentation. A screen is not complete when only its JSX exists.

### AUTH — Authentication and onboarding

#### AUTH-01 Harden current authentication UI

- Refactor login/signup to shared field/action states.
- Validate response schemas.
- Preserve non-secret signup values on failure.
- Use generic credential/reset errors to prevent account discovery.
- Ensure OIDC callback and middleware preserve secure cookie semantics.

#### AUTH-02 Forgot-password

- Add route and UI only after backend token/request/reset contracts and email delivery behavior are defined.
- Until then, provide honest support guidance; do not simulate an email.

#### AUTH-03 Resumable onboarding

- Add persistent backend onboarding state or derive completion from authoritative entities.
- Steps: organization, first project, template, logframe, invitations, evidence.
- Allow optional steps to be skipped and resumed.
- Finish on the new project's next-action overview.

Acceptance:

- new admin completes required setup without dead ends;
- refresh/back/return preserves completed steps;
- unsupported storage/integration options are not shown;
- keyboard/mobile journeys pass.

### DASH — Home, My Work, and portfolio

#### DASH-01 Authoritative dashboard read model

Define a contract containing per-widget availability, assigned work, deadlines, report readiness, evidence review counts, compliance gaps, and recent activity. Remove browser-derived “workspace health.”

#### DASH-02 Home

- My Work preview first.
- Deadline bands: overdue/today/3/7/later.
- Readiness cards include components, blockers, and update time.
- Every count links to a filtered destination.
- Render unavailable widgets honestly and retry independently.

#### DASH-03 My Work

Normalize assignments, reviews, corrections, checklist gaps, mentions, and deadlines into a discriminated `WorkItemViewModel`.

- server-side permission filtering;
- urgency ordering;
- type/status/project/due filters;
- contextual primary actions;
- pagination.

#### DASH-04 Project portfolio

- URL-backed search/filter/sort/pagination;
- desktop table and mobile cards;
- status, current period/deadline, authoritative readiness/top blocker, manager, update time;
- archived hidden by default.

Acceptance:

- each role reaches its highest-priority action within two interactions;
- failed data never appears as zero;
- cross-project isolation tests pass.

### PROJ — Project creation and overview

#### PROJ-01 Guided creation

Steps: identity/donor, geography/sector/dates, reporting, assignments, available data mode, review.

- verify current project contract fields before implementation;
- either add backend draft persistence or use guarded in-memory form state; do not claim autosave without persistence;
- explain only deployed data modes;
- show field and summary errors.

#### PROJ-02 Project overview read model

Create one server-composed response for current period, readiness breakdown, top blockers, pending indicators/evidence, checklist gaps, comments, recent updates, and setup gaps.

#### PROJ-03 Overview UI

- project identity/status/header actions;
- active period selector;
- readiness and calculation details;
- top blockers with contextual actions;
- pending verification/review summaries;
- setup checklist if no period exists.

### TPL — Donor templates

#### TPL-01 Template list

- versions, report type, language, source file, status, creator/date, usage count;
- actions gated by permissions and period dependencies.

#### TPL-02 Upload and extraction

- metadata and currently supported formats only;
- per-stage upload/extraction status;
- current stub extraction clearly marked in non-production;
- manual setup remains available.

#### TPL-03 Structured review

- sections/questions/tables/annexes/requirements;
- reorder/add/edit/remove;
- item-level uncertainty/confidence only when backend returns real values;
- original source attachment and version history;
- destructive/dependency warnings.

Backend dependency: parser/runtime support for PDF/DOCX and copy-paste remains pending. The UI must not advertise unimplemented formats.

### LOG — Logframe and indicators

#### LOG-01 Results hierarchy

- accessible tree/list for goal → outcome → output → activity;
- expand/collapse state in URL or stable local state;
- empty/setup guidance;
- permission-aware add/edit.

#### LOG-02 Indicator table

- code/name, level/unit, baseline/target/period/cumulative, means of verification, owner, status, update time;
- sorting/filtering and responsive cards;
- warnings for missing units/sources without invalidating legitimate over-target values.

#### LOG-03 Indicator update and verification

- dedicated drawer/page;
- achievement, cumulative, source, evidence links, comments, disaggregation when supported;
- verify/request-correction/reject with reason;
- immutable visible history.

Backend dependency: detail/update history and disaggregation contracts may need extension.

> **Implemented (2026-08-16):** the per-reporting-period spreadsheet grid at
> `/projects/[id]/reports/[periodId]/indicators` (achievement, cumulative,
> comments, data source, per-row Submit & verify, status badges) plus Google
> Sheets import. Per-indicator history read model and disaggregation entry are
> still pending — see `../../pending.md` and
> `../Features/06-Logframe-And-Indicator-Manager.md`.

### ACT — Activity updates

#### ACT-01 Mobile-first capture

- single-column form;
- save draft if backend status/update support exists;
- participant/disaggregation consistency validation;
- multi-file attachments;
- safe navigation guard;
- clear submission state.

#### ACT-02 AI writing assistance

- explicit original and suggestion;
- Use, Edit, Try again, Keep original;
- AI disabled/unavailable/manual states;
- model/prompt metadata only when actually returned/persisted;
- never overwrite notes silently.

#### ACT-03 Review/detail

- status, submitter, evidence, reviewer comments, history;
- request revision/accept/reject using registered API semantics;
- field officer sees correction and next action.

### EVD — Evidence library and verification

#### EVD-01 Search/list

- convert current POST search into a gateway abstraction;
- URL-backed period/activity/indicator/type/location/uploader/status/confidentiality/date filters;
- table default, optional grid for permitted image-heavy evidence;
- pagination and no-results states;
- server-safe search snippets.

#### EVD-02 Upload queue

- multi-file frontend queue even if API accepts one file per request;
- validate and upload independently;
- shared metadata plus file overrides;
- cancel/retry and exact per-file state;
- idempotency/duplicate handling strategy;
- no zip/batch claim until backend supports it.

#### EVD-03 Detail and preview

Backend must expose a tenant/project-scoped evidence detail read model. UI includes safe preview fallback, metadata, confidentiality, AI suggestions, linked entities, comments, verification, and history.

#### EVD-04 AI tag review

- accept selected/edit/reject/defer—not accept-all only;
- show real confidence/sensitivity only when supplied;
- require human confirmation;
- preserve AI suggestion versus accepted metadata;
- record audit event and run metadata when backend supports it.

#### EVD-05 Verification

- verify/request correction/reject with reviewer note;
- never optimistically show final verification;
- role/capability and backend enforcement;
- sensitive preview/export warnings.

### REP — Reporting periods and report workspace

#### REP-01 Reporting pipeline

- status-grouped list or scannable table;
- deadline, internal deadline, owner, readiness, blockers, activity;
- create period with coherent dates and template dependency validation.

#### REP-02 Workspace read model

Add/verify one composed contract for draft/version, sections, status, source links, related evidence/indicators, checklist alerts, comments, approvals, readiness, capabilities, and job state.

#### REP-03 Three-panel workspace

- left section navigation/status/issues;
- center editor/instructions/autosave/AI actions/sources/comments;
- right evidence/indicator/checklist/review/history context;
- responsive drawer/tab transformation;
- keyboard-friendly panel navigation.

#### REP-04 Autosave and conflict safety

- add section revision/version or ETag to update contract;
- debounce save after idle and save on section change;
- abort obsolete requests;
- show Saving/Saved/Failed/Conflict;
- never overwrite a newer server revision silently;
- recovery copy for unsaved local text without sensitive-data leakage beyond the approved browser storage policy.

#### REP-05 AI generation

- common job UI;
- manual blank draft when AI disabled;
- preserve prior section before replacement;
- model and prompt version display only from persisted run metadata;
- source-linked status only when runtime provenance is real.

#### REP-06 Source linking and unsupported claims

This is blocked on backend claim-level provenance/link contracts. Until delivered:

- show existing source references only as section references, accurately labelled;
- do not infer paragraph support;
- do not present an unsupported-claim detector as operational.

Once backend support exists, implement source chip navigation, inaccessible-source handling, link/unlink, and claim actions.

### CMP — Compliance

#### CMP-01 Checklist view

- current period context;
- group open items by severity;
- URL filters;
- requirement/reason, entity, assignee, due date, status/history;
- contextual fix link based on discriminated type.

#### CMP-02 Resolution actions

- resolve with notes where required;
- accept risk/not applicable only after backend endpoints, permissions, audit, and reason fields exist;
- destructive/high-risk confirmation includes consequence;
- no optimistic final state.

Current API exposes resolve but may not expose every MVP status transition. Omit unsupported controls until implemented.

#### CMP-03 Readiness explanation

- use backend score only;
- show weighted components and data freshness;
- link each component to underlying records;
- handle unavailable component explicitly.

### REV — Comments, review, and approval

#### REV-01 Shared comments

- reusable entity comments query/action;
- open/resolved, author, timestamp, mention when supported;
- no threading until backend supports it;
- permission-safe entity links.

#### REV-02 Lifecycle

- visible report lifecycle based on actual state machine;
- request review, request changes/reject, verification, approval;
- show responsible roles and history;
- validate transitions in backend and shared contracts.

#### REV-03 Pre-approval summary

Backend returns blocking and warning issues. UI shows exact report version, incomplete sections, unverified indicators, unresolved critical items, unsupported claims when real, sensitive evidence, and annex gaps.

Approval is server-confirmed and audited. The UI must never enable approval by duplicating backend policy only in JavaScript.

### EXP — Controlled exports

#### EXP-01 Preflight contract

Add an authoritative export-preflight endpoint/use case returning:

- report/version;
- allowed export types;
- blocking issues;
- overridable warnings and permission;
- default included/excluded files;
- sensitive items;
- annex coverage.

#### EXP-02 Guided export

Steps: type → inclusions → warnings → confirmation → job → result.

- no row of unexplained format buttons;
- override requires permission/reason;
- immutable export record;
- background progress only when backend exposes it;
- protected download.

#### EXP-03 History

- type/version/creator/time/file count/warnings/overrides/status;
- download availability and retention state;
- explain snapshot semantics.

### NTF — Notifications and search

#### NTF-01 Notification inbox

- preview popover and full route;
- grouped dates, unread/read/type filter, mark read;
- audit mark-read mutation;
- no email delivery claims.

#### NTF-02 Global search

Blocked until a permission-filtered global search contract exists. Once available:

- project/report/evidence/indicator/activity/checklist groups;
- safe snippets;
- keyboard navigation/focus restoration;
- full search route with URL query;
- rate/debounce/cancellation behavior.

### ADM — Team, settings, audit

#### ADM-01 Team

- search/filter users;
- invite role and project assignments;
- explain capabilities;
- role changes with consequences and confirmation;
- status/resend/suspend/remove only when endpoints exist.

Current API supports list/invite/role change; do not show unsupported lifecycle controls.

#### ADM-02 Settings

- organization profile;
- personal profile/security when contracts exist;
- AI enabled control with manual-workflow explanation;
- notification preference only when delivery behavior exists;
- data residency display/edit according to backend policy;
- no S3/BYOS/integration controls unless deployed.

#### ADM-03 Audit explorer

- capability-restricted route;
- URL filters for date/user/project/event/entity;
- pagination;
- readable old/new summary with sensitive redaction;
- authorized export only if API supports it.

---

## 11. Contract and backend delivery queue

Frontend work must explicitly track these backend dependencies.

| Priority | Contract/use case | Required by |
|---|---|---|
| P0 | Secure Server Action/BFF mutation pattern | all interactive screens |
| P0 | Project membership/assignment ABAC and tests | all project/global pages |
| P0 | Typed error/problem response consistency | all forms and states |
| P0 | Dashboard and project overview authoritative read models | Home/project overview |
| P0 | Report workspace composed read model | report editor |
| P0 | Section revision/conflict contract | safe autosave |
| P1 | My Work normalized queue | persona home |
| P1 | Evidence detail/history/links/capabilities | evidence review |
| P1 | Indicator detail/update/history | M&E workflow |
| P1 | Activity detail/history/revision | field review loop |
| P1 | Pre-approval/pre-export evaluation | safe approval/export |
| P1 | Job resource/status/idempotency | AI/extraction/export UX |
| P1 | Checklist accept-risk/not-applicable/assignment | full compliance workflow |
| P2 | Permission-filtered global search | command palette |
| P2 | Onboarding progress | resumable setup |
| P2 | User lifecycle/profile/settings | full administration |
| P2 | Real AI provenance/run metadata/feedback | trusted AI UI |
| P3 | Parser/OCR/embedding/RAG | advanced evidence/report intelligence |

Each dependency receives a shared Zod contract, application use case, route authorization, audit behavior for mutation, adapter implementation, integration tests, and frontend contract test before use.

---

## 12. Delivery phases and dependency order

### Phase 0 — Baseline and safety

Deliver:

- freeze route/API inventory and record current screenshots;
- create requirement-to-route-to-contract traceability matrix;
- fix httpOnly client mutation architecture;
- add server-only gateway, response validation, normalized errors, timeouts, and reference IDs;
- stop silent dashboard fallbacks;
- establish capability model;
- complete project-assignment ABAC backend fix/tests;
- establish full CI commands and clean-checkout baseline.

Exit gates:

- no client code reads auth token;
- current mutations work through Server Actions/BFF;
- 401/403/404/409/422/429/5xx behavior is tested;
- tenant/project isolation tests pass;
- current web typecheck/build/tests pass;
- no known Critical/High baseline defect remains in the chosen release scope.

### Phase 1 — Design system and shell

Deliver DS-01 through DS-05 and SHELL-01 through SHELL-04. Refactor current pages without adding feature scope.

Exit gates:

- one authenticated shell;
- responsive navigation/project context;
- shared primitives replace page-local duplicates;
- both themes and reduced motion verified;
- keyboard/screen-reader shell tests pass;
- no route regression.

### Phase 2 — Authentication, onboarding, and project setup

Deliver AUTH, PROJ-01, TPL, and LOG setup portions.

Exit gates:

- new admin can complete supported setup;
- optional/unsupported capabilities are honest;
- form recovery and validation tests pass;
- onboarding state survives refresh/return;
- role access verified.

### Phase 3 — Operational Home and role queues

Deliver DASH, notification inbox, and project overview.

Exit gates:

- authoritative data only;
- each card drills to filtered records;
- partial failure is visible;
- each role reaches priority work within two interactions;
- global views cannot leak unassigned projects.

### Phase 4 — Field activity and evidence workflow

Deliver ACT and EVD.

Exit gates:

- mobile activity update succeeds on narrow viewport;
- multi-file queue handles partial failure/retry;
- AI tags require human action;
- evidence verification/history/audit are visible;
- confidentiality tests cover preview/search/download/export boundaries.

### Phase 5 — Reporting and compliance

Deliver REP, CMP, and shared job handling.

Exit gates:

- editor autosave cannot silently overwrite newer content;
- AI failure does not block manual editing;
- readiness links to real components;
- compliance fixes navigate to the correct entity;
- source-support wording matches actual provenance guarantees.

### Phase 6 — Review, approval, and export

Deliver REV and EXP.

Exit gates:

- invalid state transitions are denied;
- preflight identifies all configured blocking/warning classes;
- approvals and overrides require proper permissions and are audited;
- exported artifact is a versioned protected snapshot;
- export history/download pass E2E.

### Phase 7 — Administration, search, and hardening

Deliver global search once supported, ADM, performance/accessibility/security remediation, and contextual help.

Exit gates:

- audit/team/settings honor permissions;
- search cannot leak inaccessible records;
- critical workflows meet performance budget;
- full release checklist passes on clean checkout and production-like environment.

---

## 13. Testing strategy

### 13.1 Test pyramid

#### Pure unit tests

Cover:

- DTO-to-view-model mapping;
- exhaustive status/label/tone mapping;
- deadline urgency and time-zone boundaries;
- filter parse/serialize/round-trip;
- readiness/preflight display interpretation;
- capability-to-action mapping;
- file validation;
- participant/disaggregation validation;
- job-state transitions and backoff;
- error normalization;
- autosave reducer/conflict decisions.

#### Component interaction tests

Cover:

- fields/errors/focus;
- dialogs/drawers/focus restoration;
- filter bar and pagination;
- upload queue partial failure;
- evidence suggestion selection;
- report editor save states;
- checklist resolution confirmation;
- export preflight;
- responsive navigation.

If no component test framework exists, add one through a reviewed tooling decision or cover the behavior in Playwright. Do not leave complex interactive logic untested.

#### Contract tests

- Validate representative API responses with shared schemas.
- Test every gateway implementation for timeout, abort, malformed JSON, wrong content type, schema drift, and each error family.
- Test interfaces against all adapters to enforce LSP.

#### API/integration tests

- tenant isolation and project assignment;
- capability/role matrix;
- every mutation audit event;
- evidence confidentiality;
- report revision conflict;
- state transition rules;
- preflight/approval/export consistency;
- idempotent job submission;
- protected downloads.

#### Playwright critical journeys

1. signup → supported onboarding → first project;
2. project → template/logframe/period setup;
3. field officer mobile activity update and evidence upload;
4. M&E evidence/indicator correction and verification;
5. grants officer draft/manual edit/source link;
6. compliance officer gap resolution;
7. PM review/approval;
8. export generation/history/download;
9. session expiration with safe recovery;
10. role denial and unassigned-project isolation;
11. sensitive evidence preview/search/export protection;
12. AI disabled and AI job failure manual fallback;
13. keyboard-only primary workflow;
14. dark/light and narrow/wide visual smoke coverage.

### 13.2 Accessibility verification

- automated axe scans for stable screens;
- zero serious/critical violations;
- manual keyboard pass for every workflow;
- screen-reader smoke pass for shell, forms, table/list, dialogs, upload, editor, job state;
- 200% zoom/reflow;
- reduced motion;
- contrast in both themes;
- status never color-only.

### 13.3 Resilience and error injection

Test:

- API unavailable and individual dashboard widget failure;
- slow/aborted requests;
- 401 during save;
- 403 after permissions change;
- validation and conflict errors;
- upload interruption/one-file failure;
- malformed API response;
- AI job timeout/failure;
- export failure;
- browser back/refresh during form/editor work;
- stale revision conflict;
- missing preview/download;
- large/long/empty data sets.

### 13.4 Security-focused frontend tests

- no token in client bundle, DOM, URL, storage, or logs;
- no unauthorized prefetch/data serialization;
- no sensitive data in telemetry/error output;
- safe link targets and external-link protections;
- content rendered as text unless explicitly sanitized;
- upload type/size rejection;
- CSV/spreadsheet export injection addressed by backend exporter;
- clickjacking/CSP/security headers validated at deployment boundary;
- CSRF behavior verified for BFF/Server Actions;
- redirects allow only safe local destinations.

---

## 14. Quality gates and commands

### 14.1 Required repository gates

```bash
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm -r build
pnpm --filter @donordesk/web test
```

Use exact available script names from each workspace. If root recursive test invokes incomplete/unrelated external integration tests, document and create deterministic CI groups rather than silently skipping them.

### 14.2 Additional frontend gates to add

- formatting check;
- true ESLint rules rather than typecheck-only “lint”;
- unused export/dependency check;
- accessibility scan;
- bundle-size budget;
- route-link validation;
- contract/schema compatibility test;
- production build and start smoke test;
- Playwright Chromium plus one additional engine before release;
- dependency vulnerability/license review according to project policy.

### 14.3 Merge gate

A work item may merge only when:

- acceptance criteria and tests are present;
- affected contracts are version-compatible;
- typecheck/lint/tests/build pass;
- no new serious/critical accessibility issue;
- authorization/audit behavior is tested for mutations;
- loading/error/empty/permission states exist;
- documentation and screenshots are updated when behavior changes;
- no TODO masks required behavior.

### 14.4 Phase gate

A phase closes only after:

- all work items meet definition of done;
- phase E2E suite passes from a clean database;
- no open Critical/High defect in phase scope;
- known Medium defects have an explicit accepted disposition;
- product/UX walkthrough by representative roles;
- release notes and rollback instructions exist;
- repository/audit documentation reflects reality.

---

## 15. Error-prevention checklist

### Before coding

- verify endpoint is registered;
- read shared contract and handler;
- verify authorization permission and project scoping;
- verify mutation audit event;
- define success, loading, empty, partial, forbidden, not-found, conflict, and failure behavior;
- define mobile/keyboard behavior;
- confirm backend capability is real rather than stub/scaffold.

### During coding

- use server-only authenticated gateway;
- parse unknown input/response;
- use exhaustive discriminated unions;
- avoid non-null assertions and unsafe casts;
- avoid raw enum display;
- avoid duplicated role logic;
- cancel obsolete async work;
- preserve form/editor values;
- prevent duplicate mutation;
- make errors visible and actionable;
- never use an empty catch.

### Before review

- run focused tests and typecheck;
- inspect both themes and narrow/wide layouts;
- test keyboard and failed API state;
- verify no sensitive information appears in props/HTML/logs;
- verify unauthorized action is absent and API still rejects it;
- verify audit record;
- verify copy accurately states AI/stub/provenance guarantees.

### Before release

- run full clean-checkout gates;
- apply non-destructive migrations through approved process;
- verify RLS/project isolation;
- smoke production build with real proxy/session configuration;
- verify backups/rollback;
- verify monitoring and correlation IDs;
- run critical Playwright suite against production-like environment;
- ensure no placeholder/demo/stub behavior is presented as production.

---

## 16. Definition of done for every frontend story

A story is done only when all applicable items are true:

- one documented user outcome is achieved;
- route, component, and action names use domain language;
- responsibilities and dependencies comply with SOLID rules;
- shared contracts validate all boundary data;
- API authorization is authoritative and frontend capability gating is consistent;
- mutation is audited where required;
- loading, empty, no-results, partial, error, forbidden, not-found, and conflict states are implemented;
- form data/work is recoverable after expected failures;
- responsive behavior is intentional;
- keyboard, focus, screen-reader, contrast, zoom, and reduced-motion requirements pass;
- AI involvement and limitations are explicit;
- provenance wording is accurate;
- privacy/confidentiality behavior is tested;
- automated unit/integration/E2E coverage is proportional to risk;
- no known regression, type error, build error, failing test, broken link, raw enum, fake metric, silent fallback, or simulated-success control remains.

---

## 17. Release and rollback strategy

- Deliver phases as small vertical slices behind server-configured feature flags only where partial exposure would be harmful.
- Flags are not authorization controls.
- Preserve old route/component behavior until the replacement passes parity and migration tests.
- Database/API changes remain backward-compatible for at least the frontend deployment transition.
- Deploy API compatibility first, then web; remove old contracts later.
- Use immutable release artifacts and atomic deployment switch consistent with current deployment practice.
- Rollback must not require destructive database reversal.
- For editor/schema changes, support reading old versions before writing new versions.
- Record release identifier in frontend error/diagnostic context.

Rollback triggers:

- authentication/session regression;
- cross-tenant or cross-project exposure;
- evidence download/privacy regression;
- data loss or editor overwrite;
- approval/export integrity failure;
- sustained critical route errors;
- failed production smoke tests.

---

## 18. Traceability matrix

Maintain this matrix during implementation in the issue tracker or adjacent document:

| Requirement | Work item | Contract/API | Route/component | Tests | Status/evidence |
|---|---|---|---|---|---|
| User sees assigned urgent work | DASH-03 | My Work read model | `/my-work` | unit + API isolation + E2E | Pending |
| Evidence tags require approval | EVD-04 | tag review mutations | evidence detail | contract + role + E2E | Pending |
| Report claims show accurate support | REP-06 | provenance contracts | workspace/source chips | provenance + E2E | Blocked on backend |
| Critical gaps block approval | REV-03 | pre-approval evaluation | approval dialog | transition + E2E | Pending |
| Sensitive files excluded by default | EXP-01/02 | export preflight | export wizard | security + E2E | Pending |
| Every mutation is auditable | all mutations | audit repository/routes | applicable UI | integration assertions | Partial baseline |

No feature is marked complete without code and test evidence linked in this matrix.

---

## 19. Recommended first implementation sprint

The first sprint must reduce risk before visual expansion.

1. Record the current route/API/contract/capability matrix.
2. Add a server-only authenticated API gateway.
3. Convert `ReportWorkspace`, checklist actions, and other client mutations away from browser token access.
4. Add normalized error/result handling and eliminate silent dashboard zero fallbacks.
5. Add server-side capability mapping and permission-state component.
6. Add route-level error/loading/not-found boundaries.
7. Add regression tests for login, a representative client mutation, session expiration, 403, and dashboard partial failure.
8. Run full typecheck/build/test gates and document exact results.

Only after this sprint passes should the shared shell and new portal screens be built.

---

## 20. Final implementation success criteria

The implementation is successful when a real pilot team can, within its permissions:

1. sign in and understand incomplete setup;
2. create and configure a project using only supported capabilities;
3. collect activity updates and evidence on mobile;
4. understand upload, AI-processing, review, and correction states;
5. verify evidence and indicator data without losing history;
6. create or manually edit a report when AI is disabled or fails;
7. distinguish section references from genuinely claim-level provenance;
8. identify and fix every approval blocker through a direct action;
9. complete role-based review and approval with an audit trail;
10. exclude or intentionally include sensitive evidence during export;
11. download and later retrieve the exact approved export version;
12. recover safely from common network, validation, session, job, and conflict failures;
13. complete critical tasks using keyboard and assistive technology;
14. never see inaccessible project/evidence data;
15. trust that displayed readiness, verification, approval, and AI states reflect authoritative backend reality.

The final usability test remains:

> **The portal tells each user exactly what requires attention, why it matters, and how to resolve it—without sacrificing evidence traceability, privacy, or control.**
