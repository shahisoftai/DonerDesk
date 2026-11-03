# Phase 41: Interactive maps to admin 4 and place marking (implementation plan)

**DonorDesk Version 3.007** · created 2026-11-03 · branch `0017-maps-v2` (to be made from `0016-pcw`) · status: **IN PROGRESS on branch `0017-maps-v2` (nothing committed): 41.1 mostly built, 41.2 to 41.4 built behind `NEXT_PUBLIC_MAP_ENGINE=maplibre`, see the progress notes**

Source: the maps audit of 2026-11-03 (code and data read of `features/maps/`, `features/places/`, `features/workplan/domain/geo/`,
`lib/client/map-assets.ts`, `public/geo/manifest.json`, `contexts/places/`; **no signed-in browser pass yet**, see Batch 41.0).

## 1. Goal and non-goals

**Goal.** One interactive map system, comparable to DevResults, used by every interactive map screen. It has:
- a real basemap with streets, terrain and satellite-style context, served from our own host;
- smooth zoom, pan and clustering;
- drilling from country to admin 1, 2, 3 and **admin 4 wherever an openly licensed source exists**, with breadcrumbs both ways;
- areas joined by **P-code**, not by name;
- tools to **mark places**: drop or drag a pin, draw an area or route, snap a pin to its containing boundary, and place many pins from a list.

All existing honesty rules still hold. A missing value is grey, never 0. A rate is never combined. A place without a pin is listed,
never guessed. A location never leaves the tenant.

**Non-goals.**
- No third-party tile or geocoding API (Mapbox, Google, Esri online). Everything is self-hosted.
- No change to what a figure means or to how `rollupByPlace` computes it.
- Exported pictures (reports, infographics, DOCX/PDF) keep the ECharts server renderer. MapLibre is browser-only. The exported
  map stays the deterministic SVG/PNG, and only the screen changes.
- No routing or navigation, no offline tile packs on phones (41.10 says why), no GPS tracking.

## 2. Findings this plan closes

| # | Finding (audit 2026-11-03) | Closed by |
|---|---|---|
| A | Renderer is ECharts `geo`: no basemap, no clustering, no scale bar, no ground context for marking | 41.2, 41.3 |
| B | Depth stops at ADM3. 120 countries have ADM2 and 56 have ADM3, **none has ADM4**. `drillInto` is limited to `1 \| 2 \| 3` | 41.1, 41.4 |
| C | Areas matched by name (`placeForRegion`). `Place` has only a free `code` field, so repeated names collide | 41.1, 41.4 |
| D | `drillUp` jumps straight to the world. No breadcrumbs | 41.4 |
| E | Marking: one pin in two forms only. No area or line drawing, no snapping, no bulk placing on the map | 41.5, 41.6 |
| F | Boundaries are hand-synced static GeoJSON (68 MB), simplified to ~100 m, loaded whole per country and level | 41.1 |
| G | One custom boundary layer per organisation (`TenantMapLayer.tenantId @unique`) | 41.7 |
| H | Share-link results map is a fixed snapshot (no drill, no slider). Low-data mode skips maps. New labels are English only | 41.8, 41.9 |
| I | 20 country/level files held for licence reasons (ODbL, share-alike) | 41.1 (§5.3 decision) |

## 3. Architecture (SOLID by construction)

The map is split into four layers. Each layer has one job and depends only on abstractions of the layer below.

```
apps/web/src/features/maps/
  domain/                  pure: no React, no MapLibre, no clock, no fetch
    model/                 MapScene, MapLayerSpec, DrillPath, Breadcrumb, Selection (data types only)
    scene/                 buildScene(inputs) -> MapScene; one builder per layer kind (registry)
    drill/                 drill state machine (down, up one, to crumb, reset)
    boundaries/            BoundaryCatalog (what levels exist per country), pcode join
    marking/               place-draft rules: pin, area, line, snap, bulk-place
    style/                 colour scale, legend, symbol sizing (moved from map-explorer.ts)
  ports/                   interfaces only
    MapRenderer.ts         draw(scene), fit(bounds), on(event): the ONLY thing presentation calls
    BoundarySource.ts      levelsFor(iso), load(iso, level, bbox?) -> FeatureCollection
    BasemapSource.ts       styleFor(mode: light|dark|satellite|none)
    DrawingTool.ts         start(kind), cancel(), on("finish", geometry)
  adapters/                the only files that import a map library
    maplibre/MapLibreRenderer.ts
    maplibre/TerraDrawTool.ts
    echarts/EChartsRenderer.ts      kept as the fallback (low data, WebGL missing)
    boundaries/PmtilesBoundarySource.ts
    boundaries/GeoJsonBoundarySource.ts   (the current files, kept during migration)
    boundaries/TenantLayerBoundarySource.ts
    basemap/ProtomapsBasemap.ts
  presentation/            React: composes ports, draws controls, decides nothing
```

