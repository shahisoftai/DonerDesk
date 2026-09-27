# Contabo Operations — Hestia-Managed Shared Host and DonorDesk

**Last read-only verification:** 2026-09-07 (Hestia Control Panel cutover audit)
**Host:** `109.123.248.253` — SSH alias `contabo` (root) — hostname `srv.gec5.com`

**Purpose:** Single source of truth for live-host facts, safety rules, and the
DonorDesk deployment design for the Contabo host. The host is now managed by
**Hestia Control Panel** (HestiaCP) — not CyberPanel, not OpenLiteSpeed.
Every statement in this file was verified read-only on 2026-09-07 unless a
date is given explicitly.

> **What changed (2026-09-07):** the previous panel and its OpenLiteSpeed web
> stack were retired. HestiaCP **1.10.4** now owns web (nginx), DNS, mail,
> firewall, and SSL for the host. All legacy CyberPanel/OpenLiteSpeed guidance
> from earlier revisions has been deleted. See §18 change log.

## 1. Host inventory (verified 2026-09-07)

| Item | Verified value |
|---|---|
| Host | `srv.gec5.com` (Contabo VM `vmi2954830.contaboserver.net`, `109.123.248.253`) |
| OS | Ubuntu 24.04.4 LTS, kernel `6.8.0-139-generic` |
| CPU / RAM / Swap | 6 vCPUs; 11 GiB RAM (9.3 GiB used, ~2.4 GiB available); 2 GiB swap |
| Root disk | 96 GiB ext4, 59 GiB used, 38 GiB free (62%) |
| Uptime / load | ~1 day; load ~1.4 (previously a multi-week uptime; host rebooted during Hestia cutover) |
| Node (global) | `v22.23.2` |
| Global pnpm | `9.15.9` (do not change: other workloads depend on it) |
| DonorDesk build pnpm | `10.34.5` (via corepack, off-host only) |
| Python | 3.12.x |
| Docker / Compose | Docker 29.5.x; Compose v5.x (GFC stack only) |
| Control panel | **HestiaCP 1.10.4-1+ubuntu24.04** (`hestia`), `hestia-nginx` 1.30.4, `hestia-php` 8.5.9 |
| Web server | Hestia **nginx** (systemd `nginx.service`), binds `109.123.248.253:80/443` |
| PostgreSQL | 16.x, native cluster `16/main` on `:5432` |
| Redis | systemd `redis-server`, loopback `:6379` |
| MariaDB | Hestia-managed, loopback `:3306` |
| Mail | Postfix + Dovecot (SMTP 25/465/587, IMAP/POP3 143/993/110/995) |
| fail2ban | active |

Corrections vs the retired inventory (2026-08‑era docs):
- Node is now 22.x (was 20.x) — the previous `v20.20.2` note is stale.
- Web server is nginx, not OpenLiteSpeed; panel port is 8083 (Hestia).
- 4 PM2 processes run as root (incl. new `guv-az-web`); see §7.
- Hostname is `srv.gec5.com`.

## 2. Hestia Control Panel

| Item | Value |
|---|---|
| Panel UI | `https://109.123.248.253:8083` (Hestia firewall rule `HESTIA` ACCEPT 0.0.0.0/0) |
| Hosting user | `shahisoft` (role **admin**, package `default`, 10 web domains, 3 mail) |
| CLI | `/usr/local/hestia/bin/v-*` (e.g. `v-list-users`, `v-list-web-domains`) |
| Configs | `/usr/local/hestia/data/` (`users/`, `web/nginx/`, `firewall/rules.conf`) |
| Web roots | `/home/shahisoft/web/<domain>/public_html` for static sites; DonorDesk dirs are reverse-proxied (see §4) |
| SSL | `/home/shahisoft/conf/web/<domain>/ssl/` |

Panel/admin credentials live only in Hestia's own store — never write the
admin password or API keys into this file.

### 2.1 Hestia-managed services (systemd)

| Service | Role | State |
|---|---|---|
| `hestia` | control panel (LDAP auth, API, cron) | active |
| `hestia-nginx` | panel web server, listens `:8083` | active |
| `nginx` | public web server for all domains (`:80`/`:443`) | active |
| `hestia-iptables` | firewall rules loader | active (loaded) |
| `fail2ban` | SSH / panel / mail brute-force blocking | active |

