# Deploy to Contabo — Fastest Path

**Last deploy:** 2026-09-01 — `releaseId=20260901160940`, ~8 min wall-clock
(96s build + **210s snapshot (foreground)** + 297s xfer + 8s restart + 10s verify).

**Host:** `vmi2954830.contaboserver.net` (`109.123.248.253`) — SSH alias `contabo`.

**Runtime tree:** `/opt/donordesk/app/` (mutable; tar-extracted in place).

This is the single source of truth for deploying. For the live-host
inventory, port map, services, db rules, and security sign-off see
[`contabo-ops.md`](contabo-ops.md). For the AI Reporter feature-flag flip
see [`imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md`](imp/AI-REPORTER-2-POSTDEPLOY-RUNBOOK.md).

---

## 1. One-liner (the common case)

```bash
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)" scripts/deploy-fast.sh
```

That's it. The script auto-detects scope from `git diff HEAD~1`, typechecks,
builds, stages tars, snapshots the previous deploy, streams the new tars
to `/opt/donordesk/app/`, restarts the affected systemd services, and
verifies with `/health`, `/ready`, and `/v1/ai-reporter/health`. On any
gate failure it prints the rollback command and exits non-zero
(**does not auto-rollback** — see §7).

**Wall-clock for a web-only change:** ~3–4 min total (most of it is the
Next.js build, ~150s).

**Wall-clock for a full api+web change:** ~7–8 min.

If you have already built locally and just want to ship, add
`SKIP_BUILD=1 SKIP_TYPECHECK=1`. If you do not want a fresh pre-deploy
backup (dev loop), add `NO_BACKUP=1`.

---

## 2. Scope control

| `SCOPE=…` | What ships | What restarts |
|---|---|---|
| `web` (auto) | `apps/web/.next/standalone/`, `apps/web/.next/static/`, `apps/web/public/`, `apps/web/package.json` | `donordesk-web` |
| `api` (auto) | `apps/api/{dist,node_modules,package.json,tsconfig.json}` + `packages/*` + `node_modules/.pnpm/` + `apps/workers/app/` | `donordesk-api`, `donordesk-workers` |
| `both` (auto) | everything from both scopes | `donordesk-api`, `donordesk-web`, `donordesk-workers` |

Auto-detection looks at the diff vs `HEAD~1`:
- changes in `apps/web/` → at least `web`
- changes in `apps/api/`, `apps/workers/`, `apps/superadmin/`, `packages/`, `prisma/` → at least `api`
- both → `both`

Working-tree (uncommitted) changes are detected too.

---

## 3. Required gate (run BEFORE the deploy)

```bash
pnpm -r typecheck   # ~60s
pnpm -r test        # ~30s if you've already built; 2-3 min cold
```

The script re-runs both, but pre-running surfaces failures in 30s without
spending 96s on the build.

For schema changes (new migration under `packages/infrastructure/prisma/`):

```bash
# As root on the host, with migrator credentials (never in api.env):
ssh contabo 'set -a; . <migrator-env>; set +a
DATABASE_URL="$DATABASE_ADMIN_URL" \
  /opt/donordesk/app/packages/infrastructure/node_modules/.bin/prisma \
  migrate deploy \
  --schema /opt/donordesk/app/packages/infrastructure/prisma/schema.prisma

# Then RLS + grants from infra/postgres/rls.sql:
sudo -u postgres psql "$DATABASE_ADMIN_URL" --set ON_ERROR_STOP=1 \
  --file /opt/donordesk/app/packages/infrastructure/prisma/rls.sql
```

**Add the new schema column to `REQUIRED_PRISMA_FIELDS`** in
`apps/api/src/routes/health.ts` in the same PR — the `/ready` gate
blocks the deploy otherwise.

---

## 4. Live-host preflight (30 s)

```bash
ssh contabo '
  echo "=== ports ===";  ss -ltn | grep -E ":3002|:4001|:8092|:8093" || echo "MISSING"
  echo "=== disk ===";   df -h /opt | tail -1
  echo "=== mem ===";    free -m | head -2
  echo "=== api ===";    systemctl is-active donordesk-api donordesk-web donordesk-workers
  echo "=== workers ==="; curl -fsS --max-time 3 http://127.0.0.1:8092/v1/ai-reporter/health 2>/dev/null || echo "worker down"
  echo "=== /ready ==="; curl -fsS --max-time 3 http://127.0.0.1:4001/ready 2>/dev/null || echo "api not ready"
  echo "=== backups ==="; ls -1t /opt/donordesk/backups/dd-app-pre-*.tgz 2>/dev/null | head -3
'
```

**Expected output (2026-09-01):**

| Check | Healthy |
|---|---|
| ports | 3002 (web), 4001 (api), 8092 (worker) all listening on `127.0.0.1` |
| disk | `/opt` ≥ 30 GiB free |
| mem | available ≥ 4 GiB |
| api/web/workers | all `active` |
| workers `/v1/ai-reporter/health` | `{"status":"ok"}` |
| `/ready` | `{"status":"ready","checks":{"database":"ok","prismaClient":"ok"}}` |
| backups | ≥ 1 recent `dd-app-pre-*.tgz` |

