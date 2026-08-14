# Contabo Lean Deployment — DonorDesk

**Status:** Host-verified production design; implementation gates remain.  
**Live host audit:** 2026-08-12 09:15–09:17 CEST, read-only.  
**Host source of truth:** [`../memorybank/contabo-ops.md`](../memorybank/contabo-ops.md).

This plan is tailored to the actual shared Contabo server and the current
DonorDesk repository. It must not be executed as a blind copy/paste recipe. The
host audit changed several earlier assumptions, and the application still has
code-level production blockers described below.

## 1. Final architecture decision

Deploy DonorDesk in two controlled stages.

### Stage A — reliable core

```text
Internet
   |
   | HTTPS :443 (already public)
   v
OpenLiteSpeed 1.8.4 + nghttpx
   |-- /       -> 127.0.0.1:3002  DonorDesk Next.js
   |-- /api/*  -> 127.0.0.1:4001  DonorDesk Fastify
   `-- WebSocket upgrade -> 127.0.0.1:4001

Native/systemd DonorDesk services
   |-- donordesk-web      127.0.0.1:3002
   |-- donordesk-api      127.0.0.1:4001
   `-- donordesk-workers  127.0.0.1:8092 (only after integrated)

Shared native infrastructure
   |-- PostgreSQL 16.14   host :5432, dedicated DB and roles
   |-- Prometheus 2.55.1  existing host-network container
   `-- Grafana 11.3.0     existing host-network container
