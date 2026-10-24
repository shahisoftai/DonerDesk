# Phase 30 — Maps (project planning + project Overview)

**Status (2026-10-24): implemented, web only.** No migration, no new env, no API change — the
free-text `PlannedActivity.location` field already exists end-to-end (schema → domain → contract →
form → `WorkPlanRowDto`), and `ProjectRisk.plannedActivityId` already links a risk to a planned
activity, so overlays derive from existing reads.

**Goal.** Show *where* work happens, on two surfaces: a **Map** view on the project's plan
(Activities) page, and a **"Where we work"** section on the project Overview. Pins are colored by
the delivery signal the rest of the app already computes; a site with problems says so; achievements
are the counts the plan list already shows.

**Rendering: ECharts `geo`** (already a dependency — `echarts@^6.1.0`, used by `ChartFigure.tsx` and
the export PNG renderer). All geo data is bundled: no tile server, no geocoding service, nothing
location-related leaves the tenant. Works offline once loaded.

## Why

The Overview says *how* the project is going and *when* things are due; neither page says *where*.
The officer already types a location on every planned activity; that text just has never been read
back. Phase 30 reads it: match it against a bundled place gazetteer, plot the sites, color them with
the signals the domain already derives, and attach the risks that point at them.

## §1 Geo data assets (bundled, generated once)

All in `apps/web/src/features/workplan/domain/geo/`, generated from Natural Earth (public domain)
by the committed script `apps/web/scripts/build-site-geo.mjs`:

| Module | Content | Depth | Size |
|---|---|---|---|
| `world-geo.ts` | 177 country polygons (props: `name`, `iso`) | Country outlines | ~170 KB |
| `admin1-geo.ts` | 4,177 province/state polygons (props: `name`, `iso` = country ISO, `country`), Douglas-Peucker 0.05° | Province outlines | ~2.2 MB |
| `gazetteer.ts` | 7,341 populated places: `name`, `alt?`, `c` (country), `p1?` (province), `lat`, `lng`, `pop` | District/town **points** (a district usually matches by its main town) | ~650 KB |

Depth: country + province are real polygons; district and below are points resolved by name.
Sub-district names that match no gazetteer place are honestly listed as "not placed" — never
invented. `world-geo` is imported only inside `SiteMapFigure` (dynamic import, lazy chunk);
`admin1-geo` is imported only when a country is focused. The gazetteer is imported by
`site-map.ts` and loaded lazily wherever that module is used.

Regenerate: download `ne_110m_admin_0_countries`, `ne_10m_admin_1_states_provinces`,
`ne_10m_populated_places_simple` from the natural-earth-vector GitHub `geojson/` directory and run
the script with their paths.

## §2 Site resolution (pure)

`apps/web/src/features/workplan/domain/site-map.ts` — pure TypeScript (no React, no server, no
clock; the only imports are `plain-date`-style domain modules and the geo data):

- `normalizePlace(value)` — folds diacritics, lowercases, strips admin suffixes
  ("district", "sub-county", "province", "state", "region", "municipal", "city", "town"), collapses
  whitespace. `"Gulu District"` → `"gulu"`.
- `resolveSitePoint(location, country?)` — matches the officer's text against the gazetteer: exact
  `name`/`alt`, then normalized, then suffix-stripped; restricted to the project's country when one
  is known (normalized country-name match); ties broken by population. No match → `null` (the site
  is reported as unplaced, never guessed).
- `suggestPlaces(input, country?, limit)` — prefix before substring matches, highest population
  first; feeds the plan form's `<datalist>`.
- `siteMapData(rows, { risks?, country? })` — aggregates `WorkPlanRow`-shaped inputs into points:
  items at the same place share a pin; `worst` signal by the fixed precedence LATE > ON_TIME >
  DONE > CANCELLED; OPEN risks attach through `plannedActivityId → item → point`; unplaced rows are
  listed; summary counts returned.
- `SITE_SIGNAL_COLOR` — one exhaustive table over `DeliverySignal` (the only place pin colors are
  decided). Labels come from the existing `DELIVERY_SIGNAL_LABEL`.
- `countryView(worldGeo, country)` — bbox center + zoom for a country name; `null` when unknown.
- `siteMapOption(points, { focus?, provinces? })` and `siteTooltip(params)` — the ECharts option
  (world `geo` + optional province `map` series bound to the same `geoIndex` + one `scatter`
  series) and its tooltip text. Colors, sizes and text all come from the tables above.

