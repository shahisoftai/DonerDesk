#!/usr/bin/env bash
# Ships the map basemap (apps/web/public/tiles: the PMTiles regions and the label fonts, ~1.7 GB, built with `pmtiles extract`; see
# memorybank/imp/phase41-interactive-maps.md §5.5) to the shared folder nginx serves at /tiles/. They are not part of a release (deploy-fast.sh leaves
# them out): rsync only sends what changed. One-time host setup: infra/nginx/donordesk.online.nginx.ssl.conf_tiles (see the comment in that file).
#   scripts/sync-tiles.sh            # sync
#   DRY_RUN=1 scripts/sync-tiles.sh  # list what would change, and check the disk
# It refuses to send anything if the host's disk would go above MAX_DISK_PERCENT (default 85) once the new files are there.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${ROOT}/apps/web/public/tiles/"
DEST="/opt/donordesk/shared/tiles/"
SSH_OPTS="${SSH_OPTS:--o ConnectTimeout=20 -o ConnectionAttempts=5 -o ServerAliveInterval=15 -o ServerAliveCountMax=8}"
MAX_DISK_PERCENT="${MAX_DISK_PERCENT:-85}"

[[ -d "${SRC}fonts" ]] || { echo "No fonts in ${SRC}: the label fonts are needed (apps/web/public/tiles/fonts)." >&2; exit 1; }
compgen -G "${SRC}basemap-*.pmtiles" >/dev/null || { echo "No basemap-*.pmtiles in ${SRC}: build the basemap first." >&2; exit 1; }
[[ -n "$(find "${SRC}" -name '*.partial' -o -name '*.tmp' | head -1)" ]] && { echo "A basemap download is still in progress (a .partial or .tmp file exists in ${SRC}). Wait for it to finish." >&2; exit 1; }

# What is new, in kilobytes, and the host's disk: refuse before sending, not after.
NEW_KB="$(rsync -a --dry-run --stats --no-owner --no-group -e "ssh ${SSH_OPTS}" "${SRC}" "contabo:${DEST}" 2>/dev/null | awk -F': ' '/Total transferred file size/ {gsub(/[^0-9]/,"",$2); print int($2/1024)}')"
NEW_KB="${NEW_KB:-0}"
read -r TOTAL_KB USED_KB < <(ssh ${SSH_OPTS} contabo "df -k --output=size,used / | tail -1")
AFTER_PCT=$(( (USED_KB + NEW_KB) * 100 / TOTAL_KB ))
echo "Host disk: $(( USED_KB * 100 / TOTAL_KB ))% used; this sync adds about $(( NEW_KB / 1024 )) MB, so about ${AFTER_PCT}% after."
if (( AFTER_PCT > MAX_DISK_PERCENT )); then echo "Refusing: that is above ${MAX_DISK_PERCENT}%. Free space on the host first (or raise MAX_DISK_PERCENT knowingly)." >&2; exit 1; fi

FLAGS=(-a --no-owner --no-group --exclude='*.partial' --exclude='*.tmp')
[[ "${DRY_RUN:-0}" == "1" ]] && { FLAGS+=(--dry-run --itemize-changes); }
[[ "${DRY_RUN:-0}" == "1" ]] || ssh ${SSH_OPTS} contabo "mkdir -p ${DEST}"
# The fonts first (small), then the basemap files: a reader never meets a style whose fonts are not there. A file is written under a temporary
# name and renamed when whole (rsync's default), so nginx never serves half a basemap.
rsync "${FLAGS[@]}" --delete --include='fonts/***' --exclude='*' -e "ssh ${SSH_OPTS}" "${SRC}" "contabo:${DEST}"
rsync "${FLAGS[@]}" --include='basemap-*.pmtiles' --exclude='*' --partial-dir=.rsync-partial -e "ssh ${SSH_OPTS}" "${SRC}" "contabo:${DEST}"
[[ "${DRY_RUN:-0}" == "1" ]] || ssh ${SSH_OPTS} contabo "chown -R donordesk:donordesk ${DEST} && echo synced: \$(du -sh ${DEST} | cut -f1)"