```

Use systemd for DonorDesk rather than adding to the existing root-owned PM2
process set. The host already has seven PM2 applications from other projects and
the root PM2 dump is a shared blast radius. Systemd provides clean Unix-user,
filesystem-hardening, journald, dependency, and restart boundaries.

### Stage B — durable asynchronous and AI features

Activate only after code integration and end-to-end tests:

```text
Redis ACL user + BullMQ       durable jobs
Kestra + dedicated Postgres  orchestration, if still justified
Real LLM adapters            provider-selected governed AI
Production notifications     email/in-app delivery
Object storage, if required  durable/off-host evidence
Tempo                         traces, if operationally valuable
Loki + Alloy                  logs, if operationally valuable
```

Starting containers does not activate these features. The runtime dependency
container must select the adapter and a production-path test must prove it.

## 2. What was actually verified on Contabo

The remote audit read live service metadata and configuration without reading
secrets or changing the host.

| Resource | Verified state |
|---|---|
| OS | Ubuntu 24.04, kernel `6.8.0-124-generic` |
| CPU | 6 vCPUs |
| RAM | 11 GiB total; 6.7 GiB available |
| Swap | 2 GiB; approximately 585 MiB in use |
| Disk | 96 GiB; 66 GiB used; 31 GiB free (69%) |
| Node | 20.20.2 |
| Global pnpm | 9.15.9 |
| Python | 3.12.3; no Python 3.11 binary |
| Docker / Compose | 29.5.2 / 5.1.4 |
| PM2 | 6.0.14; seven existing processes, all root-owned |
| PostgreSQL | 16.14 native cluster, 200 max connections |
| Redis | loopback, authenticated; credentials not inspected |
| OLS | OpenLiteSpeed 1.8.4, 21 vhost files |
| Observability | Prometheus, Alertmanager, and Grafana only |
| DonorDesk | not installed; no matching `/opt` directory |

The existing PM2 set consumes roughly 990 MiB at the audit instant. Six Docker
containers consume roughly 250 MiB, with 3.8 GiB of images and 1.2 GiB build
cache. These figures exclude PostgreSQL, OLS, Elasticsearch, mail, CyberPanel,
sidecars, filesystem cache, and workload spikes. Therefore, the earlier fixed
“940 MB total” and “5.8 GB headroom” claims are withdrawn.

The host has enough observed capacity for the Stage A core, but approval depends
on a staging load test with representative 100-MB uploads and simultaneous PDF,
DOCX, XLSX, and ZIP exports. Maintain at least 20% disk and RAM safety margins.

## 3. Existing shared-host constraints

Do not interrupt or reconfigure these existing workloads during DonorDesk work:

- seven root PM2 applications, including NeureCore, GFC, and Shahisoft;
- three systemd sidecars on 8080, 8082, and 8091;
- GFC Docker services on loopback 8081 and 6380;
- PostgreSQL databases for NeureCore, LifeOSA, and EcoEarthShop;
- CyberPanel/OpenLiteSpeed, mail, MariaDB, Redis, Elasticsearch, and nghttpx;
- Prometheus, Alertmanager, and Grafana Compose project under
  `/opt/neurecore/observability`.

The NeureCore backend showed 4,822 PM2 restarts. That is an existing stability
signal and must be investigated separately before assuming all available RAM is
safe DonorDesk headroom.

Global software upgrades and cleanup are forbidden in the DonorDesk change:

- do not replace global pnpm 9.15.9 with DonorDesk's pnpm 10.34.5;
- do not upgrade Node, Python, Docker, PostgreSQL, OLS, or PM2;
- do not prune Docker globally;
- do not restart/reload all PM2 applications;
- do not alter unrelated vhosts, TLS certificates, firewall rules, or databases.

## 4. Current DonorDesk implementation blockers

The repository typechecks and builds, but it is not yet a fully functioning
production artifact.

| Blocker | Repository evidence | Required fix |
|---|---|---|
| No versioned migrations | Prisma schema exists; no `migrations/` | Generate, review, commit, and test migrations |
| Production migration command mismatch | existing script uses `db push --accept-data-loss` | use `prisma migrate deploy` only |
| API bind ignores `HOST` | server hard-codes `0.0.0.0` | respect `HOST`, default production loopback |
| Web is not standalone | `output: "standalone"` absent | enable and verify monorepo tracing/static files |
| Browser API defaults to localhost | public API URL defaults to `localhost:4000` | use same-origin `/api` or production HTTPS URL |
| Redis jobs not wired | `InMemoryJobQueue` always selected | wire and test BullMQ factory |
| Evidence storage default is LOCAL | `EvidenceStorageResolver` falls back to LOCAL | connect Google Drive (link-first) or wire R2 per tenant; see `gdrive.md` |
| R2 config not env-wired | `R2EvidenceStorage` exists, resolver passes placeholder config | add R2 env (account/key/bucket) and instantiate it |
| LLM handlers remain stubs | LLM factory is not selected by handlers | wire provider-specific implementations |
| Notifications log only | logging adapter selected | implement email/notification delivery |
| Kestra flow is invalid | nonexistent internal routes/module references | replace with tested contracts |
| Worker is disconnected | routes exist, no production caller | authenticate and integrate or omit service |
| OTel is disabled by default | exact enable/endpoint variables required | test trace ingestion before Tempo |
| Loki pipeline absent | no Alloy/Promtail or persistence | implement full pipeline or omit Loki |

No deployment procedure can turn unwired adapters into comprehensive features.
Stage A may be production-ready for the synchronous feature set only after its
mandatory gates pass. Stage B is required for durable background processing and
real external AI/notification/storage providers.

## 5. Mandatory release gate

### 5.1 Code and artifact

- [ ] Clean-checkout `pnpm -r typecheck`, `pnpm -r test`, and `pnpm -r build` pass.
- [ ] Real Prisma migrations exist and pass empty-DB and upgrade tests.
- [ ] `db push --accept-data-loss` is removed from every production path.
- [ ] API listens on `127.0.0.1` when `HOST=127.0.0.1`.
- [ ] Web standalone output includes workspace dependencies and `.next/static`.
- [ ] Browser and server-side API requests use the final same-origin design.
- [ ] `/api` proxy prefix handling matches Fastify route registration.
- [ ] WebSocket proxying is tested through OLS.
- [ ] Required environment values fail fast at startup.
- [ ] Artifact contains no `.env`, secrets, dev DB, uploads, or caches.
- [ ] Artifact starts without a production `pnpm install`.
- [ ] Artifact records commit, timestamp, Node/pnpm versions, and SHA-256 manifest.

### 5.2 Database and tenancy

- [ ] Separate migrator and restricted runtime roles exist.
- [ ] Runtime role is not owner, superuser, or `BYPASSRLS`.
- [ ] RLS is forced on every tenant table.
- [ ] Tenant tests run over the same TCP/runtime connection path as production.
- [ ] Missing tenant context denies access.
- [ ] Cross-tenant read/write attempts fail.
- [ ] Every API mutation creates the required audit record.

### 5.3 Operations

- [ ] Same-day port and capacity preflight passes.
- [ ] Chosen DNS record resolves to the host.
- [ ] A dedicated OLS vhost and certificate exist.
- [ ] No new OLS validation error is introduced.
- [ ] Off-host database and storage backups complete successfully.
- [ ] Restore succeeds on a clean environment.
- [ ] External HTTPS monitoring and alert delivery work.
- [ ] Public end-to-end acceptance suite passes.
- [ ] Rollback to the preceding immutable release is tested.

## 6. Verified port allocation

The audit found these candidate ports free:

| DonorDesk service | Candidate | Binding |
|---|---:|---|
| Web | 3002 | `127.0.0.1` only |
| API | 4001 | `127.0.0.1` only |
| Worker | 8092 | `127.0.0.1` only; optional |

Recheck immediately before deployment:

```bash
ssh contabo '
  for port in 3002 4001 8092; do
    if ss -lntH "sport = :$port" | grep -q .; then
      echo "Port $port is occupied" >&2
      exit 1
    fi
  done