## §3 Surfaces

**Plan page — Map view.** `PlanViewKey` gains `"MAP"` (`role-surfaces.ts`); `PlannedViews` shows a
third toggle (label `WORKPLAN_COPY.viewMap`, "Map") and renders `PlanMapView`: the same `rows` the
List and Timeline already receive, mapped through `siteMapData`, plus the project's open risks
(the activities page already can read `GET /v1/projects/:id/risks`; a country comes from the
project detail it already loads). Legend = the four signal labels and their colors; below the map,
the unplaced list and the counts sentence. The switch shows on the same widths as the other views
(≥640 px, where the List/Timeline toggle lives); no role defaults to MAP.

**Overview — LOCATION section.** New key in `overview-sections.ts` (union, order, every role row,
capability `null`, `fitsTheProject` → `facts.hasSites`, label "Where we work"). `OverviewFacts`
gains `hasSites` — computed in `overview-read-model.ts` as "at least one plan row's location
resolves against the project's country". Section data = `siteMapData(...)` + the project's country
and region. `LocationSection.tsx` renders the map, the counts sentence, and links to the plan —
it reads; every action is a link. Hidden, never disabled, for every role when nothing resolves.

**Plan form.** The existing Location input gains a `<datalist>` of suggestions from
`suggestPlaces(location, project country)`; `site-map` is loaded lazily on first keystroke so the
gazetteer never enters the form's initial chunk. Filling stays free text — suggestions never
overwrite what is typed (the "proposals fill, never overwrite" rule).

**`SiteMapFigure.tsx`** (`features/workplan/presentation`, `"use client"`) — the only file that
touches `echarts`: dynamic-imports echarts + the geo modules, `registerMap`s them once
(module-level promise cache), mirrors the `EChartFigure` mount/resize/dispose pattern, and falls
back to a plain sentence (`WORKPLAN_COPY.mapUnavailable`) when the assets cannot load. Props are
plain data (`SiteMapData`, `country`, `caption`) — nothing crosses the server/client boundary but
ids, strings and numbers.

## §4 SOLID, concretely

- **S** — `site-map.ts` only turns text+rows into meaning (points, worst signal, counts);
  `siteMapOption`/`siteTooltip` only shape ECharts data; `SiteMapFigure` only renders (import,
  register, mount, resize, dispose); `PlannedViews`/`page.tsx` only compose; section policy lives
  only in `overview-sections.ts`; user-visible words live only in `WORKPLAN_COPY` /
  `OVERVIEW_SECTION_LABEL`.
- **O** — new pin color = a new row in `SITE_SIGNAL_COLOR` (exhaustive over `DeliverySignal`, so a
  new signal fails to compile until decided); a new overlay (e.g. beneficiaries per site) is a new
  field on `SiteMapPoint` + a line in `siteTooltip` — no branching elsewhere; a new surface reuses
  `siteMapData` + `SiteMapFigure` unchanged.
- **L** — `SiteMapFigure` honors the `EChartFigure` contract (plain option record in, `role="img"`
  + caption, lazy load, resize, dispose), so it substitutes anywhere a figure is expected; the
  option it passes is built by the same pure-builder pattern as `optionFromResolved`.
- **I** — inputs are narrow, purpose-built shapes (`SitePointInput`, `SiteRiskInput`), not
  `WorkPlanRow`/`RiskItem`; callers map at the boundary, so the domain module never learns about
  the API schemas and the map never drags the plan page's prop types around.
- **D** — `SiteMapFigure` depends on the option-builder abstraction, never on ECharts internals;
  both surfaces depend on `siteMapData`'s output, and the read model / page inject plain data —
  no component fetches, no server import in anything the client loads.

## §5 Rules the implementation must not break

- **Color is the existing signal, never a new score.** Pins reuse `deliverySignal` /
  `DELIVERY_SIGNAL_LABEL`; the map introduces no health metric and no projection.
- **An unmatched place is listed, never invented.** No guessed coordinates, no geocoder call, no
  silent drop: the unplaced list says which items could not be placed.
- **All geo data is bundled.** No tile server, no geocoding API, no third-party map requests — a
  location never leaves the tenant, and the map works offline once loaded.
