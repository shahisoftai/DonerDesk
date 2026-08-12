# Contabo Operations — DOs and DONTs

**Last verified:** 2026-07-31 — NC-AWL-IMP-2 (G9) certification passed all 8 gates (2026-07-30). hermes-tools 116 tools confirmed callable via chat (138bda6f). Accounting Capability (NC-ACCT-IMP-1) Phase 1 deployed 2026-07-30. 9 new Postgres tables, NestJS `AccountingModule`, Python `accounting-sidecar` (port 8091, systemd-managed). Sibling doc: [sidecar-deploy-procedure.md](sidecar-deploy-procedure.md).
**Audience:** Anyone working on the Contabo box (`vmi2954830.contaboserver.net`, `109.123.248.253`).
**Sibling docs:** [system-state.md](system-state.md) · [operations.md](operations.md) · [backend.md](backend.md) · [frontend-admin.md](frontend-admin.md) · [frontend-tenant.md](frontend-tenant.md) · [ai-gateway/ai-gateway-reference.md](ai-gateway/ai-gateway-reference.md) · [pending-tasks.md §0g](pending-tasks.md) · [sidecar-deploy-procedure.md](sidecar-deploy-procedure.md)

---

## 1. Present status (one-screen summary)

**Box:** Ubuntu 22.04 (kernel 6.8.0-124), CyberPanel + OpenLiteSpeed 2.4.4, 96 GB disk (52 GB used, 45 GB free), 11 GB RAM (4.2 used / 7.5 available), 2 GB swap (1.2 used). Uptime 18+ days, load avg ~0.55 — idle.

**4 PM2 processes** (all online):

| Process | ID | Port | What |
|---|---|---|---|
| `neurecore-backend` | 6 | 3003 | NestJS API — Projects Phases 1–7 + EIE + **Accounting Capability (NC-ACCT-IMP-1) deployed 2026-07-30** |
| `neurecore-tenant` | 7 | 3001 | Next.js, `hq.neurecore.com` |
| `neurecore-admin` | 5 | 3020 | Next.js, `cc.neurecore.com` |
| `neurecore-cors-proxy` | 13 | 3004 | dev CORS sidecar → 3003 |

**3 systemd sidecars** (all online, started by `systemctl enable --now`):

| Service | Port | What |
|---|---|---|
| `hermes-sidecar` | 8080 | Hermes execution runtime (NousResearch agent + ACP) |
| `hermes-events-bridge` | 8082 | Signed event webhook receiver |
| `accounting-sidecar` | **8091** | **NEW** — numpy-financial + Beancount + Pandas accounting compute |

> ⚠️ **Port 8090 is permanently occupied by CyberPanel (`lscpd`). Never use 8090 for a sidecar.**
> Use 8081, 8083, 8084, 8091, 8092, 8093 etc. for capability sidecars.

> ⚠️ **Frontend deploy pending:** `neurecore-tenant` and `neurecore-admin` have NOT been rebuilt with the Projects code. All new routes (`/projects`, `/projects/new`, `/customers`, `/portal`, `/project-types`, `/question-packs`, `/customers-pool`) will 404 until the frontends are rebuilt and restarted.

