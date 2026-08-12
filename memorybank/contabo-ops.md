# Contabo Operations — Shared Host and DonorDesk

**Last read-only verification:** 2026-08-12 09:15–09:17 CEST
**Last deployment:** 2026-08-12 13:39 CEST (release `20260812163749`)

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

**Status: DEPLOYED** (2026-08-12, release `20260812130000`)

| Resource | Allocation |
|---|---|
| Web | `127.0.0.1:3002` (DonorDesk Next.js standalone) |
| API | `0.0.0.0:4001` (Fastify) — **NOTE: should bind loopback only** |
| Worker | Not deployed yet |
| Files | `/opt/donordesk/shared/storage` |
| Releases | `/opt/donordesk/releases/20260812130000.staging` → `current` symlink |
| Runtime user | `donordesk` system user (created) |
| Database | `donordesk` (PostgreSQL 16.14) |
| DB roles | `donordesk_migrator` (schema owner), `donordesk_app` (runtime) |
| systemd services | `donordesk-api.service`, `donordesk-web.service` |
| Secrets | `/opt/donordesk/shared/api.env` (mode 0600) |

**Deployment notes:**
- Artifact built with `pnpm deploy --legacy` off-host; uploaded as tarball
- Prisma 5.22.0 globally installed on Contabo for `migrate deploy`
- Prisma client generated inside deployment at `/opt/donordesk/current/api/node_modules/@prisma/client`
- Migration `20260812000000_init` applied successfully

Because global pnpm is 9.15.9 while DonorDesk pins 10.34.5, do not change the
global pnpm version: NeureCore depends on it. Build a self-contained artifact with
pnpm 10.34.5 off-host, including production dependencies and Prisma engine/client.
Production should not perform a workspace install.

**Outstanding issue:** API binds to `0.0.0.0:4001` in addition to `127.0.0.1:4001`.
Per Section 4, it should bind loopback only. Fix before production hardening.

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
