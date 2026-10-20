#!/usr/bin/env bash
# Encrypted off-host backup of the DonorDesk + Kestra databases and evidence
# storage. Follows contabo-ops §9 and the DR runbook.
#
# Configure BACKUP_DIR, DONORDESK_DB_ADMIN_URL, STORAGE_ROOT and ENC_KEY before
# enabling. `donordesk-backup.timer` runs this daily; see
# memorybank/docs/runbooks/DISASTER-RECOVERY.md.
#
# The backup is encrypted unless ALLOW_UNENCRYPTED=1 is set explicitly: an
# unencrypted dump of a humanitarian programme's records must never be the
# quiet default.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:?BACKUP_DIR required (e.g. /backup/donordesk)}"
DB_ADMIN_URL="${DONORDESK_DB_ADMIN_URL:?DONORDESK_DB_ADMIN_URL required}"
STORAGE_ROOT="${STORAGE_ROOT:-/opt/donordesk/shared/storage}"
ENC_KEY="${ENC_KEY:-}"
ALLOW_UNENCRYPTED="${ALLOW_UNENCRYPTED:-0}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
MIN_KEEP="${BACKUP_MIN_KEEP:-7}"
OFFHOST_TARGET="${OFFHOST_TARGET:-}"
CONFIGURATION_ID="${BACKUP_CONFIGURATION_ID:-donordesk-off-host-backup}"
DATE="$(date -u +%Y%m%dT%H%M%SZ)"
STAMP="${BACKUP_DIR}/${DATE}"
RUN_ID="${DATE}-$$"
LAST_SUCCESS_FILE="${BACKUP_DIR}/.last-success"

if [[ -z "${ENC_KEY}" && "${ALLOW_UNENCRYPTED}" != "1" ]]; then
  echo "ENC_KEY is empty. Refusing to write an unencrypted backup." >&2
  echo "Set ENC_KEY, or set ALLOW_UNENCRYPTED=1 if you understand the risk." >&2
  exit 1
fi

mkdir -p "${STAMP}"

record_run() {
  # status, checksum, size, error message
  local status="$1" checksum="$2" size="$3" message="$4"
  local escaped
  escaped="$(printf '%s' "${message}" | sed "s/'/''/g")"
  psql "${DB_ADMIN_URL}" --set ON_ERROR_STOP=1 --quiet <<SQL >/dev/null || echo "WARNING: could not record the backup run." >&2
INSERT INTO "BackupRun" (id, "configurationId", status, destination, "startedAt", "completedAt", "sizeBytes", checksum, "errorMessage")
VALUES ('${RUN_ID}', '${CONFIGURATION_ID}', '${status}', '${BACKUP_DIR}', now(), now(), ${size}, '${checksum}', '${escaped}');
SQL
}

cleanup_failed() {
  local message="$1"
  echo "Backup failed: ${message}" >&2
  record_run "FAILED" "" 0 "${message}"
  rm -rf "${STAMP}"
  exit 1
}

echo "Dumping DonorDesk database..."
pg_dump "${DB_ADMIN_URL}" --no-owner --format=custom --file "${STAMP}/donordesk.dump" \
  || cleanup_failed "pg_dump of the DonorDesk database failed"

echo "Dumping Kestra database (best-effort)..."
pg_dump "${DB_ADMIN_URL}" --no-owner --format=custom --file "${STAMP}/kestra.dump" 2>/dev/null \
  || { echo "Kestra database not present; skipping."; rm -f "${STAMP}/kestra.dump"; }

echo "Archiving evidence storage..."
tar -czf "${STAMP}/storage.tar.gz" -C "$(dirname "${STORAGE_ROOT}")" "$(basename "${STORAGE_ROOT}")" \
  || cleanup_failed "archiving the evidence storage failed"

if [[ -n "${ENC_KEY}" ]]; then
  echo "Encrypting..."
  for f in "${STAMP}"/*; do
    gpg --batch --yes --symmetric --passphrase "${ENC_KEY}" -o "${f}.gpg" "${f}" \
      || cleanup_failed "encryption failed for $(basename "${f}")"
    rm -f "${f}"
  done
else
  echo "WARNING: writing an UNENCRYPTED backup because ALLOW_UNENCRYPTED=1." >&2
fi

(cd "${STAMP}" && sha256sum * > SHA256SUMS) || cleanup_failed "checksums failed"

SIZE_BYTES="$(du -sb "${STAMP}" | cut -f1)"
CHECKSUM="$(sha256sum "${STAMP}/SHA256SUMS" | cut -d' ' -f1)"

echo "Rotating backups older than ${RETENTION_DAYS} days (keeping at least ${MIN_KEEP})..."
# Only whole stamped directories are removed, and never fewer than MIN_KEEP.
while IFS= read -r old; do
  keep_count="$(find "${BACKUP_DIR}" -maxdepth 1 -mindepth 1 -type d -name '20*' | wc -l)"
  if [[ "${keep_count}" -le "${MIN_KEEP}" ]]; then
    echo "Keeping ${keep_count} backups; nothing more to rotate."
    break
  fi
  echo "  removing ${old}"
  rm -rf "${old}"
done < <(find "${BACKUP_DIR}" -maxdepth 1 -mindepth 1 -type d -name '20*' -mtime "+${RETENTION_DAYS}" | sort)

if [[ -n "${OFFHOST_TARGET}" ]]; then
  echo "Pushing off-host to ${OFFHOST_TARGET}..."
  rsync -az --delete "${STAMP}/" "${OFFHOST_TARGET}/" \
    || cleanup_failed "the off-host push failed"
else
  echo "NOTE: OFFHOST_TARGET is not set; the backup stayed on this host."
fi

date -u +%Y-%m-%dT%H:%M:%SZ > "${LAST_SUCCESS_FILE}"
record_run "SUCCEEDED" "${CHECKSUM}" "${SIZE_BYTES}" ""
echo "Backup written to ${STAMP} (${SIZE_BYTES} bytes, checksum ${CHECKSUM})."
echo "Next: run scripts/restore-backup.sh against it to record a restore test."
