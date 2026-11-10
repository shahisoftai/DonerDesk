#!/usr/bin/env bash
# Builds the self-hosted context layers (Phase 49.6) into apps/web/public/tiles/context/:
#   population.pmtiles         WorldPop 100 m population counts (CC BY 4.0) for the given countries, as a coloured raster
#   health-facilities.pmtiles  healthsites.io facilities (ODbL: share-alike, credited, derived copy offered) as points, layer "facilities"
#   settlements.pmtiles        OCHA populated places (CC BY-IGO) as points, layer "settlements"
#   scripts/maps/build-context-layers.sh NGA SDN ETH        # the ISO3 codes of countries with live projects
# Needs: curl, gdal (gdal_translate, gdalbuildvrt, gdaldem, gdal2tiles.py or rio-pmtiles), ogr2ogr, tippecanoe, pmtiles. Downloads into
# a work folder that is kept (resumable). Nothing here is project data; every file is credited on /maps/sources (CONTEXT_LAYERS).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${ROOT}/apps/web/public/tiles/context"
WORK="${WORK:-${ROOT}/.context-work}"
YEAR="${WORLDPOP_YEAR:-2020}"
[[ $# -gt 0 ]] || { echo "usage: build-context-layers.sh ISO3 [ISO3 ...]" >&2; exit 1; }
for tool in curl gdal_translate gdalbuildvrt gdaldem ogr2ogr tippecanoe pmtiles; do command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 1; }; done
mkdir -p "${OUT}" "${WORK}"

# ---- population: WorldPop constrained 100 m counts per country -> one colour-relief raster -> PMTiles (z0-11) -------------------------
TIFS=()
for iso in "$@"; do
  lower="$(echo "${iso}" | tr '[:upper:]' '[:lower:]')"
  tif="${WORK}/${lower}_ppp_${YEAR}.tif"
  [[ -f "${tif}" ]] || curl -sSL --fail --retry 3 -o "${tif}.part" "https://data.worldpop.org/GIS/Population/Global_2000_2020_Constrained/${YEAR}/maxar_v1/${iso}/${lower}_ppp_${YEAR}_UNadj_constrained.tif" && mv -f "${tif}.part" "${tif}" 2>/dev/null || true
  [[ -f "${tif}" ]] && TIFS+=("${tif}")
done
if [[ ${#TIFS[@]} -gt 0 ]]; then
  gdalbuildvrt -overwrite "${WORK}/pop.vrt" "${TIFS[@]}"
  # People per 100 m cell: none is transparent (never drawn as 0), then pale to dark.
  cat > "${WORK}/ramp.txt" <<'RAMP'
nv 0 0 0 0
0.5 255 247 236 0
1 254 232 200 140
10 253 187 132 170
50 239 101 72 200
200 179 0 0 220
1000 127 0 0 235
RAMP
  gdaldem color-relief -alpha -of GTiff "${WORK}/pop.vrt" "${WORK}/ramp.txt" "${WORK}/pop-rgba.tif"
  gdal_translate -of MBTILES -co TILE_FORMAT=PNG "${WORK}/pop-rgba.tif" "${WORK}/population.mbtiles"
  gdaladdo -r average "${WORK}/population.mbtiles" 2 4 8 16 32 64 128 256
  pmtiles convert "${WORK}/population.mbtiles" "${OUT}/population.pmtiles.tmp" && mv "${OUT}/population.pmtiles.tmp" "${OUT}/population.pmtiles"
fi

# ---- health facilities: healthsites.io shapefile per country -> points -----------------------------------------------------------------
FAC=()
for iso in "$@"; do
  zip="${WORK}/healthsites-${iso}.zip"
  [[ -f "${zip}" ]] || curl -sSL --fail --retry 3 -o "${zip}" "https://data.humdata.org/dataset/$(echo "${iso}" | tr '[:upper:]' '[:lower:]')-healthsites/resource_download/shapefiles" || { echo "no healthsites file for ${iso}"; rm -f "${zip}"; continue; }
  mkdir -p "${WORK}/hs-${iso}" && unzip -oq "${zip}" -d "${WORK}/hs-${iso}"
  shp="$(find "${WORK}/hs-${iso}" -name '*.shp' | grep -i -E 'node|point' | head -1)"
  [[ -n "${shp}" ]] && ogr2ogr -f GeoJSONSeq "${WORK}/hs-${iso}.geojsons" "${shp}" -t_srs EPSG:4326 -select name,amenity && FAC+=("${WORK}/hs-${iso}.geojsons")
done
[[ ${#FAC[@]} -gt 0 ]] && tippecanoe -o "${OUT}/health-facilities.pmtiles" -l facilities -zg --drop-densest-as-needed --force "${FAC[@]}"

# ---- settlements: OCHA populated places (cod-ps / populated places) where published ------------------------------------------------------
SET=()
for iso in "$@"; do
  lower="$(echo "${iso}" | tr '[:upper:]' '[:lower:]')"
  gj="${WORK}/places-${iso}.geojson"
  [[ -f "${gj}" ]] || curl -sSL --fail --retry 3 -o "${gj}" "https://data.humdata.org/dataset/${lower}-settlements/resource_download/geojson" || { echo "no settlements file for ${iso}"; rm -f "${gj}"; continue; }
  ogr2ogr -f GeoJSONSeq "${WORK}/places-${iso}.geojsons" "${gj}" -t_srs EPSG:4326 && SET+=("${WORK}/places-${iso}.geojsons")
done
[[ ${#SET[@]} -gt 0 ]] && tippecanoe -o "${OUT}/settlements.pmtiles" -l settlements -zg --drop-densest-as-needed --force "${SET[@]}"
ls -lh "${OUT}"