If any port is missing → check `systemctl status`. If `/ready` returns 503
with `missingPrismaFields` → `prisma generate` did not run during the
last deploy; re-run it manually:

```bash
ssh contabo 'cd /opt/donordesk/app/packages/infrastructure && \
  /opt/donordesk/app/node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/index.js generate \
  --schema prisma/schema.prisma && \
  systemctl restart donordesk-api'
```

---

## 5. The deploy

```bash
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)" scripts/deploy-fast.sh
```

Add `SCOPE=web|api|both` if auto-detect misfires (e.g. only docs/ edited).
Add `SKIP_BUILD=1 SKIP_TYPECHECK=1` if you built and tested locally. Add
`NO_BACKUP=1` for tight dev loops.

**What it does (in order):**

1. **Preflight** — hostname sanitisation, scp+extract canary against
   `app/.deploy-canary/`, `@sentry/node` resolution check.
2. **Typecheck** — `pnpm -r typecheck` (~60 s; skipped with `SKIP_TYPECHECK=1`).
3. **Build** — `pnpm -r build` (~96 s for `contracts + domain + infrastructure + application + api + web`; skipped with `SKIP_BUILD=1`).
4. **Scope detection** from `git diff HEAD~1`.
5. **Stage tars** locally in `/tmp/dd-deploy-<RELEASE_ID>/`:
   - `web.tgz` ~210 MB (`.next/standalone/` + `.next/static/` + `public/` + `package.json` + `node_modules/.pnpm/`).
   - `api.tgz` ~56 KB (`apps/api/dist/`, `package.json`, `tsconfig.json`).
   - `packages.tgz` ~860 KB (`packages/{contracts,domain,application,infrastructure}/{dist,prisma,scripts}`).
   - `pnpm.tgz` ~200 MB (`node_modules/.pnpm/` virtual store).
   - `worker.tgz` ~44 KB (`apps/workers/app/` excluding `.venv/`, `__pycache__/`).
6. **Snapshot** the previous `app/` tree to `/opt/donordesk/backups/dd-app-pre-<RELEASE_ID>.tgz` (~210 s for a 250 MB tree; rotated to keep last 3). Optional with `NO_BACKUP=1`.
7. **Stream + extract** the new tars over `scp` into the live tree:
   - `web.tgz` → `/opt/donordesk/app/apps/web/.next/standalone/`
   - `packages.tgz` → `/opt/donordesk/app/`
   - `pnpm.tgz` → `/opt/donordesk/app/node_modules/.pnpm/` then `pnpm install` at `apps/api/` to regenerate the symlink farm.
   - `api.tgz` → `/opt/donordesk/app/apps/api/`
   - `worker.tgz` → `/opt/donordesk/app/apps/workers/` then rsync to `/opt/donordesk/workers/app/`.
