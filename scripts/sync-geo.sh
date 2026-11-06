#!/usr/bin/env bash
# Ships the boundary files (apps/web/public/geo, built by build-admin-boundaries.mjs and build-ocha-boundaries.mjs) to the shared folder
# nginx serves at /geo/. They are not part of a release (deploy-fast.sh leaves them out): rsync only sends what changed, and a deploy
# never has to carry ~100 MB. One-time host setup: infra/nginx/donordesk.online.nginx.ssl.conf_geo (see the comment in that file).
#   scripts/sync-geo.sh            # sync
#   DRY_RUN=1 scripts/sync-geo.sh  # list what would change
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${ROOT}/apps/web/public/geo/"
DEST="/opt/donordesk/shared/geo/"
SSH_OPTS="${SSH_OPTS:--o ConnectTimeout=20 -o ServerAliveInterval=15}"

[[ -f "${SRC}manifest.json" ]] || { echo "No manifest in ${SRC}: build the boundaries first." >&2; exit 1; }
[[ -d "${SRC}.ocha-tmp" ]] && { echo "A boundary download is still in progress (${SRC}.ocha-tmp exists). Wait for it to finish." >&2; exit 1; }

FLAGS=(-a --delete --no-owner --no-group --exclude='.ocha-tmp')
[[ "${DRY_RUN:-0}" == "1" ]] && FLAGS+=(--dry-run --itemize-changes)
ssh ${SSH_OPTS} contabo "mkdir -p ${DEST}"
# The manifest goes last: a reader never sees a manifest that names a file not there yet.
rsync "${FLAGS[@]}" --exclude=manifest.json -e "ssh ${SSH_OPTS}" "${SRC}" "contabo:${DEST}"
rsync "${FLAGS[@]}" --include=manifest.json --exclude='*' -e "ssh ${SSH_OPTS}" "${SRC}" "contabo:${DEST}" || true
[[ "${DRY_RUN:-0}" == "1" ]] || ssh ${SSH_OPTS} contabo "chown -R donordesk:donordesk ${DEST} && echo synced: \$(du -sh ${DEST} | cut -f1)"
