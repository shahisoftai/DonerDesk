# How to Create a Reporting Period

A **reporting period** is one report cycle for a project: for example "Q3 2026 progress report". It holds the period's indicator values, activities, evidence, story, draft and exports.

## Before you start

The project must be **Ready** on its Setup page (workspace folder, reviewed donor template, indicators with baseline/target/unit/frequency, and a reporting profile). Until then, creating a period is blocked and the Setup page tells you what is missing. Completed or archived projects cannot get new periods.

## Steps

1. Open **Projects → project → Reporting** and click to add a new period.
2. Read the **What you can create** panel at the top: it shows which report types are available now and, for the others, why and what to do instead. Then choose the **Report type**: Monthly, Quarterly, Semi-annual, Annual, Final, Activity, Situation or Custom. Activity, Situation and Custom reports ask what they cover: **Activity** — tick the activities the report is about; **Situation** — the event, the "as of" date, and optionally location and summary; **Custom** — a title and optional purpose. These reports can sit inside a Monthly or Quarterly period.
3. Check the **Donor template**. It is already chosen for you: an approved template written for exactly this report type, otherwise your project's default, otherwise the built-in structure. The choice says **· default for this type**. Change it, or pick **Built-in structure (no template)**; your choice is kept. Unapproved templates are marked "not approved yet". The template is pinned to the period (you can change it later, see [How to change a report's template](/support/how-to/change-a-reports-template)).
4. **Start date** and **End date** are suggested from the report type and the project's dates. Each new period is chained after the previous one and clipped to the project's end date. Adjust if the donor uses different cut-offs.
5. **Donor deadline** is calculated from the template's deadline setting where it has one. Add an **Internal review deadline** (optional) earlier than the donor's.
6. Save.

Regular periods (Monthly to Annual and Final) must not overlap each other and must fall inside the project dates. A **Final** report closes the cycle: create it for the closing period (for example the last month), not over periods that already exist; the guided [closing report](/support/how-to/create-the-closing-report) does this for you. For a one-off report over dates that already have periods, use a **Custom** report.

## Create the whole calendar in one click

For a project that reports **monthly or quarterly**, the Reporting page shows **Set up the whole reporting calendar**, for example *5 periods: Mar 2026 – Jul 2026. The last one (Aug 2026) is the closing report, created from its own steps.* Click **Create all 5 periods**. The periods are created one after another with the same checks as above, each with its donor deadline. If one is refused you see which and why, and the others are still created. Running it again never makes duplicates.

The last block of the project is not created here: it belongs to the [closing report](/support/how-to/create-the-closing-report). **Auto-create reporting periods** (a reporting-profile setting, on by default) follows the same rule: it creates each regular period once its month is over and never creates the last block, so the closing report can still be started.

## After creating it

The period workspace opens with the four steps: **Update Project → Tell the Story → Generate Draft → Review & Submit**. See [Understanding the reporting workflow](/support/getting-started/reporting-workflow).

## Cancel a period, restore it, or make it the final report

On **Reports**, each period offers what it may do, for people who can edit the project:

- **Cancel period**: takes a period out of the calendar when it was created by mistake. Nothing is deleted: its data stays, and it no longer blocks the dates, the closing report or comparisons. Cancelled periods are listed at the bottom of the page. A period with an approved or exported report cannot be cancelled; reopen the report first if it was approved by mistake.
- **Restore period**: puts a cancelled period back, unless another period now covers its dates.
- **Make this the final report**: shown on the last regular period (for example, a final month that was created as a regular month). It becomes the project's closing report. This works only when no later period exists, the project has no final report yet, and nothing on the period has been approved.

Every one of these is recorded in the audit log.

## Period status

Not started → In progress → Evidence collection → Draft generated → Under review → Approved → Submitted → Closed. See [Report statuses](/support/getting-started/report-statuses).

**Report structure.** A donor template is optional. Without one, the report uses a ready-made structure for its type. Activity and Situation reports can only use a template of their own type. Activity dates come from the activities you tick, Situation dates continue from the previous report on the same event (reports are numbered #1, #2…), and their deadlines default to 7 and 3 days.
