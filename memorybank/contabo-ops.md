# Contabo Operations — Shared Host and DonorDesk

**Last read-only verification:** 2026-08-12 09:15–09:17 CEST
**Last deployment:** 2026-08-20 (release `20260820125717`, section-wise AI report generation — API + web, no migration).

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
| Web | `127.0.0.1:3002` (DonorDesk Next.js standalone) |
| API | `127.0.0.1:4001` (Fastify) — **loopback-only confirmed** (was `0.0.0.0`) |
| Worker | **ENABLED** `127.0.0.1:8092` (FastAPI `donordesk-workers.service`, venv at `/opt/donordesk/workers/.venv`, Python 3.12) |
| Kestra | **ENABLED** `127.0.0.1:8093` (API/UI) + `127.0.0.1:8094` (management), Kestra 1.3.30 / Java 21 |
| Files | `/opt/donordesk/shared/storage` |
| Releases | `/opt/donordesk/releases/20260815063021` → `current` symlink |
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

Releases are **immutable directories** under `/opt/donordesk/releases/<id>`
with an atomic `/opt/donordesk/current` symlink switch; never edit a file in a
completed release in place.

## 15. Filesystem and Unix identity

```text
/opt/donordesk/
├── current -> releases/<release-id>
├── releases/
│   └── <release-id>/
│       ├── dist/                 API server.js + compiled routes
│       ├── node_modules/         self-contained prod deps (@donordesk/*)
│       ├── apps/web/             Next.js standalone (server.js + .next)
│       ├── superadmin/           SuperAdmin standalone (preserved between releases)
│       ├── prisma/               schema + migrations
│       ├── release.json          {"releaseId","commit","builtAt"}
│       └── (workers app code updated in place, not per-release)
├── shared/
│   ├── api.env                   (root-owned, group-readable, 0600)
│   ├── workers.env               (0600)
│   ├── kestra.env                (0600)
│   ├── storage/                  uploaded evidence
│   └── backups-status/
└── kestra/                       pinned kestra-1.3.30 + .kestra/config.yml + plugins
```

Release files are root/deploy-owned and read-only to the `donordesk` service
user; only `shared/storage` and required runtime directories are writable.
Migrator credentials are stored separately (root-only) and never exposed to the
API service. `scripts/package-release.sh` assembles the self-contained directory
off-host (API `pnpm deploy --legacy` + web standalone + prisma + generated
Prisma client + release.json) and removes `.env`, `.env.*`, `dev.db`,
`*.tsbuildinfo`, sources, tests, and Next.js build caches before deploy.

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
checked-in source under `infra/systemd/`. Key contracts (verified live 2026-08-18):

- **donordesk-api** — `User=donordesk`, `WorkingDirectory=/opt/donordesk/current`,
  `EnvironmentFile=/opt/donordesk/shared/api.env`,
  `ExecStart=/usr/bin/node dist/server.js`, `Restart=on-failure`, `RestartSec=5`,
  `ProtectSystem=strict`, `ReadWritePaths=/opt/donordesk/shared/storage`.
- **donordesk-web** — `User=donordesk`,
  `WorkingDirectory=/opt/donordesk/current/apps/web`,
  `Environment=NODE_ENV=production HOSTNAME=127.0.0.1 PORT=3002`,
  `ExecStart=/usr/bin/node server.js`. Drop-in
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
  `WorkingDirectory=/opt/donordesk/current/superadmin`,
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
DonorDesk builds with pnpm 10.34.5 off-host).

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

- [ ] Clean `pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build` pass.
- [ ] Real versioned Prisma migrations exist and pass empty-DB + upgrade tests.
- [ ] No `db push --accept-data-loss` in any production path.
- [ ] API respects `HOST=127.0.0.1`; web is `output: "standalone"`.
- [ ] Artifact contains no `.env`, secrets, dev DB, uploads, sources, or caches.
- [ ] Artifact starts without a production `pnpm install` (own `.pnpm` store).
- [ ] Artifact records commit, timestamp, and release.json.

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
- [ ] Rollback to the preceding immutable release is exercised.

## 20. Release sequence

1. Run the live-host preflight (§12).
2. Confirm ports 3002/4001/8092 and disk/RAM margins.
3. Confirm the latest off-host backup and restore-test status.
4. Run the release gate (§19) and assemble the release (§21).
5. Upload/extract the release directory (or transfer deltas) without touching `current`.
6. Run migrations with root-only migrator credentials (§18).
7. Apply RLS and run isolation tests as `donordesk_app`.
8. Smoke the staged API/web on temporary loopback ports with the shared `api.env`.
9. Atomically switch `current`.
10. Restart only affected services (`donordesk-api`, `donordesk-web`,
    `donordesk-superadmin`; worker/Kestra only if changed).
11. Run local and public acceptance tests (§13, §24).
12. Check journald, PostgreSQL, memory, swap, and disk.
13. Record release ID, commit, migration, checksum, tests, and backup evidence (§26).

## 21. Release paths

### 21.1 Preferred — checksummed incremental immutable release

Build off-host, hard-link the current release into a staging directory, and use
checksummed `rsync` to replace only changed files. Then atomically switch
`current`, restart only affected services, and run bounded health checks. A
failed verification automatically restores the previous symlink and restarts the
same services. Never edit a file in a completed release in place.

```bash
release_id="$(date -u +%Y%m%d%H%M%S)"

# Required release gate. CI may run these once and retain the build outputs.
pnpm -r typecheck
pnpm -r test
pnpm -r build

# SKIP_BUILD is allowed only because the gate above produced this artifact.
RELEASE_ID="$release_id" CREATE_TARBALL=0 SKIP_BUILD=1 \
  scripts/package-release.sh

# Select only services affected by the change.
RELEASE_ID="$release_id" \
RELEASE_DIR="/tmp/dd-release-$release_id" \
SERVICES="donordesk-api donordesk-web" \
  scripts/deploy-incremental.sh
```

Allowed `SERVICES` values are `donordesk-api`, `donordesk-web`, and
`donordesk-superadmin`. The packager updates API/web and intentionally preserves
the existing `superadmin/` tree; use the full release path when SuperAdmin
itself changes until it is added to the fast packager.

Measured pilot (2026-08-14): full build 151.5 s; cached artifact assembly
23.9 s; hardened artifact 811 MB logical; incremental deploy 86.2 s;
no-change checksummed comparison 17.5 s with zero files transferred; API startup
~9 s. Routine cached deployments normally finish in about one minute after the
artifact exists.

### 21.2 Fallback — full self-contained tarball

The bootstrap/fallback path uses a single tarball (see §11.1 of the former LEAN
doc, now `scripts/package-release.sh` with `CREATE_TARBALL=1`): upload once,
extract into an immutable release dir, switch with one symlink + restart. This
is what `scripts/deploy.sh` (`RELEASE_ID` + `TARBALL` env vars) performs for the
atomic-switch core; it does **not** run migrations/RLS — those are separate
operator steps (§18) run before the switch.

## 22. Rollback

The fast deployment script rolls back automatically when its local health checks
fail. Manual rollback:

```bash
RELEASE_ID=<known-good-release> scripts/rollback.sh
# or, directly:
ln -sfn /opt/donordesk/releases/<known-good> /opt/donordesk/current
systemctl restart donordesk-api donordesk-web donordesk-superadmin
```

Procedure:

1. Verify the previous release is compatible with the current database schema.
2. Atomically repoint `current` to the explicit previous release ID.
3. Restart only the affected DonorDesk services.
4. Run the same public acceptance checks.
5. Preserve failed-release logs and artifact for diagnosis.

**Application rollback does not undo database changes** — that is why production
migrations must remain compatible with the preceding release. Never run
`pm2 restart all`; DonorDesk systemd operations must not touch existing PM2
applications.

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

> **2026-08-20 — Section-wise AI report generation (deployed, release
> `20260820125717`, commits `5918dab` + `803a567`, API + web, no migration):**
> fixes the "Generate AI draft" timeout/`No report draft yet` failure by
> splitting generation into two phases. `POST /generate-draft` creates the
> draft + all plan sections as `NOT_STARTED` placeholders and returns
> immediately (`generating: true`); a background in-process loop drafts each
> section via a new `IReportDraftGenerator.generateSection` port method
> (single-section prompts, `maxTokens=2048`, within the MiniMax 180s adapter
> timeout), committing + assessing each section as it completes. The web
> workspace polls the draft and flips sections greyed→normal one at a time.
> Includes resume-safety (loop skips already-`DRAFTED` sections), phase-1 credit
> reservation reconciled at loop end, and `getReportDraftAction` polling.
> Deployed via the checksummed incremental path
> (`SERVICES="donordesk-api donordesk-web"`, 836 files transferred, ~39 MB);
> verified live: `/health` + `/ready` OK, web 200, services active, deployed
> handler returns `generating: aiEnabled`, client chunk contains the polling
> logic + "still running in the background" UX, zero journal errors since
> deploy. Rollback: `RELEASE_ID=20260820074745 scripts/rollback.sh` (previous
> release; no schema migration, fully backward-compatible). Full
> `pnpm -r typecheck`/`build` clean; application (66) + infrastructure (108)
> + web e2e (12) tests green. See `Features/11-AI-Report-Draft-Generator.md`.

