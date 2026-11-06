#!/usr/bin/env bash
# host-build.sh — build DonorDesk on the Contabo host instead of this machine (used by `BUILD_ON=host scripts/deploy-fast.sh`).
#
# Why: a full build takes ~12 min on the 4-CPU dev machine and ~3 min on the 6-CPU host (measured 2026-11-03).
# What it does, one step per function, in order:
#   preflight  the host has memory, disk and tools to spare            (exit 3 = refused: the caller may build locally)
#   sync       the files git knows -> <dir>/src (rsync --files-from; node_modules/.next/dist stay on the host, so the next build is incremental)
#   build      install + build + (type-check), in a memory-capped, lowest-priority cgroup so it can never starve production
#   pull       the build outputs back into this checkout, so the rest of deploy-fast.sh (stage, ship, verify) is unchanged
#
# Usage:  SCOPE=web|api|both TYPECHECK=0|1 scripts/host-build.sh run        (or: preflight | sync | build | pull)
# Exit:   0 built and pulled; 3 refused before anything was built (fall back to a local build); anything else = failed.
# Knobs:  HOST_BUILD_DIR (default /var/tmp/dd-hostbuild)   HOST_BUILD_MEM_MB (3000: the build peaked at ~2.6 GB)
#         HOST_BUILD_MARGIN_MB (300)   HOST_BUILD_MIN_DISK_GB (6)   HOST_BUILD_CLEAN=1 (delete the build dir afterwards)
#         SSH (same as deploy-fast.sh)   SSH_HOST (contabo)

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCOPE="${SCOPE:-both}"
TYPECHECK="${TYPECHECK:-0}"
SSH="${SSH:-ssh -o ConnectTimeout=15 -o ServerAliveInterval=30 contabo}"
SSH_HOST="${SSH_HOST:-contabo}"
DIR="${HOST_BUILD_DIR:-/var/tmp/dd-hostbuild}"
SRC="${DIR}/src"
MEM_MB="${HOST_BUILD_MEM_MB:-3000}"
MARGIN_MB="${HOST_BUILD_MARGIN_MB:-300}"
MIN_DISK_GB="${HOST_BUILD_MIN_DISK_GB:-6}"
RSYNC_SSH="ssh -o ConnectTimeout=15 -o ServerAliveInterval=30 -o ServerAliveCountMax=8"
EXIT_REFUSED=3

say() { echo "  [host-build] $*"; }
lap_start=$(date +%s)
lap() { local n; n=$(date +%s); say "$1: $((n - lap_start))s"; lap_start=${n}; }

# --------------------------------------------------------------------------- #
# preflight
# --------------------------------------------------------------------------- #
preflight() {
  local facts mem disk
  if ! facts="$(${SSH} "
    mem=\$(awk '/^MemAvailable/ {print int(\$2/1024)}' /proc/meminfo)
    mkdir -p \$(dirname ${DIR})
    disk=\$(df -BG --output=avail \$(dirname ${DIR}) | tail -1 | tr -dc 0-9)
    tools=1; for t in node corepack systemd-run flock rsync nice ionice; do command -v \$t >/dev/null || tools=0; done
    echo \"mem=\${mem} disk=\${disk} tools=\${tools}\"
  " 2>/dev/null)"; then
    say "the host could not be reached; not building there."
    return ${EXIT_REFUSED}
  fi
  mem="$(sed -n 's/.*mem=\([0-9]*\).*/\1/p' <<<"${facts}")"
  disk="$(sed -n 's/.*disk=\([0-9]*\).*/\1/p' <<<"${facts}")"
  say "host has ${mem:-?} MB memory available, ${disk:-?} GB disk free (needs $((MEM_MB + MARGIN_MB)) MB and ${MIN_DISK_GB} GB)"
  if [[ "${facts}" != *"tools=1"* ]]; then say "the host lacks a tool the build needs (node, corepack, systemd-run, flock, rsync, nice, ionice)."; return ${EXIT_REFUSED}; fi
  if [[ -z "${mem}" || "${mem}" -lt $((MEM_MB + MARGIN_MB)) ]]; then say "not enough free memory on the host: production comes first."; return ${EXIT_REFUSED}; fi
  if [[ -z "${disk}" || "${disk}" -lt "${MIN_DISK_GB}" ]]; then say "not enough free disk on the host."; return ${EXIT_REFUSED}; fi
}

