# DonorDesk Feature Inventory (verified against code, October 2026)

**Purpose:** the single factual base for every marketing asset (website, deck, support articles, sales
conversations). Each capability is listed with what it does, who uses it, where it lives in the code, and
its status. A claim that is not in this file should not be made publicly until it is added here and verified.

**Status key:** `LIVE` = built, deployed and checked in a browser on the live site. `LIVE-LIMIT` = live, with a limit that must be stated. `CONTRACT` = available for Enterprise through configuration or contract, not self-serve. `NOT BUILT` = do not claim. `BUILT-NOT-LIVE` = built and tested, but not yet checked in a browser on the live site (whether or not it is deployed): **do not claim it publicly yet**. A row moves to `LIVE` when its browser check is recorded in `memorybank/docs/marketing/phase28-publish-pack.md` or a demo verification note.
`CONTRACT` = available for Enterprise through configuration or contract, not self-serve. `NOT BUILT` = do not claim. `BUILT-NOT-LIVE` = built and tested but not deployed or checked in a browser: **do not claim it publicly yet** (it moves to `LIVE` when deployed and verified).

---

## 1. Projects and setup

| Capability | What it does | Who uses it | Where | Status |
|---|---|---|---|---|
| Project creation wizard | Creates a project with its reporting profile, dates, funder, sector and team. Sector and country are suggested and stay editable. | Project Manager, Admin | `apps/web/src/features/projects`, `apps/web/src/features/onboarding` | LIVE |
| Copy setup from another project | Copies logframe and indicator definitions only (never values, evidence, activities, archived indicators or people) into an empty project. | Project Manager | `CopyProjectSetupHandler`, `planLogframeCopy` | LIVE |
| Multiple donors | One project per grant; templates reused across projects; cross-project My Work and Data Center views. | Grants Officer | `support/advanced-features/multiple-donors` | LIVE |
| Archive and restore | Completed projects stay readable, searchable and exportable; they do not count against the active-project limit. | Admin, Project Manager | `how-to-archive-a-project` | LIVE |
| Demo project (Academy) | A pre-built sample project for learning. Uses no AI credits and does not count toward the project limit. | Everyone, on first sign-in | `apps/web/src/features/tour`, Academy docs | LIVE |

## 2. Team, roles and approval

| Capability | What it does | Status |
|---|---|---|
| Seven roles | Admin, Project Manager, M&E Officer, Grants Officer, Field Officer, Compliance Officer, Viewer. Role is set per project. | LIVE (`packages/domain/src/contexts/identity/role.ts`) |
| Seats | Full seats (every role except Viewer): Starter 1, Team 5, Growth 15, Enterprise contracted. Viewer seats: Starter 2, Team and above unlimited. | LIVE |
| Invitations | Invite by email; invited and suspended members count as seats. | LIVE |
| Second-approver rule | A project can require a second approver; the author cannot approve their own report unless the rule allows it, and self sign-off is audited. | LIVE (`checkApprover`) |
| Attestations | Compliance items a person must attest to; bulk attestation is limited to Admin and Project Manager. | LIVE |
| SSO (OIDC) and SCIM | Single sign-on through an OIDC provider and user provisioning through SCIM 2.0. | CONTRACT (Enterprise, set up with support) |

## 3. Logframe and indicators (the management core)

| Capability | What it does | Status |
|---|---|---|
| Logframe hierarchy | Goal, outcome, output and activity levels, with parent links. | LIVE |
| Logframe import | Imports an Excel, CSV or text logframe and resolves parents and codes automatically. | LIVE |
| Indicators | Baseline, target, frequency, aggregation (sum, latest, rate), disaggregation, and direction (higher or lower is better). | LIVE |
| Per-period data grid | One grid per reporting period; suggests the previous period's value and a running total for sum indicators. Suggestions never overwrite a typed value. | LIVE |
| Indicator changes | Indicators are archived, not deleted, once values exist. Moving or removing one is refused when an approved report used it. | LIVE |
| Google Sheets import | Imports indicator data from a Google Sheet. | LIVE |

## 4. Activities and field capture

