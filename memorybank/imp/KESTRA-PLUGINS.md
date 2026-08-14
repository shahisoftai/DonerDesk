# Kestra Plugins — inbound integrations & data pipelines

**Author:** Kilo (agent)
**Date:** 2026-08-13
**Status:** OPERATIONAL (core) · STAGED/GATED (GDrive, SFTP)

Kestra is the production job orchestrator and inbound file pipeline. The five free
plugins extend it with document parsing, caching, analytics, and two inbound
connector flows. GDrive and SFTP ingestion are fully wired but gated on
SuperAdmin connector credentials — they are not experimental.

---

## Architecture

```
Drive / SFTP drop folder
        │
        ▼
io.kestra.plugin.google.drive.Trigger  (or fs.SftpTrigger)
        │  polls for new files
        ▼
Kestra internal storage  (transient metadata / no byte copy for Drive)
        │
        ▼
Python task — HMAC-signed POST /internal/evidence/upload (driveFileId, NO base64)
        │
        ▼
UploadEvidenceHandler  →  EvidenceStorageResolver  →  GoogleDrive (reference) | R2 | LOCAL
        │                                        +  PrismaEvidenceRepository (row)
        ▼
EvidenceUploaded event  →  outbox  →  evidence.suggest_tags job
        │
        ▼
workers /v1/suggest-tags  →  AI tagging (Google OCR by fileId | Tika bytes)
```

---

## What is deployed and running

### Core Kestra (2026-08-13, Contabo)
- Kestra 1.3.30 / Java 21 on `127.0.0.1:8093` (UI/API) + `127.0.0.1:8094` (management)
- Service user `donordesk_kestra`; dedicated PostgreSQL database `donordesk_kestra`
- 7 core flows deployed via `workflows/kestra/sync-flows.sh` (deadline_reminders,
  export_on_close, readiness_recompute, activity_polish, report_draft_section,
  checklist_generate, period_cache — no plugin dependency)
- Health: `donordesk-kestra.service` active, `sys database migrate` passed
- Verified end-to-end: Kestra→worker execution (`evidence.suggest_tags`) SUCCESS

### Internal API routes (`apps/api/src/routes/internal.ts`)
| Route | Purpose |
|---|---|
| `POST /internal/evidence/upload` | Signed upload for GDrive/SFTP connectors. Accepts bytes (`fileBase64`) or a Drive reference (`driveFileId`) — reference-only for Drive. Tenant-isolated. Publishes `EvidenceUploaded`. |
| `GET /internal/evidence/:id/content` | Streams evidence bytes to the Tika flow for byte-stored evidence; returns a Drive location for Drive evidence. Tenant-isolated. |
| `POST /internal/evidence/:id/tags` | Workers persist AI-suggested tags. |
| `POST /internal/readiness/recompute` | Trigger readiness score recompute. |
| `POST /internal/checklist/generate` | Trigger compliance checklist generation. |
| `POST /internal/export/run` | Trigger report export. |
| `POST /internal/reminders/deadline` | Trigger deadline reminder emails. |

All routes use HMAC-signed internal tokens (not user JWTs) and bind the per-request container to the signed tenant — RLS and tenant filters still apply.

### SuperAdmin portal (`/superadmin/kestra`)
Returns live Kestra + workers health and the declarative plugin/flow catalog.
The **Kestra plugins** tab in the SuperAdmin UI shows status for all five plugins.

---

## The five plugins

| Plugin | Flow | Purpose | Status |
|---|---|---|---|
| Tika | `evidence_parse.yml` | Document text/OCR extraction; bytes fetched via `GET /internal/evidence/:id/content`, parsed, result POSTed to `/internal/evidence/:id/tags` | **GATED** — requires plugin JAR verification against Kestra 1.3.30 |
| Redis | `period_cache.yml` | Already running (no plugin JAR needed; uses Contabo host Redis) | **OPERATIONAL** |
| JDBC-Postgres | `analytics_snapshot.yml` | Read-only tenant-scoped aggregation via `donordesk_app` role (RLS enforced) | **GATED** — requires `donordesk_app` grants + `DONORDESK_APP_DB_PASSWORD` Kestra secret |
| **Google Drive** | `gdrive_ingest.yml` | Poll Drive folder → signed evidence upload (**reference-only**, sends `driveFileId`, no byte copy) | **GATED** — see §GDrive below |
| **SFTP** | `sftp_ingest.yml` | Poll SFTP drop folder → signed evidence upload | **GATED** — see §SFTP below |

