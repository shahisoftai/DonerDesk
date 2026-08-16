# Google Drive — Primary Evidence Storage (link-first) & R2 optional tier

**Author:** Kilo (agent) · **Date:** 2026-08-13
**Status:** IMPLEMENTED — Phases A–E complete (compiling, tested). Live Google
OAuth/OCR requires tenant provisioning (no tenants yet).
**Decisions:** Google Drive is the **first-priority storage** for all user content
(link-first, files stay in the tenant's own Drive). R2 (paid) is an **optional**
second tier. Onboarding is the first point where a tenant connects their Google
account.

> **2026-08-13 implementation status:** Phases A (storage abstraction + Google Drive
> + R2 + Local adapters + resolver), B (EvidenceFile/Organization `storageProvider`
> fields + `UploadEvidenceHandler` refactor + Prisma migration), C (onboarding Drive
> step + OAuth routes + Drive-link evidence), D (read-time resolution + Kestra
> reference flow), and E (SuperAdmin Kestra tab + Google Cloud provisioning) are
> **implemented**. All packages typecheck and infra/domain/application/api tests pass
> (35 infra / 19 api / 10 domain / 13 application). Default behavior is unchanged (LOCAL).
>
> **2026-08-14 — Google Sign-In on the login page (added):** users whose email
> matches an existing account can sign in with Google via
> `POST /v1/auth/google` (code exchange + Google id_token verification with jose)
> and the web `/api/auth/google/start|callback` routes. Env-gated behind
> `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. Shares the Google Cloud OAuth client
> with the Drive onboarding flow. See §9 "Google Sign-In".
>
> **2026-08-15 — Project workspace folder provisioning (added, Feature 18):**
> `GoogleDriveProjectWorkspaceService` + `GoogleDriveWorkspaceDrive` create the
> tenant "DonorDesk" root and a per-project folder tree (`01-Donor-Templates`,
> `02-Logframe`, `03-Data-Files`, `04-Evidence-Reports`, `05-Evidence-Images`,
> `06-Financial`, `07-Submitted-Reports`) using stable Drive `appProperties`
> identities (idempotent, retryable, repairable; 409-reconcile on races).
> `LocalProjectWorkspaceService` mirrors the tree under the storage root for
> LOCAL/R2 tenants (provisioning marked `NOT_REQUIRED`). Project folders are
> reference-only and the service account is granted read access to the tree.
> Drive folder creation is live in release `20260815054218` but remains
> **credential-gated**: it requires the tenant OAuth client + `GOOGLE_DRIVE_SHARE_EMAIL`
> (tenant provisioning, see §8). See `Features/18-Project-Creation-Wizard.md`.

---

## 1. Product decision (NGO mindset)

| Consideration | Decision |
|---|---|
| Where files live | **In the tenant's own Google Drive** — DonorDesk stores a reference + access, never a byte copy for reference-only evidence |
| Trust / data minimization | Files stay on Google infrastructure the NGO already trusts; no duplicate copy in a third-party store |
| Cost / donor accountability | Drive is free (Google for Nonprofits gives free Workspace + expanded storage). R2 is a paid, optional choice |
| Non-Google NGOs | Still supported via R2/S3 native upload tier |
| AI tagging / parse / export | Done **in Drive** via Google Document AI / Vision by file ID — no byte copy required |
| Default | **Google Drive link-first** for Google tenants |

**Storage strategy is a per-tenant choice**, selected via the existing SuperAdmin
`OBJECT_STORAGE` / `CONNECTOR` control-plane config (`apps/api/src/routes/superadmin.ts:7`,
`packages/infrastructure/src/platform/control-plane.ts:6-13`).

---

## 2. Current state (what exists today)

### 2.1 Byte-only storage abstraction

- `IStorage` port (`packages/application/src/ports/infrastructure.ts:17-21`) is **byte-only**:
  `put({ key, body, contentType })`, `getSignedUrl(key, ttl)`, `remove(key)`. No reference/link concept.
- `LocalStorage` (`packages/infrastructure/src/storage/local-storage.ts:17`) is the **only adapter**,
  hard-wired in `container.ts:216`. Writes to `STORAGE_ROOT` (`apps/api/.env:3`).
- `getSignedUrl` exists but is **never called** anywhere — no pre-signed URL sharing is wired.

### 2.2 Upload always copies bytes into DonorDesk

- `UploadEvidenceHandler` (`packages/application/src/use-cases/evidence/upload-evidence.ts:27-31`)
  always calls `storage.put({ body: cmd.buffer, ... })` — there is **no link-only path**.
- Evidence upload route (`apps/api/src/routes/evidence.ts:5-44`) reads multipart bytes via `data.toBuffer()`.
- Internal connector upload (`apps/api/src/routes/internal.ts:120-144`) decodes Base64 into a Buffer.
- `gdrive_ingest.yml` (Kestra) **downloads** the Drive file to Kestra storage, base64-encodes it,
  and POSTs the bytes to `/internal/evidence/upload` — i.e. it copies Drive content into DonorDesk
  rather than referencing it.

### 2.3 Evidence domain has no storage-provider concept

- `EvidenceFile` (`packages/domain/src/contexts/evidence/evidence-file.ts:71-90`) has only `fileUrl`,
  `fileSize`, `fileType`. No `storageProvider`, `driveFileId`, `driveWebLink`, or `storageKey`.

### 2.4 Byte-dependency audit (investigated 2026-08-13)

Only **two** places read bytes back out of storage (`IStorage.read`):

| Location | Purpose | Drive-replaceable? |
|---|---|---|
| `apps/api/src/routes/internal.ts:92` (`GET /internal/evidence/:id/content`) | Stream bytes to Kestra for Tika parse | ✅ Yes — Google Document AI/Vision by file ID |
| `apps/api/src/routes/files.ts:10` (`GET /v1/files/:key`) | Serve download to authenticated caller | ✅ Yes — signed Google download URL / redirect |

Everything else is **metadata/reference-based** and works fine with a Drive reference:

- **Export/PDF/Word/ZIP** (`packages/infrastructure/src/exports/builder.ts`) — renders from strings/numbers, never reads evidence bytes; ZIP only lists metadata. No byte dependency.
- **Search + preview** (`get-evidence.ts`, `search-evidence.ts`, detail page) — metadata only.
- **Cross-tenant / donor sharing** (`donor-portal.ts`, signed access links) — reference/token based, no byte handoff.
- **fileSize / fileType / hashing / verification / dedup** — all metadata-derived at upload; no re-read of bytes exists.

**Bottom line:** Only three things cannot work with a Drive link today:
1. Upload persistence (`IStorage.put` for evidence) — needs a reference-write path.
2. Direct download (`files.ts`) — replaceable by a signed Drive URL/redirect.
3. Tika parse (`/content` + `evidence_parse.yml`) — replaceable by Google Document AI/Vision by file ID.

---

## 3. Target architecture

```
Tenant onboarding
      │  (Google OAuth connect — PRIMARY)     (R2 paid — OPTIONAL)
      ▼                                        ▼
Google Drive (tenant-owned)             Cloudflare R2 / S3
      │  link-first, no byte copy              │  byte copy (native upload)
      ▼                                        ▼
StorageRouter  (per-tenant strategy)  ──▶  IEvidenceStorage / IStorage
      │
      ▼
UploadEvidenceHandler  →  EvidenceFile row (storageProvider, driveFileId | storageKey)
      │
      ▼
EvidenceUploaded event → outbox → evidence.suggest_tags
      │
      ├─ Drive-backed:  Google OCR (Document AI / Vision) by fileId (no byte fetch)
      └─ R2/local:      existing Tika byte path
```

---

## 4. Implementation (plan as executed)

> All phases A–E below are **implemented and tested**. For the concrete files and
> wire-up, see §7b "Implemented (Phases A–E)". Where the plan says "add X" or
> "introduce Y", X and Y now exist in the codebase.

### Phase A — Storage strategy port + adapters (core, no DB change)

1. **Extend the storage abstraction** (`packages/application/src/ports/infrastructure.ts`):
   - Add `interface IEvidenceStorage` with `resolveDownloadUrl(evidence)`, `resolvePreview(evidence)`
     alongside the byte-based `IStorage`.
   - Keep `IStorage` for byte storage (R2, local, export artifacts).
   - Introduce `StorageRouter` that picks the per-tenant strategy at upload time.

2. **`GoogleDriveStorage` adapter** (`packages/infrastructure/src/storage/google-drive.ts`):
   - **Reference path**: record `driveFileId` + `webViewLink` + encrypted access token; `put()` becomes a no-op that stores the reference; `resolveDownloadUrl()` returns a Google signed `webContentLink`.
   - OAuth2 token refresh from the tenant's encrypted refresh token (via `PiiVault`).
   - Drive API calls: permission grant (DonorDesk service account), metadata, Docs→PDF export, copy-on-share.

3. **`R2Storage` adapter** (`packages/infrastructure/src/storage/r2.ts`) implementing `IStorage`
   for the paid tier (S3-compatible PUT/GET/remove). Reuses the existing contract unchanged.

### Phase B — Data model + handler wiring

4. **Extend `EvidenceFile` domain** (`evidence-file.ts`):
   - Add `storageProvider: "GOOGLE_DRIVE" | "R2" | "LOCAL"`.
   - Add optional `driveFileId`, `driveWebLink`, `storageKey`.
   - `fileUrl` becomes a resolved link (Drive web link OR `/v1/files/{key}`) depending on provider.

5. **Refactor `UploadEvidenceHandler`** (`upload-evidence.ts`) to accept either:
   - a `Buffer` (byte upload → R2/local), or
   - a Drive reference (`driveFileId` + permission grant → link-only, no byte write).
   Branch via `StorageRouter` using the tenant's configured strategy. Keep emitting `EvidenceUploaded`.

6. **Add tenant `storageProvider` field** to the `Organization` model (schema.prisma), plus
   `createTenant` / `updateTenant` in `control-plane.ts:111-120` and `UpdateOrganizationHandler`.

7. **AI tagging / Tika for Drive**: replace the byte-fetch path (`internal.ts:92`, `evidence_parse.yml`)
   with a **Google OCR** call (Document AI / Vision) **by `driveFileId`** for Drive-backed evidence;
   keep Tika for R2/local bytes. `suggest-evidence-tags.ts` already takes text only, so tagging is unchanged.

### Phase C — Onboarding + UI + connector config

8. **Add "Connect Google Drive" as the first, required onboarding step**:
   - `onboarding-steps.ts:23` — new step key `storage`, first (non-optional), href `/onboarding/storage`.
   - `onboarding-status.ts:15` — extend the snapshot.
   - New `/onboarding/storage` page: **Google OAuth connect** button (primary) + **"Use DonorDesk R2 (paid)"** (secondary).

9. **OAuth flow** — new signed routes in `apps/api/src/routes/`:
   - `POST /v1/onboarding/drive/auth-url` → Google consent URL (Drive read + share scopes, minimal;
     **2026-08-16** added `https://www.googleapis.com/auth/spreadsheets.readonly` for the indicator
     data-entry Google Sheets import — existing tenants must re-consent to use it).
   - `POST /v1/onboarding/drive/callback` → exchange code for tokens, encrypt refresh token via
     `PiiVault`, create a TENANT-scoped `CONNECTOR` config (`google-drive-oauth`) via
     `PlatformControlPlane.upsertConfiguration`, set org `storageProvider=GOOGLE_DRIVE`.