**Hestia service commands (root):**

```bash
systemctl restart hestia hestia-nginx nginx       # after a panel/domain change
nginx -t                                          # validate config before reload
systemctl reload nginx                            # apply vhost edits
```

## 3. Hestia firewall

Managed by Hestia (`/usr/local/hestia/data/firewall/rules.conf`), applied via
`/usr/local/hestia/bin/v-update-firewall`. Current ACCEPT rules:

| Rule | Protocol / Port | Scope | Comment |
|---|---|---|---|
| 1 | ICMP | 0.0.0.0/0 | PING |
| 2 | TCP 8083 | 0.0.0.0/0 | HESTIA (panel) |
| 3 | TCP 143,993 | 0.0.0.0/0 | IMAP |
| 4 | TCP 110,995 | 0.0.0.0/0 | POP3 |
| 5 | TCP 25,465,587 | 0.0.0.0/0 | SMTP |
| 9 | TCP 80,443 | 0.0.0.0/0 | WEB |
| 10 | TCP 22 | 0.0.0.0/0 | SSH |

Policy is otherwise deny. Loopback-bound DonorDesk ports (3002/3012/4001/8092/
8093/8094/8081/8084) are NOT in this table and are not exposed by the firewall.

Do not edit `rules.conf` by hand — use the panel UI or `/usr/local/hestia/bin/`
CLI so the iptables chain stays consistent.
## 4. Hestia nginx — domains and DonorDesk reverse proxies

All public web traffic enters on Hestia **nginx**. Each domain has two vhost
files under `/etc/nginx/conf.d/domains/`:

```
/etc/nginx/conf.d/domains/<domain>.conf        (port 80 → redirect to 443)
/etc/nginx/conf.d/domains/<domain>.ssl.conf     (port 443)
```

Hestia-managed vhosts are generated from templates — **do not hand-edit a vhost
that Hestia rebuilds** (changes are lost on domain rebuild). DonorDesk vhosts
carry a hand-written `# Custom:` reverse-proxy block; the live authority is the
nginx conf directory plus `/home/shahisoft/conf/web/<domain>/nginx.conf_*`.

| Hestia domain | Backend | Purpose |
|---|---|---|
| `donordesk.online` (+www) | `proxy_pass http://127.0.0.1:3002` | DonorDesk tenant web (Next.js) |
| `sa.donordesk.online` | `proxy_pass http://127.0.0.1:3012` | DonorDesk SuperAdmin web (Next.js) |
| `gec5.com`, `endtime.gec5.com`, `srv.gec5.com` | Hestia static | corporate / utility sites |
| `gabalanature.com`, `globalfood.club`, `globalurbanventura.com`, `shahisoftware.com`, `webmail.gec5.com` | Hestia static | customer sites / webmail |

DonorDesk nginx routes `:443` → `127.0.0.1:3002` (main) and `:443` →
`127.0.0.1:3012` (superadmin). The SuperAdmin app itself proxies
`/api/control/*` server-side to the API at `127.0.0.1:4001`, so the browser
never talks to the API directly.

## 5. SSL/TLS (Hestia Let's Encrypt)

Certificates are issued and auto-renewed by Hestia. Important paths:

- **Cert dir:** `/home/shahisoft/conf/web/<domain>/ssl/` (`<domain>.pem`,
  `.key`, `.crt`, `.ca`)
- **Renewal:** Hestia cron (`v-update-letsencrypt-ssl`), automatic.

Verified 2026-09-07 expiry (renewed 2026-09-06):

| Domain | Subject | NotAfter |
|---|---|---|
| `donordesk.online` | CN=donordesk.online | 2026-12-05 |
| `sa.donordesk.online` | CN=sa.donordesk.online | 2026-12-05 |

## 6. Verified port map (2026-09-07)

