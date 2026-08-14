# Contabo Operations — Shared Host and DonorDesk

**Last read-only verification:** 2026-08-12 09:15–09:17 CEST
**Last deployment:** 2026-08-14 17:41 CEST (release `20260814154500`)

**Host:** `vmi2954830.contaboserver.net` (`109.123.248.253`)

**Purpose:** Live-host facts and safety rules for deploying DonorDesk without
disrupting NeureCore, GFC, CyberPanel, mail, or other colocated applications.

This file is the host inventory. The executable DonorDesk design and release
procedure live in [`../docs/CONTABO-LEAN-DEPLOYMENT.md`](../docs/CONTABO-LEAN-DEPLOYMENT.md).

## 1. Verification scope and evidence policy

The 2026-08-12 audit connected through `ssh contabo` and used read-only commands:
`hostname`, `free`, `df`, `ss`, `systemctl`, `pm2 status/describe`, `docker ps`,
`docker stats`, `pg_lsclusters`, read-only PostgreSQL queries, Redis unauthenticated
probes, OLS config inspection/testing, UFW status, certificate listing, timers,
cron listing, and filesystem metadata.

No environment files, PM2 environment dumps, database rows, Redis credentials, or
application secrets were read. No remote files or services were changed.

Treat values as a timestamped observation, not a permanent guarantee. Re-run the
preflight in Section 12 before assigning ports or deploying.

## 2. Live host summary

| Item | Verified value |
|---|---|
| OS | Ubuntu 24.04, kernel `6.8.0-124-generic` |
| CPU | 6 vCPUs |
| RAM | 11 GiB total, 5.0 GiB used, 6.7 GiB available |
| Swap | 2.0 GiB total, 585 MiB used |
| Root disk | 96 GiB ext4, 66 GiB used, 31 GiB free (69%) |
| Uptime/load | 57 days; load approximately 0.55/0.56/0.47 |
| Node | `v20.20.2` |
| Global pnpm | `9.15.9` |
| Python | `3.12.3`; `python3.11` is not installed |
| Docker | `29.5.2` |
| Docker Compose | `v5.1.4` |
| PM2 | `6.0.14`, root-owned daemon |
| OpenLiteSpeed | OpenLiteSpeed `1.8.4` |
| PostgreSQL | `16.14`, native cluster `16/main` |
| DonorDesk installed | Yes — `/opt/donordesk` with systemd services `donordesk-api` and `donordesk-web` |

Corrections to the superseded inventory:

- the OS is 24.04, not 22.04;
- OpenLiteSpeed reports 1.8.4, not 2.4.4;
- seven PM2 processes are online, not four;
- Python 3.11 cannot be used without installing it;
- disk availability is 31 GiB, not 45 GiB;
- the active tenant/frontend ports differ from several old notes.

## 3. Existing workloads — do not disrupt

### 3.1 PM2

All observed PM2 processes run as `root` in the existing root PM2 daemon:

| Process | Mode | Observed memory | Listener/path |
|---|---|---:|---|
| `cookie-refresher` | fork | 109 MiB | `/opt/gfc-platform/cookie-refresher` |
| `gfcportal` | fork | 105 MiB | public `*:3011`; standalone Next.js |
| `neurecore-admin` | fork | 157 MiB | `127.0.0.1:3020` |
| `neurecore-backend` | fork | 269 MiB | public `*:3003`; 4,822 restarts observed |
| `neurecore-cors-proxy` | fork | 45 MiB | public `*:3004` |
| `neurecore-tenant` | fork | 163 MiB | `127.0.0.1:3001` |
| `shahisoft-nextjs` | cluster | 140 MiB | PM2 internal `127.0.0.1:3010` |

The high NeureCore backend restart count must be investigated before relying on
aggregate host headroom. DonorDesk commands must always use `--only` and must
never run `pm2 restart all`, `pm2 reload all`, or replace the existing PM2 dump.

### 3.2 Native/systemd services

Verified active services include:

- `postgresql@16-main.service`
- `redis-server.service`
- `lshttpd.service` and `lsws-watchdog.service`
- `nghttpx.service`
- `docker.service`
- `fail2ban.service`
- `hermes-sidecar.service`
- `hermes-events-bridge.service`
- `accounting-sidecar.service`

Existing capability sidecars:

| Service | User | Bind | Working directory |
|---|---|---|---|
| `hermes-sidecar` | `hermes-sidecar` | `127.0.0.1:8080` | `/opt/neurecore/infra/hermes-sidecar` |
| `hermes-events-bridge` | `hermes-sidecar` | `127.0.0.1:8082` | `/opt/neurecore/infra/hermes-events-bridge` |
| `accounting-sidecar` | `hermes-sidecar` | `127.0.0.1:8091` | `/opt/neurecore/infra/accounting-sidecar` |

Port 8090 is CyberPanel/lscpd and is publicly bound. Never use it. Port 8081 is a
loopback Docker mapping for `gfc-backend`. DonorDesk may reserve 8092 only after
rechecking it immediately before deployment.

### 3.3 Docker

Six containers were running:

| Container | Image | Approx. memory | Exposure |
|---|---|---:|---|
| `neurecore-grafana` | `grafana/grafana:11.3.0` | 49 MiB | process listens `*:3200`; blocked by default UFW |
| `neurecore-alertmanager` | `prom/alertmanager:v0.27.0` | 15 MiB | `*:9093`, `*:9094`; blocked by default UFW |
| `neurecore-prometheus` | `prom/prometheus:v2.55.1` | 41 MiB | `*:9090`; blocked by default UFW |
| `gfc-backend` | local image | 77 MiB | `127.0.0.1:8081 -> 8080` |
| `gfc-postgres` | `postgres:16-alpine` | 61 MiB | internal Docker port only |
| `gfc-redis` | `redis:7-alpine` | 5 MiB | `127.0.0.1:6380 -> 6379` |

