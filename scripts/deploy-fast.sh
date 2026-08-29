#!/usr/bin/env bash
# deploy-fast.sh — single-archive deploy for DonorDesk (api + worker + web).
#
# Self-contained tar+extract model (per memorybank/contabo-ops.md §21.1).
# Builds locally, stages tars, snapshots the host's previous deploy, then
# streams each artifact over SSH and extracts it into /opt/donordesk/app/.
#
# Usage:
#   RELEASE_ID="20260901120000" SCOPE=both scripts/deploy-fast.sh
#   SCOPE: web|api|both (default: auto-detect from git diff)
#
# Exit codes: 0 on full success, non-zero on any gate failure. Every step
# prints progress; tail the output to find the first failing gate.

set -euo pipefail

# --------------------------------------------------------------------------- #
# Args
# --------------------------------------------------------------------------- #

SCOPE="${SCOPE:-auto}"
NO_BACKUP="${NO_BACKUP:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_TYPECHECK="${SKIP_TYPECHECK:-0}"
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)}"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
WORK="${WORK:-/tmp/dd-deploy-${RELEASE_ID}}"
SSH="${SSH:-ssh -o ConnectTimeout=15 -o ServerAliveInterval=30}"
SCPTGT="${SCPTGT:-contabo:}"
REMOTE_BASE="${REMOTE_BASE:-/opt/donordesk}"
REMOTE_APP="${REMOTE_APP:-${REMOTE_BASE}/app}"
REMOTE_WORKERS="${REMOTE_WORKERS:-${REMOTE_BASE}/workers}"
REMOTE_BACKUPS="${REMOTE_BACKUPS:-${REMOTE_BASE}/backups}"

echo "==> Release: ${RELEASE_ID}  scope=${SCOPE}  host=contabo"

# --------------------------------------------------------------------------- #
# 1. Typecheck
# --------------------------------------------------------------------------- #

if [[ "${SKIP_TYPECHECK}" != "1" ]]; then
  echo "==> Local typecheck"
  TC_LOG="${WORK}/typecheck.log"
  mkdir -p "${WORK}"
  pnpm -r typecheck 2>&1 | tee "${TC_LOG}" | tail -5
fi

# --------------------------------------------------------------------------- #
# 2. Build
# --------------------------------------------------------------------------- #

if [[ "${SKIP_BUILD}" != "1" ]]; then
  echo "==> Local build (full)"
  BUILD_LOG="${WORK}/build.log"
  pnpm -r build 2>&1 | tee "${BUILD_LOG}" | tail -3 || {
    echo "ERROR: build failed — see ${BUILD_LOG}" >&2
    tail -40 "${BUILD_LOG}" >&2
    exit 1
  }
fi

# --------------------------------------------------------------------------- #
# 2a. Auto-detect scope
# --------------------------------------------------------------------------- #

if [[ "${SCOPE}" == "auto" ]]; then
  if [[ -n "$(git -C "${ROOT}" diff --name-only HEAD~1 2>/dev/null | grep -E '^(apps/web|apps/api|apps/workers|packages/)' || true)" ]]; then
    SCOPE="both"
  elif [[ -n "$(git -C "${ROOT}" diff --name-only HEAD~1 2>/dev/null | grep -E '^(apps/web)' || true)" ]]; then
    SCOPE="web"
  elif [[ -n "$(git -C "${ROOT}" diff --name-only HEAD~1 2>/dev/null | grep -E '^(apps/api|apps/workers|packages/)' || true)" ]]; then
    SCOPE="api"
  else
    SCOPE="web"
  fi
  echo "  auto-detected SCOPE=${SCOPE}"
fi

# --------------------------------------------------------------------------- #
# 3. Stage artifacts
# --------------------------------------------------------------------------- #

WEB_TAR="${WORK}/web-${RELEASE_ID}.tgz"
API_TAR="${WORK}/api-${RELEASE_ID}.tgz"
WORKER_TAR="${WORK}/worker-${RELEASE_ID}.tgz"
PACKAGES_TAR="${WORK}/packages-${RELEASE_ID}.tgz"
PNPM_TAR="${WORK}/pnpm-store-${RELEASE_ID}.tgz"

mkdir -p "${WORK}"
STAGE_START=$(date +%s)

