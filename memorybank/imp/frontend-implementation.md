# DonorDesk Frontend Portal Implementation Plan

**Project:** DonorDesk  
**Application:** `apps/web` — Next.js 15 App Router  
**Document purpose:** Product, UX, information architecture, and frontend delivery specification  
**Status:** Implementation-ready plan; this document does not itself change application code  
**Last updated:** 2026-08-12

---

## 1. Product outcome

DonorDesk must feel like a calm, guided reporting workspace for NGO and humanitarian teams—not a generic analytics dashboard and not a file-storage system.

Its core promise is:

> **Turn scattered field evidence into donor-ready reports and audit-ready compliance packs.**

The portal succeeds when a non-technical user can immediately understand:

1. What is due next?
2. What needs my attention?
3. What evidence or data is missing?
4. What should I do next?
5. Can I trust and verify the report output?

The primary end-to-end journey is:

```text
Set up project
  → structure donor template and logframe
  → collect activity updates and evidence
  → review tags, evidence, and indicators
  → generate an evidence-backed draft
  → resolve compliance and review gaps
  → approve and export a controlled version
```

Every primary screen must help the user advance this journey.

---

## 2. Users and experience priorities

The same data must be presented differently according to the signed-in user's responsibilities. Role-based presentation must never bypass API authorization.

| Role | First questions the UI should answer | Highest-priority actions |
|---|---|---|
| Admin | Is the workspace configured and is the team able to work? | Finish setup, invite users, assign projects, manage settings |
| Project Manager | Will the report be ready and what is blocking it? | Review readiness, assign gaps, request review, approve report |
| M&E Officer | Which indicators or evidence require verification? | Update indicators, verify sources, return corrections |
| Grants / Reporting Officer | Which report sections need work or evidence? | Create period, draft/edit sections, request review, export |
| Field Officer | What update or evidence do I need to submit? | Add activity update, upload evidence, respond to correction request |
| Compliance / Finance Officer | Which high-risk requirements are unresolved? | Review sensitive/compliance files, resolve or accept risk, prepare pack |

### 2.1 Persona presentation rules

- Use the authenticated role and assignments to order content; do not add a cosmetic “view as another role” switcher.
- Organization-wide metrics are shown only where the user is allowed to see them.
- The dashboard opens on **My work**, with organization/project summaries below it.
- Field workflows must work well at narrow mobile widths and on slower connections.
- Restricted evidence must never be teased through filenames, thumbnails, search snippets, or counts to an unauthorized user.

---

## 3. UX principles and non-negotiable rules

| Principle | Required behavior |
|---|---|
| Action before analytics | Every metric links to the records behind it and offers a useful next step. No decorative charts. |
| Deadline first | Overdue and upcoming reporting work appears before general project statistics. Dates include an absolute date and a useful relative label. |
| Traceability by default | AI text, indicator values, approvals, readiness scores, and exports show their sources, status, author, and last update. |
| Human control of AI | Suggestions remain pending until accepted. Users can edit, reject, regenerate, or continue manually. |
| Progressive disclosure | Summary first, details on demand. Keep forms and dense metadata out of the default view until needed. |
| Plain language | Use “Needs review,” not raw enum text such as `PENDING_REVIEW`; explain specialist terms in context. |
| Safe by design | Warn before exporting sensitive data, accepting risk, rejecting work, or leaving with unsaved edits. |
| Recoverable work | Auto-save long-form work, preserve drafts, retain original input, and provide retry paths after failures. |
| Visible system state | Every upload, parse, AI task, save, approval, and export has a clear queued/running/success/failure state. |
| Accessible and responsive | Keyboard, screen reader, contrast, reduced-motion, zoom, tablet, and mobile behavior are acceptance requirements. |

### 3.1 Content rules

- Buttons use verbs: **Upload evidence**, **Request review**, **Link source**, **Resolve gap**.
- Avoid generic actions such as “Submit” or “Continue” when a more precise label exists.
- Empty states explain why the area matters and contain one primary action.
- Error messages say what failed, whether work was saved, and what the user can do.
- Show user-facing labels from centralized maps; never expose database IDs or raw enum values.
- Scores must include their components and “Calculated from data updated …”; never imply false precision.

---

## 4. Current frontend baseline

### 4.1 Installed stack

| Concern | Current choice |
|---|---|
| Framework | Next.js `15.5.21`, App Router |
| Rendering | React `18.3.1`; Server Components for reads |
| Language | TypeScript `5.6.3` |
| Styling | Tailwind CSS `3.4.14` and shared classes in `globals.css` |
| Class composition | `clsx` `2.1.1` |
| Validation | Zod `3.23.8` / shared contracts |
| Testing | Playwright `^1.62.1`; TypeScript typecheck |
| Theme | Existing light/dark tokens, `ThemeScript`, and `ThemeToggle` |