# --------------------------------------------------------------------------- #
# sync — the files git knows (tracked + untracked, minus ignored), exactly as a local build sees them. Git decides, not rsync's .gitignore filter, which
# does not understand git's "!" re-includes (it skipped packages/infrastructure/src/storage/). Files that left the list are removed on the host; node_modules,
# dist, .next and caches stay, so the next build is incremental.
# apps/web/.env.local is gitignored but carries the NEXT_PUBLIC_* settings that are baked into the web bundle, so it is sent too (public client settings only).
# --------------------------------------------------------------------------- #
sync() {
  local list; list="$(mktemp)"
  (
    cd "${ROOT}"
    { git ls-files -co --exclude-standard | grep -v -E '^(Temp/|memorybank/|apps/workers/|apps/web/public/geo/)' || true; echo apps/web/.env.local; } | sort -u \
      | while IFS= read -r f; do [[ -f "$f" ]] && printf '%s\n' "$f"; done
  ) > "${list}"
  ${SSH} "mkdir -p ${SRC} && chmod 700 ${DIR}"
  rsync -a -e "${RSYNC_SSH}" --files-from="${list}" "${ROOT}/" "${SSH_HOST}:${SRC}/"
  rsync -a -e "${RSYNC_SSH}" "${list}" "${SSH_HOST}:${DIR}/want.txt"
  rm -f "${list}"
  local removed
  removed="$(${SSH} "
    cd ${SRC}
    find . \( -name node_modules -o -name dist -o -name .next -o -name .turbo -o -name .cache -o -name coverage -o -name '*.tsbuildinfo' \) -prune -o -type f -print | sed 's#^\./##' | sort > ${DIR}/have.txt
    comm -23 ${DIR}/have.txt <(sort ${DIR}/want.txt) | tee ${DIR}/stale.txt | wc -l
    xargs -r -d '\n' rm -f < ${DIR}/stale.txt
    chmod 600 apps/web/.env.local 2>/dev/null || true
  ")"
  say "source synced (${removed} stale file(s) removed)"
  lap "sync"
}

# --------------------------------------------------------------------------- #
# build — install, optional type-check, build; capped in memory, lowest CPU and disk priority, one at a time.
# --------------------------------------------------------------------------- #
build() {
  ${SSH} "mkdir -p ${DIR} && cat > ${DIR}/run-build.sh" <<'REMOTE'
set -uo pipefail
cd "${SRC}"
export CI=true DD_SKIP_NEXT_TYPECHECK=1 NEXT_TELEMETRY_DISABLED=1 COREPACK_HOME="${DIR}/.corepack" COREPACK_ENABLE_DOWNLOAD_PROMPT=0
PNPM=(corepack pnpm)
T0=$(date +%s); T=${T0}
lap() { local n; n=$(date +%s); echo "  [host] $1: $((n - T))s (total $((n - T0))s)"; T=${n}; }
FILTER=()
case "${SCOPE}" in
  api) FILTER=(--filter '!@donordesk/web' --filter '!@donordesk/superadmin') ;;
  web) FILTER=(--filter '!@donordesk/api' --filter '!@donordesk/superadmin') ;;
  *)   FILTER=(--filter '!@donordesk/superadmin') ;;
esac
"${PNPM[@]}" install --frozen-lockfile --store-dir "${DIR}/.store" > "${DIR}/install.log" 2>&1 || { tail -30 "${DIR}/install.log"; exit 11; }
lap "pnpm install"
"${PNPM[@]}" -r "${FILTER[@]}" build > "${DIR}/build.log" 2>&1 || { tail -40 "${DIR}/build.log"; exit 13; }
lap "build"
# After the build, not before: each package is type-checked against its dependencies' built output, which a fresh host does not have yet.
if [[ "${TYPECHECK}" == "1" ]]; then
  "${PNPM[@]}" -r "${FILTER[@]}" typecheck > "${DIR}/typecheck.log" 2>&1 || { tail -40 "${DIR}/typecheck.log"; exit 12; }
  lap "type-check"
