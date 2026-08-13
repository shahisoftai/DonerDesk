# DonorDesk SuperAdmin Portal

**Portal:** `https://sa.donerdesk.online`  
**Classification:** privileged platform control plane  
**Production status:** deployed and reachable  
**Last verified:** 2026-08-13  
**Production release:** `20260813174000`

This document is the canonical architecture, security, deployment, operations,
and capability record for the DonorDesk SuperAdmin portal. Host-wide inventory
and shared-service details remain in [`contabo-ops.md`](contabo-ops.md).

---

## 1. Purpose and authority boundary

The SuperAdmin portal controls DonorDesk at the platform level. It is separate
from the tenant portal and its identity model.

- Only identities in the dedicated `PlatformAdmin` store can authenticate.
- The only provisioned platform identity is `mnpiracha@gmail.com`.
- Tenant roles (`ADMIN`, project roles, compliance roles, viewers, and all other
  tenant users) are not SuperAdmins and cannot use their tenant credentials at
  `sa.donerdesk.online`.
- The portal is reachable over public HTTPS. Privacy is enforced by credentials,
  authorization, secure sessions, and a separate API boundary;
  no IP or CIDR allow-list is required by the current product decision.
- SuperAdmin activity is recorded in a dedicated, hash-chained audit stream.

`SUPER_ADMIN` is deliberately not added to tenant role lists. This prevents a
tenant administrator from escalating into the global control plane.

---

## 2. Production topology

| Component | Production endpoint | Exposure | Service |
|---|---|---|---|
| OpenLiteSpeed vhost | `sa.donerdesk.online:443` | Public HTTPS | `lshttpd.service` |
| SuperAdmin Next.js app | `127.0.0.1:3012` | Loopback only | `donordesk-superadmin.service` |
| DonorDesk API | `127.0.0.1:4001/superadmin/*` | Loopback; reached by the Next.js proxy | `donordesk-api.service` |
| PostgreSQL | local PostgreSQL 16 | Host local | existing PostgreSQL service |
| Workers | `127.0.0.1:8092` | Loopback only | `donordesk-workers.service` |
| Kestra | `127.0.0.1:8093` | Loopback only | `donordesk-kestra.service` |

Request path:

```text
Browser
  -> HTTPS / OpenLiteSpeed vhost
  -> Next.js on 127.0.0.1:3012
  -> server-side /api/control/* proxy
  -> Fastify /superadmin/* on 127.0.0.1:4001
  -> PostgreSQL / local service health endpoints
```

The browser never receives the internal API address. Authenticated API access is
proxied by Next.js, which reads the session from an HTTP-only cookie.

### Key paths

| Item | Path |
|---|---|
| Current release | `/opt/donordesk/current` |
| Deployed release | `/opt/donordesk/releases/20260813143000` |
| SuperAdmin app | `/opt/donordesk/current/superadmin` |
| API environment | `/opt/donordesk/shared/api.env` |
| systemd unit | `/etc/systemd/system/donordesk-superadmin.service` |
| OpenLiteSpeed vhost | `/usr/local/lsws/conf/vhosts/sa.donerdesk.online/vhost.conf` |
| OpenLiteSpeed rollback copy | `/usr/local/lsws/conf/httpd_config.conf.pre-superadmin-20260813` |
| Initial credential handoff | `/root/donordesk-superadmin-initial.txt` (mode `0600`) |

---

## 3. Authentication and session security

### Login flow

1. The operator submits the platform email and password to the Next.js proxy.
2. The API validates the dedicated `PlatformAdmin` record.
3. Valid credentials produce a 30-minute SuperAdmin session token immediately.
4. Next.js stores that token in `sa_session` with:
   - `HttpOnly`
   - `Secure`
   - `SameSite=Strict`
   - path `/`
   - maximum age 1,800 seconds
5. The server-side proxy attaches the bearer token to internal API calls.

JWTs use HS256 with dedicated issuer and audience values of
`donordesk-superadmin`. A valid tenant session is not accepted.