Docker consumes approximately 3.8 GiB of images, 310 MiB of volumes, and 1.2 GiB
of currently reclaimable build cache. Do not prune globally without checking all
projects. Existing observability volumes are persistent. There is no Tempo or Loki.

The NeureCore observability definition is under `/opt/neurecore/observability/`.
DonorDesk may add a Prometheus target and Grafana dashboard only after backing up
and validating those shared configs. Do not replace the Compose project.

## 4. Verified listener and port map

The full `ss -lntup` output must be rechecked before deployment. Important ports:

| Port | Verified owner/bind | DonorDesk decision |
|---:|---|---|
| 22 | SSH, public IPv4/IPv6 | Existing public service |
| 25/465/587 | Postfix, public | Existing mail; do not change |
| 80/443 | OpenLiteSpeed, public | Shared public ingress |
| 631 | CUPS, public listener | Existing security review item |
| 3000 | nghttpx, `127.0.0.1` | Occupied |
| 3001 | NeureCore tenant, `127.0.0.1` | Occupied |
| 3002 | DonorDesk web, `127.0.0.1` | **DEPLOYED** — DonorDesk Next.js standalone |
| 3003 | NeureCore backend, public bind | Occupied; existing risk |
| 3004 | NeureCore CORS proxy, public bind | Occupied; existing risk |
| 3010 | PM2/internal, `127.0.0.1` | Occupied |
| 3011 | GFC portal, public bind | Occupied |
| 3020 | NeureCore admin, `127.0.0.1` | Occupied |
| 3200 | Grafana, public bind | Occupied; UFW blocks by default |
| 3306 | MariaDB, `127.0.0.1` | Occupied |
| 4001 | DonorDesk API, `0.0.0.0` | **DEPLOYED** — Fastify server (note: binds all interfaces) |
| 5432 | PostgreSQL, `0.0.0.0` and `[::]` | Occupied; use existing cluster |
| 5555–5557 | Node processes, public bind | Occupied/unidentified; do not use |
| 6379 | host Redis, loopback | Occupied; authentication required |
| 6380 | GFC Redis mapping, loopback | Occupied |
| 7080 | CyberPanel/OpenLiteSpeed, public TCP/UDP | Occupied |
| 8080 | Hermes, loopback | Occupied |
| 8081 | GFC backend, loopback | Occupied |
| 8082 | Hermes events bridge, loopback | Occupied |
| 8090 | lscpd/CyberPanel, public | Permanently occupied |
| 8091 | accounting sidecar, loopback | Occupied |
| 8092 | no listener observed | Candidate DonorDesk worker |
| 9090 | Prometheus, public bind | Occupied; UFW blocks by default |
| 9093/9094 | Alertmanager, public bind | Occupied; UFW blocks by default |
| 9200/9300 | Elasticsearch, loopback | Occupied |

“Public bind” and “internet reachable” are different. UFW currently denies
unlisted inbound traffic, but a service bound to `0.0.0.0` remains exposed to
allowed networks and becomes public if a firewall rule changes. DonorDesk must
bind 3002, 4001, and 8092 explicitly to `127.0.0.1`.

## 5. PostgreSQL facts and DonorDesk rules

### 5.1 Live configuration

The native cluster is PostgreSQL 16.14 at `/var/lib/postgresql/16/main`:

```text
listen_addresses=*
port=5432
max_connections=200
shared_buffers=2 GiB
work_mem=64 MiB
effective_cache_size=7 GiB
archive_mode=on
wal_level=replica
log_min_duration_statement=1500 ms
ssl=on
```

Existing databases and observed sizes:

| Database | Size |
|---|---:|
| `neurecore_prod` | 54 MiB |
| `ecoearthshop` | 9 MiB |
| `lifeosa` | 9 MiB |
| `neurecore` | 8 MiB |
| `postgres` | 8 MiB |
| `donordesk` | ~0 MiB (freshly migrated) |

### 5.2 Security findings

- PostgreSQL listens on all IPv4 and IPv6 addresses.
- UFW permits 5432 from loopback, one fixed public IP, and Vercel ranges.
- `pg_hba.conf` has `host all all 127.0.0.1/32 trust`, meaning any local Unix
  account can connect over IPv4 loopback as any PostgreSQL role without a password.
- WAL archive mode copies WAL files to a directory on the same physical host.
  This aids point-in-time recovery from logical mistakes but is not off-host DR.

Do not broaden existing PostgreSQL access for DonorDesk. Prefer changing the
general loopback `trust` rule to `scram-sha-256` in a separately reviewed host
hardening window, because it can affect all current applications.

### 5.3 DonorDesk database isolation

Create separate roles:

- `donordesk_migrator`: owns the DonorDesk database/schema and runs migrations;
- `donordesk_app`: restricted runtime role, no `BYPASSRLS`;
- optionally `donordesk_backup`: least-privilege backup role.

Never use `postgres`, `neurecore_app`, or another project role at runtime. Create
the DonorDesk database only after versioned Prisma migrations exist. Apply the
checked-in RLS SQL as the migrator and verify isolation while connected as
`donordesk_app`.

## 6. Redis facts and DonorDesk rules

Host Redis is bound to `127.0.0.1:6379` and `[::1]:6379`. It requires
authentication; unauthenticated `PING`, `INFO`, and `CONFIG GET` correctly returned
`NOAUTH`. This supersedes the old assumption that selecting database 1 was enough.

Do not inspect or reuse NeureCore credentials. If DonorDesk later wires BullMQ:

1. create a dedicated Redis ACL user with a strong password and `dd:` key pattern;
2. grant only the command categories BullMQ needs;
3. keep loopback binding;
4. use a DonorDesk-specific prefix in addition to any logical database;
5. test queue behavior and memory policy using authenticated commands;
6. add the ACL/config to encrypted host configuration backup.

