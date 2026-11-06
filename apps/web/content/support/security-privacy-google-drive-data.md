# How Your Data Is Stored with Google Drive

DonorDesk works best when you connect your organisation's own Google Drive. This page explains exactly what stays in your Drive and what DonorDesk keeps.

## What stays in your Google Drive

- Evidence files you upload through DonorDesk or link from Drive.
- The project folder tree DonorDesk creates for you (templates, logframe, evidence, financial, submitted reports).
- Files you export into your Drive.

These files are stored by Google under **your own agreement with Google**. You control who they are shared with and how long they are kept. Google is your service provider, not a DonorDesk sub-processor for these files.

## What DonorDesk keeps on its own servers

DonorDesk is hosted in a Contabo data centre. Even with Drive connected, DonorDesk keeps:

- References to your Drive files (file ID, name, link).
- Text extracted from files, used for search and AI drafting.
- Report drafts, indicator values, activity records, comments and the audit log.
- Account and billing details.

When you use AI drafting, excerpts of this text are sent to the AI provider configured for your workspace. See [Sub-processors](/subprocessors).

## What access DonorDesk asks for

| Permission | Why |
|---|---|
| Access to files DonorDesk creates or you open with it (`drive.file`) | Create folders and save or read evidence you choose |
| Read file and folder names (`drive.metadata.readonly`) | List and link files you pick |
| Read spreadsheets (`spreadsheets.readonly`) | Import data from Google Sheets you choose |
| Sign in with Google (`openid`) | Only if you use Google sign-in |

DonorDesk does not request access to your whole Drive or to your email.

## Your responsibilities

- You are responsible for your Drive's security, sharing settings, retention and cost.
- If you delete a file in Drive, DonorDesk can no longer read it, but its record, extracted text and audit entries remain until you delete them in DonorDesk.
- If you disconnect Drive, features that read your files stop working.

## Disconnecting

Remove DonorDesk at any time in your Google Account under **Security → Third-party access**. Ask an Admin to delete evidence records in DonorDesk, or contact privacy@donordesk.online to delete your workspace.

See also: [How to connect Google Drive](/support/how-to/connect-google-drive), [Data Handling](/support/security-privacy/data-handling), [Data Processing Addendum](/dpa).
