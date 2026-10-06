# How to Review and Approve Reports

Review happens in the document-style **report editor**. This guide covers the author's steps, then the reviewer's.

## Who can do what

| Action | Roles |
|---|---|
| Generate and edit | Admin, Project Manager, M&E Officer, Grants Officer |
| Decide on flagged statements | Admin, Project Manager (report managers) |
| Approve sections and approve the report | Admin, Project Manager |
| Export | Admin, Project Manager, Grants Officer, Viewer |
| Override a confidentiality issue | Admin, Grants Officer |
| Comment | Everyone except Viewer |

## Author: get the draft ready

1. Open **Projects → project → Reporting → the period**.
2. Follow the **primary button** at the top right. It always shows the next step:

| Button | What it means |
|---|---|
| Generate report | No draft yet. |
| Review *n* flagged statements | The AI wrote something the evidence does not support. Jumps to the first one. |
| Approve *n* remaining sections | Read each section and approve it. Approved sections are locked for this version. |
| Finish *n* remaining checks | Open the **Report checks** panel (unverified indicator data, checklist items, stale summary, confidential files to confirm). |
| Submit for review | Everything is clear. |

3. Use **j / k** to move between sections and **n** for the next issue (press **?** to see all shortcuts).

### Flagged statements

Open a section and the **Statements** tab. For each statement flagged **Needs a decision**, choose:

- **Use the evidence value** (applies the verified value to the text),
- **Edit the wording** yourself,
- **Keep with a note** (say why it is acceptable), or
- **Leave out** (removed from exports).

Minor statements are marked **Not checked (minor)**. You can resolve many at once with bulk resolution.

The review panel groups flagged statements by what kind of problem they are:

- **Needs fixing:** a figure disagrees with your verified data or evidence. Correct the text or the data. These always block approval.
- **Needs your decision:** something about the evidence (for example confidentiality or a changed file) needs a person to decide.
- **We could not confirm:** interpretive statements the checker could not tie to a source. They are not necessarily wrong. Read them, then use **Accept the *n* unconfirmed statements and approve** on that section: write one short reason (at least 10 characters), which is recorded with every statement accepted, and the section is approved if nothing else blocks it. Figure errors are never accepted this way.

Technical reason codes are never shown; each flag gives its reason in plain words.

### Fixing an approved section

An approved section can still be edited: click **Edit (reopens section)**. Saving reopens that one section for review, records it in the audit trail and keeps the earlier text in History. Approve it again when you are happy. A report that is already **Approved** as a whole is locked: a reviewer sends it back with **Request changes**.

### After edits

Editing text or changing data can make earlier checks stale. DonorDesk re-checks the affected sections; an **Inputs changed** banner offers to re-check or regenerate. A summary section shows a warning if other sections changed a lot after it was written.

## Submit for review

Click **Submit for review**. The report status becomes **Under review** and reviewers are notified.

## Reviewer: approve or request changes

1. Open the report from **My Work** or **Reports**.
2. Read the sections; add comments in the section **Comments** tab.
3. Choose:
   - **Approve report** – confirm the approval of this version. If blocking issues remain you are warned and can only approve anyway if you have the authority.
   - **Request changes** – write what needs fixing. The report returns to the author (**Report returned** notification).

Users who cannot approve see "Waiting for review".

## After approval

The approved version is locked. Use **Export report** to open the export wizard. See [How to export reports](/support/how-to/export-reports). Every approval, decision and export is recorded in the [audit trail](/support/how-to/use-the-audit-trail).
