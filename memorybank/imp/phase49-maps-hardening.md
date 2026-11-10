# Phase 49 — Maps: global coverage, speed, analysis and interoperability

**DonorDesk Version 3.007** · Plan written 2026-11-10 · Branch to create: `0019-maps-hardening`
Status: plan only.

## 0. Why

The maps audit of 2026-11-10 compared DonorDesk with DevResults, DHIS2 Maps, ActivityInfo,
KoboToolbox and ArcGIS Dashboards. We lead on boundary depth (admin 4, OCHA P-codes), honesty
(a gap is grey, never 0; nothing is placed by a guess), data sovereignty (no external tiles or
geocoding), low-data mode and accessibility (every map is also a table). This phase closes the gaps:

| # | Weakness | Batch |
|---|---|---|
| W1 | The basemap covers Africa and South Asia only; elsewhere the map has a plain background | 49.2 |
| W2 | The first map takes ~15 s on Fast 3G (target 2.5 s); the map code is 301 KB gzipped | 49.1 |
| W3 | No imagery, population or environmental context layers | 49.6 |
| W4 | Many points: clustering exists (`build-scene.ts`, automatic above 200 pins), but it has not been measured at 10k+ points and is not done on the server | 49.4 |
| W5 | No spatial analysis (buffers, catchments, distance to the nearest facility) | 49.7 |
| W6 | Two map engines (MapLibre plus the ECharts fallback) | 49.9 |
| W7 | No GeoJSON/KML/CSV export of places and results; no geo route in the public API | 49.5 |
| W8 | Boundaries are a manual snapshot; no check for new OCHA COD versions; the last download job died partway | 49.3 |
| W9 | Not checked live (drill to admin 2–4, drawing, boundary upload, share-link drill); side panels are English; translations have no native reviewer | 49.8 |
| W10 | Host disk at ~89%; 1.6 GB of tiles plus 191 MB of geo files | 49.2, 49.3 |
| O6 | `/tiles` and `/geo` are not cached as immutable; `/field` has no offline maps | 49.1, 49.4 |

## 1. Rules that do not change

- Ports and adapters (Phase 41): only `features/maps/adapters/*` import MapLibre, pmtiles, Protomaps
  or Terra Draw; `composition.ts` wires them. Map files stay ≤300 lines with ≤1 class
  (`test/architecture-boundaries.test.mjs`).
- **A location never leaves the tenant.** No third-party tile, geocoding or routing service is
  called at runtime. Every new layer is self-hosted, or it is an opt-in admin setting named on
  `/security` and in the third-party list (the same rule as `PLACE_LOOKUP_URL`).
- A missing value is grey or null, never 0. A rate is never summed. Joins use the P-code
  (`Place.code`), then name + parent, then a unique name, and are never guessed.
- Licence verdicts come from `licenceVerdict`; every file names its own source, and
  `/maps/sources` is generated from it.
- Low-data mode loads no tiles. Every map keeps its table and keyboard path.
- Share links never carry finance or uploaded tenant boundaries (`ShareLinkExtras`).

## 2. Batches

### 49.0 Baseline and measurements (½ day)
- Extend `test:maps-budget` to record, per run:
  - time to first map on Fast 3G, Slow 4G and cable
  - total bytes split by kind (JS, tiles, geo, fonts)
  - JS heap for admin 4 in BGD, NGA and COD
  - frames per second while panning with 1k, 10k and 50k pins
- Save the results to `memorybank/imp/phase49-baseline.json`. Every later batch compares against this file.
- Inventory the host disk (`du` on `/opt/donordesk/shared/{tiles,geo}`, the backups and the `app.failed-*` trees) and remove leftover failed trees.

### 49.1 A fast first map (W2, O6) — target ≤ 2.5 s on Slow 4G, ≤ 5 s on Fast 3G
1. **Fetch in parallel.** Start the PMTiles header/directory request and the boundary file for the
   project's country at the same time as the MapLibre chunk, instead of after it. A new
   `MapPrefetch` port in `adapters/basemap/prefetch.ts`, using `fetch` with `priority: "high"`.
2. **Preload.** Add `<link rel="modulepreload">` for the map chunk and `<link rel="preload">` for
   the country's admin-1 file on map routes (project Overview, Maps, plan Map view, canvases that
   hold a MAP block). This is decided on the server from the project country only, with no user data in the URL.
