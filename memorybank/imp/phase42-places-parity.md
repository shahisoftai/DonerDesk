# Phase 42 — Places parity with DevResults (2026-11-04, branch `0017-maps-v2`; DEPLOYED, last release `20261104121520`)

Source: audit of `Temp/devresults-trailer.mp4` against our app (conversation of 2026-11-03/04). Four gaps, built in order of value, plus a follow-up (import and copy carry places). Everything below is **as built**; where it differs from the first plan the difference is named.

## 1. Status

| Batch | What | Built | Deployed | Live-checked (test tenant) |
|---|---|---|---|---|
| 42.1 | Several places per planned activity | yes | yes | yes (add, search, reload, remove) |
| 42.1 follow-up | Work-plan import reads `;`-separated place names; plan copy keeps the places | yes | yes | import yes; **copy no** (needs a new project) |
| 42.2 | "Add a country's places" from the built-in boundaries | yes | yes | preview only (Uganda); **applying a seed not exercised** |
| 42.3 | Place tree beside the results map | yes | yes | yes (Nigeria › Borno); tree with real links/figures not exercised (this project has none) |
| 42.4 | Indicator page: map beside the target chart, shared period | yes | yes | yes (slider marks the chart) |

One migration for the whole phase: `20261108090000_planned_activity_places`.

## 2. Principles kept (same as Phases 30–41)
- A place is master data (`Place`); records link to it, they never copy it. What a person typed is never rewritten.
- A missing value is never 0. A place we cannot resolve is listed, never guessed.
- One rule per decision, in the domain, pure and tested; handlers only compose; the web asks the same functions.
- Ports/adapters inside `features/maps/`; presentation never imports adapters; map files ≤ 300 lines, one class per file (`ResultsMap.tsx` is now 273 lines).
- Additive migration applied before the code; the new tenant table has RLS in `rls.sql` and a `/ready` pair.

## 3. 42.1 — Several places per planned activity

**Why.** A planned activity had one free-text `location` and one optional pin; DevResults has a Locations tab with many places per activity.

**Data.** `model PlannedActivityPlace` (`id, tenantId, projectId, plannedActivityId, placeId, createdById, createdAt`; unique `(plannedActivityId, placeId)`; indexes `(tenantId, projectId)` and `(tenantId, placeId)`), modelled on `PlannedActivityIndicator`. Row id is `<activityId>:<placeId>`. `rls.sql` list entry; `/ready` pair `PlannedActivityPlace.placeId` (`apps/api/src/routes/health.ts`).

**Domain** (`packages/domain/src/contexts/workplan/plan-places.ts`, exported from `workplan/index.ts`):
- `PLAN_PLACES_MAX = 25`; `checkPlanPlaces(placeIds, known)` — drops repeats (first wins), refuses a place not in the list ("Choose places from your places list") or retired (names it), refuses over 25.
- `planPlaceSummary(names)` ("Gulu, Kitgum and 2 more") — written and tested but **not used by any screen yet**.
- `placesFromLocationText(text, lookup)` and the `PlaceLookup` type (see §4).
- `plan-copy.ts`: `CopySourceItem.id` / `CopiedPlanItem.sourceId` pass the source activity's id through so a copy can find its places.

