# How to Write Your Organisation's Starting Answers

When someone creates a project and picks a sector, the [project wizard](/support/how-to/create-a-project) can fill in the usual answers for that sector. DonorDesk comes with built-in starting answers for some sectors. You can write your own, and yours are used first.

Open **Settings → Starting answers**. You need the **Admin** role.

## What starting answers fill

How often reports are due, how values are checked, when values can be entered, the kinds of report and their due dates, the usual risks, and a starting dashboard.

Rules that keep them safe:
- They **only fill what is still empty**. They never overwrite what someone typed.
- They never include people or a donor.
- Every answer can still be changed in the wizard.

## See what applies today

The page lists **Any sector (general)** and every main sector. Each row says **Built in: …** (the DonorDesk default) or **No starting answers**, and has a **Write our own** button.

## Write your own for a sector

1. Next to the sector, click **Write our own**.
2. Fill in:
   - **Name of this pack**
   - **Reports are made**: **Monthly** or **Quarterly**
   - **How values are checked**: **Simple** or **Full**
   - **Entry opens (days before the period ends)** and **Entry closes (days after the period ends)**
   - **Starting dashboard**: choose one or none
   - **Reports**: **Add a kind of report** (for example `QUARTERLY`) with **Due (days after the period ends)**. Reports use the standard layout; a donor's own layout is uploaded per project.
   - **Usual risks**: **Add a risk** with **What might go wrong**, **How serious** (**High**, **Medium**, **Low**) and **What will be done**
3. Click **Save**. Click **Cancel** to leave without saving.

## Which one is used

For a project in a sector, DonorDesk uses: your own pack for that sector, otherwise your own **general** pack, otherwise the built-in one. You can remove your own pack at any time to go back to the built-in answers.

Every change is recorded in the audit trail.