Until BullMQ is selected by the application container, DonorDesk does not need
Redis and should not receive Redis credentials.

## 7. OpenLiteSpeed, domains, and TLS

OpenLiteSpeed 1.8.4 and nghttpx are active. Twenty-one vhost files were observed.
Existing NeureCore routing proves the usable pattern:

- `brain.neurecore.com` -> `127.0.0.1:3003`;
- `hq.neurecore.com`: `/api` -> 3003, `/socket.io` -> 3004, `/` -> 3001;
- `cc.neurecore.com`: `/api` and `/socket.io` -> 3003, `/` -> 3020.

`litespeed -t` did not return a clean result: it reported existing invalid PHP
handler paths for unrelated `mail.globalfood.club` and `guvhq.shahisoft.store`
vhosts. Do not claim the global configuration validates cleanly, and do not repair
unrelated vhosts as part of DonorDesk deployment. Capture the baseline errors,
add the DonorDesk vhost, rerun the test, and require no **new** errors.

**DonorDesk deployment (2026-08-12):**
- **Hostname:** `DonerDesk.online` (DNS: `109.123.248.253`)
- **Vhost:** `/usr/local/lsws/conf/vhosts/donerdesk.online/vhost.conf`
  - Routes: `/` → `127.0.0.1:3002`, `/api` → `127.0.0.1:4001`
  - ExtProcessors: `donordesk_web` (3002), `donordesk_api` (4001)
- **Certificate:** `/etc/letsencrypt/live/donerdesk.online/`
  - Issued: 2026-08-12, Expires: 2026-11-10
  - Key: `privkey.pem`, Cert: `fullchain.pem`
- **OLC vhost SSL config:** keyFile and certFile point to above paths

Several unrelated certificates are expired or near expiry. DonorDesk certificate
renewal should be monitored via certbot cron.

## 8. Firewall and SSH facts

UFW is active with logging, default deny incoming, allow outgoing, deny routed.
Fail2ban is active with six jails. Publicly allowed services include SSH, HTTP,
HTTPS, mail protocols, 8090, 3001, and 8005. PostgreSQL and Redis also have
project-specific source rules.

Observed SSH daemon policy:

```text
PermitRootLogin yes
PasswordAuthentication yes
PubkeyAuthentication yes
MaxAuthTries 6
```

These are shared-host security risks, but changing them is outside a DonorDesk
application deploy and could lock out administrators. Schedule a separate,
tested hardening change with an open recovery session.

DonorDesk requires no new public firewall ports: only the existing 80/443 ingress
is needed. Do not add UFW rules for 3002, 4001, or 8092.

## 9. Backup and recovery facts

Observed backup signals:

- PostgreSQL WAL archive mode is enabled, but the archive is local to the host.
- CyberPanel incremental scheduler entries exist in root cron.
- GFC has a nightly database backup script.
- no NeureCore- or DonorDesk-specific PostgreSQL off-host backup timer/cron was
  identified by the audit;
- no DonorDesk data exists yet;
- `/opt/neurecore` occupies approximately 7.1 GiB;
- a prior NeureCore archive path documented elsewhere was not listed by the
  targeted directory probe and must not be assumed recoverable without testing.

Before DonorDesk production data is accepted, implement encrypted off-host backup
for both the DonorDesk PostgreSQL database and `/opt/donordesk/shared/storage`.
Record destination, retention, last success, checksum, and restore-test evidence.
Local WAL/archive/release copies are not disaster recovery.

**Current DonorDesk backup status:** No automated off-host backup configured yet.
Implement before accepting production data.

## 10. DonorDesk allocation

**Status: DEPLOYED** (2026-08-14, release `20260814154500`). Deployed via the
checksummed incremental immutable-release path (API + web + prisma, with
SuperAdmin preserved from the preceding release; no server-side installs or
shared-node_modules fallback). Google Drive evidence storage + Google Sign-In
code is live; the Google OAuth client credentials are still pending
(login-page button is env-gated). Workers and Kestra are both enabled; the five
plugin-referencing flows and plugin JARs remain gated (see §14 log + `imp/KESTRA-PLUGINS.md`).

| Resource | Allocation |
|---|---|
| Web | `127.0.0.1:3002` (DonorDesk Next.js standalone) |
| API | `127.0.0.1:4001` (Fastify) — **loopback-only confirmed** (was `0.0.0.0`) |
| Worker | **ENABLED** `127.0.0.1:8092` (FastAPI `donordesk-workers.service`, venv at `/opt/donordesk/workers/.venv`, Python 3.12) |
| Kestra | **ENABLED** `127.0.0.1:8093` (API/UI) + `127.0.0.1:8094` (management), Kestra 1.3.30 / Java 21 |
| Files | `/opt/donordesk/shared/storage` |
| Releases | `/opt/donordesk/releases/20260814154500` → `current` symlink |
| Runtime user | `donordesk` system user; Kestra user `donordesk_kestra` (created) |
| Database | `donordesk` (PostgreSQL 16.14); Kestra DB `donordesk_kestra` migrated through Flyway v1.57 |
| DB roles | `donordesk_migrator` (schema owner), `donordesk_app` (runtime), `donordesk_kestra` (Kestra, created) |
| systemd services | `donordesk-api.service`, `donordesk-web.service`, `donordesk-workers.service`, `donordesk-kestra.service` |
| Secrets | `/opt/donordesk/shared/api.env`, `/opt/donordesk/shared/workers.env` (0600); Kestra `kestra.env` (0600) |