No chart, component, icon, form, or global-state library is currently installed. Build the initial system with the existing stack. Introduce a dependency only when it removes substantial accessibility or maintenance risk, and record the decision.

> **Recorded decision (2026-08-17):** ECharts 6.1.0 was added to `apps/web` for
> **user-selectable report charts** (BAR/LINE/PIE/AREA/RADAR/GAUGE per indicator
> section). The user explicitly required non-generic, interactive, type-switchable
> charts before finalising reports, which the standing "no chart library" rule
> cannot meet at reasonable cost. ECharts was chosen because **one config schema
> serves both targets** — the interactive client renderer and the server-side
> SSR→PNG export renderer (`echarts.init(null, null, { renderer:"svg", ssr:true })`
> + `sharp`) — so the finalized chart is pixel-identical to what the user approved.
> Performance: the library is `import()`-ed lazily (splits into its own chunk, zero
> chart code in the initial route bundle); chart series are memoised; export PNGs
> are content-hash cached. See `../Features/20-report-gen.md` §15.

### 4.2 Existing request pattern

- Server Components call `api<T>()` from `src/lib/api.ts` using the server session token.
- Interactive client components call the API with the client session token, then refresh affected server-rendered data.
- Frequently changing authenticated pages use `dynamic = "force-dynamic"`.
- Authenticated routes redirect to `/login` when no valid session exists.
- Existing API routes use the `/v1/...` prefix.

### 4.3 Current route coverage

Implemented web routes currently cover:

- landing, login, signup, logout;
- organization dashboard and project list/create;
- project overview;
- donor template list/upload/extracted-section editor;
- logframe list/create;
- activity update list/create;
- evidence list/upload;
- reporting period list/create/workspace;
- compliance checklist;
- team management.

Important gaps in the current web route tree include dedicated evidence detail/review, indicator detail/update, complete review/approval, exports/history, notifications, onboarding, settings, audit log, forgot-password, and organization-level reports/evidence/checklist views. These are planned below and must not be represented as already implemented.

---

## 5. Portal information architecture

### 5.1 Authenticated application shell

Use a single shared shell instead of repeating headers on every page.

```text
Top bar
  Organization/project context | Search | Create | Notifications | Help | User

Primary sidebar
  Home
  My work
  Projects
  Reports
  Evidence
  Compliance
  Team          (permission-gated)
  Audit log     (permission-gated)
  Settings      (permission-gated)

Project context navigation
  Overview
  Reports
  Evidence
  Activities
  Logframe & indicators
  Donor templates
  Compliance
  Team
  Settings
```

Why this structure:

- **Home** answers organization-level “what needs attention?”
- **My work** gives each user one reliable personal queue.
- **Projects** remains the main organizing boundary.
- **Reports, Evidence, and Compliance** provide cross-project operational queues for users responsible for several projects.
- Template and logframe setup remain project-scoped and do not clutter global navigation.

### 5.2 Navigation behavior

- Desktop: persistent collapsible sidebar; never icon-only unless tooltips and accessible names are present.
- Tablet: compact sidebar or drawer depending on available width.
- Mobile: top app bar plus accessible navigation drawer; preserve the current project and period context.
- Breadcrumbs appear on all nested pages: `Projects / Emergency Nutrition / Reports / Q2 2026`.
- Project name and current reporting period are always visible in project workspaces.
- Navigation items show small meaningful counts only for assigned, actionable work—not all records.
- Opening a notification or dashboard metric navigates to a filtered, explainable destination.

### 5.3 Proposed route map

```text
/dashboard                              Home
/my-work                                Assigned work queue
/projects                               Project portfolio
/projects/new                           Guided project creation
/projects/[id]                          Project overview
/projects/[id]/reports                  Reporting periods
/projects/[id]/reports/new              Create period
/projects/[id]/reports/[periodId]       Report workspace
/projects/[id]/reports/[periodId]/export Export review and history
/projects/[id]/evidence                 Evidence library
/projects/[id]/evidence/new             Upload flow
/projects/[id]/evidence/[evidenceId]    Preview, metadata, links, review
/projects/[id]/activities               Activity updates
/projects/[id]/activities/new           Mobile-friendly activity capture
/projects/[id]/activities/[updateId]    Detail and review
/projects/[id]/logframe                 Results hierarchy and indicators
/projects/[id]/indicators/[indicatorId] Indicator history and update
/projects/[id]/templates                Donor templates
/projects/[id]/templates/new            Upload/extraction flow
/projects/[id]/templates/[templateId]   Extracted structure review
/projects/[id]/compliance               Period checklist
/projects/[id]/team                     Project assignments
/projects/[id]/settings                 Project configuration
/reports                                Cross-project report pipeline
/evidence                               Cross-project evidence queue
/compliance                             Cross-project compliance queue
/notifications                          Notification inbox
/team                                   Organization users
/audit                                  Audit event explorer
/settings                               Organization and user settings
/onboarding                             Resumable setup checklist
/forgot-password                        Password reset request
```