| Port | Owner / bind | Exposed |
|---:|---|---|
| 22 | sshd, `0.0.0.0` + `[::]` | Internet (FW SSH) |
| 25/465/587 | Postfix, `0.0.0.0` | Internet (SMTP) |
| 80/443 | nginx, `109.123.248.253` | Internet (WEB) |
| 110/995, 143/993 | Dovecot, `0.0.0.0` | Internet (POP3/IMAP) |
| 3306 | MariaDB, `127.0.0.1` | loopback only |
| 5432 | PostgreSQL, `0.0.0.0` + `[::]` | **public-bound today**; keep out of FW |
| 6379 | redis-server, `127.0.0.1` + `::1` | loopback only |
| 3002 | DonorDesk web, `127.0.0.1` | loopback; nginx proxy |
| 3012 | DonorDesk superadmin, `127.0.0.1` | loopback; nginx proxy |
| 4001 | DonorDesk API, `127.0.0.1` | loopback |
| 6380 | GFC redis (Docker), `127.0.0.1` | loopback |
| 8081 | GFC backend (Docker), `127.0.0.1` | loopback |
| 8083 | Hestia panel (`hestia-nginx`), `0.0.0.0` | Internet (FW HESTIA) |
| 8084 | nginx internal proxy, `127.0.0.1` | loopback |
| 8092 | DonorDesk workers, `127.0.0.1` | loopback |
| 8093/8094 | DonorDesk Kestra, `127.0.0.1` | loopback |

## 7. Existing workloads — do not disrupt

### 7.1 PM2 (root daemon) — do NOT `pm2 restart/reload all`

| Process | Mode | Memory | Notes |
|---|---:|---:|---|
| `cookie-refresher` | fork | ~109 MiB | `/opt/gfc-platform` |
| `gfcportal` | fork | ~109 MiB | public `*:3011` (Next.js) |
| `guv-az-web` | fork | ~128 MiB | newer (15.5.23) |
| `shahisoft-nextjs` | fork | ~104 MiB | `127.0.0.1:3010` |

All DonorDesk commands must use `--only` and must never touch the PM2 dump.

### 7.2 Docker (GFC only)

| Container | Image | Local exposure |
|---|---|---|
| `gfc-backend` | `gfc-platform-backend` | `127.0.0.1:8081 -> 8080` |
| `gfc-postgres` | `postgres:16-alpine` | internal (no published port) |
| `gfc-redis` | `redis:7-alpine` | `127.0.0.1:6380 -> 6379` |

Do not prune Docker globally without checking every project. ~2.5 GiB images
+ volumes.

## 8. PostgreSQL & Redis facts

### 8.1 PostgreSQL 16 (`16/main`, `:5432`)

- Native cluster; `listen_addresses=*`, `max_connections=200`.
- Dedicated DonorDesk roles: `donordesk` app role (via `donordesk_app` RLS
  grants), `donordesk_migrator` (root-only credentials, never in `api.env`).
  RLS is forced on tenant tables; `donordesk_app` has DML grants.
- **2026-09-27 finding:** no `donordesk_migrator` password/credential file
  exists anywhere on the host (checked `/opt/donordesk`, `/root`, shell
  profiles, bash history). `pg_hba.conf` has `host all all 127.0.0.1/32
  trust`, so `donordesk_migrator` (and any role) can connect with **no
  password** over `postgresql://donordesk_migrator@127.0.0.1:5432/<db>` —
  that is what the "root-only credentials" line in `CONTABO-DEPLOY.md` §3/§15
  actually resolves to in practice. This `trust` rule is a standing risk
  (any local process can connect as any role, including superuser
  `postgres`, with zero authentication) — it is not scoped to a migrator
  workflow and should be tightened to `peer`/`scram-sha-256` in a future,
  separately-approved hardening pass, not folded into a feature deploy.
- **Binding `0.0.0.0:5432` is a standing risk.** Keep 5432 out of the Hestia
  firewall table and re-check `ss` before every deploy.

### 8.2 Redis

- `redis-server` binds `127.0.0.1:6379` (auth required). Verify with
  `redis-cli -a <secret> ping` using the app secret — never print it.

## 9. DonorDesk services (native systemd)

| Service | User | Bind | Command |
|---|---|:---:|---|
| `donordesk-web` | donordesk | 127.0.0.1:3002 | `node .next/standalone/apps/web/server.js` |
| `donordesk-api` | donordesk | 127.0.0.1:4001 | `node dist/server.js` (Fastify) |
| `donordesk-superadmin` | donordesk | 127.0.0.1:3012 | `node server.js`, `Requires=donordesk-api` |
| `donordesk-workers` | donordesk | 127.0.0.1:8092 | `.venv/bin/uvicorn app.main:app` |
| `donordesk-kestra` | donordesk_kestra | 127.0.0.1:8093/8094 | Java Kestra 1.3.30 |