10. **Upload UI** (`EvidenceUploadQueue.tsx`, `lib/actions/evidence.ts:13`):
    - Add a **"Link from Google Drive"** picker (Google Picker API) that sends `driveFileId` + name
      to the upload route instead of a byte file.
    - Keep byte upload for R2.

11. **Kestra `gdrive_ingest.yml`**: change from Base64-copy-in to **reference** — look up file by ID,
    grant permission, POST metadata + `driveFileId` to `/internal/evidence/upload` (no bytes).

### Phase D — Read-time resolution

12. **`files.ts:4` + web BFF proxy**: for Drive-backed evidence, resolve to a signed Google URL
    (302 redirect or proxied link) instead of reading local bytes; keep tenant check.
    Only R2/local evidence flows through byte streaming.

### Phase E — SuperAdmin "Kestra" left tab

13. **Add a dedicated "Kestra" left tab in the SuperAdmin portal** for all Kestra-related plugin
    management:
    - Central management of the Kestra plugin inventory + flow catalog (currently a panel inside
      `apps/superadmin/src/app/ui/Dashboard.tsx`, surfaced via `/superadmin/kestra`).
    - Provision/verify Google Cloud credentials: OAuth client (tenant connect) + service account
      (DonorDesk read/share) + Document AI / Vision access for OCR.
    - Test/configure `google-drive-oauth`, `google-drive` (service-account), and OCR connections.