**Deployment notes (2026-08-13 release `20260813064828`):**
- Built off-host with pnpm 10.34.5; `pnpm --filter @donordesk/api deploy --legacy` + web standalone (copied unchanged from previous release) + `prisma/` schema/migrations.
- Applied migration `20260813000000_idempotency` (creates `IdempotencyRecord`) via `prisma migrate deploy` as `donordesk_migrator` (loopback trust).
- Applied updated `infra/postgres/rls.sql` (23 tenant tables, now incl. `IdempotencyRecord`); RLS enabled+forced and `donordesk_app` grants verified.
- Added `INTERNAL_TOKEN`/`INTERNAL_HMAC_SECRET` to `api.env` for the `/internal/*` routes.
- Smoked staged API on `127.0.0.1:4009` (health/ready OK, DB ok); switched `current`; restarted `donordesk-api` (web unchanged, left running).
- Verified: API binds `127.0.0.1:4001` (loopback fix live), `/health`+`/ready` OK, `/internal/*` returns 401 (auth active), public HTTPS `/` + `/login` 200.

Because global pnpm is 9.15.9 while DonorDesk pins 10.34.5, do not change the
global pnpm version: NeureCore depends on it. Build a self-contained artifact with
pnpm 10.34.5 off-host, including production dependencies and Prisma engine/client.
Production should not perform a workspace install.

**Outstanding issue:** **API loopback — RESOLVED 2026-08-13** (binds `127.0.0.1:4001`).
`donordesk-workers` **enabled** on `127.0.0.1:8092`. `donordesk-kestra` is
**enabled and verified** on loopback `8093`/`8094`; seven flows are deployed (the
five plugin-referencing flows remain **gated** — stage/verify plugin JARs and the
`donordesk` datasource first). Schedule the off-host backup (`scripts/backup.sh`)
before accepting production data.

## 11. DOs and DON'Ts

### DO

- Re-run Section 12 before every release.
- Snapshot the exact OLS vhost/config files before editing them.
- Run OLS validation and compare against recorded baseline errors.
- Use process-specific PM2 operations or dedicated systemd units.
- Bind DonorDesk services to `127.0.0.1` in application code/config.
- Keep secrets under `/opt/donordesk/shared` with mode 0600.
- Use immutable release directories and an atomic `current` symlink.
- Use direct, artifact-bundled Prisma tooling for production migrations.
- Test RLS as the restricted runtime role after every migration.
- Back up PostgreSQL and uploaded files off-host before accepting production data.
- Save the correct process supervisor state after a successful deploy.
- Record every host change and the evidence used to verify it.

### DON'T

- Do not run `pm2 restart all`, `pm2 reload all`, or `pm2 delete all`.
- Do not upgrade global Node, pnpm, Python, PostgreSQL, Docker, or OLS during the
  DonorDesk deploy.
- Do not use ports based on this file without checking `ss` again.
- Do not expose application, database, Redis, worker, metrics, or orchestration
  ports publicly.
- Do not copy development `.env` files to Contabo.
- Do not use `prisma db push --accept-data-loss` in production.
- Do not use another project's database, Redis user, storage, PM2 config, vhost,
  Compose project, Docker volume, or Unix account.
- Do not globally prune Docker, logs, archives, or packages to make room.
- Do not assume a running container proves an application feature is integrated.
- Do not edit unrelated OLS errors, certificates, firewall rules, or shared
  services in the same change window.

## 12. Canonical read-only preflight

Run immediately before assigning resources or deploying:

```bash
ssh contabo '
  set -eu
  date --iso-8601=seconds
  . /etc/os-release; echo "$PRETTY_NAME"
  uname -r
  node --version
  pnpm --version
  python3 --version
  free -h
  df -h /
  uptime
  ss -lntup
  pm2 status
  systemctl is-active postgresql@16-main redis-server lshttpd nghttpx docker fail2ban
  pg_lsclusters
  docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}"
  ufw status
  /usr/local/lsws/bin/litespeed -t 2>&1 | tail -20
'
```

Then assert candidate ports explicitly:

```bash
ssh contabo '
  for port in 3002 4001 8092; do
    if ss -lntH "sport = :$port" | grep -q .; then
      echo "BLOCKED: port $port is occupied" >&2
      exit 1
    fi
  done
  echo "Candidate DonorDesk ports are currently free"
'
```

This is read-only. Database provisioning, account creation, firewall changes,
vhost creation, certificate issuance, and process starts are separate controlled
changes described in the deployment runbook.

## 13. DonorDesk post-deploy verification

After an approved deployment:

```bash
ssh contabo '
  ss -lntp | grep -E "127.0.0.1:(3002|4001|8092)"
  curl -fsS http://127.0.0.1:3002/ >/dev/null
  curl -fsS http://127.0.0.1:4001/health
  curl -fsS http://127.0.0.1:4001/ready
  systemctl --no-pager --full status donordesk-api donordesk-web
  systemctl --no-pager --full status donordesk-workers 2>/dev/null || true
  df -h /
  free -h
'
```

Also verify from outside the server:

- TLS and certificate chain;
- `/` and same-origin `/api` routing;
- WebSocket upgrade;
- authentication and tenant isolation;
- upload/download and every export type;
- external monitoring and alert delivery;
- backup completion and a clean-machine restore.

## 14. Change log

- **2026-08-14 (checksummed incremental deployment pilot):** Deployed hardened
  release `20260814154500` with `scripts/deploy-incremental.sh`. The workflow
  hard-links the preceding immutable release, transfers content deltas with
  checksummed rsync, atomically switches `current`, restarts only the selected
  DonorDesk services, waits up to 30 seconds for health, and automatically
  restores the preceding symlink on verification failure. The initial pilot
  exposed and fixed two packaging defects before finalizing the guide: pnpm's
  deploy target must initially be empty, and the Prisma runtime symlink must be
  relative rather than anchored to `/tmp`. Packaging now removes local `.env`
  files, `dev.db`, sources/tests, Next build cache, and TypeScript build metadata.
  Measured results: full build 151.5 s; cached artifact assembly 23.9 s; hardened
  artifact 811 MB logical; deployment 86.2 s; steady-state checksummed comparison
  17.5 s with zero transferred files. API and web are healthy on loopback and
  through public HTTPS. See `docs/CONTABO-FAST-DEPLOYMENT.md`.