| Principle | How this plan meets it | Enforced by |
|---|---|---|
| **S** (single responsibility) | Scene building, drilling, joining, marking rules, rendering and drawing are separate modules. A renderer only turns a `MapScene` into pixels and events. A builder only turns inputs into one layer spec. | Architecture test: ≤300 lines and one exported class per file under `features/maps/**` (same rule as the setup wizard) |
| **O** (open/closed) | Layer kinds are a registry (`LAYER_BUILDERS: Record<LayerKind, LayerBuilder>`), and so are boundary sources (`BOUNDARY_SOURCES`, tried in priority order) and marking tools (`MARKING_TOOLS`). A new layer, source or tool is a new row, never a branch. | Exhaustiveness tests (`assertExhaustive`). A grep test fails any `switch (layer.kind)` outside `scene/` |
| **L** (Liskov) | `MapLibreRenderer` and `EChartsRenderer` both satisfy `MapRenderer`, and all three boundary sources satisfy `BoundarySource`. One shared contract suite runs against every implementation. | `tests/support/map-renderer-contract.mts`, `boundary-source-contract.mts` (pattern: `assignment-source-contract.mjs`) |
| **I** (interface segregation) | Narrow ports: a screen that only shows pins never sees `DrawingTool`. `MapRenderer` has no editing methods, and editing is the separate `DrawingTool`. Read ports and write ports for places stay separate. | Ports reviewed in 41.2. No port has more than 6 members |
| **D** (dependency inversion) | Presentation receives `MapRenderer`, `BoundarySource` and `BasemapSource` through one `MapServicesProvider` (React context) built in one composition file (`maps/composition.ts`). Domain and presentation never import `maplibre-gl`, `terra-draw`, `pmtiles` or `echarts`. | Extended `test/architecture-boundaries.test.mjs`: only `features/maps/adapters/**` may import those packages |

Server side follows the existing pattern:
- Domain: pure rules in `packages/domain/src/contexts/places/`.
- Application: handlers plus ports, e.g. `IPlaceGeometryRepository` and `IBoundaryCatalog`.
- Infrastructure: Prisma and storage implementations.
- API: thin Zod routes.

## 4. Library and data choices

| Need | Choice | Licence | Why |
|---|---|---|---|
| Interactive renderer | `maplibre-gl` 5.x (exact version pinned) | BSD-3 | WebGL vector maps, clustering, fill/line/symbol layers, RTL text plugin, no vendor key |
| Tile container | `pmtiles` (Protomaps) | BSD-3 | One static file per dataset, served by nginx with HTTP range requests. No tile server process |
| Basemap data | Protomaps OSM basemap build, **regional extracts** for the countries tenants work in | ODbL (OSM): attribution "© OpenStreetMap contributors" shown on the map | Only open option with no API. A regional extract keeps disk use bounded (§5.4) |
| Drawing | `terra-draw` + its MapLibre adapter | MIT | Points, polygons, lines, select, drag. Maintained, framework-neutral |
| Clustering | MapLibre's built-in GeoJSON clustering (Supercluster inside) | — | Nothing extra to ship |
| Geometry rules | `@turf/boolean-point-in-polygon`, `@turf/area`, `@turf/simplify` (only where our own `point-in-area.ts` and `simplify-geometry.ts` fall short) | MIT | Keep using our own pure functions first |
| Boundary build | `tippecanoe` (host or local CLI, build step only) | BSD-2 | GeoJSON to PMTiles with level-based zoom ranges and P-code properties kept |

