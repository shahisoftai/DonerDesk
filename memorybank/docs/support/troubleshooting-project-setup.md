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
