#!/usr/bin/env bash
# Fast incremental deploy for DonorDesk on Contabo (deploy doc §21.3).
#
# Replaces the slow off-host-build + 1.7 GB rsync flow with a gfcportal-style
# tar-and-extract pattern. For a web-only change:
#   - build web incrementally (contracts + domain + web)
#   - tar .next/standalone + .next/static (~15 MB compressed)
#   - stream-extract over apps/web/.next/ on the server
#   - restart donordesk-web
#   - verify
#
# The runtime layout is /opt/donordesk/app/ (mutable). Pre-deploy tarballs
# (full app, includes node_modules) are kept at /opt/donordesk/backups/ for
# rollback; last 3 are retained.
#
# Required env:
#   RELEASE_ID                e.g. 20260828170100
#
# Optional env:
#   HOST_ALIAS                ssh alias (default: contabo)
#   BASE                      server base dir (default: /opt/donordesk)
#   SCOPE                     web|api|both|auto (default: auto — derived from
#                             git diff against the previous deploy commit
#                             recorded in app/release.json)
#   SKIP_BUILD=1              reuse already-built artifacts (CI mode)
#   SKIP_TYPECHECK=1          skip pnpm typecheck (for tight loops)
#   NO_BACKUP=1               skip the on-server pre-deploy tar
#
# Usage:
#   scripts/deploy-fast.sh                          # auto-detect scope
#   scripts/deploy-fast.sh SCOPE=web                # explicit
#   RELEASE_ID=$(date -u +%Y%m%d%H%M%S) scripts/deploy-fast.sh
#
# On verify failure, the script does NOT auto-rollback (auto-rollback from a
# broken snapshot made things worse in testing). Instead, the operator can:
#   ssh contabo "ls -1t /opt/donordesk/backups/dd-app-pre-*.tgz | head -1" \
#     | xargs -I{} ssh contabo "rm -rf /opt/donordesk/app && tar -xzf {} \
#         -C /opt/donordesk && systemctl restart donordesk-api donordesk-web"
set -euo pipefail

HOST_ALIAS="${HOST_ALIAS:-contabo}"
BASE="${BASE:-/opt/donordesk}"
RELEASE_ID="${RELEASE_ID:?RELEASE_ID required (e.g. 20260828170100)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! "${RELEASE_ID}" =~ ^[0-9]{14}$ ]]; then
  echo "Error: RELEASE_ID must be exactly 14 digits (UTC timestamp)" >&2
  exit 1
fi

SCOPE="${SCOPE:-auto}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_TYPECHECK="${SKIP_TYPECHECK:-0}"
NO_BACKUP="${NO_BACKUP:-0}"

WORK="/tmp/dd-deploy-${RELEASE_ID}"
SSH="ssh -o ConnectTimeout=10 ${HOST_ALIAS}"
SCPTGT="${HOST_ALIAS}:"
REMOTE_APP="${BASE}/app"
REMOTE_BACKUPS="${BASE}/backups"

echo "==> Release: ${RELEASE_ID}  scope=${SCOPE}  host=${HOST_ALIAS}"

