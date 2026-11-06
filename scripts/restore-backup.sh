#!/usr/bin/env bash
# Restores a DonorDesk backup and proves it: the dump is restored into a
# scratch database, the checksums are verified, the tables are counted and the
# result is recorded against the backup run.
#
# A backup that has never been restored is a hypothesis, not a backup. This is
# what turns it into evidence.
#
# Usage:
#   restore-backup.sh <backup-stamp-dir> [--target-db <url>] [--record]
#
#   <backup-stamp-dir>  the stamped directory, e.g. /backup/donordesk/20261020T030000Z
#   --target-db <url>   where to restore it. Defaults to a scratch database on
#                        the same server (a "donordesk_restore_test" database),
#                        so a restore test never touches the live database.
#   --record            update the BackupRun row with the restore result.
set -euo pipefail

STAMP="${1:?usage: restore-backup.sh <backup-stamp-dir> [--target-db <url>] [--record]}"
shift || true

TARGET_DB=""
RECORD=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-db) TARGET_DB="${2:?--target-db needs a url}"; shift 2 ;;
    --record) RECORD=1; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

ENC_KEY="${ENC_KEY:-}"
ALLOW_UNENCRYPTED="${ALLOW_UNENCRYPTED:-0}"
ADMIN_URL="${DONORDESK_DB_ADMIN_URL:?DONORDESK_DB_ADMIN_URL required}"
# Creating the scratch database needs a role with CREATEDB, which the runtime
# and migrator roles deliberately do not have. Point this at a role that may.
SCRATCH_ADMIN_URL="${SCRATCH_DB_ADMIN_URL:-${ADMIN_URL}}"
STORAGE_ROOT="${STORAGE_ROOT:-/opt/donordesk/shared/storage}"

if [[ ! -d "${STAMP}" ]]; then
  echo "No such backup: ${STAMP}" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

echo "Verifying checksums..."
(cd "${STAMP}" && sha256sum --check SHA256SUMS) || {
  echo "Checksum verification FAILED for ${STAMP}" >&2
  exit 1
}

# Decrypt a copy, so the backup on disk stays encrypted.
echo "Preparing the restore..."
for f in "${STAMP}"/*.gpg; do
  [[ -e "${f}" ]] || continue
  if [[ -n "${ENC_KEY}" ]]; then
    gpg --batch --yes --quiet --passphrase "${ENC_KEY}" -o "${WORK}/$(basename "${f}" .gpg)" --decrypt "${f}"
  else
    echo "ENC_KEY is empty, so an encrypted backup cannot be restored." >&2
    exit 1
  fi
done
# Unencrypted backups need no decryption step.
if ! compgen -G "${STAMP}/*.gpg" >/dev/null; then
  if [[ "${ALLOW_UNENCRYPTED}" != "1" ]]; then
    echo "This backup is not encrypted and ALLOW_UNENCRYPTED is not set; refusing." >&2
    exit 1
  fi
  cp "${STAMP}"/* "${WORK}/"
fi

if [[ -z "${TARGET_DB}" ]]; then
  TARGET_DB_NAME="donordesk_restore_test"
  echo "No --target-db given; restoring into the scratch database ${TARGET_DB_NAME}."
  psql "${SCRATCH_ADMIN_URL}" --set ON_ERROR_STOP=1 --quiet -c "DROP DATABASE IF EXISTS ${TARGET_DB_NAME};" >/dev/null
  psql "${SCRATCH_ADMIN_URL}" --set ON_ERROR_STOP=1 --quiet -c "CREATE DATABASE ${TARGET_DB_NAME};" >/dev/null
  TARGET_DB="${SCRATCH_ADMIN_URL%/*}/${TARGET_DB_NAME}"
fi

echo "Restoring the database into ${TARGET_DB}..."
pg_restore --no-owner --dbname "${TARGET_DB}" "${WORK}/donordesk.dump" || {
  echo "pg_restore FAILED" >&2
  exit 1
}

TABLES="$(psql "${TARGET_DB}" --set ON_ERROR_STOP=1 --quiet -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")"
PROJECTS="$(psql "${TARGET_DB}" --set ON_ERROR_STOP=1 --quiet -tAc "SELECT count(*) FROM \"Project\"")"
EVIDENCE="$(psql "${TARGET_DB}" --set ON_ERROR_STOP=1 --quiet -tAc "SELECT count(*) FROM \"EvidenceFile\"")"

echo "Restored: ${TABLES} tables, ${PROJECTS} projects, ${EVIDENCE} evidence files."

STORAGE_OK="SKIPPED"
if [[ -f "${WORK}/storage.tar.gz" ]]; then
  echo "Restoring the evidence storage into a scratch directory and comparing the file count..."
  RESTORED_DIR="${WORK}/storage-restored"
  mkdir -p "${RESTORED_DIR}"
  tar -xzf "${WORK}/storage.tar.gz" -C "${RESTORED_DIR}"
  ORIG_COUNT="$(tar -tzf "${WORK}/storage.tar.gz" | grep -vc '/$' || true)"
  NEW_COUNT="$(find "${RESTORED_DIR}" -type f | wc -l)"
  if [[ "${ORIG_COUNT}" -eq "${NEW_COUNT}" ]]; then
    STORAGE_OK="OK"
    echo "Evidence storage: ${NEW_COUNT} files restored and counted."
  else
    STORAGE_OK="MISMATCH"
    echo "Evidence storage MISMATCH: expected ${ORIG_COUNT} files, found ${NEW_COUNT}." >&2
  fi
fi

RESTORE_TESTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [[ "${RECORD}" == "1" ]]; then
  RUN_ID="$(basename "${STAMP}")"
  echo "Recording the restore test against run ${RUN_ID}..."
  psql "${ADMIN_URL}" --set ON_ERROR_STOP=1 --quiet <<SQL >/dev/null
UPDATE "BackupRun"
   SET "restoreTestedAt" = now(), "restoreStatus" = 'RESTORED'
 WHERE id LIKE '${RUN_ID}%';
SQL
  echo "Recorded."
fi

echo "Restore test finished at ${RESTORE_TESTED_AT} (storage: ${STORAGE_OK})."