'
```

Important conflicts discovered live:

- 3001 is NeureCore tenant;
- 3003 and 3004 are NeureCore and bind publicly;
- 3011 is GFC portal and binds publicly;
- 3020 is NeureCore admin;
- 8080, 8081, 8082, 8090, and 8091 are occupied;
- 3100 was not the right Loki assumption; 3200 is existing Grafana;
- 9090, 9093, and 9094 are existing observability;
- 5432 is PostgreSQL and listens on all addresses;
- 6379 is authenticated host Redis on loopback.

DonorDesk requires no new public UFW port. Existing 80/443 ingress is sufficient.

## 7. Filesystem and Unix identity

Use a dedicated unprivileged account and immutable releases:

```text
/opt/donordesk/
├── current -> releases/<release-id>
├── releases/
│   └── <release-id>/
│       ├── api/
│       ├── web/
│       ├── workers/          optional
│       ├── prisma/
│       └── manifest.sha256
├── shared/
│   ├── api.env
│   ├── storage/
│   └── backups-status/
└── deploy/
    ├── release.sh
    ├── rollback.sh
    └── smoke.sh
```

One-time preparation after approval:

```bash
useradd --system --home /opt/donordesk --shell /usr/sbin/nologin donordesk
install -d -o donordesk -g donordesk -m 0750 \
  /opt/donordesk/releases \
  /opt/donordesk/shared/storage \
  /opt/donordesk/shared/backups-status \
  /opt/donordesk/deploy
install -o root -g donordesk -m 0640 /dev/null /opt/donordesk/shared/api.env
```

Release files should be root/deploy-owned and read-only to `donordesk`. Only
`shared/storage` and required runtime directories should be writable by the
service. Store migrator credentials separately, root-only, and never expose them
to the API service.

## 8. PostgreSQL production design

### 8.1 Live constraints

The verified host cluster has:

```text
PostgreSQL 16.14
listen_addresses=*
max_connections=200
shared_buffers=2 GiB
work_mem=64 MiB
effective_cache_size=7 GiB
archive_mode=on
ssl=on
```

UFW restricts inbound access, but `pg_hba.conf` currently trusts every IPv4
loopback connection. This is a shared-host weakness: the dedicated database role
still gives organizational clarity and RLS behavior, but password secrecy does
not protect against another compromised local account while that trust rule
remains. Changing it to SCRAM requires a separate compatibility-tested host
hardening window.

Local WAL archiving exists but remains on the same server and is not DR.

### 8.2 Roles

Create through a reviewed SQL file using independently generated passwords:

```sql
CREATE ROLE donordesk_migrator
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

