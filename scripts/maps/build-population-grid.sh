#!/usr/bin/env bash
# Builds the population grids the "people within N km" analysis reads (Phase 49.7), one per country, from the WorldPop 100 m rasters that
# build-context-layers.sh downloaded: counts summed to ~1 km cells (30 arc-seconds), Float32 little-endian, -1 = no data.
#   scripts/maps/build-population-grid.sh NGA SDN
# Output: apps/web/public/tiles/context/population-grid/<ISO>.bin + <ISO>.json (shipped by sync-tiles.sh with the context folder).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="${WORK:-${ROOT}/.context-work}"
OUT="${ROOT}/apps/web/public/tiles/context/population-grid"
YEAR="${WORLDPOP_YEAR:-2020}"
CELL="0.008333333333"
command -v gdalwarp >/dev/null || { echo "missing: gdalwarp" >&2; exit 1; }
mkdir -p "${OUT}"
for iso in "$@"; do
  lower="$(echo "${iso}" | tr '[:upper:]' '[:lower:]')"
  tif="${WORK}/${lower}_ppp_${YEAR}.tif"
  [[ -f "${tif}" ]] || { echo "skip ${iso}: ${tif} missing (run build-context-layers.sh ${iso} first)"; continue; }
  gdalwarp -overwrite -r sum -tr "${CELL}" "${CELL}" -tap -dstnodata -1 -ot Float32 -of ENVI "${tif}" "${OUT}/${iso}.bin"
  node -e '
    const fs = require("fs"); const [hdr, out, iso, year] = process.argv.slice(1);
    const t = fs.readFileSync(hdr, "utf8"); const num = (k) => Number(new RegExp(k + "\\s*=\\s*([\\d.]+)").exec(t)[1]);
    const info = /map info\s*=\s*\{([^}]*)\}/.exec(t)[1].split(",").map((s) => s.trim());
    const header = { west: Number(info[3]), north: Number(info[4]), cellDeg: Number(info[5]), cols: num("samples"), rows: num("lines"), source: "WorldPop (University of Southampton), CC BY 4.0", year };
    fs.writeFileSync(out, JSON.stringify(header)); console.log(iso, header.cols + "x" + header.rows);
  ' "${OUT}/${iso}.hdr" "${OUT}/${iso}.json" "${iso}" "${YEAR}"
  rm -f "${OUT}/${iso}.hdr" "${OUT}/${iso}.bin.aux.xml"
done