### MFA status

Six-digit TOTP authentication was removed from the active login flow by product
decision in release `20260813174000`. Existing encrypted TOTP/recovery fields are
retained in the database for reversibility but are not requested or required.

### Brute-force controls

- Invalid credentials do not disclose whether the account exists.
- Five failed password attempts lock the account for 15 minutes.
- Disabled platform administrators cannot authenticate.
- The production account was verified as `ACTIVE` with zero failed attempts on
  2026-08-13.

### Credential handling

The password supplied in chat was treated as compromised and was not used. A
cryptographically random bootstrap password was generated on the host. Its
handoff file is readable only by root and must never be copied into source code,
documentation, tickets, logs, or provider configuration.

After confirmed operator handoff, securely delete the one-time handoff file.
Password rotation and recovery must use a controlled administrative procedure;
do not edit password hashes manually.

---

## 4. Encryption and secrets

Provider secrets are never stored in application source or returned by list APIs.

- Cipher: AES-256-GCM
- Master key: `PLATFORM_MASTER_KEY`, Base64-encoded 32-byte value
- JWT key: `SUPERADMIN_JWT_SECRET`
- Secret material location: `/opt/donordesk/shared/api.env`
- Expected file mode: `0600`
- Stored fields: ciphertext, initialization vector, authentication tag, and
  secret version
- Dashboard/list responses expose only `secretConfigured`, never secret values
- Updating configuration without a new secret keeps the existing encrypted secret
- Supplying a new secret rotates the ciphertext and increments its version

The master key must be included in protected disaster-recovery escrow. A database
backup without this key cannot recover encrypted provider credentials. The key
must not be stored in the same off-host backup bucket as the database backup.

---

## 5. Portal areas

The current application presents these navigation areas:

| Area | Purpose | Current implementation |
|---|---|---|
| Overview | Counts for tenants, users, configurations, recent backups, and connector runs | Available |
| Tenants | Global tenant inventory with user/project counts | Create, edit and guarded delete UI/API available |
| Users | Cross-tenant user inventory | Create, edit, suspend, role change, password reset and delete UI/API available |
| Providers | Encrypted global or tenant-scoped provider management | Provider-specific create/edit/rotate, enable/disable, test and delete UI/API available |
| Audit | Most recent 250 platform audit events | Available |
| System | API/database plus Kestra and worker health | Available |
| Kestra plugins | Live Kestra/worker health plus the free plugin + flow catalog (Tika, Redis, JDBC-Postgres, GDrive, SFTP) | Available (`/superadmin/kestra`) |

The initial dashboard uses compact generic tables. Some mutation APIs are present
before dedicated UI buttons/forms. This distinction matters when assessing portal
completeness; see Section 12.

---

## 6. Supported provider catalogue

### LLM

- OpenAI
- Anthropic
- DeepSeek
- MiniMax

### Email

- Brevo
- Postmark
- Resend
- Amazon SES
- SMTP-compatible provider

### Object storage

- Cloudflare R2
- Backblaze B2
- Amazon S3
- S3-compatible provider

### Off-host backup destinations

- Cloudflare R2
- Backblaze B2
- Amazon S3
- S3-compatible provider

### Inbound connectors

- KoboToolbox
- ODK Central
- Google Drive
- Microsoft SharePoint
- S3 drop-folder

Each record can be global or tenant-scoped and contains:

- category and provider
- display name
- enabled state
- non-secret JSON configuration
- encrypted secret JSON
- secret version
- last-test status/message/time fields
- creator/updater identity and timestamps

Configuration records are an encrypted control-plane registry. Provider-specific
execution, connection tests, scheduled backup runs, and connector ingestion must
be verified independently before declaring an entered provider operational.

---

## 7. SuperAdmin API

### Public authentication endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/superadmin/auth/login` | Validate email/password and issue full session |