The global queue routes may reuse project page components with an organization-level filter rather than duplicate the feature.

---

## 6. Shared shell and global interaction model

### 6.1 Top bar

Include:

- current organization identity;
- context-aware **Create** menu (project, report period, activity update, evidence);
- global search trigger with `Ctrl/Cmd+K` hint;
- notification bell with unread count;
- help entry point with short contextual guidance;
- theme control;
- user menu with profile, settings, and sign out.

Avoid a permanently dominant **New project** button once the organization already has active projects. The most likely action changes by context.

### 6.2 My Work queue

Create one reusable work-item model for assignments, review requests, correction requests, checklist gaps, and deadlines.

Each row shows:

- task title and type;
- project and reporting period;
- severity/priority and due date;
- why it is assigned to the user;
- current status and last activity;
- one primary action;
- secondary options in an overflow menu.

Default sorting:

1. overdue;
2. critical/high severity;
3. due within three days;
4. returned for correction or mentioned;
5. remaining assignments by due date.

### 6.3 Search and command palette

Search across only records the user can access:

- projects;
- reporting periods and report sections;
- evidence title, filename, approved tags, and permitted extracted text;
- indicators;
- activity updates;
- checklist items.

Results are grouped by type and display context. Keyboard support: open, arrow navigation, Enter, Escape, and focus return. Search terms and filters should be shareable through URL parameters on full result pages.

### 6.4 Notifications

The bell provides a short preview; `/notifications` is the durable inbox.

- Group by **Today**, **Earlier this week**, and **Older**.
- Support unread/read, mark all read, and type filter.
- Each notification explains the event and target, not only a generic title.
- Email delivery status must not be implied while notification delivery remains a stub.

---

## 7. Design system

### 7.1 Visual direction

Retain the existing brand-blue/cyan identity and light/dark modes, but optimize the authenticated portal for long working sessions:

- Use solid or lightly translucent surfaces for dense tables, editors, and forms; reserve strong glass/glow effects for navigation, hero summaries, and AI affordances.
- Use a restrained maximum content width for dashboards and forms, but allow data tables and the report editor to use the viewport.
- Use slate neutrals for structure; brand blue for primary actions; cyan for AI-specific accents only.
- Semantic meanings remain stable: green = verified/approved, amber = needs attention, red = critical/overdue/destructive, violet or cyan = AI suggestion, slate = inactive/neutral.
- Never rely on color alone; every state includes text and, where helpful, an icon.

### 7.2 Foundation tokens

Centralize tokens in Tailwind/CSS for:

- background, surface, elevated surface, and muted surface;
- default, subtle, strong, focus, and danger borders;
- text primary, secondary, muted, inverse, and link;
- semantic success, warning, danger, information, and AI tones;
- 4/8px spacing rhythm;
- small/medium/large radii;
- compact and comfortable density;
- shadow levels;
- focus ring;
- content widths and shell dimensions;
- motion durations respecting `prefers-reduced-motion`.

### 7.3 Shared component inventory

Build typed primitives in `src/components/ui/` and domain composites in feature folders.

| Primitive | Required behavior |
|---|---|
| `Button`, `IconButton` | variants, pending state, accessible disabled state, optional confirmation |
| `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup` | label, description, required marker, inline error, help text |
| `FileDropzone` | browse/drag-drop, accepted types/size, upload progress, retry, cancel |
| `Card`, `Section`, `Divider` | consistent surfaces and spacing |
| `Badge`, `StatusBadge`, `SeverityBadge`, `AiBadge` | centralized label and tone mapping |
| `ProgressBar`, `ReadinessGauge` | label, numerical value, screen-reader text; no animation dependency |
| `Alert`, `Callout`, `Banner` | info, warning, error, privacy, AI states |
| `EmptyState`, `ErrorState`, `PermissionState` | explanation and next action |
| `Skeleton`, `Spinner`, `ProgressSteps` | appropriate loading feedback |
| `Dialog`, `Drawer`, `Popover`, `Tooltip` | focus trap, Escape close, focus restoration |
| `Toast` | non-blocking success; persistent/inline presentation for errors |
| `Tabs`, `Breadcrumbs`, `Pagination` | keyboard and URL-aware navigation |
| `FilterBar`, `SearchInput`, `ActiveFilterChips` | URL-backed filters and clear-all |
| `DataTable`, `DataList`, `CardList` | responsive views, sorting, selection, row actions |
| `Timeline`, `ActivityFeed`, `CommentThread` | actor and timestamp visibility |
| `SourceChip`, `EvidencePreview` | permission-safe references and preview fallback |
| `AutosaveStatus`, `UnsavedChangesGuard` | report editor and long forms |

