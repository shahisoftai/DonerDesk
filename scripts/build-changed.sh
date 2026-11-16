#!/usr/bin/env bash
# build-changed.sh — build only what changed, locally (the local twin of the stamps in scripts/host-build.sh).
#
# Why: `pnpm -r build` recompiled all four TypeScript packages (~85 s) on every deploy, even a web-only one, which needs only contracts and
# domain. A package is rebuilt when its sources (or the root files every package reads) differ from the stamp written after its last successful
# build, when its output is missing, or when a package it depends on is rebuilt. Stamps are written only after a successful build.
#
# Usage:  SCOPE=api|web|both scripts/build-changed.sh        (called by scripts/deploy-fast.sh; FULL_BUILD=1 rebuilds everything)
# Stamps: node_modules/.cache/dd-build-stamps/<package> (inside node_modules, so git never sees them).
# What counts as a source: every file of the package except build output, caches, tests and (web) the 2 GB of map files that are not part of a build.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "${ROOT}"
SCOPE="${SCOPE:-both}"
STAMPS="${ROOT}/node_modules/.cache/dd-build-stamps"; mkdir -p "${STAMPS}"

declare -A PDIR=([contracts]=packages/contracts [domain]=packages/domain [application]=packages/application [infrastructure]=packages/infrastructure [api]=apps/api [web]=apps/web)
declare -A POUT=([contracts]=packages/contracts/dist [domain]=packages/domain/dist [application]=packages/application/dist [infrastructure]=packages/infrastructure/dist [api]=apps/api/dist/server.js [web]=apps/web/.next/standalone/apps/web/server.js)
# The same dependency sets host-build.sh uses (proven there): the web app needs only contracts and domain.
declare -A PDEPS=([contracts]="" [domain]="" [application]="contracts domain" [infrastructure]="contracts domain application" [api]="contracts domain application infrastructure" [web]="contracts domain")
ORDER="contracts domain application infrastructure api web"
case "${SCOPE}" in
  api) WANT="contracts domain application infrastructure api" ;;
  web) WANT="contracts domain web" ;;
  *)   WANT="${ORDER}" ;;
esac

ROOT_HASH=$(cat package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json 2>/dev/null | sha256sum | cut -c1-64)
src_hash() {
  { echo "${ROOT_HASH}"
    ( cd "$1" && find . \( -name node_modules -o -name dist -o -name .next -o -name .turbo -o -name .cache -o -name coverage -o -name '*.tsbuildinfo' \) -prune \
        -o -path ./test -prune -o -path ./tests -prune -o -path ./public/geo -prune -o -path ./public/tiles -prune \
        -o -type f -print0 | sort -z | xargs -0 -r sha256sum ); } | sha256sum | cut -c1-64
}

declare -A HASH DIRTY
BUILD_SET=()
for p in ${ORDER}; do
  [[ " ${WANT} " == *" ${p} "* ]] || continue
  # A package's fingerprint covers its own sources and its dependencies' fingerprints.
  HASH[$p]=$( { src_hash "${PDIR[$p]}"; for d in ${PDEPS[$p]}; do echo "${HASH[$d]}"; done; } | sha256sum | cut -c1-64)
  dirty=0
  [[ "${FULL_BUILD:-0}" == "1" ]] && dirty=1
  [[ -e "${POUT[$p]}" ]] || dirty=1
  [[ "$(cat "${STAMPS}/${p}" 2>/dev/null)" == "${HASH[$p]}" ]] || dirty=1
  for d in ${PDEPS[$p]}; do [[ "${DIRTY[$d]:-0}" == "1" ]] && dirty=1; done
  DIRTY[$p]=${dirty}
  [[ "${dirty}" == "1" ]] && BUILD_SET+=(--filter "@donordesk/${p}")
done

echo "  [build] to build: $(for p in ${WANT}; do [[ "${DIRTY[$p]}" == "1" ]] && printf '%s ' "$p"; done)"
echo "  [build] unchanged (kept): $(for p in ${WANT}; do [[ "${DIRTY[$p]}" == "0" ]] && printf '%s ' "$p"; done)"
if [[ ${#BUILD_SET[@]} -eq 0 ]]; then
  echo "  [build] nothing changed since the last successful build"
  exit 0
fi

# Same settings the full build used: no type-check inside next build (the deploy has its own step), a capped heap, the low-memory web build.
export DD_SKIP_NEXT_TYPECHECK="${DD_SKIP_NEXT_TYPECHECK:-1}"
export DD_LOW_MEMORY_BUILD="${DD_LOW_MEMORY_BUILD:-1}"
export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=2048"
# pipefail (set above) makes a failed build fail this script; stamps are written only after success.
pnpm -r "${BUILD_SET[@]}" build 2>&1
for p in ${WANT}; do [[ "${DIRTY[$p]}" == "1" ]] && echo "${HASH[$p]}" > "${STAMPS}/${p}"; done
echo "  [build] stamps written"
