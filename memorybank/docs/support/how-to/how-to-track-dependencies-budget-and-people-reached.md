# How to Track Dependencies, Budget, People Reached and Workload

These tools are optional. A project that does not use them works exactly as before.

## Comes after (dependencies)

Open a planned activity and choose **Comes after**, then pick the activity that must finish first. Each activity can wait for one or more others.

- Moving the earlier activity **later** moves the ones that wait for it, by the fewest days needed. Moving it **earlier** does not pull the others forward.
- An activity that is already done or cancelled is not moved. DonorDesk tells you it is blocked, so you can decide what to do.
- An activity cannot wait for itself, for a duplicate link, or in a loop. Links cannot cross projects.
- Activities that are still waiting show "Waiting for …" on the list and on the timeline.

## Budget

On a planned activity, add **budget lines**: a code, a cost category, a donor, an amount and a currency. Then enter **expenses** against a line, with the date and an optional evidence file.

- A line with no amount shows **No budget set**, not zero.
- When spending goes over a line's amount, the line is flagged as over budget. Nothing is blocked.
- Project totals appear on the project's budget card and in the spreadsheet export.

## People reached

On the project's **People reached** page you can register people by **case code**, with sex, age group, location and the date they joined. DonorDesk stores no names, phone numbers or ID numbers. You must tick that consent was recorded before saving.

- A case code already used in the project is refused.
- A probable duplicate (same sex, age group and location, and a similar code) is flagged for you to decide. Nothing is merged for you.
- You can import a **Kobo or ODK** export as a CSV file. Save the column mapping for the project so the next import needs no setup. Every row is checked first: if any row is wrong or a code clashes, the whole file is refused and the line is named.

## Workload

On the project's **Team** tab you can see how many open planned activities each person leads, per week, against a limit you set. An overload is shown in words. It is a warning, not a block. Effort is counted in activities (you can give an activity a weight from 1 to 5); hours are not recorded.

## Automatic reminders

The Team tab also lists two reminder rules, each on or off for the project: a planned activity starting soon with no lead (to the Project Manager), and a finished activity still needing its files (to its lead). Each rule shows what it sent and when.
