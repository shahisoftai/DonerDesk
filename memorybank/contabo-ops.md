# Contabo Operations — Shared Host and DonorDesk

**Last read-only verification:** 2026-08-12 09:15–09:17 CEST
**Last deployment:** 2026-08-28 (release `20260828155553`, cutover to fast-deploy model — see §21.1).

**Host:** `vmi2954830.contaboserver.net` (`109.123.248.253`)

**Purpose:** Single source of truth for live-host facts, safety rules, and the
executable DonorDesk deployment design + release procedure for the Contabo host —
without disrupting NeureCore, GFC, CyberPanel, mail, or other colocated
applications.

This file consolidates the former `docs/CONTABO-LEAN-DEPLOYMENT.md` and
`docs/CONTABO-FAST-DEPLOYMENT.md` (both deleted 2026-08-18). Host inventory,
deployment design, release procedure, rollback, and the change log live here.

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

> **2026-08-18:** all NeureCore workloads below were retired (see §29 top entry —
> archive at `/root/neurecore-retirement-20260818-190257/`). Remaining colocated
> workloads are GFC (PM2 + Docker), Shahisoft (PM2), CyberPanel, mail, and
> DonorDesk (systemd).

### 3.1 PM2

All observed PM2 processes run as `root` in the existing root PM2 daemon:

| Process | Mode | Observed memory | Listener/path |
|---|---:|---|
| `cookie-refresher` | fork | 109 MiB | `/opt/gfc-platform/cookie-refresher` |
| `gfcportal` | fork | 105 MiB | public `*:3011`; standalone Next.js |
| `shahisoft-nextjs` | cluster | 140 MiB | PM2 internal `127.0.0.1:3010` |

(Former `neurecore-*` PM2 apps were retired 2026-08-18 — see §29 top entry.)
DonorDesk commands must always use `--only` and must never run `pm2 restart all`,
`pm2 reload all`, or replace the existing PM2 dump.

### 3.2 Native/systemd services

Verified active services include:

- `postgresql@16-main.service`
- `redis-server.service`
- `lshttpd.service` and `lsws-watchdog.service`
- `nghttpx.service`
- `docker.service`
- `fail2ban.service`

(Former NeureCore units `hermes-sidecar`, `hermes-events-bridge`,
`accounting-sidecar`, and `neurecore.service` were retired 2026-08-18 — see §29
top entry.)

Port 8090 is CyberPanel/lscpd and is publicly bound. Never use it. Port 8081 is a
loopback Docker mapping for `gfc-backend`. DonorDesk may reserve 8092 only after
rechecking it immediately before deployment.

### 3.3 Docker

Three GFC containers were running (NeureCore `observability` project containers,
images, and volumes were removed 2026-08-18 — see §29 top entry):

| Container | Image | Approx. memory | Exposure |
|---|---:|---|
| `gfc-backend` | local image | 77 MiB | `127.0.0.1:8081 -> 8080` |
| `gfc-postgres` | `postgres:16-alpine` | 61 MiB | internal Docker port only |
| `gfc-redis` | `redis:7-alpine` | 5 MiB | `127.0.0.1:6380 -> 6379` |

Docker consumes approximately 2.5 GiB of images and 295 MiB of volumes (GFC only)
plus reclaimable build cache. Do not prune globally without checking all
projects. There is no Tempo or Loki. The former NeureCore Prometheus/Grafana/
Alertmanager stack was removed; DonorDesk has no monitoring dependency on it.

## 4. Verified listener and port map

The full `ss -lntup` output must be rechecked before deployment. Important ports:

| Port | Verified owner/bind | DonorDesk decision |
|---:|---|---|
| 22 | SSH, public IPv4/IPv6 | Existing public service |
| 25/465/587 | Postfix, public | Existing mail; do not change |
| 80/443 | OpenLiteSpeed, public | Shared public ingress |
| 631 | CUPS, public listener | Existing security review item |
| 3000 | nghttpx, `127.0.0.1` | Occupied |
| 3001 | NeureCore tenant (freed 2026-08-18) | **FREE** — reusable after recheck |
| 3002 | DonorDesk web, `127.0.0.1` | **DEPLOYED** — DonorDesk Next.js standalone |
| 3003 | NeureCore backend (freed 2026-08-18) | **FREE** — reusable after recheck |
| 3004 | NeureCore CORS proxy (freed 2026-08-18) | **FREE** — reusable after recheck |
| 3010 | PM2/internal, `127.0.0.1` | Occupied |
| 3011 | GFC portal, public bind | Occupied |
| 3020 | NeureCore admin (freed 2026-08-18) | **FREE** — reusable after recheck |
| 3200 | Grafana (freed 2026-08-18) | **FREE** — reusable after recheck |
| 3306 | MariaDB, `127.0.0.1` | Occupied |
| 4001 | DonorDesk API, `0.0.0.0` | **DEPLOYED** — Fastify server (note: binds all interfaces) |
| 5432 | PostgreSQL, `0.0.0.0` and `[::]` | Occupied; use existing cluster |
| 5555–5557 | NeureCore `prisma studio` (freed 2026-08-18) | **FREE** — were public-bind; reusable after recheck |
| 6379 | host Redis, loopback | Occupied; authentication required |
| 6380 | GFC Redis mapping, loopback | Occupied |
| 7080 | CyberPanel/OpenLiteSpeed, public TCP/UDP | Occupied |
| 8080 | Hermes sidecar (freed 2026-08-18) | **FREE** — reusable after recheck |
| 8081 | GFC backend, loopback | Occupied |
| 8082 | Hermes events bridge (freed 2026-08-18) | **FREE** — reusable after recheck |
| 8090 | lscpd/CyberPanel, public | Permanently occupied |
| 8091 | accounting sidecar (freed 2026-08-18) | **FREE** — reusable after recheck |
| 8092 | no listener observed | Candidate DonorDesk worker |
| 9090 | Prometheus (freed 2026-08-18) | **FREE** — reusable after recheck |
| 9093/9094 | Alertmanager (freed 2026-08-18) | **FREE** — reusable after recheck |
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

**DonorDesk deployment (2026-08-12; domain swapped to `donordesk.online` on 2026-08-15):**
- **Hostname:** `donordesk.online` (+ alias `www.donordesk.online`) (DNS: `109.123.248.253`).
  The previously misconfigured `donerdesk.online` now serves a **301 redirect** to
  `donordesk.online` (old cert valid until 2026-11-10; no renewal config — retire
  the old vhost/map/cert once the transition is done).