if [[ "${SCOPE}" == "web" || "${SCOPE}" == "both" ]]; then
  echo "==> Stage web artifact"
  # web tar ships from the standalone build output. The deploy script's
  # web stage is unchanged from §21.1 (apps/web deploys independently).
  WEB_STAGE="${WORK}/web-stage"
  mkdir -p "${WEB_STAGE}"
  rsync -a --delete "${ROOT}/apps/web/.next/standalone/" "${WEB_STAGE}/"
  rsync -a "${ROOT}/apps/web/.next/static/" "${WEB_STAGE}/apps/web/.next/static/" 2>/dev/null || true
  rsync -a "${ROOT}/apps/web/public/" "${WEB_STAGE}/apps/web/public/" 2>/dev/null || true
  rsync -a "${ROOT}/apps/web/package.json" "${WEB_STAGE}/apps/web/package.json"
  rsync -a --delete "${ROOT}/node_modules/" "${WEB_STAGE}/node_modules/"
  tar -C "${WEB_STAGE}" -czf "${WEB_TAR}" .
  echo "    web tar: $(du -h "${WEB_TAR}" | cut -f1)  (standalone + .pnpm + static + public)"
fi

if [[ "${SCOPE}" == "api" || "${SCOPE}" == "both" ]]; then
  echo "==> Stage api artifact"
  if [[ ! -d "${ROOT}/apps/api/dist" ]]; then
    echo "ERROR: ${ROOT}/apps/api/dist missing — did api build run?" >&2
    exit 1
  fi
  # Ship apps/api/ as a tree (not dist/ at top). The systemd unit's
  # WorkingDirectory is /opt/donordesk/app/apps/api (see infra/systemd/
  # donordesk-api.service). All workspace @donordesk/* links resolve
  # through apps/api/node_modules/@donordesk/* -> ../../../../packages/*.
  (cd "${ROOT}" && \
   tar --exclude='apps/api/node_modules/.cache' \
       --exclude='apps/api/node_modules/.pnpm' \
       -czf "${API_TAR}" \
       apps/api/dist \
       apps/api/package.json \
       apps/api/tsconfig.json \
       apps/api/node_modules)
  echo "    api tar: $(du -h "${API_TAR}" | cut -f1)"

  # Stage 3a: ship the workspace packages' compiled output so the api's
  # @donordesk/* workspace symlinks resolve.
  echo "==> Stage workspace packages artifact"
  (cd "${ROOT}" && \
   tar --exclude='packages/*/node_modules' \
       --exclude='packages/*/dist/.cache' \
       --exclude='packages/*/coverage' \
       -czf "${PACKAGES_TAR}" \
       packages/contracts/dist packages/contracts/package.json \
       packages/domain/dist packages/domain/package.json \
       packages/application/dist packages/application/package.json \
       packages/infrastructure/dist packages/infrastructure/package.json \
       packages/infrastructure/prisma packages/infrastructure/scripts 2>/dev/null || true)
  echo "    packages tar: $(du -h "${PACKAGES_TAR}" | cut -f1)"

  # Stage 3b: ship the pnpm virtual store contents. The api tar ships
  # apps/api/node_modules with only symlinks (pnpm hoists real files into
  # .pnpm/). Without this, fastify and friends fail to resolve. The store
  # lives at <workspace>/node_modules/.pnpm on local pnpm 10, but pnpm
  # install on the host regenerates the same layout.
  echo "==> Stage pnpm store artifact"
  (cd "${ROOT}" && \
   tar --exclude='packages/*/node_modules' \
       -czf "${PNPM_TAR}" \
       node_modules/.pnpm)
  echo "    pnpm tar: $(du -h "${PNPM_TAR}" | cut -f1)"
fi

if [[ "${SCOPE}" == "api" || "${SCOPE}" == "both" ]]; then
  echo "==> Stage worker artifact"
  # Ship the python worker tree (.venv excluded). The systemd unit reads
  # WorkingDirectory=/opt/donordesk/workers; we rsync the new code in and
  # restart the service. prisma/ migration is included so the operator has
  # the latest migration alongside the worker.
  (cd "${ROOT}" && \
   tar --exclude='apps/workers/.venv' \
       --exclude='apps/workers/**/__pycache__' \
       --exclude='apps/workers/**/*.pyc' \
       -czf "${WORKER_TAR}" \
       apps/workers/app apps/workers/requirements.txt \
       packages/infrastructure/prisma/schema.prisma \
       packages/infrastructure/prisma/migrations \
       infra/postgres/rls.sql)
  echo "    worker tar: $(du -h "${WORKER_TAR}" | cut -f1)"
fi
echo "    stage: $(($(date +%s)-STAGE_START))s"

# --------------------------------------------------------------------------- #
# 4. Snapshot previous deploy (full app, includes node_modules)
# --------------------------------------------------------------------------- #