3. **Draw data first.** Draw the choropleth or the pins as soon as their GeoJSON arrives, and add
   the basemap layers underneath when they are ready (`scene` order is unchanged; only the order of
   loading changes).
4. **Smaller code.**
   - Use a custom MapLibre build or tree-shake the unused controls.
   - Load the RTL plugin, Terra Draw and the flow and bivariate renderers only on demand.
   - Budget: ≤ 220 KB gzipped for the first-map chunk.
5. **Fonts.** Subset the glyph ranges (Latin, Arabic, Devanagari, Bengali) and load only the ranges
   the visible labels need.
6. **Caching.**
   - Hashed file names for `/geo/**` and `/tiles/**`, and a manifest that maps logical name → hashed name.
   - nginx: `Cache-Control: public, max-age=31536000, immutable`, `Accept-Ranges` kept, gzip/brotli on `.json`.
   - The manifest itself is `no-cache` with an ETag.
- Tests: the budget test fails above the targets. A unit test checks that the URLs on the preload
  list are the same ones the adapter later fetches, so nothing is fetched twice.

### 49.2 A basemap for every country (W1, W10)
1. **A global low-zoom basemap.** One Protomaps extract at z0–6 (estimated 100–150 MB) is used everywhere.
2. **Detailed regions only where projects are.** z7–14 regions are built per region
   (`scripts/build-basemap-region.sh <bbox-name>`). The list of regions comes from the countries of
   live projects across all tenants (`scripts/basemap-regions.mjs`, run by hand, no tenant data in the output).
   - New regions: Middle East and North Africa (Syria, Yemen, Iraq, Lebanon, Jordan, Palestine), Eastern Europe (Ukraine), Latin America and the Caribbean (Haiti, Colombia, Venezuela), Southeast Asia (Myanmar, Philippines).
   - Africa and South Asia are rebuilt at the same build date.
3. **Choosing a region.** `BasemapSource` picks the detailed region that covers the viewport and
   falls back to the global file outside it. `NO_BASEMAP` then happens only when a file is missing.
4. **Disk plan.**
   - The host keeps only the regions that live projects use.
   - `sync-tiles.sh` gains `--prune` (it removes regions no longer listed, with a dry run by default) and refuses to run when free disk would fall below 15%.
   - Record the expected total in this file before shipping.
5. **The basemap shows its build date** on `/maps/sources`.
- Tests: region selection over a table of viewports, including a viewport that crosses a region edge, an ocean viewport and the antimeridian.

### 49.3 Boundaries as tiles, kept up to date (W8, W10, heap)
1. **Vector tiles for admin 2–4.** One PMTiles file per level (`boundaries-adm2|3|4.pmtiles`),
   generated from the existing GeoJSON with tippecanoe (simplified per zoom, P-code and parent kept
   as properties). Admin 1 stays as small GeoJSON files.
   - The join needs P-codes on screen only, so feature state is set by P-code (`setFeatureState`), never by copying values into the tiles.
   - Values never enter the files.
2. **A fallback path.** `BoundarySource` reads the tiles; for a level a country has only as an
   uploaded `TenantBoundaryLayer`, it keeps the GeoJSON path. Drill, breadcrumbs, `containingFeature`
   and `point-in-area` keep working: point-in-area for pins uses the GeoJSON file of one country,
   loaded only when placing a pin.
3. **Finish the download.** Finish the interrupted OCHA admin 2–4 run and the geoBoundaries run with
   resumable state; rebuild `manifest.json` and the coverage report.
4. **A COD version check.** `scripts/check-cod-updates.mjs` compares the `dataset_date` and
   `last_modified` of each HDX dataset with the manifest and writes a report (no automatic replace).
   - A monthly systemd timer on the host runs it and emails the report to the operator. Install it by hand: it is not shipped by `deploy-fast.sh`.
   - Replacing a version is a reviewed step (`scripts/update-cod.mjs <ISO> <level>`) that keeps the old file for 90 days.
5. **P-code changes.** When a new COD version renames or splits units, `diffBoundaryVersions` (domain,
   pure) lists the P-codes that appeared, disappeared or changed parent. "Places to confirm" shows
   tenants' places whose P-code disappeared. Stored places are never rewritten.
- Target: admin 4 for BGD at ≤ 30 MB heap (from 66 MB); geo bytes on the host ≤ 120 MB (from 191 MB).