# --- 0. Detect scope from git diff if auto ---------------------------------
if [[ "${SCOPE}" == "auto" ]]; then
  PREV_COMMIT="$(${SSH} "cat ${REMOTE_APP}/release.json 2>/dev/null | sed -n 's/.*\"commit\":\"\([0-9a-f]*\)\".*/\1/p'")"
  # Compare working tree (incl. staged + unstaged) against the previous
  # release commit. If prev_commit is missing or invalid, fall back to HEAD.
  DIFF_RANGE="${PREV_COMMIT:-HEAD}"
  # git diff <commit> (no HEAD) shows working-tree-vs-commit, which covers
  # both unstaged and staged changes. This is what we want for dev deploys.
  CHANGED="$(git -C "${ROOT}" diff --name-only "${DIFF_RANGE}" 2>/dev/null || true)"
  # Also include changes between HEAD and prev if both exist (committed-but-
  # not-deployed diff). This catches the case where the working tree is clean
  # but HEAD has moved past the deployed commit.
  if [[ -n "${PREV_COMMIT}" ]]; then
    COMMITTED_DIFF="$(git -C "${ROOT}" diff --name-only "${PREV_COMMIT}" HEAD 2>/dev/null || true)"
    CHANGED="$(printf '%s\n%s' "${CHANGED}" "${COMMITTED_DIFF}" | sort -u | grep -v '^$' || true)"
  fi
  API_TOUCHED=$(echo "${CHANGED}" | grep -E '^(apps/api|apps/workers|apps/superadmin|packages/infrastructure|packages/application|prisma/|packages/contracts|packages/domain)' || true)
  WEB_TOUCHED=$(echo "${CHANGED}" | grep -E '^apps/web/' || true)
  if   [[ -n "${API_TOUCHED}" && -n "${WEB_TOUCHED}" ]]; then SCOPE="both"
  elif [[ -n "${API_TOUCHED}" ]]; then SCOPE="api"
  elif [[ -n "${WEB_TOUCHED}" ]]; then SCOPE="web"
  else
    echo "Error: no relevant changes since ${DIFF_RANGE}." >&2
    echo "Changed files:" >&2; echo "${CHANGED}" | head >&2
    exit 1
  fi
  echo "    auto-detected scope=${SCOPE}"
fi

# --- 1. Local build ----------------------------------------------------------
BUILD_START=$(date +%s)
mkdir -p "${WORK}"

if [[ "${SKIP_BUILD}" != "1" ]]; then
  echo "==> Local typecheck"
  if [[ "${SKIP_TYPECHECK}" != "1" ]]; then
    (cd "${ROOT}" && pnpm -r typecheck) >"${WORK}/typecheck.log" 2>&1 || {
      echo "ERROR: typecheck failed — see ${WORK}/typecheck.log" >&2
      tail -30 "${WORK}/typecheck.log" >&2
      exit 1
    }
  fi

  case "${SCOPE}" in
    web)
      echo "==> Local build (web only)"
      (cd "${ROOT}" && pnpm --filter @donordesk/contracts --filter @donordesk/domain --filter @donordesk/web build) >"${WORK}/build.log" 2>&1 || {
        echo "ERROR: web build failed — see ${WORK}/build.log" >&2
        tail -40 "${WORK}/build.log" >&2
        exit 1
      }
      ;;
    api)
      echo "==> Local build (api only)"
      (cd "${ROOT}" && pnpm --filter @donordesk/contracts --filter @donordesk/domain --filter @donordesk/application --filter @donordesk/infrastructure --filter @donordesk/api build) >"${WORK}/build.log" 2>&1 || {
        echo "ERROR: api build failed — see ${WORK}/build.log" >&2
        tail -40 "${WORK}/build.log" >&2
        exit 1
      }
      ;;
    both)
      echo "==> Local build (full)"
      (cd "${ROOT}" && pnpm -r build) >"${WORK}/build.log" 2>&1 || {
        echo "ERROR: full build failed — see ${WORK}/build.log" >&2
        tail -40 "${WORK}/build.log" >&2
        exit 1
      }
      ;;
    *)
      echo "Error: SCOPE must be web|api|both|auto (got: ${SCOPE})" >&2
      exit 1
      ;;
  esac
fi
echo "    build: $(($(date +%s)-BUILD_START))s"

# --- 2. Stage artifacts locally ---------------------------------------------
STAGE_START=$(date +%s)
WEB_TAR="${WORK}/web-${RELEASE_ID}.tgz"
API_TAR="${WORK}/api-${RELEASE_ID}.tgz"