- **2026-08-14 (self-contained `pnpm deploy` release — NEW deploy method):**
  Deployed release `20260814120000` to `DonerDesk.online` using the simplified
  self-contained release procedure. This supersedes the manual overlay method:
  the release is built entirely off-host with `pnpm --filter @donordesk/api
  deploy --legacy` + `pnpm --filter @donordesk/web deploy --legacy` into one
  directory, bundled as a single tarball, uploaded once, extracted into an
  immutable release dir, and switched with one symlink + restart. Steps executed:
  1. `pnpm -r build` (all 9 workspace packages typecheck + build green).
  2. `pnpm --filter @donordesk/api deploy --legacy /tmp/dd-release` (API dist +
     prod deps incl. `@donordesk/*` workspace packages, self-contained).
  3. `pnpm --filter @donordesk/web deploy --legacy /tmp/dd-release/apps/web`
     (Next.js standalone `.next` incl. static + prod deps, self-contained;
     verified `next` resolves inside the deploy's `.pnpm` store — no host
     installs, no shared-`node_modules` fallback).
  4. Copied `packages/infrastructure/prisma/` into the release; copied
     `.next/standalone/apps/web/server.js` up to `apps/web/server.js` so the
     systemd `WorkingDirectory`+`node server.js` contract is preserved.
  5. **Prisma runtime fix:** `pnpm deploy` does not carry the *generated*
     Prisma client (`.prisma/client` with the query engine binary) or the
     `@donordesk/infrastructure → @prisma/client` dependency symlink. Copied
     `.prisma/client` from the workspace store into the deploy's
     `.pnpm/@prisma+client@5.22.0.../node_modules/.prisma/client/` and symlinked
     `node_modules/@donordesk/infrastructure/node_modules/@prisma/client` →
     the deploy's own `.pnpm/@prisma+client@.../node_modules/@prisma/client`.
  6. Staged superadmin (unchanged) by copying it directly on the host from
     `20260813190000`; uploaded the ~245 MB tarball (API+web+prisma), extracted
     into `releases/20260814120000`.
  7. Migrations: fixed the stale `20260814000000_superadmin_control_plane`
     record (`finished_at` was NULL from the earlier failed run) by marking it
     applied in `_prisma_migrations`; `prisma migrate deploy` then reported
     "No pending migrations".
  8. Smoked staged API on `127.0.0.1:4009` (health/ready OK with the shared
     `api.env`; DB ok) and staged web on `127.0.0.1:3009` (login 200, CSS 200).
  9. Switched `current` → `20260814120000`; restarted `donordesk-api`,
     `donordesk-web`, `donordesk-superadmin`.
  Verified live: API loopback `4001` (`/health`+`/ready` OK), web loopback
  `3002` (200, CSS 200), superadmin `3012` (200), public HTTPS `/`, `/login`
  and CSS all 200, `/v1/auth/google` route live (400 on empty body = route
  registered), google auth web routes present. `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`
  remains false at build → the login button is off until the Google OAuth
  client is provisioned and the web is rebuilt with it. No changes to the
  shared `api.env`; secrets stay under `/opt/donordesk/shared/` (0600).
  Rollback: `ln -sfn /opt/donordesk/releases/20260813190000 /opt/donordesk/current`
  && `systemctl restart donordesk-api donordesk-web donordesk-superadmin`.
  **Previous releases relied on a stale shared `/opt/donordesk/node_modules`
  (npm-installed prisma from the 2026-08-12 install) — the new method removes
  that dependency entirely.**

- **2026-08-13 (SuperAdmin control plane staged):** Deployed immutable release
  `20260813143000`, applied the additive platform control-plane tables, and enabled
  `donordesk-superadmin.service` on loopback `127.0.0.1:3012`. The API exposes a
  separate `/superadmin/*` identity boundary: tenant roles cannot authenticate,
  credentials/configuration secrets are AES-256-GCM encrypted, login is lockout
  protected, and TOTP MFA is mandatory. The sole initial account is
  `mnpiracha@gmail.com`; its randomly generated one-time password is held at
  `/root/donordesk-superadmin-initial.txt` (0600) and is not stored in source or
  this document. Unauthenticated API verification returns 401. Public
  `sa.donerdesk.online` routing/TLS awaits the separately approved shared
  OpenLiteSpeed vhost change; the application remains loopback-only until then.

- **2026-08-13 (Kestra enabled and integrated):** Resolved the schema blocker:
  Kestra's core Flyway command is `sys database migrate`, and its datasource must
  be named `datasources.postgres` (using `default` produced a misleading no-op
  success). Applied 53 migrations through v1.57 and verified `service_instance`.
  Corrected the Micronaut main/management listeners to loopback 8093/8094, loaded
  pinned `plugin-script-python` 1.3.1, initialized strong Basic Auth, and enabled
  `donordesk-kestra.service` with `-Xmx1g` and eight worker threads. Deployed seven
  versioned flows. Separated API and worker internal tokens in the Kestra secret
  environment (Kestra OSS secrets are Base64-encoded). Verified an end-to-end
  Kestra→worker execution (`SUCCESS`) and a signed Kestra→API readiness execution
  (`SUCCESS`), plus all four systemd services active and management health `UP`.
  Created scoped immutable release `20260813081200` from the prior production
  release, replacing only the compiled Kestra queue/outbox files. Set
  `JOB_QUEUE=kestra` plus loopback URL and Basic Auth in `api.env`, switched the
  `current` symlink atomically, and restarted only `donordesk-api`. The production
  `KestraJobQueue` smoke created execution `1cbxfrqNrj7c3Iyoj05w4m`, which reached
  `SUCCESS`. Rollback release remains `20260813064828`.