### GDrive — staged, needs SuperAdmin connector credential
The flow (`workflows/kestra/gdrive_ingest.yml`) and signed route are deployed.
To activate:
1. A SuperAdmin creates a `CONNECTOR` platform configuration with provider
   `google-drive` and the service-account JSON as a secret.
2. `GDRIVE_SERVICE_ACCOUNT_JSON` and `GDRIVE_FOLDER_ID` are added to the
   Kestra secret store (or `kestra.env`).
3. The flow is deployed via `sync-flows.sh` and triggered manually to prove the
   credential works.
4. The connector is tested end-to-end: a file placed in Drive appears as an
   `EvidenceFile` row with `verificationStatus = AI_TAGGED`.

The flow supports configurable `tenantId`, `projectId`, `evidenceType`, and
`confidentialityLevel` inputs so a single flow definition can serve all tenants.

### SFTP — staged, needs SuperAdmin connector credential
Same pattern as GDrive. Requires:
- SuperAdmin `CONNECTOR` record with SFTP host/username/key secrets
- `SFTP_HOST`, `SFTP_USER`, `SFTP_KEY` in Kestra secrets + flow inputs for folder

---

## Infra files

| File | Role |
|---|---|
| `infra/kestra/plugins.manifest.tsv` | Pinned Maven coordinates for all 5 plugins (Kestra verifies version against 1.3.30 before loading) |
| `infra/kestra/install-plugins.sh` | Downloads pinned JARs from Maven Central into `--plugins` dir |
| `infra/kestra/kestra.application.yml` | Kestra server config; `donordesk` datasource for JDBC plugin (gated); loopback-only listeners |
| `infra/systemd/donordesk-kestra.service` | systemd unit; passes `--plugins` dir to Kestra server |

---

## Storage — where uploaded content lives

After a GDrive/SFTP→API upload completes, the final home depends on the tenant's
per-tenant `storageProvider` strategy (see `memorybank/gdrive.md`):

| Store | Content |
|---|---|
| **Google Drive (tenant-owned)** | Default for Drive evidence: reference-only (`storageProvider=GOOGLE_DRIVE`, `driveFileId` + web link). Files stay in the tenant's Drive; no byte copy. |
| **Cloudflare R2 / S3-compatible** | Optional paid tier + DR mirror (`R2EvidenceStorage`, byte copy). |
| **Filesystem** (`STORAGE_ROOT`) | Default/dev (`LocalStorage`): blobs at `storage/{tenantId}/evidence/{id}.{ext}`. |
| **Postgres** (`donordesk`) | `EvidenceFile` row with fileUrl, storageProvider, verificationStatus, AI tags, audit. |
| **Kestra internal storage** | Transient only; metadata staging before the flow calls the API. |

The `IEvidenceStorage` / `EvidenceStorageResolver` abstraction selects the per-tenant
adapter (Google Drive / R2 / LOCAL) without changing the upload flow or handler code.

---

## Large-media note

The Base64-JSON upload contract is functional but not ideal for large files (>10 MB).
`gdrive_ingest.yml` now sends a Drive **reference** (`driveFileId`) instead of bytes.
For byte-stored evidence, the recommended path when an object-storage adapter is wired:
1. Kestra trigger downloads file to internal storage.
2. Kestra calls `POST /internal/evidence/upload` with a **signed URL** from the API
   (instead of base64-encoding the bytes).
3. Kestra PUTs the file directly to object storage.
4. Kestra POSTs the metadata + signed URL to the API to create the `EvidenceFile` row.

This avoids the Base64 memory tax and the Kestra→API bytes tax for large media.
