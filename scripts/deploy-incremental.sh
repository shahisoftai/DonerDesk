#!/usr/bin/env bash
# Incremental immutable deployment for frequent DonorDesk releases.
#
# The current release is hard-linked into a staging directory on Contabo, then
# rsync transfers only file deltas. rsync replaces changed files atomically, so
# older immutable releases remain unchanged. SuperAdmin is preserved until its
# packaging is folded into package-release.sh.
set -euo pipefail

RELEASE_ID="${RELEASE_ID:?RELEASE_ID required (e.g. 20260814120000)}"
RELEASE_DIR="${RELEASE_DIR:?RELEASE_DIR required (assembled release directory)}"
HOST_ALIAS="${HOST_ALIAS:-contabo}"
BASE="${BASE:-/opt/donordesk}"
SERVICES="${SERVICES:-donordesk-api donordesk-web}"
STAGING="${BASE}/releases/${RELEASE_ID}.staging"
FINAL="${BASE}/releases/${RELEASE_ID}"

if [[ ! "${RELEASE_ID}" =~ ^[0-9]{14}$ ]]; then
  echo "Error: RELEASE_ID must be exactly 14 digits (UTC timestamp)" >&2
  exit 1
fi

if [[ ! -d "${RELEASE_DIR}" ]]; then
  echo "Error: release directory does not exist: ${RELEASE_DIR}" >&2
  exit 1
fi

VALIDATED_SERVICES=""
for service in ${SERVICES}; do
  case "${service}" in
    donordesk-api|donordesk-web|donordesk-superadmin)
      VALIDATED_SERVICES+=" ${service}"
      ;;
    *)
      echo "Error: unsupported service: ${service}" >&2
      exit 1
      ;;
  esac
done
SERVICES="${VALIDATED_SERVICES# }"
test -n "${SERVICES}"
PREVIOUS="$(ssh "${HOST_ALIAS}" "readlink -f '${BASE}/current'")"

echo "==> Preparing hard-linked staging release from current"
ssh "${HOST_ALIAS}" "
  set -eu
  test ! -e '${FINAL}'
  rm -rf '${STAGING}'
  mkdir -p '${STAGING}'
  cp -al '${BASE}/current/.' '${STAGING}/'
"

cleanup() {
  ssh "${HOST_ALIAS}" "rm -rf '${STAGING}'" >/dev/null 2>&1 || true
}
trap cleanup ERR INT TERM

echo "==> Transferring changed files only"
rsync -a --checksum --delete \
  --exclude='/superadmin/' \
  --info=stats2 \
  "${RELEASE_DIR}/" "${HOST_ALIAS}:${STAGING}/"

echo "==> Activating ${RELEASE_ID} and restarting: ${SERVICES}"
ssh "${HOST_ALIAS}" "
  set -eu
  test -f '${STAGING}/release.json'
  chown -R donordesk:donordesk '${STAGING}'
  mv '${STAGING}' '${FINAL}'
  ln -sfn '${FINAL}' '${BASE}/current'
  systemctl restart ${SERVICES}
"
trap - ERR INT TERM

echo "==> Verifying production"
if ! ssh "${HOST_ALIAS}" "
  set -eu
  ready=0
  for attempt in \$(seq 1 30); do
    if curl -fsS http://127.0.0.1:4001/health >/dev/null 2>&1 &&
       curl -fsS http://127.0.0.1:4001/ready >/dev/null 2>&1 &&
       curl -fsS http://127.0.0.1:3002/login >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 1
  done
  test \"\${ready}\" = 1
  systemctl is-active ${SERVICES}
  readlink -f '${BASE}/current'
"; then
  echo "ERROR: verification failed; rolling back to ${PREVIOUS}" >&2
  ssh "${HOST_ALIAS}" "
    set -eu
    ln -sfn '${PREVIOUS}' '${BASE}/current'
    systemctl restart ${SERVICES}
  "
  exit 1
fi

echo "Deployed ${RELEASE_ID} with incremental transfer."
