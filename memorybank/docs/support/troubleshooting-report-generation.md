# Troubleshooting Report Creation and Editing

## I can't create a reporting period

Creating a period is blocked until the project is **Ready**. Open the project's **Setup** page and clear each blocker:

| Blocker | Fix |
|---|---|
| Workspace pending or failed | Wait for the folder to be created, or use **Retry workspace** / **Repair workspace**. Check Google Drive is connected. |
| Reporting profile missing | Create it on **Setup → Reporting profile**. |
| Template has no reviewed required sections | Open the template, review sections and **Approve template**. |
| No reportable indicators / indicator configuration incomplete | Add an indicator and set baseline, target, unit and frequency on every quantitative one. |

Other reasons: the project is **Completed** or **Archived**, the dates overlap an existing period, or dates fall outside the project dates. The **What you can create** panel on the New reporting period page tells you, for each report type, whether it is available and why not. Typical cases: a **Final** report already closes your cycle (use a **Custom** report for a one-off), or a Final report was requested over periods that already exist (create it for the closing period, or use the guided [closing report](/support/how-to/create-the-closing-report)).

## The report editor looks empty

You have not generated a draft yet. Use **Generate report** on the launch card. If you cannot see the button, your role may not allow it (a report writer or programme manager must generate it).

## My changes are not saving

- Look at the top bar: it shows "All changes saved" when done.
- If you are told a newer version exists, someone else saved. Reload to see their changes, then redo yours.
- Only drafts can be edited. Approved or submitted reports are locked; **Request changes** or reopen as needed.

## "Waiting for review" and no approve button

Only Admins and Project Managers can approve. Ask one of them.

## The primary button says "Review n flagged statements"

Open the **Statements** tab and decide on each: use the evidence value, edit, keep with a note, or leave out.

## "Finish n remaining checks"

Open **Report checks**. Typical items: verify indicator data, resolve checklist items, re-check sections after inputs changed, confirm confidential files.

## Sections are out of order or missing

Use **Reorder** and **+ Add** in the outline. Sections follow the donor template; guidance-only sections are intentionally excluded.

## The AI wrote something odd

See [Troubleshooting AI report generation](/support/troubleshooting/ai-report-generation).

## Export is blocked

See [Troubleshooting export issues](/support/troubleshooting/export-issues).
