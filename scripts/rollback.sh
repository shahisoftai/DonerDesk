#!/usr/bin/env bash
# Restores the app tree from a pre-deploy snapshot taken by scripts/deploy-fast.sh (/opt/donordesk/backups/dd-app-pre-<id>.tgz).
#
#   scripts/rollback.sh            list the snapshots on the host
#   scripts/rollback.sh <ID>       restore the tree that was running BEFORE release <ID> was deployed
#
# deploy-fast.sh already does this by itself when its verify step fails; this is for a problem found later. The failed tree
# is kept beside it (app.failed-<ID>) for diagnosis. Database migrations are additive, so the old code runs on the new
# schema; a migration that is not additive needs its own plan (see memorybank/contabo-ops.md §15).
set -euo pipefail

SSH="${SSH:-ssh -o ConnectTimeout=15 contabo}"
REMOTE_BASE="${REMOTE_BASE:-/opt/donordesk}"
REMOTE_BACKUPS="${REMOTE_BACKUPS:-${REMOTE_BASE}/backups}"
RELEASE_ID="${1:-}"

if [[ -z "${RELEASE_ID}" ]]; then
  echo "Snapshots on the host (newest first); pass the id of the release you want to undo:"
  ${SSH} "ls -1t ${REMOTE_BACKUPS}/dd-app-pre-*.tgz 2>/dev/null | sed 's#.*/dd-app-pre-##; s#\.tgz##'"
  exit 0
fi

echo "==> Restoring the tree that ran before release ${RELEASE_ID}"
${SSH} "
  set -eu
  SNAP=${REMOTE_BACKUPS}/dd-app-pre-${RELEASE_ID}.tgz
  [ -f \"\${SNAP}\" ] || { echo \"no snapshot \${SNAP}\"; exit 1; }
  systemctl stop donordesk-api donordesk-web
  rm -rf ${REMOTE_BASE}/app.failed-${RELEASE_ID}
  mv ${REMOTE_BASE}/app ${REMOTE_BASE}/app.failed-${RELEASE_ID}
  tar -xzf \"\${SNAP}\" -C ${REMOTE_BASE}
  systemctl start donordesk-api donordesk-web
  for i in \$(seq 1 30); do
    if curl -fsS --max-time 5 http://127.0.0.1:4001/ready; then echo; echo 'restored; /ready is OK'; exit 0; fi
    sleep 2
  done
  echo '/ready did not come up: journalctl -u donordesk-api'; exit 1
"
echo "Next: scripts/verify.sh, and keep ${REMOTE_BASE}/app.failed-${RELEASE_ID} until the cause is understood."
