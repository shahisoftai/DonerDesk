# How to Upload Evidence

Evidence is the proof behind your numbers: attendance sheets, photos, distribution lists, monitoring reports and so on. Roles that can upload: Admin, Project Manager, M&E Officer, Grants Officer, Field Officer and Compliance Officer.

Open **Projects → your project → Evidence** (or **Evidence** in the main menu for all projects).

## Where files go

Your workspace stores evidence in one of two places (chosen in **Settings → Setup → Connect Google Drive**):

- **Your own Google Drive** (recommended). Uploads go into the project's **Evidence** folder in your Drive, and DonorDesk keeps a link. These files do not count toward your DonorDesk storage quota.
- **DonorDesk storage** (paid option). Files are stored by DonorDesk and count toward your plan's storage limit.

## Upload files

1. Click **Upload evidence**.
2. Drop files onto the upload area or click to browse. You can select **several files at once**; each is uploaded separately in the **Upload queue**. Opening the form from an activity's **Add evidence** button (or from the activity form itself) has the activity already chosen.
3. For each file set:
   - **Evidence title**
   - **Evidence type** – Attendance sheet, Photo, Distribution list, Training record, Field visit report, Monitoring report, Kobo/ODK export, Procurement document, Approval document, Beneficiary list, Meeting minutes, Case study, Financial document, Supplier document, Donor communication or Other
   - **Reporting period**: you usually do not need to set it. When you choose an activity, the file takes **that activity's period** and the form says so ("taken from the activity"). Choose a period yourself only for a file that belongs to no activity.
   - **Confidentiality** – Public, Internal, Sensitive or Highly sensitive
   - **Location** (optional)
   - **Use as proof for** (optional): choose the **activity** and/or **indicator** the file supports. For an indicator, also choose the reporting period. The file is attached straight away, so reports use it as proof; you do not need a second step. If the indicator has no value for that period yet, the file is attached automatically when the value is first saved.
4. Save. Text is read from documents so the AI Reporter can cite them.

### Link a file already in Google Drive

Choose **Or link an existing Google Drive file**, paste a share link (for example `https://drive.google.com/file/d/.../view`) or a file ID, and save. Nothing is copied.

## AI tag suggestions

After upload DonorDesk suggests tags (evidence type, related activity or indicator, period, a short summary and sensitivity warnings). Open the file's tag review to accept, edit or reject each suggestion. Tags only become final when you approve them. AI tagging never uses AI report credits.

## Link evidence to activities and indicators

A file counts as **proof** in reports once it is **attached** to an activity or to an indicator value. Choosing "Use as proof for" at upload attaches it at once; files dropped on the activity form are attached to that activity and its period only (type "Other", titled by file name), not to an indicator. To prove an indicator value, upload through **Upload evidence** and choose the indicator under "Use as proof for". A file can be linked to several.

Each activity and indicator page has a **Supporting evidence** panel. It lists its files, marks each **Used in reports** (attached) or **Tagged only**, and shows which report statements cite it. Click **Suggest links** to see likely matches based on titles and confirm the ones you want (it may find none; then link by uploading again with the indicator chosen). Linked evidence is what supports numbers in reports and what the checklist counts.

**Which reports use a file?** A monthly or quarterly report uses the files of its own period and of its activities. A **final, annual or semi-annual** report states progress since the project started, so it uses **all of the project's verified evidence**. The report inputs panel, the export wizard and the AI draft all use the same rule, so the numbers agree. On the file's own page you see **Uploaded** (the day it was added) and, if you gave one, **Date of activity**.

The evidence list shows how many files match (for example *21–40 of 133*) and pages through them.

## Verify evidence

Reviewers (Admin, Project Manager, M&E Officer, Compliance Officer) open the file and change its status. See [Evidence verification](/support/getting-started/evidence-verification).

## Confidentiality and reports

**Sensitive** and **Highly sensitive** files are withheld from AI drafting. If a claim in a report cites one anyway, the export gate blocks it until an Admin or Grants Officer confirms it may be shared.

## Bulk import

To register many files at once use the evidence Excel template (**Download template** on the Evidence page) and import it. You can also pick files from the project's storage folder panel and use **Link as evidence**.

See also [Troubleshooting evidence upload](/support/troubleshooting/evidence-upload).