### 49.4 Many points, and maps offline (W4, O6)
1. **Measure the existing clustering** (`build-scene.ts`, `cluster: pins.length > 200`) at 1k, 10k
   and 50k pins. Tune `clusterRadius` and `clusterMaxZoom`; a cluster's colour is its worst delivery
   signal, keeping the `SITE_SIGNAL_COLOR` precedence; a click on a cluster zooms in and its table lists the members.
2. **Above 5k points, bin on the server**: hex or grid counts per zoom, from a
   `GET /v1/projects/:id/map-points?bbox=&zoom=` route (`project.view`, in `RULES`, project boundary
   checked). Counts only; no names until the person zooms past the binning threshold.
3. **Offline maps for `/field`.**
   - The offline pack gains the project country's admin-1 file and, optionally ("Download map for offline use", size shown first), a PMTiles extract cut to the project's bbox at z0–12 (`GET /v1/projects/:id/offline-basemap`, built and cached on the host per bbox).
   - Stored in the Cache API under the pack's user, and wiped on sign-out with the pack.
   - It contains no tenant data beyond the bbox.
- Tests: the pack contents, the wipe on sign-out, and that a stale pack warns but never blocks (the existing pack rules).

### 49.5 Interoperability (W7)
1. **Export from any map.** GeoJSON, KML and CSV (lon, lat, P-code, name, value, period, verified flag).
   - The file holds what the person already sees: the same read and the same visibility rules.
   - A gap is empty, never 0. CSV defuses a leading `= + - @`.
   - Every download is audited with counts only.
2. **Places export and import round trip.** `GET /v1/places/export?format=geojson|csv`; import accepts the same file (`ImportPlacesHandler`, all or nothing, as today).
3. **Public API.**
   - `GET /api/v1/places` (scope `places:read`, GeoJSON FeatureCollection).
   - `GET /api/v1/projects/:id/place-results?level=&periodId=` (a new scope `results:read`, added to `API_SCOPES`).
   - One MCP tool, `get_place_results`, already exists: give it a GeoJSON option.
   - Finance never; rates never combined.
4. **OGC (optional, behind a flag `MAPS_OGC_ENABLED`)**: a read-only OGC API Features endpoint over the
   same data, authenticated with an API key, for QGIS/ArcGIS users. This is decided after 49.5.1–3 ship.
- Tests: an export round trip (export → import → same places), a scope refusal, visibility for an outside partner.

### 49.6 Context layers (W3)
All are self-hosted rasters or vectors, opt-in per organisation, and every source is credited on `/maps/sources`.
1. **Population.** WorldPop 100 m (or the Meta/CIESIN HRSL) for the countries of live projects,
   converted to raster PMTiles; licence CC BY 4.0. Shown as a context layer and used by 49.7.
2. **Health facilities and settlements.** healthsites.io (ODbL → share-alike: the verdict is SHARE_ALIKE,
   with credit and an offered derived copy) and OCHA settlement points where available, as vector PMTiles.
3. **Imagery.** No online imagery by default. An organisation may set its own XYZ/WMTS imagery URL
   (`Organization.imageryUrl`, `org.manage`, audited); the setting warns that the provider sees the viewport.
   This is the only network exception, it is stated on `/security`, and it is off by default.
4. **Context, not results.** Context layers are never reported against, never shaded by indicator values, and never replace a boundary (the same rule as uploaded overlays).

### 49.7 Spatial analysis (W5)
Pure domain functions in `packages/domain/src/contexts/places/analysis/`. They are deterministic and
table-tested; turf.js is used only inside an adapter.
1. **Buffers.** "Within N km of" a place or a set of places. The result is the list of places and
   areas inside, and a polygon drawn on the map; N runs from 0.1 to 100 km.
2. **Nearest facility.** For each site, the straight-line distance to the nearest place marked
   `facility`, labelled "straight line, not travel time". There is no routing engine.
3. **Population covered.** Population inside a buffer or an area, from the 49.6 raster. It is
   summed per cell and the zonal sum is computed on the server (`POST /v1/projects/:id/analysis/population`, `project.view`). It carries the source and year; with no raster loaded it says so and gives no figure.
4. **Coverage per population.** `people reached ÷ population` for an area. It uses the recorded unique-reach metric only, and never a rate summed across areas.
5. **Where results surface.**
   - A "Analyse" panel on the Maps page.
   - A canvas block `MAP_ANALYSIS` (a registry row, with a model, a painter and a fixture; `PRINT_PENDING`/`SCREEN_PENDING` stay as they are).
   - Results may be exported (49.5) and are **never sent to a report writer** unless a later phase adds a record chunk for them.