Centralize icons in `src/components/icons/`. Do not duplicate raw SVG markup page by page.

### 7.4 Status language

Create one `labels.ts` source and one `tone.ts` mapping for all domain enums. Similar states across different entities may share a tone but retain precise language. Examples:

- `AI_TAGGED` → “AI suggestions ready”
- `NEEDS_CORRECTION` → “Changes requested”
- `ACCEPTED_RISK` → “Risk accepted”
- `EVIDENCE_COLLECTION` → “Collecting evidence”

---

## 8. Screen specifications

### 8.1 Public, authentication, and onboarding

#### Login and signup

- Keep one clear primary action and a visible route between login/signup.
- Validate per field after interaction and provide a summary only when useful.
- Preserve entered non-secret fields after a failed signup.
- Show password requirements before failure.
- Provide forgot-password and support links.
- Do not expose whether an email is registered during password reset.

#### Resumable onboarding

Use a checklist-driven wizard:

1. organization profile;
2. first project;
3. donor template;
4. logframe;
5. team invitations;
6. first evidence upload.

Requirements:

- clearly mark required versus optional steps;
- save each completed step;
- allow skip and return later;
- show “You can change this later” where true;
- finish on a useful project overview with a next-best-action checklist;
- retain an unobtrusive setup progress card on Home until essential setup is complete.

### 8.2 Organization Home

Order content by urgency and usefulness:

1. greeting and contextual summary (“3 reports need attention this week”);
2. **My work** preview;
3. deadline strip: overdue, today, 3 days, 7 days, later;
4. project/report readiness overview with blockers;
5. verification and compliance queues;
6. recent team activity;
7. storage/setup notices when relevant.

Do not create a fictional organization “health” percentage from project count and remaining days. If a score is displayed, it must be a documented aggregate of real report-readiness components and link to its calculation.

Every card links to a filtered list. Example: selecting “8 evidence files need review” opens the evidence queue with `status=pending-review`.

### 8.3 Project portfolio

Provide search, status, donor, sector, country, manager, and deadline filters.

Desktop defaults to a scannable list/table with:

- project title/code and donor;
- project status;
- current reporting period and deadline;
- readiness and top blocker;
- responsible manager;
- last meaningful update.

Mobile uses cards with the same information. Persist view, sort, and filters in the URL. Archived projects are hidden by default.

### 8.4 Guided project creation

Split the long project form into logical steps:

1. identity and donor;
2. location, sector, and duration;
3. reporting schedule;
4. responsible team;
5. storage/data mode and privacy explanation;
6. review and create.

Save a draft when backend support exists. Otherwise warn before navigation. Explain Cloud Upload, Private Workspace, and Bring-Your-Own-Storage in plain language; show only modes actually available in the deployment.

### 8.5 Project overview

The header shows project title/code, donor, status, duration, and primary contact with permission-aware actions.

The body prioritizes the current reporting period:

- readiness gauge with five weighted components;
- exact deadline, internal review deadline, status, owner, and last edit;
- top three blockers with direct **Fix** actions;
- indicator updates needing verification;
- missing/unverified evidence;
- critical/high checklist items;
- open review comments;
- recent activity and uploads;
- setup completeness when no reporting period exists.

When multiple periods exist, clearly identify the active period and provide a period selector. Historical periods must not silently influence current-period summaries.

### 8.6 Donor template workflow

Use a step-based upload and extraction experience:

1. enter metadata and upload/paste content;
2. show upload and extraction progress;
3. review extracted sections, questions, tables, annexes, and compliance requirements;
4. show AI confidence/uncertainty at the affected item—not as one opaque overall score;
5. accept, edit, add, remove, and reorder extracted items;
6. save a version with the original file attached.

Before destructive deletion, explain whether existing reporting periods use the template. Preserve original extraction and user edits in history.