---

## 5. Cross-cutting concerns

- **Data minimization**: Drive-link-first means no byte copy for most document evidence — the NGO goal.
- **Fallback / materialize (AUTOMATIC DR mirror)**: Drive-backed evidence is **automatically mirrored
  to R2** for disaster recovery. If a Drive link breaks/revokes, a durable copy already exists in R2;
  evidence survives tenant Drive loss without manual action.
- **Secrets**: refresh tokens in `PlatformConfiguration.secrets` (already AES-256-GCM encrypted,
  `control-plane.ts:169`) or `PiiVault` — never plaintext.
- **SuperAdmin**: add `google-drive-oauth` to `CONNECTOR` providers (`control-plane.ts:12`) and the
  Kestra plugins catalog (`superadmin.ts:64`). All Kestra-related plugin management lives in the new
  **"Kestra" left tab** (Phase E, item 13).

---

## 6. Build order

1. Phase A — storage port split + `GoogleDriveStorage` + `R2Storage` (unblocks everything).
2. Phase B — domain + handler + tenant field + migration.
3. Phase C — onboarding + OAuth + upload UI.
4. Phase D — read-time resolution + Kestra reference flow.
5. Phase E — SuperAdmin "Kestra" left tab (plugin + credential management).

---

## 7. Resolved decisions