| Capability | What it does | Status |
|---|---|---|
| Activity records | Date, place, participants (with disaggregation), narrative, and link to an output or logframe activity. A record can cover a date span. | LIVE |
| Period from date | The reporting period is derived from the activity date; a date that no period covers is flagged, not guessed. | LIVE |
| Dictation | Speak the narrative with the microphone button (browser speech recognition). | LIVE-LIMIT (Chrome, Edge, Safari; the browser's own recognition) |
| Narrative proposal | Fills empty fields (date, place, people) only from what the words state. Never invents a detail. | LIVE |
| Photo capture | Attach photos from a phone. | LIVE-LIMIT (see the offline article for what works without signal) |
| Offline queue | A finished activity is kept on the device and sent when the connection returns. Drafts are saved as you type. | LIVE-LIMIT: queued saving only. The app cannot be opened offline; the service worker is not built. |
| Status workflow | Draft → Submitted → Accepted, or Needs revision, Rejected, Withdrawn. Undoing an accepted activity is refused when an approved report used it. | LIVE |
| Bulk review | Accept or request changes on many activities at once. | LIVE |
| Activity import | Imports a spreadsheet of activities; rows without a code are reported, never silently dropped. | LIVE |

## 5. Data Center

| Capability | What it does | Status |
|---|---|---|
| One data sheet | Every non-cancelled period, every live indicator and every recorded value in one view, by period or as a list. | LIVE (`GET /v1/projects/:id/data-sheet`) |
| Download | Excel or CSV. A missing value is blank, never zero. | LIVE |
| Import with preview | Upload the edited sheet; see every change before it applies. Empty cells never clear a stored value. Any row with a problem blocks the whole import. Imported values arrive as drafts. | LIVE |
| Charts | Charts drawn from the data (by indicator, by period, against target). Different units never share an axis; rates are kept out of progress charts. | LIVE |
| Insert into a report | A chart or table from the Data Center goes into a report section as a snapshot. | LIVE-LIMIT (a snapshot: it does not update when data changes; Update redraws it) |
| Finance figures | Expenditure and balance per period, shown only when finance mode is on. | LIVE-LIMIT (finance is off by default; only verified figures reach a report) |

## 6. Evidence library

| Capability | What it does | Status |
|---|---|---|
| Uploads | Documents and photos up to 20 MB each, within the plan's managed storage. | LIVE |
| Google Drive link-first | Files can stay in the organisation's own Google Drive. Linked files do not count toward storage. | LIVE |
| Cloudflare R2 uploads | Managed uploads for organisations that do not use Drive. | LIVE (managed storage) |
| Source fingerprint | The text a draft cites is fingerprinted (SHA-256) when the draft is built, so a change to the source after drafting can be detected. Files are not checksummed at upload. | LIVE-LIMIT (say "source fingerprint", never "checksum on every file") |
| Text extraction | Text is read from Word, PDF, Excel, CSV, text and Markdown files so drafts can cite them. | LIVE-LIMIT (scanned PDFs need text to be readable) |
| AI tag suggestions | Suggests tags for a file; a person confirms them. | LIVE |
| Verification | Each file and indicator update has a verification state. A linker attaches a file to an activity or indicator in one place. | LIVE |
| Evidence pack export | A ZIP of the files behind a report, with a README. Files that cannot be included (Drive-only or unreadable) are named in the README. 150 MB cap. | LIVE-LIMIT |

## 7. Compliance and readiness

| Capability | What it does | Status |
|---|---|---|
| Compliance checklist | Items come from the donor template and the requirement packs: missing evidence, unverified indicators, late activities, open confidentiality checks. | LIVE |
| Automatic closing | Items that data settles (for example, a verified procurement document) close by themselves. Items that need a person stay open until a person decides. | LIVE |
| Readiness score | Reported by stage: drafting, review, and submission. Each blocker has plain-language advice and an action. | LIVE |
| Confidentiality gate | Blocks submission while a confidentiality check is open or a restricted source is cited. | LIVE |
| Closing report plan | Lists what the final report needs and what is still missing. | LIVE |

## 8. Donor templates

| Capability | What it does | Status |
|---|---|---|
| Template upload | Word, PDF, text, Markdown, Excel and CSV. | LIVE |
| Extraction | Builds the report outline, instructions, mandatory questions, evidence needed, required tables and page limits. | LIVE (AI extraction, with a heuristic fallback that is flagged) |
| Review and approval | The extracted template is reviewed and approved before any draft uses it. Every edit is saved as a version. | LIVE |
| Defaults | One default template per report type. Uploading or approving a template never changes a default. | LIVE |

## 9. Reporting periods

| Capability | What it does | Status |
|---|---|---|
| Period types | Monthly, quarterly, semi-annual, annual, final and custom. | LIVE |
| Roll-up reports | Semi-annual, annual and final reports show life-of-project totals and percent of target. A final report is the closing period. | LIVE |
| Comparisons | A report is compared only with reports of its own type. | LIVE |
| Cancel and restore | A period can be cancelled and restored; cancelled periods disappear from calendars and comparisons. | LIVE |
| Reopen after approval | An approved, exported or submitted report can be reopened (with a reason) for changes, then approved again. | LIVE |

## 10. AI report drafting and checking

| Capability | What it does | Status |
|---|---|---|
| Section drafts | Each section follows the approved donor template: its instructions, questions, evidence and word limit. | LIVE |
| Sources | Each statement shows where it came from (evidence, activity record, indicator value or story input). | LIVE |
| Numbers | Tables, charts and comparisons are built from verified data, not written by the AI. Any figure in the text that is not in the inputs is rejected and regenerated. If it still fails, the section falls back to deterministic text and says why. | LIVE |
| Claim checking | Each factual claim is checked against evidence and the project's own records. | LIVE |
| Contradiction check | Flags a figure that conflicts with the same figure elsewhere in the report. | LIVE |
| Story inputs | The user adds context the numbers cannot give (achievements, challenges, variance, lessons). | LIVE |
| Writing style | An optional team writing style. It shapes tone only, never facts or numbers. | LIVE |
| Credits | Successful drafts count against the plan. Failed or timed-out generations are not billed. Manual writing never uses credits. | LIVE |
| Own AI provider | Growth and Enterprise can connect their own provider keys; drafts then use zero DonorDesk credits. | LIVE-LIMIT (set up with support) |
| Human approval | Nothing is final until a person approves it. | LIVE |

## 11. Report editor

| Capability | What it does | Status |
|---|---|---|
| Document-style editing | Headings, lists, quotes, tables, bold, italics, code, links. | LIVE |
| Statement flags | Statements that need a decision are flagged in the side panel with a reason. | LIVE |
| Comments | Comments on report sections, with notifications. | LIVE |
| Version history | Changes are tracked per section. | LIVE |
| Tables and charts | Insert a table or chart from the Data Center. | LIVE |

## 12. Review, approval and export

| Capability | What it does | Status |
|---|---|---|
| Statuses | Draft, In review, Approved, Submitted. Period status moves with the report. | LIVE |
| Approval gates | The same gate decides approval, preflight, submission and export. | LIVE |
| Watermarked internal copy | Any draft can be exported as an internal review copy, watermarked on every page. | LIVE |
| Donor submission | Needs a clean, sealed report. The sealed snapshot is what is submitted. | LIVE |
| Formats | Word (DOCX), PDF, Excel (indicator tables and the data sheet), ZIP (evidence packs). | LIVE |
| Donor-template layout | Word output follows the donor template's structure. | LIVE-LIMIT (donor-template Word export draws no charts) |
| Direct submission to donors | DonorDesk does not send reports to donors. The user uploads the approved file. | NOT A FEATURE (by design) |

## 13. Dashboard, My Work and notifications

| Capability | What it does | Status |
|---|---|---|
| Home dashboard | What needs attention, deadlines (with a three-day band), readiness per project, recent projects. | LIVE |
| My Work | One queue across all projects: reports, checklist items, evidence, activities, notifications. Filter by type. | LIVE |
| Notifications | In-app notifications for reviews, comments and approvals. | LIVE |

## 14. Audit, security and privacy

| Capability | What it does | Status |
|---|---|---|
| Audit log | Every change is recorded in a hash-chained log, so later edits to history are detectable. | LIVE |
| Tenant isolation | Row-level security in the database keeps each organisation's data separate. | LIVE |
| AI traceability | Each AI output stores the model, prompt version and sources. | LIVE |
| Roles | Least-privilege, per-project roles. | LIVE |
| Legal pages | Privacy, terms, cookies, DPA, subprocessors, acceptable use, refunds, security page. | LIVE |
| Two-step sign-in | Optional, per person: an authenticator-app code after the password, with eight single-use recovery codes. Turned off with the password and a current code. Hidden for single-sign-on organisations. | BUILT-NOT-LIVE (no MFA for outside partners; not enforced by the organisation) |
| Password and sign-in rules | 12+ character passwords; sign-in pauses for 15 minutes after five wrong passwords; an unknown address gets the same answer as a wrong password. | BUILT-NOT-LIVE |
| Access by project | A non-administrator sees a project only when they are on it. A removed or suspended person loses access on their next request. | BUILT-NOT-LIVE |
| Organisation export | A ZIP of the organisation's own data (projects, indicators, records, reports and their audit trail). Secrets are never included. Administrators only. | BUILT-NOT-LIVE |
| Audit chain check | The audit log is checked on a schedule; a broken chain is reported, not hidden. Changes to the log are blocked by the database role. | BUILT-NOT-LIVE (operator-run; not visible to users) |

## 15. Billing

| Capability | What it does | Status |
|---|---|---|
| Plans | Starter (free), Team ($79/month), Growth ($149/month), Enterprise (contract). Annual billing is two months free. | LIVE |
| Verified nonprofit discount | 25% off Team and Growth in the first year, after verification. | LIVE |
| Top-up packs | +50 drafts for $79 (Team); +100 for $149 (Growth), plus a prepaid standing balance on Growth. | LIVE |
| Trials | 14-day trials on paid plans. | LIVE-LIMIT (shown only when the trial flag is on) |

## 16. Work plan (Phase 28, Batches 28.0–28.2; deployed 2026-10-18)

The status here follows the browser checks recorded in `phase28-publish-pack.md` (§1, run 2026-10-21 on the demo tenant).

| Capability | What it does | Status |
|---|---|---|
| Planned activities | Work planned ahead, with dates, a lead, an optional place, people expected and number of sessions. One date makes a milestone. Sits inside the Activities tab (Planned / Completed). | LIVE (checked: plan list and wizard) |
| Start from my logframe | Three steps (which activities, when, who leads); nothing is saved until the end; refused when a plan already exists. Dates are proposed. | LIVE (checked) |
| On time / Late / Done | One signal per planned activity, worked out from its dates and the completed activities linked to it, with the reason in words. | LIVE (checked: "Late", "Done") |
| Overview cards | How many planned activities are done, late and starting soon; per output, done of planned beside the indicator's % of target. | LIVE (checked: "Behind 1 of 6") |
| Mark done | Recording a finished activity also moves its plan item to Done. The reporting period must cover the date. | LIVE (checked) |
| Import a plan | Upload, paste or dictate a sheet; any row that cannot be read stops the import and is named. | BUILT-NOT-LIVE |
| Repeating activities | Weekly or monthly until a date; each one is its own row that can be moved, led or cancelled. | BUILT-NOT-LIVE |
| Timeline | Bars by output, report deadlines on top, today line, original dates shown when moved, drag to reschedule with a Save / Undo bar, keyboard alternative. Not offered on phones (the List is). | BUILT-NOT-LIVE (renders; drag not yet checked) |
| My week | A field officer's landing: late, this week, next week; list, week or month; activities sent back to fix. Status changes made offline are sent when the connection returns. | BUILT-NOT-LIVE |
| Plan history | Every change is kept with its reason ("moved from 12 Mar: floods"). | BUILT-NOT-LIVE |
| Link a completed activity to the plan | Picker with up to three suggestions and why; fills empty fields, never overwrites. | BUILT-NOT-LIVE |
| Copy plan with setup | Optional when copying a project's setup; dates move with the new project's start; leads and progress are not copied. | BUILT-NOT-LIVE |
| Show work planning | Admin setting; off hides the screens and keeps the data. | BUILT-NOT-LIVE |

**Limits to state:** DonorDesk records, plans and evidences delivery. Leads are shown by name only.

## 17. Programme management (Phase 28, Batches 28.3–28.9; deployed 2026-10-18)

| Capability | What it does | Status |
|---|---|---|
| Who does what | One list of everything that is yours, by due day. Ask someone for a completed activity, an indicator value or a file. Leads on indicators, reports and checklist items. A Team tab per project. | BUILT-NOT-LIVE |
| Requests | A request to one person, with a due day, closed when the work is done (not by a button where data can say so). | BUILT-NOT-LIVE (not checked with a team member) |
| Delivery health | Three plain labels for a project: On track, Needs attention, Behind. Worked out from late plan items and overdue indicator values. Shown on the project Overview, Home and the portfolio. | BUILT-NOT-LIVE |
| Reminders | One morning summary per person in the organisation's own 07:00 hour; one escalation after 7 days late; an email setting per person (always, urgent only, never). | BUILT-NOT-LIVE (summary email not yet seen arriving) |
| Files the work needs | Suggested kinds of file per planned activity; "Still needed" on the activity; one question when accepting without them. Suggestions never block. | BUILT-NOT-LIVE |
| Problems and risks | A four-field form (what happened, how serious, what we are doing, who) and a short list on the Overview. Reviewed every 30 days; closed with how it ended. **Risks never reach the AI writer.** | LIVE (checked 2026-10-21: raised, shown, closed) |
| Comments on work | "Add a comment" on a planned activity, a completed activity, an indicator, a problem or a risk; the people who own the thing are told. | BUILT-NOT-LIVE |
| Reports read the plan | The writer is told how many activities were planned and held in the period, and the officer's recorded reasons. Claims restating that are checked. "Suggested from your plan" fills empty fields in *Tell the story*. | BUILT-NOT-LIVE ("Suggested from your plan" not yet checked) |

## 18. Gap-closure features (Phase 28.1, Version 2.006)

| Capability | What it does | Status |
|---|---|---|
| Comes-after links | Set which activities must finish first; moving one pushes the ones that wait for it and says which it could not move. | BUILT-NOT-LIVE |
| Progress log | Record what was reached by day, week or month, then the activity end. Blank stays blank. | BUILT-NOT-LIVE |
| Done in one step | Pick the day and people reached; the completed activity and the plan status are saved together. | BUILT-NOT-LIVE |
| Custom fields | A project's own text, number, date or choice fields on each planned activity. | BUILT-NOT-LIVE |
| Budget lines | Budget lines per activity, expenses against them, overspend flagged (never blocked). | BUILT-NOT-LIVE. Do not describe as a finance system. |
| People reached | Case-code register (no names), duplicates caught, Kobo / ODK CSV import, at `/projects/:id/beneficiaries`. | BUILT-NOT-LIVE |
| Workload | Open activities each person leads, per week, against an optional limit. | BUILT-NOT-LIVE |
| Automatic reminders | Two rules, each on or off per project. | BUILT-NOT-LIVE |
| Bulk change | Move, set the lead, start or cancel many activities, previewed first. | BUILT-NOT-LIVE |
| Roll-up across projects | Verified indicator values added up per donor and code across the projects you can see (`/portfolio/indicators`). | BUILT-NOT-LIVE |
| Targets by group | A target per group; the report table shows each group's target beside its recorded figure. A group nobody reported is "Not measured", never 0. | BUILT-NOT-LIVE |
| Offline shell | The app shell and an offline page only. **No project data is stored on the device.** | LIVE-LIMIT (the offline activity queue is the only offline saving; opening the app offline is not built) |

## 19. Programmes, grants, framework and partners (batch 3; deployed 2026-10-20)

| Capability | What it does | Status |
|---|---|---|
| Programmes and grants | A programme groups related awards and projects; a grant is one award (donor, award number, amount, currency, dates). Totals per programme and grant, kept by currency. Administrators only. | BUILT-NOT-LIVE |
| Framework history | Every change to outputs, indicators, targets and definitions is kept as a version, read as a sentence ("target changed from 100 to 120"). A manager can sign off the framework as it stands. | LIVE (checked 2026-10-21: version saved, sign-off) — the "target changed from X to Y" line not yet checked |
| Approved report notes the framework | An approved report records which framework version it was approved against. | BUILT-NOT-LIVE |
| Outside partners | Invite someone from another organisation as a **field officer or viewer**, to the projects you choose. They see only those projects and only the screens a partner needs. | BUILT-NOT-LIVE (invitation and first screens not yet checked; the web menu still shows items a partner cannot open) |
| Donor requirements | Required annexes of a reviewed donor template must appear in the report; a missing one blocks approval and says which. Administrators can list a donor's requirements as a pack. | BUILT-NOT-LIVE |
| Result to explain | On a closing report, an indicator far below target (more than 20% unfavourably) raises a checklist item until the story explains it. | BUILT-NOT-LIVE |
| Report locks | Approved, submitted and closed figures cannot change. A correction goes through reopening, with a reason. | BUILT-NOT-LIVE |
| Target schedule and variance | An indicator can carry a cumulative target due by a date; a period is judged against the latest target due by its end, and the variance is shown absolute and as a share. | BUILT-NOT-LIVE |
| Portfolio dashboard | Every live project you can see, one row each: delivery standing, open problems and risks, next report. Totals of projects behind, needing attention, open and serious risks, reports overdue. | BUILT-NOT-LIVE |
| Counted elsewhere | An indicator marked "another project also counts these" is listed, never added. A possible double count (same country, overlapping dates) is named in a note, never changes a total. | BUILT-NOT-LIVE |
| Donor indicator mapping | Match a donor's requirement to one of your indicators: Matched, Please confirm, No match yet, or Will not be reported. Automatic matches are not stored; only people's decisions are. | BUILT-NOT-LIVE |
| Management report | One page per project for a manager: delivery, indicators with % of target and variance, reports and deadlines, problems and risks, evidence counts. "Not measured" is never 0. | BUILT-NOT-LIVE |
| Changes of plan | A dated record of a change of plan (what changed, why, what effect on results). It is read by the claim checker, never sent to the writer. | BUILT-NOT-LIVE |
| Comment threads | Replies on a report statement, one level deep; a thread can be resolved and reopened. | BUILT-NOT-LIVE |
| Evidence review | Verify, ask for a correction, reject, archive or bring back. A correction or rejection needs a reason. Reject and archive are refused while an approved, exported or submitted report cites the file. | BUILT-NOT-LIVE |
| Evidence filters | Filter the library by verification state and the other evidence fields. | BUILT-NOT-LIVE |
| Scanned documents | A scanned PDF or a photographed page is read by text recognition when there is no text layer, with a note to check names and numbers against the original. | BUILT-NOT-LIVE (text recognition must be installed on the worker; check before claiming) |
| Encryption at rest | Code is shipped but **off** in production. | NOT BUILT (do not claim until switched on) |
| AI usage and estimated cost | Each AI call's estimated cost in US dollars, and the month's estimate, on the AI usage page. The built-in price is an estimate. | LIVE-LIMIT (estimate only; not a bill) |
| Organisation export | See section 14. | BUILT-NOT-LIVE |
| Demo project | The guided tour's demo project now arrives with a first quarter to report on. | LIVE-LIMIT (demo data only) |

---

## Not built, and must not be claimed

- A full offline app (opening DonorDesk with no connection). Only queued activity saving works offline.
- Budget as a finance system: budget lines exist per activity, but there is no ledger, payments or donor-finance reconciliation.
- Multi-factor sign-in for outside partners, and an organisation-wide requirement for two-step sign-in.
- Enforced encryption at rest (code exists; off in production).
- Assigned attestations in My Work.
- Server-side readiness history over time.
- Saving a Data Center chart spec for reuse (charts are drawn from the data each time).
- Direct submission or sending of reports to donors. Donor-portal signed links exist in code but are not wired to a route.
- Certifications (ISO, SOC 2, or similar). None are held; do not state or imply one.
- Customer logos and named case studies. None are approved for publication yet.
- Email delivery of reminders is not yet confirmed on the live site; state reminders only once seen arriving.

## Source

Derived from `memorybank/Features/` (01–42), `memorybank/Fixes.md`, `AGENTS.md` (invariants by version) and the
portal routes under `apps/web/src/app/(portal)/`. Re-verify this file before each major release.
