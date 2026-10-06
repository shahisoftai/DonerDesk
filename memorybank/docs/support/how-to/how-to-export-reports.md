# How to Export Reports

Exports produce the files you send to the donor. They come from the approved report and go through the same quality gate as approval.

## Where to export

- From the report editor, click the primary button **Export report** (once the report is approved), or
- open the period's **Export Center** (⋯ menu → Export center) to see all exports and history.

## Export types

| Type | Format | Notes |
|---|---|---|
| Report | Word (DOCX) and PDF | Follows the donor template's structure and formatting. Includes charts, tables and figures. |
| Indicator table | Excel | All indicators with values for the period. For **final, annual and semi-annual** reports it also shows **This period**, **Life of project to date** and **% of target**, so the file matches the report's own table. A value that was never recorded is left empty, not shown as 0. |
| Evidence checklist | Excel/document | Every checklist item and its status. |
| Evidence pack | ZIP | Report, indicator table, checklist and selected evidence files in a numbered folder structure. For final, annual and semi-annual reports it offers **all of the project's evidence**; for others, the files of the period and its activities. The ticks in the wizard start with the files the report cites, so tick the others you want in the ZIP. Sensitive files are left out unless you include them. |

If the donor supplied a Word template, the report can be rendered into it (donor-native rendering); otherwise a standard DonorDesk layout is used.

## Which copy do you get?

Once the report is **Approved** with no open issues, the first step of the wizard asks **Copy**: **Final copy for the donor** (the default; it seals this version and carries no internal-review mark) or **Internal copy** (watermarked, never for the donor). A report with open issues can only be downloaded as the watermarked internal copy. If sealing fails, the wizard shows the reason; fix it or choose the internal copy.

## Two kinds of export

- **Internal copy** – watermarked, for review and circulation inside your team.
- **Donor submission** – bound to a sealed snapshot of the approved report. Only available when the gate passes.

## The export wizard and the gate

1. Click **Export report**. The wizard runs a **preflight** check.
   The wizard shows **Checked at hh:mm** with a **Re-check** link. The checks are read from the report as it is now; if you fixed something in another tab, click **Re-check**.
2. If something blocks the export you see **Export is blocked** with an expandable list. Typical items:
   - Unsupported material claims
   - Numeric contradictions
   - Stale verifications
   - Evidence hash mismatches
   - Confidentiality violations (confidential/highly sensitive sources)
   - Unsatisfied donor requirements
   - Assertion coverage gaps
3. Each item links to where you fix it. You can also resolve some inline: **Exclude claim**, or **Accept with limitation** with a reason. Confidential sources need an Admin or Grants Officer override.
4. Choose the export type and confirm. A notification tells you when it is ready (**Export**).

Statements you **left out** are omitted from the files.

## What the file name tells you

A Word or PDF file ends in **-final** when it is the sealed donor copy and **-internal** when it carries the internal-review watermark (for example `…-v3-internal.docx`). An approved report exported for review is never called a draft.

## If the donor copy cannot be sealed

The message lists the reasons in words, for example "The donor copy cannot be sealed yet: 2 statements still need a decision." Requirements the donor sets are worked out automatically when you seal, so you no longer need to do that first. Fix the listed items, then try again.

## Download and history

Each export is stored with its type, who ran it, when, the report version and the files included. Find it in the Export Center and download it again at any time.

## Tips

- Verify indicator data and evidence first; that removes most blockers.
- If donor-template rendering fails, check that the template is **Reviewed** (see [How to upload a donor template](/support/how-to/upload-donor-template)).
- See [Troubleshooting export issues](/support/troubleshooting/export-issues).