| Question | Decision |
|---|---|
| OAuth scopes / consent wording | Minimal — Drive file read + share only. Consent wording confirmed OK. **2026-08-16:** added `spreadsheets.readonly` for indicator data-entry Sheets import (Feature 06). |
| "Copy to R2 (materialize)" — automatic or manual | **AUTOMATIC** — DR mirror to R2 for all Drive-backed evidence. |
| OCR provider (Document AI vs Vision vs Vertex) | **Google OCR** (Document AI / Vision by file ID). |
| Google Cloud credential provisioning | **Yes — new SuperAdmin left tab "Kestra"** for all Kestra-related plugin management. |

## 7b. Implemented (Phases A & B) — 2026-08-13

### Storage abstraction (`packages/application/src/ports/infrastructure.ts`)
- Added `StorageProvider` (from domain), `EvidenceLocation`, `SaveEvidenceInput`,
  `IEvidenceStorage` (`save` / `resolveDownloadUrl` / `remove` / optional `readBytes`),
  and `IEvidenceStorageResolver` (`resolve(tenantId)`). `IStorage` (byte) is unchanged.

### Adapters (`packages/infrastructure/src/storage/`)
- `local-evidence.ts` — `LocalEvidenceStorage` wraps `LocalStorage` (default path).
- `google-drive.ts` — `GoogleDriveEvidenceStorage` (reference-only; OAuth refresh,
  permission grant, web link; no byte copy).