- **2026-08-13 (Kestra plugins deployed — API + SuperAdmin; flows gated):**
  Deployed release `20260813190000` to `DonerDesk.online` (commit `ea3ac0d`).
  Built off-host with pnpm 10.34.5; created the release by copying `20260813174000`
  and overlaying: `dist/routes/internal.js` + `superadmin.js` (new signed routes
  `/internal/evidence/:id/content`, `/internal/evidence/upload`, and
  `/superadmin/kestra`), the `@donordesk/contracts` dist (`InternalEvidenceUploadSchema`,
  via the pnpm store symlink), and a rebuilt `superadmin/` standalone with the
  **Kestra plugins** tab (relocated `.pnpm` store layout). Smoke-tested staged API
  on `127.0.0.1:4009` (health/ready OK, `/internal/*` + `/superadmin/kestra` → 401)
  and staged superadmin on `3013` (200) before switching `current` atomically and
  restarting `donordesk-api` + `donordesk-superadmin` (web/workers unchanged).
  Verified live: all five services active, API loopback `4001`, superadmin `3012`,
  `/superadmin/kestra` 401, public HTTPS `/` + `/login` 200, no new journal errors.
  **Gated (not deployed):** the five plugin-referencing flows (`evidence_parse`,
  `period_cache`, `analytics_snapshot`, `gdrive_ingest`, `sftp_ingest`) and the
  plugin JARs were NOT deployed. A `sync-flows.sh` run hung Kestra when creating
  `analytics_snapshot` (references the not-yet-configured `donordesk` datasource
  and unloaded JDBC plugin); Kestra was restarted and recovered, and the original
  seven flows are intact. Per `imp/KESTRA-PLUGINS.md`, stage/verify the pinned
  plugin JARs against Kestra 1.3.30 and add the `donordesk` datasource to the
  deployed `kestra.application.yml` before deploying those flows. The 5 new flow
  YAMLs remain committed in `workflows/kestra/`.
  Rollback: `ln -sfn /opt/donordesk/releases/20260813174000 /opt/donordesk/current`
  && `systemctl restart donordesk-api donordesk-superadmin`.

- **2026-08-13 (workers enabled; Kestra staged but blocked):**
  - **Workers — ENABLED and verified.** Created venv
    `/opt/donordesk/workers/.venv` (Python 3.12 — 3.11 is not on the host), installed
    deps, created `/opt/donordesk/shared/workers.env` (INTERNAL_TOKEN, 0600), installed
    `donordesk-workers.service` (loopback `127.0.0.1:8092`, `donordesk` user), enabled it.
    Verified: `active`, `/health` + `/ready` OK, `/v1/*` → 401 without token, 200 with token.
  - **Kestra — staged/configured but NOT enabled.** Installed `openjdk-21-jre-headless`
    (Kestra 1.3.30 is compiled for Java 21; Java 17 was insufficient). Created role/db
    `donordesk_kestra`. Staged `kestra-1.3.30` (SHA-256 verified) under
    `/opt/donordesk/kestra/` with config at `.kestra/config.yml` (loopback `127.0.0.1:8093`,
    PostgreSQL datasource `datasources.default`, JVM capped `-Xmx1g` via `kestra.env`).
    The datasource connects to PostgreSQL. **BLOCKED:** `kestra migrate` in 1.3.30 is a
    group command (subcommands `default-tenant`, `metadata` only) and does not run the core
    schema migrations; `server standalone` does not auto-migrate, so it fails at
    `relation "service_instance" does not exist`. The Kestra service is **not enabled**
    (no unit installed, no process running) — bringing it up requires an operator to run the
    pinned-version migration in a non-prod environment or obtain the correct 1.3.30 migrate
    invocation. All stray load-test JVM processes were killed; host RAM restored.
  - Host safety: only Java 17/21 JREs were installed (additive, not in the DON'T-upgrade
    list); all existing services remained active throughout.

- **2026-08-13 (deploy latest code — Kestra plan Phases A–E):** Deployed release
  `20260813064828` to `DonerDesk.online`. Built off-host with pnpm 10.34.5
  (`pnpm --filter @donordesk/api deploy --legacy`) + web standalone (unchanged,
  copied from `20260812224500`) + `prisma/`. Steps executed on the host:
  1. Staged under `/opt/donordesk/releases/20260813064828.staging`; verified the
     new artifacts (`dist/routes/internal.js`, `dist/middleware/internal.js`,
     `@donordesk/infrastructure/dist/jobs/`, `.../events/outbox-event-bus.js`).
  2. `prisma migrate deploy` applied `20260813000000_idempotency`
     (`IdempotencyRecord`) as `donordesk_migrator` (loopback trust); verified in
     `_prisma_migrations`.
  3. Applied updated `infra/postgres/rls.sql` (23 tenant tables incl.
     `IdempotencyRecord`); RLS enabled+forced, `donordesk_app` DML grants verified.
  4. Added `INTERNAL_TOKEN` + `INTERNAL_HMAC_SECRET` to `/opt/donordesk/shared/api.env`.
  5. Smoked staged API on `127.0.0.1:4009` (health/ready OK, DB ok; `/v1/ping` 401).
  6. Switched `current` → `20260813064828`; restarted `donordesk-api` (web
     unchanged, left running).
  Verified: API binds `127.0.0.1:4001` (loopback fix live — was `0.0.0.0`), web
  `127.0.0.1:3002`, `/health`+`/ready` OK, `/internal/evidence/x` → 401 (auth
  active), public HTTPS `/` and `/login` 200, no journal errors.
  Rollback: `ln -sfn /opt/donordesk/releases/20260812224500 /opt/donordesk/current`
  && `systemctl restart donordesk-api`.
  Remaining gated: enable `donordesk-workers` (venv + systemd, 8092) and
  `donordesk-kestra` (after JVM load-test, 8093); schedule `scripts/backup.sh`.