### Authenticated endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/superadmin/overview` | Platform summary |
| `GET` | `/superadmin/tenants` | Tenant inventory |
| `POST` | `/superadmin/tenants` | Create tenant |
| `PATCH` | `/superadmin/tenants/:id` | Edit tenant policy/profile |
| `DELETE` | `/superadmin/tenants/:id` | Delete confirmed empty tenant |
| `GET` | `/superadmin/users` | Cross-tenant user inventory |
| `POST` | `/superadmin/users` | Create user and hash initial password |
| `PATCH` | `/superadmin/users/:id` | Change user name/status/role or reset password |
| `DELETE` | `/superadmin/users/:id` | Delete tenant user and audit action |
| `GET` | `/superadmin/configurations` | Sanitized configuration inventory |
| `PUT` | `/superadmin/configurations` | Create/update configuration and encrypt secrets |
| `POST` | `/superadmin/configurations/:id/test` | Test credentials/configuration and persist result |
| `DELETE` | `/superadmin/configurations/:id` | Delete configuration and audit action |
| `GET` | `/superadmin/audit` | Recent platform audit events |
| `GET` | `/superadmin/system` | API, database, workers, and Kestra health |
| `GET` | `/superadmin/kestra` | Live Kestra/worker health + free plugin and flow catalog (declarative) |

All authenticated endpoints require a token with role `SUPER_ADMIN`, purpose
`session`, correct issuer/audience, and a valid signature. Direct unauthenticated
access was verified to return HTTP 401.

---

## 8. Database records

The additive migration is:

`packages/infrastructure/prisma/migrations/20260814000000_superadmin_control_plane/migration.sql`

| Table | Responsibility |
|---|---|
| `PlatformAdmin` | Separate platform identity, MFA, recovery hashes, lockout state |
| `PlatformConfiguration` | Scoped provider metadata and encrypted secrets |
| `PlatformAuditEvent` | Tamper-evident control-plane audit chain |
| `BackupRun` | Backup execution/result history |
| `ConnectorRun` | Connector execution/result history |

The control-plane tables are not tenant aggregates. They must not be exposed via
tenant APIs or tenant RLS context.

Audit records include actor, action, entity type/id, old/new serialized values,
source IP, user agent, previous hash, current hash, and timestamp. Passwords and
plaintext configuration secrets are replaced by audit-safe markers.

---

## 9. TLS and OpenLiteSpeed

- Certificate authority: Let's Encrypt
- Certificate name/SAN: `sa.donerdesk.online`
- Certificate path: `/etc/letsencrypt/live/sa.donerdesk.online/`
- Verified expiry: 2026-11-11 08:41:27 UTC
- Renewal: Certbot scheduled renewal
- HTTP and HTTPS listeners map `sa.donerdesk.online` to its dedicated vhost
- The vhost proxies only to `127.0.0.1:3012`
- ACME challenge files use the shared webroot at
  `/usr/local/lsws/Example/html/.well-known/acme-challenge`

Certificate renewal deploys updated files but OpenLiteSpeed may need a reload to
use the renewed certificate. Add or verify an appropriate Certbot deploy hook.

---

## 10. Operations

### Status and logs

```bash
systemctl status donordesk-superadmin
journalctl -u donordesk-superadmin -n 100 --no-pager
journalctl -u donordesk-api -n 100 --no-pager
systemctl status lshttpd
```

### Loopback checks

```bash
curl -fsSI http://127.0.0.1:3012/
curl -fsS http://127.0.0.1:4001/health
curl -sS -o /dev/null -w '%{http_code}\n' \
  http://127.0.0.1:4001/superadmin/overview
```

Expected result for the last command without a token: `401`.

### Public checks

