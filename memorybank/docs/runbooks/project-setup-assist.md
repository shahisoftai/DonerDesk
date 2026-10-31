# Runbook — project setup from a document

**DonorDesk Version 3.007.** Feature spec: `memorybank/Features/25-AI-Project-Setup.md`.

## Deploy (in this order)
1. Fresh backup (`donordesk-backup.service`).
2. Migration `20261102100000_project_setup_proposals` (additive) with `prisma migrate deploy` as `DATABASE_ADMIN_URL` from `/opt/donordesk/app/packages/infrastructure/prisma`.
3. Re-run `infra/postgres/rls.sql`; if its single DO block stops early, apply the GRANT/RLS statements per table and **check `relrowsecurity` and `relforcerowsecurity` on `ProjectSetupProposal` and `ProjectSetupRun`** (both must be true).
4. `scripts/deploy-fast.sh` with `SCOPE=both`; `/ready` requires `ProjectSetupProposal.proposalJson` and `Organization.setupAssistEnabled`. No workers change.
5. Optional env: `SETUP_ASSIST_RUNS_PER_DAY` (default 10 proposals per organisation per day) and `SETUP_ASSIST_CONCURRENCY` (how many parts of one document are read at the same time; default 3, at most 8; lower it if the AI provider rate-limits).

The feature is off in every organisation until an administrator turns it on in Settings.

## Before anyone is told it exists
Run `setup:eval` with `LLM_PROVIDER` and its key set against 8–10 real, anonymised proposals; record per-area kept / dropped / time in the plan (§10). Do a signed-in browser pass with the user's own account (upload, review, accept/reject, apply, resume after a deliberate failure). Public copy says "Set it up from your project document" only after both.

## Support questions
- *"It says the document could not be read"* — scanned PDF without OCR packages, or an empty file; the message names the reason. Nothing was sent to a model.
- *"Items are missing"* — items the document does not state, or whose quote did not match, are dropped by design; a banner shows when a long document was only partly read.
- *"Apply stopped part-way"* — status PARTIAL: the project and earlier areas exist; fix the named problem in the review and press "Finish creating".
- *"Google Drive is not connected"* — project documents are saved in the organisation's own Drive; there is no server-storage fallback. Connect Drive in Settings (the connection only has the `drive.file` permission, so DonorDesk can read and move only files it created itself).
- *"The document could not be moved into the project's folder"* — the project was still created; the file is safe in the staging folder `DonorDesk / Project setup (documents in progress)` and moves when the person presses Finish creating.
- *"A proposal expired"* — 30 days; the proposal stops being usable. A document still in staging is removed when the proposal is discarded; one already moved into a project folder is never deleted by discarding.

## Safety checks
- Document text is never in audit rows or logs (lengths and counts only).
- The document is not on the server: it is in the organisation's Drive. The proposal row holds only `drive:<file id>` in `sourceStorageKey`, which is omitted from the organisation export and from API responses. Proposals made before 2026-10-31 point at server storage (`project-setup/...`): they cannot be read again (the person is told to add the document again) and are cleaned from server storage on discard.
- Redaction applies before any model call; `LLM_PII_POLICY=allow` sends text unchanged — do not set it for this feature.
