# Troubleshooting Project Setup

## Where to look

Open the project's **Setup** page. It shows the status (Not started, In progress, Ready, Action required), a checklist and a **Blockers** list with **Fix** links.

## "New project" is blocked

- Only Admins can create projects.
- You may be at your plan's active-project limit. Archive a finished project or upgrade ([Plans and limits](/support/account-billing/plans-and-limits)).

## The project says "Draft — activate to report"

New projects start as drafts. Click **Activate project** in the banner at the top of the project (you need permission to edit the project). A paused project shows **Resume project** and an archived one **Restore project**.

## A setup request fails with "Validation failed"

The message now names the field and what is expected, for example *acknowledged: Send {"acknowledged": true} to confirm the setup.* Fix the named field and try again.

## "A project with the code … already exists in this workspace"

Project codes are unique in a workspace. The wizard tells you as soon as you type a taken code on **Project and team** (and again on **Review and launch**, where **Start the project** waits until it is changed). If you still see the message at launch, go back to **Project and team**, change the project code, and start the project again. Nothing is created twice: starting is safe to repeat.

## "Choose which result … measures"

The wizard did not put a library indicator under a result because none of your results fits its wording (for example an education indicator in a water project). Open **Indicators** and pick a result in that indicator's **Measures** box. On an existing project, the same indicator is skipped with "Choose where it goes": choose a result when you add it.

## "Use the starting answers" did not fill anything

It fills only what is empty, so it does nothing when everything it offers is already answered. If another save was running at the same moment it tries again by itself. The button waits until the draft is ready (for example while documents are still being read).

## I lost my wizard answers

Wizard progress is saved as a draft in your browser. Reopen **New project** on the same device and browser.

## Project workspace folder is pending or failed

1. Make sure Google Drive is connected (**Settings → Setup**).
2. On the project's Setup page click **Retry workspace**. If folders are partly there, click **Repair workspace**.
3. If it still fails, reconnect Drive and retry, or email support@donordesk.online.

## Setup stays "Action required"

Readiness is computed from live data. It reverts if something required is removed. Fix the listed blockers:

- **Donor template** – needs at least one reviewed required section ([upload and approve one](/support/how-to/upload-donor-template)).
- **Indicators** – at least one, and every quantitative indicator needs baseline, target, unit and frequency.
- **Reporting profile** – create it on the profile page.

Team assignment is recommended but does not block.

## I can't edit dates or budget

Use the project's **Settings** tab (Admin or Project Manager). Changing dates that would invalidate existing reporting periods is rejected.

## Archived or completed projects

Completed projects cannot get new periods; archived projects are read-only. **Restore project** in Settings for archived ones.

## Demo project problems

The demo project cannot be counted against your plan. If the tour will not start or resume, refresh, or delete the demo project from its banner and start again.
