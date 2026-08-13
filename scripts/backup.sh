#!/usr/bin/env bash
# Gated (Phase E): encrypted off-host backup of the DonorDesk + Kestra databases
# and evidence storage. Follows contabo-ops §9 and deployment doc §18.
#
# Configure BACKUP_DIR, DONORDESK_DB_ADMIN_URL, STORAGE_ROOT, and an encryption
# passphrase (ENC_KEY) BEFORE enabling in cron. Push the stamped directory
# off-host with separate credentials and record last-success + checksum.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:?BACKUP_DIR required (e.g. /backup/donordesk)}"
DB_ADMIN_URL="${DONORDESK_DB_ADMIN_URL:?DONORDESK_DB_ADMIN_URL required}"
STORAGE_ROOT="${STORAGE_ROOT:-/opt/donordesk/shared/storage}"
ENC_KEY="${ENC_KEY:-}"
DATE="$(date -u +%Y%m%dT%H%M%SZ)"
STAMP="${BACKUP_DIR}/${DATE}"

mkdir -p "${STAMP}"

echo "Dumping DonorDesk database..."
pg_dump "${DB_ADMIN_URL}" --no-owner --format=custom --file "${STAMP}/donordesk.dump"

echo "Dumping Kestra database (best-effort)..."
pg_dump "${DB_ADMIN_URL}" --no-owner --format=custom --file "${STAMP}/kestra.dump" 2>/dev/null \
  || { echo "Kestra database not present; skipping."; rm -f "${STAMP}/kestra.dump"; }

echo "Archiving evidence storage..."
tar -czf "${STAMP}/storage.tar.gz" -C "$(dirname "${STORAGE_ROOT}")" "$(basename "${STORAGE_ROOT}")"

if [[ -n "${ENC_KEY}" ]]; then
  echo "Encrypting..."
  for f in "${STAMP}"/*; do
    gpg --batch --yes --symmetric --passphrase "${ENC_KEY}" -o "${f}.gpg" "${f}"
    rm -f "${f}"
  done
else
  echo "WARNING: ENC_KEY is empty — backup is NOT encrypted. Set it before relying on this." >&2
fi

(cd "${STAMP}" && sha256sum * > SHA256SUMS)
echo "Backup written to ${STAMP}"
echo "Next: rotate old backups (retention policy) and push off-host. Record last-success + checksum, then run a restore test."