**Application.**
- Port `IPlannedActivityPlaceRepository` (`ports/workplan.ts`): `findPlaceIds`, `findPlaceIdsFor` (one query for many activities), `replace` (one transaction).
- `use-cases/workplan/plan-places-handlers.ts`: `GetPlanPlacesHandler` (anyone who can see the plan; returns id, name, path, archived, in the order chosen) and `SetPlanPlacesHandler` (`PlanAccess.load(..., "EDIT_NOTES")`, replaces the whole list, audited `workplan.places_set` with the ids). *Plan said `SetPlanActivityPlacesHandler` / `plan.places_set`; the names above are what exist.*
- `ListWorkPlanHandler` (`list-work-plan.ts`) takes the link and place repositories as optional trailing arguments and attaches `places: [{ id, name, latitude?, longitude? }]` to each row (the place's own pin when it has one); `WorkPlanRowDto.places?`. Unwired = rows as before.

**Infrastructure.** `repositories/work-plan/plan-places.ts` `PrismaPlannedActivityPlaceRepository` (rows get `createdAt = now + index ms` so the chosen order reads back); exported from `repositories/workplan.ts`; wired in `container/workplan-module.ts` (`setPlanPlaces`, `getPlanPlaces`; the list, import and copy handlers get `activityPlaces` and a `PrismaPlaceRepository`).

**Contracts / API.** `SetPlanPlacesSchema` (`contracts/src/workplan.ts`, ≤ 25 ids, strict). `GET` and `PUT /v1/work-plan/:itemId/places` in `apps/api/src/routes/workplan.ts`; `RULES`: `PUT` → `workplan.update-own` (the handler applies the finer item rule), `GET` → `project.view`. *Plan said `/v1/projects/:projectId/work-plan/:itemId/places`; the shorter path matches the other item routes.*

**Web.** `setPlanPlacesAction` (`lib/actions/workplan.ts`); `PlanPlacesSchema` (`lib/server/schemas-places.ts`); `WorkPlanRow.places` (`lib/server/schemas.ts`); `features/workplan/presentation/ActivityPlaces.tsx` — a "Places" section on the activity page (`activities/plan/[itemId]/page.tsx`, after the location editor): chips with the full path as tooltip, search the places list (8 matches, path shown), add and remove save at once, "Add a new place" link to Settings → Places; hidden for a viewer with nothing linked.

**Maps.** `siteMapData` (`features/workplan/domain/site-map.ts`): a row's linked places **with a pin** each become their own site and win over the typed words; a linked place with no pin is never guessed at (the typed words are used as before). `SitePointInput.places`. Passed from `PlanMapView`, `overview-read-model.ts` and `portfolio-map-read-model.ts`. *Side fix: the Overview map used to ignore a row's hand-placed latitude/longitude; it now passes them.*

**Tests.** domain `plan-places.test.mjs` (8); repository contract `packages/infrastructure/test/plan-places-repository.test.mjs` (3; opt-in `PLACES_VERIFY_DATABASE_URL`; uses the real client and deletes its rows because the repository opens its own transaction); `tests/unit/site-map.test.mts` (+2).

**Not built from the plan:** a "Locations" section in the *new-activity form* (only the activity page has it); "if the text is empty show the first linked place's name"; plotting an area that has no pin from its centre; the infographics map still reads typed words.

## 4. 42.1 follow-up — import and copy carry places

- **Import.** `placesFromLocationText(text, lookup)`: the typed Location is split at `;`; a part that names exactly one place is linked; a part that names none or several is left as typed and returned as a note (`"X" is not in your places list…` / `"X" could be more than one place…`); capped at 25. `ImportWorkPlanHandler` resolves with `resolvePlace` against the places list, links after `createMany` (one `replace` per activity), puts the notes in the import warnings (shown on screen and downloadable as import notes), keeps the typed text, links nothing on a preview, and returns `withPlaces`. Recurring rows link every occurrence; the notes are given once.
- **Copy.** `CopyWorkPlanHandler` points each copy at the same places as its source (a retired place is left out), returns and audits `withPlaces`. `routes/logframe.ts` returns `planPlaces` in the "copy setup" reply (no screen shows it).
- Both handlers take the place repositories as optional trailing constructor arguments; unwired they behave exactly as before.
- Screens: the import help text explains the semicolon rule; the copy checkbox says the places are kept.
- **Tests.** `workplan-handlers.test.mjs` (+4: import links/reports/keeps text, import unwired, copy keeps places and drops a retired one, copy with none); domain (+2).
- **Gaps found live.** The import screen has **no preview button** (only "Create planned activities"; the API's `apply:false` is not reachable from the UI), so a person cannot see which names will link before creating the rows. Planned activities have **no delete** (cancel only).

## 5. 42.2 — Add a country's places

- **Domain** `places/seed-from-boundaries.ts`: `planBoundarySeed(country, units, registry, newId)`; `SeedUnit { ref, parentRef?, level 1–4, name, code? }`; `SEED_UNITS_MAX = 25,000`. Creates the country place (level 0) if none, then each level under its parent, parents first; a unit whose P-code is already a place's code, or whose name already exists under the same parent, is skipped and stands in for itself (so children attach to it and a repeat creates nothing); `placedBy: "IMPORT"`; `underCountry` counts only units **finer than the coarsest level asked for** (the coarsest can only sit under the country; the first version counted them and misled).
- **Handler** `SeedPlacesFromBoundariesHandler` (`place-handlers.ts`): `project.edit`; `apply:false` only counts (`createdByLevel`, `skipped`, `underCountry`, `problems`, `applied`); one `createMany`; audited `place.seeded`. `SeedPlacesFromBoundariesSchema` (contracts). `POST /v1/places/seed-boundaries` (`RULES`: `project.edit`).
- **Why not `ImportPlacesHandler` (plan said reuse it).** The import resolves a parent by *name*, which is ambiguous for repeated names; the seed needs parents by P-code or position. Both write through the same repository `createMany`.
- **Browser side** (the browser holds the boundary files; the server cannot read `public/geo`): `features/places/domain/boundary-seed.ts` `seedUnitsFrom(byLevel)` → `{ units, dropped }`: parent by the unit's parent P-code, else the **one** outline that holds it (`unitsWithin`), else none; several candidates = none (never a guess). `features/places/presentation/SeedPlacesCard.tsx` (country, level checkboxes, "See what would be added", then "Add N places"; credit line names the source of the chosen level) on `settings/places/page.tsx`, only for people who can edit places. `seedPlacesFromBoundariesAction`, `SeedPlacesPreviewSchema`.
- **Finding from real data.** Natural Earth "provinces" are not always the parents a country's own files name: Uganda's level 1 is 112 *districts*, and the OCHA districts name regions we do not ship. Rule: when the finer level names parents by P-code and none is in the coarser level, the coarser level (only ever level 1) is **left out and reported** (the card says provinces were not added), and nothing is placed by position inside it. Uganda: 135 districts directly under the country; all 203 sub-districts under their districts by P-code.
- **Live preview (Uganda, districts + sub-districts):** would add 134 districts and 195 sub-districts; 9 already in the list.
- **Tests.** domain `seed-from-boundaries.test.mjs` (6), application `seed-places-from-boundaries.test.mjs` (3), web `boundary-seed.test.mts` (5).
- **Not done:** applying a seed live; the "wards" level (4) live; a "move under another place" tool (the Places form edits a parent one place at a time); four-language copy (English only).

## 6. 42.3 — Place tree beside the map

- **Pure** `features/maps/domain/place-tree.ts`: `buildPlaceTree(places, { activities, figures }, { all })` — counts roll up (a node's activities include everything below; figures = places at or below with a recorded figure); only touched places and their ancestors unless "every place"; retired places never; a cycle in the data is cut; `visibleNodes`, `ancestorsOf`. `features/maps/domain/drill/place-path.ts`: `pathForPlace` / `refOfPlace` — a place becomes the path of its ancestors plus its own ref (the place's code, else its name key; the same rule the boundary units use); a chain whose levels do not increase gives no path.
- **Presentation** `PlaceTree.tsx` (right column of the results map when not compact): `role="tree"`, arrows move, Right opens (or moves down), Left closes (or goes to the parent), Enter/Space chooses, roving tabindex; counts "N · M✓" with titles; "Show every place" toggle; opens the ancestors of a place chosen on the map.
- **Wiring.** `ExplorerProps.activityCounts` (`results-loader.ts`); `ResultsMap.focusPlace` sets the path and selects the boundary (place panel opens); `figureIds` come from the drawn level's model; the Maps page (`projects/[id]/maps/page.tsx`) reads the work plan and counts each linked place directly (the tree rolls them up). Seven `maps.tree.*` messages in four languages (title, activities, figures, showAll, showUsed, empty, legend; drafts).
- **Tests.** `place-tree.test.mts` (6); three checks in `tests/harness/maps-v2/run.mjs` (counts roll up to the country; choosing a place opens its details and sets `aria-selected`; arrows/Right/Enter/Left). The harness **reloads the page after the tree checks** (they leave the map drilled, and without the reset the next checks fail on state, not on a bug).
- **Live (test tenant):** with "Show every place": 7 roots; expanding Nigeria shows Borno; choosing Borno → breadcrumb World › Nigeria, `?map=0:NGA`, place panel "Open its districts". Default view is empty for BORNO-WASH ("No activity or result names a place yet") because it has no linked activities.
- **Limits:** the ✓ count is for the level the map draws (changes as you drill); not shown in the dashboard card (compact), share links or the old ECharts fallback explorer.

## 7. 42.4 — Indicator page: map beside actuals-vs-targets

- **Where.** On each indicator's own page (`projects/[id]/indicators/[indicatorId]/page.tsx`), above the existing tabbed `IndicatorViews`; shown only when the organisation has places. *Plan said a new `indicators/:id/results` page; the indicator page already existed, so the panel went there.*
- **Panel** `features/logframe/presentation/IndicatorResultsPanel.tsx`: the results map (`MapExplorer compact`, indicator locked, period held by the panel) beside the existing `OVER_TIME` chart (target line included). The period the map's slider is on is marked on the chart with a dashed line; the chart box carries `data-marked-period` for tests. The chart goes through `forScreen` (no embedded title in a narrow column) and `narrowAxis` (overlapping period labels hidden).
- **Pure** `features/logframe/domain/period-highlight.ts`: `highlightPeriod(option, label)` (a `markLine` on the first series; unchanged when there is no such period; never mutates; keeps an existing line) and `narrowAxis(option)`.
- **Explorer props** (`ExplorerProps`): `lockedIndicatorId` (no indicator list), `periodId` + `onPeriodChange` (the page holds the period). Omitting them leaves the map as before.
- **Shared reader** `useIndicatorDataset` (`features/logframe/presentation/useIndicatorDataset.ts`) is the one place an indicator's chart figures are read; `IndicatorViews` was refactored to use it.
- Three `indicatorResults.*` messages in four languages (drafts).
- **Tests.** `period-highlight.test.mts` (5); harness check "indicator page" (locked indicator, chart drawn, slider marks February then March) with a new stub `tests/harness/maps-v2/stubs/actions-charts.ts` (the real domain resolver over a 3-period sheet), `?page=indicator-results`, and `@/lib/actions/charts` aliased in `harnessAlias()`.
- **Limits:** one direction only (clicking a chart point does not move the map's period); the ECharts fallback explorer ignores the locked indicator and still lists indicators.
- **Live:** panel renders; slider to "Mar 2026" marks the chart. Three fixes were found live (below).

## 8. Fixes found during the live check (all shipped)
1. The chart's own long title was clipped in the narrow column → use `forScreen`.
2. The seed's "could not be placed" note counted the coarsest level → only finer-than-coarsest units are counted (domain rule + test).
3. The seed card's credit line used the country default → it names the source of the chosen level.
4. With titles gone, period labels overlapped → `narrowAxis` (+ test).

## 9. Deploy log (all `SCOPE=both` except the last web-only fix; local build because the host build hits its 3 GB cap)
| Release | Contents |
|---|---|
| `20261104105320` | 42.1–42.4 (commit `cc16ebee`), after a fresh backup, migration, per-table RLS |
| `20261104111621` | fixes 1–3 above |
| `20261104113102` | fix 4 (`narrowAxis`; web only; commit `ee70c4bb`) |
| `20261104121520` | import/copy carry places (commit `5547deab`) |

Steps used: `systemctl start donordesk-backup.service` → copy the migration folder to `/opt/donordesk/app/packages/infrastructure/prisma/migrations/` → `prisma migrate deploy` as `DATABASE_ADMIN_URL` → per-table RLS for `PlannedActivityPlace` (GRANT, ENABLE, FORCE, `tenant_isolation` policy; verified `relrowsecurity` and `relforcerowsecurity` true) → `scripts/deploy-fast.sh` (`SKIP_TYPECHECK=1`, SSH retry options, new `RELEASE_ID`) → `/ready` ok. Gate before the first deploy: domain 1,344, application 996, infrastructure 545 tests green. Final application suite 1,000.

## 10. Live-check record (test tenant, visible browser, project BORNO-WASH)
- 42.1: searched "Borno", added it to the activity `d8e10001-0000-4000-8000-000000000001`, survived a reload, **removed** (back to "No places chosen yet").
- Import: one real row "ZZ places test (cancel me)", Location "Borno; Konduga; Nowhere town" → created 1; note `"Nowhere town" is not in your places list, so it was not linked`; Places section showed Borno and Konduga; typed text kept.
- **Test data left behind:** that activity (`48151206-8c44-423e-8800-1517e479f669`) is **cancelled** and stays in the history (restorable; planned activities have no delete). Nothing else was created (seed previews only).
- Credentials were supplied by the user in the moment and are not stored anywhere.

## 11. Gotchas worth keeping
- Run `npx prisma generate` in `packages/infrastructure` before building it after a schema change (else `plannedActivityPlace` is "not a property of PrismaClient").
- Repository tests that wrap work in a rollback transaction cannot call a repository that opens its own `$transaction`; use the real client and delete the rows.
- `nameRef`/`normalizeLocationKey` strip admin suffixes ("Pece ward" → `name:pece`): write test expectations accordingly.
- `MAPS_FAST=1` skips the stylesheet; the breadcrumb-text checks need it. One Arabic harness check failed once in a full run while other test suites were using the CPU, and passes alone.
- Playwright scripts attached with `connectOverCDP` must call `process.exit(0)` or they hang; launch the visible Chromium with `setsid nohup … & disown` in its own call or it dies with the shell; WebGL needs `--use-angle=swiftshader --enable-unsafe-swiftshader` and takes about 30 s to be ready.
- Scratch Postgres for DB tests: `/tmp/claude-1000/dd/pg` (socket `/tmp/claude-1000/pgs`, `postgresql://najeeb@localhost/verify?host=/tmp/claude-1000/pgs`).
- A production deploy needs the user's explicit go-ahead in the same request; an unauthorised attempt is blocked.

## 12. Not built / backlog
- Places in the new-activity form; the "first linked place's name when the text is empty" fallback; `planPlaceSummary` on the list screens.
- Plot a linked area that has no pin from its centre; infographics map from linked places.
- Import preview button on the work-plan import screen; show `withPlaces`/`planPlaces` counts on the import and copy results.
- A "move under another place" tool for the districts a seed leaves under the country; seeding wards live; apply-a-seed live check.
- Clicking a chart point sets the map's period; tree in the compact card, share links and the ECharts fallback; tree figure counts that do not change with the drawn level.
- Native review of the new French, Spanish and Arabic labels (`maps.tree.*`, `indicatorResults.*`); the seed card and the Places section are English only.
- Still out of scope (from the audit): Dropbox links, an editable per-section permission matrix, a photo credit/tags audit.
