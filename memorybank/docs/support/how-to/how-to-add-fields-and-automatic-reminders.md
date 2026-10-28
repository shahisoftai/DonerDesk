# How to Add Fields, Use Automatic Reminders and Change Many Activities at Once

Three tools help a project manager keep a plan current without retyping it. They are optional. A project that does not use them works as before.

## Add your own fields to planned activities

A project can add up to 20 fields of its own to planned activities, for example "District" or "Distribution round".

1. Open a planned activity and expand **Add a field to this project**.
2. Give the field a name (up to 80 characters) and choose its kind:
   - **Text**: up to 500 characters.
   - **Number**.
   - **Date**.
   - **Choice**: a list of up to 30 options.
3. Save. The field then appears on every planned activity in the project.

- Only a project manager can add a field. DonorDesk refuses a name that is already used in the project.
- A field left blank stays blank. It is never shown as zero.

## Automatic reminders

On the **Team** tab, the **Automatic reminders** card lists two rules. Each has one sentence, one switch and the numbers it can be set to.

| Rule | What it does | Default | You can change |
|---|---|---|---|
| Tell the project manager when an activity starts soon with no lead | Sends a notice to the project manager when a planned activity starts within the set number of days and nobody leads it | On, 3 days before | 1 to 14 days |
| Tell the lead when a finished activity still needs files | Sends a notice to the lead while files marked as still needed are missing, for the set number of days after the activity ends | On, 14 days after | 1 to 60 days |

Turn a rule off with its switch. Nothing is sent for a rule that is off.

## Change many activities at once

1. Open **Activities** and switch to the **List** view.
2. Tick the activities to change.
3. Choose what to change: move the dates, set the lead, set the start, or cancel.
4. Check the preview. It shows every activity that will change before anything is saved.
5. Confirm.

- Done and cancelled activities are not moved.
- To see or change one activity, select its row. The details open in a panel on the right, over the list, so you do not leave the list.

## Checks needed before publishing

- The custom field form, including the message for a duplicate name.
- That a notice arrives for each automatic reminder rule on a test project (and whether it arrives by email as well as in the app).
- The bulk change preview and the undo after a bulk change (the server supports undo; check where it appears on screen).
- Do not publish "undo" or the exact delivery channel of reminders until these are seen.