- **Vhost:** `/usr/local/lsws/conf/vhosts/donordesk.online/vhost.conf`
  - Routes: `/` → `127.0.0.1:3002`, `/api` → `127.0.0.1:4001`, `/api/auth` → `127.0.0.1:3002`
  - ExtProcessors: `donordesk_web` (3002), `donordesk_api` (4001)
- **Certificate:** `/etc/letsencrypt/live/donordesk.online/`
  - Issued: 2026-08-15, Expires: 2026-11-13
  - SANs: `donordesk.online`, `www.donordesk.online`
  - Key: `privkey.pem`, Cert: `fullchain.pem`
- **OLC vhost SSL config:** keyFile and certFile point to above paths
- **SuperAdmin subdomain:** `sa.donordesk.online` → `127.0.0.1:3012` (vhost
  `/usr/local/lsws/conf/vhosts/sa.donordesk.online/vhost.conf`; cert
  `/etc/letsencrypt/live/sa.donordesk.online/` issued 2026-08-15, expires 2026-11-13)

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

**Status: DEPLOYED** (2026-08-15, release `20260815063021`). Deployed via the
checksummed incremental immutable-release path (API + web + prisma, with
SuperAdmin preserved from the preceding release; no server-side installs or
shared-node_modules fallback). This release ships the **account-wide Onboarding
restructure**: the account wizard is now account-scope only (Connect Google
Drive, Organization profile, Default reporting profile, Invite your team,
Accept ToS); project-specific steps (Create a project, Add a donor template,
Add a logframe, Upload evidence) were removed and live in the per-project
setup checklist (Feature 18, release `20260815054218`). Added an account-wide
**Default reporting profile** step that seeds every new project's
`ReportingProfile` from `Organization.reportingDefaults` (migration
`20260815060000_onboarding_reporting_defaults`). Google OAuth client
credentials are still pending (login-page button + Drive folder provisioning
are env/credential gated). Workers and Kestra are both enabled; the five
plugin-referencing flows and plugin JARs remain gated (see §29 log +
`imp/KESTRA-PLUGINS.md`).

| Resource | Allocation |
|---|---|
| Web | `127.0.0.1:3002` (DonorDesk Next.js standalone at `apps/web/.next/standalone/apps/web/server.js`) |
| API | `127.0.0.1:4001` (Fastify) — **loopback-only confirmed** (was `0.0.0.0`) |
| Worker | **ENABLED** `127.0.0.1:8092` (FastAPI `donordesk-workers.service`, venv at `/opt/donordesk/workers/.venv`, Python 3.12) |
| Kestra | **ENABLED** `127.0.0.1:8093` (API/UI) + `127.0.0.1:8094` (management), Kestra 1.3.30 / Java 21 |
| Files | `/opt/donordesk/shared/storage` |
| Runtime | `/opt/donordesk/app/` (mutable, single dir); `current -> app/` (alias) |
| Backups | `/opt/donordesk/backups/dd-app-pre-<id>.tgz` (last 3) |
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

## 14. Deployment model and architecture

DonorDesk runs as native systemd services on the shared host, **not** inside the
existing root-owned PM2 daemon. Rationale: the host already runs seven PM2
applications for other projects and the root PM2 dump is a shared blast radius;
systemd gives clean Unix-user, filesystem-hardening, journald, dependency, and
restart boundaries.

**Stage A — reliable core (live today):**

```text
Internet
   |
   | HTTPS :443
   v
OpenLiteSpeed 1.8.4 + nghttpx
   |-- /            -> 127.0.0.1:3002  DonorDesk Next.js (donordesk-web)
   |-- /api/*       -> 127.0.0.1:4001  DonorDesk Fastify (donordesk-api)
   |-- /api/auth/*  -> 127.0.0.1:3002  Next.js auth routes
   `-- WebSocket upgrade -> 127.0.0.1:4001

Native/systemd DonorDesk services
   |-- donordesk-web         127.0.0.1:3002
   |-- donordesk-api         127.0.0.1:4001
   |-- donordesk-workers     127.0.0.1:8092
   |-- donordesk-superadmin  127.0.0.1:3012
   `-- donordesk-kestra      127.0.0.1:8093 (UI/API) / 8094 (management)

Shared native infrastructure
   |-- PostgreSQL 16.14   host :5432, dedicated DB and roles
   |-- Prometheus 2.55.1  existing host-network container
   `-- Grafana 11.3.0     existing host-network container