SNAPSHOT_START=$(date +%s)
if [[ "${NO_BACKUP}" != "1" ]]; then
  echo "==> Snapshot previous deploy on host (rotate, keep last 3)"
  ${SSH} "
    set -eu
    if [[ ! -d ${REMOTE_BACKUPS} ]]; then mkdir -p ${REMOTE_BACKUPS}; fi
    ls -1t ${REMOTE_BACKUPS}/dd-app-pre-*.tgz 2>/dev/null | tail -n +4 | xargs -r rm -f
    tar --exclude='apps/*/.next/cache' \
        --exclude='node_modules/.cache' \
        -czf ${REMOTE_BACKUPS}/dd-app-pre-${RELEASE_ID}.tgz \
        -C ${BASE} app
    ls -1t ${REMOTE_BACKUPS}/dd-app-pre-*.tgz | head -5
  "
else
  echo "==> Skipping snapshot (NO_BACKUP=1)"
fi
echo "    snapshot: $(($(date +%s)-SNAPSHOT_START))s"

# --------------------------------------------------------------------------- #
# 5. Stream-extract into /opt/donordesk/app/
# --------------------------------------------------------------------------- #

XFER_START=$(date +%s)

if [[ "${SCOPE}" == "web" || "${SCOPE}" == "both" ]]; then
  echo "==> Stream web artifact -> ${REMOTE_APP}/apps/web/"
  cat "${WEB_TAR}" | ${SSH} "
    set -eu
    cd ${REMOTE_APP}/apps/web
    rm -rf .next
    tar -xzf - -C ${REMOTE_APP}/apps/web
    chown -R donordesk:donordesk ${REMOTE_APP}/apps/web
  "
fi

if [[ "${SCOPE}" == "api" || "${SCOPE}" == "both" ]]; then
  # Stage A: ship workspace packages. The api's @donordesk/* symlinks resolve
  # to /opt/donordesk/app/packages/<pkg>/ via apps/api/node_modules/@donordesk/*
  # -> ../../../../packages/*.
  if [[ -f "${PACKAGES_TAR}" ]]; then
    echo "==> Stream workspace packages -> ${REMOTE_APP}/packages/"
    cat "${PACKAGES_TAR}" | ${SSH} "
      set -eu
      cd ${REMOTE_APP}
      rm -rf packages
      tar -xzf - -C ${REMOTE_APP}
      chown -R donordesk:donordesk ${REMOTE_APP}/packages
    "
  fi

  # Stage B: ship pnpm store contents. The api tar ships apps/api/node_modules
  # with only symlinks; the real package files live under node_modules/.pnpm/.
  if [[ -f "${PNPM_TAR}" ]]; then
    echo "==> Stream pnpm store -> ${REMOTE_APP}/node_modules/.pnpm/"
    cat "${PNPM_TAR}" | ${SSH} "
      set -eu
      cd ${REMOTE_APP}
      rm -rf node_modules/.pnpm node_modules/.bin node_modules/.modules.yaml node_modules/.pnpm-workspace-state-v1.json
      tar -xzf - -C ${REMOTE_APP}
      # Restore the api-level symlink farm so apps/api's fastify etc. resolve.
      cd ${REMOTE_APP}/apps/api
      if [ -f package.json ]; then
        CI=true npx -y pnpm@10.34.5 install --no-frozen-lockfile --silent 2>/dev/null || true
      fi
      chown -R donordesk:donordesk ${REMOTE_APP}/node_modules
    "
  fi

  # Stage B2: regenerate the Prisma client on the host against the freshly
  # shipped schema. The tar only contains pre-generated client files baked
  # at local-build time; if the local build was stale (e.g. schema changed
  # but prisma generate did not re-run, or the tar was reused across schema
  # revisions), the running api would still throw "Unknown argument <field>"
  # on any model operation that uses the newer field. Re-running prisma
  # generate here, against the just-shipped schema.prisma, guarantees the
  # running client matches the schema the api code expects.
  echo "==> Regenerate Prisma client against shipped schema"
  ${SSH} "
    set -eu
    if [ ! -f ${REMOTE_APP}/packages/infrastructure/prisma/schema.prisma ]; then
      echo 'ERROR: ${REMOTE_APP}/packages/infrastructure/prisma/schema.prisma missing on host' >&2
      exit 1
    fi
    cd ${REMOTE_APP}/packages/infrastructure
    npx -y prisma@5.22.0 generate --schema prisma/schema.prisma \
      >/tmp/dd-prisma-generate.log 2>&1 \
      || (echo 'prisma generate FAILED — see /tmp/dd-prisma-generate.log on host' >&2; cat /tmp/dd-prisma-generate.log >&2; exit 1)
    chown -R donordesk:donordesk ${REMOTE_APP}/node_modules/.pnpm
    echo '  prisma generate: ok'
  "

  # Stage C: ship the api tree. apps/api/dist + apps/api/node_modules
  # (symlinks) + apps/api/src land at /opt/donordesk/app/apps/api/. The
  # systemd unit's WorkingDirectory=/opt/donordesk/app/apps/api finds dist/
  # relative to that path.
  echo "==> Stream api artifact -> ${REMOTE_APP}/apps/api/"
  cat "${API_TAR}" | ${SSH} "
    set -eu
    cd ${REMOTE_APP}
    rm -rf apps/api/dist apps/api/node_modules
    mkdir -p apps
    tar -xzf - -C ${REMOTE_APP}
    if [ -d apps/api ]; then
      chown -R donordesk:donordesk apps/api
    fi
  "

  # Stage D: ship the worker tree. The systemd unit reads from
  # /opt/donordesk/workers/, separate from the api tree. Mirror the new
  # apps/workers/app/ over it and restart the service.
  if [[ -f "${WORKER_TAR}" ]]; then
    echo "==> Stream worker artifact + mirror to runtime dir"
    cat "${WORKER_TAR}" | ${SSH} "
      set -eu
      cd ${REMOTE_APP}
      rm -rf apps/workers
      tar -xzf - -C ${REMOTE_APP}
      if [ -d apps/workers ]; then
        chown -R donordesk:donordesk apps/workers
      fi
      rsync -a --delete \
        --exclude='.venv' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        ${REMOTE_APP}/apps/workers/app/ \
        ${REMOTE_WORKERS}/app/
      chown -R donordesk:donordesk ${REMOTE_WORKERS}
      systemctl restart donordesk-workers
      sleep 2
      systemctl --no-pager --full status donordesk-workers 2>&1 | grep -E 'Active:|Main PID:' || true
    "
  fi