```bash
curl -fsSI https://sa.donerdesk.online/
openssl s_client -connect sa.donerdesk.online:443 \
  -servername sa.donerdesk.online </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

### Restart order

```bash
systemctl restart donordesk-api
systemctl restart donordesk-superadmin
systemctl restart lshttpd
```

Use `lshttpd.service` on this host; `lsws.service` is not the active unit name.
After any shared-ingress restart, verify both `sa.donerdesk.online` and the main
`donerdesk.online` portal.

---

## 11. Deployment and rollback

The SuperAdmin app is built as a Next.js standalone application and runs on port
3012. The API contains the `/superadmin/*` routes and the infrastructure package
contains the encrypted control-plane implementation.

Important source paths:

- `apps/superadmin/`
- `apps/api/src/routes/superadmin.ts`
- `packages/infrastructure/src/platform/control-plane.ts`
- `packages/infrastructure/src/platform/bootstrap-cli.ts`
- `infra/systemd/donordesk-superadmin.service`
- `infra/openlitespeed/sa.donerdesk.online.vhost.conf`

Rollback of application code follows the normal immutable-release procedure:

1. Point `/opt/donordesk/current` to the previous known-good release.
2. Restart `donordesk-api`, `donordesk-web`, and `donordesk-superadmin` as needed.
3. Verify loopback and public endpoints.

The database migration is additive. Do not drop control-plane tables during an
ordinary application rollback. Preserve encrypted configuration, admin identity,
and audit history.

For ingress rollback, restore
`/usr/local/lsws/conf/httpd_config.conf.pre-superadmin-20260813`, remove only the
dedicated vhost mapping if required, validate, restart `lshttpd`, and verify all
other hosted domains. Do not modify shared ingress casually.

---

## 12. Current limitations and next work

The portal includes task-specific management screens and forms for tenants,
users, LLMs, email, object storage, backup destinations and inbound connectors.
The following deeper execution workflows remain separate work:
- Safe tenant deletion lifecycle with dependency review, delayed deletion, and
  recovery window
- Live protocol-level tests for SES, SMTP, S3-compatible stores and connector
  providers; their current test validates encrypted credentials/configuration and
  delegates live protocol verification to the worker adapter
- Runtime resolution of enabled LLM/email/object-storage configuration by all
  production adapters
- Actual encrypted off-host backup scheduling, retention, restore testing, and
  dashboard-triggered runs
- Actual KoboToolbox, ODK Central, Google Drive, SharePoint, and S3 drop-folder
  ingestion scheduling and run controls
- Kestra **plugins inventory** is now surfaced in a dedicated portal tab
  (`/superadmin/kestra`, live Kestra/worker health + the free plugin/flow catalog);
  **flow management and run history** (execute, inspect executions) remain separate work
- Platform-admin self-service password rotation and audited recovery workflow
- Logout/revocation controls and shorter server-side revocation capability
- Explicit API-wide rate limiting in addition to per-account lockout
- Certificate-renewal deploy hook that reloads OpenLiteSpeed

Do not represent provider configuration as operational merely because credentials
have been saved. An integration is operational only after its adapter, connection
test, worker/Kestra execution path, telemetry, failure handling, and recovery
procedure have all passed production verification.

---

## 13. Verification record — 2026-08-13

Client hotfix `20260813171000` clears stale response state during navigation and
defensively checks list payloads before rendering. This fixes the client-side
exception previously triggered when moving from Overview to AI/LLM (and protects
all other list-based tabs from the same transition race).

Authentication release `20260813174000` removes the six-digit TOTP step. A valid
SuperAdmin email/password now creates the secure HTTP-only session directly.

| Check | Result |
|---|---|
| Current release | `/opt/donordesk/releases/20260813143000` |
| Public portal | HTTP 200 over HTTPS |
| Unauthenticated `/superadmin/overview` | HTTP 401 |
| Platform account | `mnpiracha@gmail.com`, `ACTIVE`, zero failed attempts |
| Certificate SAN | `DNS:sa.donerdesk.online` |
| Certificate expiry | 2026-11-11 08:41:27 UTC |
| Initial handoff file mode | `0600` |
| OpenLiteSpeed | active |
| API | active |
| Main web | active |
| SuperAdmin web | active |
| Workers | active |
| Kestra | active |

No plaintext passwords, TOTP secrets, recovery codes, provider credentials,
master keys, JWT secrets, or database passwords belong in this document.