CREATE ROLE donordesk_app
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;

CREATE DATABASE donordesk OWNER donordesk_migrator;
```

The runtime environment contains only:

```bash
DATABASE_URL=postgresql://donordesk_app:<secret>@127.0.0.1:5432/donordesk
```

The root-only deploy environment contains:

```bash
DATABASE_ADMIN_URL=postgresql://donordesk_migrator:<secret>@127.0.0.1:5432/donordesk
```

### 8.3 Migrations and RLS

Generate and commit migrations in development. Production uses the Prisma binary
and schema bundled inside the release, not global pnpm:

```bash
set -a
. /etc/donordesk/migrator.env
set +a

DATABASE_URL="$DATABASE_ADMIN_URL" \
  /opt/donordesk/releases/<release-id>/api/node_modules/.bin/prisma \
  migrate deploy \
  --schema /opt/donordesk/releases/<release-id>/prisma/schema.prisma

psql "$DATABASE_ADMIN_URL" --set ON_ERROR_STOP=1 \
  --file /opt/donordesk/releases/<release-id>/prisma/rls.sql
```

Run RLS tests as `donordesk_app` after migration and before switching `current`.
Never use `prisma db push`, `--accept-data-loss`, or the `postgres` role for normal
releases.

## 9. Redis decision

Redis is already available on loopback and requires authentication. Do not reuse
another project's password or merely select database 1.

For Stage A, omit `REDIS_URL`; the application currently uses in-memory jobs.
Before Stage B:

1. wire BullMQ into the application dependency container;
2. create a dedicated Redis ACL user restricted to `dd:*` keys and required
   command categories;
3. obtain authenticated memory-policy/keyspace information;
4. test retry, idempotency, shutdown, and Redis outage behavior;
5. back up the Redis configuration/ACL securely.

Only then set a DonorDesk-specific authenticated `REDIS_URL` and queue prefix.

## 10. Production environments

`/opt/donordesk/shared/api.env` (root-owned, group-readable by DonorDesk):

```bash
NODE_ENV=production
HOST=127.0.0.1
PORT=4001
DATABASE_URL=postgresql://donordesk_app:<secret>@127.0.0.1:5432/donordesk
AUTH_PROVIDER=jwt
JWT_SECRET=<64-or-more-random-characters>
AUDIT_CHAIN_KEY=<independent-32-or-more-character-secret>
STORAGE_ROOT=/opt/donordesk/shared/storage
CORS_ORIGINS=https://<approved-donordesk-hostname>
LOG_LEVEL=info
```

Do not put `DATABASE_ADMIN_URL`, Redis administration credentials, backup keys,
or unrelated project secrets in this file.

The web build must use same-origin `/api`, or be built with the approved final
HTTPS URL. A `NEXT_PUBLIC_*` value is public and build-time embedded; it is not a
secret and cannot remain `http://localhost:4000`.

Unsupported values such as `STORAGE_BACKEND=s3`, `JOB_QUEUE=redis`, and a real
`LLM_PROVIDER` must not be set until the corresponding runtime adapter is wired.

## 11. Self-contained artifact

Build off-host using the repository-pinned pnpm 10.34.5 and Node 20. Do not change
Contabo's global pnpm 9.15.9 and do not run a workspace install in production.