- **Nothing geo enters a first bundle.** ECharts, the geo assets, the gazetteer and the option
  builder load only when a map is actually drawn (`SiteMapFigure` loads them inside its effect;
  the plan page's Map view is a `React.lazy` chunk) — measured: the Overview page stays at
  ~131 kB first-load JS with the section present.
- **The map reads; it never writes.** Every action on it is a link to the surface that owns the
  work. No new mutation, endpoint or audit event.
- **A section a role cannot use is hidden, never disabled** — LOCATION follows `sectionsFor` like
  every other part, hides itself when no site resolves, and — because its sites come from the plan —
  is also hidden when "Show work planning" is off (the Phase 28 rule: off hides every plan screen).
- **Officer-typed words are escaped before the tooltip's HTML** (`escapeHtml` in `site-map.ts`) —
  ECharts renders the tooltip as HTML, so a title is text, never markup.
- **User-visible words come from the copy tables** (`WORKPLAN_COPY`, `OVERVIEW_SECTION_LABEL`) —
  the copy lint scans them; no raw codes, no snake_case in a label.
- **Only `SiteMapFigure` touches ECharts**, and it loads it (and the geo assets) dynamically —
  the initial bundle gains nothing.
- **Server pages pass data, never functions** — the server/client boundary test keeps holding.

## §6 Role matrix (LOCATION)

| Role | Sees "Where we work" |
|---|---|
| ADMIN, PROJECT_MANAGER, ME_OFFICER, GRANTS_OFFICER, COMPLIANCE_OFFICER, FIELD_OFFICER, VIEWER | Yes, when `hasSites` (the section hides itself otherwise) |

The plan Map view follows the existing view toggle (all roles, all widths).

## §7 Tests

- `apps/web/tests/unit/site-map.test.mts` (new) — normalization, resolution (exact, diacritics,
  suffix, country filter, population tie-break, no-invention on miss), aggregation (shared pin,
  worst-signal precedence, cancelled-only), risk attachment (open only, via
  `plannedActivityId`), unplaced list, counts, `countryView` on a synthetic feature,
  `siteMapOption` (colors per signal, province series only when focused, `[lng, lat]` order,
  formatter present), gazetteer sanity (lat/lng in range, no duplicate keys).
- `apps/web/tests/unit/overview-sections.test.mts` — LOCATION in the order/capability tables, the
  updated role rows (FIELD_OFFICER and VIEWER are pinned verbatim), `facts` helper gains
  `hasSites`.
- `workplan-view.test.mts` copy scan picks up the new `WORKPLAN_COPY` entries automatically.
- Boundary suites (`test:architecture`, `server-client-boundary.test.mts`) must stay green.

## §8 Deployment

Web only. No migration, no new env, no API change. Ship with `SCOPE=web` semantics (web may ship
alone; the API is untouched). Nothing to run by hand.

## §9 Not built (later)

- Beneficiary counts per site (gazetteer matching for `Beneficiary.location` is the same resolver,
  so it is additive).
- Caching the geo chunks in the offline service worker (none exists yet).

## §10 Batch 30.1 — pinned places, the workspace's own boundaries, deeper outlines (2026-10-24)

**Pin a place by hand (§2's workaround, built).** `PlannedActivity` gains optional `latitude`/
`longitude` (WGS84, validated together-or-neither, in range, in the domain's `validateDetails` and
mirrored in the contracts with `Latitude`/`Longitude` field labels). A row with coordinates plots
**exactly there** — `siteMapData` keys pinned rows by their coordinates and never name-matches them;
a pinned row with no text names itself `WORKPLAN_COPY.mapPinned` ("Pinned place"). The plan form has
`LocationPickerFigure`: click the map (the workspace's own layer when there is one, the world
otherwise) to drop the pin; numbers are editable by the domain alone — the picker emits rounded
values, the form submits `latitude`/`longitude`, and the PUT route accepts `null` to clear.
Pinning never writes anything by itself: the pin exists only once the form is saved.

**The workspace's own boundaries (§3, built).** One GeoJSON layer per organization
(`TenantMapLayer`, RLS-forced, one row per tenant): `POST /v1/organization/map-layer` (multipart,
`org.manage`, validated by the pure `validateMapLayer` — FeatureCollection, every feature has a
geometry, 12 MB cap — stored via `IStorage` at `map-layers/<tenantId>.json`, metadata in the table,
audited), `GET …/map-layer` (metadata), `GET …/map-layer/data` (the GeoJSON itself,
`project.view`), `DELETE …/map-layer` (`org.manage`, audited). Upload and removal live in Settings
(`MapLayerCard`, administrators only). When a layer exists, `SiteMapFigure` registers it as
`donordesk-custom` and draws **it** as the base map — the bundled world map, province overlay and
country focus step aside (the layer is the authority on boundaries). Everything loads through the
shared `lib/client/map-assets.ts` loader; nothing geo enters a first bundle.

**Deeper outlines (§1, built as far as offline data allows).** Province borders draw prominently
(darker, width 1) over the focused country; districts and sub-districts have no offline polygons —
they arrive as points from the gazetteer, or as polygons through the workspace's own uploaded layer.
Migration `20261024090000_map_layers_and_pins` (additive: two columns + one table, applied with the
code), then re-run `infra/postgres/rls.sql` (TenantMapLayer joined the RLS list);
`/ready` requires `PlannedActivity.latitude/longitude` and `TenantMapLayer.storageKey`.

Not built: editing an existing activity's pin from the item page (the PUT route and the picker
already support it — only the editor UI is missing); Shapefile conversion (upload GeoJSON).

## §11 Implementation notes (batch 30.1, written after the build — what actually happened)

**Built in one pass, on branch `0014-maps`.** Ordered as: audit (three explore agents) → this plan → geo asset generation → pure modules → components → backend → tests → browser verification. What the browser verification then caught, in order:

1. **The client fetch of the layer went to the wrong server.** The picker fetched `/v1/organization/map-layer/data` — but the browser talks to the **web** app (port 3000), which has no `/v1` routes. Fixed with a small proxy route, `app/api/organization/map-layer/data/route.ts` (session cookie → `getSessionToken` → forwards to `apiBaseUrl()`, streams the body), and all client URLs now use `/api/organization/map-layer/data`. Lesson: anything a **browser** fetches must live under the web app's `/api/**` proxy (precedent: `/api/organization/export`, `/api/files/[...key]`).
2. **The picker's click handler never fired.** It started with `if (event.target) return;` (the usual "only empty-area clicks" guard) — but an ECharts **geo background is itself a zrender target**, so every click was dropped. Any click now converts via `chart.convertFromPixel({ geoIndex: 0 }, [offsetX, offsetY])`; clicking an existing pin simply re-pins that spot.
3. **Two probe red herrings that cost time, for the next person:** (a) automated clicks landed **below the viewport** — the picker sits at the bottom of a long form, `page.mouse.click` at `y ≈ 999` in a 950 px viewport silently does nothing and `document.elementFromPoint` returns `null`; scroll into view first, then re-measure the box. (b) A long-running `next dev` serves **stale chunks** after many edits — a freshly edited component ran old code until the dev server was restarted. When a just-edited client component "doesn't work in the browser", restart dev before debugging.
4. **The Prisma client is generated after `tsc` in the infra build script** (`tsc && prisma generate`): after touching `schema.prisma`, run `npx prisma generate` **first**, or `tsc` fails on the missing model (`tenantMapLayer`). Also: one sed-style edit glued `model PlannedActivity {` and its `id` line onto one line — Prisma's error for that is an unrelated-sounding "no unique criteria"; check the model header first.
5. **`TenantId` is a class**, not a string alias — a repository record that carries one must be built with `TenantId.create(row.tenantId)`, not a cast.

**Verification, final state:** domain 806, web 443, architecture 3, rls-coverage 4 — all pass; api + web typecheck clean; production build green (Overview first-load ~132 kB, unchanged in practice — nothing geo is eager). Browser-verified on the demo tenant (`mnpiracha@gmail.com`, the demo-8/9 style projects): uploaded a Pakistan provinces slice as the custom layer in Settings → every map draws it; pinned "Water trucking at the new camp site" at `30.37, 71.1717` from the form → saved with coordinates → rendered on the plan map over the custom layer; the unplaced list still names "Atlantis Valley" honestly. The demo data itself taught one last domain lesson: **`status = 'LATE'` is not a real plan status** (lateness is derived from dates); storing it fails the row schema — statuses are PLANNED/IN_PROGRESS/DONE/CANCELLED only.

**Scope choice recorded:** district/sub-district **polygons** come only through the uploaded layer (§10) — bundling world admin-2 was rejected (multi-GB); province polygons stay Natural Earth admin-1. The gazetteer's 10 m population-weighted places cover district-name matching as points.