ECharts stays for charts, report and export maps, and the low-data fallback. MapLibre is loaded lazily inside the map chunk, so it never
enters a first bundle (same rule as today's map assets).

## 5. Data

### 5.1 Sources, in order (one table: `BOUNDARY_SOURCE_PRIORITY`)
1. **The tenant's own uploaded boundaries** for that country and level (41.7).
2. **OCHA COD-AB** (HDX). P-coded, humanitarian standard. ADM4 exists for a subset, e.g. BGD unions, PHL barangays, NPL wards, MOZ,
   UGA parishes, COD, MMR village tracts, AFG for some areas. The exact list is produced by the 41.1 scan, never assumed.
3. **geoBoundaries gbOpen** ADM4 where OCHA has none.
4. Otherwise the deepest level available. The breadcrumb says "Finest boundaries available: districts", and sites are shown as pins.

### 5.2 P-codes
COD files carry `ADMn_PCODE`. geoBoundaries carries `shapeID`, stored as `source:shapeID`. The build writes one normalised property set
on every feature: `pcode`, `parentPcode`, `name`, `level`, `iso`, `source`, `licence`, `year`. The join is P-code first, then
name plus parent P-code, then name alone. A name-only match is flagged "matched by name" in the place panel.

### 5.3 Licences (existing `licenceVerdict`, unchanged)
Attribution and public-domain licences ship. **ODbL and CC BY-SA are open licences that need no application or permission:** using
them means meeting their conditions.
- **Attribution.** The source and licence are named in the map footer and on a public `/maps/sources` page generated from
  `catalog.json`.
- **Share-alike.** A boundary file we derive from an ODbL or BY-SA source (simplified, re-coded, tiled) is offered under the same
  licence. The derived GeoJSON for those countries is downloadable from `/maps/sources`. This covers the boundary files only: our app,
  tenant data and figures drawn on top stay ours (ODbL "produced work" / collective database).
- **No added restrictions.** We put no technical measure on those files that blocks reuse.

`licenceVerdict` gains a third verdict, `SHARE_ALIKE`. It ships the file and records the obligation in `catalog.json` (`shareAlike:
true`), and the sources page and footer read that flag. "Other" or unknown licences stay `HOLD`. **The final yes to ship the 20 held
files is the user's** (default: ship once `/maps/sources` exists, Batch 41.1).

### 5.4 Hosting and disk (host checked 2026-11-03: 96 GB, 64 GB used, 32 GB free, 67%)
- Boundaries: one PMTiles per level band (`boundaries-adm0-2.pmtiles`, `boundaries-adm3-4.pmtiles`). Estimated 300–700 MB for all
  shipped countries at full COD precision (the current 68 MB is simplified to ~100 m).
- Basemap: regional extracts only, `basemap-<region>.pmtiles` with maxzoom 14. Estimated 1–4 GB per large region. The first build
  covers East Africa, the Sahel and Horn, and South Asia. Others are added when a tenant needs them.
- Location `/opt/donordesk/shared/tiles/`, served by nginx at `/tiles/` with `Accept-Ranges`, long cache and CORS for our own
  origin only (new include `infra/nginx/…_tiles`). Not part of a release, like `/geo/` today. Sync script: `scripts/sync-tiles.sh`.
- **Space is sufficient (user confirmed):** 2–6 GB of tiles takes the host to about 70–73%. 41.1 still records the real sizes, and
  `sync-tiles.sh` refuses to run if `/` would go above 85% (a guard, not an expected stop).

### 5.5 Build pipeline
`scripts/maps/` holds one script per step, each resumable:
- `fetch-cod.mjs`, `fetch-geoboundaries.mjs`: extend the current scripts to levels 1–4.
- `normalise.mjs`: writes the §5.2 properties and checks parent containment.
- `tile-boundaries.sh`: runs tippecanoe with minzoom per level (ADM0 0–, ADM1 3–, ADM2 5–, ADM3 7–, ADM4 9–).
- `catalog.mjs`: writes `catalog.json`, which replaces `manifest.json` as the record of each country's levels, source, licence, year,
  unit count and bounds.
- `extract-basemap.sh`: runs `pmtiles extract` from the Protomaps planet build by bbox.

Batch 41.1 also builds `/maps/sources` (public, static, generated from `catalog.json`: source, licence, year, download of share-alike derived files). Outputs are gitignored. `catalog.json` is small and is shipped with the web build so the UI knows the available levels without a request.

## 6. Schema changes (migration `20261106090000_places_v2`, additive)

```prisma
model Place {
  // existing fields unchanged
  pcode          String?   // e.g. "SD01001" (COD) or "gb:SDN-ADM2-123"
  boundarySource String?   // "COD" | "GEOBOUNDARIES" | "TENANT" | null
  geometryKind   String?   // null (none) | "POLYGON" | "LINE"; a POINT keeps latitude/longitude
  geometryKey    String?   // storage key of the drawn GeoJSON (never inline: size)
  geometryBytes  Int?
  placedBy       String?   // "TYPED" | "MAP_PIN" | "MAP_DRAWN" | "SNAPPED" | "IMPORT" | "GPS"
  @@unique([tenantId, pcode])
}

model TenantMapLayer {      // was one per tenant; becomes many
  // drop @unique on tenantId; add:
  iso         String?
  adminLevel  Int?          // a layer that replaces a boundary level for a country
  purpose     String        // "BOUNDARY" | "CONTEXT"
  pcodeField  String?       // which property holds the code
  nameField   String
  @@unique([tenantId, iso, adminLevel])
}
```

- RLS is unchanged in shape, but re-run `rls.sql` and check `rowsecurity`. The `@unique` drop needs its own migration statement and a
  data-preserving check: the existing single layer becomes `purpose: CONTEXT`.
- `/ready` requires `Place.pcode`, `Place.geometryKind` and `TenantMapLayer.purpose`.
- `PrismaPlaceRepository.update` writes every new field with `?? null`, pinned by a persistence test (the `scopeJson` lesson).

## 7. Batches

Each batch is independently shippable. Each lists **Build**, **Tests** and **Done when**.

### 41.0 Baseline and browser pass (no code)
- Signed-in browser pass on the test tenant. Screenshots of Maps, Places, plan map, dashboard map, share link and photo map, light and
  dark, at 1300, 768 and 390 px. Saved to `memorybank/imp/phase41-baseline/`.
- Performance baseline: time to first map, JS of the map chunk, memory at ADM3 for SDN.
- Done when: the baseline exists and the findings in §2 are confirmed or corrected.

### 41.1 Boundary data to admin 4 (scripts and hosting only, no UI)
- **Build:** the §5.5 pipeline, `catalog.json`, the nginx `/tiles/` include, `sync-tiles.sh`, and a coverage report
  (`memorybank/imp/phase41-coverage.md`: country by level, source and licence).
- **Tests:** `normalise` unit tests (P-code properties, a child outside its parent is reported, a unit with a past `valid_to` is left
  out), a catalog schema test, and a licence verdict table unchanged.
- **Done when:** the coverage report lists every country with ADM4 and its source. PMTiles open in the `pmtiles` viewer locally. `/maps/sources` lists every shipped file with its
  licence.

### 41.1 progress (2026-11-03)
- Done: `licenceVerdict` returns SHIP / SHARE_ALIKE / HOLD; `requiresShareAlike`; `shareAlike` on each file; `sourcesPageRows`; `BoundaryLevel` 1-4; per-level simplification and rounding (`SIMPLIFY_EPSILON`, `ROUND_DIGITS`: admin 4 keeps ~10 m); both build scripts take level 4; COD units carry `parentId` (parent P-code).
- Data (local `apps/web/public/geo`, gitignored): the 21 files held since the old rule were re-run (27 files shipped, 4 still held: "Other" licences). **geoBoundaries ADM4: 20 countries** (AUT BEL BGD CZE FJI FRA GLP IND IRN ITA LKA MDG MTQ MYT REU RWA SLE SVK UGA ZAF). OCHA ADM4: run in progress (see below).
- **Two script bugs found and fixed.** (1) HDX answers HTTP 202 with an empty body to Node's `fetch` (it serves `curl`), so the OCHA downloader silently wrote nothing at level 4; it now downloads with `curl` and treats an empty body as a failure. (2) The earlier `.pkill -f` pattern matched its own shell; use `pgrep -f "[x]yz"`.
- **Deviations from the plan, on purpose:** (a) boundaries stay GeoJSON files (`FilesBoundarySource`); PMTiles for boundaries is not needed at this size (UGA ADM4 is 1.8 MB) and `tippecanoe` is not installed. (b) `manifest.json` stays the catalogue (no second `catalog.json`). (c) A place's P-code is the existing `Place.code` column: no new `pcode` column, no migration in 41.4. (d) Basemap extracts are far smaller than estimated: Africa to zoom 12 = 947 MB, South Asia = 739 MB (overzoomed above 12).
- Not done: the `/maps/sources` page itself, the coverage report, `sync-tiles.sh`, the nginx `/tiles/` include, rerunning OCHA levels 2 and 3 so those files carry `parentId`.

### 41.2 Ports, composition and the MapLibre renderer (behind a flag)
- **Build:** the `ports/` and `MapServicesProvider`. `MapLibreRenderer`, which draws a `MapScene` (fill, line, symbol, cluster, label),
  emits `select(featureRef)`, `hover`, `viewChange(bounds, zoom)`, and has fit-to-bounds, a scale bar, attribution, keyboard pan/zoom
  and the RTL text plugin. `EChartsRenderer` wraps today's `MapCanvas` behind the same port.
- Flag `NEXT_PUBLIC_MAP_ENGINE=maplibre|echarts`, default `echarts` until 41.4 is done. The renderer falls back to ECharts when WebGL
  is missing.
- **Tests:** the renderer contract suite runs against both adapters (a scene in, the events out), using a headless WebGL stub for
  MapLibre in unit tests and Chromium in the harness. The architecture test covers the import rule.
- **Done when:** the current Maps page draws identically through either engine (harness pictures compared by a person).

### 41.3 Basemap and themes
- **Build:** `ProtomapsBasemap` with styles light, dark (from the design tokens, mirrored like `chart-theme.ts`), "plain" (no basemap,
  today's look) and "terrain" (hillshade where the extract has it). There is no satellite imagery, because no open global imagery can
  be self-hosted at this size. This is said honestly in the style picker. Outside the extracted regions the map shows boundaries over
  plain, with a sentence saying so.
- **Tests:** a style-token drift test (same pattern as `design-tokens.test.mts`), contrast pairs for labels on fills, and a test that
  attribution is always present.
- **Done when:** light and dark pass the contrast checks and the attribution shows on every map.

### 41.4 Drill to admin 4, breadcrumbs, P-code join
- **Build:**
  - `drill/` state machine: `DrillPath = [world, country, a1, a2, a3, a4]`, with `down(featureRef)`, `up()` (one level),
    `toCrumb(i)` and `reset()`. Depth comes from `BoundaryCatalog.levelsFor(iso)`, never a hard-coded union type.
  - `PmtilesBoundarySource`, which filters vector tiles by `iso`, `level` and `parentPcode`.
  - P-code join in `boundaries/join.ts` (§5.2 order).
  - `GET /v1/projects/:id/place-results?level=` accepts 4. The handler is unchanged except for its level validation.
  - A breadcrumb component, and URL state (`?iso=&path=`) so a drilled view can be bookmarked and shared.
- **Tests:** a drill transition table (every state × every action), the join priority table (P-code, then name+parent, then name;
  "matched by name" flag), a test that a level absent from the catalog cannot be entered, and URL round-trip.
- **Done when:** in the harness, Bangladesh drills to unions (ADM4) and up one level at a time. Sudan stops at its finest level with
  the sentence. The flag defaults to `maplibre`.

### 41.5 Marking places: pins and snapping
- **Build:**
  - `marking/` domain: `PlaceDraft`; `placePin(draft, lngLat)`; `snapToBoundary(draft, catalog)`, which suggests the containing area
    at each level (reusing `point-in-area.ts`) and **only suggests**; `validatePlace` stays the one check.
  - A `PlaceMarker` presentation component: click to drop, drag to move, coordinates readout, "use my location" (browser GPS,
    `placedBy: GPS`) and undo.
  - Used by the Places form, the plan activity form (replacing `LocationPickerFigure`), collection forms' GPS question preview, and the
    photo map ("place this photo").
- **Tests:** a domain table for pin rules (both coordinates or neither, range checks, snapping never overwrites a parent the person
  chose) and a harness that drops, drags and saves a pin.
- **Done when:** a place can be pinned on the map in every surface that asked for coordinates before, with no second implementation.

### 41.5 progress (2026-11-03)
- Built: `domain/marking/pin.ts` (pin rules, undo, GPS, nudge), `snap.ts` (areas around a pin, parent suggestion that never replaces a chosen parent), `pin-copy.ts`; port `PinPlacer` (separate from `MapRenderer`); `MapLibrePinPlacer`; `PlaceMarker` (click, drag, typed coordinates, nudge, GPS, undo, remove, "This point is inside ..."); `PinPicker` (new map, or the old figure when WebGL or the flag is missing); `useMapEngine` shared with `MapExplorer`.
- Wired into: the plan activity form, the planned-activity location editor, and the Places form ("Place on map", with "Add it under <place>" as a suggestion). Photo map ("place this photo") and the collection form's GPS preview are NOT done: the first needs a write path for an evidence file's location, the second is a preview only.
- `placedBy` is reported to the form (`MAP_PIN | GPS | TYPED`) but NOT stored: no column yet (storing it is a schema change; decide with 41.6, which adds geometry columns).

### 41.6 Marking places: areas, routes and bulk placing
- **Build:**
  - `TerraDrawTool` behind `DrawingTool`: polygon, line, edit vertices, delete.
  - `marking/area-rules.ts`: closed ring, no self-intersection, at most 2 000 vertices and 1 MB, an area must sit inside its parent's
    boundary when the parent has one (warning, not refusal, because boundaries are simplified).
  - Geometry stored in `IStorage` under `places/<tenantId>/<placeId>.geojson` (the encrypting storage). `Place.geometryKey` points to it.
  - New handler `SetPlaceGeometryHandler` (`project.edit`, audited `place.geometry_set|cleared`), with routes
    `PUT|DELETE /v1/places/:id/geometry` and `GET /v1/places/:id/geometry`.
  - **Bulk place:** the "Places to confirm" list and the import preview gain "Place on map", which walks the unplaced items one by one.
    Each is pinned or skipped and nothing is saved until Save. Saving goes through the existing `ImportPlacesHandler` path, and any bad
    row blocks the whole set and names its row.
- **Tests:** an area-rules table, the repository persistence test, an authorization rule in `RULES` (the coverage test fails without
  it), the organisation export including geometry files, and a harness that draws, edits and saves an area.
- **Done when:** an officer can draw a camp boundary and a distribution route, and confirm 20 unplaced locations in one pass.

### 41.6 progress (2026-11-03)
- **Migration** `20261106090000_place_geometry` (additive: `Place.geometryKind`, `geometryKey`, `geometryBytes`, `placedBy`, all nullable). Applied to a scratch Postgres with the whole chain (`prisma migrate deploy`), drift check clean for these columns (only the known `EvidenceEmbedding.embedding` vector shows). **Not applied to production.** Deploy order: fresh backup, `prisma migrate deploy`, then code (`/ready` now requires `Place.geometryKind`). No RLS change (`Place` is already forced).
- **Domain** `places/geometry.ts`: `validateGeometry` is the one check for server and browser (closed ring, three real corners, a real area, no self-crossing, at most 2000 points and 1 MB, a route may cross itself, six decimals). Only an AREA place carries a shape (a POINT keeps its pin). `PLACED_BY` mirrored in the contracts and pinned by the architecture test.
- **Server**: `SetPlaceGeometryHandler` / `ClearPlaceGeometryHandler` (idempotent) / `GetPlaceGeometryHandler`; routes `GET|PUT|DELETE /v1/places/:id/geometry` (`project.view` / `project.edit`, in `RULES`); shape stored at `places/<tenant>/<id>.geojson`; audited `place.geometry_set|cleared`. `PrismaPlaceRepository.update` writes the new columns with `?? null` and a real-database test pins it (`PLACES_VERIFY_DATABASE_URL`). The organisation export leaves `geometryKey` out of the data and includes the shape files under `files/places/` when files are requested.
- **Web**: `DrawingTool` port (separate from `MapRenderer` and `PinPlacer`), `MapLibreAreaTool` (Terra Draw, refuses a self-crossing outline while it is being drawn), `AreaDrawer`, `PlaceShapeEditor` (Places list: "Draw outline" / "Edit outline" / "Edit route", only with the new map on), `BulkPlaceWalk` ("Place them on the map, one by one" in Places to confirm; saves through the ordinary places sheet).
- Parent warning compares with the parent place's own **drawn** outline when it has one; it is a warning, never a refusal. A shape cannot be drawn on the old ECharts map.
- Not done: reading the drawn shapes onto the results map and the Data Center "By place" roll-up (a drawn area is stored and shown in its editor only); `placedBy` is stored but no screen shows it yet.

### 41.7 Tenant boundary layers (many) and admin 4 upload
- **Build:**
  - Many `TenantMapLayer` rows. Upload stays GeoJSON on the server, with KML/KMZ/shapefile converted in the browser by the existing
    converters. `validateMapLayer` gains `pcodeField`/`nameField` picking (pure, with a preview of the first 10 features) and a level
    and country.
  - `TenantLayerBoundarySource` serves the layer as GeoJSON for that country and level. It is first in the source priority, and the
    catalog merges it.
  - Context layers keep the overlay rules: never reported against.
- **Tests:** a validator table, the source contract suite, and a test that a tenant layer for UGA ADM4 replaces the bundled one only for
  that tenant.
- **Done when:** an organisation without an open ADM4 source can upload its own and drill into it.

### 41.7 progress (2026-11-03)
- **Deviation from the plan, on purpose:** a **new table** `TenantBoundaryLayer` (organisation + country + level, unique together) instead of loosening `TenantMapLayer`. The old table is read by `tenantId` alone in its repository and by the old site map, so dropping its unique key would break both. The old single "custom map boundaries" card and route are untouched.
- **Migration** `20261107090000_tenant_boundary_layers`: one new table, nothing existing changes. Applied to the scratch Postgres on top of the whole chain; drift check clean (only the known `vector` column). Added to `infra/postgres/rls.sql` (forced RLS; the rls-coverage test passes). `/ready` requires `TenantBoundaryLayer.adminLevel`. **Not applied to production.**
- **Domain** `identity/boundary-layer.ts`: `guideBoundaryFields` (what the file holds and a suggested name / code / parent-code column for the level) and `validateBoundaryLayer` (one rule for server and browser). A file is normalised once into the app's own boundary format; polygons only; any bad boundary blocks the whole file and is named (no name, no code when a code column was chosen, duplicate code, not a polygon, outside the map); at most 12 MB, 20,000 boundaries, 60 files per organisation.
- **Server**: upload / list / read / remove handlers (administrators upload and remove, any member reads; audited `boundary_layer.uploaded|replaced|removed`); routes `PUT|GET /v1/organization/boundary-layers`, `GET .../:iso/:level/data`, `DELETE .../:iso/:level` (in `RULES`). The org export lists the table, leaves the storage key out and includes the files under `files/boundary-layers/`.
- **Web**: `TenantLayerBoundarySource` (a decorator over the shipped source, so a layer replaces one level for one country and nothing else), `originOf` on the port so the footer credits the organisation's own file (never a shipped file's credit), Settings card "Boundaries for a country and level" (reads the file in the browser, suggests the columns, uploads when the person confirms them). An uploaded file that cannot be read is never silently swapped for the shipped one.
- Not done: KML, KMZ or shapefile uploads for a boundary layer (GeoJSON only; the converters exist for overlays); the old ECharts map ignores uploaded layers (only the new map reads them).

### 41.8 Every surface on the new engine
- **Build:** move the Maps explorer, plan map, Overview "Where we work", portfolio map, dashboard MAP widget, photo map and share-link
  maps to `MapRenderer`. Share links get drill and slider over data read on the server per request: same `ShareLinkExtras` rules,
  boundaries are public, pins as today, no budget. Clustering is on wherever there are more than 200 pins.
- Delete `SiteMapFigure` and `LocationPickerFigure` once nothing imports them. `lib/client/map-assets.ts` keeps only what exports and
  the fallback need.
- **Tests:** existing harnesses (`test:maps-extras`, `test:tiles`, `test:visuals`) updated to the new engine, with maps no longer
  hidden in `test:visuals`. A new `test:maps` harness: drill, breadcrumb, pin, draw, bulk place, share link (about 15 checks).
- **Done when:** no screen imports ECharts for an interactive map, except the fallback adapter.

### 41.8 progress (2026-11-03)
- **One switch for every "sites on a map".** `SiteMap` (`maps/presentation/SiteMap.tsx`) replaces `SiteMapFigure` in the plan's Map view, the project Overview ("Where we work"), the portfolio map and the photos map: the new map when the browser can draw it and it is switched on, the old figure otherwise. Same points in (`SiteMapPoint`), same facts out: a dot per place coloured by its worst delivery signal, sized by how much happens there, a plain-text tooltip naming each item and open risk, clustering past 200 sites (`build-site-scene.ts`, pure and tested). Context outlines go under the dots: the organisation's old single uploaded layer if it has one (so those organisations lose nothing), else the country's provinces, else the world.
- **The explorer, the pin picker and the dashboard map card were already on the new engine** (41.2-41.5). The dashboard's "Where activities are" card goes through `PlanMapView`, so it moved with the switch.
- **Share links drill and slide.** New public endpoint `GET /public/dashboards/:token/map-results?widget=&level=&periodId=` (and a Next proxy `/api/shared/dashboard/[token]/map-results`). What keeps it safe, each pinned by a test: the project is the one stored on that dashboard's map widget (the request never names one); only a "results by place" map widget of that dashboard can be asked; levels 0 to 4 only; the reader is the same read-only outside guest a link already draws as, and place results carry no finance; unknown, expired and revoked links and unknown widgets all answer "not available". A map with no link in scope stays the fixed view it was sent as.
- **What a link now shows, for the person making one to know:** results by place down to the finest level (districts, wards) and for each reporting period, not only the province snapshot. The page text already says maps show results by place as they stand.
- **Not deleted, on purpose:** `SiteMapFigure`, `LocationPickerFigure`, `MapCanvas` and `lib/client/map-assets.ts` are still the fallback for a machine with no WebGL and for the default (old) engine. They can go only when the default flips to the new engine, which waits for the tiles to be on the host.
- **Harnesses:** maps-extras, dashboard-tiles and dashboard-templates had stopped bundling since 41.2 (the map services reach a server-only module); they now alias `@/lib/actions/org` to a stub. New in `test:maps`: share-link slider and drilling, the fixed view without a link, the sites map tooltip.
- **Two bugs this batch found in earlier work, both fixed:** (1) `MapLibreCanvas` wrote `onNote?.(renderer.draw(scene).note)`: with no `onNote` the whole expression, including `draw`, is skipped, so any map without that prop stayed blank (this batch's sites map, and the side-by-side period panels since 41.2; the main explorer passed it, which hid the bug). It now draws first and then tells. A harness check now covers the period panels. (2) The older harnesses (maps-extras, dashboard-tiles, dashboard-templates) had stopped bundling and, once they did, could not read `process.env.NEXT_PUBLIC_MAP_ENGINE`; their builds now alias the organisation actions to a stub and define the flag as `"echarts"` (they were written for that engine). A lone site is shown with about a district around it (not zoomed to its own street).
- Harness speed: `MAPS_FAST=1` skips the stylesheet build (the slow part; sizes the map classes by hand) and `MAPS_ONLY=<text>` runs only matching checks, so one check iterates in about a minute; the full run (about 8 minutes) is still the one to trust.
- Deploy: no migration. API and web together. nginx (the repo copy `infra/nginx/donordesk.online.nginx.ssl.conf_apiv1` now has it): the new public path `/api/shared/dashboard/` needs the same rate limit as `/shared/dashboard/` (a per-address zone) before a link is handed out.

### 41.9 Accessibility, low data, languages
- **Build:**
  - Every map has a "View as table" (places, level, value, status) from the same `MapScene`. Keyboard: Tab to the map, arrows pan,
    +/− zoom, Enter selects the focused feature (feature focus ring via the renderer's `focus(featureRef)`). The screen-reader label is
    generated from the scene.
  - Low-data mode shows the table and the ECharts fallback (no tiles).
  - Copy for every new label goes in the typed catalogue in four languages (drafts, review owed). Arabic uses the MapLibre RTL plugin,
    and geography is never mirrored (`flipBack` rule).
- **Tests:** an i18n completeness test and a copy-lint test (no raw codes; P-codes are shown only in the place panel, labelled "Code").
- **Done when:** the map flows can be completed with a keyboard only, and low-data mode loads no tiles.

### 41.9 progress (2026-11-03)
- **Every map is also a table.** `buildMapTable` / `buildSiteTable` (pure, `domain/table/map-table.ts`) build the table from the same model the map is drawn from, so the two cannot disagree: a place with no figure says "Not measured" (never 0), a recorded zero stays "0", a place the map could not draw is listed and marked "Not on the map". `MapDataTable` / `SitesTable` are plain semantic tables; each results row has a "Show details" button that opens the place the same way a click on the map does. A "View as a table" button sits under the results map and the sites map.
- **Keyboard.** The map's own canvas is the one tab stop (MapLibre's keyboard handler: arrow keys pan, + and - zoom) and is named with what the whole map shows; the wrapper is only a labelled group. **Deviation from the plan:** no `focus(featureRef)` ring on individual boundaries: the table with its "Show details" buttons is the keyboard way to choose and open a place, and breadcrumbs and "Open its ..." are already buttons. Revisit if a person asks for arrow-key movement between boundaries.
- **Low-data mode** (`useLowData`, already on this device or asked for by the browser): the results map becomes `LowDataResults` (the table with the indicator, level, period and place details, no map library, no tiles, no boundary files) and the sites map becomes its table; "Show the map anyway" is one click. A harness check proves no request reaches `/tiles/` or `/geo/` until the map is asked for. This goes ahead of the engine choice, so the ECharts explorer is covered too.
- **Four languages.** 170 `maps.*` messages in the typed catalogue (`en`, `fr`, `es`, `ar`; the existing completeness, placeholder and no-raw-code tests cover them). Counts are written number-neutrally ("Placed: {placed} · skipped: {skipped}") so Arabic needs no plural tables. The English-only tables in the domain became **codes**: `PIN_PROBLEMS`, `GPS_FAILURES`, `GEOMETRY_PROBLEMS` (every shape refusal carries `details.code` and `details.params`), the basemap note (`NO_BASEMAP`) and the upload credit (`BoundaryOrigin`); the words live only in the catalogue. A test checks every code has an English sentence. `describeShape`, `mapSummary` (new screens), `levelName` and the `PIN_COPY` / `DRAW_COPY` tables are gone.
- **Arabic.** The page turns right to left (the provider already did); the basemap names places in the person's language (`lang` on the Protomaps style: en, fr, es, ar) and Arabic labels are shaped by MapLibre's right-to-left text plugin, **hosted by us** (`apps/web/public/vendor/mapbox-gl-rtl-text.js`, v0.3.0, BSD-2 with its licence beside it; lazy, fetched only when such text is first drawn). Geography is never mirrored; legend ranges, table figures and coordinates are isolated as left-to-right (`<bdi dir="ltr">`) so digits do not scramble. The three label fonts already include the Arabic range.
- **The translations are drafts without a native reviewer** (Arabic and the sector terms first), like the wizard's.
- **Not translated (older English, outside this phase's new labels):** the explorer's side panels (`PlacePanel`, `LayerPanel`, `OverlayPanel`, `PeriodSlider`), the photos panel, the ECharts explorer and old figures, the delivery words in site tooltips (`Late`, `Done`), the domain's `validateBoundaryLayer` / `guideBoundaryFields` sentences on the settings card, and server-side refusals. The map's hover tooltips use the names and sentences from the data (English where the data is).
- Not done in this batch: nothing to deploy beyond the code; the plugin file ships with the web build (`public/vendor`).

### 41.10 Hardening and deploy
- Performance budget: map chunk ≤ 350 KB gzip, first map ≤ 2.5 s on "Fast 3G" in the harness, ADM4 BGD view ≤ 150 MB memory.
- nginx rate limit for `/tiles/` (high burst, per address).
- **Offline on phones is deferred:** packing tiles per project for `/field` is possible with PMTiles, but it needs a size decision and a
  lost-phone review (the pack rule in Phase 33.6). It is recorded as Phase 42 material.
- Deploy: fresh backup, migration, RLS, `sync-tiles.sh`, nginx include and reload, then `deploy-fast.sh SCOPE=both` (add
  `BUILD_ON=host` if it helps).
- AGENTS.md "Phase 41 invariants" section; support article drafts in `_unpublished-phase41/`.

## 8. Invariants to add to AGENTS.md when built

- Only `features/maps/adapters/**` imports `maplibre-gl`, `terra-draw`, `pmtiles` or `echarts` for interactive maps. Everything else
  talks to the ports.
- A layer kind, boundary source or marking tool is a registry row. There is no `switch` on them outside their registry.
- The available levels per country come from `catalog.json` (merged with tenant layers), never from a hard-coded depth.
- Areas join by P-code first. A name-only match is flagged, never silent.
- Snapping and containing-area are suggestions. The person's choice of parent is never overwritten.
- Drawn geometry lives in storage, not in a row. Every geometry write is audited.
- Exports and reports keep the ECharts/SVG renderer: deterministic bytes.
- A missing value is grey, never 0. A rate is never combined. An unplaced place is listed, never guessed.

## 9. Risks and open decisions (the user's to make)

| # | Decision or risk | Default if not decided |
|---|---|---|
| 1 | Ship ODbL / BY-SA boundary files (20 held)? No application is needed: attribution plus offering the derived file under the same licence (§5.3) | Ship with `/maps/sources` in 41.1, pending the user's yes |
| 2 | Disk for tiles (2–6 GB) | Resolved: 32 GB free on the host |
| 3 | Basemap regions first | Agreed: East Africa, Sahel and Horn, South Asia |
| 4 | Satellite imagery is not possible without a vendor. Accept "terrain" instead? | Yes, said honestly in the picker |
| 5 | ADM4 coverage is partial by nature. Say so on the public site? | Public copy says "down to the finest open boundaries available, to admin 4 in N countries", with N from the coverage report |
| 6 | MapLibre needs WebGL. Old field laptops use the ECharts fallback | Automatic fallback |

## 10. Estimate

| Batch | Size |
|---|---|
| 41.0 | 0.5 day |
| 41.1 | 2–3 days (downloads dominate) |
| 41.2 | 3 days |
| 41.3 | 1.5 days |
| 41.4 | 3 days |
| 41.5 | 2 days |
| 41.6 | 3 days |
| 41.7 | 2 days |
| 41.8 | 3 days |
| 41.9 | 2 days |
| 41.10 | 1 day |

Total about 4–5 weeks of focused work. 41.1 and 41.2 can run in parallel.

## 41.10 progress (2026-11-03)
Built: `scripts/sync-tiles.sh` (disk guard, dry run checked: host ~66% → ~68%), `deploy-fast.sh` excludes `tiles`, nginx `/tiles/` + `dd_tiles` zone + `/api/shared/dashboard/` (repo copies only), per-country province files (`ADM1/`, 239 files), `/maps/sources` page, coverage report (`phase41-coverage.md`, `apps/web/scripts/build-coverage-report.mjs`; re-run after the boundary job ends), budget harness, AGENTS.md invariants, support drafts in `memorybank/docs/support/_unpublished-phase41/`. Typecheck, architecture (19) and unit (57) tests green.
Missed: first-map 2.5 s target (about 15 s Fast 3G). Owed: signed-in browser check of the real app, native review of translations.
Deploy runbook: see AGENTS.md "Phase 41 invariants" → Deploy. Not run: needs the owner's go-ahead.