- Tests: buffer edges (0 km, the antimeridian, the poles refused), a nearest facility when there are none, population with a missing raster.

### 49.8 Finish, check and translate (W9)
1. **Translate the side panels.** `PlacePanel`, `LayerPanel`, `OverlayPanel`, `PeriodSlider` and `PhotosMapPanel` move to `maps.*` keys in the four languages (the typed catalogue fails on a missing key).
2. **Live checks on production with the test tenant**, recorded in `memorybank/demo/phase49-maps-verification.md`:
   - drill to admin 2, 3 and 4 in two countries
   - placing a pin and drawing an outline
   - boundary upload
   - the share-link drill and time slider, from a signed-out browser
   - low-data mode
   - Arabic RTL
   - a phone at 390 px
   - the offline field map
3. **Native review** of the fr/es/ar `maps.*` strings. Owner: the user. Until it is done, nobody is told the maps are available in those languages.
4. **Harness.** `test:maps` gains checks for the new batches; it stays out of `pnpm test` (~6 min).

### 49.9 One engine (W6)
Removing the ECharts fallback needs at least 4 weeks of MapLibre in production with no map error reports, and the user's OK.
1. **No WebGL** means the table view plus a static PNG rendered on the server (the existing resvg path draws the boundary and the values; no tiles), never ECharts.
2. **Remove the old figures.**
   - Delete `SiteMapFigure`, `LocationPickerFigure`, the ECharts `MapCanvas`, `map-assets` and `useMapEngine`'s branch, and the flag `NEXT_PUBLIC_MAP_ENGINE`.
   - Add rows in `phase48-retirement.md` and `phase48-parity.md` (the parity test fails otherwise).
   - Infographic and canvas exports keep their own server-side drawing; only the screen engine changes.
3. **The bundled gazetteer** (3.1 MB in `workplan/domain/geo`) moves to a server route, `GET /v1/places/suggest?q=`, which reads the bundled data on the server and sends no user data outside. This takes it out of the client chunk that loads it.

## 3. Order and size

| Batch | Depends on | Estimate | Ship |
|---|---|---|---|
| 49.0 | — | ½ d | — |
| 49.1 | 49.0 | 2 d | web (plus nginx by hand) |
| 49.2 | 49.0 | 2 d (plus build time) | tiles sync, web |
| 49.3 | 49.0 | 3 d | geo sync, web, timer by hand |
| 49.4 | 49.1 | 2 d | both |
| 49.5 | — | 2 d | both |
| 49.6 | 49.2 | 2 d | data sync, both; migration for `Organization.imageryUrl` |
| 49.7 | 49.6 | 3 d | both |
| 49.8 | 49.1–49.5 | 2 d plus the review | web |
| 49.9 | 4 weeks after 49.8, and the user's OK | 1½ d | web |

Batch the deploys: 49.1 + 49.2 + 49.3 as one release; 49.4 + 49.5 as one; 49.6 + 49.7 as one.
Each uses `deploy-fast.sh` with the smallest `SCOPE` that covers the change.

## 4. Deploy notes (filled in as built)
- Migrations expected:
  - `Organization.imageryUrl` and `Organization.contextLayersJson` (49.6)
  - none for 49.1–49.5 unless the server binning cache is persisted (decide in 49.4; keep it in memory first)
- `/ready` pairs: add one for each new column.
- New routes go in `RULES` (and `EXTERNAL_ALLOWED` only where a partner needs them, decided per route).
- Host steps, by hand:
  - nginx cache headers
  - `sync-tiles.sh` (with `--prune`) and `sync-geo.sh`
  - the COD check timer
  - context-layer data sync
- Before each one: a fresh backup and a disk check (≥15% free after the sync).

## 5. Done means
- Measured: the first map ≤ 2.5 s on Slow 4G; first-map code ≤ 220 KB gzipped; BGD admin 4 heap ≤ 30 MB; 50k points pan at ≥ 30 fps.
- Every country of a live project has a basemap; host map data fits the disk plan.
- Places and results can be exported and read through the public API.
- Buffers, the nearest facility and population covered work with credited sources.
- Live checks are recorded; side panels translated; one map engine on screen.
- AGENTS.md gains a "Phase 49 invariants — maps hardening" section, and `/maps/sources` and the support articles are updated.