Runtime tree: `/opt/donordesk/app/` (`apps/{api,web}`, `packages/`,
`node_modules/.pnpm/`, `superadmin/`); workers venv `/opt/donordesk/workers/`,
Kestra `/opt/donordesk/kestra/`. Shared secrets `/opt/donordesk/shared/`
(`api.env`, `workers.env`, `kestra.env`; mode 0600; `donordesk:donordesk`
owned so the api can write managed env blocks).

DonorDesk must bind `127.0.0.1` everywhere; never a `0.0.0.0` bind for these.

## 10. DonorDesk topology

```
Internet
   |
   v HTTPS :443  (Hestia nginx)
   ├─ donordesk.online    -> 127.0.0.1:3002  (donordesk-web Next.js)
   ├─ sa.donordesk.online  -> 127.0.0.1:3012 (donordesk-superadmin Next.js)
   │      └─ server-side /api/control/* :3012 proxy -> 127.0.0.1:4001
   └─ static Hestia domains -> /home/shahisoft/web/<domain>/public_html

Node/systemd:
   donordesk-web (@3002)   — Next.js (RSC / server actions)
   donordesk-api (@4001)   — Fastify (tenant + /superadmin/* + /internal/*)
   donordesk-workers (@8092) — FastAPI (AI Reporter)
   donordesk-kestra (@8093/8094)
```
## 11. Safety rules

### DO
- Re-run the read-only preflight (§13) before every release.
- Snapshot any nginx vhost file you are about to edit (timestamped `.bak`)
  and run `nginx -t` before `nginx -s reload`.
- Use dedicated systemd units for DonorDesk — never `pm2 restart all`.
- Bind DonorDesk services to `127.0.0.1` in application code/config.
- Keep secrets under `/opt/donordesk/shared` with mode 0600.
- Use the fast-deploy script + runtime tree (`/opt/donordesk/app/`).
- Test RLS as the restricted runtime role after every migration.
- Record every host change and the evidence used to verify it.

### DON'T
- Do not run `pm2 restart all`, `pm2 reload all`, or `pm2 delete all`.
- Do not upgrade global Node, pnpm, Python, PostgreSQL, Docker, or Hestia
  during a DonorDesk deploy.
- Do not use ports based on this file without checking `ss` again.
- Do not expose application, database, Redis, worker, metrics, or orchestration
  ports publicly (3002/3012/4001/8092/8093/8094 stay loopback or FW-blocked).
- Do not copy development `.env` files to Contabo.
- Do not use `prisma db push --accept-data-loss` in production.
- Do not use another project's database, Redis user, storage, PM2 config,
  vhost, Docker volume, or Unix account.
- Do not prune Docker/logs/archives globally (RAM headroom ~2.4 GiB).
- Do not hand-edit Hestia-generated vhosts for non-DonorDesk domains
  (Hestia rebuilds overwrite them).
- Do not assume a running container proves an application feature is integrated.

## 12. Preflight (read-only, before any release)

```bash
ssh contabo '
  echo "=== ports ==="; ss -ltn | grep -E ":3002|:3012|:4001|:8092|:8093" || echo MISSING
  echo "=== services ==="; systemctl is-active nginx hestia postgresql redis-server \
    donordesk-api donordesk-web donordesk-superadmin donordesk-workers donordesk-kestra
  echo "=== disk/ram ==="; df -h / | tail -1; free -h | head -2
  echo "=== nginx valid ==="; nginx -t 2>&1 | tail -2
'
```

## 13. DonorDesk deployment

**Single procedure — see [`CONTABO-DEPLOY.md`](CONTABO-DEPLOY.md):**

```bash
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)" scripts/deploy-fast.sh
```

- Scope auto-detected (`web`/`api`/`both`) from the diff vs `HEAD~1`;
  typechecks, builds, stages tars, snapshots the target tree, streams to
  `/opt/donordesk/app/`, restarts affected systemd units, verifies
  `/health`, `/ready`, and worker health.
- Schema changes: `prisma migrate deploy` as `donordesk_migrator` with
  `DATABASE_ADMIN_URL`, then `rls.sql`, then update `REQUIRED_PRISMA_FIELDS`
  in `apps/api/src/routes/health.ts` (the `/ready` gate blocks otherwise).