**3 public hostnames** (TLS via Let's Encrypt, all healthy):

| Hostname | Upstream | Status |
|---|---|---|
| `brain.neurecore.com` | 127.0.0.1:3003 | 200 on `/api/v1/health` — **Projects backend live** |
| `hq.neurecore.com` | 127.0.0.1:3001 | 200 on `/` — **rebuilt 2026-07-16** |
| `cc.neurecore.com` | 127.0.0.1:3002 | 200 on `/admin` — **Projects code (rebuilt 2026-07-21 with FIX-PERF-001)** |

**Other tenants** on the box (NOT neurecore): `app-frontend` (GUV, port 3001/3100), `gfcportal`, `shahisoft-nextjs`, `lifeosa-backend`, `ecoearthshop-backend` (cluster), `cookie-refresher`, `gfcportal`. Don't break these.

**Database:** Contabo Local PostgreSQL 16 (`127.0.0.1:5432`, db `neurecore_prod`, user `neurecore_app`).

> ⚠️ **PORT NOTE:** The repo's `backend/.env.production` template points to `127.0.0.1:5433` (which is the **`audit-test` Postgres instance** — only 5 users, used for testing). The actual production backend uses port **5432** (host-installed `postgres 16/main`). The live `.env` on Contabo already has the correct URL — do **NOT** copy the repo template without fixing the port.
**Cache:** Redis on `127.0.0.1:6379` (host-installed). **Note:** Upstash (`lasting-gobbler-72608.upstash.io`) returns `ENOTFOUND` — non-fatal, backend still healthy. As of FIX-PERF-001 (2026-07-21), the JWT blacklist check is fronted by a 30s LRU cache so the Upstash round-trip happens at most once per JTI per minute per worker.

**Postgres tuning:** `/etc/postgresql/16/main/conf.d/99-neurecore-tuning.conf` (applied 2026-07-21). `shared_buffers=2GB`, `work_mem=64MB`, `effective_cache_size=7GB`, `random_page_cost=1.1`, autovacuum aggressive, `log_min_duration_statement=1500`. Restart with `pg_ctlcluster 16 main restart` to apply changes after edits.

**Observability:** Prometheus `:9090`, Alertmanager `:9093`, Grafana `:3200` (all containers under `/opt/neurecore/observability/`).

**Most recent DR snapshot:** `/opt/neurecore/_archives/20260721-100414-pre-perf-fixes/` (pre-FIX-PERF-001 perf-fixes deploy).

---

## 2. Access

| Method | How |
|---|---|
| SSH key | `ssh contabo` (uses `~/.ssh/id_ed25519`) |
| SSH password fallback | `sudo bash scripts/connect_contabo.sh` (reads `/root/contabo`) |
| CyberPanel UI | `https://109.123.248.253:7080` |
| Portainer | not installed |
| Web Terminal | not installed |

You are `root` on Contabo. There's no need for `sudo`. If you can't `ssh contabo` from your user, fix `~/.ssh/config` first.

---

## 3. ✅ DOs

### 3.1 DO update the canonical files when you change anything

| If you change… | Update on Contabo | Update in repo |
|---|---|---|
| Add/remove/rename a service | `/opt/neurecore/ecosystem.config.js` | `scripts/contabo/ecosystem.config.js` |
| Change build/reload logic | `/opt/neurecore/rebuild.sh` | `rebuild.sh` (repo root) |
| Add a CORS origin | `/opt/neurecore/cors-proxy.js` | — (server-only config) |
| Add an OLS vhost | `/usr/local/lsws/conf/vhosts/<name>/vhost.conf` | document in [operations.md §3](operations.md) |
| Change backend env | `/opt/neurecore/backend/backend/.env` | update [backend.md §7](backend.md) |
| Change frontend env | `/opt/neurecore/frontend-*/.env.production` | update [frontend-tenant.md §8](frontend-tenant.md) / [frontend-admin.md §7](frontend-admin.md) |

### 3.2 DO use the canonical commands

```bash
# Rebuild backend
ssh contabo 'cd /opt/neurecore/backend/backend
  export $(grep -v "^#" .env | grep -E "DATABASE_URL|DIRECT_URL" | xargs)
  ./node_modules/.bin/prisma generate && ./node_modules/.bin/prisma migrate deploy
  ./node_modules/.bin/nest build'
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-backend'

# Rebuild tenant
ssh contabo 'cd /opt/neurecore/frontend-tenant && npm ci --omit=dev=false && ./node_modules/.bin/next build'
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-tenant'

# Rebuild admin
ssh contabo 'cd /opt/neurecore/frontend-admin && npm ci --omit=dev=false && ./node_modules/.bin/next build'
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js --only neurecore-admin'

# Local → Contabo (preferred for full deploys)
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore && ./scripts/deploy.sh all

# Take DR snapshot
ssh contabo 'bash /opt/neurecore/rebuild.sh all'   # only if you're rebuilding anyway
# Or just snapshot the dist + .next:
ssh contabo 'SNAP=/opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S); mkdir -p $SNAP
  cd /opt/neurecore/backend/backend   && tar -czf $SNAP/backend-dist.tar.gz          dist/
  cd /opt/neurecore/frontend-tenant  && tar -czf $SNAP/frontend-tenant-.next.tar.gz  .next/
  cd /opt/neurecore/frontend-admin   && tar -czf $SNAP/frontend-admin-.next.tar.gz   .next/
  cp /opt/neurecore/cors-proxy.js        $SNAP/cors-proxy.js
  cp /opt/neurecore/ecosystem.config.js  $SNAP/ecosystem.config.js
  cp /opt/neurecore/rebuild.sh           $SNAP/rebuild.sh'
```

### 3.3 DO snapshot before every deploy

```bash
ssh contabo 'mkdir -p /opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S) && \
  cd /opt/neurecore/backend/backend && \
  tar -czf /opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S)/backend-dist.tar.gz dist/'
```

The full DR recipe is in [disaster-recovery.md §2](disaster-recovery.md).

### 3.3b Projects frontend deploy checklist (2026-07-09 — PENDING)

Both frontends need rebuilding with the Projects code. Backend is already live.

```bash
# 1. Snapshot frontends BEFORE rebuilding
ssh contabo 'SNAP=/opt/neurecore/_archives/$(date +%Y%m%d-%H%M%S)-pre-projects-fe
mkdir -p $SNAP
cd /opt/neurecore/frontend-tenant && tar -czf $SNAP/frontend-tenant-.next.tar.gz .next/
cd /opt/neurecore/frontend-admin && tar -czf $SNAP/frontend-admin-.next.tar.gz .next/
cp /opt/neurecore/ecosystem.config.js $SNAP/ecosystem.config.js'

# 2. Deploy frontend-tenant (NEURECORE PROJECT WORKSPACE at /home/najeeb/Linux-Dev/neurecore-2026/neurecore/)
cd /home/najeeb/Linux-Dev/neurecore-2026/neurecore
./scripts/deploy.sh tenant   # rsync → pnpm install → next build → pm2 restart

# 3. Deploy frontend-admin
./scripts/deploy.sh admin    # rsync → pnpm install → next build → pm2 restart

# 4. Verify health
curl https://hq.neurecore.com/api/v1/health   # should still be 200 via OLS proxy
curl https://brain.neurecore.com/api/v1/health  # backend health

# 5. Browser smoke tests (new routes)
# https://hq.neurecore.com/projects         → 7-column kanban (was 404)
# https://hq.neurecore.com/projects/new     → creation wizard (was 404)
# https://hq.neurecore.com/customers        → customer list (was 404)
# https://hq.neurecore.com/portal/[id]     → client portal (was 404)
# https://cc.neurecore.com/project-types    → admin pool (was 404)
# https://cc.neurecore.com/question-packs   → question pack admin (was 404)
# https://cc.neurecore.com/customers-pool   → cross-tenant (was 404)
```

### 3.4 DO check OLS config syntax before restart

```bash
ssh contabo '/usr/local/lsws/bin/litespeed -t'
ssh contabo 'systemctl restart lsws'   # only if test passes
```

### 3.5 DO filter `git status` on backend (kept as defensive practice)

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && git status --short -- src/ prisma/'
# (Historical: bare `git status --short` once showed 1000+ paperclip noise.
#  Now mitigated by `Temp/` in `.gitignore` — verified 0 paperclip entries
#  on 2026-07-04 — but the filter habit is harmless.)
```

### 3.6 DO test CORS after editing cors-proxy.js

```bash
ssh contabo 'pm2 restart neurecore-cors-proxy'
curl -s -i -X OPTIONS http://127.0.0.1:3004/api/v1/health \
  -H "Origin: https://hq.neurecore.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  | grep -iE "^HTTP|access-control-allow"
# expect: HTTP/1.1 204 No Content + Allow-Origin header
```

### 3.7 DO save PM2 dump after reload

```bash
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js && pm2 save'
# `pm2 save` ensures reboot-survival
```

### 3.8 DO use the correct Prisma binary directly

```bash
ssh contabo 'cd /opt/neurecore/backend/backend
  ./node_modules/.bin/prisma generate
  ./node_modules/.bin/prisma migrate deploy
  ./node_modules/.bin/nest build'
```

### 3.8b DO set env flags in BOTH `.env` and `.env.production` (2026-07-28)

NestJS `ConfigurationModule` loads `envFilePath: ['.env.production', '.env']` when `NODE_ENV=production`. **`.env.production` wins.** Always set runtime flags in BOTH files or your change silently has no effect.

Confirmed root cause of "AI_GATEWAY_V2=true has no effect" on 2026-07-28: backend was reading `.env.production` which had `AI_GATEWAY_V2=false`. The `.env` edit alone wasn't enough.

```bash
ssh contabo '
  cd /opt/neurecore/backend/backend
  grep "^AI_GATEWAY_V2" .env .env.production
  sed -i "s/^AI_GATEWAY_V2=false/AI_GATEWAY_V2=true/" .env .env.production
'
```

### 3.8c DO remember that `model_providers` table is owned by `postgres` (2026-07-28)

`./node_modules/.bin/prisma migrate deploy` runs as `neurecore_app` and will FAIL with `must be owner of table model_providers` on the AI gateway catalog tables. This applies to any table the original Phase 7 migration created with `postgres` as the owner.

**Workaround for new migrations on these tables:**

```bash
# 1. Apply the migration as postgres (read password from .env)
ssh contabo '
  cd /opt/neurecore/backend/backend
  PGPASSWORD=$(grep ^POSTGRES_SUPERUSER_PASSWORD .env | cut -d= -f2-)
  psql -h 127.0.0.1 -U postgres -d neurecore_prod \
    -v ON_ERROR_STOP=1 \
    -f prisma/migrations/<migration_id>/migration.sql
'

# 2. Mark as applied in _prisma_migrations (also as postgres)
ssh contabo '
  cd /opt/neurecore/backend/backend
  PGPASSWORD=$(grep ^POSTGRES_SUPERUSER_PASSWORD .env | cut -d= -f2-)
  psql -h 127.0.0.1 -U postgres -d neurecore_prod <<SQL
  UPDATE _prisma_migrations SET finished_at = now(), applied_steps_count = 1
  WHERE migration_name = '"'"'<migration_id>'"'"';
SQL
'

# 3. Regenerate Prisma client
./node_modules/.bin/prisma generate
```

**Permanent fix (not done):** `GRANT ALL ON ALL TABLES IN SCHEMA public TO neurecore_app;` as postgres. Apply next time you have shell access.

Tables confirmed owned by `postgres` (not `neurecore_app`) as of 2026-07-28: `chat_sessions`, `HermesMessage`, `tenant_model_overrides`, and ALL `model_*` AI gateway catalog tables. New migrations touching these tables will hit the same permission error.

### 3.9 DO use relative `cd` inside ssh heredocs

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && ./node_modules/.bin/nest build'
# not: ssh contabo 'cd ... && ...'  (no, this is fine; the issue is `cd X && cd Y` chains)
```

### 3.10 DO record production fixes in fixes.md

After any production issue (outage, data corruption, security incident, deploy rollback), add an entry to [fixes.md](fixes.md) the same day. Format defined there.

---

## 4. ❌ DON'Ts

### 4.1 DON'T create ad-hoc PM2 processes

```bash
# ❌ NEVER
ssh contabo 'pm2 start npx --name neurecore-foo -- next start -p 3100'
# ✅ DO THIS
ssh contabo 'pm2 startOrReload /opt/neurecore/ecosystem.config.js'
# (after adding the entry to ecosystem.config.js)
```

### 4.2 DON'T use `npx next start` in PM2 entries

```bash
# ❌ in ecosystem.config.js:
script: 'npx'
args: 'next start --hostname 127.0.0.1 --port 3020'

# ✅ ALWAYS:
script: './start.sh'
interpreter: 'bash'
# where start.sh is:
#!/bin/bash
cd /opt/neurecore/frontend-admin
exec node node_modules/.bin/next start --hostname 127.0.0.1 --port 3020
```

Why: PM2's `interpreter: 'none'` for npx resolves `next` against the wrong PATH. The wrapper works.

### 4.3 Use `pnpm@9.15.9` on Contabo

**Updated 2026-07-23** (local workstation also fixed — corepack enabled, pnpm@9.15.9 activated via `corepack prepare pnpm@9.15.9 --activate`; PATH exported in `~/.bashrc`. Lockfile drift caveat added.)

```bash
# ✅ pnpm now works
ssh contabo 'cd /opt/neurecore/backend/backend && pnpm install --no-frozen-lockfile && pnpm build'

# ✅ equivalent npm flow (still safe)
ssh contabo 'cd /opt/neurecore/backend/backend && npm ci --omit=dev=false && ./node_modules/.bin/nest build'
```

Installed globally via `npm install -g --force pnpm@9` (Node 20.20.2-compatible). Corepack-pnpm required Node 22.13+ which is not available on Contabo.

**Lockfile drift caveat (2026-07-23):** `backend/package.json` includes `compression` + `lru-cache` (added 2026-07-21 per [FIX-PERF-001](fixes.md#fix-perf-001--contabo-latency-login-1-2s-lists-multi-second-chat-3-6s-2026-07-21)) but the lockfile doesn't capture them. The deploy script `scripts/deploy.sh` enforces `--frozen-lockfile` and will fail until the lockfile is regenerated. Manual workaround until `scripts/deploy.sh` is updated:

```bash
ssh contabo 'cd /opt/neurecore/backend/backend && pnpm install --no-frozen-lockfile 2>&1 | tail -3 && bash /opt/neurecore/rebuild.sh backend'
```

Same applies to `frontend-admin` lockfile. Tracked in [pending-tasks.md §B.2](pending-tasks.md#1-industry-release-hot-path-follow-ups-2026-07-23--kilo).

### 4.4 DON'T `git reset --hard` on Contabo backend

```bash
# ❌
ssh contabo 'cd /opt/neurecore/backend/backend && git reset --hard HEAD'

# ✅
ssh contabo 'cd /opt/neurecore/backend/backend && git stash push -u -m "SNAPSHOT-$(date +%Y%m%d)" -- src/ prisma/'
```

Why: preserves any uncommitted local edits. (Historical: also used to avoid wiping ~1682 paperclip noise entries — that issue is now resolved since `Temp/` is gitignored; verified 2026-07-04.)

### 4.5 DON'T use raw `git stash`

```bash
# ❌
ssh contabo 'cd /opt/neurecore/backend/backend && git stash'
# (historical: used to pick up paperclip noise; now a non-issue, but the
#  scoped form below is still best practice)

# ✅
ssh contabo 'cd /opt/neurecore/backend/backend && git stash push -u -m "..." -- src/ prisma/'
```

### 4.6 DON'T rsync `.env` to Contabo

```bash
# ❌ scripts/deploy.sh must NEVER include:
rsync ... .env ...     # leaks dev DB URL, dev API keys

# ✅ (already correct in deploy.sh)
EXCLUDES="--exclude=.env --exclude=.env.local --exclude=.env.production"
```

### 4.7 DON'T add CORS to NestJS

```bash
# ❌ in backend/src/main.ts:
app.enableCors({ origin: '*' })

# ✅ CORS is handled by:
#   1. OLS vhost (production)
#   2. /opt/neurecore/cors-proxy.js (dev)
```

Why: NestJS CORS blocks dev browser preflights from non-allowlisted origins; the sidecar approach is more flexible.

### 4.8 DON'T deploy without rebuilding

```bash
# ❌
ssh contabo 'pm2 restart neurecore-backend'   # still running OLD compiled dist/

# ✅
ssh contabo 'cd /opt/neurecore/backend/backend && ./node_modules/.bin/nest build && pm2 restart neurecore-backend'
```

The PM2 restart only changes the running process; it does NOT recompile TypeScript.

### 4.9 DON'T edit vhost.conf without `litespeed -t`

```bash
# ❌
ssh contabo 'nano /usr/local/lsws/conf/vhosts/hq.neurecore.com/vhost.conf'
ssh contabo 'systemctl restart lsws'   # if config is broken, OLS dies

# ✅
ssh contabo 'nano /usr/local/lsws/conf/vhosts/hq.neurecore.com/vhost.conf'
ssh contabo '/usr/local/lsws/bin/litespeed -t'      # syntax check
ssh contabo 'systemctl restart lsws'                # only after test passes
```

### 4.10 DON'T assume ports

| Port | What | Don't assume |
|---|---|---|
| 3000 | `nghttpx` (LiteSpeed proxy) | this is the backend (it's not) |
| 3001 | GUV `app-frontend` | this is tenant (it's not) |
| 3002 | nothing | admin is here (it's not; admin is on 3020) |
| 3003 | `neurecore-backend` | direct backend port |
| 3004 | CORS proxy | direct backend port (it's a sidecar) |
| 3005 | `neurecore-tenant` | direct tenant port |
| 3010 | PM2 internal | a service |
| 3011 | FREE (EAOS retired) | EAOS is here (it's not) |
| 3020 | `neurecore-admin` | direct admin port |
| 3021 | FREE (FTS retired) | FTS is here (it's not) |
| 3100 | GUV Next.js | a service |
| 7080 | CyberPanel | admin app |
| 9090/9093/9094 | Prometheus/Alertmanager | backend ports |
| 3200 | Grafana | backend port |

### 4.11 DON'T commit `.env`, `node_modules`, `.next`, `dist`, `tsconfig.tsbuildinfo`

These are in `.gitignore` but if you ever `git add -f`, you're on your own.

### 4.12 DON'T break the other apps on the box

`gfcportal`, `shahisoft-nextjs`, `lifeosa-backend`, `ecoearthshop-backend`, `cookie-refresher`, GUV's `app-frontend` are unrelated projects also using PM2. Don't:
- Restart them by mistake
- Touch their ports (3001, 3100, 3500)
- Add them to `ecosystem.config.js`
- Kill their processes to free RAM

### 4.13 DON'T skip `pm2 save` after a reload

Without `pm2 save`, the new process layout is not written to `/root/.pm2/dump.pm2`, so a reboot won't restore the right processes.

### 4.14 DON'T bring back Vercel, FTS, or EAOS without product approval

These were retired on purpose. Reversing the decision requires an explicit go-ahead recorded in [future-plans.md](future-plans.md) and a new architecture doc.

---

## 4.11 Capability sidecars (systemd, NOT PM2)

Capability sidecars are Python services that perform tenant-scoped compute
behind an HMAC-authenticated HTTP boundary. They are NOT managed by PM2.

**Currently running (verified 2026-07-30):**

| Service | Port | Source | Unit file |
|---|---|---|---|
| `hermes-sidecar` | 8080 | `/opt/neurecore/infra/hermes-sidecar` | `/etc/systemd/system/hermes-sidecar.service` |
| `hermes-events-bridge` | 8082 | `/opt/neurecore/infra/hermes-events-bridge` | `/etc/systemd/system/hermes-events-bridge.service` |
| `accounting-sidecar` | 8091 | `/opt/neurecore/infra/accounting-sidecar` | `/etc/systemd/system/accounting-sidecar.service` |

**Pattern:** All run as user `hermes-sidecar` (uid 997). All bind to
`127.0.0.1` only (no public exposure). All share the Python venv at
`/opt/neurecore/infra/venv/`.

**See [sidecar-deploy-procedure.md](sidecar-deploy-procedure.md) for the
full procedure** to add a new sidecar (synced from the accounting-sidecar
deploy on 2026-07-30).

**Quick health check:**
```bash
ssh contabo 'systemctl is-active hermes-sidecar hermes-events-bridge accounting-sidecar; ss -tlnp | grep -E "(8080|8082|8091)"'
```

**Common failure mode: sidecar crashes after NestJS deploy.**
If you `rsync` source for a sidecar that has an import error, the sidecar
will hit `StartLimitBurst=5` and refuse to restart for 60 seconds. Fix:
fix the code, `rsync`, then:
```bash
ssh contabo 'systemctl reset-failed <name>-sidecar && systemctl restart <name>-sidecar'
```

---

## 5. Emergency contacts

| Issue | Contact |
|---|---|
| Server unreachable (physical/network) | Contabo support ticket |
| TLS cert won't renew | Check `/var/log/letsencrypt/`; manual: `certbot renew --force-renewal` |
| Backend code broken | Rollback via [disaster-recovery.md §3.1](disaster-recovery.md#31-restore-backend) |
| Database corruption | Check PostgreSQL status; check [disaster-recovery.md §7](disaster-recovery.md#7-database-recovery) |
| Disk full | [disaster-recovery.md §5](disaster-recovery.md#5-disk-full-recovery) |

---

## 6. Periodic maintenance checklist

Weekly:
```bash
# Disk usage
ssh contabo 'df -h / | tail -1; du -sh /opt/neurecore/_archives/ /var/log/ /root/.pm2/logs/'

# Log growth
ssh contabo 'find /root/.pm2/logs -name "*.log" -mtime +7 -ls'

# Cert expiry
ssh contabo 'certbot certificates | grep -E "Domains|Expiry"'
```

Monthly:
```bash
# Prune old archives (keep last 5)
ssh contabo 'ls -dt /opt/neurecore/_archives/2* | tail -n +6 | xargs -r rm -rf'

# Prune old logs
ssh contabo 'find /root/.pm2/logs -name "*.log" -mtime +30 -delete'

# apt updates (carefully)
ssh contabo 'apt-get update && apt-get -y upgrade'

# Reboot (announce first; PM2 should resurrect)
ssh contabo 'reboot'
```

Quarterly:
- Verify Let's Encrypt renewal works (`certbot renew --dry-run`)
- Audit OLS vhost list — any new hostnames? Any orphaned?
- Review `/opt/neurecore/_archives/` size; adjust retention
- Test DR restore on a non-critical path

---

**End of contabo-ops.md.**
