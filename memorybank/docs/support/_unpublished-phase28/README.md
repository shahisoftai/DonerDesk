# Support articles for the work plan — NOT PUBLISHED

These articles describe features of Phase 28 (Batches 28.0–28.9) and of the gap closure (2026-10-19). **The features are deployed (2026-10-18 and 2026-10-19). Demo 9 drove the main flows in a browser; the articles stay unpublished until (a) the interactive screens are checked on the live site with the owner's account, and (b) the open findings in `demo/verification-demo-9.md` that touch them are settled.** They are deliberately outside the folders the Support Center reads, so nothing here is public. Publishing them before the features are live would repeat the overclaim that Batch 28.0 removed from the website.

## Publish checklist (do all of it at deploy, after the browser check)

1. Check the screens these articles describe in a browser with a real login on the live site (`pending.md`, "Programme management (Phase 28)"). The features themselves are already deployed.
2. Move each file below into `memorybank/docs/support/how-to/` (the folder already uses the `how-to-` prefix).
3. Register each article in **both** places (see `docs/support/INDEX.md`): `FILE_MAP` in `apps/web/src/app/support/how-to/[article]/page.tsx` and the list in `apps/web/src/components/support/wikiCategories.tsx`. Add them to the sitemap if it is not generated.
4. Apply the edits to existing articles listed below.
5. Remove this folder, and move the "Unpublished" note in `INDEX.md` into the normal How-To list.
6. Restore the "Plan it" wording on the site (plan §12) and update `/features` and the deck in the same release.

## Articles

| File | Category | Goes with |
|---|---|---|
| `how-to-plan-your-activities.md` | How-To › Projects | wizard, adding, repeating, leads, showing/hiding |
| `how-to-use-the-timeline.md` | How-To › Reporting | moving dates, drag, keyboard, "Why?" |
| `how-to-use-my-week.md` | How-To › Navigation | field officer landing, offline |
| `how-to-import-your-plan.md` | How-To › Projects | import screen |
| `how-to-ask-for-work-and-use-my-work.md` | How-To › Navigation | requests, My Work, Team tab, leads |
| `how-to-record-problems-and-risks.md` | How-To › Projects | Overview "Problems and risks" |
| `how-to-add-comments-and-ask-for-files.md` | How-To › Reporting | comments, files we will need |
| `reference-daily-summary-and-reminders.md` | Reference | daily summary, escalation, email setting |
| `how-to-log-progress-and-finish-an-activity.md` | How-To › Projects | progress log, one-step Done, offline Done (gap closure) |
| `how-to-track-dependencies-budget-and-people-reached.md` | How-To › Projects | comes after, budget lines, people reached and Kobo/ODK import, workload (gap closure) |
| `how-to-add-fields-and-automatic-reminders.md` | How-To › Projects | custom fields, automatic reminders (Team tab), bulk change, details panel |

## Edits to existing articles (apply at deploy)

- **`basic-information-understanding-activities.md`** — add after the first paragraph: *"There are two kinds of activity in DonorDesk. A **planned activity** is work you plan ahead, with dates and a lead. A **completed activity** is the entry someone makes after doing the work: what happened, who came, and the files that prove it. A completed activity can point at the planned activity it delivers; then the plan shows what was done, and what is late."*
- **`advanced-features-roles-and-permissions.md`** — add rows: *Plan and schedule activities*: Admin, Project Manager, M&E Officer. *Update the activities you lead* (status, notes, place): Admin, Project Manager, M&E Officer, Grants Officer, Field Officer, Compliance Officer. *See the plan*: everyone with access to the project. *Show or hide work planning for a project*: Admin only.
- **`reference-glossary.md`** — add **Planned activity**, **Completed activity**, **Milestone** (a planned activity with one date), **On time / Late** (worked out from the dates and the completed activities linked to it), **Lead** (the person responsible for a planned activity).
- **`reference-faq.md`** — add: *Do I have to plan my activities?* No. Planning is optional. A project with no planned activities works exactly as before, and an Admin can hide the plan for a project in its settings.
- **`how-to/how-to-log-activities.md`** — add a step: *If your project has a plan, choose which planned activity this is. DonorDesk suggests up to three and says why. Choose "None of these" if it was not planned.*
- **`reference-keyboard-shortcuts.md`** — add (Timeline): focus a bar, then ← and → move it a day, Shift+← and Shift+→ change its end date; a bar then asks "Move to …?" and the Save button confirms; Esc cancels.
- **`how-to/how-to-use-the-dashboard.md`** — add: field officers with planned work see **My week** at the top of Home.
- **`how-to/how-to-use-the-data-center.md`** — add: a report's indicator section shows a table of each group's target beside the figure recorded for that group; a group with no figure reads "Not measured", never 0.
- **`how-to/how-to-use-bulk-actions.md`** — add: on the Activities list you can tick several planned activities to move them by a number of days, set the lead, or start or cancel them; a preview shows every change before you save.
- Any article that mentions "Mark activity done?" should say instead that **Done** is one step (see the new progress article).
