# Positioning and Messaging

**Status:** Approved direction, October 2026. Copy below is the source for the website, deck and sales
one-pagers. Every factual line must trace to `02-feature-inventory.md`.

---

## 1. Positioning in one paragraph

DonorDesk is where a grant-funded programme is **run**: its logframe, indicators, activities, evidence and
compliance live in one place, with the people who do the work. Donor reports come out of that record, checked
against it and approved by a person before they go anywhere. Teams stop rebuilding the same numbers from
spreadsheets, emails and folders every quarter.

## 2. The category we own

Not "AI report writer." Not "grant database." The category is:

> **Programme management that produces donor-ready reports.**

Reporting is the moment a buyer feels the pain, and the reason they sign up. Management is the reason they stay.

## 3. Taglines (choose per channel)

| Use | Tagline |
|---|---|
| Primary (site hero, deck title) | **Run your programme. Report from the record.** |
| Secondary | Your programme, always report-ready. |
| Team and operations audience | One record for the work, the evidence and the donor report. |
| Short (ads, social) | Manage the grant. Report on it. |
| Avoid | "AI writes your reports" (overclaims; humans approve every output), "never miss a deadline" (a promise we cannot keep), "the #1 platform" (no evidence). |

## 4. Four pillars

Every page and slide sits under one of these. Order matters: the first two come before reporting.

1. **Run the programme.** Logframe, indicators, activities, team and a personal work queue. The work is tracked as it happens.
2. **Keep the evidence.** Files stay in the organisation's own Drive or in managed storage, with checksums, verification and an audit log.
3. **Stay compliant.** The donor's requirements become a live checklist. Gaps are visible weeks before a deadline, not on the day.
4. **Report from the record.** Donor templates are structured into sections. Drafts cite their sources. Numbers come from verified data. A person approves.

## 5. Core message blocks

### The problem (what buyers recognise)

- Indicators sit in one spreadsheet, activities in another, evidence in folders and chat threads.
- The report is assembled in the last two weeks before the deadline, from numbers nobody can trace.
- Compliance gaps (a missing document, an unverified figure) surface at submission, when there is no time to fix them.
- Every donor wants the same facts in a different template, so the work is repeated.

### The shift (what changes)

- Activities are recorded when they happen, from a phone, by the person who did the work.
- Indicator values are entered once per period and reused in every report.
- The donor's template is loaded once and reused across the grants that share it.
- Gaps show on a live checklist, with the action needed.

### The proof (what we can say today)

- Seven roles, so field staff, compliance, M&E and approvers each see what they need.
- Every number in a draft comes from verified data; a figure not in the inputs is rejected.
- Every statement shows its sources; every AI output stores its model and prompt version.
- Every change is recorded in a hash-chained audit log.
- Export to Word, PDF, Excel and ZIP evidence packs, with an internal watermarked copy for review.

## 6. Message by audience

| Audience | Their pain | Our message | Lead feature |
|---|---|---|---|
| **M&E Officer** (champion) | Indicators and reports are rebuilt by hand each period | Enter each value once; every report and chart reads from the same data | Data Center, indicator grid |
| **Grants Officer** (budget owner, deadlines) | Late, untraceable reports and surprise compliance gaps | See readiness and blockers weeks before the deadline, and what closes each one | Compliance checklist, readiness |
| **Project Manager** | Activity records are late, incomplete or in chat | Field staff record activities on the phone as they happen; you review and accept them in one place | Activity capture, bulk review |
| **Field Officer** (daily user) | Reporting is paperwork after the real work | Record what happened in a few lines or by dictation; the form fills what your words state | Dictation, offline queue |
| **Compliance Officer** | Cannot prove what a report claims | Every claim links to its evidence; the audit log shows who changed what | Claim check, audit log |
| **Country Director / approver** | Sees a finished report with no way to check it | Approval waits for a second approver when the project requires one; the submitted file is sealed | Approval rules, sealed snapshot |
| **Donor-facing partner** (INGO hub, consortium lead) | Partners report in different formats | Load each donor's template once; drafts follow it | Donor templates |

## 7. Objections and answers

| Objection | Answer (true today) |
|---|---|
| "We already use Excel / ActivityInfo / Kobo." | DonorDesk does not replace your data collection tools. It holds the programme record your reports are built from, and it imports from Excel, CSV and Google Sheets. |
| "Will the AI invent numbers?" | No. Tables, charts and comparisons come from verified data. A figure in the text that is not in the inputs is rejected, regenerated, and if it still fails the section falls back to plain text that says why. A person approves every section. |
| "Who owns our data?" | You do. Evidence can stay in your own Google Drive; linked files do not count toward storage. Tenant data is isolated in the database. |
| "Can we work without internet?" | Activities are saved on the device and sent when you are back online. The app itself needs a connection to open. Say this plainly. |
| "Is this secure enough for sensitive beneficiary data?" | Tenant isolation, role-based access, hash-chained audit log, and a DPA and subprocessor list are published. We do not hold external certifications; do not ask us to claim one. |
| "We have no budget." | Starter is free: one project, one full seat, two viewers, five AI drafts a month. A verified nonprofit gets 25% off Team and Growth in year one. |
| "Our donor has a specific template." | Upload it. DonorDesk extracts the outline, instructions and required tables; you review and approve them before any draft uses them. |
| "Is it just another reporting tool?" | No. The logframe, activities, evidence and compliance are the working system. Reports are what that system produces. |

## 8. Words to use and words to avoid

| Use | Avoid |
|---|---|
| programme, grant, donor, funder | client, customer (except in contracts) |
| record, evidence, verified | "source of truth" (jargon), "single pane of glass" |
| approve, review, sign off | "auto-submit", "generate and send" (we do not send to donors) |
| draft, sourced, checked | "AI-written", "magic", "effortless" |
| report-ready, audit-ready | "bulletproof", "guaranteed compliant" |

## 9. Claims policy

- Only claim what `02-feature-inventory.md` marks `LIVE`, and state every `LIVE-LIMIT` limit beside it.
- No testimonials, logos or case studies until the customer has approved the exact wording in writing.
- No certifications, uptime numbers or security audits that are not documented.
- Pricing shown must match `packages/domain/src/contexts/billing/plan.ts`. The pricing page and home page read from the same figures.
- Demo data (the Academy project, the sample dashboard) must be labelled as sample.