- **2026-08-13 (Phase F verification — Kestra plan):** Full regression passed
  locally: `pnpm -r typecheck` (0 errors), builds (contracts/application/
  infrastructure/api), tests (contracts 9, application 8, infrastructure 27+1
  skip, api 19, workers 28), `ruff`, `mypy`, `git diff --check`. Flow YAMLs
  validated. Runtime-only checks (end-to-end Kestra flow execution,
  interruption/retry, prod RLS isolation) are gated on the Phase E deploy.
  **Contabo code comparison:** production is on release `20260812224500`; the
  Phase A–D artifacts (`dist/routes/internal.js`, `dist/middleware/internal.js`,
  workers `parsers.py`/`tagging.py`, `dist/jobs/`, `dist/events/outbox-event-bus.js`)
  are all **MISSING** and workers/Kestra services are absent. **Contabo does NOT
  yet have the latest code** — deployment is the gated Phase E step.

- **2026-08-13 (Phase E preparation — Kestra orchestration):** Prepared the
  repo-side deployment toolchain for Kestra + workers on Contabo; **no live
  service was installed or enabled** (that remains a gated operator step).
  Read-only preflight evidence (2026-08-13 08:19 CEST):
  - OS Ubuntu 24.04.4, kernel 6.8.0-124-generic; RAM 6.4 GiB available;
    root disk 25 GiB free (75% used); load ~0.76.
  - **Port 8080 is OCCUPIED by the hermes-sidecar** (`uvicorn`, pid 23405,
    `127.0.0.1:8080`). 8081/8082/8091 loopback and 8090 public are also
    occupied. **8092 (worker) and 8093/8094 (candidates) are free.**
  - Kestra's planned `127.0.0.1:8080` is therefore NOT available; the prepared
    Kestra config binds **`127.0.0.1:8093`** (configurable via
    `infra/kestra/kestra.application.yml`).
  - API still binds `0.0.0.0:4001` (loopback fix prepared in code); web binds
    `127.0.0.1:3002`.
  - `donordesk-api` and `donordesk-web` active; `donordesk-workers` and
    `donordesk-kestra` inactive (not installed).
  Prepared artifacts: `apps/api/src/server.ts` loopback fix (`HOST`, default
  `127.0.0.1`); `infra/systemd/donordesk-workers.service`,
  `infra/systemd/donordesk-kestra.service`; `infra/kestra/` (pinned config +
  `setup-kestra-db.sh` + `install-kestra.sh`); `scripts/preflight.sh`,
  `scripts/verify.sh`, `scripts/backup.sh`, `scripts/deploy.sh`,
  `scripts/rollback.sh`. All shell scripts pass `bash -n`.
  Gated next steps: create `donordesk_kestra` role/db (`setup-kestra-db.sh`),
  stage pinned Kestra + load-test JVM, enable `donordesk-kestra`, enable
  `donordesk-workers`, deploy the next release (loopback API), schedule the
  off-host backup (`backup.sh`).

- **2026-08-12 (dashboard parity + My Work runtime fix):** Deployed web-only
  release `20260812224500` to `DonerDesk.online`. Root cause of the missing
  dashboard widgets was not browser cache or Contabo serving an old build: the
  deployed dashboard route still rendered the thinner Phase 3 home screen and
  never loaded the richer work/readiness/queue data. Fixes:
  - Dashboard now renders My Work preview, readiness snapshot, deadline bands,
    evidence review queue, compliance blockers, activity updates, richer recent
    project cards, notifications, and setup/storage notices.
  - Dashboard read model now carries reporting-period `readinessScore` into the
    home screen rather than omitting it.
  - Removed the redundant body-level `+ New project` action in favor of the
    operational My Work action, while the shell Create menu remains available.
  - Fixed a production runtime error on `/my-work`: the page was a Server
    Component but passed an `onChange` handler to a `<select>`. Replaced the
    project selector with server-rendered filter links.
  - Frontend-only release; no database migration and no API restart. The release
    copied the existing API forward and replaced only `/opt/donordesk/current/apps/web`.
  Verified locally: `pnpm --filter @donordesk/web typecheck`, unit tests
  (23 files), `pnpm --filter @donordesk/web build`, and `git diff --check`.
  Verified production: `current` points to `/opt/donordesk/releases/20260812224500`,
  `donordesk-web` active, `127.0.0.1:3002` listening, loopback `/dashboard` and
  `/my-work` return authenticated redirects, public HTTPS `/dashboard` redirects
  to `/login?next=%2Fdashboard`, `/login` returns 200, and the deployed server
  bundle contains the new dashboard sections. Rollback: repoint `current` to
  `releases/20260812220349` and restart `donordesk-web`.

- **2026-08-12 (compliance, evidence, indicators, reports export, settings, team):** Deployed release
  `20260812220349` (commit `b11bff1`) to `DonerDesk.online`. New features:
  - Add compliance page for project compliance tracking
  - Add evidence page for evidence management
  - Add indicators CRUD page with edit functionality
  - Add reports export page with multiple format support (PDF, Excel, CSV)
  - Add project settings page
  - Add team management page
  - Add standalone reports page
  - Update AppShell with new navigation items
  - Add Tabs component for indicator display
  - Update project-queries with new data fetching functions
  - Add seed-dummy-projects for development data
  Built with pnpm 10.34.5, deployed via tarball upload. Fixed TypeScript
  errors in seed-dummy-projects.ts (added non-null assertions for parentOutcome,
  parentOutput, targetLogframeItem). Updated systemd service WorkingDirectory
  paths to match new directory structure (API: `/opt/donordesk/current`,
  Web: `/opt/donordesk/current/apps/web`). Both services restarted successfully.
  Verified: loopback health/ready OK, public HTTPS 200 on `/`, `/login`,
  `/signup`. Rollback: repoint `current` to `releases/20260812181200`.