```bash
corepack enable
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

The build implementation must add:

```js
// apps/web/next.config.mjs
output: "standalone"
```

For the monorepo, validate `outputFileTracingRoot`. Copy `.next/static` and any
`public` directory into the generated standalone layout. Start the resulting
`server.js` locally from the exact packaged path.

Use pnpm's deploy capability or another reproducible packaging step to create an
API directory containing production `node_modules`, compiled workspace packages,
the generated Prisma client/engine, schema, and migrations. The artifact must not
depend on `workspace:*` resolution on Contabo.

Artifact acceptance test in a clean temporary directory:

1. verify SHA-256 manifest;
2. confirm no secret/dev artifacts;
3. start API against a disposable PostgreSQL database;
4. start web on a temporary port;
5. run migrations and RLS;
6. execute API, browser, worker, export, and tenant-isolation tests;
7. prove no network dependency installation occurs at startup.

## 12. Systemd services

### 12.1 API

```ini
# /etc/systemd/system/donordesk-api.service
[Unit]
Description=DonorDesk API
After=network-online.target postgresql@16-main.service
Wants=network-online.target
Requires=postgresql@16-main.service

[Service]
Type=simple
User=donordesk
Group=donordesk
WorkingDirectory=/opt/donordesk/current/api
EnvironmentFile=/opt/donordesk/shared/api.env
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/donordesk/shared/storage

[Install]
WantedBy=multi-user.target
```

This unit is safe only after the API code respects `HOST=127.0.0.1`.

### 12.2 Web

```ini
# /etc/systemd/system/donordesk-web.service
[Unit]
Description=DonorDesk Web
After=network-online.target donordesk-api.service
Wants=network-online.target

[Service]
Type=simple
User=donordesk
Group=donordesk
WorkingDirectory=/opt/donordesk/current/web
Environment=NODE_ENV=production
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3002
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=20
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

### 12.3 Optional worker

The host has Python 3.12, not 3.11. Confirm all worker tests pass under 3.12 and
create a release-specific or atomically switched virtual environment. Do not
clear a live venv during deployment.

```ini
# /etc/systemd/system/donordesk-workers.service
[Unit]
Description=DonorDesk Workers
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=donordesk
Group=donordesk
WorkingDirectory=/opt/donordesk/current/workers
EnvironmentFile=/opt/donordesk/shared/api.env
ExecStart=/opt/donordesk/current/workers-venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8092
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/donordesk/shared/storage

[Install]
WantedBy=multi-user.target
```

Do not install/start this unit until an authenticated production caller uses it.

## 13. OpenLiteSpeed and TLS

No DonorDesk DNS, vhost, or certificate was observed. Choose the hostname first.
Create a dedicated vhost by following the existing `hq.neurecore.com` pattern:

- `/api` -> `127.0.0.1:4001`;
- WebSocket route -> `127.0.0.1:4001` with upgrade support;
- `/` -> `127.0.0.1:3002`;
- ACME challenge context retained.

Decide explicitly whether OLS strips `/api` or Fastify registers an `/api`
prefix. Test every route through public HTTPS; do not infer behavior.

Before editing:

1. archive the OLS main config and the new/affected vhost directory;
2. record current `litespeed -t` output;
3. add the DonorDesk vhost/mapping;
4. rerun validation;
5. require no new error relative to baseline;
6. gracefully restart OLS only after comparison;
7. immediately verify every existing critical hostname plus DonorDesk.

The live baseline already reports invalid PHP handler paths in unrelated vhosts,
so “expect clean validation” is inaccurate. Do not repair those unrelated errors
inside this deployment.

Issue a certificate only after DNS resolves. Several unrelated certificates are
expired or near expiry, so independently verify DonorDesk issuance and renewal.

## 14. Shared Prometheus and Grafana

The existing Prometheus, Alertmanager, and Grafana containers use host networking.
Prometheus can therefore scrape `127.0.0.1:4001/metrics` directly—no
`host.docker.internal` entry is needed.

Safely integrate by:

1. backing up `/opt/neurecore/observability/prometheus/prometheus.yml` and alerts;
2. adding only the DonorDesk scrape job and namespaced alert rules;
3. validating Prometheus config inside its pinned container image;
4. reloading/restarting only Prometheus as supported by that Compose definition;
5. importing a namespaced dashboard without replacing shared datasources;
6. verifying all existing targets remain healthy.

Keep `/metrics` out of the public OLS vhost. UFW currently blocks the globally
bound 9090/3200 ports by default, but this is not a reason to publish new rules.

