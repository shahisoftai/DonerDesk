# Common Messages and What to Do

**DonorDesk Version 2.001**

DonorDesk explains problems in plain language on the page. This guide lists the messages you are most likely to see.

## Sign-in and access

| Message | What to do |
|---|---|
| Invalid credentials | Check email and password or use **Forgot password**. |
| Google Sign-In failed. Please try again… | Retry or use email and password. |
| The sign-in link expired. | Start sign-in again. |
| This reset link is invalid or has expired | Request a new reset link (they last 60 minutes). |
| Invitation expired / invalid | Ask your Admin for a new invitation. |
| Role … lacks permission … / You do not have permission… | Ask an Admin for the right role ([roles](/support/getting-started/user-roles-and-permissions)). |

## Plan limits

| Message | What to do |
|---|---|
| You are over one or more plan limits. Reading, exporting, and deleting still work… | Free capacity or upgrade ([plans](/support/account-billing/plans-and-limits)). |

## Project setup blockers

Shown on the project's **Setup** page with a **Fix** link.

| Code | Meaning |
|---|---|
| WORKSPACE_PENDING | Google Drive folders are still being created. Retry or repair the workspace. |
| REPORTING_PROFILE_MISSING | Create the reporting profile. |
| TEMPLATE_HAS_NO_REVIEWED_REQUIRED_SECTIONS | Approve the donor template. |
| NO_REPORTABLE_INDICATORS | Add at least one indicator. |
| INDICATOR_CONFIGURATION_INCOMPLETE | Add baseline, target, unit and frequency. |

## AI drafting

See the table in [Troubleshooting AI report generation](/support/troubleshooting/ai-report-generation) ("a basic version was used…").

## Statement checks in reports

| Reason shown | Meaning |
|---|---|
| The number does not match the evidence | Use the evidence value or edit. |
| The evidence file changed after it was checked | Verify the file again. |
| The evidence has not been verified yet | Verify the evidence. |
| The evidence is confidential | Confirm sharing or remove the claim. |
| The figure is from a different period | Check the reporting period. |
| The evidence only partly supports this statement | Edit or keep with a note. |
| It claims a cause and effect that needs a human check | Review it yourself. |

## Export blockers

See [Troubleshooting export issues](/support/troubleshooting/export-issues).

## Data Center and report charts

| Message | What to do |
|---|---|
| *n* of *m* plotted values are not verified yet | The chart plots draft values. Verify them in the period grid to clear the note ([update indicator values](/support/how-to/update-indicator-values)). |
| Data has changed (on a chart) | The data moved after the chart was added. Press **Update** on the chart in the section's **Chart** tab. |
| Cannot be redrawn | The chart's indicator was retired or its values removed. Edit the chart, or remove it. |
| This report is approved, so its content, charts included, is locked | An approver reopens it from the **⋯** menu ([reopen a report](/support/how-to/reopen-an-approved-report)), or you add the chart to a draft report. |
| This report has no draft yet | Open the report and generate it first. |
| No reporting period of this project matches the period in this row | In an imported data sheet, the period dates or name do not match. Use the downloaded Excel file as your starting point. |
| "…" is not a number | A value cell in the imported file holds text. Use plain numbers (1,200 and 45% are fine). |
| This value is verified, so it is left as it is | Verified values are never overwritten by an import. Ask a reviewer to send the value back for correction first. |
| The file is missing: Indicator code… | The imported file lost its heading row. Start from the downloaded data sheet. |
| Say why the report is being reopened | Reopening needs a reason of a few words. It is kept in the audit trail. |
| Only an approved, exported or submitted report can be reopened | The report is already a draft. Just edit it. |

## Uploads

| Message | What to do |
|---|---|
| Enter a valid Google Drive share link or file ID | Paste the file's share link or ID. |
| Failed to parse file (imports) | Use the downloaded template and check the file type (XLSX, CSV or TXT). |
| Could not read the spreadsheet | Share the Google Sheet with the connected Google account. |

If a page shows a **Reference** ID, include it when you contact [support](/support/contact).