- After-deploy token sync: `INTERNAL_TOKEN` in `api.env` must equal the one
  in `workers.env`.

## 14. Post-deploy verification

```bash
ssh contabo '
  ss -lntp | grep -E "127.0.0.1:(3002|3012|4001|8092)"
  curl -fsS http://127.0.0.1:3002/ >/dev/null
  curl -fsS http://127.0.0.1:4001/health
  curl -fsS http://127.0.0.1:4001/ready
  systemctl --no-pager --full status donordesk-api donordesk-web donordesk-superadmin
'
```

From outside also verify TLS/chain, per-domain routing (donordesk.online,
sa.donordesk.online), WebSocket upgrade, auth/tenant isolation, and a clean
backup restore.

## 15. Database migrations and RLS

```bash
# As root/operator with migrator credentials (root-only; never in api.env):
set -a; . <migrator-env>; set +a
DATABASE_URL="$DATABASE_ADMIN_URL" \
  /opt/donordesk/app/packages/infrastructure/node_modules/.bin/prisma \
  migrate deploy --schema /opt/donordesk/app/packages/infrastructure/prisma/schema.prisma

# Then apply infra/postgres/rls.sql and verify cross-tenant isolation as donordesk_app
```

Use expand/migrate/contract. Destructive migrations need an approved window
and a tested restore point. Never `prisma db push`/`--accept-data-loss`.

## 16. Rollback

- `scripts/deploy-fast.sh` snapshots the previous runtime tree before
  streaming; restore that snapshot (plus any changed nginx vhost `.bak`) and
  restart `donordesk-api`, `donordesk-web`, `donordesk-superadmin`.
- DB migrations are additive — do not drop control-plane tables during an app
  rollback. Preserve encrypted configs, admin identity, and audit history.
- Ingress rollback: `nginx -t` after restoring the `.bak` vhost and reload.

## 17. Secrets & admin identities

- `/opt/donordesk/shared/{api,workers,kestra}.env` (0600) hold DonorDesk
  secrets incl. `PLATFORM_MASTER_KEY`, `SUPERADMIN_JWT_SECRET`, `DATABASE_*`,
  `INTERNAL_TOKEN`. Never copy them into this file or logs.
- Hestia panel credentials (admin / `shahisoft`) live only in Hestia.
- SuperAdmin platform identity is `mnpiracha@gmail.com` (see
  `SUPERADMIN-PORTAL.md`); initial credentials were handed off to the owner —
  no plaintext passwords belong in memorybank.

## 18. Change log

