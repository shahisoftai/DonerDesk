# Phase 42 — Places parity with DevResults (2026-11-04, branch `0017-maps-v2`)

Source: audit of `Temp/devresults-trailer.mp4` against our app (conversation of 2026-11-03/04). Four gaps, in order of value.

## Principles (same as Phases 30–41)
- A place is master data (`Place`); records link to it, they never copy it. What a person typed is never rewritten.
- A missing value is never 0. A place we cannot resolve is listed, never guessed.
- One rule per decision, in the domain, pure and tested; handlers only compose; the web asks the same functions.
- Ports/adapters inside `features/maps/`; presentation never imports adapters; files ≤ 300 lines, one class per file.
- Additive migrations, applied before the code; each new tenant table gets RLS in `rls.sql` and a `/ready` pair.

## 42.1 Several places per planned activity (biggest gap)
Today a planned activity has one free-text `location` and one optional pin. DevResults has a Locations tab: many places per activity, shown on a map.
- **Table** `PlannedActivityPlace` (`id, tenantId, projectId, plannedActivityId, placeId, createdById, createdAt`, unique `(plannedActivityId, placeId)`, index `(tenantId, projectId)`), modelled on `PlannedActivityIndicator`. RLS forced.
- **Domain** `workplan/plan-places.ts` (pure): `checkPlanPlaces(placeIds, knownPlaces)` — at most 25 per activity, no repeats, every place exists and is not archived, answers a plain reason per refusal. `planPlaceSummary(links, places)` gives the display sentence ("Gulu, Kitgum and 2 more").
- **Text stays.** `PlannedActivity.location` is kept (legacy rows, imports, free typing). Linking places never edits it; if the text is empty the first linked place's name is shown. A row with links resolves on the map through its places (pin first, area centre second), never by name match.
- **Application** `SetPlanActivityPlacesHandler` (replace the whole list, audited `plan.places_set`, same permission as editing the activity through `canActOnPlanItem`), read model carries `places: { id, name, path }[]` on `WorkPlanRow` (one query for the page).
- **Routes** `PUT /v1/projects/:projectId/work-plan/:itemId/places` (in `RULES`, item-level rule applied by the handler).
- **Web** "Locations" section on the plan activity page and form: pick from the places list (search, path shown), add several, remove, "Add a new place" link. Map view and Overview map plot every linked place.
- **Import/copy**: work-plan import accepts `;`-separated place names resolved with `resolvePlace` (ambiguous or unknown = reported, never linked); copy-plan carries links by place id.
- Deploy: migration `20261108090000_planned_activity_places`, rls.sql for the table, `/ready` pair `PlannedActivityPlace.placeId`; `SCOPE=both`.

## 42.2 Seed places from the built-in boundaries
- Domain `places/seed-from-boundaries.ts` (pure): turns one country's boundary file units into `PlaceImportRow`s (name, level, parent by `parentId`/P-code, code = the unit's P-code), skipping units already present by code or name+parent. Preview first (`apply: false`), any problem blocks, repeats store once.
- Handler reuses `ImportPlacesHandler` (no second writer). UI: Settings → Places "Add a country's places" (pick country and level range).
- Licence rule: a share-alike file may seed; the place carries no licence, the maps page still credits the source.

## 42.3 Place tree beside the map
- Presentation `PlaceTree` (keyboard tree, counts of activities and recorded results per node) on the Maps page beside the explorer; selecting a node zooms and drills; the map selection highlights the node. Pure `buildPlaceTree(places, counts)` in the domain/web domain. Low-data mode shows the tree and the table, no tiles.

## 42.4 Indicator page: map beside actuals-vs-targets
- One page `indicators/:id/results` composing the existing results map (explorer, `compact`) and the saved chart of actuals vs targets from `resolveDataset`; the period slider drives both. No new data path.

## Not in this phase
Dropbox links, editable per-section permission matrix (we keep fixed roles), photo credit/tags audit.

## Verification
Unit (domain, application with fakes), repository contract on a scratch Postgres, architecture tests, browser harness for the Locations section, then a live check on the test tenant after deploy.