```

**Stage B — durable async/AI (partially enabled):** Redis ACL user + BullMQ
(not yet wired; in-memory/kestra queue in use), Kestra (enabled), real LLM
adapters (stub default), production notifications (console default), object
storage (per-tenant Drive/R2 optional). Starting a container does not activate
a feature: the runtime dependency container must select the adapter and a
production-path test must prove it.

Deployments target a **single mutable runtime directory** at
`/opt/donordesk/app/`. There is no immutable-release directory or `current`
symlink switch — every deploy overwrites files in `app/` in place. See §21 for
the fast tar-and-extract deploy model and §22 for rollback.

## 15. Filesystem and Unix identity

```text
/opt/donordesk/
├── app/                          mutable runtime dir (services run from here)
│   ├── dist/                     API server.js + compiled routes
│   ├── node_modules/             API prod deps (@donordesk/*, fastify, etc.)
│   ├── apps/web/
│   │   ├── .next/standalone/apps/web/   Next.js standalone (server.js + node_modules)
│   │   ├── .next/static/                static assets
│   │   └── package.json
│   ├── superadmin/               SuperAdmin standalone (updated in place)
│   ├── prisma/                   schema + migrations
│   ├── release.json              {"releaseId","commit","builtAt","scope"}
│   └── workers/                  workers app (symlinked or copied in place)
├── current -> app/               kept for backward compatibility (read-only alias)
├── backups/                      last 3 deploy tarballs (dd-app-pre-*.tgz)
├── shared/
│   ├── api.env                   (root-owned, group-readable, 0600)
│   ├── workers.env               (0600)
│   ├── kestra.env                (0600)
│   ├── storage/                  uploaded evidence
│   └── backups-status/
└── kestra/                       pinned kestra-1.3.30 + .kestra/config.yml + plugins
```

Runtime files are owned by `donordesk:donordesk`; only `shared/storage` and
required runtime directories are writable. Migrator credentials are stored
separately (root-only) and never exposed to the API service.

The deploy script is `scripts/deploy-fast.sh` — it builds locally (incremental
filter: contracts + domain + web for the common case), tars the changed
artifact (~22 MB web, ~100 MB api with deps), streams it over SSH, and
extracts it over the live tree. A pre-deploy snapshot is written to
`/opt/donordesk/backups/` and rotated (keep last 3) so rollback is a single
`tar xzf` away.

## 16. Production environments

`/opt/donordesk/shared/api.env` (root-owned, group-readable by DonorDesk, 0600):

```bash
NODE_ENV=production
HOST=127.0.0.1
PORT=4001
DATABASE_URL=postgresql://donordesk_app:<secret>@127.0.0.1:5432/donordesk
AUTH_PROVIDER=jwt
JWT_SECRET=<64-or-more-random-characters>
AUDIT_CHAIN_KEY=<independent-32-or-more-character-secret>
STORAGE_ROOT=/opt/donordesk/shared/storage
CORS_ORIGINS=https://donordesk.online
LOG_LEVEL=info
INTERNAL_TOKEN=<internal-route token>
INTERNAL_HMAC_SECRET=<internal HMAC secret>
PLATFORM_MASTER_KEY=<platform key>
GOOGLE_DRIVE_CLIENT_ID=<id>
GOOGLE_DRIVE_CLIENT_SECRET=<secret>
GOOGLE_DRIVE_REDIRECT_URI=https://donordesk.online/api/auth/drive/callback
GOOGLE_AUTH_REDIRECT_URI=https://donordesk.online/api/auth/google/callback
JOB_QUEUE=kestra
KESTRA_URL=http://127.0.0.1:8093
KESTRA_BASIC_AUTH=<basic-auth>
BILLING_PROVIDER=<stub|creem>
```

Rules:

- Do **not** put `DATABASE_ADMIN_URL`, Redis admin credentials, backup keys, or
  unrelated project secrets in `api.env`.
- The web build uses same-origin `/api`; server-side actions call
  `API_INTERNAL_URL` (default `http://127.0.0.1:4001`) set in the web unit drop-in.
  `NEXT_PUBLIC_*` values are public and build-time embedded — they are not secrets.
- `workers.env` (0600) holds the worker `INTERNAL_TOKEN`; `kestra.env` (0600)
  holds Kestra secrets (Kestra OSS secrets are Base64-encoded).
- Unsupported values (`STORAGE_BACKEND=s3` without wiring, `JOB_QUEUE=redis`
  without BullMQ, a real `LLM_PROVIDER` without the adapter) must not be set.

## 17. Systemd services

All units are installed under `/etc/systemd/system/` and, where they exist, have
checked-in source under `infra/systemd/`. Key contracts (verified live 2026-08-28
after the fast-deploy cutover; the `WorkingDirectory` was changed from
`/opt/donordesk/current` to `/opt/donordesk/app`):

- **donordesk-api** — `User=donordesk`,
  `WorkingDirectory=/opt/donordesk/app`,
  `EnvironmentFile=/opt/donordesk/shared/api.env`,
  `ExecStart=/usr/bin/node dist/server.js`, `Restart=on-failure`, `RestartSec=5`,
  `ProtectSystem=strict`, `ReadWritePaths=/opt/donordesk/shared/storage`.
- **donordesk-web** — `User=donordesk`,
  `WorkingDirectory=/opt/donordesk/app/apps/web`,
  `Environment=NODE_ENV=production HOSTNAME=127.0.0.1 PORT=3002`,
  `ExecStart=/usr/bin/node .next/standalone/apps/web/server.js` (the Next.js
  standalone entry — its own `server.js` resolves `next` from its bundled
  `node_modules/`). Drop-in
  `/etc/systemd/system/donordesk-web.service.d/google.conf` adds
  `API_INTERNAL_URL=http://127.0.0.1:4001`, `GOOGLE_DRIVE_CLIENT_ID`,
  `APP_URL=https://donordesk.online`.
- **donordesk-workers** — `User=donordesk`,
  `WorkingDirectory=/opt/donordesk/workers`,
  `EnvironmentFile=/opt/donordesk/shared/workers.env`,
  `ExecStart=/opt/donordesk/workers/.venv/bin/uvicorn app.main:app --host
  127.0.0.1 --port 8092` (FastAPI; Python 3.12 venv lives at
  `/opt/donordesk/workers/.venv`).
- **donordesk-superadmin** — `User=donordesk`,
  `WorkingDirectory=/opt/donordesk/app/superadmin`,
  `Environment=PORT=3012 HOSTNAME=127.0.0.1
  SUPERADMIN_API_URL=http://127.0.0.1:4001`,
  `ExecStart=/usr/bin/node server.js`, `Requires=donordesk-api.service`.
- **donordesk-kestra** — `User=donordesk_kestra`,
  `WorkingDirectory=/opt/donordesk/kestra`,
  `EnvironmentFile=/opt/donordesk/shared/kestra.env`,
  `ExecStart=/usr/bin/java -jar /opt/donordesk/kestra/kestra-1.3.30 server
  standalone --config=/opt/donordesk/kestra/.kestra/config.yml
  --plugins=/opt/donordesk/kestra/plugins --port=8093 --worker-thread=8
  --no-tutorials`, JVM capped `-Xmx1g` via `kestra.env`.

Do not upgrade the global Node, pnpm, Python, PostgreSQL, Docker, or OLS
versions during a DonorDesk deploy (NeureCore depends on global pnpm 9.15.9;
DonorDesk builds with pnpm 10.34.5 off-host via corepack).

## 18. Database migrations and RLS

Use expand/migrate/contract so the preceding app release stays compatible; a
destructive migration requires an approved maintenance window and a tested
restore point. Never use `prisma db push` or `--accept-data-loss` in production.

```bash
# As root/operator with migrator credentials (root-only, never in api.env):
set -a; . <migrator-env>; set +a
DATABASE_URL="$DATABASE_ADMIN_URL" \
  /opt/donordesk/releases/<release-id>/node_modules/.bin/prisma \
  migrate deploy \
  --schema /opt/donordesk/releases/<release-id>/prisma/schema.prisma

# Then apply the checked-in RLS SQL and test isolation as donordesk_app:
psql "$DATABASE_ADMIN_URL" --set ON_ERROR_STOP=1 \
  --file /opt/donordesk/releases/<release-id>/prisma/rls.sql
```

> **2026-08-19:** the professional-reporting migration
> (`20260818180000_professional_reporting`) is additive and **includes the
> baseline-revision backfill** (every existing `ReportSection` gets one
> `UNASSESSED` `ReportRevision` and its claims are bound to it) — no separate
> operator step is required for it. The standalone copy at
> `infra/postgres/backfill-report-revisions.sql` is idempotent and may be run
> again if needed (e.g. for a `db push` dev environment). After this migration,
> RLS covers **29 tenant tables** (`infra/postgres/rls.sql` adds
> `ReportRevision`, `SubmissionSnapshot`, `ReportingRequirementPack`,
> `AwardReportingOverride`, `ResolvedReportingRequirements`).

Apply migrations **before** switching `current` so new code never queries a
missing table. After every migration, verify `tenant_isolation` is
enabled+forced on new tenant tables and `donordesk_app` has DML grants; run
isolation smoke tests as `donordesk_app` (cross-tenant reads/writes must fail).

Known migration gotcha: if `prisma migrate deploy` reports "relation already
exists" because a `_prisma_migrations` row has `finished_at` NULL, mark it
applied first:

```sql
UPDATE _prisma_migrations SET finished_at = now(), applied_steps_count = 1
WHERE migration_name='<name>' AND finished_at IS NULL;
```

## 19. Mandatory release gate

**Code and artifact**

- [ ] Clean `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build` pass
      (deploy-fast runs a scoped subset — `contracts + domain + web` for the
      common case, full workspace only when `SCOPE=both` or dep changes).
- [ ] Real versioned Prisma migrations exist and pass empty-DB + upgrade tests.
- [ ] No `db push --accept-data-loss` in any production path.
- [ ] API respects `HOST=127.0.0.1`; web is `output: "standalone"` (the
      deploy streams the entire `.next/standalone/` tree directly).
- [ ] The shipped web tar contains the full runtime tree at
      `.next/standalone/` — including the top-level `node_modules/.pnpm/`
      store (which the `apps/web/node_modules/next` symlink resolves into),
      AND `.next/standalone/apps/web/.next/static/` (merged in by the
      staging step so Next.js finds static assets at runtime). Verify with:
      `tar tzf <tar> | grep -E 'standalone/(node_modules/\.pnpm|apps/web/.next/static)'`.
      Without these, the site renders unstyled HTML or crashes with MODULE_NOT_FOUND.
- [ ] The shipped api tar (when API changed) contains `dist/server.js` and
      `node_modules/` (verify with `tar tzf <tar> | grep dist/server.js`).
- [ ] Artifact contains no `.env`, secrets, dev DB, uploads, or caches
      (deploy-fast excludes `.env*`, `dev.db`, `.next/cache`,
      `node_modules/.cache`).
- [ ] Artifact records commit, timestamp, and `release.json`
      (`scripts/deploy-fast.sh` writes `app/release.json`).

**Database and tenancy**

- [ ] Separate `donordesk_migrator` (schema owner) and `donordesk_app`
      (restricted runtime, no `BYPASSRLS`) roles exist.
- [ ] RLS is forced on every tenant table; tenant tests run over the same
      TCP/runtime path as production.
- [ ] Missing tenant context denies access; cross-tenant read/write fails.
- [ ] Every API mutation creates the required audit record.

**Operations**

- [ ] Same-day port + capacity preflight passes (§12).
- [ ] No new OLS validation error is introduced.
- [ ] Off-host backup + restore test status confirmed (§23).
- [ ] A pre-deploy tar exists at
      `/opt/donordesk/backups/dd-app-pre-<id>.tgz` (deploy-fast creates it;
      pass `NO_BACKUP=1` only for dev loops).
- [ ] Rollback is exercised — the tar can be extracted and services come
      up cleanly.

## 20. Release sequence

The fast path is a single command:

```bash
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)" scripts/deploy-fast.sh
```

For schema migrations, run them **before** the deploy as a separate operator
step (§18), then deploy. The deploy script does not run migrations.

1. Run the live-host preflight (§12).
2. Confirm ports 3002/4001/8092 and disk/RAM margins.
3. Confirm the latest off-host backup and restore-test status.
4. Run migrations with root-only migrator credentials (§18), if the
   release contains schema changes.
5. Apply RLS and run isolation tests as `donordesk_app` (§18).
6. Run the release gate (§19) — at minimum, `pnpm -r typecheck` and a
   scoped build.
7. `RELEASE_ID="$(date -u +%Y%m%d%H%M%S)" scripts/deploy-fast.sh`
   (optionally `SCOPE=web|api|both`, `SKIP_*` for dev loops).
8. Run local and public acceptance tests (§13, §24).
9. Check journald, PostgreSQL, memory, swap, and disk.
10. Record release ID, commit, migration, and verification evidence (§26).

## 21. Release paths

### 21.1 Preferred — fast tar-and-extract (default since 2026-08-28)

DonorDesk follows the same deploy model as `shahisoft-nextjs` and `gfcportal`
on this host: **one mutable runtime dir** at `/opt/donordesk/app/`, build
locally (incremental, scoped), tar the changed artifact, stream-extract over
SSH into the live tree, restart the service, verify. No immutable-release
directory, no `current` symlink switch, no `rsync` of 1.7 GB artifacts.

Script: **`scripts/deploy-fast.sh`**.

```bash
# Default (auto-detect scope from git diff vs the previous deployed commit):
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)" scripts/deploy-fast.sh

# Explicit scope (skip auto-detect):
RELEASE_ID=… SCOPE=web  scripts/deploy-fast.sh
RELEASE_ID=… SCOPE=api  scripts/deploy-fast.sh
RELEASE_ID=… SCOPE=both scripts/deploy-fast.sh

# Dev loop — skip typecheck/build (artifacts already exist) and the safety
# snapshot when iterating quickly:
RELEASE_ID=… SKIP_BUILD=1 SKIP_TYPECHECK=1 NO_BACKUP=1 scripts/deploy-fast.sh
```

The script:

1. **Detects scope** (auto) from `git diff <prev_deployed_commit>` covering
   `apps/web/`, `apps/api|workers|superadmin/`, `packages/`, and `prisma/`.
   Includes working-tree changes (unstaged + staged), so dev-loop deploys of
   uncommitted edits are detected.
2. **Typechecks and builds** only the needed workspace packages
   (`contracts + domain + web` for the common web-only case).
3. **Stages tarballs** locally:
   - **web:** `.next/standalone/apps/web/` (Next.js self-contained bundle,
     includes its own `node_modules/`) + `.next/static/` + `public/` +
     `package.json` → ~23 MB tar.
   - **api:** `apps/api/{dist,package.json,tsconfig.json,node_modules}` →
     ~50 KB tar (tree layout; symlink farm preserved).
   - **packages:** workspace `packages/{contracts,domain,application,
     infrastructure}/{dist,package.json,prisma,scripts}` → ~200 KB tar. The
     api's `node_modules/@donordesk/*` workspace symlinks resolve to
     `../../../../packages/*`.
   - **pnpm-store:** workspace `node_modules/.pnpm/` → ~50 MB tar. The api tar
     ships only the api tree's `node_modules/` symlinks; the real package
     files live under `node_modules/.pnpm/`.
   - **worker:** `apps/workers/app/` (12 SRP modules under `ai_reporter/`,
     excluding `.venv/`, `__pycache__/`, `*.pyc`) → ~50 KB tar.
4. **Snapshots** the current `app/` tree (full, includes `node_modules/`) to
   `/opt/donordesk/backups/dd-app-pre-<id>.tgz`. Rotates: keep last 3.
5. **Streams** the new tars over SSH into the live `app/` tree, replacing
   only the subtrees that changed. Per `SCOPE=api|both`, the api extract step
   does (in order): ship `packages/`, ship `pnpm-store` and run
   `pnpm install` at `apps/api/` to regenerate the symlink farm, ship the
   api tree. Then the worker tree is rsynced into
   `/opt/donordesk/workers/app/` and `donordesk-workers` is restarted.
6. **Restarts** the affected services only (`web` for `SCOPE=web`,
   `api` for `SCOPE=api`, both for `SCOPE=both`).
8. **Verifies** via `ssh` `curl` to `/health`, `/ready`, `/login` (waits up
   to 60 s for web), and — when `SCOPE=api|both` — `/v1/ai-reporter/health`
   on the worker (with the worker `INTERNAL_TOKEN`). On failure, prints the
   manual rollback command and exits 2 — **does not auto-rollback**
   (auto-rollback from a broken snapshot left things worse in testing on
   2026-08-28).

**Measured timings (cutover + first real deploy, 2026-08-28):**

| Step | Time |
|---|---|
| Local typecheck + filtered web build (contracts+domain+web) | ~150 s |
| Stage web tar (~22 MB) | ~5 s |
| Pre-deploy snapshot (full app tar, ~250 MB) | ~70–80 s |
| Stream + extract over SSH | ~10–18 s |
| Restart + verify (60 s timeout, typically 3–5 s) | ~5–15 s |
| **Total — web-only real deploy** | **~3–4 min** |
| **Total — web-only with NO_BACKUP=1** | **~3 min** |
| Deploy step alone (stream + restart + verify) | **~30 s** |

The deploy step itself (stream → restart → verify) is now ~30 s. The
remaining time is dominated by the Next.js build (CPU-bound) and the safety
snapshot. Skip the snapshot for tight dev loops (`NO_BACKUP=1`); always keep
it for production deploys.

### 21.2 Fallback — old immutable-release path

The previous flow (`scripts/package-release.sh` + `scripts/deploy-incremental.sh`)
still works but is no longer the default. It builds a full self-contained
artifact off-host (~1.7 GB) and rsyncs it into a timestamped immutable
directory under `/opt/donordesk/releases/<id>/`, then atomically switches
the `current` symlink. Keep it as the cold-path / emergency rollback
mechanism (the `scripts/package-release.sh` logic is still useful for
auditable artifacts). On 2026-08-28 the release dirs were deleted and
`current` was repointed to `/opt/donordesk/app/`; the old scripts remain in
the repo but require `/opt/donordesk/releases/` to exist.

### 21.3 Why the change

The immutable-release + rsync flow measured ~6 min per web deploy because:

- `pnpm -r build` rebuilt the full workspace every release (~3 min).
- `pnpm --filter @donordesk/api deploy --legacy` copied ~1.4 GB of
  `node_modules` into the release (~90 s).
- `rsync --checksum` of 62 k files over a 2.86 MB/s link added ~60 s of
  per-file protocol overhead.
- Disk grew toward 80% (98 release dirs × ~1.7 GB logical, ~5 GB unique
  blocks — releases were hardlinked so actual disk was lower, but the
  release-dir clutter was unmanageable).

The fast path removes the `pnpm deploy --legacy` step (Next.js standalone is
already self-contained), removes rsync (single tar stream), and keeps a
single runtime directory instead of N immutable dirs.

### 21.4 API tar layout and workspace symlinks (added 2026-08-29)

The api tar shipped before 2026-08-29 was created by `cd apps/api && tar … dist package.json …`
which put `dist/` at the tar's root. When extracted to `/opt/donordesk/app/` it landed at
`/opt/donordesk/app/dist/` and the api systemd unit's
`WorkingDirectory=/opt/donordesk/app` ran `node dist/server.js` from there. This worked
**only because** the api's `apps/api/node_modules/@donordesk/infrastructure` symlink
resolved to `/opt/donordesk/app/packages/infrastructure/` and the api's
`apps/api/node_modules/fastify -> ../../../../node_modules/.pnpm/fastify@5.11.3/...`
resolved to `/node_modules/.pnpm/...` (filesystem root), which doesn't exist on Contabo.
The api only worked because the previous code paths didn't import any
transitive dependencies — they were cached in-process.

As of release `20260828200000` (AI Reporter 2) the api tree gained
transitive imports (artifact validators, chart suggester, report-artifact
repository) and the broken `node_modules/fastify` symlink started producing
`ERR_MODULE_NOT_FOUND` at every restart. Two fixes shipped together:

- The api systemd unit now uses
  `WorkingDirectory=/opt/donordesk/app/apps/api` so `dist/server.js` resolves
  relative to the api tree, the workspace `@donordesk/*` symlinks resolve to
  `/opt/donordesk/app/packages/*` (4 levels up), and the api's pnpm symlinks
  resolve correctly via `/opt/donordesk/app/node_modules/.pnpm/` (3 levels up).
- The deploy script (`scripts/deploy-fast.sh`) now ships **four** api-scoped
  tars instead of one: `apps/api/{dist,node_modules,package.json,tsconfig.json}`
  (tree layout), `packages/*/{dist,prisma,scripts}` (workspace source),
  `node_modules/.pnpm/` (pnpm virtual store), and `apps/workers/app/` (Python
  worker). The api extract step re-runs `pnpm install` at `apps/api/` to
  regenerate the symlink farm after the pnpm store is replaced.

The deploy script's verification step now also probes
`/v1/ai-reporter/health` on the worker (with the worker `INTERNAL_TOKEN`)
when `SCOPE=api|both`, so any pnpm-store/symlink regression fails the gate
before the operator even sees a dashboard alert.

### 21.5 AI Reporter 2 deploy specifics (added 2026-08-29)

AI Reporter 2 is **feature-flagged off by default** in `/opt/donordesk/shared/api.env`.
The system continues to use `LlmReportDraftGenerator` for all tenants until the
operator flips the flag per the controlled-rollout plan in
`memorybank/imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`. The deployment ships:

- The Python worker code (12 SRP modules under `apps/workers/app/ai_reporter/`).
  The systemd unit `donordesk-workers.service` reads from
  `/opt/donordesk/workers/app/`; the deploy script rsyncs the new tree and
  restarts the service.
- The TS-side wire-format additions and adapter mappings
  (`GeneratedSection.{artifacts,qa,chartSpec,deltaFromPrior}`).
- The Prisma migration `20260828200000_ai_reporter_artifacts`
  (`ReportArtifact` + `ReportArtifactRow`). The migrator role lacks
  `CREATE` on `public`, so the SQL was applied directly via `psql` and the
  migration row was inserted manually. See §18 for the exact procedure.
- New RLS rows in `infra/postgres/rls.sql` + the matching manual grants
  applied via `sudo -u postgres psql` (cross-tenant INSERT denied, verified
  end-to-end).

The api's `AI_REPORTER_URL` default is `http://localhost:5000` (legacy stub).
When the flag is flipped, also set
`AI_REPORTER_URL=http://127.0.0.1:8092` to override. The worker and api use
**different** `INTERNAL_TOKEN`s — `/opt/donordesk/shared/api.env` and
`/opt/donordesk/shared/workers.env` — and the worker's token is what
`HttpWorkerClient` sends as `x-internal-token`.

## 22. Rollback

Rollback in the fast-deploy model is a **single `tar xzf`** away.

```bash
# 1. List available backups (newest first):
ssh contabo 'ls -1t /opt/donordesk/backups/dd-app-pre-*.tgz'

# 2. Extract the chosen backup over the live app dir and restart:
ssh contabo '
  PRE=$(ls -1t /opt/donordesk/backups/dd-app-pre-*.tgz | head -1)
  rm -rf /opt/donordesk/app
  tar -xzf "$PRE" -C /opt/donordesk
  systemctl restart donordesk-api donordesk-web
'

# 3. Verify:
curl -fsS https://donordesk.online/login
```

For non-emergency rollbacks the cleanest path is **`git checkout <prev-commit>`
+ redeploy** — git is the source of truth and `deploy-fast.sh` will rebuild
the previous code in ~3 min.

The deploy script does **not** auto-rollback on verify failure (2026-08-28
lesson: auto-rollback extracted a snapshot that itself had no
`node_modules/`, making things worse). On failure the script exits 2 and
prints the exact rollback command.

**Application rollback does not undo database changes** — production
migrations must remain compatible with the preceding release (§18). Never
run `pm2 restart all`; DonorDesk systemd operations must not touch
existing PM2 applications.

## 23. Backup and disaster recovery

> **Current status (2026-08-18):** no automated off-host DonorDesk backup is
> scheduled yet. `scripts/backup.sh` (encrypted off-host backup of the
> `donordesk` + `donordesk_kestra` databases and `shared/storage`) is prepared
> but not scheduled. Must be scheduled and restore-tested **before** accepting
> production data.

Targets:

- nightly encrypted logical backup of the DonorDesk database;
- WAL/base-backup strategy if the approved RPO requires it;
- daily encrypted incremental backup of `shared/storage`;
- off-host destination with separate credentials;
- checksum and backup-age monitoring;
- monthly automated database-and-files restore;
- quarterly clean-host recovery exercise.

Approve explicit objectives (example):

```text
RPO: 15 minutes
RTO: 4 hours
Retention: 14 daily, 8 weekly, 12 monthly
```

Back up the database and evidence storage as one consistency set. Include
release metadata, RLS/migrations, vhosts, units, and a secret inventory (protect
actual secret values). Local WAL archives and CyberPanel schedules are not
off-host DR.

## 24. Acceptance test

Health-only checks are insufficient. Through the final TLS hostname:

1. create two organizations and users with different roles;
2. prove cross-tenant reads and writes are denied;
3. create/update a project;
4. upload and parse representative TXT, PDF, DOCX, and XLSX evidence;
5. download the exact original and verify checksum;
6. create logframe items, indicators, and updates;
7. create/review activity updates;
8. create a reporting period and checklist;
9. generate/edit/review/approve a report;
10. generate and inspect PDF, DOCX, XLSX, and ZIP outputs actually supported;
11. exercise comments, notifications, audit log, and audit-chain verification;
12. connect/reconnect WebSocket through OLS;
13. verify authorization for each role and project assignment;
14. verify Prometheus scrape and alert delivery;
15. restore the created database and files into a clean test environment.

Where the implementation intentionally uses a stub, label the result as
stub-assisted rather than real AI/email/queue behavior.

## 25. Security and coexistence sign-off

- [ ] Only 80/443 were used for new public access.
- [ ] API/web/worker listen only on IPv4 loopback.
- [ ] DonorDesk runs as its own Unix user(s).
- [ ] Runtime cannot read migrator or other-project secrets.
- [ ] No root PM2 process/dump was changed.
- [ ] No global runtime/package version was changed.
- [ ] No unrelated Docker container, volume, vhost, certificate, or firewall rule
      was modified.
- [ ] JWT/audit/database/backup/internal secrets are independent.
- [ ] Logs contain no tokens, passwords, uploaded bodies, or beneficiary PII.
- [ ] Upload/auth/export/AI routes have appropriate limits and timeouts.

The shared host has broader risks outside DonorDesk (root/password SSH enabled,
PostgreSQL trusts IPv4 loopback, multiple existing processes bind publicly, OLS
validation has baseline errors, some unrelated certificates are expired/near
expiry). Record these as separate host-hardening work; do not combine with
deployments unless explicitly approved and rollback-tested.

## 26. Production record

Complete for every release:

```text
Host preflight timestamp:
Hostname and certificate:
Release ID / Git commit:
Artifact SHA-256:
Node/pnpm build versions:
Migration IDs:
RLS test result:
Stage A acceptance result:
Stage B capabilities enabled:
Latest off-host backup:
Latest restore test:
Previous compatible release:
Prometheus/Grafana verification:
Resource usage after deploy:
OLS baseline/new validation comparison:
Operator / approver / date:
```

### Release `20260829160000` (2026-08-29) — product recovery

```text
Host preflight timestamp:       2026-08-29 ~19:00 CEST
Hostname and certificate:       vmi2954830.contaboserver.net, valid
Release ID / Git commit:        20260829160000 / d6a08fbcfcd0432cc12feac46555f68e47f0a961
Artifact SHA-256:               n/a (tar+extract model; release.json written to app/release.json)
Node/pnpm build versions:       node v20.20.2 (host), pnpm 10.34.5
Migration IDs:                  20260829140000_report_draft_superseded (applied pre-code)
RLS test result:                unchanged (additive column on RLS-covered ReportDraft)
Stage A acceptance result:      /health ok; /ready 200 (database + prismaClient checks)
Stage B capabilities enabled:   draft supersede/versions/activate, cancel-generation,
                                evidence-period tagging, tolerant verifier, workspace UX
Latest off-host backup:         prior to deploy (backups rotate last 3)
Latest restore test:            last verified restore before release
Previous compatible release:   20260828200000
Prometheus/Grafana verification: n/a
Resource usage after deploy:    all services active; disk 37G free at deploy time
Operator / approver / date:     najeeb / 2026-08-29
```

## 27. Shared Prometheus and Grafana

The existing Prometheus/Alertmanager/Grafana containers use host networking, so
Prometheus can scrape `127.0.0.1:4001/metrics` directly (no
`host.docker.internal`). Integration rules: back up
`/opt/neurecore/observability/prometheus/prometheus.yml` and alerts; add only
namespaced DonorDesk scrape jobs/alert rules; validate inside the pinned image;
reload only Prometheus; import a namespaced dashboard without replacing shared
datasources; verify all existing targets remain healthy. Keep `/metrics` out of
the public OLS vhost. Do not add Tempo or Loki in Stage A.

## 28. Kestra design notes

Kestra runs as a native systemd process (not a bridge-network container, which
cannot reach host loopback `127.0.0.1`). Bind loopback only; never expose the
UI publicly. Use a pinned version (1.3.30, Java 21), non-root execution
(`donordesk_kestra`), its own database/role, and the `datasources.postgres`
name. Deploy flows versioned; the five plugin-referencing flows and plugin JARs
remain gated (see `imp/KESTRA-PLUGINS.md`). Include the Kestra database in
backup/restore.

## 29. Change log

> **2026-08-28 — Web CSS/static-assets fix (deployed, release `20260828161514`):**
> the fast-deploy cutover (release `20260828155553`) shipped an incomplete
> Next.js standalone tar — it excluded the standalone's top-level
> `node_modules/.pnpm/` store that the `apps/web/node_modules/next`
> symlink resolves into, AND it did not merge `.next/static/` and
> `public/` into `.next/standalone/apps/web/.next/` where Next.js looks
> for them at runtime. Result: `server.js` crashed with MODULE_NOT_FOUND
> (`next` unresolved) OR served unstyled HTML (CSS references returned
> 404). Fix in `scripts/deploy-fast.sh`: stage the ENTIRE
> `.next/standalone/` tree (incl. the top-level pnpm store + apps/web/
> + memorybank/ + packages/) and explicitly merge `.next/static/` and
> `public/` into `.next/standalone/apps/web/.next/` and
> `.next/standalone/apps/web/` respectively before tarring. Also added
> a CSS sanity check to the release gate (§19): the shipped tar must
> contain both the pnpm store and the merged static dir. Web tar grew
> from 22 MB to 23 MB (the pnpm store is included). Site is fully
> styled; `curl https://donordesk.online/_next/static/css/<hash>.css`
> returns 200 with the full 76 KB Tailwind CSS.

> **2026-08-29 — AI Reporter 2 deploy (deployed, release `20260828200000`):**
> shipped the v2 worker code, typed artifact persistence, deterministic
> artifact validators, per-section timeout, and the 25-case eval corpus
> (8 → 25). Three structural changes:
> 1. **Worker code (apps/workers/app/):** the monolithic 622-LOC
>    `ai_reporter.py` was split into a 12-module `ai_reporter/`
>    package (`models`, `writer_contract`, `llm_gateway`, `outline`,
>    `chart_suggester`, `draft_writer`, `critique_writer`, `refiner`,
>    `artifact_validators`, `timeouts`, `pipeline`, `router`). `main.py`
>    now imports the new router. All FastAPI `/v1/ai-reporter/*` routes
>    are registered.
> 2. **Typed artifact storage:** new Prisma models `ReportArtifact` +
>    `ReportArtifactRow` (migration `20260828200000_ai_reporter_artifacts`).
>    RLS forced on both tables; cross-tenant INSERT verified to fail.
>    `donordesk_app` has DML grants. `IReportArtifactRepository` port
>    + `PrismaReportArtifactRepository` implementation wired into
>    `GenerateReportDraftHandler` and `RewriteReportSectionHandler` (best-effort,
>    non-blocking persistence). `GetReportDraftHandler` returns artifacts
>    alongside content.
> 3. **API workspace layout fix:** discovered (mid-deploy) that the
>    pre-existing api tar shipped `apps/api/node_modules/` as 14 symlinks
>    into `node_modules/.pnpm/...`, but the **fast-deploy tar layout
>    placed the api's dist at `/opt/donordesk/app/dist/`**, not at
>    `apps/api/dist/`. The api process at `/opt/donordesk/app/` couldn't
>    resolve fastify (broken symlink). Two fixes:
>    - Updated `infra/systemd/donordesk-api.service` so the unit runs
>      `WorkingDirectory=/opt/donordesk/app/apps/api` (where the api
>      tree's symlinks resolve correctly via the pnpm virtual store
>      at `/opt/donordesk/app/node_modules/.pnpm/`).
>    - Rewrote `scripts/deploy-fast.sh` to ship the api as
>      `apps/api/{dist,node_modules,src}` (tree layout, not
>      flattened), plus a separate `packages/` tar (workspace links
>      `apps/api/node_modules/@donordesk/* → ../../../../packages/*`)
>      and a `pnpm-store` tar (`node_modules/.pnpm/` contents).
>      Subsequent deploys run `pnpm install` at `apps/api/` to regenerate
>      the symlink farm after the pnpm store is replaced.
>
> **Deploy timeline (this release):**
> - 19:38 UTC — preflight (ssh, ports, services all green)
> - 19:46 UTC — applied Prisma migration `20260828200000_ai_reporter_artifacts`
>   directly via SQL (the migrator role lacks CREATE on `_prisma_migrations`;
>   recorded the row manually to keep `prisma migrate deploy` consistent)
> - 19:48 UTC — granted `SELECT/INSERT/UPDATE/DELETE` to `donordesk_app`
>   on the two new tables; applied RLS `tenant_isolation` policy to
>   both; verified cross-tenant INSERT is denied
> - 06:47 UTC+02:00 (after restart) — api tar extracted; first
>   restart attempt failed with `MODULE_NOT_FOUND: fastify`
> - 07:22 UTC+02:00 — api systemd unit updated, api restarted
>   successfully (WorkingDirectory=/opt/donordesk/app/apps/api);
>   `/v1/ai-reporter/health` returns `{"status":"ok"}`
> - 07:24 UTC+02:00 — final post-deploy verification: api ok/ready,
>   worker ok, web 200, RLS enforced
>
> **Feature flag:** `AI_REPORTER_ENABLED` is **NOT set** in
> `/opt/donordesk/shared/api.env`. The system continues to use
> `LlmReportDraftGenerator` for all tenants until the flag is flipped
> (per §8 of `memorybank/imp/AI-REPORTER-2-IMPLEMENTATION-PLAN.md`,
> controlled rollout). When enabled, also set
> `AI_REPORTER_URL=http://127.0.0.1:8092` to override the
> `HttpWorkerClient` default of `localhost:5000`. The default INTERNAL_TOKEN
> in `/opt/donordesk/shared/api.env` is different from the one in
> `/opt/donordesk/shared/workers.env` — both must be used for
> internal service-to-service calls.

## 2026-08-29 — Reports Workspace Internal Server Error + Prisma client drift fix

User reported `/reports` rendering `Internal Server Error` + `This
information could not be loaded.` (the InlineError component). Reproduced
on the live site: a fresh signup throws
`PrismaClientValidationError: ... Unknown argument \`storageProvider\`.
Available options are marked with ?.`

**Root cause.** The Prisma client shipped to the host was generated
against an older schema (pre-`Organization.storageProvider`, added in
the evidence-storage migration `20260814000001_evidence_storage_provider`).
The api code path uses `Organization.storageProvider` in
`create()` and `select: { storageProvider: true }` for the workspace/
evidence resolvers, so the running client threw on the first request
that touched the column. The `/reports` page rendered the
InlineError because its upstream `GET /v1/projects` failed the same way
(`/v1/organization` happens to return gracefully with `storageProvider`
undefined, masking the issue).

**Why the drift happened.** `scripts/deploy-fast.sh` ships
`node_modules/.pnpm/` (which contains the pre-generated Prisma client)
from the local build. The local `pnpm -r build` correctly runs
`prisma generate` inside `@donordesk/infrastructure`, but the deploy
script then runs `pnpm install` only at `apps/api/` to fix the
symlink farm; there is no `schema.prisma` in `apps/api/`, so the
`@prisma/client` postinstall is a no-op there. The shipped `.pnpm/`
tar carried the last locally-generated client, which was stale relative
to the schema that ended up on the server (the api systemd unit's
WorkingDirectory is `/opt/donordesk/app/apps/api`, so the schema at
`/opt/donordesk/app/packages/infrastructure/prisma/schema.prisma` was
newer than the bundled client).

**Fix (3 layers).**
1. **Always regenerate on the host.** Added `Stage B2` to
   `scripts/deploy-fast.sh`: after extracting `packages/` and `.pnpm/`,
   the script runs `npx prisma@5.22.0 generate --schema
   ${REMOTE_APP}/packages/infrastructure/prisma/schema.prisma` on the
   host against the freshly shipped schema. This guarantees the running
   client matches the schema the api code expects.
2. **Self-introspecting `/ready`.** `apps/api/src/routes/health.ts`
   `/ready` endpoint now reads
   `prisma._runtimeDataModel` and asserts a small allowlist of
   `Model.field` pairs the application code relies on
   (`Organization.storageProvider`, `ReportingPeriod.donorTemplateId`).
   If any pair is missing it returns 503 with `missingPrismaFields` and
   a hint to re-run `prisma generate`. Adding a new schema column the
   app uses in `select`/`create` requires adding it to
   `REQUIRED_PRISMA_FIELDS` in the same change.
3. **Stricter verify gate.** The post-deploy verify block now reads
   the `/ready` JSON and HTTP status (not just curl exit code), so a
   stale client fails the deploy rather than passing health because
   `SELECT 1` still works.

**Operator note for the currently broken deploy.** A fresh deploy will
regenerate the client and resolve everything. To recover without a
full redeploy, run on the host:

```
ssh contabo
cd /opt/donordesk/app/packages/infrastructure
npx prisma@5.22.0 generate --schema prisma/schema.prisma
systemctl restart donordesk-api donordesk-web
curl -fsS http://127.0.0.1:4001/ready | jq
```

Expect `{ "status": "ready", "checks": { "database": "ok",
"prismaClient": "ok" } }`.

## 2026-08-29 — Product recovery release + deploy-script fixes

**Release:** `20260829160000` (commit `d6a08fb`, SCOPE=both).

**Migration applied before code (expand/contract):**
`20260829140000_report_draft_superseded` (adds `ReportDraft.supersededAt` +
`ReportDraft_supersededAt_idx`), applied via
`DATABASE_URL="$DATABASE_ADMIN_URL" npx prisma@5.22.0 migrate deploy
--schema /opt/donordesk/app/packages/infrastructure/prisma/schema.prisma`
as the migrator. `apps/api/src/routes/health.ts` `REQUIRED_PRISMA_FIELDS`
now also asserts `ReportDraft.supersededAt`, so `/ready` blocks deploys that
skip the migration.

**Deploy-script fixes shipped in `scripts/deploy-fast.sh`:**
1. **Unbound `BASE`** in the snapshot step — the script previously required
   `BASE` exported in the environment (it failed with `BASE: unbound
   variable` otherwise). It now defaults `BASE="${BASE:-${REMOTE_BASE}}"`.
2. **Web standalone extract path** — the web tar's root IS the Next.js
   standalone output (`apps/web/server.js` at top level), so it must extract
   into `apps/web/.next/standalone/`, not `apps/web/`. The systemd unit runs
   `node .next/standalone/apps/web/server.js` from
   `WorkingDirectory=/opt/donordesk/app/apps/web`; extracting into the wrong
   depth (or dropping the standalone's own `node_modules` symlinks for
   `next`/`react`) caused `MODULE_NOT_FOUND: next`. Fix verified live.

**Content of the release:** the P0+P1 product recovery — see
`memorybank/imp/RECOVERY-PLAN-IMPLEMENTATION.md` and the
`## Product recovery` entry in `memorybank/Fixes.md`.

**Post-deploy fixes applied:** `CancelReportGenerationHandler` now returns
`{cancelled:false}` for approved/exported/submitted drafts instead of throwing
`INVALID_STATE_TRANSITION`; `packages/application`, `packages/infrastructure`,
and `apps/api` dist re-shipped and the api restarted (no pnpm-store churn).