> **2026-09-17 — AI Reporter provider auth fully broken, then fixed; `systemd
> EnvironmentFile` trailing-newline gotcha found and closed (releases
> `20260917155946`, `20260917162657`).** Full chain in
> [`Fixes.md`](Fixes.md#ai-reporter-completely-non-functional-on-production--provider-auth-env-file-truncation-annex-tables-2026-09-17-releases-20260917155946--20260917162657):
> corrupted `INTERNAL_TOKEN` line, duplicate legacy env keys silently dropping
> newer variables, `AI_REPORTER_DRAFT_TIMEOUT_MS` never provisioned into
> `api.env`. **Root cause of the two env-key-dropping incidents, reproduced
> twice in production: `api.env`/`workers.env` missing a trailing newline at
> EOF makes `systemd`'s `EnvironmentFile` loader silently drop the last one or
> two `KEY=VALUE` lines, with no error anywhere in any log.** Fixed at the
> single write choke point (`atomicWriteEnvFile` in `runtime-provisioner.ts`)
> so every future write is safe regardless of caller. **Operational rule going
> forward: after any manual edit to `/opt/donordesk/shared/{api,workers}.env`,
> run `tail -c 5 <file> | cat -A` and confirm it ends in `$`** (the visible
> newline marker) before restarting the service — a missing `$` means the
> last variable you just added will silently not exist in the running
> process. Also confirmed the reliable way to check what a process *actually*
> has (not just what the file says) is `sudo tr '\0' '\n' <
> /proc/<pid>/environ`, filtered to the exact non-secret keys needed — do not
> dump the whole environ unfiltered, it will print secrets into whatever is
> capturing the output.

> **2026-09-07 — Hestia Control Panel cutover (this rewrite).** The previous
> panel / OpenLiteSpeed stack was retired. HestiaCP **1.10.4** (hestia-nginx
> 1.30.4, php 8.5.9) now owns web (nginx), DNS, mail, firewall, and SSL.
> Hestia hosting user `shahisoft` owns all 10 web domains; `donordesk.online`
> and `sa.donordesk.online` are nginx reverse-proxies to 127.0.0.1:3002/3012.
> SSL renewed 2026-09-06 (expiry 2026-12-05). Legacy
> CyberPanel/OpenLiteSpeed/NeureCore inventory, old port tables, old panel
> procedures, and pre-cutover logs were deleted from this file.
>
> builds green with the fix; proxy behavior verified with a 4-case harness
> (DELETE-with-body, DELETE-without-body, PATCH-body, GET).
>
> **2026-09-07 — Deployed to sa.donordesk.online (SuperAdmin-only).** The
> tenant-delete fix was shipped as a surgical, reversible superadmin deploy:
> built locally (typecheck + `next build` green), staged `.next/` + `server.js`
> (1 MB, excluding build cache/standalone), snapshotted the live app to
> `/opt/donordesk/backups/superadmin-pre-20260907104911.tgz`, swapped `.next`
> + `server.js` in `/opt/donordesk/current/superadmin` (old kept as
> `.next.old` rollback), restarted `donordesk-superadmin`. Verified: service
> active, public HTTPS 200, loopback 3012/4001 200, serving BUILD_ID
> `_8FJYnrVyfGiwcho9_5de`; served client bundle
> `chunks/app/page-29210987bf6e47fe.js` contains the new delete-confirmation
> guard; unauthenticated `/api/control/*` returns 401 (proxy + auth gate
> live). Recommended follow-up: click-through the Tenants Delete + Users
> Edit/Delete as `mnpiracha@gmail.com` in a browser session.

### 2026-09-26 — releases `20260926164318` / `20260926171958` / `20260926174726` (EERP Q2 run fixes)

- `workers.env` had lost `AI_REPORTER_MAX_TOKENS=16384`: it was rewritten at 18:11 and the key is still present in the `.bak.*` copies. The worker ran at the 4096 default and DeepSeek JSON truncated, so 13 of 15 section calls fell back to deterministic text. The key was re-appended (backup `workers.env.bak.maxtokens-<ts>`) and the worker restarted. The code default is now 16384 too.
- **Live AI Reporter provider** at the time: `AI_REPORTER_PROVIDER=deepseek`, `AI_REPORTER_MODEL= deepseek-flash` (note the leading space in both env files; systemd strips it). This supersedes the "GLOBAL = anthropic" line below.
- **After any deploy or SuperAdmin save,** check `tr "\0" "\n" </proc/$(systemctl show -p MainPID --value donordesk-workers)/environ | grep AI_REPORTER` against `workers.env`, and confirm `AI_REPORTER_MAX_TOKENS=16384` is there.
- `/v1/ai-reporter/health` returns 401 without the internal token; that is expected.
- No migrations.

### 2026-09-26 — release `20260926153744` (report-quality v4 + Claude/Gemini + per-tenant provider)

- Worker venv: `anthropic==1.8.0` installed (with `pip`; `uv` is not on PATH).
- Env files (backups `*.bak.providers-20260926153736`):
  - `workers.env`: DRAFT 90000 / TOTAL 200000 / CONTRACT 4 / MAX_TOKENS 16384 (unchanged).
  - `api.env`: HTTP_TIMEOUT 240000 / CONTRACT 4.
- SuperAdmin LLM: GLOBAL **anthropic `claude-sonnet-4-6`** enabled; deepseek (`deepseek-chat`) and minimax (`MiniMax-M3`) disabled; no tenant-scoped rows.
- **Open issue:** the Anthropic account has an insufficient credit balance (400 on every call), so every AI section falls back to the deterministic draft. Fund the account at console.anthropic.com → Plans & Billing, or temporarily re-enable DeepSeek in SuperAdmin.
- SuperAdmin build `wsXef7TcybCfhFjNpzma-`; rollback `/opt/donordesk/backups/superadmin-pre-20260926155153.tgz`.
