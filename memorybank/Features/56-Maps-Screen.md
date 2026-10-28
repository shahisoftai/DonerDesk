# Feature 56: The Maps screen (results by place)

**DonorDesk Version 3.007 (Phase 34.4, first slice)**
**Status:** built, tested and deployed 2026-10-28 (no migration). Not yet tried by a person in the signed-in app; the downloads have no browser-harness check yet.
**Rules:** `AGENTS.md` → "Phase 34.0/34.1/34.3" (maps draw on the bundled geography only) and "Phase 30/33" (places).

## What a person gets

- **`/projects/:id/maps`** (link on the Data Center page): the Chart Studio in map mode, limited to **results by place**. It starts as graduated symbols one level below the country and offers the geographic, comparison, part-to-whole and table kinds: graduated symbols, country choropleth on the bundled world map, rankings, treemap, pie, table.
- **Level**: choose how deep in the place tree to read (country, first-level area …).
- **Saved map views** (the studio's saved charts, filtered to place-based ones), PNG and SVG export.
- **KML and GeoJSON downloads** of the places that have a pin, with the indicator and its value on each placemark. A place with a value but no pin is named under the chart and left out of the files; a place with no value is written as "no value recorded", never 0.

## Rules

- A map draws on the bundled geography only: no tile server, nothing leaves the tenant.
- A graduated-symbol map needs a pin; a choropleth colours countries only and reports a name the map does not know; a country with no value is grey, never zero.
- A rate is shown for the place that recorded it and never combined across places.

## Not built (the rest of 34.4)

Layer panel (several layers, order, opacity); time slider and small multiples by period (need period-aware place results); upload of KML, GeoJSON or shapefile layers; photo layer; a place panel listing the projects working there; print layout; boundaries for every country and level (the licence check is open); the online-tile opt-in; choropleth below country level.