if [[ "${SCOPE}" == "web" || "${SCOPE}" == "both" ]]; then
  echo "==> Stage web artifact"
  if [[ ! -d "${ROOT}/apps/web/.next/standalone/apps/web" ]]; then
    echo "ERROR: ${ROOT}/apps/web/.next/standalone/apps/web missing — did next build run?" >&2
    exit 1
  fi
  # Build the deploy tree the way Next.js standalone expects it at runtime.
  # server.js chdir's to its own dir and resolves distDir="./.next" relative
  # to cwd, so static MUST live inside .next/standalone/apps/web/.next/.
  #
  # Standalone bundles node_modules as symlinks (apps/web/node_modules/next
  # -> ../../../node_modules/.pnpm/...). The pnpm store lives at the
  # standalone's top-level node_modules/.pnpm/, so we ship the WHOLE
  # .next/standalone tree (incl. top-level node_modules) — minus build caches.
  # We then MERGE .next/static/ and public/ INSIDE standalone's .next/ so
  # Next.js finds them at runtime.
  WEB_STAGE="${WORK}/web-stage"
  rm -rf "${WEB_STAGE}"
  mkdir -p "${WEB_STAGE}/.next/standalone"
  # Copy the whole standalone tree (top-level node_modules/.pnpm + apps/ + memorybank/ + packages/)
  rsync -a \
      "${ROOT}/apps/web/.next/standalone/" \
      "${WEB_STAGE}/.next/standalone/"
  # Merge static + public INSIDE standalone's .next/ so server.js finds them
  rsync -a --delete "${ROOT}/apps/web/.next/static/" \
      "${WEB_STAGE}/.next/standalone/apps/web/.next/static/"
  if [[ -d "${ROOT}/apps/web/public" ]]; then
    rsync -a --delete "${ROOT}/apps/web/public/" \
        "${WEB_STAGE}/.next/standalone/apps/web/public/"
  fi
  # Tar the staged tree; top-level entries are .next/... so extract into
  # apps/web/ lands them at apps/web/.next/standalone/... correctly.
  tar -C "${WEB_STAGE}" -czf "${WEB_TAR}" .
  echo "    web tar: $(du -h "${WEB_TAR}" | cut -f1)  (standalone + .pnpm + static + public)"
fi

if [[ "${SCOPE}" == "api" || "${SCOPE}" == "both" ]]; then
  echo "==> Stage api artifact"
  if [[ ! -d "${ROOT}/apps/api/dist" ]]; then
    echo "ERROR: ${ROOT}/apps/api/dist missing — did api build run?" >&2
    exit 1
  fi
  # Ship dist/ + package.json + tsconfig.json + node_modules/.
  # node_modules/ changes only on dep bumps; including it keeps the api
  # self-contained so the tar IS the full api.
  (cd "${ROOT}/apps/api" && \
   tar --exclude='node_modules/.cache' \
       -czf "${API_TAR}" \
       dist package.json tsconfig.json node_modules)
  echo "    api tar: $(du -h "${API_TAR}" | cut -f1)"
fi
echo "    stage: $(($(date +%s)-STAGE_START))s"

# --- 3. Snapshot previous deploy (full app, includes node_modules) ----------
SNAPSHOT_START=$(date +%s)
if [[ "${NO_BACKUP}" != "1" ]]; then
  echo "==> Snapshot previous deploy on host (rotate, keep last 3)"
  ${SSH} "
    set -eu
    if [[ ! -d ${REMOTE_BACKUPS} ]]; then mkdir -p ${REMOTE_BACKUPS}; fi
    # delete > 3 (keep newest 3 backups)
    ls -1t ${REMOTE_BACKUPS}/dd-app-pre-*.tgz 2>/dev/null | tail -n +4 | xargs -r rm -f
    # Snapshot current app — include everything needed to recover (node_modules,
    # standalone, dist). Exclude only build caches and runtime storage.
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

# --- 4. Stream-extract into /opt/donordesk/app/ -----------------------------
XFER_START=$(date +%s)
if [[ "${SCOPE}" == "web" || "${SCOPE}" == "both" ]]; then
  echo "==> Stream web artifact -> ${REMOTE_APP}/apps/web/"
  cat "${WEB_TAR}" | ${SSH} "
    set -eu
    cd ${REMOTE_APP}/apps/web
    # Remove only what we're replacing; leave apps/web/node_modules/ etc. alone.
    rm -rf .next
    tar -xzf - -C ${REMOTE_APP}/apps/web
    chown -R donordesk:donordesk ${REMOTE_APP}/apps/web
  "
fi

