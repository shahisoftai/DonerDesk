# 63 — Maps hardening: global ground, speed, context, analysis, files out

**DonorDesk Version 3.007 (Phase 49)**
**Status:** built and deployed 2026-11-10 (first release `20261110133250`, live fixes up to the drill fix); checked in a signed-in browser on DEMO-16 Kenya Education (`../demo/verification-phase49-maps.md`).
**Plan:** `../imp/phase49-maps-hardening.md`. **Rules:** `AGENTS.md` → "Phase 49 invariants — maps hardening".

## What a person gets

| Where | What |
|---|---|
| Every map | One engine (MapLibre). A low-detail world map wherever no detailed region exists, and a sentence saying so. Detailed streets for Africa, South Asia, Middle East, Eastern Europe, Caribbean, Andes, Southeast Asia. A device without WebGL gets the table (results, sites) or typed coordinates (a pin). |
| Results map | Districts and finer from OCHA COD-AB where published (88 levels as vector tiles); county level from OCHA for Kenya and eight more countries. Drill finds a place by P-code, else by a unique name (places that carry ISO codes such as KE-TUR still drill). Download these results as GeoJSON or CSV. |
| Context | Population (WorldPop 1 km), health facilities (Healthsites.io / OSM), settlements (HOT / OSM), switched on per map; an organisation's own imagery address (off by default, the one outside call). |
| Analyse panel | Rings of 0.1–100 km around places with a figure: places inside, nearest health facility (straight line), people living inside (each cell once; a ring across a border counts the part inside and says so). Nothing saved, nothing sent to a report. |
| Settings → Places | **Pin** / **Change pin** on any existing place, with "This place is a facility"; Map context layers card (administrators); places list as CSV (the import's own columns) and GeoJSON; "Places affected by a boundary update" when an official release retired or moved a code. |
| Field app | Map for offline use: size shown first, kept per person in the phone's cache, served from the device, wiped on sign-out. |
| Public API / MCP | `GET /api/v1/places` (GeoJSON or CSV), `format=geojson|csv` on place-results, MCP `get_results_by_place` with `format: "geojson"`. |

## Data and how it is made (all self-hosted)

| Data | Script | Tool |
|---|---|---|
| Basemap world + regions | `scripts/maps/extract-basemap.sh`, keep list `scripts/maps/basemap-regions.mjs` | go-pmtiles |
| OCHA boundaries 1–4 | `apps/web/scripts/build-ocha-boundaries.mjs --levels 1,2,3,4 [--skip …] [--refresh yes]` | curl (HDX answers Node/Python clients with an empty 202) |
| Boundary tiles | `scripts/maps/build-boundary-tiles.mjs` (levels with ≥300 units) | tippecanoe |
| Context layers + population grids | `scripts/maps/build-context-layers.sh` → `build_context_layers.py` | rasterio, pyogrio, geopandas, rio-pmtiles, tippecanoe |
| Boundary releases | `scripts/maps/check-cod-updates.mjs` (monthly timer), `scripts/maps/update-cod.mjs` | curl |

Ship with `scripts/sync-geo.sh` and `scripts/sync-tiles.sh` (`PRUNE=1` removes regions not kept). On the dev box the tools live in `~/.local/bin` (pmtiles, tippecanoe built with a bundled SQLite) and a uv environment for GDAL; the host has `/opt/donordesk/shared/bin/pmtiles` (`PMTILES_BIN`) for offline cuts.

## Known gaps

- Indonesia, Thailand, the Philippines and Chile: HDX stalls their large zips; fetch again with the OCHA script.
- Not yet checked live: share-link maps, boundary upload, drawing outlines, the no-WebGL path; the `test:maps*` harnesses were not run after the change.
- Not built: a canvas analysis block, the server-side picture for devices without WebGL, the place-name list behind a server route, the OGC API (owner's decision), browser use of the grid-count route.
- Translations of the new labels are drafts without a native reviewer.