Do not add Tempo or Loki in Stage A. They do not exist on the host today and the
application log/trace pipelines are not production-complete.

## 15. Kestra design

Kestra is not needed to run the current synchronous core, but its orchestration
is now prepared (Phases A–D + E toolchain). The previously-missing contracts now
exist: authenticated `/internal/*` evidence routes, the `app/parsers.py` module,
workers with `/v1/*` routes + token auth, an outbox event bus mapping domain
events to jobs, and durable idempotency for persist operations.

Deployment notes (see `infra/kestra/`, `infra/systemd/`, `scripts/`):

- use a pinned Kestra version (never `latest`), non-root execution, and its own
  database/role (`donordesk_kestra`); do not use embedded H2 in production;
- **port 8080 is occupied on Contabo by the hermes-sidecar**; the prepared Kestra
  config binds loopback **`127.0.0.1:8093`** (configurable);
- bind loopback and never expose the Kestra UI publicly (VPN/SSH tunnel or a
  strongly protected admin hostname);
- load-test the JVM/resource impact on the shared host before enabling;
- include Kestra state (its PostgreSQL database) in backup/restore;
- test interruption, retry, duplicate delivery, and restart behavior against the
  pinned version.

Because the API and worker bind to host loopback, a bridge-network Kestra
container cannot call them through `127.0.0.1`. The least surprising single-host
option is a native systemd Kestra process (prepared as
`infra/systemd/donordesk-kestra.service`); its JVM/resource impact must be
load-tested before enabling.

> **Current production state (2026-08-13):** Latest release `20260813190000`
> (Kestra-plugin work: signed internal routes `/internal/evidence/:id/content` +
> `/internal/evidence/upload`, `/superadmin/kestra`, SuperAdmin **Kestra plugins**
> tab) is deployed and verified on `DonerDesk.online`. `donordesk-api` binds
> `127.0.0.1:4001`. `donordesk-workers` (8092), `donordesk-kestra` (8093/8094),
> and `donordesk-superadmin` (3012) are **enabled and active**. **Gated:** the five
> plugin-referencing Kestra flows (`evidence_parse`, `period_cache`,
> `analytics_snapshot`, `gdrive_ingest`, `sftp_ingest`) and their plugin JARs are
> **not deployed** — stage/verify the pinned plugin JARs against Kestra 1.3.30 and
> add the `donordesk` datasource to the deployed `kestra.application.yml` first
> (a premature `sync-flows.sh` run hangs Kestra). See `contabo-ops.md` §10/§14 and
> `imp/KESTRA-PLUGINS.md`.

## 16. Release sequence

Every release uses a new directory and an atomic symlink switch:

1. Run the live-host preflight from `contabo-ops.md`.
2. Confirm ports 3002/4001/8092 and disk/RAM margins.
3. Confirm the latest off-host backup and restore-test status.
4. Upload to `/opt/donordesk/releases/<id>.staging`.
5. Verify artifact checksum and ownership.
6. Extract without touching `current`.
7. Run migrations with root-only migrator credentials.
8. Apply RLS and run isolation tests as `donordesk_app`.
9. Start staged API/web on temporary loopback ports with temporary units or direct
   supervised commands; run smoke tests.
10. Rename staging to `/opt/donordesk/releases/<id>`.
11. Atomically switch `current`.
12. `systemctl restart donordesk-api donordesk-web`.
13. Restart worker only if installed and changed.
14. Run local and public acceptance tests.
15. Check journald, PostgreSQL, memory, swap, and disk.
16. Record release ID, migration, checksum, tests, and backup evidence.

The first deployment has a short maintenance window. True zero-downtime requires
two application instances behind OLS and verified stateless/WebSocket/job behavior;
do not claim it from a single fork/systemd process.

## 17. Rollback

Application rollback:

1. verify the previous release is compatible with the current database schema;
2. atomically repoint `current` to that explicit release ID;
3. restart only `donordesk-api`, `donordesk-web`, and the optional worker;
4. run the same public acceptance checks;
5. preserve failed-release logs and artifact for diagnosis.