### 8.7 Logframe and indicators

Default to a hierarchical results view: Goal → Outcome → Output → Activity. Provide a focused indicator table alongside or as a tab.

Indicator rows show:

- code and name;
- level and unit;
- baseline, target, reporting-period achievement, and cumulative achievement;
- means of verification;
- responsible user;
- verification status and last update.

Indicator update is a drawer or dedicated page with evidence linking, comments, source, disaggregation fields, and verification history. Show over-target values without treating them as errors; warn on inconsistent or missing units/data.

### 8.8 Activity updates

This is the main field-user workflow and must be mobile-first.

- Use a single-column form with large touch targets.
- Allow save draft and later completion.
- Keep participant totals and disaggregation together; validate inconsistencies without losing input.
- Attach multiple evidence files from the same flow.
- AI writing assistance displays original notes and proposed wording side by side or with a clear preview.
- Actions are **Use suggestion**, **Edit suggestion**, **Try again**, and **Keep my notes**.
- After submission, show status, reviewer feedback, and the next expected step.

### 8.9 Evidence library and review

Provide table/list as the desktop default and optional grid for image-heavy review. Filters include period, activity, indicator, type, location, uploader, verification, confidentiality, and date.

Bulk upload flow:

1. select files and validate format/size;
2. upload each file independently with progress/retry;
3. collect shared metadata once;
4. show per-file AI processing state;
5. review suggestions file by file or in a batch;
6. submit for verification.

Evidence detail uses a split layout:

- preview with safe fallback and download;
- metadata and confidentiality;
- AI summary, suggested tags, confidence, and sensitivity warning;
- linked activities, outputs, indicators, donor requirements, and report sections;
- verification controls, reviewer comments, and history.

Sensitive content rules:

- obscure thumbnails/previews until intentionally opened;
- show a privacy warning before changing access or exporting;
- exclude sensitive evidence from exports by default;
- never send content to AI when deployment/privacy policy prohibits it;
- explain when preview or AI processing is unavailable without blocking manual metadata work.

### 8.10 Reporting periods and pipeline

List periods as a pipeline grouped by status: Not started, Collecting evidence, Drafting, Under review, Approved, Submitted, Closed.

Each item shows deadline, internal deadline, readiness, owner, blockers, and last activity. The create flow requires template, dates, responsible officer, and validation that dates are coherent.

### 8.11 Report workspace

The primary desktop experience is a three-panel workspace:

```text
Section navigation | Section editor and source links | Evidence / indicators / gaps / review
```

#### Left panel

- template-derived section order;
- status: Not started, Drafted, Needs evidence, Needs review, Approved;
- required/optional marker;
- issue and open-comment counts;
- section completion progress.

#### Center editor

- section title, prompt/instructions, and content;
- visible autosave state and version timestamp;
- AI actions: Draft, Rewrite, Shorten, Donor-friendly, Regenerate;
- original/current content preserved when applying AI output;
- inline source chips attached to claims or paragraphs;
- unsupported-claim warning with **Link source**, **Revise text**, or **Mark for review**;
- comments and mark-complete/request-review actions.

#### Right context panel

Tabs or sections for:

- suggested and linked evidence;
- related indicator data and verification state;
- checklist alerts;
- comments/review status;
- section history.

On smaller screens, section navigation becomes a drawer and the context panel becomes tabs below/above the editor. Do not compress three desktop columns into unusable narrow columns.

AI generation may take time. Display queued, collecting sources, drafting, validating sources, completed, and failed states. Users must be able to continue manual editing if AI fails.

### 8.12 Compliance checklist

Default to open items grouped by severity, with Critical and High expanded. Show:

- item type and plain-language title;
- donor requirement/reason;
- related entity;
- assignee and due date;
- status and resolution history;
- direct fix action based on type.

Examples of contextual actions: **Upload document**, **Link evidence**, **Update indicator**, **Review sensitive file**, **Complete annex**.

“Accept risk” requires permission, a confirmation dialog, and resolution notes. “Not applicable” also requires a reason. Resolved items remain discoverable and auditable.

### 8.13 Review and approval

Add a visible lifecycle stepper:

```text
Draft → Internal review → M&E verified → Compliance verified → PM approval → Exported → Submitted → Closed
```

The review surface includes:

- open and resolved comments grouped by section/entity;
- reviewer, assignee/mention, timestamp, and resolution;
- approval requirements with responsible role and status;
- request-changes flow with required reason;
- approval confirmation showing report version and unresolved warnings.

Before approval/export, present a preflight summary:

- required sections incomplete;
- unsupported claims;
- unverified indicators;
- critical checklist items;
- sensitive files selected;
- missing annexes.

Never reduce approval to an uncontextualized button.

### 8.14 Export center

Use a guided export page rather than a row of format buttons.

1. choose report/indicator/checklist/evidence-pack output;
2. review version and included files;
3. review warnings and sensitive-data exclusions;
4. confirm permission-dependent overrides with a reason;
5. generate with progress;
6. download from immutable export history.

History shows type, version, creator, timestamp, included-file count, warnings/overrides, and download availability. Explain that exporting creates a controlled snapshot; later edits do not change an earlier export.

### 8.15 Team, settings, and audit

#### Team

- Search/filter by role, status, and project assignment.
- Invite users with role and project assignments in one flow.
- Explain role capabilities before saving.
- Clearly distinguish suspend, remove, and resend invitation.
- Confirm any change that may remove access to active work.

#### Settings

Separate organization, personal profile, notifications, security, storage/data mode, and project settings. Hide sections the role cannot manage. Use save states and unsaved-change guards.

#### Audit log

Provide filters for date, user, project, event, and entity. Each event expands to a human-readable change summary with old/new values where permitted. Sensitive values are redacted. Allow authorized export.

---

## 9. Common page and data states

Every feature must explicitly implement:

| State | Expected presentation |
|---|---|
| Initial loading | Page-shaped skeleton for short reads; progress status for long jobs |
| Empty | Purpose, why it matters, primary action, optional sample/help link |
| No filter results | Active filters, clear/reset action, no creation prompt unless appropriate |
| Partial data | Render available sections and identify which source failed with retry |
| Error | Plain-language cause where safe, retry, support/reference ID, preservation status |
| Permission denied | Explain missing access without leaking record details; offer back/request-access path |
| Session expired | Preserve safe draft locally where appropriate; return to login then intended destination |
| Offline/interrupted | Preserve form/editor work and communicate what has/has not synced |
| Background job running | Stage, start time, safe navigation, notification on completion |
| Destructive confirmation | Object name, consequence, affected dependencies, explicit action label |

Do not silently replace failed API responses with zero values on decision-critical dashboards. A missing response is “Unavailable,” not “0.”

---

## 10. Forms and validation

- Use shared Zod schemas/contracts wherever possible so frontend rules match API validation.
- Validate on blur and submit; avoid aggressive error messages while the user is typing.
- Focus the first invalid field after submit and provide an error summary for long forms.
- Keep entered values after server errors.
- Use native input types and autocomplete attributes.
- Dates display in the user's locale/time zone while API values remain unambiguous.
- Numeric indicator and budget fields preserve precision and unit/currency context.
- Disable an action only while that exact action is pending; prevent duplicate requests.
- Use server-confirmed success feedback and refresh only the affected view when practical.

---

## 11. Data fetching, state, and URL design

### 11.1 Reads

- Keep RSC-first reads for initial pages and permission checks.
- Fetch independent dashboard sources in parallel.
- Use aggregation endpoints for dashboard/project summaries once their contracts are implemented.
- Paginate evidence, audit, comments, notifications, and cross-project queues.
- Represent filters, sort, page, view, active tab, project, and period in URL search parameters.
- Use real loading/error boundaries (`loading.tsx`, `error.tsx`, `not-found.tsx`) at useful route segments.

### 11.2 Mutations

- Prefer Server Actions for straightforward form submissions where they simplify validation and redirects.
- Use focused client components for upload progress, editor autosave, inline verification, comments, and long-running jobs.
- Optimistic updates are appropriate only for easily reversible actions such as mark-read or resolving a comment; never optimistically show an approval, export, verification, or sensitive-access change as final.
- API errors need a normalized UI-safe shape including title, status, code, field errors when available, and correlation/reference ID.

### 11.3 Long-running operations

Template extraction, evidence tagging, report generation, checklist detection, and exports use a common job-status UI. Polling is acceptable initially; WebSocket/SSE may replace it later behind a shared abstraction.

---

## 12. Backend/API support required

Audit the API routes and shared contracts before implementing each phase. Do not invent frontend-only data or infer authoritative readiness values in the browser.

Priority read models:

| Contract | Purpose |
|---|---|
| Organization dashboard | assigned work, deadlines, report readiness, review/compliance counts, activity |
| My Work | normalized permission-filtered action queue |
| Project overview | current period, readiness components, blockers, recent updates |
| Cross-project reports/evidence/compliance | paginated filtered operational queues |
| Evidence detail | preview metadata, AI suggestions, links, comments, history, permissions |
| Report workspace | sections, source links, indicators, checklist alerts, comments, approvals, versions |
| Search | permission-filtered grouped results |
| Export preflight | blocking warnings, overridable warnings, selected sensitive files, permission |