fi
case "${SCOPE}" in api|both) test -f apps/api/dist/server.js || { echo "  [host] apps/api/dist/server.js missing"; exit 14; } ;; esac
case "${SCOPE}" in web|both) test -f apps/web/.next/standalone/apps/web/server.js || { echo "  [host] web standalone output missing"; exit 14; } ;; esac
echo "  [host] peak memory: $(awk '{printf "%.0f MB", $1/1048576}' "/sys/fs/cgroup$(cut -d: -f3 /proc/self/cgroup)/memory.peak" 2>/dev/null || echo unknown)"
REMOTE
  local rc=0
  # -E 75: a second build waiting more than 10 s for the lock gives up with 75 instead of queueing behind the first.
  ${SSH} "flock -w 10 -E 75 ${DIR}/.lock systemd-run --scope --quiet -p MemoryMax=${MEM_MB}M -p MemorySwapMax=0 -p CPUWeight=20 \
      nice -n 19 ionice -c3 env DIR=${DIR} SRC=${SRC} SCOPE=${SCOPE} TYPECHECK=${TYPECHECK} bash ${DIR}/run-build.sh" || rc=$?
  case ${rc} in
    0) ;;
    75) say "another host build is running."; return ${EXIT_REFUSED} ;;
    137|143) say "the build was stopped at the ${MEM_MB} MB memory cap (production is untouched). Raise HOST_BUILD_MEM_MB or use BUILD_ON=local."; return 1 ;;
    *) say "the build failed on the host (exit ${rc}); the output above is the first failure."; return 1 ;;
  esac
  lap "built on the host"
}

# --------------------------------------------------------------------------- #
# pull — only the build outputs the rest of deploy-fast.sh stages from; rsync sends what changed.
# --------------------------------------------------------------------------- #
pull() {
  local p
  for p in contracts domain application infrastructure; do
    mkdir -p "${ROOT}/packages/${p}/dist"
    rsync -a --delete -e "${RSYNC_SSH}" "${SSH_HOST}:${SRC}/packages/${p}/dist/" "${ROOT}/packages/${p}/dist/"
  done
  if [[ "${SCOPE}" == "api" || "${SCOPE}" == "both" ]]; then
    mkdir -p "${ROOT}/apps/api/dist"
    rsync -a --delete -e "${RSYNC_SSH}" "${SSH_HOST}:${SRC}/apps/api/dist/" "${ROOT}/apps/api/dist/"
  fi
  if [[ "${SCOPE}" == "web" || "${SCOPE}" == "both" ]]; then
    mkdir -p "${ROOT}/apps/web/.next/standalone" "${ROOT}/apps/web/.next/static"
    rsync -a --delete -e "${RSYNC_SSH}" "${SSH_HOST}:${SRC}/apps/web/.next/standalone/" "${ROOT}/apps/web/.next/standalone/"
    rsync -a --delete -e "${RSYNC_SSH}" "${SSH_HOST}:${SRC}/apps/web/.next/static/" "${ROOT}/apps/web/.next/static/"
  fi
  lap "outputs pulled back"
}

cleanup() { if [[ "${HOST_BUILD_CLEAN:-0}" == "1" ]]; then ${SSH} "rm -rf ${DIR}" || true; say "build dir removed"; fi; }

case "${1:-run}" in
  preflight) preflight ;;
  sync) sync ;;
  build) build ;;
  pull) pull ;;
  run)
    preflight || exit $?
    sync
    build || { rc=$?; cleanup; exit ${rc}; }
    pull
    cleanup
    ;;
  *) echo "usage: $0 run|preflight|sync|build|pull" >&2; exit 2 ;;
esac
