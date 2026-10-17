# DonorDesk Feature Inventory (verified against code, October 2026)

**Purpose:** the single factual base for every marketing asset (website, deck, support articles, sales
conversations). Each capability is listed with what it does, who uses it, where it lives in the code, and
its status. A claim that is not in this file should not be made publicly until it is added here and verified.

**Status key:** `LIVE` = built and in production. `LIVE-LIMIT` = built, with a limit that must be stated.
`CONTRACT` = available for Enterprise through configuration or contract, not self-serve. `NOT BUILT` = do not claim.

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

## 15. Billing

| Capability | What it does | Status |
|---|---|---|
| Plans | Starter (free), Team ($79/month), Growth ($149/month), Enterprise (contract). Annual billing is two months free. | LIVE |
| Verified nonprofit discount | 25% off Team and Growth in the first year, after verification. | LIVE |
| Top-up packs | +50 drafts for $79 (Team); +100 for $149 (Growth), plus a prepaid standing balance on Growth. | LIVE |
| Trials | 14-day trials on paid plans. | LIVE-LIMIT (shown only when the trial flag is on) |

---

## Not built, and must not be claimed

- A full offline app (opening DonorDesk with no connection). Only queued activity saving works offline.
- Assigned attestations in My Work.
- Server-side readiness history over time.
- Saving a Data Center chart spec for reuse (charts are drawn from the data each time).
- Direct submission or sending of reports to donors (donor portal signed links exist in code but are not wired to any route).
- Certifications (ISO, SOC 2, or similar). None are held; do not state or imply one.
- Customer logos and named case studies. None are approved for publication yet (see the plan).

## Source

Derived from `memorybank/Features/` (01–22), `memorybank/Fixes.md`, `AGENTS.md` (invariants by version) and the
portal routes under `apps/web/src/app/(portal)/`. Re-verify this file before each major release.
