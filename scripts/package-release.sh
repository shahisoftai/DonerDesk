#!/usr/bin/env bash
# Build a self-contained DonorDesk release tarball off-host (validated 2026-08-14).
#
# Produces a single tarball containing the API (dist + prod node_modules +
# @donordesk/* workspace packages), the Next.js web standalone (with static
# assets), prisma schema/migrations, and the generated Prisma client. The web's
# `next` resolves inside the deployed tree's own .pnpm store — no server-side
# installs and no shared-node_modules fallback.
#
# Usage: RELEASE_ID=20260814120000 scripts/package-release.sh
# Output: /tmp/dd-release-<RELEASE_ID>/ and, by default, a matching tarball.
# Set SKIP_BUILD=1 when a trusted CI step already built the workspace.
# Set CREATE_TARBALL=0 when deploying the directory with deploy-incremental.sh.
set -euo pipefail

RELEASE_ID="${RELEASE_ID:?RELEASE_ID required (e.g. 20260814120000)}"
OUT="${OUT:-/tmp/dd-release-${RELEASE_ID}}"
TARBALL="${TARBALL:-${OUT}.tar.gz}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRISMA_STORE="node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0"
SKIP_BUILD="${SKIP_BUILD:-0}"
CREATE_TARBALL="${CREATE_TARBALL:-1}"

if [[ "${SKIP_BUILD}" != "1" ]]; then
  echo "==> Building all workspace packages"
  pnpm -r build
fi

echo "==> Assembling self-contained release at ${OUT}"
rm -rf "${OUT}"

pnpm --filter @donordesk/api deploy --legacy "${OUT}"
mkdir -p "${OUT}/apps"
pnpm --filter @donordesk/web deploy --legacy "${OUT}/apps/web"

cp -r "${ROOT}/packages/infrastructure/prisma" "${OUT}/prisma"

echo "==> Removing development-only and secret-bearing files"
rm -rf \
  "${OUT}/src" \
  "${OUT}/test" \
  "${OUT}/apps/web/src" \
  "${OUT}/apps/web/tests" \
  "${OUT}/apps/web/.next/cache"
find "${OUT}" -type f \( \
  -name '.env' -o -name '.env.*' -o -name 'dev.db' -o \
  -name '*.tsbuildinfo' \
\) -delete

echo "==> Preserving the systemd server.js contract"
cp "${OUT}/apps/web/.next/standalone/apps/web/server.js" "${OUT}/apps/web/server.js"

echo "==> Prisma runtime fix: generated client + infra dependency symlink"
SRC="${ROOT}/${PRISMA_STORE}/node_modules/.prisma"
DST="${OUT}/${PRISMA_STORE}/node_modules/.prisma"
mkdir -p "${DST}"
cp -r "${SRC}/client" "${DST}/"
mkdir -p "${OUT}/node_modules/@donordesk/infrastructure/node_modules/@prisma"
PRISMA_LINK_DIR="${OUT}/node_modules/@donordesk/infrastructure/node_modules/@prisma"
PRISMA_LINK_TARGET="$(realpath --relative-to="${PRISMA_LINK_DIR}" \
  "${OUT}/${PRISMA_STORE}/node_modules/@prisma/client")"
ln -sfn "${PRISMA_LINK_TARGET}" "${PRISMA_LINK_DIR}/client"

echo "==> Local smoke tests"
(
  cd "${OUT}"
  DATABASE_URL="postgresql://x:x@127.0.0.1:5432/nonexistent" \
    HOST=127.0.0.1 PORT=4099 timeout 12 node dist/server.js \
    >/tmp/dd-pkg-api.log 2>&1 &
  API_PID=$!
  for attempt in 1 2 3 4 5 6; do
    if curl -fsS http://127.0.0.1:4099/health >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if ! curl -fsS http://127.0.0.1:4099/health >/dev/null 2>&1; then
    echo "ERROR: API failed to start — see /tmp/dd-pkg-api.log" >&2
    kill "${API_PID}" 2>/dev/null || true
    exit 1
  fi
  kill "${API_PID}" 2>/dev/null || true
)
(
  cd "${OUT}/apps/web"
  PORT=3099 HOSTNAME=127.0.0.1 node server.js >/tmp/dd-pkg-web.log 2>&1 &
  WEB_PID=$!
  sleep 5
  CSS="$(curl -sS http://127.0.0.1:3099/login | grep -oE '/_next/static/css/[^\"]*\.css' | head -1)"
  if [ -z "${CSS}" ] || ! curl -fsS "http://127.0.0.1:3099${CSS}" >/dev/null 2>&1; then
    echo "ERROR: web failed CSS check — see /tmp/dd-pkg-web.log" >&2
    kill "${WEB_PID}" 2>/dev/null || true
    exit 1
  fi
  kill "${WEB_PID}" 2>/dev/null || true
)

cat >"${OUT}/release.json" <<EOF
{"releaseId":"${RELEASE_ID}","commit":"$(git -C "${ROOT}" rev-parse HEAD)","builtAt":"$(date -u +%FT%TZ)"}
EOF

if find "${OUT}" -type f \( -name '.env' -o -name '.env.*' -o -name 'dev.db' \) \
  -print -quit | grep -q .; then
  echo "ERROR: release contains an environment file or development database" >&2
  exit 1
fi

if [[ "${CREATE_TARBALL}" == "1" ]]; then
  echo "==> Creating tarball ${TARBALL}"
  tar -czf "${TARBALL}" -C "${OUT}" .
  echo "Done: ${TARBALL}"
else
  echo "Done: ${OUT}"
  echo "Next: RELEASE_ID=${RELEASE_ID} RELEASE_DIR=${OUT} scripts/deploy-incremental.sh"
fi
