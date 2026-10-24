# Feature 43: Site maps — where the work happens, on the plan and the Overview

**DonorDesk Version 2.007 (Phase 30 + batch 30.1)**

**Author:** Claude (agent) · **Date:** 2026-10-24
**Status:** Phase 30 IMPLEMENTED 2026-10-24 (web only, no migration); batch 30.1 IMPLEMENTED the same day (migration `20261024090000_map_layers_and_pins`, one new table). Both browser-verified with the demo tenant (`mnpiracha@gmail.com`, demo-8/9 style projects): custom boundaries uploaded in Settings, every map switched to them, a place pinned by hand from the form and rendered on the plan map. Plan: [`../imp/phase30-maps.md`] (§1–§9 phase 30, §10 batch 30.1). Invariants: `AGENTS.md` → "Phase 30 invariants — maps".

## 1. What a person gets

| Piece | In plain words | Where it shows |
|---|---|---|
| Map view on the plan | A third view beside List and Timeline: one dot per place with planned activities, its color the worst delivery state there (red late, green on time, blue done, grey cancelled), bigger when more activities share it; open risks raised at a site are named in its tooltip; a legend and a counts sentence ("6 sites · 1 site late · 3 sites on time · 2 sites done · 1 risk open") | Project → Activities → **Map** |
| "Where we work" | The same map on the project Overview: the country focused with its provinces outlined, the counts sentence, the "See the plan" link; hidden when no activity sits at a known place | Project Overview → **LOCATION** |
| Places from words | The location an officer already types ("Gulu District", "Kampala") is matched against a bundled gazetteer of 7,341 places — offline, no geocoding service, nothing leaves the workspace. An unmatched place is listed under the map ("Not placed on the map") — never guessed | Plan map, Overview map, and the unplaced list |
| Pin a place by hand | A place the gazetteer does not know ("Atlantis Valley sub-camp") can be pinned: "Place it on the map" opens a small map, clicking drops the pin, the coordinates save with the activity and plot exactly there (batch 30.1) | Planned-activity form → More details |
| Your own boundaries | One uploaded GeoJSON per workspace — districts, sub-districts, project zones — replaces the built-in country and province outlines on **every** map (batch 30.1). Upload, replace and remove are administrator-only and audited | Settings → **Custom map boundaries** |
| Place suggestions | Typing in the form's Location field suggests known places (a lazy `datalist`, filtered to the project's country first); suggestions never overwrite what is typed | Planned-activity form |

## 2. Rules that matter

- **Color is the existing signal, never a new score.** `SITE_SIGNAL_COLOR` is one exhaustive table over `DeliverySignal`; worst-first precedence LATE > ON_TIME > DONE > CANCELLED; labels come from `DELIVERY_SIGNAL_LABEL`. The map invents no health metric and no projection.
- **An unmatched place is listed, never invented.** No guessed coordinates, no silent drop. A row with hand-placed coordinates (both or neither — validated in the domain) plots exactly there and is never name-matched.
- **All geo data is bundled** (`apps/web/src/features/workplan/domain/geo/`, generated from Natural Earth by `apps/web/scripts/build-site-geo.mjs`): 177 country outlines, 4,177 province polygons (simplified to ~5 km), the gazetteer. No tile server, no geocoding API. Depth: country + province are polygons; district and below are points, or polygons through the workspace's own uploaded layer.
- **The workspace's own boundaries beat the bundled ones.** One `TenantMapLayer` per organisation (RLS-forced, bytes at `map-layers/<tenantId>.json` in storage, metadata in the table). When present, `SiteMapFigure` registers it as `donordesk-custom` and draws it as the base map; the world map, province overlay and country focus step aside. Upload/replace/remove are `org.manage` + audited; reading the boundaries is `project.view` — the same rule as the maps themselves.
- **Nothing geo enters a first bundle.** ECharts, the geo assets, the gazetteer and the option builder load only when a map is actually drawn (`SiteMapFigure`'s effect; the plan page's Map view is a `React.lazy` chunk; the form loads suggestions on first keystroke). Overview first-load stays ~132 kB.
- **The map reads; it never writes.** Every action on it is a link to the surface that owns the work. A pin exists only once the form is saved.
- **A section a role cannot use is hidden, never disabled.** LOCATION follows `sectionsFor` like every Overview part, hides when no site resolves, and — because its sites come from the plan — also when "Show work planning" is off.
- **Officer-typed words are escaped** before the tooltip's HTML (`escapeHtml` in `site-map.ts`).
- **User-visible words come from the copy tables** (`WORKPLAN_COPY`, `OVERVIEW_SECTION_LABEL`); the copy lint scans them.

## 3. Where it lives