fi
echo "    xfer+extract: $(($(date +%s)-XFER_START))s"

# --------------------------------------------------------------------------- #
# 6. Write release.json, restart, verify
# --------------------------------------------------------------------------- #

ACTIVATE_START=$(date +%s)

HEAD_COMMIT="$(git -C "${ROOT}" rev-parse HEAD 2>/dev/null || echo unknown)"
cat > "${WORK}/release.json" <<EOF
{"releaseId":"${RELEASE_ID}","commit":"${HEAD_COMMIT}","builtAt":"$(date -u +%FT%TZ)","scope":"${SCOPE}"}
EOF
scp -q "${WORK}/release.json" ${SCPTGT}${REMOTE_APP}/release.json

case "${SCOPE}" in
  web)  SERVICES="donordesk-web" ;;
  api)  SERVICES="donordesk-api" ;;
  both) SERVICES="donordesk-api donordesk-web" ;;
esac

echo "==> Restart ${SERVICES}"
${SSH} "systemctl restart ${SERVICES}"
echo "    restart: $(($(date +%s)-ACTIVATE_START))s"

# --------------------------------------------------------------------------- #
# 7. Verify
# --------------------------------------------------------------------------- #

VERIFY_START=$(date +%s)
echo "==> Verify"
${SSH} "
  set -eu
  echo '--- systemd ---'
  systemctl is-active ${SERVICES}
  echo '--- api ---'
  curl -fsS --max-time 10 http://127.0.0.1:4001/health || (echo 'api health FAILED'; exit 1)
  echo
  # /ready now also introspects the running Prisma client against the
  # expected schema. A 503 here means the generated client is stale (likely
  # prisma generate did not re-run during deploy); curl with -f would fail
  # the gate. Use --write-out to capture status and surface the JSON body
  # so the operator can see which fields are missing.
  READY_BODY=\$(curl -sS --max-time 10 -w '\nHTTP_STATUS:%{http_code}' http://127.0.0.1:4001/ready || true)
  echo \"\${READY_BODY}\"
  READY_STATUS=\$(printf '%s' \"\${READY_BODY}\" | sed -n 's/^HTTP_STATUS:\\([0-9][0-9][0-9]\\)$/\\1/p' | tail -n 1)
  if [ \"\${READY_STATUS}\" != '200' ]; then
    echo 'api ready FAILED (Prisma client likely stale vs schema)'
    exit 1
  fi
  echo
  echo '--- worker ---'
  if systemctl is-active donordesk-workers >/dev/null 2>&1; then
    WORKER_TOKEN=\$(grep '^INTERNAL_TOKEN' /opt/donordesk/shared/workers.env | cut -d= -f2)
    curl -fsS --max-time 10 -H \"x-internal-token: \${WORKER_TOKEN}\" \
      http://127.0.0.1:8092/v1/ai-reporter/health \
      || (echo 'worker ai-reporter health FAILED (routes missing or token mismatch)'; exit 1)
  else
    echo 'worker not active'
    exit 1
  fi
"
echo "    verify: $(($(date +%s)-VERIFY_START))s"

# --------------------------------------------------------------------------- #
# 8. Cleanup
# --------------------------------------------------------------------------- #

if [[ -z "${KEEP_WORK:-}" ]]; then
  rm -rf "${WORK}"
fi

echo "==> Done. releaseId=${RELEASE_ID}"
