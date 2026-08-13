#!/usr/bin/env bash
# Gated (Phase E): rollback DonorDesk to a known-good release (deployment doc §17).
#
# Verifies the target release exists, atomically repoints `current`, and
# restarts only DonorDesk services. Never touches PM2 applications.
set -euo pipefail

RELEASE_ID="${RELEASE_ID:?RELEASE_ID required (the release to roll back to)}"
BASE="${BASE:-/opt/donordesk}"
TARGET="${BASE}/releases/${RELEASE_ID}"

if [[ ! -d "${TARGET}" ]]; then
  echo "Error: release ${RELEASE_ID} does not exist (${TARGET})." >&2
  exit 1
fi

ln -sfn "${TARGET}" "${BASE}/current"
systemctl restart donordesk-api donordesk-web
systemctl restart donordesk-workers 2>/dev/null || true

echo "Rolled back: current -> ${TARGET}"
echo "Next: run scripts/verify.sh and preserve the failed-release logs for diagnosis."