Never run `pm2 restart all`. DonorDesk systemd operations must not touch existing
PM2 applications.

Use expand/migrate/contract database changes so the preceding app version remains
compatible. A destructive migration requires an approved maintenance window and
a tested database restore point. Switching compiled files cannot undo data loss.

## 18. Backup and disaster recovery

> **Current status (2026-08-13):** `scripts/backup.sh` (encrypted off-host backup
> of the `donordesk` + `donordesk_kestra` databases and `shared/storage`) is
> **prepared but not scheduled**. Per `contabo-ops.md` §9, no DonorDesk production
> data has been accepted yet; the off-host backup must be scheduled and restore-tested
> **before** accepting production data. Kestra state (its database) must be included
> once Kestra is enabled.

Observed host WAL archives and CyberPanel schedules are not sufficient evidence
of a recoverable DonorDesk backup. Before production:

- nightly encrypted logical backup of only the DonorDesk database;
- WAL/base-backup strategy if the approved RPO requires it;
- daily encrypted incremental backup of `shared/storage`;
- off-host destination with separate credentials;
- checksum and backup-age monitoring;
- monthly automated database-and-files restore;
- quarterly clean-host recovery exercise.

Approve explicit objectives, for example:

```text
RPO: 15 minutes
RTO: 4 hours
Retention: 14 daily, 8 weekly, 12 monthly
```

Back up the database and evidence storage as one consistency set. Include release
metadata, RLS/migrations, vhost, units, and secret inventory, but protect actual
secret values through the chosen secrets/backup mechanism.

## 19. Acceptance test for comprehensive Stage A features

Health-only checks are insufficient. Through the final TLS hostname:

1. create two organizations and users with different roles;
2. prove cross-tenant reads and writes are denied;
3. create/update a project;
4. upload and parse representative TXT, PDF, DOCX, and XLSX evidence;
5. download the exact original and verify checksum;
6. create logframe items, indicators, and updates;
7. create/review activity updates;
8. create reporting period and checklist;
9. generate/edit/review/approve a report;
10. generate and inspect PDF, DOCX, XLSX, and ZIP outputs actually supported;
11. exercise comments, notifications, audit log, and audit-chain verification;
12. connect/reconnect WebSocket through OLS;
13. verify authorization for each role and project assignment;
14. verify Prometheus scrape and alert delivery;
15. restore the created database and files into a clean test environment.

Where the current implementation intentionally uses a stub, label the result as
stub-assisted rather than real AI/email/queue behavior. “Comprehensive fully
functioning” is approved only after the relevant Stage B acceptance tests pass.

## 20. Security and coexistence sign-off

- [ ] Only 80/443 were used for new public access.
- [ ] API/web/worker listen only on IPv4 loopback.
- [ ] DonorDesk runs as its own Unix user.
- [ ] Runtime cannot read migrator or other-project secrets.
- [ ] No root PM2 process/dump was changed.
- [ ] No global runtime/package version was changed.
- [ ] No unrelated Docker container, volume, vhost, certificate, or firewall rule
      was modified.
- [ ] JWT/audit/database/backup/internal secrets are independent.
- [ ] Logs contain no tokens, passwords, uploaded bodies, or beneficiary PII.
- [ ] Upload/auth/export/AI routes have appropriate limits and timeouts.
- [ ] Data residency for backups, Sentry, LLM, storage, and email is approved.

The shared host still has broader risks outside DonorDesk: root/password SSH is
enabled, PostgreSQL trusts IPv4 loopback, multiple existing processes bind
publicly, OLS validation has baseline errors, and some unrelated certificates are
expired/near expiry. Record these as separate host-hardening work; do not combine
them with first deployment unless explicitly approved and rollback-tested.

## 21. Production record

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

Until all mandatory gates and acceptance tests pass, this document authorizes a
staging deployment only—not a fully production-hardened DonorDesk launch.