| Layer | Path |
|---|---|
| Web domain (pure) | `features/workplan/domain/site-map.ts` (normalise, resolve, `siteMapData`, `siteMapSummary`, `SITE_SIGNAL_COLOR`, `countryView`, `provincesOf`, `siteTooltip`, `siteMapOption`), `domain/geo/{world-geo,admin1-geo,gazetteer,geo-types}.ts` (generated), `features/projects/domain/overview-sections.ts` (LOCATION key + `hasSites` fact) |
| Web presentation | `features/workplan/presentation/{SiteMapFigure,PlanMapView,LocationPickerFigure}.tsx`, `PlannedViews.tsx` (MAP toggle), `features/projects/presentation/overview/LocationSection.tsx`, `features/settings/presentation/MapLayerCard.tsx`, `lib/client/map-assets.ts` (the one loader) |
| Web data | `lib/server/schemas.ts` (`WorkPlanRowSchema.latitude/longitude`, `MapLayerMetaSchema`), `lib/actions/org.ts` (`uploadMapLayerAction`, `removeMapLayerAction`), `app/api/organization/map-layer/data/route.ts` (session-cookie proxy for the client fetch) |
| Domain package | `contexts/workplan/planned-activity.ts` (`latitude`/`longitude` in details + `validateDetails`, `MIN/MAX_LATITUDE/LONGITUDE`), `contexts/identity/map-layer.ts` (`validateMapLayer`, `MAP_LAYER_MAX_BYTES`), `contexts/workplan/workplan-copy.ts` (map words) |
| Contracts | `workplan.ts` (create/update `latitude`/`longitude`, nullable on update), `validation-text.ts` (Latitude, Longitude) |
| Application | `use-cases/workplan/work-plan-row.ts` (row carries coordinates), `use-cases/organization/map-layer-handlers.ts` (upload/get/read/remove, audited), `ports/identity.ts` (`ITenantMapLayerRepository`) |
| Infrastructure | `repositories/tenant-map-layer.ts`, `repositories/work-plan/planned-activity.ts` (persist + read-back), `container.ts` wiring, migration `20261024090000_map_layers_and_pins`, `infra/postgres/rls.sql` (TenantMapLayer) |
| API | `routes/org.ts` (`POST/GET/DELETE /v1/organization/map-layer`, `GET …/data`), `middleware/authorization.ts` (4 rules), `routes/health.ts` (`/ready`: PlannedActivity.latitude/longitude, TenantMapLayer.storageKey) |

## 4. How a place becomes a dot

1. **Hand-placed wins.** A row with `latitude` + `longitude` (both validated) is plotted exactly there, keyed by rounded coordinates, named by the typed text or "Pinned place".
2. **Otherwise the text is matched** (`resolveSitePoint`): fold diacritics → strip admin suffixes ("Gulu District" is "Gulu") → prefer the project's own country (prefix match: "United States" → "United States of America") → break ties by population → trim trailing words. No match → the unplaced list.
3. **Rows at the same place share a pin**; the pin shows the worst signal among them; OPEN risks attach through `plannedActivityId`.

## 5. Deployment

Batch 30.1 is the first maps deploy with a migration: apply `20261024090000_map_layers_and_pins` **by hand, before the code** (two columns on PlannedActivity, one new table), then re-run `infra/postgres/rls.sql` (TenantMapLayer joined the policy list), then ship api + web together (`SCOPE=both`). `/ready` requires `PlannedActivity.latitude`, `PlannedActivity.longitude`, `TenantMapLayer.storageKey`. No new env. The generator script (`apps/web/scripts/build-site-geo.mjs`) is a maintainer tool, not a build step.

## 6. Tests

Domain (`map-layer.test.mjs`: layer validation — valid file, wrong type, broken JSON, nameless geometry, size cap; pin validation — both-or-neither, ranges, round-trip, clearing), web unit (`site-map.test.mts`: normalisation, resolution incl. country preference and "not a jail", aggregation, worst-signal precedence, risk attachment, unplaced, pinned override, custom base map, prominent provinces, tooltip escaping; `overview-sections.test.mts`: LOCATION gating incl. planning-hidden), architecture + server/client boundaries, rls coverage (new table). Counts at implementation: domain 806, web 443, architecture 3, rls 4.

## 7. Found while building (fixed)

- `countryView` bboxed all polygons: antimeridian fragments (Russia) and overseas territories (French Guiana for France) zoomed to the whole world — now the largest polygon only.
- The tooltip interpolated officer text as HTML — now escaped.
- LOCATION ignored "Show work planning" — now gated like DELIVERY.
- The client fetch of the layer went to `/v1/…` on the web app (404) — the `app/api/organization/map-layer/data` proxy route forwards it with the session token.
- The picker's click handler tested `event.target` and always bailed (the map background is itself a zrender target) — any click now converts to coordinates.

## 8. Not built (later)

- Editing an existing activity's pin from the item page (the PUT route and the picker support it; only the editor UI is missing).
- Province choropleth (coloring provinces by status); beneficiary counts per site (same resolver, additive).
- Shapefile conversion (upload GeoJSON today); caching the geo chunks in an offline service worker.