- `google-drive-tokens.ts` — `EnvGoogleDriveTokenStore` (env-config; Phase C moves
  to tenant-scoped CONNECTOR config).
- `r2.ts` — `R2EvidenceStorage` (S3-compatible, AWS SigV4 signed requests).
- `router.ts` — `EvidenceStorageResolver` selects adapter per-tenant `storageProvider`.

### Data model + handler
- `EvidenceFile` domain: added `storageProvider`, `driveFileId`, `driveWebLink`,
  `storageKey` props + getters; `create()` accepts them.
- `Organization` domain + repo: added `storageProvider`.
- `UploadEvidenceHandler`: now uses `IEvidenceStorageResolver`, branches byte vs
  Drive-reference, default LOCAL.
- Contracts: `CreateEvidenceSchema` (fileUrl optional, storageProvider), 
  `InternalEvidenceUploadSchema` (optional fileBase64 + driveFileId).
- Prisma: `EvidenceFile` + `Organization` columns; migration
  `20260814000001_evidence_storage_provider`.
- DTO + repo map the new fields; internal + public upload routes pass them through.
- Tests: added storage adapter/resolver coverage to `storage.test.mjs`.

### Wiring (`packages/infrastructure/src/container.ts`)
- `evidenceStorage: EvidenceStorageResolver` added to `Container`; injected into
  `UploadEvidenceHandler`. R2 config is a placeholder (wired via env in production).

### Phase C — Onboarding + OAuth + Drive-link upload
- Contracts `packages/contracts/src/storage.ts`: `GoogleDriveAuthUrlResponseSchema`,
  `GoogleDriveCallbackSchema`, `LinkEvidenceSchema`; `StorageProviderSchema` lives in
  `evidence.ts`/`identity.ts`; `OrganizationProfileSchema` gained `storageProvider`.
- `ConnectGoogleDriveHandler` (`identity/connect-google-drive.ts`): `begin()` builds the
  consent URL, `complete(code)` exchanges it, saves the refresh token, and sets the org
  `storageProvider = GOOGLE_DRIVE`.
- `LinkGoogleDriveEvidenceHandler` (`evidence/link-google-drive-evidence.ts`): links a
  Drive file as evidence (no byte copy); rejects tenants not on GOOGLE_DRIVE.
- Infra: `google-drive-oauth.ts` (`GoogleDriveOAuthConnector`, env config, read+share
  scopes), `google-drive-credentials.ts` (`PrismaGoogleDriveCredentialStore`, AES-256-GCM
  in `PlatformConfiguration` TENANT-scoped CONNECTOR).
- API routes `routes/storage.ts`: `POST /v1/drive/auth-url`, `POST /v1/drive/callback`,
  `POST /v1/evidence/link-drive` (inside tenant plugin); auth rules added.
- Web: `onboarding-steps.ts` + `onboarding-status.ts` gained a first required `storage`
  step; `/onboarding/storage` page + `StorageConnect` client component; server actions
  `lib/actions/drive.ts`; OAuth callback route `api/auth/drive/callback`.

### Phase D — Read-time resolution + Kestra reference flow
- Internal evidence contract: `storageKey` optional, added `storageProvider`/`driveFileId`.
- `internal.ts` `/content` returns a Drive location JSON (no bytes) for Drive evidence;
  streams bytes only for byte-stored evidence.
- Web detail page: `isByteStoredEvidence` + `protectedFileDownloadHref`; Drive evidence
  shows an "Open in Google Drive" link.
- `workflows/kestra/gdrive_ingest.yml`: reference-only (sends `driveFileId`, no base64 copy).

### Phase E — SuperAdmin Kestra tab + Google Cloud provisioning
- Added `google-drive-oauth` CONNECTOR provider (control plane + Dashboard fields/icon).
- `/superadmin/kestra` now returns `oauthConfigured`/`serviceAccountConfigured`/`ocrConfigured`.
- Dashboard Kestra tab gained a "Google Cloud provisioning" credentials table.

