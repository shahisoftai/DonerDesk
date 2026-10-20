# Feature 29: Organisation export — take your data with you

**DonorDesk Version 2.006**

**Author:** Claude (agent) · **Date:** 2026-10-21
**Status:** Built, tested and deployed 2026-10-20 (batch 3, audit finding H-11; SE-13). Browser check pending. Builds on [Feature 14](14-Export-Module.md), which exports one report at a time.

## 1. What a user gets

Administrators find **Take your data with you** on the Settings page, with two downloads:

- **Download records**: every record the organisation holds, as a ZIP.
- **Download records and evidence files**: the same, plus the evidence files that are stored in DonorDesk. Larger, and slower to prepare.

Files kept in Google Drive stay in Drive; the export lists them in its manifest.

## 2. What is in the ZIP

- `data/<Table>.ndjson`: one file per table, one record per line (JSON). Dates are ISO 8601 in UTC.
- `files/<evidence id>/<file name>`: the evidence files, when asked for.
- `manifest.json`: the format name, the record count per table, which files were included and which were skipped and why, and what was left out.

**Never included:** password hashes, invitation links, SCIM and sign-in tokens. Internal bookkeeping (request keys, reminder ledger, job queue, AI call log, search index, payment webhook log, anti-abuse records) is left out and named in the manifest.

## 3. Rules that matter

- **Administrators only** (`org.manage`). Partners and everyone else are refused.
- **One export at a time per organisation.** A second request while one is being prepared is refused with a plain message.
- **Every export is audited** (`organization.exported`), with whether files were included.
- **Only this organisation's rows** are read; row-level security applies to the read.
- **A table added later is exported by default.** A developer must either leave it in or list it as excluded with a reason; a test fails otherwise.
- **Files over the size limit** (1 GB by default, `ORG_EXPORT_MAX_FILE_BYTES`) are skipped and listed, so a download never fails halfway.

## 4. Where it lives

| Layer | Path |
|---|---|
| Application | `use-cases/organization/export-organization.ts` (`ExportOrganizationHandler`), `ports/infrastructure.ts` (`IOrganizationExporter`) |
| Infrastructure | `exports/organization-exporter.ts` (`OrganizationExporter`, `ORG_EXPORT_EXCLUDED`, `ORG_EXPORT_OMITTED_FIELDS`) |
| API | `GET /v1/organization/export?files=1` (`routes/org.ts`) |
| Web | `app/api/organization/export/route.ts` (streams the ZIP), Settings page section |
| Tests | `packages/infrastructure/test/organization-export.test.mjs` (classification, secret-column check, real-database isolation check) |

## 5. Limits

- The export is a copy of the data, not a restorable backup. The backup and restore path is in `memorybank/docs/runbooks/DISASTER-RECOVERY.md`.
- The ZIP is built in memory per request; very large organisations should export in parts (not yet supported).
