#!/usr/bin/env bash
# Gated (Phase E): atomic DonorDesk release on Contabo (deployment doc §16).
#
# This performs the atomic-release core: extract a self-contained tarball into
# an immutable release directory and switch the `current` symlink, then restart
# the systemd services. It does NOT run migrations/RLS or smoke tests — those
# steps in §16 are separate and must be executed by the operator with the
# migrator/admin credentials before/after this switch.
set -euo pipefail

RELEASE_ID="${RELEASE_ID:?RELEASE_ID required (e.g. 20260813000000)}"
TARBALL="${TARBALL:?TARBALL path to the self-contained release tarball}"
BASE="${BASE:-/opt/donordesk}"
STAGING="${BASE}/releases/${RELEASE_ID}.staging"
FINAL="${BASE}/releases/${RELEASE_ID}"

if [[ -e "${FINAL}" ]]; then
  echo "Error: release ${RELEASE_ID} already exists (${FINAL})." >&2
  exit 1
fi

rm -rf "${STAGING}"
mkdir -p "${STAGING}"
tar -xzf "${TARBALL}" -C "${STAGING}"
mv "${STAGING}" "${FINAL}"

ln -sfn "${FINAL}" "${BASE}/current"

systemctl restart donordesk-api donordesk-web
systemctl restart donordesk-workers 2>/dev/null || true

echo "Deployed ${RELEASE_ID}; current -> ${FINAL}"
echo "Next: run scripts/verify.sh and the §16 acceptance checks."