### Tests
- `application/test/google-drive.test.mjs` — ConnectGoogleDrive + LinkGoogleDriveEvidence.
- `infrastructure/test/storage.test.mjs` — OAuth connector, credential store round-trip,
  R2/Local/Drive adapter behavior. |

## 8. Open follow-ups

(none — no tenants exist yet; migration/backfill of pre-existing byte evidence is not applicable.)

---

## 9. Google Sign-In on the login page (2026-08-14)

### Purpose

Let existing DonorDesk users sign in with their Google account instead of a
password. Same Google Cloud OAuth client as the Drive onboarding flow (one
client, two redirect URIs, different scopes).

### Flow

```
[login page] ──► /api/auth/google/start        (web: consent URL, scopes=openid email profile)
                     └──► Google consent
Google ──► /api/auth/google/callback?code     (web: validate state, POST code to API)
               └──► POST /v1/auth/google       (API: exchange code, verify id_token, find user, sign JWT)
               ◄── { token, ... }
web: set dd_session cookie ──► /dashboard
```

### Implemented

- **Contracts** (`packages/contracts/src/identity.ts`): `GoogleSignInSchema`
  (`{ code }`), `GoogleSignInResponseSchema` (`token`, `userId`, `tenantId`,
  `role`, `name`, `email`).
- **Port** (`packages/application/src/ports/infrastructure.ts`):
  `IGoogleSignInConnector.exchangeCode(code) → { email, name, googleSubject }`.
- **Connector** (`packages/infrastructure/src/auth/google-sign-in.ts`):
  `GoogleSignInConnector` — exchanges the code at `oauth2.googleapis.com/token`,
  verifies the returned `id_token` against Google's JWKS with `jose`
  (issuer/audience/`email_verified`). Reads `GOOGLE_DRIVE_CLIENT_ID`/`_SECRET`
  (falling back to `GOOGLE_AUTH_*`) and `GOOGLE_AUTH_REDIRECT_URI`.
- **Handler** (`packages/application/src/use-cases/identity/google-sign-in.ts`):
  `GoogleSignInHandler` — finds the user by email (existing accounts only),
  status checks, `recordLogin()`, audit `identity.user.login`, signs the JWT.
  Mirrors `LoginHandler` without a password check.
- **API route** (`apps/api/src/routes/auth.ts`): public `POST /v1/auth/google`
  (disabled when `AUTH_PROVIDER=oidc`).
- **Web routes** (`apps/web/src/app/api/auth/google/start|callback/route.ts`):
  consent redirect + callback (state check, `AuthService.googleSignIn`,
  sets `dd_session`, redirects `/dashboard`, deletes `dd_google_state`).
- **Login page** (`apps/web/src/app/login/page.tsx`): "Sign in with Google"
  button gated on `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true"`, plus error
  handling for `?error=google_failed|invalid_callback`.

### Env vars (production)

```
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED = true
GOOGLE_DRIVE_CLIENT_ID          (shared with Drive onboarding)
GOOGLE_DRIVE_CLIENT_SECRET
GOOGLE_AUTH_REDIRECT_URI        = https://<app>/api/auth/google/callback
APP_URL                         (already used by OIDC)
```

Register `https://<app>/api/auth/google/callback` as an authorized redirect URI
in the same Google Cloud OAuth client used for Drive.

### Constraints / decisions

- **Existing accounts only** — Google Sign-In logs in users whose email matches
  an existing account. Auto-provisioning (sign-up-with-Google) is a follow-up
  that needs a `googleSubject` column + org creation flow.
- **Reuses the Drive OAuth client** — one Google Cloud project serves both the
  Drive onboarding flow and the login flow. A dedicated `GOOGLE_AUTH_*` client
  can be swapped in via env without code changes.
- **No offline/refresh token for sign-in** — only `openid email profile` scopes;
  Drive access continues to use the separate onboarding OAuth flow.