> **2026-08-20 — USAID Emergency Education Response Programme demo data
> (no code release; direct DB operations via `DATABASE_ADMIN_URL`):** Seeded a
> complete demo project for the GEC tenant
> (`mnpiracha@gmail.com`, tenant `faed0177-5f2d-4a42-864f-e4c254e6d247`) on the
> production `donordesk` database, then fixed three data-shape bugs the seed
> exposed:
>
> - **Demo content seeded** (scripts now live in
>   `packages/infrastructure/src/db/`):
>   - `seed-eerp.ts` — Project **EERP-2026** (USAID, EDUCATION, Bangladesh/Cox's
>     Bazar, Jan–Dec 2026, USD 4.5M, ACTIVE), logframe (1 Goal, 3 Outcomes,
>     6 Outputs, 15 Activities), 20 indicators (all reportable), and the USAID
>     quarterly donor template (9 sections).
>   - `seed-eerp-evidence-activities.ts` — 15 evidence items (verified/pending,
>     training records, photos, distribution lists, assessments), 15 accepted
>     activity updates (Q1 + Q2 2026), Q1 + Q2 reporting periods, and (after the
>     fixes below) a ready `ProjectSetup` + `ReportingProfile`.
> - **Fix 1 — template `sectionsJson` shape.** The seeded template used the MVP
>   spec field names (`sectionTitle`/`sectionDescription`/`inputNeeded`), which
>   `PrismaDonorTemplateRepository.toDomain` rejects (`createSection` → "Section
>   title required"), breaking the Project → Donor Templates tab. Rewrote the
>   row to the canonical `TemplateSection` shape (`title`, `description`,
>   `inputType`, `evidenceNeeded`, `required`, `order`, `reviewStatus`, word
>   limits); verified all 9 sections parse via the production domain build.
> - **Fix 2 — invalid `COMPLETED` period status.** Q1 2026 was seeded with
>   `status='COMPLETED'`, which `ReportStatus.create` rejects (not one of the 8
>   canonical values), so the Reports tab 500'd (`Invalid ReportStatus:
>   COMPLETED`). Updated the row to `SUBMITTED`; verified both periods parse
>   (`SUBMITTED`, `IN_PROGRESS`).
> - **Fix 3 — reporting-period gate closed.** GEC is a Google-Drive tenant, so
>   readiness defaults workspace provisioning to `PENDING` when no `ProjectSetup`
>   exists (`WORKSPACE_PENDING`), and the project had no `ReportingProfile`
>   (`REPORTING_PROFILE_MISSING`) nor `REVIEWED` template sections
>   (`TEMPLATE_HAS_NO_REVIEWED_REQUIRED_SECTIONS`). Created/updated
>   `ProjectSetup` (READY + acknowledged), `ReportingProfile`
>   (`defaultTemplateId` = USAID template), and marked all 9 template sections
>   `REVIEWED`.
>
> Verified live: template sections parse through the production domain
> `createSection`; both reporting periods hydrate through production
> `ReportStatus.create`; 20/20 indicators reportable; readiness blockers for the
> project are cleared. No API/web restart needed (data-only).

> **2026-08-20 — Reorderable report sections (release `20260820074745`,
> commit `f0a6f2a`, API + web, no migration):** The left-hand section nav
> in the report workspace now supports drag-and-drop plus ↑/↓ move buttons
> (gated to DRAFT drafts with `reporting.edit`). New
> `PUT /v1/report-drafts/:id/sections-order` persists the complete ordering
> by renumbering `ReportSection.sectionOrder` 0..n-1; content, revisions,
> and approval state are untouched, and the export builder (which sorts by
> `sectionOrder`) follows the new order. Validation rejects duplicate,
> missing, or extra section ids, and reordering outside DRAFT is blocked.
> 3 new application unit tests (reorder persists order, mismatched set
> rejected, non-draft rejected). **292 unit tests pass / 0 fail**
> (contracts 9, domain 88, application 66, infrastructure 108+1 skipped,
> api 21+2 skipped). Full `pnpm -r typecheck` and `pnpm -r build` clean.
> Note: the local build host hit `ENOSPC` on `/tmp` during packaging
> (tmpfs 4G); cleaned old staging dirs before reassembling.
>
> Verified live: `current` symlink `20260820074745`, both services active,
> `/ready` OK, `PUT /v1/report-drafts/:id/sections-order` returns 401
> unauthenticated (route registered), zero journal errors since deploy.
> Rollback: `RELEASE_ID=20260820065833 scripts/rollback.sh` (previous
> release; no schema migration, fully backward-compatible).

> **2026-08-20 — AI rewrite timeout + draft fallback + LLM env fallback
> (release `20260820065833`, commits `fca4710` + `6afb892` + `79bbf94`,
> API + web):** Deployed via the checksummed incremental immutable-release
> path with `SERVICES=donordesk-api donordesk-web` (838 files transferred;
> 2.4 MB literal data on the first pass, then a follow-up pass for the
> stub-degradation hardening). This is the first release to make the
> professional-reporting AI fixes live — a record of an earlier
> `20260820053629` release described the same fixes, but the live host was
> actually still on `20260820045004`, so the reported symptoms (rewrite
> timeout, stub-only AI drafts) were still reproducible. Live `LlmRun`
> evidence before deploy showed MiniMax calls at 90–125s with the error
> runs aborted exactly at the 120s adapter timeout. Three user-visible
> bugs in the professional-reporting flow were fixed, plus two hardening
> items:
>
> 1. **AI rewrite no longer times out.** The `rewriteReportSectionAction`
>    server action did not pass `timeoutMs`, so the 15s default gateway
>    timeout aborted the LLM call (MiniMax measured at 46–54s per run and
>    94–125s end-to-end). Now uses `timeoutMs: 180_000`, matching the
>    existing `generateDraftAction`. Verified live: rewrite + generate
>    routes both return 401 unauthenticated (route live, registered with
>    the new timeout).
> 2. **Rewrite content actually shows up.** The rewrite handler returned
>    `sec.content` / `sec.updatedAt` (the OLD pre-rewrite values) instead
>    of `result.content` / the new revision's identity — the editor
>    received the original text and treated the rewrite as a no-op. Now
>    returns the rewritten content plus `revisionId`, `revisionNumber`,
>    `contentHash`, `assuranceState`, `generationRunId`, and `fallbackUsed`.
>    SectionEditor uses `onReload()` after a successful rewrite so the
>    editor reflects the persisted revision.
> 3. **Stub fallback is no longer silent.** When the LLM provider fails
>    (timeout, HTTP error, malformed response, PII rejected) the generator
>    silently fell back to the deterministic stub, and the user saw a
>    bullet-list "AI draft". Now `fallbackReason` flows through the API to
>    the UI: `PROVIDER_TIMEOUT` / `PROVIDER_EMPTY_RESPONSE` /
>    `PROVIDER_MALFORMED_RESPONSE` / `PROVIDER_HTTP_ERROR` /
>    `PII_REJECTED` / `PROVIDER_NOT_CONFIGURED`. The generate banner
>    surfaces the fallback; the rewrite notice shows "AI rewrite was
>    unavailable; a deterministic rewrite was applied instead." Persistent
>    audit events `report.draft.fallback` and
>    `report.section.rewrite.fallback` are emitted so support can diagnose
>    stub fallbacks without log scraping.
> 4. **LLM env fallback (commit `6afb892`).** When
>    `PlatformLlmConfigResolver` returns an error or no row, the container
>    now falls back to `LLM_PROVIDER` env before the stub, implementing the
>    documented chain: platform config → `LLM_PROVIDER` env → stub.
> 5. **Stub degradation on provider-construction failure (commit
>    `79bbf94`).** Generator resolution is wrapped in try/catch: a
>    misconfigured `LLM_PROVIDER` env (missing API key) or a resolver
>    throw now degrades to the stub generator with a logged warning
>    instead of rejecting `getGenerator` and surfacing a 500 on
>    generate/rewrite.
>
> Additional fixes:
>
> - **Lenient JSON parser for LLM drafts.** `parseSections` previously
>   rejected any LLM response that was not strict JSON, forcing a fallback
>   even when the LLM narrated directly (MiniMax sometimes does). Now
>   non-strict JSON prose is accepted as a single narrative section,
>   mirroring the rewrite path's lenient behaviour. Empty `sections: []`
>   still falls back correctly.
> - **Stub rewrite preserves caveats.** The deterministic stub was
>   stripping `[Needs verification]` / `[Needs source verification]`
>   markers (Phase 6 invariant violation). The stub now preserves them
>   verbatim; only the explicit checklist workflow can resolve them.
> - **Reproducible rewrite runs.** The child generation run for a rewrite
>   now records the parent draft's `templateVersion` / `mappingVersion` /
>   `indicatorUpdateIds` / `activityIds` / `evidenceIds` /
>   `verifiedFindings` so the rewrite is reproducible from the audit
>   boundary (implementation plan §5 invariant 15).
> - **Full assurance pipeline on rewrite.** The rewrite now passes
>   `writerClaims`, `findings`, and `evidencePackages` to `assessRevision`
>   so the new content is re-assured against the same computed findings
>   and evidence packages the original draft was built from (Phase 2
>   invariant).
> - **MiniMax adapter default timeout raised** 120s → 180s in
>   `packages/infrastructure/src/llm/factory.ts` for full donor reports.
> - **Container wiring fix.** `RewriteReportSectionHandler` receives
>   `periods`, `indicatorUpdates`, `activities`, `indicatorAnalytics`, and
>   `evidencePackages` so it can pull the parent report-context for the
>   child generation run and the assurance pipeline.
>
> Tests: lenient-parse, fallback-reason classification, and Phase 6
> caveat-preservation assertions in
> `packages/infrastructure/test/llm-fallback.test.mjs`. **289 unit tests
> pass / 0 fail / 3 skipped** (contracts 9, domain 88, application 63,
> infrastructure 108+1 skipped, api 21+2 skipped). Full workspace
> `pnpm -r typecheck` and `pnpm -r build` clean.
>
> Verified live: API `/health`+`/ready` OK (database ok); rewrite +
> generate routes both 401 (auth-gated, registered with the new timeout);
> web `/login` 200; `current` symlink `20260820065833`; both services
> active; zero journal errors since deploy; OLS validation warnings
> unchanged (pre-existing `donordesk.online`/`sa.donordesk.online` gid/uid
> baseline only). Disk 21G free, 7.4G RAM available.
> Rollback: `RELEASE_ID=20260820045004 scripts/rollback.sh` (previous
> release; no schema migration, fully backward-compatible).

> **2026-08-20 — Portal typography pass — 14px baseline, medium weights,
> smaller badges (release `20260820045004`, web-only):** Portal body baseline
> reduced 16px → 14px (`text-sm leading-5` on the AppShell root); card and
> section headings `font-semibold` → `font-medium` appwide (projects, logframe,
> indicators, templates, compliance, onboarding, reports, notifications,
> settings, export); metric labels lose uppercase (`text-xs font-medium`),
> stat values stay `text-2xl font-semibold tabular-nums`; page eyebrows →
> `text-[10px] font-medium uppercase tracking-[0.12em]`; badges/tags →
> `text-[11px] font-medium`; deadline chips → `text-[11px] font-medium`
> (overdue keeps `font-semibold`); metadata → `text-xs leading-4`, card titles
> `leading-5`; ReadinessGauge 36px extrabold → `text-3xl font-semibold
> tracking-tight tabular-nums`; uppercase removed from table headers, form
> labels, band labels, date groups, import status chips; active nav/tabs
> `font-medium`; header org name `font-bold` → `font-medium`. Brand palette
> unchanged. Verified: browser repro (14px baseline, 500 weights, 11px badges,
> no uppercase on labels, dark surfaces correct) + gate green. Live: web 200,
> public HTTPS 200. Rollback: `RELEASE_ID=20260819184637 scripts/rollback.sh`.

> **2026-08-19 — Crisp UI rollout across all portal pages + modals (release
> `20260819184637`, web-only):** Extends the Geist/type-scale refresh to every
> left-nav destination and their sub-pages: page titles `text-2xl`/`3xl` →
> `text-xl font-semibold tracking-tight`, panel headings `text-lg` → `text-sm`,
> eyebrows → `text-[11px]` across 52 portal pages + feature presentation
> components (Reports, Evidence, Compliance, Projects + project workspace,
> Team, Settings + audit/billing/setup, Notifications, onboarding, export
> center, reporting workspace). Card/list text now wraps (`break-words` +
> `min-w-0`) in project compliance gaps, report workspace section nav and
> checklist, export wizard, drive folder panel, and file queue rows. Modals/
> popups: `Dialog`/`Drawer` → `rounded-lg p-4 shadow-xl`; notification bell +
> user menus, cookie banner, toasts, `Button`/`IconButton`/`ThemeToggle`
> flattened (solid surfaces, `rounded-lg`, brand primary kept, md height 38px).
> Translucent panels (`bg-white/60–80`) → solid `bg-white`; the sticky glass
> header and the user avatar gradient are retained. Brand palette unchanged;
> light + dark verified in a browser repro; typecheck/tests/build green.
> Verified live: web 200, CSS chunk `42144b69f80cb376.css`, public HTTPS 200.
> Rollback: `RELEASE_ID=20260819183029 scripts/rollback.sh`.

> **2026-08-19 — Vercel-inspired crisp UI refresh (release `20260819183029`,
> web-only):** Geist Sans is now the app font (`geist` package, wired in the
> root layout + `fontFamily.sans`) and the type scale is reduced and tightened:
> page titles `3xl`→`xl`, section heads `lg`→`sm`, stat values `3xl`→`2xl` with
> `tabular-nums`, eyebrows `text-[11px]`. Design-system primitives
> (`.card`, `.btn`, `.btn-secondary`, `.input`) are now flat `rounded-lg` solid
> surfaces with `shadow-sm` and no glass/gradient/glow — the brand palette is
> unchanged. Card text now wraps (`break-words` + `leading-snug`, `min-w-0`
> chains) instead of truncating across My Work, deadline overview, readiness
> snapshot, queue cards, recent projects, and notifications. Section spacing
> tightened (`mt-8`→`mt-6`), header/nav controls reduced to `h-10 rounded-lg`.
> Light + dark variants verified for all surfaces (browser repro) and typecheck/
> tests/build green. Verified live: web 200, CSS chunk
> `629ab0641746b10e.css` carries `font-geist-sans`/`tabular-nums`, Geist woff2
> served from `/_next/static/media/`, public HTTPS 200. Rollback:
> `RELEASE_ID=20260819173232 scripts/rollback.sh`.

> **2026-08-19 — Portal UI polish: collapsible sidebar + home-page card overflow
> (release `20260819173232`, web-only):** The left nav now slides to the left
> edge via a header toggle (visible on `lg+`, matching the hamburger style) so
> pages get the full 224px back; the preference persists in localStorage
> (`donordesk:nav-collapsed`), and the collapsed sidebar gets `inert` +
> `aria-hidden` so its links drop out of the tab order. Home page: the My Work /
> Readiness snapshot grid (`xl:grid-cols-[1.25fr_0.75fr]`) overflowed because
> long card text (evidence filenames, project titles) blew out the first
> column's min-content, pushing the Readiness card off-screen — grid columns
> now carry `min-w-0` and WorkPreview text wraps (`break-words`) instead of
> truncating. The same `min-content` hardening was applied to the deadline
> overview, queue cards, recent projects, and notifications. Verified live:
> loopback health/ready 200, web 200, public HTTPS 200, new CSS chunk
> (`b1c1d0681e153242.css`) carries `transition-property:width,opacity` +
> `.w-0`/`.w-56`, portal layout chunk carries the sidebar toggle labels.
> Rollback: `RELEASE_ID=20260819165731 scripts/rollback.sh`.

> **2026-08-19 — OLS vhost context fix for `/api/files` and `/api/templates` (host
> config, no release):** The `donordesk.online` OLS vhost proxied the entire `/api`
> context to Fastify (4001), so Next.js BFF routes at `/api/files/*` (evidence
> downloads) and `/api/templates/*` (template downloads) returned Fastify 404s in
> production. Added explicit contexts before the catch-all `/api` context:
> `context /api/files` → `donordesk_web` (Next.js :3002) and
> `context /api/templates` → `donordesk_web`, mirroring the existing `/api/auth`
> pattern. Validated with `lshttpd -t` and reloaded OLS. Config backed up at
> `vhost.conf.bak-20260819184350`. Note: this was later superseded by adding the
> routes directly to Fastify (see next entry), so the OLS contexts for
> `/api/templates/*` are now redundant but harmless.

> **2026-08-19 — `/api/templates/*` routes added to Fastify (release
> `20260819165731`):** OLS proxies `/api/*` to Fastify (4001), bypassing
> Next.js BFF entirely. Fastify had no `/api/templates/*` routes registered —
> confirmed 404 in production. Added `GET /api/templates/logframe`,
> `/activities`, `/evidence` directly in `registerTemplateRoutes` using the
> existing `build*Template()` functions from `@donordesk/infrastructure`. Routes
> are inside the auth-gated block. Verified live: all three return 401
> (auth-gated, route live) on both loopback and public HTTPS. BFF routes at
> `apps/web/src/app/api/templates/*` remain unused but harmless (proxied to Fastify
> which now has matching routes). No OLS change needed; deploy
> `RELEASE_ID=20260819165731`.

> **2026-08-19 — Excel import templates + report section management (release
> `20260819163537`, API + web):** xlsx template download for Logframe
> (two sheets: Logframe + Indicators), Activities, and Evidence (link-first —
> a Google Drive share link per row) with authenticated BFF proxy routes
> (`/api/templates/logframe|activities|evidence`) and memoized workbook
> buffers. Structured upload imports for indicators
> (`POST /v1/logframe/indicators/import`), activities
> (`POST /v1/activities/import`), and evidence (`POST /v1/evidence/import`)
> backed by fuzzy header parsers (multi-sheet-safe boundary detection, shared
> indicator header vocabulary, delimiter-aware cell splitting, Excel serial
> date rejection, indicator type-synonym normalization), code/title resolution
> to logframe items/indicators/activities, dedup, 1000-row caps, and audit
> events. Report sections can now be added (`POST /v1/report-sections`) and
> deleted (`DELETE /v1/report-sections/:id`, FK-safe claims→revisions→section
> ordering, DRAFT-gated). RBAC rules added for every new route. No schema
> migration required. Typecheck/build/tests green; deployed incrementally via
> §21.1 and verified live (health/ready ok, web 200, all new routes
> registered and auth-gated, public HTTPS 200). Rollback:
> `RELEASE_ID=20260819090000 scripts/rollback.sh`.

> **2026-08-19 — Professional donor-reporting hardening (release
> `20260819090000`, API + web + prisma):** shipped the full
> `imp/PROFESSIONAL-REPORTING-IMPLEMENTATION-PLAN.md` (Phases 0–9, status
> IMPLEMENTED) so approved outputs can be treated as donor-submission
> candidates. Immutable `ReportRevision` (content-hash, parent/child,
> change-origin, actor/model, `UNASSESSED→ASSESSING→CURRENT|FAILED`/`STALE`
> assurance) with a single `IReportRevisionService` mutation pipeline
> (generation/edit/rewrite always create a new UNASSESSED revision; approval
> requires CURRENT assurance bound to the exact revision hash);
> `ReportClaim` evolved into revision-bound assertions (revision id/hash, text
> span, numeric atoms, `VerificationReasonCode`); deterministic assertion
> extraction from final content with fingerprint reconciliation (empty writer
> claims cannot bypass); numeric verification bound to indicator/period/unit/
> entity/role with percentage derivation via domain decimal math; evidence
> chunk/hash/source-text integrity + `DeterministicEvidenceRetriever` +
> entailment (supported/contradicted/insufficient/uncertain) + causal
> human-review policy; requirement packs/award overrides with deterministic
> precedence resolver + `IRequirementEvaluator`; `SubmissionSnapshot` sealing
> (approved revision hashes, requirement snapshot + coverage, assertion/
> evidence/annex manifests, approval records, overrides); ONE
> `evaluateReportGate` shared by approval/preflight/submission/export with
> structured reason enums; export intent (`INTERNAL_REVIEW` watermarked vs
> `DONOR_SUBMISSION` snapshot-bound) enforced in the export builder;
> coverage-gap projection into `UNSUPPORTED_REPORT_CLAIM` checklist items;
> neutral evidence-proportionate rewrite prompts with prompt/response hashes;
> baseline-revision backfill migration. New API: `GET /v1/report-drafts/:id/assurance`,
> `POST /v1/report-sections/:id/reassess`,
> `POST /v1/reporting-periods/:id/resolve-requirements`,
> `POST /v1/reporting-requirement-packs` (+ `/:id/activate`),
> `POST /v1/award-reporting-overrides`,
> `POST /v1/report-drafts/:id/submission-snapshot`, and `exportIntent`/
> `submissionSnapshotId` on `POST /v1/exports`. ADRs 0005–0009 added; ownership
> map at `imp/REPORTING-OWNERSHIP-MAP.md`. Migration `20260818180000_professional_reporting`
> (additive; backfills baseline revisions, binds existing claims) + updated RLS
> (29 tenant tables) applied as `donordesk_migrator`; migration + RLS were
> pre-validated against production inside a `BEGIN…ROLLBACK` transaction
> (EXIT 0). Full gate green: `pnpm -r typecheck`, `pnpm -r build`, 254 tests
> (domain 88, application 63, infrastructure 103), 0 failures; release-package
> smoke tests passed; `reporting:eval` classifies all 6 golden cases correctly.
> Rollback: `RELEASE_ID=20260818162955 scripts/rollback.sh` (preceding release;
> schema change is additive and backward-compatible).

> **2026-08-18 — NeureCore fully retired from this host.** All NeureCore assets
> were removed cleanly and safely (operator-approved): 4 PM2 apps
> (`neurecore-backend/cors-proxy/admin/tenant`) deleted + `pm2 save`; 3 rogue
> `prisma studio` processes (public `:5555-5557`) killed; systemd units
> `hermes-sidecar`, `hermes-events-bridge`, `accounting-sidecar`,
> `neurecore.service` disabled, stopped, and removed; Docker project
> `observability` (prometheus/alertmanager/grafana containers, images, and the 3
> `observability_*` volumes) removed; PostgreSQL DBs `neurecore_prod` + `neurecore`
> and roles `neurecore_app` + `neurecore` dropped; `pg_hba.conf` pruned of all
> `neurecore_prod` / `182.184.202.48` / Vercel `76.76.x` rules (reloaded);
> UFW Vercel/182.184.202.48 `5432` + Vercel `6379` rules removed; OLS vhosts
> `neurecore.com`, `mail.neurecore.com`, `brain/hq/cc.neurecore.com` + their
> listener maps removed from `httpd_config.conf` (validated: only the known
> pre-existing lsphp73/lsphp80 baseline errors remain; no new errors) with
> `lswsctrl restart`; LE certs (neurecore.com/www/mail/brain/cc/hq incl.
> self-signed) via `certbot delete` + manual removal, acme.sh cert dirs removed,
> orphan LSAPI socket cleaned; users `neure8308` + `hermes-sidecar` and their
> groups removed; `/opt/neurecore` (7.1G), `/home/neurecore.com`,
> `/var/lib/neurecore`, logs, backups, and `/tmp/neurecore-*` deleted.
> **Pre-change archive:** `/root/neurecore-retirement-20260818-190257/`
> (filesystem tar SHA-256 `e1cbd3b9d63e3c48a7c39cc7ccd6c98ae0aee53d482ea818370f340472ba5820`,
> DB dumps, certs, configs, `SHA256SUMS`) — **operator must copy this off-host**
> before it is considered durable DR. Verified post-removal: all 5 DonorDesk
> services active, `/health`+`/ready` OK, web/superadmin/workers 200, Kestra 307,
> GFC containers healthy + portal 200, PM2 (gfcportal/cookie-refresher/
> shahisoft-nextjs) online, no NeureCore listeners or files remain, `df` 22G free.
> Unchanged by design: host Redis (shared; NeureCore keys were not attributable
> without its credentials — no flush), UFW `3001` (# gfcportal) + `8005` rules
> (labels ambiguous), global pnpm/Node, Docker build cache, all GFC/CyberPanel/
> mail assets. Rollback: restore from the retirement archive + snapshot
> `/root/httpd_config.conf.bak-neurecore-removal-20260818-191717` + restore the
> pre-deletion PM2 dump from the archive (`.../configs/pm2-dump.pm2`) to
> `/root/.pm2/dump.pm2`, then `pm2 resurrect` (starts only the NeureCore apps;
> already-running GFC/Shahisoft apps are left untouched).

- **2026-08-18 (Support Center + 100+ docs + Report Writing Skills — release
  `20260818150143`, web-only):** Deployed via checksummed incremental immutable-release
  path with `SERVICES=donordesk-api donordesk-web` (5.3 MB transferred; previous
  compatible release `20260818074405`). New public `/support` page:
  hero with search bar, 6 category cards (Getting Started/How-To/Donor Reporting
  Skills/Troubleshooting/Advanced Features/Account & Billing), featured Report Writing
  Skills section with 3 sub-cards (Foundation/Donor-Specific/Tools & Templates) + donor
  name badges, Popular & Recent guides lists, and support options panel. Homepage nav
  gains "Support" link (brand teal); homepage footer replaced with 4-column layout
  (Brand/Support/Report Writing Skills/Legal) with `support@donordesk.online` contact
  throughout. `memorybank/docs/support/` now has 104 markdown docs across 8 categories;
  all `legal@donordesk.online` references replaced with `support@donordesk.online`.
  Typecheck + build green. Verified: `current` symlink `20260818150143`, public `/`,
  `/support`, `/login` all 200, API `/health`+`/ready` OK, both services active,
  no new journal errors. Rollback: `RELEASE_ID=20260818074405 scripts/rollback.sh`.

- **2026-08-18 (Professional AI report generation — release `20260818074405`,
  API + web):** Deployed via the checksummed incremental immutable-release path
  with `SERVICES=donordesk-api donordesk-web` (~5.6 MB transferred; previous
  compatible release `20260818061120`). Enriched the report-generation pipeline
  so AI drafts read as professional donor deliverables: `VerifiedFinding` now
  carries indicator name, type, baseline, target, resolved semantics,
  previous-period `comparisonValue` (previously computed but dropped by
  `computeIndicator`), and a deterministic `performanceEvaluation`
  (POSITIVE/NEGATIVE/NEUTRAL gated by direction semantics). The narrator prompt
  gains project/period/donor-template context blocks, per-section guidance
  (input type, mandatory questions, evidence needs, word limits), indicator
  names + target/period-over-period narration, evidence metadata, participant
  disaggregation, explicit quality-flag caveat language, and a worked example;
  evidence chunks raised 3×600 → 8×800 chars. `maxTokens` deliberately stays
  4096 (per the MiniMax timeout constraint recorded in §29 below). Also fixed
  a flaky phase4-security test (tampered token's last hex char could already be
  "0"). Full gate green: typecheck, 241 unit tests (0 failures), build,
  package smoke tests. Verified live: `current` symlink `20260818074405`, API
  `/health`+`/ready` OK, web `/login` 200, deployed dist contains the enriched
  prompt + `buildReportContext` handler, no journal errors since restart.
  Rollback: `RELEASE_ID=20260818061120 scripts/rollback.sh` or `ln -sfn
  /opt/donordesk/releases/20260818061120 /opt/donordesk/current && systemctl
  restart donordesk-api donordesk-web` (previous release).

- **2026-08-18 (Continue checkout flow + trial removal — release
  `20260818061120`, API + web):** Deployed via the checksummed incremental
  immutable-release path with `SERVICES=donordesk-api donordesk-web` (4.56 MB
  transferred; previous compatible release `20260818053116`). Pricing page
  Team/Growth tiers now show **Continue** buttons that route through signup
  (basic onboarding) to the hosted Creem checkout; new `/checkout` route creates
  the checkout session server-side and redirects to Creem (used after
  paid-plan signup for local + Google paths and from pricing). `signupAction`
  redirects TEAM/GROWTH signups to `/checkout`; Starter stays on `/dashboard`.
  The `/thanks` page now guides setup with quick links (workspace setup,
  projects, team, billing). Removed all 14-day trial references: no trial grant
  at provisioning (everyone starts on the free Starter tier), no trial copy on
  pricing/signup/billing panels, catalog `trialDays` nulled for Team/Growth,
  `isPlanForTrial` always false. Full workspace typecheck, unit/integration/
  Playwright tests, and build passed; release-package smoke tests passed;
  preflight confirmed ports/services. Verified: `current` symlink
  `20260818061120`, API `/health`+`/ready` OK, public `/` shows Continue (no
  14-day text), `/thanks` 200, `/checkout` 307 (session redirect), signup plan
  options show no trial text, services active. Rollback:
  `RELEASE_ID=20260818053116 scripts/rollback.sh`.

- **2026-08-18 (Creem billing Phase 4 reconciliation + checkout thanks page —
  release `20260818053116`, API + web):** Deployed via the checksummed
  incremental immutable-release path with `SERVICES=donordesk-api donordesk-web`
  (8.9 MB transferred; previous compatible release `20260818041110`). Ships
  Feature 19 Phase 4 reconciliation handlers (`reconcile-billing-subscriptions`,
  `reconcile-managed-storage`, `release-stale-usage-reservations`,
  `retry-billing-inbox`) exposed as `/internal/billing/*` routes for Kestra; a
  shared `BillingSubscriptionSynchronizer` used by the webhook processor and
  reconciliation; webhook tenant resolution from checkout metadata with local
  mapping fallback; metadata parsing in the Creem/stub adapters; and the public
  `/thanks` checkout return page with Creem redirect-signature verification
  (`verifyCreemRedirectSignature`). Checkout `SUCCESS_PATH` now points to
  `/thanks`. Server `api.env` gained the Creem TEST-mode billing block
  (`BILLING_PROVIDER=creem`, `CREEM_TEST_MODE=true`, test product IDs,
  `BILLING_SUCCESS_BASE_URL=https://donordesk.online`). Full workspace typecheck,
  unit/integration/Playwright tests (web 12/12), and build passed; release-package
  API/web smoke tests passed; same-day preflight confirmed free candidate ports
  and active services. Verified: `current` symlink `20260818053116`, API
  `/health`+`/ready` OK, public HTTPS `/`, `/login`, and `/thanks` 200, internal
  billing routes 401 (auth active), superadmin 200, Kestra 307, no new API
  journal errors, all DonorDesk services active. Rollback:
  `RELEASE_ID=20260818041110 scripts/rollback.sh` or atomically repoint `current`
  to `/opt/donordesk/releases/20260818041110` and restart `donordesk-api`
  `donordesk-web`.

- **2026-08-18 (interactive homepage product-proof strip — release
  `20260818041110`, web-only):** Replaced the low-contrast numeric statistics
  band with four user-relevant capability cards: source-linked drafting, live
  readiness, human approval, and PDF/DOCX/XLSX/ZIP delivery. Added explanatory
  section copy, per-card high-contrast blue/cyan/violet/emerald treatments,
  cursor-following spotlights, hover lift/depth, and touch/reduced-motion-safe
  behavior. Web typecheck, production build, release-package API/web smoke tests,
  and same-day host preflight passed. Deployed via the checksummed incremental
  immutable web-only path (4.62 MB transferred; previous compatible release
  `20260818040118`). Verified: current symlink `20260818041110`, public and
  loopback homepage contain the new product-proof copy, API readiness database
  check OK, all DonorDesk services active, and no new web journal warnings.
  Rollback: `RELEASE_ID=20260818040118 scripts/rollback.sh` or atomically repoint
  `current` to `/opt/donordesk/releases/20260818040118` and restart
  `donordesk-web`.

- **2026-08-18 (homepage technology treatment + cookie consent — release
  `20260818040118`, web-only):** Deployed through the checksummed incremental
  immutable-release path with `SERVICES=donordesk-web` (4.55 MB transferred;
  previous compatible release `20260818034420`). Added live-system hero cues,
  ambient and scan-line motion with reduced-motion support, deeper glass/card
  treatments, a reinforced sticky header, and a footer-logo home link. Added an
  accessible cookie-preference banner with Accept all / Essential only choices,
  privacy-policy link, `SameSite=Lax`, HTTPS `Secure`, and a 15-day expiry.
  Full workspace typecheck and build passed; release-package API/web smoke tests
  passed. Preflight: all required services active, 19 GB disk available, known
  OpenLiteSpeed warnings unchanged, and no recent web journal warnings. The
  documented off-host backup gap remains (no files under
  `/opt/donordesk/backups`); no data or migrations changed. Verified after
  activation: current symlink `20260818040118`, public HTTPS homepage 200 with
  new content, cookie bundle present, API `/health` and `/ready` database check
  OK, all DonorDesk services active, and no new web journal warnings. Rollback:
  `RELEASE_ID=20260818034420 scripts/rollback.sh` or atomically repoint `current`
  to `/opt/donordesk/releases/20260818034420` and restart `donordesk-web`.

- **2026-08-18 (public homepage + SEO refresh — release `20260818034420`, web-only):**
  Deployed web-only via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-web`,
  ~4.5 MB transferred). Reworked the landing page copy to be grant/funder-agnostic:
  rewrote hero/feature/step copy ("grant and donor reporting"), expanded the
  How-it-works flow to six steps (project → logframe → indicators → compliance →
  delivery & evidence → ready-to-review reports), added a "Who it's for" audience
  grid (humanitarian/development, research & public health, government-funded,
  education & skills, climate & social impact), refreshed pricing taglines,
  removed the testimonial section, and updated the final CTA + trust/security
  wording. Updated `layout.tsx` metadata/title/description, OpenGraph/Twitter
  cards, and JSON-LD `Organization`/`WebApplication` descriptions. Gate passed
  (`pnpm -r typecheck` + `pnpm -r build` green). Verified live: public HTTPS
  homepage 200 and contains "Make every reporting period easier than the last";
  API `/health`+`/ready` OK (database ok); web loopback 200; both services
  active; current symlink `20260818034420`; no new web journal errors. Rollback:
  `RELEASE_ID=20260818031100 scripts/rollback.sh` or `ln -sfn
  /opt/donordesk/releases/20260818031100 /opt/donordesk/current && systemctl
  restart donordesk-web`.

- **2026-08-18 (comprehensive SuperAdmin Tier management — release `20260818031100`,
  commit `989745c`, API + web + superadmin):**
  Deployed API + web via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api
  donordesk-web`), then rebuilt and redeployed the SuperAdmin standalone app
  (port 3012; `pnpm --filter @donordesk/superadmin build` → `.next/standalone`
  server.js + `.next` + `node_modules` + `package.json` rsynced to
  `/opt/donordesk/current/superadmin/`, `systemctl restart donordesk-superadmin`).
  1. **Migration `20260817210000_plan_catalog_override`** applied as
     `donordesk_migrator` (via `DATABASE_ADMIN_URL`, `/usr/bin/prisma migrate
     deploy`) BEFORE switching the release so new code never queries a missing
     table: creates `PlanCatalogOverride` (PK `planCode`, name/prices/trialDays/
     enabled/limitsJson) for global tier feature allocation.
  2. **RLS extended:** `infra/postgres/rls.sql` now grants
     `SELECT, INSERT, UPDATE, DELETE ON TABLE "PlanCatalogOverride" TO
     donordesk_app` (global reference table, NOT in the tenant-isolation array —
     no `tenantId` column). Applied as `donordesk_migrator`; verified via
     `pg_class` ACL `donordesk_app=arwd`.
  3. **New SuperAdmin portal area "Tier management"** (`sa.donordesk.online`):
     global tier catalog editor (limits/prices/trial days/enabled per plan, with
     tenant counts) + per-tenant tier assignment (change tier via MANUAL grant,
     per-tenant feature-allocation override, reset tier changes). New API routes:
     `GET /superadmin/tiers`, `PUT /superadmin/tiers/:planCode`, `POST
     /superadmin/tiers/:planCode/reset`, `GET/POST /superadmin/tenants/:id/tier`,
     `PUT /superadmin/tenants/:id/tier/limits`, `POST
     /superadmin/tenants/:id/tier/reset`. All audit-trailed; audit payloads are
     JSON-safe (storage limits serialized via `planCatalogOverrideToJson`, fixing
     a BigInt `JSON.stringify` crash).
  4. **Entitlement correctness fixes:** newest MANUAL grant wins (tie-break on
     `createdAt`); portal reads (`billingRow`/`currentPlanLimits`) mirror the
     domain's subscription status/grace effectiveness; `changeTenantTier` merges
     partial limits against the target plan (not the old one) and rejects
     disabled tiers; `resetTenantTier` closes only `tier-change-to-*` grants via
     the typed client (UTC-safe dates), preserving credit/limits overrides;
     `updateTier` preserves stored `null` (unlimited/custom) buckets on partial
     edits.
  5. **Verified live:** all three services active; API `/health`+`/ready` OK
     (database ok); web `/login` 200; superadmin 3012 HTTP 200; new
     `/superadmin/tiers` + `/superadmin/tenants` return 401 unauthenticated;
     deployed bundles contain `listTiers`/`changeTenantTier` (API dist) and
     "Tier management" (superadmin chunk); direct control-plane read smoke test
     (`listTiers`/`listBilling`/`getTenantTier` against `DATABASE_ADMIN_URL`)
     returns 5 tenants on STARTER with correct limits/usage; write smoke test
     (`updateTier` TEAM trialDays 15 → reset to 14; `setTenantLimits` on a test
     tenant → `resetTenantTier` leaves feature allocation intact by design) and
     all smoke-test grants/audit rows deleted afterwards; no new journal errors.
  Rollback: `ln -sfn /opt/donordesk/releases/20260817174622
  /opt/donordesk/current && systemctl restart donordesk-api donordesk-web
  donordesk-superadmin` (previous release).

- **2026-08-17 (SuperAdmin Billing & credits — release `20260817180500` API + web, superadmin rebuilt):**
  Deployed API + web via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api
  donordesk-web`), then rebuilt and redeployed the SuperAdmin standalone app
  (port 3012; `pnpm --filter @donordesk/superadmin deploy` + `.next` + `next start`
  via the existing systemd unit). Added a **Billing & credits** portal section:
  `GET /superadmin/billing` lists every tenant with its effective plan (resolved
  with the same MANUAL > ENTERPRISE_CONTRACT > GRANDFATHERED > CREEM_SUBSCRIPTION >
  TRIAL > DEFAULT precedence the app uses), AI-credit allowance, current-month
  used/reserved, override flag, and active subscription; `POST
  /superadmin/tenants/:id/credits {mode: SET|INCREASE|DECREASE, value}` writes an
  append-only MANUAL `EntitlementGrant` with a full PlanLimits override (only the
  AI-credit bucket changes); `POST /superadmin/tenants/:id/credits/reset` zeroes
  the current UTC-month `AI_DRAFT_CREDITS` UsageCounter. All mutations are
  audit-trailed. **Timezone gotcha (fixed):** MANUAL grants must be written via
  the typed Prisma client, not raw SQL with JS Date params — the host DB session
  timezone (Europe/Berlin) would store CEST wall time and the effective-date
  filter would read a 2h future-dated grant as inactive. Verified live (direct
  control-plane calls): INCREASE +7 resolves to MANUAL/override immediately,
  reset zeroes the counter; test grants cleaned up. API routes return 401 when
  unauthenticated (registered). Tests: infra 74/75, app 64/64, domain 74/74.
  Rollback: previous release + `systemctl restart donordesk-api donordesk-web
  donordesk-superadmin`.

- **2026-08-17 (report charts + timeout + credit fixes — releases `20260817164700`,
  `20260817171900`, `20260817180500`):** Deployed API + web via
  `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api donordesk-web`).
  1. **User-selectable report charts (release `20260817164700`):** `ReportSection.chartConfigJson`
     (migration `20260817183000_report_charts`, applied as `donordesk_migrator`),
     `ChartConfig` domain model + zod contract, shared pure `buildChartOption`
     in domain, interactive `ReportChartPanel` (lazy-loaded ECharts 6.1.0, tab-bar
     type picker BAR/LINE/PIE/AREA/RADAR/GAUGE + data-binding selector),
     `PATCH /v1/report-sections/:id/chart` (optimistic concurrency), and export
     embedding via ECharts SSR → SVG → sharp PNG (`chart-png-renderer.ts`,
     content-hash cached) into DOCX (`ImageRun`) + PDF (`doc.image`). Client-bundle
     hygiene: web imports `@donordesk/domain/contexts/reporting/chart-config.js`
     subpath (domain index pulls `node:crypto` via `domain-event.ts` and would
     break the webpack client build).
  2. **Timeout fix (release `20260817153600`):** web gateway default 15s →
     180s for generate-draft; MiniMax adapter default 60s → 120s; OLS
     donordesk vhost `initTimeout` 60 → 180 (web + api ext processors),
     validated and reloaded on the host.
  3. **Credits burned on stub fallback (release `20260817171900`):** MiniMax
     timed out on the 8192-token prompt and the generator silently fell back to
     stub content while the handler recorded `status=success` + billable → five
     consumed credits for stub output, locking the tenant out. `generateDraft`
     now returns `{ sections, usedFallback }`; stub-fallback drafts release the
     reserved credit, record an error run (never billed), and correct
     `generatedByAi=false`. `maxTokens` 8192 → 4096 (verified MiniMax completes
     the full prompt in ~38s); `ReportPlan` version allocation moved to
     `createNextVersion` (P2002 retry loop). **Production data corrected:** the 5
     mislabeled runs re-marked `error`/`billableUnits=0` and the
     `AI_DRAFT_CREDITS` counter reset to 0.
  4. **SectionEditor key fix (release `20260817155400`):** clicking a different
     section kept the first section's content because `SectionEditor` was not
     remounted (`key={selected.id}` added) — the stale text would even have been
     saved to the wrong section.
  Verified live each release: api/web 200, deployed bundles contain the new
  handlers/routes/chunks, `/ready` OK. Rollback: previous release + restart.

- **2026-08-17 (logframe import auto-parses into structured records — release `20260817082655` API + web):**
  Deployed API + web via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api
  donordesk-web`). The further step after Drive import: logframe files (from
  Google Drive or a local Excel/CSV/TXT upload) are now auto-parsed into
  **actual logframe records** instead of just showing parsed text. Added a pure
  domain parser `parseLogframeText` (packages/domain, `logframe-parser.ts`)
  handling tabular CSV/TSV with Level/Code/Title/Description headers (column
  detection by fuzzy header names, dotted/lettered code → level inference) and
  line-based text (explicit GOAL/OUTCOME/OUTPUT/ACTIVITY keywords, dotted codes,
  indentation depth, em-dash title→description split); `ImportLogframeHandler`
  (application) resolves parents by level rank and skips codes already in the
  project; contract `ImportLogframeTextSchema`; route
  `POST /v1/logframe/import` (logframe.manage); container wires
  `handlers.importLogframe` and passes it into `ImportDriveFileHandler`, so
  Drive `import-logframe` now returns `{created, skipped, warnings, items}`
  while `data` files keep the text preview. Web: `importLogframeTextAction`,
  `ImportLogframeResponseSchema`, the local `logframe/import` page gains a
  "Create logframe items" button with a created-items summary + warnings, and
  `DriveFolderPanel` shows the created count + item list + "View logframe" link.
  Tests: domain 70/70 (logframe-parser), app 64/64 (ImportLogframeHandler +
  updated ImportDriveFileHandler), infra 63/63 + 1 skipped. Verified live:
  api/web 200, current `20260817082655`, deployed bundles contain
  `ImportLogframeHandler` + `importLogframe` container wiring + "Create logframe
  items" client chunk. Rollback: `RELEASE_ID=20260817074810 scripts/rollback.sh`
  or `ln -sfn /opt/donordesk/releases/20260817074810 /opt/donordesk/current &&
  systemctl restart donordesk-api donordesk-web`.

- **2026-08-17 (read/import Drive files into the app — release `20260817074810` API + web):**
  Deployed API + web via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api
  donordesk-web`). Closing the two-way loop: files already in the tenant's Google
  Drive can now be imported into the app. Added `IDriveFileContentReader` port +
  `GoogleDriveFileReader` (raw `alt=media` download; native Google Docs →
  `text/plain`, Sheets → `text/csv` export), `ImportDriveFileHandler`, routes
  `POST /v1/projects/:id/drive/import-template` (template.manage) and
  `POST /v1/projects/:id/drive/import-logframe` (logframe.manage), contract
  `DriveImportSchema`, and container wiring (`driveFileReader` +
  `handlers.importDriveFile`; hoisted `uploadTemplateHandler` for reuse).
  Web: `importDriveFileAction` + `DriveFolderPanel` gains per-file "Import
  template" (inline donor/report-type form → creates template, opens editor) and
  "Import" (parses logframe/data to an inline text preview). Tests: app 60/60
  (ImportDriveFileHandler template + logframe), infra 63/63 + 1 skipped
  (GoogleDriveFileReader raw + native export). Verified live: api/web 200,
  current `20260817074810`, deployed bundles contain the import handler/reader,
  route, and UI. Rollback: `RELEASE_ID=20260817072121 scripts/rollback.sh` or
  `ln -sfn /opt/donordesk/releases/20260817072121 /opt/donordesk/current &&
  systemctl restart donordesk-api donordesk-web`.

- **2026-08-17 (review fixes for two-way Drive — release `20260817072121` API + web):**
  Deployed API + web via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api
  donordesk-web`). Post-implementation review fixes:
  1. **LOCAL evidence download regression:** the workspace-folder routing I added
     to `LocalEvidenceStorage` wrote bytes under `workspaces/<org>/<project>/…`,
     which the `/v1/files/:key` tenant-isolation guard (key must start with
     `tenantId/`) rejects → LOCAL evidence downloads 404. Reverted
     `LocalEvidenceStorage` to the flat `tenantId/evidence/<id>.<ext>` layout;
     `EvidenceStorageResolver` no longer passes the workspace to the LOCAL adapter.
     The workspace folder tree remains a scaffold for LOCAL/R2, while Drive holds
     the real tree.
  2. **Connect-time provisioning gap:** `ProvisionTenantWorkspacesHandler` skipped
     `NOT_REQUIRED` projects, so projects created under LOCAL before a tenant
     connected Drive never got their Drive folders. Now skips only `READY` and
     provisions `NOT_REQUIRED`/`PENDING`/`FAILED`/`IN_PROGRESS` too.
  3. **Deep-link never shown:** project workspace refs carry no `deepLink`;
     `ListWorkspaceFilesHandler` now builds `https://drive.google.com/drive/folders/<rootId>`
     for GOOGLE_DRIVE.
  4. **Drive panel shown to non-Drive tenants:** evidence/templates/logframe pages
     now fetch `/v1/organization` and render `DriveFolderPanel` only when
     `storageProvider === "GOOGLE_DRIVE"`.
  5. **Effect-dependency stability + wording:** `DriveFolderPanel` depends on a
     joined `folderKey` string (no array-identity refetch loop); upload queue
     summary/button wording made provider-neutral ("completed"/"Save").
  Tests: app 58/58 (provision test now asserts NOT_REQUIRED → READY), infra
  62/62 + 1 skipped (removed the invalid LOCAL workspace-folder test). Verified
  live: api/web 200, current `20260817072121`, deployed bundles contain the
  reverted LOCAL key and the NOT_REQUIRED provisioning fix. Rollback:
  `RELEASE_ID=20260817065618 scripts/rollback.sh` or `ln -sfn
  /opt/donordesk/releases/20260817065618 /opt/donordesk/current && systemctl
  restart donordesk-api donordesk-web`.

- **2026-08-17 (two-way Google Drive: folder listing + connect provisioning — release `20260817065618` API + web):**
  Deployed API + web via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api
  donordesk-web`). Drive is now fully two-way:
  1. **Connect-time provisioning:** `POST /v1/drive/callback` now calls
     `ProvisionTenantWorkspacesHandler` after a successful connect — creates the
     tenant "DonorDesk" root and every existing project's folder tree
     (idempotent; per-project failures recorded, connect still succeeds).
  2. **File listing:** `GET /v1/projects/:id/workspace/files?folders=…`
     (`ListWorkspaceFilesHandler` + `IProjectWorkspaceService.listProjectFolderFiles`)
     lists current files per workspace folder role — Drive API `files.list` for
     GOOGLE_DRIVE (folder files only, name/mime/size/modified/webViewLink) and
     `readdir` for the local mirror. Ensures the workspace first, so a fresh
     connection or unprovisioned project reconciles on demand.
  3. **Web:** `DriveFolderPanel` on the evidence ("Google Drive evidence folder",
     with per-file "Link as evidence" via `/v1/evidence/link-drive`), templates
     ("Donor templates in Google Drive"), and logframe ("Logframe & data files in
     Google Drive") pages. Each page load re-reads the storage (after-login
     recheck) and a "Refresh" button re-lists on demand. Pages are
     `force-dynamic`.
  Tests: app 58/58 (new ListWorkspaceFiles + ProvisionTenantWorkspaces), infra
  63/63 + 1 skipped (new Drive folder file listing). Verified live: api/web 200,
  current symlink `20260817065618`, deployed infra bundle has
  `listProjectFolderFiles`, deployed web chunk has the DriveFolderPanel. Rollback:
  `RELEASE_ID=20260817063832 scripts/rollback.sh` or `ln -sfn
  /opt/donordesk/releases/20260817063832 /opt/donordesk/current && systemctl
  restart donordesk-api donordesk-web`.

- **2026-08-17 (managed Google Drive evidence storage — release `20260817063832` API + web):**
  Deployed API + web via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api
  donordesk-web`). Uploaded evidence is now **saved into the tenant's Google
  Drive** in the provisioned project folder tree
  (`DonorDesk/<project>/04-Evidence-Reports` or `05-Evidence-Images`), instead
  of the link-first-only behavior that rejected byte uploads. Changes:
  `SaveEvidenceInput` gained `projectId`; `GoogleDriveEvidenceStorage.save()`
  branches (driveFileId → reference-only link, buffer → resolve project workspace
  + multipart upload with appProperties, grant service-account read access);
  `LocalEvidenceStorage` writes into the project workspace Evidence folder when a
  workspace is available; `UploadEvidenceHandler` skips DonorDesk-managed quota
  for GOOGLE_DRIVE tenants; container wires `projectWorkspace` into
  `EvidenceStorageResolver`; web evidence/new shows the file dropzone for all
  providers with "link an existing Google Drive file" as a secondary option.
  Tests: 62 infra (incl. new multipart/managed/workspace-folder tests) + 56 app,
  1 DB skipped. Verified live: api/web 200, current symlink `20260817063832`,
  deployed infra bundle contains the managed-upload path, web chunk has the new
  dropzone copy. Rollback: `RELEASE_ID=20260817061808 scripts/rollback.sh` or
  `ln -sfn /opt/donordesk/releases/20260817061808 /opt/donordesk/current &&
  systemctl restart donordesk-api donordesk-web`.

- **2026-08-17 (fix: Google Drive evidence upload — release `20260817061808` web-only):**
  Deployed web-only via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-web`).
  Bug: the demo tenant's `Organization.storageProvider` is `GOOGLE_DRIVE`
  (link-first), but the evidence upload page only offered a file dropzone that
  POSTs bytes to `/v1/evidence/upload`, so every upload failed with "Google
  Drive evidence requires a drive file id". Fix: the evidence/new page now
  fetches the tenant's storage provider from `/v1/organization` and, for
  `GOOGLE_DRIVE` tenants, shows a "Google Drive link" input (share link or file
  ID) that queues link items and posts them to the existing
  `/v1/evidence/link-drive` handler via `linkDriveEvidenceAction` (reference-only,
  no byte copy). Added `driveFileIdFromLink` (parses `/file/d/<id>`, `?id=`,
  bare IDs) and `fileTypeForName` to `upload-queue.ts`; the queue reducer now
  supports file and drive-link items. LOCAL/R2 tenants keep the file dropzone
  unchanged. Verified: web 200 loopback, current symlink `20260817061808`,
  deployed evidence/new chunk contains the Google Drive link UI. Rollback:
  `RELEASE_ID=20260817060540 scripts/rollback.sh` or `ln -sfn
  /opt/donordesk/releases/20260817060540 /opt/donordesk/current && systemctl
  restart donordesk-web`.

- **2026-08-17 (fix: template section review status lost on save — release `20260817060540` web-only):**
  Deployed web-only via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-web`).
  Bug: templates parsed from DOCX were created with `reviewStatus: "REVIEWED"`,
  but the web response schema (`TemplateSectionSchema` in `apps/web/src/lib/
  server/schemas.ts`) omitted `reviewStatus`, so the template editor loaded
  sections without it and `SectionEditor.save()` sent
  `reviewStatus: s.reviewStatus ?? "DRAFT"` — every "Save template" reset all
  sections to DRAFT, keeping the readiness blocker
  `TEMPLATE_HAS_NO_REVIEWED_REQUIRED_SECTIONS` on the new-reporting-period page.
  Fix: added `reviewStatus` to the web schema, pass it through `initialSections`,
  and added an explicit "Reviewed" checkbox + status badge per section in the
  editor so the review action is recorded. Users must re-tick Reviewed on
  required sections after this deploy (their stored sections are currently
  DRAFT). Verified: web 200 loopback, current symlink `20260817060540`, deployed
  template-editor chunk contains the Reviewed toggle. Rollback:
  `RELEASE_ID=20260817054906 scripts/rollback.sh` or `ln -sfn
  /opt/donordesk/releases/20260817054906 /opt/donordesk/current && systemctl
  restart donordesk-web`.

- **2026-08-17 (new reporting period setup checklist — release `20260817054906` web-only):**
  Deployed web-only via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-web`).
  The "New reporting period" page previously surfaced only the generic
  "Project setup is not complete; reporting periods are unavailable until the
  project is ready" error without explaining what was missing. The page now
  fetches `GET /v1/projects/:id/setup` readiness alongside templates and, when
  the project is not ready, renders a "Project setup is not complete" card
  listing every blocker (code + label) with a "Fix" link routed to the
  project-scoped page (`/reporting-profile` → `/projects/:id/setup/profile`,
  other hrefs prefixed with `/projects/:id`). The form also blocks submission
  until the blockers are resolved. Verified: web 200 loopback, current symlink
  `20260817054906`, deployed page chunk contains the checklist and the
  `/setup/profile` mapping. Rollback: `RELEASE_ID=20260817052925
  scripts/rollback.sh` or `ln -sfn
  /opt/donordesk/releases/20260817052925 /opt/donordesk/current && systemctl
  restart donordesk-web`.

- **2026-08-17 (per-section "Add a section" — release `20260817052925` web-only):**
  Deployed web-only via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-web`).
  The template review editor now shows an "Add a section" button next to each
  section's "Remove section" button; it inserts a new blank section immediately
  below the current one (the bottom "Add section" button still appends at the
  end). Verified: web 200, deployed chunk contains the new button. Rollback:
  `RELEASE_ID=20260817051940 scripts/rollback.sh` or
  `ln -sfn /opt/donordesk/releases/20260817051940 /opt/donordesk/current &&
  systemctl restart donordesk-web`.

- **2026-08-17 (delete donor template — release `20260817051940`):**
  Deployed API + web via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api
  donordesk-web`). Added `DELETE /v1/templates/:id` (`template.manage` capability):
  `DeleteTemplateHandler` (tenant-scoped delete + `template.deleted` audit),
  `IDonorTemplateRepository.delete`, Prisma `deleteMany`, authorization rule, web
  `deleteTemplateAction`, and a red "Delete template" danger-zone button at the
  bottom of the template review page (confirm dialog → back to the template
  list). Verified live: `/health`+`/ready` OK, web 200, DELETE route registered
  (401 unauthenticated), deployed bundles contain the route and the button.
  Rollback: `RELEASE_ID=20260817050512 scripts/rollback.sh` or
  `ln -sfn /opt/donordesk/releases/20260817050512 /opt/donordesk/current &&
  systemctl restart donordesk-api donordesk-web`.

- **2026-08-17 (template section extraction + review UI — release `20260817050512`):**
  Deployed API + web via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api
  donordesk-web`). Fixed the template "review sections" screen: the API release
  `20260817041505` still ran the old section-extraction heuristic (Roman-numeral
  prefix matched table cells like "Item"/"Indicator", numbered headings with a
  trailing dot were skipped, and guidance detail was dropped), so uploaded
  templates surfaced garbage sections.
  1. **Rich section extraction** (`StubTemplateExtractionService`): parses each
     heading's guidance block into description, `minWords`/`maxWords`,
     `evidenceNeeded`, and a better `inputType` (explicit "provide a
     narrative/table/indicator table/..." wins; title heuristics otherwise);
     optional markers and table-cell lines are handled; long guidance lines are
     kept. Demo templates regenerated with realistic per-section instructions
     (evidence, data tables with baseline/target/actuals, disaggregation,
     charts/photos). 5 new extraction tests (infra suite 59/59 + 1 skipped DB).
  2. **Review UI** (`SectionEditor`): each section now shows type/required/word
     limit badges, editable min/max word inputs, the parsed instructions, a
     "What this section requires" summary (word limit, data table,
     disaggregation, charts/photos, evidence), and evidence field. Template
     response schema includes `minWords`/`maxWords`.
  3. Verified live: loopback `/health`+`/ready` OK, web 200, deployed API bundle
     contains the new extraction (`minWords`), deployed web chunk contains the
     new review UI. Rollback: `RELEASE_ID=20260817044418 scripts/rollback.sh` or
     `ln -sfn /opt/donordesk/releases/20260817044418 /opt/donordesk/current &&
     systemctl restart donordesk-api donordesk-web`.

- **2026-08-17 (parse-file gateway fix — release `20260817044418` web-only):**
  Deployed web-only via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-web`).
  Root cause: the three template/logframe/indicator import pages posted uploaded
  documents to the browser-facing same-origin `/api/v1/*/parse-file`, which the
  production OLS `/api` context proxies **with the `/api` prefix intact** to the
  Fastify API (routes are `/v1/*`, not `/api/v1/*`) → Fastify 404 → "Failed to
  parse file". Same issue existed in dev (no Next.js route for `/api/v1/*`).
  Fixed by routing parsing through the existing server-side gateway: new
  `apps/web/src/lib/actions/parse.ts` `parseFileAction(kind, file)` calls
  `127.0.0.1:4001/v1/<kind>/parse-file` (multipart, Bearer token) exactly like
  every working server action; the three pages now use it. No API/host change
  required (the `/v1/templates|logframe|indicators/parse-file` routes already
  exist on the API). Verified: deployed bundle contains `parseFileAction`
  (server-reference-manifest + chunk 9379), old client fetch removed, web
  `/login` 200.
  Rollback: `RELEASE_ID=20260817041505 scripts/rollback.sh` (or
  `ln -sfn /opt/donordesk/releases/20260817041505 /opt/donordesk/current &&
  systemctl restart donordesk-web`).

- **2026-08-17 (Feature 20 Report Intelligence Engine core — release `20260817041505`):**
  Deployed API + web + prisma via `scripts/deploy-incremental.sh`
  (SERVICES=`donordesk-api donordesk-web`, incremental transfer ~5.5 MB).
  1. **Migration `20260816223000_report_intelligence`** applied as `donordesk_migrator`
     (via `DATABASE_ADMIN_URL`, `/usr/bin/prisma migrate deploy`): adds `Indicator.semanticsJson`,
     `ReportingPeriod.donorTemplateVersion`/`donorTemplateMappingId`, and the
     `ReportPlan` / `ReportClaim` / `ReportGenerationRun` / `DonorTemplateMapping`
     tables (with unique keys and indexes). All 10 migrations now applied.
  2. **RLS extended to 33 tenant tables** (added `ReportPlan`, `ReportClaim`,
     `ReportGenerationRun`, `DonorTemplateMapping`): `infra/postgres/rls.sql`
     applied as `donordesk_migrator`; `tenant_isolation` policy enabled+forced
     verified on all four new tables and DML grants confirmed for `donordesk_app`.
  3. **Feature 20 core:** decimal-safe deterministic indicator analyst
     (`IndicatorAnalyticsService` + domain calculator), indicator semantics
     inference with descriptive-only fallback, immutable `ReportGenerationRun`
     snapshot, structured claim provenance with evidence-hash/chunker-version
     snapshots, tiered deterministic claim verifier, approval gates on
     `ApproveReportHandler`/`ApproveReportSectionHandler`, reject transition
     (`POST /v1/report-drafts/:id/reject`), permission-controlled claim
     resolution (`POST /v1/report-claims/:id/resolve`), `DONOR_TEMPLATE` export
     type, and report-plan/claim/run/mapping persistence.
  4. Verified live: services active, loopback `4001` `/health`+`/ready` OK
     (database ok), web `/login` 200, both new routes registered (401
     unauthenticated), public HTTPS `/login` 200, no new journal errors.
     Rollback:
     `RELEASE_ID=20260816094257 scripts/rollback.sh` or
     `ln -sfn /opt/donordesk/releases/20260816094257 /opt/donordesk/current &&
     systemctl restart donordesk-api donordesk-web`.

- **2026-08-16 (Project Team & Settings, compliance auto-generation, report rewrite,
  template extraction — release `20260816094257`, commit `14fd2eb`):** Deployed API + web
  + prisma via `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api donordesk-web`,
  incremental transfer ~5.4 MB). Workers code updated in place (`app/compliance.py` +
  `app/main.py` copied to `/opt/donordesk/workers/app/`, backups `.bak-20260816`,
  service restarted, loopback 8092 health OK, `/v1/detect-checklist` 401 without token
  and 200 with token).
  1. **Migration `20260816140000_project_members`** applied as `donordesk_migrator`
     (loopback trust): creates `ProjectMember` (tenant-scoped, role/status/assignedBy/
     assignedAt) with unique `(tenantId, projectId, userId)` + two indexes. All 9
     migrations now applied.
  2. **RLS extended to 29 tenant tables** (added `ProjectMember`):
     `infra/postgres/rls.sql` applied as `donordesk_migrator`; `tenant_isolation`
     policy enabled+forced verified on `ProjectMember`. RLS tested as restricted
     `donordesk_app` with a temporary row (INSERT/select OK in-tenant, cross-tenant
     count 0; test row deleted).
  3. **New API routes** (all auth-gated 401 unauthenticated): `GET /v1/projects/:id/members`
     + `POST /v1/projects/:id/members` (assign, `users.manage`), `PATCH`/`DELETE
     /v1/project-members/:id` (role change / removal), `POST /v1/reporting-periods/:id/checklist/bulk-resolve`
     (`checklist.manage`), `POST /v1/report-sections/:id/rewrite` (`report.edit`).
  4. **Compliance auto-generation:** `ReportingPeriodCreated` event → outbox →
     canonical `checklist.generate` job (Kestra flow `checklist_generate` already
     deployed; memory handler registered for dev). Detection dedupes by (type, entity)
     so re-runs never duplicate active items; report-type baseline checklist
     templates added (config-driven).
  5. **Web UI:** project Team tab (assign/change-role/remove, audit + notification),
     project Settings full editor (identity/dates/budget/status + archive/complete
     danger zone), Compliance bulk actions, report section "AI rewrite" (rewrite/
     shorten × donor/internal/general audience).
  6. Verified live: all services active, loopback `4001`/`3002` healthy, `/health`+`/ready`
     OK (database ok), web `/login` 200, all six new routes 401 unauthenticated,
     deployed bundles contain the new handlers, no new journal errors. Public HTTPS
     `/` + `/login` 200. Rollback:
     `RELEASE_ID=20260816083703 scripts/rollback.sh` or
     `ln -sfn /opt/donordesk/releases/20260816083703 /opt/donordesk/current &&
     systemctl restart donordesk-api donordesk-web`.

- **2026-08-16 (Spreadsheet-style indicator data entry — release `20260816083703`,
  commit `d659c4f`):** Deployed API + web + prisma via
  `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api donordesk-web`,
  incremental transfer 10 MB).
  1. **Migration `20260816090000_indicator_update_unique`** applied as
     `donordesk_migrator` (via `DATABASE_ADMIN_URL`): dedupes existing
     `IndicatorUpdate` rows (keeps earliest per `tenantId, indicatorId,
     reportingPeriodId`) and adds the unique index
     `IndicatorUpdate_tenantId_indicatorId_reportingPeriodId_key` (verified in
     `pg_indexes`).
  2. **New API routes** (all auth-gated 401 unauthenticated): `GET /v1/reporting-periods/:id/indicators`
     (logframe indicators merged with their updates for the period, `project.view`),
     `POST /v1/indicator-updates/bulk` (one-call grid upsert, `indicator.update`),
     `POST /v1/indicator-updates/parse-sheet` (Google Sheets preview via the
     tenant's Drive OAuth connection — new `spreadsheets.readonly` scope — mapped
     by indicator code, `indicator.update`). Single `POST /v1/indicator-updates`
     now upserts too (no duplicate rows) via the shared `upsertIndicatorUpdate`
     helper; verified rows are locked against edits; closed periods reject writes.
  3. **New UI:** `/projects/[id]/reports/[periodId]/indicators` spreadsheet-style
     entry grid (grouped by logframe level, editable cells, dirty tracking,
     Save all, per-row Submit & verify, status badges) with a Google Sheets
     import panel (preview → apply to grid). Linked from the reports list, the
     report workspace header, and the project setup page.
  4. Verified live: loopback `4001`/`3002` healthy, `/health`+`/ready` OK, new
     routes registered (401), public HTTPS `/` + `/login` 200, entry page
     auth-gated 307, no new journal errors, deployed bundle contains the new
     routes and the entry-grid client refs. Application test suite 53/53
     (6 new indicator-entry tests); full workspace typecheck/lint/build green.
     Rollback: `RELEASE_ID=20260816074220 scripts/rollback.sh` or
     `ln -sfn /opt/donordesk/releases/20260816074220 /opt/donordesk/current &&
     systemctl restart donordesk-api donordesk-web`.

- **2026-08-16 (Google OAuth verification signals — release `20260816070838`
  web-only):** Added homepage signals for Google's OAuth consent-screen
  verification: JSON-LD `@graph` (`Organization` + `WebApplication`) naming
  "DonorDesk" with a purpose description and logo URL, `<meta name="application-name"
  content="DonorDesk">`, and the H1 now starts with "DonorDesk — from scattered
  field evidence to donor-ready reports". Verified live: `application-name` meta,
  one JSON-LD block, H1 contains the name; `/`, `/login`, `/privacy`, `/terms` 200.

- **2026-08-16 (final brand assets — release `20260816065354` web-only):** Switched
  logo to `Public/Images/Logo/logo2.png` (1653x589, RGBA with transparency — no
  more `mix-blend-multiply` needed) and favicon to `favicon2.png`. Regenerated
  `apps/web/public/brand/donordesk-logo.png`, `app/icon.png` (512) +
  `favicon.ico` (32), and the `apps/superadmin` copies. Homepage hero logo
  doubled to `h-40`/`sm:h-48`/`md:h-56`; nav (`h-9`), footer (`h-10`), legal
  layout, and portal AppShell updated to the new 1653x589 source. Verified live:
  `/brand/donordesk-logo.png`, `/icon.png`, `/favicon.ico` 200; homepage/login/
  privacy/terms 200.

- **2026-08-15 (brand refresh — release `20260815142910` web-only):** Replaced the
  earlier JPEG-based mark with the final brand assets: `Public/Images/Logo/logo.png`
  (wide logo incl. wordmark + tagline) and `favicon.png`. Assets deployed:
  `apps/web/public/brand/donordesk-logo.png` (display), `app/icon.png` (512) +
  `favicon.ico` (32) from `favicon.png`; also copied into `apps/superadmin` (repo
  only). Landing page: removed the "AI-assisted donor reporting for NGOs" hero badge
  and placed a larger logo above the H1; nav and footer now show the wide logo alone
  (text "DonorDesk" removed — it is part of the logo); footer logo enlarged (h-10).
  Legal layout nav/footer and portal AppShell use the wide logo with `mix-blend-multiply`
  so the white canvas blends into dark/light headers. Verified live: `/brand/donordesk-logo.png`,
  `/icon.png`, `/favicon.ico` 200 with correct types; homepage/legal/login 200.

- **2026-08-15 (brand logo + favicon — release `20260815135837` web-only):** Used
  `Public/Images/Logo/DonorDesk_logo.jpeg` (1408x768) as the app logo and favicon.
  Added `apps/web/public/brand/donordesk-logo.jpeg` (original) and a 512px
  center-square crop `donordesk-logo-square.png`; replaced the gradient "D" brand
  marks with the image (landing nav/footer, legal layout, portal AppShell) via
  `next/image`. Favicon: `app/icon.png` + `favicon.ico` (replaces `icon.svg`);
  also added to `apps/superadmin` (repo only, not yet in a superadmin release).
  Verified live: `/icon.png`, `/favicon.ico`, `/brand/donordesk-logo-square.png`
  all 200 with correct content types; HTML references the image; `/login` 200,
  `/dashboard` auth-gated 307. Cleaned up stale `/tmp/dd-release-*` dirs that had
  caused an earlier `ERR_PNPM_ENOSPC` during packaging.

- **2026-08-15 (domain swap `donerdesk.online` → `donordesk.online`):** Reconfigured
  the shared host and web app to the correct domain (one-letter E→O swap); no DB or
  release re-deploy of the app code was required.
  1. **DNS verified:** `donordesk.online`, `www.donordesk.online` → `109.123.248.253`.
  2. **OLS vhosts created:** `/usr/local/lsws/conf/vhosts/donordesk.online/vhost.conf`
     (routes `/`→3002, `/api`→4001, `/api/auth`→3002; alias `www.donordesk.online`)
     and `/usr/local/lsws/conf/vhosts/sa.donordesk.online/vhost.conf` (`/`→3012).
     Added `map` entries to all three listeners (Default/HTTP, SSL, SSL IPv6) and
     the `virtualHost` declarations. `litespeed -t` showed no new errors beyond the
     pre-existing unrelated vhost errors and the same UID/GID warning class as the
     original vhosts.
  3. **Let's Encrypt issued** via webroot (`/usr/local/lsws/Example/html`):
     `donordesk.online` (+ SAN `www.donordesk.online`, expires 2026-11-13) and
     `sa.donordesk.online` (expires 2026-11-13); renewal configs created (unlike
     the old empty donerdesk renewal conf). `vhssl` blocks point at the new certs.
  4. **Env swap on host:** `CORS_ORIGINS`, `GOOGLE_DRIVE_REDIRECT_URI`,
     `GOOGLE_AUTH_REDIRECT_URI` in `/opt/donordesk/shared/api.env` and
     `APP_URL=https://donordesk.online` in
     `/etc/systemd/system/donordesk-web.service.d/google.conf`; `daemon-reload` +
     restart of `donordesk-api`/`donordesk-web`. Google Cloud Console redirect
     URIs are an operator follow-up (the `/api/auth/google/start` consent URL now
     advertises `redirect_uri=https://donordesk.online/api/auth/google/callback`).
  5. **Web-only release `20260815092056` deployed** (incremental) with the updated
     strings: `metadataBase`/`og:url` `https://donordesk.online`, privacy/terms
     pages, landing `sales@donordesk.online`, legal footer brand. Verified:
     `/`, `/login`, `/privacy`, `/terms` 200 on `https://donordesk.online`; no
     `donerdesk.online` strings remain in served pages; Google sign-in button still
     present; `/api/auth/google/start` 307 with new-domain `redirect_uri`.
  6. **Old domain retired to 301:** `donerdesk.online` (+`www`) → `donordesk.online`
     and `sa.donerdesk.online` → `sa.donordesk.online` via per-vhost rewrite
     `RewriteRule ^(.*)$ https://donordesk.online$1 [R=301,L]`. Old LE certs
     (expire 2026-11-10) keep the redirects working for now; the old renewal conf
     is empty so it will **not** auto-renew — fully retire old vhost/maps/certs and
     drop old DNS when the transition is done.
  7. **Rollback/backup:** pre-change config snapshots in
     `/root/donordesk-domain-swap-20260815111751/` (httpd_config.conf, both old
     vhost dirs, api.env, google.conf). Rollback = restore those files, remove new
     vhosts/maps, `certbot delete --cert-name donordesk.online` (and
     `sa.donordesk.online`), redeploy previous web release, restore envs.
  8. **Google Cloud Console (operator):** add
     `https://donordesk.online/api/auth/google/callback` and
     `https://donordesk.online/api/auth/drive/callback` as authorized redirect URIs
     in the existing OAuth client (and remove/keep the old `DonerDesk.online` URIs
     as desired).

- **2026-08-15 (Tiers, Entitlements, and Payments — release `20260815082750`):**
  Deployed API + web + prisma via the incremental immutable-release path
  (`scripts/deploy-incremental.sh`, 11.4 MB transferred).
  1. **Migration `20260815070000_billing_entitlements`** applied as
     `donordesk_migrator` (loopback trust): created `BillingSubscription`,
     `EntitlementGrant`, `BillingEventInbox`, `UsageCounter`, `TrialIdentity`,
     and extended `LlmRun` with usage-ledger columns (`operationType`,
     `resourceId`, `billableUnits`, `requestId`).
  2. **RLS extended to 28 tenant tables** (added `BillingSubscription`,
     `EntitlementGrant`, `UsageCounter`, `TrialIdentity`; `BillingEventInbox`
     intentionally left non-tenant because it is the public webhook inbox whose
     tenant is resolved after signature verification). `infra/postgres/rls.sql`
     applied as `donordesk_migrator`; `tenant_isolation` policies verified on the
     new tables.
  3. Restarted `donordesk-api` + `donordesk-web`; verified loopback bindings
     (3002/4001), `/health` + `/ready`, new routes
     `/v1/billing/summary`, `/v1/billing/checkout`, `/v1/billing/portal`,
     `/v1/webhooks/creem` (all auth/signature-gated 401), public HTTPS `/` +
     `/login` 200, landing `#pricing` section + signup `?plan=` selector present,
     no new journal errors.
  Scope: Feature 19 — plan catalog (Starter/Team/Growth/Enterprise), central
  tenant provisioning with one-time 14-day trials, authoritative project/seat/
  storage/AI-credit enforcement, `BillingProvider` port with stub default +
  Creem adapter (env-gated `BILLING_PROVIDER=creem`), webhook inbox +
  subscription sync, checkout/customer-portal routes, landing pricing, signup
  plan carry-through (local + Google OAuth state), `/settings/billing` page.

- **2026-08-15 (Account-wide Onboarding restructure — release `20260815063021`):**
  Deployed API + web + prisma via the incremental immutable-release path.
  1. **Removed project-specific steps from the account Onboarding wizard** —
     "Create a project", "Add a donor template", "Add a logframe", "Upload
     evidence" are no longer account steps. They remain in the per-project
     setup checklist (`/projects/[id]/setup`, Feature 18).
  2. **Added an account-wide "Default reporting profile" step**
     (`/onboarding/reporting-defaults`): default tone, report language,
     formatting rules, deadline offset, auto-period creation. Stored on
     `Organization.reportingDefaults` (JSON); applied by `CreateProjectHandler`
     to seed every new project's `ReportingProfile`.
  3. **Migration `20260815060000_onboarding_reporting_defaults`** applied as
     `donordesk_migrator` (`Organization.reportingDefaults` TEXT DEFAULT '{}').
     Existing RLS policy on `Organization` covers the new column (no table
     change). Verified: API health/ready, web 200, new route
     `PUT /v1/organization/reporting-defaults` registered (401 unauthenticated),
     public HTTPS `/login` 200, `/onboarding` redirects to login, no journal
     errors.

- **2026-08-15 (Feature 18 Project Creation Wizard — release `20260815054218`):**
  Deployed API + web + prisma via the incremental immutable-release path.
  1. **Migration `20260815000000_project_bootstrap`** applied as
     `donordesk_migrator` (loopback trust): added `ProjectSetup` +
     `ReportingProfile` tables, `Project.workspaceRootId`,
     `Organization.driveRootFolderId`, `ReportingPeriod`
     `reportingProfileSnapshotJson`/`templateSnapshotJson`, and a tenant-scoped
     unique `Project(tenantId, projectCode)` (legacy duplicates renamed with a
     numeric suffix in the migration). First attempt hit a PL/pgSQL syntax error
     (nested `FOR ... IN` loop target must be declared); migration fixed,
     failed `_prisma_migrations` record deleted, re-run succeeded — no partial
     DDL was left behind.
  2. **RLS extended to 24 tenant tables** (added `ProjectSetup`,
     `ReportingProfile`): `infra/postgres/rls.sql` regenerated, applied as
     `donordesk_migrator`; `tenant_isolation` policies + `donordesk_app` DML
     grants verified on both new tables.
  3. Restarted `donordesk-api` + `donordesk-web`; verified loopback bindings,
     `/health` + `/ready`, web 200, workers, Kestra 200, new routes
     `/v1/projects/:id/setup`, `/setup/acknowledge`, `/workspace/retry|repair`,
     `/reporting-profile` (all auth-gated 401), public HTTPS `/` + `/login` 200,
     no journal errors.
  Scope: project setup readiness/blockers, authoritative reporting-period gate
  with immutable template/profile snapshots, Google Drive + Local workspace
  provisioning (idempotent/retryable/repairable, stable Drive appProperties),
  per-project reporting profile, editable dates/budget with overlap protection,
  lifecycle transitions, setup-checklist UI + wizard redirect. Google Drive
  folder creation remains credential-gated (no tenant OAuth client yet).

- **2026-08-14 (Drive connect 500 on /onboarding/storage — middleware fix):**
  Deployed web-only release `20260814174448`. Clicking "Connect Google Drive"
  on `/onboarding/storage` returned 500: the OLS proxy duplicates the `Origin`
  header (`https://donerdesk.online, https://donerdesk.online`) and the Next.js
  server action threw `ERR_INVALID_URL`. The existing `apps/web/src/middleware.ts`
  Origin-dedupe matcher did not include `/onboarding/*`. Added
  `/onboarding/:path*` to the matcher; verified the deployed
  `middleware-manifest.json` lists it. No new journal errors after deploy.

- **2026-08-14 (Google Sign-In auto-provisioning — new accounts):** Deployed
  release `20260814173419` (API + web). Google Sign-In previously failed for any
  email without an existing DonorDesk account ("Google Sign-In failed"). Added
  auto-provisioning to `GoogleSignInHandler` (`packages/application/src/use-cases/
  identity/google-sign-in.ts`): unknown emails now get a new tenant (org created
  with the Google profile's name + defaults) and an ACTIVE ADMIN user with a
  random unusable password hash, and the response carries `provisioned: true`.
  Contracts: `GoogleSignInResponseSchema` gained `provisioned` (default false).
  Container wires `ids` + `organizations` into the handler. Web
  `AuthService.googleSignIn` surfaces `provisioned`, and the Google callback
  redirects new users to `/onboarding` (existing users continue to `/dashboard`).
  Tests: application suite updated + passing (16/16); full workspace build green;
  API tests 19/19. Verified live: `/v1/auth/google` route 400 (registered),
  deployed handler contains `provisioned` (7 hits), web callback bundle contains
  the `/onboarding` redirect. Behavior: new gmail → onboarding flow → dashboard;
  existing user → their dashboard.

- **2026-08-14 (Google Sign-In session-cookie SameSite fix):** Deployed web-only
  release `20260814170528`. After successful Google sign-in, the app redirected
  back to `/login?next=%2Fdashboard`: the `dd_session` cookie was set with
  `SameSite=strict`, and browsers (Firefox) withhold Strict cookies set during
  the cross-site OAuth redirect chain when the follow-up `/dashboard` request is
  made. Changed `dd_session` to `SameSite=lax` in the Google + OIDC callback
  routes and in `lib/session-server.ts` (used by email/password login).
  Verified the deployed server bundle now contains `sameSite:"lax"` for
  `dd_session` and `dd_google_state`.

- **2026-08-14 (Google Sign-In state-cookie SameSite fix):** Deployed web-only
  release `20260814165333`. Users consistently got "The sign-in link expired"
  (`?error=invalid_callback`) because the OAuth state cookies were set with
  `SameSite=strict`, which browsers withhold on the cross-site top-level redirect
  back from `accounts.google.com` → the callback's `dd_google_state` check failed.
  Changed all OAuth state cookies to `SameSite=lax` (the standard for OAuth
  state, sent on top-level cross-site navigations): `dd_google_state`
  (`api/auth/google/start`), `dd_gdrive_state` (`lib/actions/drive.ts`), and
  `dd_oidc_state`/`dd_oidc_verifier` (`api/auth/oidc/start`). Verified live:
  `Set-Cookie: ... SameSite=lax`. Also hardened the packager's API smoke check
  (retry loop instead of a fixed 3 s sleep) and freed local `/tmp` release
  dirs that caused an `ENOSPC` packaging failure.

- **2026-08-14 (Google Sign-In redirect-origin fix):** Deployed web-only release
  `20260814164540` (incremental). Post-OAuth redirects in the web callback routes
  were built from `request.url`, which Next.js derives from the internal host
  (`127.0.0.1:3002`), so browsers were redirected to `https://localhost:3002/...`
  after sign-in. Changed `apps/web/src/app/api/auth/{google,drive}/callback/route.ts`
  (and the OIDC callback for consistency) to redirect using `APP_URL`
  (`https://DonerDesk.online`) instead. Verified publicly: callback redirects now
  target `https://donerdesk.online/...`; login page still shows the Google button.

- **2026-08-14 (Google Sign-In + Drive OAuth credentials live on production):**
  Deployed release `20260814163637` to `DonerDesk.online` via
  `scripts/deploy-incremental.sh` (SERVICES=`donordesk-api donordesk-web`,
  incremental transfer 3.4 MB). Google Sign-In is now **enabled end-to-end**:
  - Added Google OAuth vars to `/opt/donordesk/shared/api.env`
    (`GOOGLE_DRIVE_CLIENT_ID`/`_SECRET`, `GOOGLE_DRIVE_REDIRECT_URI`,
    `GOOGLE_AUTH_REDIRECT_URI` → `https://DonerDesk.online/...`; `AUTH_PROVIDER=jwt`
    deduplicated; backup `api.env.bak-*` kept). `PLATFORM_MASTER_KEY` already present.
  - Added web systemd drop-in `/etc/systemd/system/donordesk-web.service.d/google.conf`
    (`GOOGLE_DRIVE_CLIENT_ID`, `APP_URL=https://DonerDesk.online`) so the
    `/api/auth/google/start` route builds the consent URL with the public host.
  - Rebuilt the web off-host with `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` (login
    button statically inlined; OIDC button compiled out via
    `NEXT_PUBLIC_OIDC_ENABLED=false`).
  - **OLS fix:** added a more-specific `context /api/auth` → `donordesk_web`
    (3002) to `/usr/local/lsws/conf/vhosts/donerdesk.online/vhost.conf` (backed
    up to `/root/donerdesk-vhost.conf.bak-*`). Previously all `/api/*` went to
    the Fastify API (4001), so the Next.js Google/OIDC auth routes 404'd publicly.
    Validated with `litespeed -t` (no new errors vs baseline), graceful
    `lswsctrl restart`. Verified other colocated vhosts (hq/cc.neurecore.com)
    still 200; `brain.neurecore.com` 404 is pre-existing.
  - Verified: loopback API `/health`+`/ready` OK; `POST /v1/auth/google` returns
    400 (route live); public `/login` shows "Sign in with Google"; public
    `/api/auth/google/start` → 307 to `accounts.google.com`; browser click
    reached the Google consent page with `redirect_uri=https://DonerDesk.online/
    api/auth/google/callback` accepted (OAuth client registered). Sign-in still
    matches existing users by email only (auto-provisioning pending).
  - Rollback: `scripts/rollback.sh RELEASE_ID=20260814154500` + restore the
    `api.env.bak-*`/vhost `.bak-*` files if needed.

- **2026-08-14 (Legal pages published + onboarding Terms-of-Reference consent):**
  Deployed release `20260814181859` (API + web, incremental transfer ~4.1 MB).
  Added public `/privacy` and `/terms` pages (global Privacy Policy with GDPR/UK
  GDPR + CCPA layered provisions, cookies, security-incident and vulnerability-
  disclosure clauses; global Terms of Service with onboarding-consent clause,
  child-exploitation prohibition, backups/beta disclaimers, DMCA takedown notice,
  and neutral governing-law/dispute clause). Marketing-page footer links both.
  Added a final onboarding step: a Terms-of-Reference consent card
  (checkmark + accept) that calls the new authenticated `POST /v1/legal/consent`
  endpoint; consent is recorded in the immutable audit chain
  (`legal.consent.recorded`, versions `2026-08-14`, actor/tenant/ip/timestamp)
  and read back via `GET /v1/legal/consent` so the onboarding step persists as
  complete. Wired `RecordLegalConsentHandler`/`GetLegalConsentHandler` in the
  container, extended `listByTenant` audit filters with `eventType`/`actorId`,
  and added 4 application unit tests (application suite 20/20; API tests 19/19;
  full workspace typecheck/lint/build green). Verified live: `/privacy` and
  `/terms` 200 with new sections; created a throwaway test workspace
  (`consent.test.0814@example.org` / org `Consent Test Org`) and confirmed the
  onboarding consent checkbox records an audit row visible in `/audit`.
  Test workspace remains in the production DB pending operator cleanup.
  Rollback: `scripts/rollback.sh RELEASE_ID=20260814180332`.

- **2026-08-14 (Onboarding step correctness + ToR consent gate):** Deployed
  release `20260814184043` (web-only content, incremental transfer ~3.9 MB).
  - Google Sign-In auto-provisioning previously created an org (`country
    UNKNOWN`/`organizationType OTHER`) and a lone ADMIN user, so the onboarding
    "Organization profile" and "Invite your team" steps wrongly showed "Done".
    `onboarding-status.ts` now fetches the full org profile and marks
    "Organization profile" complete only when `country` is filled in and not
    `UNKNOWN`; "Invite your team" is complete only when `teamCount > 1`.
  - Moved the profile and team forms into the onboarding flow:
    `/onboarding/profile` (reuses `SettingsPanel`) and `/onboarding/team`
    (reuses `TeamPanel`), so setup can be completed without `/settings` or
    `/team`. Completed onboarding steps now show a "Done" badge plus an
    "Edit" button linking back to the relevant form.
  - Added a ToR/Privacy consent gate in the portal layout
    (`(portal)/layout.tsx`): until `GET /v1/legal/consent` reports acceptance,
    every portal page other than `/onboarding*` and `/logout` redirects to
    `/onboarding`; the gate fails open if the consent endpoint errors.
  - Verified live: new user `gate.test.0814@example.org` (org `Gate Test Org`)
    shows "Invite your team → No teammates yet (pending)" and an Edit button on
    completed steps; `/dashboard`, `/settings`, and `/projects` all redirect to
    `/onboarding` until consent is accepted, then become reachable. Google-
    provisioned org state (country `UNKNOWN` → profile pending) verified by
    logic; real Google OAuth not exercised in this check. Two throwaway test
    workspaces (`consent.test.0814@example.org`, `gate.test.0814@example.org`)
    remain in the production DB pending operator cleanup.
  - Rollback: `scripts/rollback.sh RELEASE_ID=20260814183621`.

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
  through public HTTPS. See §21.1 (preferred release path) for the current
  incremental-deployment procedure.

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
