#!/usr/bin/env bash
# Cuts basemap files from the Protomaps planet build with `pmtiles extract` (byte ranges over HTTP: only the needed tiles are downloaded).
#   scripts/maps/extract-basemap.sh            # every region in basemap-regions.json, plus the world file
#   scripts/maps/extract-basemap.sh mena world # only these
# Needs the go-pmtiles CLI (https://github.com/protomaps/go-pmtiles/releases) on PATH. Writes to apps/web/public/tiles/<file>, through a .tmp
# name renamed when whole (sync-tiles.sh refuses while a .tmp exists). Resumable: a finished file is skipped unless FORCE=1.
# BUILD (YYYYMMDD) picks the planet build; it must match "build" in basemap-regions.json and `built` in regions.ts.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONF="${ROOT}/scripts/maps/basemap-regions.json"
OUT="${ROOT}/apps/web/public/tiles"
BUILD="${BUILD:-$(node -p "require('${CONF}').build")}"
SOURCE="${SOURCE:-https://build.protomaps.com/${BUILD}.pmtiles}"
command -v pmtiles >/dev/null || { echo "pmtiles CLI not found: install go-pmtiles first." >&2; exit 1; }
mkdir -p "${OUT}"
WANT=("$@")
mapfile -t ROWS < <(node -e '
  const c = require(process.argv[1]); const want = process.argv.slice(2);
  for (const r of [c.world, ...c.regions]) if (want.length === 0 || want.includes(r.id)) console.log([r.id, r.file, r.bbox.join(","), r.maxzoom].join(" "));
' "${CONF}" "${WANT[@]}")
for row in "${ROWS[@]}"; do
  read -r id file bbox maxzoom <<<"${row}"
  if [[ -f "${OUT}/${file}" && "${FORCE:-0}" != "1" ]]; then echo "skip ${id}: ${file} exists"; continue; fi
  echo "extract ${id} (${bbox}, z0-${maxzoom}) from ${SOURCE}"
  pmtiles extract "${SOURCE}" "${OUT}/${file}.tmp" --bbox="${bbox}" --maxzoom="${maxzoom}" --download-threads=4
  mv "${OUT}/${file}.tmp" "${OUT}/${file}"
  ls -lh "${OUT}/${file}"
done