- **2026-08-12 (portal frontend + API use-cases):** Deployed release
  `20260812181200` (commit `45a1c96`) to `DonerDesk.online`. Portal-based web
  refactor (route group `(portal)`, shared components, features, server actions,
  `lib/server` + `lib/client` split) plus new API use-cases (get-activity,
  get-evidence, get-export-preflight, get-report-draft + DTOs). No Prisma schema
  change (only migration `20260812000000_init` remains; verified schema identical
  to the hoisted client). API and web both rebuilt off-host with pnpm 10.34.5;
  API via `pnpm deploy --legacy` (stripped `.env`/`dev.db`), web standalone with
  `NEXT_PUBLIC_API_URL=/api` and `.next/static` copied into the standalone
  layout. `current` symlink atomically switched to
  `releases/20260812181200`; `donordesk-api` and `donordesk-web` restarted.
  Smoke-tested staged API/web on temp ports (health/ready OK, DB ok), then
  verified loopback + public HTTPS 200s on `/`, `/login`, `/signup`, `/dashboard`
  (307 unauth redirect), all `/v1/*` routes registered, static chunks 200, no new
  journald errors. All browser/server API traffic resolves server-side to
  `http://127.0.0.1:4001` via `/v1/*` (the OLS `/api` proxy and
  `NEXT_PUBLIC_API_URL=/api` are not used for live calls, so `/api/health` 404 is
  expected). Rollback: repoint `current` to `releases/20260812163749`.

- **2026-08-12 (theme deployment):** Deployed global light/dark theming release
  `20260812163749` to `DonerDesk.online`. Frontend-only change (no Prisma
  migration). Web standalone rebuilt off-host with `NEXT_PUBLIC_API_URL=/api`
  and packaged per the established layout; `api/` + `prisma/` copied unchanged
  from the previous release. `current` symlink switched to
  `releases/20260812163749`; `donordesk-web` restarted; `donordesk-api` not
  touched. Verified loopback and public HTTPS 200s on `/`, `/login`, `/signup`;
  theme script, toggle markup, and dark-variant CSS present in served HTML/CSS.
  See `memorybank/features.md` for the full implementation note.

- **2026-08-12 (fix deploy):** Fixed signup/login 500 errors at `DonerDesk.online`
  (release `20260812115010`). Root causes and fixes:
  - **Web server actions hit a wrong API URL.** `auth-actions.ts` and `api.ts`
    now resolve a server-only `API_INTERNAL_URL` (default `http://127.0.0.1:4001`)
    ahead of `NEXT_PUBLIC_API_URL`; web service drop-in sets
    `API_INTERNAL_URL=http://127.0.0.1:4001`.
  - **OLS duplicated the `Origin` header** on proxied requests, so Next.js server
    actions parsed `req.headers['origin']` as `'https://donerdesk.online, https://donerdesk.online'`
    and `new URL()` threw `ERR_INVALID_URL`. Added `apps/web/src/middleware.ts`
    to dedupe a comma-joined `Origin` header on `/signup`, `/login`, `/logout`.
  - **Audit append broke on the advisory lock.** `pg_advisory_xact_lock()`
    returns `void`, which `prisma.$queryRaw` cannot deserialize. Cast the result:
    `SELECT pg_advisory_xact_lock(...)::text AS lock` in
    `packages/infrastructure/src/repositories/support.ts`.
  - **RLS/privileges were never applied** after the initial migration. Ran the
    RLS SQL (all 28 tenant tables) to grant `donordesk_app` DML and enable/force
    RLS, and granted `BYPASSRLS` to `donordesk_migrator` so the auth/admin
    connection (login/signup before a tenant is known) can still read globally.
    Verified tenant isolation: `donordesk_app` sees only its own `app.current_tenant`
    rows; runtime `donordesk_app` is NOT `BYPASSRLS`.
  - End-to-end verified on production: signup → dashboard, login → dashboard,
    `/v1/organization`, `/v1/projects`, tenant isolation; zero console errors.
  - **Outstanding:** API binds `0.0.0.0:4001` instead of `127.0.0.1:4001`.

- **2026-08-12 (deployment):** Deployed DonorDesk to production at `DonerDesk.online`.
  - Created `donordesk` system user, `/opt/donordesk` directory structure
  - Created `donordesk_migrator` and `donordesk_app` PostgreSQL roles and `donordesk` database
  - Created OLS vhost `/usr/local/lsws/conf/vhosts/donerdesk.online/vhost.conf`
  - Issued Let's Encrypt certificate for `DonerDesk.online` (expires 2026-11-10)
  - Deployed release `20260812130000` via `pnpm deploy --legacy` + tarball upload
  - Applied Prisma migration `20260812000000_init`
  - Created systemd services `donordesk-api` and `donordesk-web`
  - Both services running; TLS endpoint responding at `https://DonerDesk.online`
  - **Outstanding:** API binds `0.0.0.0:4001` instead of `127.0.0.1:4001`

- **2026-08-12:** Replaced the stale NeureCore-only snapshot with a read-only
  live-host inventory and DonorDesk-specific coexistence rules. Corrected OS,
  runtime, PM2, ports, PostgreSQL, Redis, OLS, firewall, TLS, Docker, and backup
  assumptions. No remote state was modified.
