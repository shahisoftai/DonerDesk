# How to Take Your Data with You

If you want a copy of everything your organisation has put into DonorDesk, an Admin can download it at any time from **Settings → Take your data with you**.

There are two downloads:

- **Download records**: everything except the evidence files themselves.
- **Download records and evidence files**: everything, including the evidence files stored in DonorDesk. This one is larger and takes longer to prepare.

Files stored in Google Drive stay in Google Drive. The download lists them so you can find them.

## What is in the ZIP

- One file per kind of record (for example projects, indicator values, activities, reports, the audit trail). Each line in a file is one record, in a format a spreadsheet or a script can read.
- The evidence files, in folders named by their record.
- A file called `manifest.json` that lists how many records each file holds, which evidence files were included, and any that were skipped with the reason.

## What is never included

Passwords, password hashes and invitation links are never in the download. Internal records used only by the system are left out, and the manifest names them.

## If a download does not start

Only one download can be prepared at a time for your organisation. If you see *"An export is already being prepared,"* wait a few minutes and try again.
