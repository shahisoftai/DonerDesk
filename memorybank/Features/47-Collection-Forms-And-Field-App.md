# Feature 47: Collection forms, record review and the offline field app

**DonorDesk Version 3.007 (Phase 33.5 + 33.6)**
**Status:** built and tested. Forms, sheet import, photo questions and the public collection link are deployed (`releaseId=20261028041837` and `20261028051819`, migrations `20261029090000_collection_forms` and `20261029100000_collection_files`). The offline field app (33.6) is deployed with the same releases but **has not been tried on a phone**. Connectors are in feature 51.
**Rules:** `AGENTS.md` → "Phase 33.5 invariants" and "Phase 33.6 invariants".

## Forms

- A **collection form** is a set of questions the team (or outsiders with a link) answers. Question types: number, text, date, choice, yes/no, place, GPS point, photo or document.
- A question can be **always required**, **required when** an earlier answer says so, or **shown only when** an earlier answer says so. A condition may look only at an earlier question.
- Each form says which indicator its records **add up to**: records are counted, or a number from them is added up, into the period their date falls in.
- A **published** form is frozen. To change questions, close it and make a new one, so earlier records keep the questions they were answered with.

## Records

- Submissions are **pending** until someone with `indicator.verify` accepts or rejects them (rejection needs a reason). A rejected or accepted record can be **returned to waiting**.
- Only **accepted** records count into indicator values. Totals are previewed on the form's totals tab. **Enter as drafts** writes them through the normal indicator save, so entry windows, locks and verified values still apply.
- A record in no reporting period, a record without the number a sum needs, and a repeat of a later record are listed apart. A period with nothing accepted is "not measured", never 0.
- A place answer is read against the organisation's places list: a name that resolves shows its path; an unknown or ambiguous name shows "To confirm". The stored answer is what was typed.
- Photos and documents: JPEG, PNG, WebP or PDF, 5 MB at most. The type is taken from the file's bytes. A record may attach only files uploaded to its own form. Only people who can submit or verify can download attachments.
- **Sheet import**: the form's template is a spreadsheet with one column per question. Any bad row blocks the whole import; the person gets their own sheet back with only the rows to fix and a Problems column. Re-importing the same sheet stores it once.
- Submissions are idempotent: a repeated send with the same id is stored once.

## Public collection link

Anyone with a link answers the form without signing in, at `/collect/<token>`. Only a hash of the token is stored; links expire (1 to 365 days) and can be withdrawn. Unknown, expired, revoked and closed-form links all show the same "not available" page. Public records are stored with source "link", never a user id. Limit: 5 requests a second per address (nginx).

## Offline field app (33.6)

- `/field` is a page the phone keeps for offline use. Its server render contains no signed-in data; everything it shows comes from the phone's own storage.
- **Download for offline** saves a project's open forms (their questions) and the places list. No records, figures or people. It belongs to whoever downloaded it, shows its age, asks for a refresh after 14 days without blocking, and is removed on sign-out.
- A form filled offline is saved on the phone (photos included) and sent when the connection returns, through the same outbox as activities. Each record's id is the outbox entry's id, so a repeated send is stored once. A refusal (for example, the form was closed) parks the entry with the reason.
- GPS "Use my location" works with no signal. Place questions suggest names from the pack.

## Not built

Offline indicator-value entry; offline review; background sync while the app is closed; opening any other page offline; a service worker that works for every page.