Priority mutation support:

- accept/edit/reject individual AI suggestions;
- verify/return/reject evidence and indicator updates with comments;
- link/unlink evidence to activities, indicators, requirements, and report sections;
- save/version report sections and source references;
- request review, request changes, approve, and record submission;
- resolve, accept risk, or mark checklist items not applicable with notes;
- mark/read notifications;
- generate and query long-running job status;
- build controlled exports after preflight confirmation.

Any unavailable capability must have an honest disabled state or be omitted; never show controls that only simulate success.

---

## 13. Accessibility requirements

Target WCAG 2.2 AA.

- All functionality is operable by keyboard.
- Use semantic landmarks, headings, lists, tables, form labels, and buttons.
- Provide a skip link and visible focus treatment.
- Dialogs/drawers trap focus, close with Escape where safe, and restore focus.
- Announce async save, upload, AI job, and validation status without stealing focus.
- Tables have captions/accessible names and correct header relationships.
- Charts/gauges include equivalent text and underlying linked data.
- Do not convey status through color alone.
- Maintain 4.5:1 text contrast and visible control boundaries in both themes.
- Support 200% zoom/reflow and reduced motion.
- Thumbnails and meaningful images receive useful alternatives; decorative icons are hidden from assistive technology.
- Test report editing, file upload, filters, dialogs, and navigation with keyboard and a screen reader—not only automated scans.

---

## 14. Responsive and low-bandwidth behavior

Breakpoints follow content needs, not device names.

- Forms become one column and keep primary actions reachable.
- Tables transform into prioritized cards only when horizontal scrolling would harm comprehension.
- The report workspace changes panels into drawers/tabs on smaller screens.
- Filters collapse into a drawer while active filter chips remain visible.
- Avoid loading document previews or image thumbnails until requested/in view.
- Show file size before upload, compress images only with informed consent, and allow retry per file.
- Long AI jobs survive navigation and appear in notifications/My Work when complete.
- Core metadata entry and manual report editing remain usable when AI/parsing is unavailable.

---

## 15. Performance and reliability budgets

- Normal dashboard useful content: within 3 seconds under the MVP requirement.
- Avoid sequential request waterfalls; use composed read models or parallel calls.
- Keep Server Components as the default and minimize client boundaries.
- Paginate large collections and virtualize only after measurement demonstrates need.
- Use lightweight SVG for simple bars/gauges; no chart library for decorative visuals.
- Debounce search and cancel obsolete requests.
- Autosave report content after a short idle interval and on section change; expose last saved time.
- Preserve user input through recoverable failures.
- Measure Core Web Vitals, route latency, upload failure rate, job completion/failure, and editor save failures without logging beneficiary content or sensitive filenames.

---

## 16. Frontend file organization

Recommended structure:

```text
src/app/
  (public)/
  (auth)/
  (portal)/
    layout.tsx
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

src/components/
  ui/                 reusable primitives only
  layout/             AppShell, TopBar, SideNav, ContextNav
  feedback/           jobs, errors, empty states, confirmations
  search/             command palette and result groups
  icons/              centralized icon registry

src/features/
  dashboard/
  projects/
  templates/
  logframe/
  activities/
  evidence/
  reporting/
  compliance/
  reviews/
  exports/
  team/
  audit/

src/lib/
  api.ts
  api-errors.ts
  labels.ts
  tone.ts
  permissions.ts
  dates.ts
  filters.ts
  jobs.ts
```

Route files should compose feature components and fetch data; domain-heavy formatting and interaction logic belongs in `src/features`. Do not create one oversized global component directory or duplicate entity types across pages—prefer shared API contracts/read-model types.

---

## 17. Delivery plan

### Phase FE-0 — Contract and usability audit

- Inventory current routes, API contracts, permissions, enums, and missing screens.
- Test the current workflow once as each primary role.
- Define dashboard, project-overview, My Work, evidence-detail, report-workspace, and export-preflight read models.
- Establish analytics-free usability baselines: task completion, error points, and time to reach core actions.

**Exit:** route/contract matrix approved; no proposed UI depends on fictional data.

### Phase FE-1 — Foundation and shell

- Build design tokens and shared primitives.
- Add AppShell, responsive navigation, project context nav, breadcrumbs, page headers, and permission-aware actions.
- Add loading/error/not-found/permission states and normalized API errors.
- Centralize icons, labels, status tones, dates, and common form controls.
- Refactor existing pages without changing domain behavior.