## Progress
- 42.1 (2026-11-04, built and tested locally, NOT committed, NOT deployed): `PlannedActivityPlace` table (migration `20261108090000_planned_activity_places`, rls.sql, `/ready` pair), domain `plan-places.ts` (`checkPlanPlaces`, `planPlaceSummary`, limit 25), `SetPlanPlacesHandler`/`GetPlanPlacesHandler`, `GET|PUT /v1/work-plan/:itemId/places` (in RULES), `ListWorkPlanHandler` attaches `places` (with the place's own pin) to each row, `ActivityPlaces` section on the activity page, `siteMapData` plots each pinned linked place as its own site and prefers them over typed words (a place with no pin is never guessed). Tests: domain 6, repository contract 3 (scratch Postgres), site-map 32, authorization/RLS/architecture green, tsc clean for api and web.
  Not done in 42.1: work-plan import of `;`-separated place names, copy-plan carrying links, infographics map still reads typed words, no browser harness for the Locations section yet, English-only copy, a place with an outline but no pin is not plotted (needs its centre).
- 42.2 (2026-11-04, built and tested locally, NOT committed, NOT deployed; no migration, no env): "Add a country's places" card on Settings → Places. Domain `places/seed-from-boundaries.ts` (`planBoundarySeed`: country place if missing, each level under its parent, parents first; an existing place with the same P-code, or the same name under the same parent, is skipped and stands in for itself; 25,000 units at most; repeat = nothing created), `SeedPlacesFromBoundariesHandler` (`project.edit`, `apply:false` only counts, audited `place.seeded`, one `createMany`), `POST /v1/places/seed-boundaries` (in RULES), browser-side `features/places/domain/boundary-seed.ts` (`seedUnitsFrom`: parent by P-code, else the one outline that holds the unit, else none = under the country and counted).
  **Finding from real data:** Natural Earth provinces are not always the parents a country's own files name (Uganda's "provinces" are 112 districts; OCHA districts name regions we do not ship). When the finer level names parents that the coarser level never carries, the coarser level (only ever level 1) is left out and the card says so; districts then sit under the country. Uganda: 135 districts under the country, all 203 sub-districts under their districts by P-code.
  Tests: domain 5, application handler 3, web `boundary-seed` 5; tsc clean for api and web. Not done: browser harness for the card, a live check, four-language copy, a "move under another place" tool for the parentless districts (the Places form edits a place's parent today).
- 42.3 (2026-11-04, built and browser-tested in the harness, NOT committed, NOT deployed; no migration, no env): the place tree in the map's right column (`PlaceTree`, shown when the map is not compact). Pure `maps/domain/place-tree.ts` (`buildPlaceTree`: counts roll up; only places an activity names or a figure was recorded for, with their ancestors, unless "every place"; retired places never; a cycle in the data is cut; `visibleNodes`, `ancestorsOf`) and `maps/domain/drill/place-path.ts` (`pathForPlace`: a place becomes the path of its ancestors plus its own ref, code first else name key; a chain whose levels do not increase gives no path). Choosing a node calls `ResultsMap.focusPlace` (path set, boundary selected, place panel opens); choosing a place on the map highlights and opens its ancestors in the tree. Keyboard tree (arrows, Right opens, Left closes or goes to the parent, Enter chooses). Activity counts come from the 42.1 links via the Maps page (`activityCounts`), figures from the drawn level's model. Six `maps.tree.*` messages in four languages (drafts).
  Tests: unit `place-tree` 6, i18n 7, architecture 19; harness 3 new checks in `tests/harness/maps-v2` (all pass; the other checks pass with the real stylesheet, `MAPS_FAST=1` makes the breadcrumb-text checks fail only because spacing needs the CSS).
  Limits: the "with a figure" count is for the level the map draws (it changes as you drill); the tree is not shown in the dashboard card or a share link; the ECharts fallback explorer has no tree; no live check yet.
- 42.4 (2026-11-04, built and browser-tested in the harness, NOT committed, NOT deployed; no migration, no env): on each indicator's own page (`/projects/:id/indicators/:indicatorId`) a new panel "Results by place and over time" (`IndicatorResultsPanel`) puts the interactive results map beside the figures-against-target chart (the existing `OVER_TIME` view spec, target line included). The map's period slider is the page's: the period it is on is marked on the chart with a dashed line (pure `logframe/domain/period-highlight.ts`, `highlightPeriod`; the chart box carries `data-marked-period` for tests). `ExplorerProps` gained optional `lockedIndicatorId` (no indicator list) and `periodId`/`onPeriodChange` (the page holds the period); omitting them leaves the map as it was. `useIndicatorDataset` is the one reader of an indicator's chart figures (the older `IndicatorViews` tabs now use it too). Panel shows only when the organisation has places. Two `indicatorResults.*` messages + title in four languages (drafts).
  Tests: unit `period-highlight` 4; harness check "indicator page" (locked indicator, chart drawn, slider marks February then March). Harness lesson: tree checks leave the map drilled, so the harness reloads the page after them (without that the next checks fail on state, not on a bug); `@/lib/actions/charts` is now stubbed in the maps-v2 harness (real domain resolver over a 3-period sheet).
  Limits: clicking a point on the chart does not move the map's period (one direction only); the ECharts fallback explorer ignores the locked indicator and still lists indicators; no live check yet.
- **Phase 42 status:** 42.1, 42.2, 42.3, 42.4 all built locally and uncommitted; one migration (`20261108090000_planned_activity_places`, plus its rls.sql entry and `/ready` pair). Deploy together (`SCOPE=both`).