if [[ "${SCOPE}" == "api" || "${SCOPE}" == "both" ]]; then
  echo "==> Stream api artifact -> ${REMOTE_APP}/"
  cat "${API_TAR}" | ${SSH} "
    set -eu
    cd ${REMOTE_APP}
    # Remove old api artifacts before extracting new ones.
    rm -rf dist
    # Keep apps/api/node_modules around until the tar overwrites it.
    tar -xzf - -C ${REMOTE_APP}
    chown -R donordesk:donordesk ${REMOTE_APP}/dist ${REMOTE_APP}/apps/api
  "
fi
echo "    xfer+extract: $(($(date +%s)-XFER_START))s"

# --- 5. Write release.json, restart, verify ---------------------------------
ACTIVATE_START=$(date +%s)

# Write release.json on host with new metadata
HEAD_COMMIT="$(git -C "${ROOT}" rev-parse HEAD 2>/dev/null || echo unknown)"
cat > "${WORK}/release.json" <<EOF
{"releaseId":"${RELEASE_ID}","commit":"${HEAD_COMMIT}","builtAt":"$(date -u +%FT%TZ)","scope":"${SCOPE}"}
EOF
scp -q "${WORK}/release.json" ${SCPTGT}${REMOTE_APP}/release.json

# Determine which services to restart
case "${SCOPE}" in
  web)  SERVICES="donordesk-web" ;;
  api)  SERVICES="donordesk-api" ;;
  both) SERVICES="donordesk-api donordesk-web" ;;
esac

echo "==> Restart ${SERVICES}"
${SSH} "systemctl restart ${SERVICES}"

echo "==> Verify (waiting up to 60s for web to be ready)"
ready=0
api_ok=0; web_ok=0
need_api=0; need_web=0
[[ "${SCOPE}" == "api"  || "${SCOPE}" == "both" ]] && need_api=1
[[ "${SCOPE}" == "web"  || "${SCOPE}" == "both" ]] && need_web=1
for attempt in $(seq 1 60); do
  api_ok=0; web_ok=0
  if [[ "${need_api}" == "1" ]]; then
    if ${SSH} "curl -fsS http://127.0.0.1:4001/health >/dev/null 2>&1 && curl -fsS http://127.0.0.1:4001/ready >/dev/null 2>&1"; then
      api_ok=1
    fi
  else
    api_ok=1   # not needed for this scope
  fi
  if [[ "${need_web}" == "1" ]]; then
    if ${SSH} "curl -fsS http://127.0.0.1:3002/login >/dev/null 2>&1"; then
      web_ok=1
    fi
  else
    web_ok=1
  fi
  if (( api_ok == 1 && web_ok == 1 )); then
    ready=1
    break
  fi
  sleep 1
done

if [[ "${ready}" != "1" ]]; then
  echo "ERROR: verification failed after 60s" >&2
  echo "  api_ok=$api_ok  web_ok=$web_ok  (need api=$need_api web=$need_web)" >&2
  echo "  To rollback manually:" >&2
  echo "    ssh ${HOST_ALIAS} 'rm -rf ${REMOTE_APP} && tar -xzf \$(ls -1t ${REMOTE_BACKUPS}/dd-app-pre-*.tgz | head -1) -C ${BASE} && systemctl restart donordesk-api donordesk-web'" >&2
  echo "  Web logs:  ssh ${HOST_ALIAS} journalctl -u donordesk-web -n 30" >&2
  echo "  API logs:  ssh ${HOST_ALIAS} journalctl -u donordesk-api -n 30" >&2
  exit 2
fi

${SSH} "systemctl is-active ${SERVICES}"
echo "    activate+verify: $(($(date +%s)-ACTIVATE_START))s"

# --- 6. Cleanup local stage -------------------------------------------------
rm -rf "${WORK}"

echo
echo "Deployed ${RELEASE_ID} (scope=${SCOPE}, commit=${HEAD_COMMIT:0:9}) in $(( $(date +%s)-BUILD_START ))s total."
echo "Pre-deploy backup: \$(ls -1t ${REMOTE_BACKUPS}/dd-app-pre-*.tgz | head -1)  (extract to rollback)"