**Exit:** all existing portal pages use one accessible responsive shell in light/dark themes.

### Phase FE-2 — Onboarding and core setup

- Complete login/signup/forgot-password UX.
- Add resumable onboarding and setup checklist.
- Redesign project creation, template extraction review, and logframe/indicator setup.

**Exit:** a new admin can reach a reporting-ready project without external guidance.

### Phase FE-3 — Operational home and queues

- Add Home, My Work, deadline views, cross-project report/evidence/compliance queues, notifications, and URL filters.
- Replace inferred/vanity health with authoritative readiness and blocker summaries.
- Add project overview centered on the active reporting period.

**Exit:** each role can identify and open its highest-priority work within two interactions.

### Phase FE-4 — Field capture and evidence trust

- Deliver mobile activity capture, multi-file upload, evidence detail/preview, AI suggestion review, verification, comments, and history.
- Implement privacy-safe sensitive evidence states.

**Exit:** field evidence can move from upload to verified/source-linked status with a complete visible trail.

### Phase FE-5 — Reporting, compliance, and review

- Build the three-panel report editor, autosave/version feedback, job progress, source chips, unsupported-claim handling, and comments.
- Add contextual compliance fixes and lifecycle-based review/approval.

**Exit:** a grants officer can produce a source-linked draft and a manager can understand exactly why it is or is not approvable.

### Phase FE-6 — Export, administration, and polish

- Add export preflight/history, team/project assignments, settings, and audit explorer.
- Complete accessibility, responsive, low-bandwidth, performance, and cross-browser remediation.
- Add contextual help and first-use guidance.

**Exit:** approved output can be exported safely, found later, and traced to its version and evidence set.

---

## 18. Testing strategy

### 18.1 Automated

- Typecheck the web app and shared contracts.
- Unit-test label/tone mappings, readiness presentation, date urgency, permission presentation, filter serialization, and normalized errors.
- Component-test complex controls when the project test setup supports it.
- Playwright journeys:
  - signup/onboarding to first project;
  - create project/template/period;
  - upload and review evidence;
  - submit and review an activity update;
  - update and verify an indicator;
  - generate/edit/source-link a report section;
  - resolve checklist gaps;
  - request review/approve/export;
  - permission denial for every role boundary;
  - mobile field capture;
  - keyboard-only primary journey.

### 18.2 Manual

- Light/dark at representative widths.
- 200% zoom and reduced motion.
- Screen-reader smoke test.
- Slow network, failed API, interrupted upload, failed AI job, expired session, and partial dashboard data.
- Long project names, translated-like long labels, large counts, no data, and hundreds of records.
- Sensitive evidence access and export warnings.

### 18.3 Required commands

```bash
pnpm --filter @donordesk/web typecheck
pnpm --filter @donordesk/web build
pnpm --filter @donordesk/web test
pnpm -r typecheck
```

---

## 19. Definition of done

A frontend feature is complete only when:

- it advances a documented user journey;
- its actions are permission-aware and API-enforced;
- loading, empty, no-results, error, partial-data, and permission states are handled;
- mobile/tablet/desktop behavior is intentional;
- keyboard and screen-reader basics work;
- light and dark themes have usable contrast;
- AI involvement, source provenance, and human approval state are explicit;
- sensitive data is not exposed through summaries, previews, search, or exports;
- long-running work exposes progress/failure/retry;
- form/editor input survives recoverable errors;
- URL state makes relevant filtered views shareable;
- tests cover the primary success path and highest-risk failures;
- raw enums, fake metrics, silent zero fallbacks, and simulated-success controls are absent.

---

## 20. Product-level acceptance criteria

The completed portal should allow a pilot NGO user to:

1. create an organization and understand remaining setup;
2. create a project, reporting period, donor template, and logframe;
3. upload at least 20 evidence files and understand each processing state;
4. submit at least five mobile-friendly activity updates;
5. review AI suggestions instead of unknowingly accepting them;
6. update indicators and link verified supporting evidence;
7. generate and edit a source-linked donor report draft;
8. identify the exact gaps preventing approval;
9. assign, resolve, or formally accept applicable compliance risks;
10. complete role-based review and approval;
11. review sensitive-data/export warnings;
12. generate a controlled report and evidence pack and find it in export history;
13. inspect the audit trail explaining who changed, approved, or exported what;
14. complete their role's frequent tasks without training beyond short in-product guidance.

The intended user reaction remains the clearest success test:

> **“This tells me exactly what to do next and saves serious time before the donor deadline.”**
