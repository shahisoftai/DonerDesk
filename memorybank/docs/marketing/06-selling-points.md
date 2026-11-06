# DonorDesk selling points (40)

**Source:** every claim maps to a `LIVE` or `LIVE-LIMIT` row in [02-feature-inventory.md](02-feature-inventory.md), verified 2026-10-27. Keep the limits in the brackets when you use a claim. A claim not listed here is not a selling point until it is added to `02` first.

## Set up once
1. One project per grant, each with its own logframe, team and reports.
2. A setup wizard covers reporting profile, dates, funder, sector and team in one flow.
3. Copy a logframe and its indicators into a new grant. Only definitions copy, never values or people.
4. Upload a donor template once (Word, PDF, Excel). AI extracts sections, questions and word limits; you review them before use.
5. Import a logframe from Excel, CSV or text, with parent links and codes resolved automatically.
6. Indicators carry baseline, target, frequency, aggregation and direction, set once and reused across periods.

## Team and control
7. Seven roles, set per project, so each person sees what they need.
8. Unlimited viewers on Team and above, so board members and partners can read the record for free. [Viewer seats on Starter are limited to 2.]
9. A second-approver rule stops authors approving their own reports, unless you allow it.
10. Every change goes into a hash-chained audit log, so edits to history are detectable.
11. Approved reports can be reopened with a reason and approved again. Nothing changes silently.
12. Row-level database isolation keeps each organisation's data separate.
13. Compliance attestations, with bulk attestation limited to Admins and Project Managers.
14. Undoing an accepted activity is refused when an approved report already used it.

## Field capture
15. Record an activity by typing or dictating it: who, where, when, how many.
16. The reporting period comes from the activity date. A date no period covers is flagged, not guessed.
17. The narrative proposal fills empty fields only from what the words say. It never invents a detail.
18. Finished activities queue on the device and send when signal returns. [The app itself still needs a connection to open.]
19. A review queue to accept, request changes on, or bulk-review activity records.
20. Import a spreadsheet of activities. Rows without a code are reported, not dropped.
21. One activity record can cover a span of dates.
22. "My Work" shows what each person must do across all their projects.

## Indicators and data
23. One data sheet holds every period and indicator. Missing values stay blank, never zero.
24. The per-period grid suggests the previous value and running totals. Suggestions never overwrite what is typed.
25. Import with a preview. Empty cells never clear a stored value, and any bad row blocks the whole import.
26. Charts drawn from your data. Different units never share an axis, and rates stay out of progress charts.
27. Roll-up reports (semi-annual, annual, final) show life-of-project totals and percent of target.

## Evidence
28. An evidence library for documents and photos, up to 20 MB each.
29. Each file links to the activity or indicator it proves, in one place.
30. Text is read from Word, PDF, Excel and CSV, so drafts can cite the files. [Scanned PDFs need a text layer or text recognition.]
31. Files can stay in your own Google Drive. Linked files don't count toward storage.
32. An evidence ZIP for each report, with a README that names any file it could not include.

## Reporting
33. A compliance checklist built from your donor template: missing evidence, unverified figures, late activities.
34. Items the data settles close on their own. Items that need a person stay open until someone decides.
35. Readiness by stage (drafting, review, submission), with plain-language next steps.
36. A confidentiality gate blocks submission while a check is open or a restricted source is cited.
37. A closing-report plan shows what the final report still needs.
38. AI drafts each section to the donor's instructions, questions and word limits.
39. Every statement shows its source, and each factual claim is checked against evidence and your records.
40. AI cannot invent numbers. Unsupported figures are rejected; if a retry still fails, the section falls back to plain text and says why.

## Also usable (outside the 40)
- A contradiction check flags a figure that conflicts with itself elsewhere in a report.
- Export to Word, PDF, Excel, or evidence ZIP, with a watermarked internal review copy at any time.
- Planning and tracking: a work plan with On time / Late / Done, a My Week view, reminders at 07:00 in your time zone, and plan history with reasons. [Timeline is not offered on phones.]
- Portfolio view across grants, with delivery health and risks. [Health is a plain label, not a score.]
- Two-step sign-in (optional, per person). [Not available to outside partners.]
- Enterprise: SSO (OIDC) and SCIM provisioning, by contract. [Set up with support.]

## Do not claim
- Opening the app offline. Only queued activity saving works offline.
- Budget as a finance system. Budget lines are planning and expense tracking only.
- Encryption at rest, until `EVIDENCE_ENCRYPTION_KEYS` is confirmed in production.
- Certifications (ISO, SOC 2 or similar). None are held.
- Sending reports to donors. You submit the approved file yourself.
- A 20% threshold for an unexplained shortfall. It is not confirmed in code.