8. **Regenerate Prisma client** against the shipped schema (the api's `@prisma/client` is in `node_modules/.pnpm/`).
9. **Restart** the affected systemd services (`donordesk-api`, `donordesk-web`, `donordesk-workers`).
10. **Verify** via SSH:
    - `systemctl is-active` for the restarted services
    - `curl /health` and `curl /ready` on the api (polls up to 60 s)
    - `curl /v1/ai-reporter/health` on the worker with the `workers.env INTERNAL_TOKEN`

On any failure, the script prints the rollback command and exits non-zero
— it does **not** auto-rollback (a 2026-08-28 lesson — auto-rollback
extracted a snapshot that itself was missing `node_modules/` and made
things worse).

---

## 6. Manual tail (when you want to see what's happening)

```bash
# On your local box (the deploy script):
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)" scripts/deploy-fast.sh 2>&1 | tee /tmp/dd-deploy.log

# In another terminal, watch the api journal:
ssh contabo 'journalctl -u donordesk-api -u donordesk-web -u donordesk-workers -f --since "5 minutes ago"'

# And probe the public URL:
curl -fsS -o /dev/null -w "HTTP:%{http_code}  time:%{time_total}s\n" https://donordesk.online/login
```

A clean deploy ends with this in the local log:

```
==> Done. releaseId=<RELEASE_ID>
```

and the api journal shows:

```
"msg":"DonorDesk API listening on :4001"
"msg":"AI Reporter flag is enabled…"   # only if AI_REPORTER_ENABLED=1
"res":{"statusCode":200}              # for the /ready probe
```

---

## 7. Rollback

The previous `app/` tree is always snapshot to
`/opt/donordesk/backups/dd-app-pre-<RELEASE_ID>.tgz` (rotated, last 3
kept). **Rollback is one command:**

```bash
ssh contabo '
  PRE=$(ls -1t /opt/donordesk/backups/dd-app-pre-*.tgz | head -1)
  echo "Rolling back to $PRE"
  rm -rf /opt/donordesk/app
  tar -xzf "$PRE" -C /opt/donordesk
  systemctl restart donordesk-api donordesk-web donordesk-workers
  sleep 3
  curl -fsS http://127.0.0.1:4001/ready
'
```

For non-emergency rollback the cleanest path is `git checkout <prev-commit>`
+ redeploy — git is the source of truth and the script will rebuild the
previous code in ~3 min.

**Application rollback does not undo database changes.** Production
migrations must remain compatible with the preceding release. If the
rollback needs a database reversal, that's a separate approval and an
expand/migrate/contract plan.

---

## 8. Speed tuning (when even 3 min is too slow)

The deploy's wall-clock breakdown on 2026-09-01:

| Step | Time | Optimisation |
|---|---:|---|
| Build (full) | 96 s | Cache the `node_modules/.pnpm/` between deploys (it already is); cache `apps/web/.next/cache/` between web builds. |
| Stage tars | 96 s | Already runs concurrently with snapshot. |
| **Snapshot** | **210 s** | **Foreground. The single biggest wall-clock contributor.** |
| Stream + extract | 297 s | Dominated by the 200 MB `pnpm.tgz` over a 2.86 MB/s link. |
| Restart | 8 s | systemd serialises restarts; could be parallelised in a future patch. |
| Verify | 10 s | Sequential health probes; minimum possible. |

**Cheap wins already in the script:**

- `SKIP_BUILD=1 SKIP_TYPECHECK=1` if you already ran them — saves 96+60 s.
- `NO_BACKUP=1` saves 210 s on a tight dev loop. **Never use in production.**
- `SCOPE=web` (web-only deploys do not ship `pnpm.tgz` or `worker.tgz`) saves ~3 min over `both`.

**Cheap wins not yet in the script (follow-up):**

- Move the snapshot to a backgrounded `nohup` so it runs concurrently with stream+extract — net win ~150 s per `both` deploy. Tracked in `pending.md`.
- SSH `ControlMaster`/`ControlPersist` for the ~6 SSH/SCP calls per deploy — saves ~10 s of connection overhead. Easy 5-line patch.
- Sparse `rsync` of `node_modules/.pnpm/` instead of full tar — saves ~120 s on a `both` deploy with no pnpm changes.

---

## 9. After-deploy token sync (do this ONCE if you restart the worker)

The api sends `X-Internal-Token` to the worker on every AI Reporter
request. The api reads it from `INTERNAL_TOKEN` in `/opt/donordesk/shared/api.env`;
the worker reads its expected value from `INTERNAL_TOKEN` in
`/opt/donordesk/shared/workers.env`. **These two are independent values
in the live env files** — the api's token was historically a copy but
drifted after the 2026-09-01 token-rotation.

If the worker returns `{"detail":"Invalid internal token"}` (HTTP 401)
when the api calls `/v1/ai-reporter/*`, the tokens have drifted. Fix:

```bash
ssh contabo '
  WORKER_TOKEN=$(grep "^INTERNAL_TOKEN=" /opt/donordesk/shared/workers.env | cut -d= -f2-)
  cp -a /opt/donordesk/shared/api.env /opt/donordesk/shared/api.env.bak.tokensync-$(date -u +%Y%m%d%H%M%S)
  sed -i "s|^INTERNAL_TOKEN=.*|INTERNAL_TOKEN=${WORKER_TOKEN}|" /opt/donordesk/shared/api.env
  systemctl restart donordesk-api
'
```

Verify:

```bash
ssh contabo '
  TOKEN=$(grep "^INTERNAL_TOKEN=" /opt/donordesk/shared/api.env | cut -d= -f2-)
  curl -fsS -H "X-Internal-Token: $TOKEN" http://127.0.0.1:8092/v1/ai-reporter/health
'
# Expected: {"status":"ok"}
```

---

## 10. Common pitfalls

| Symptom | Cause | Fix |
|---|---|---|
| `app/release.json` shows old `releaseId` | Script aborted before writing | Re-run with `SKIP_BUILD=1 SKIP_TYPECHECK=1` — build is the most likely failing gate. |
| `/ready` returns 503 `missingPrismaFields` | Shipped schema drift from the generated client | Run `prisma generate` on the host (§4) and restart. |
| Web renders but styling is broken (unstyled HTML) | The web tar is missing `node_modules/.pnpm/` or `.next/standalone/apps/web/.next/static/` | Re-run the deploy with `SCOPE=web` (forces the web stage). |
| `ERR_MODULE_NOT_FOUND` from `apps/api/dist/server.js` | The api's `node_modules/` symlink farm was not regenerated | The api stage does `pnpm install` — if it failed, re-run with `SCOPE=api` to redo the pnpm step. |
| Worker health 401 `Invalid internal token` | api/worker `INTERNAL_TOKEN` drift | §9. |
| Web OK but api 502 | Web reached the api through OLS and got a non-2xx | Check `journalctl -u donordesk-api -n 50`; check `host=127.0.0.1` is set in api.env. |
| Build fails with `ELIFECYCLE` on `pnpm install` | Lockfile drift | `cd packages/infrastructure && pnpm install --no-frozen-lockfile` then re-run the deploy. |
| `hostname contains invalid characters` | Local hostname has odd chars; gzip embeds it | The script sanitises and sets `GZIP=-n`. If you still see it, set `HOSTNAME=donordesk-deploy` in your shell. |