# Phase 53 — Simple maps: a finished map in three steps (plan, 2026-11-13)

**DonorDesk Version 3.007** · branch to create: `0022-simple-maps` · status: **plan only, nothing built**

## 0. Why

The user's complaint: setting up a project map is "too complicated and confusing", and our maps do not look like the sober grey/blue
maps with places, names and numbers that people expect. An audit of the ActivityInfo and DevResults documentation (sources in §12)
and of our code (2026-11-13) found that the gap is **defaults and data entry, not the map engine**.

### 0.1 What the competitors do (documented)
| | ActivityInfo | DevResults |
| --- | --- | --- |
| Where geography comes from | A form field: reference to the built-in geodatabase (country → level) or a GPS point. Every record carries its place. | Staff load boundaries at site creation; a project is assigned places per level from a dropdown. "Every result must map to a place." |
| Making a map | My reports → Add map → pick form → drag a field onto Layers (≈12–15 clicks incl. publish) | Indicator → Reports → Map, or dashboard Indicator Map tile |
| Drawn | Proportional circles (numbers), OCHA icons (text), aggregation on zoom | Choropleth (5 automatic classes) or graduated symbols |
| Basemap | Light / Street / Satellite / Population | "Minimal" default |
| Choices offered | Very few (2021: layers cannot be hidden, scale automatic, icon size fixed) | Very few (classes automatic, one period) |
| Values on shapes, chart markers | Not documented | Not documented; "Maps do not allow you to view data by disaggregation" |

**Lesson:** their simplicity comes from (a) geography being part of entering the data and (b) almost no choices. Neither draws
names + figures + small charts on the map; doing that well would put us ahead.

### 0.2 What our code does (audit findings)
| # | Finding | Where |
| --- | --- | --- |
| F1 | A map without a saved ground draws the full street map (67 tile layers); a new dashboard map draws a flat colour with **no place names**. The sober `SIMPLE` ground is never a default. | `features/maps/domain/ground.ts` (`DEFAULT_GROUND = "STREETS"`, `NEW_MAP_GROUND = "NONE"`) |
| F2 | Area labels default to none; figure cards are off. Out of the box: no names, no numbers. | `domain/scene/area-style.ts` (`labels ?? "NONE"`) |
| F3 | A map opens on the **world** unless the project has exactly one country-level place or all results sit in one country. `Project.country` is never used. | `domain/drill/home-country.ts` |
| F4 | Areas are coloured only from LOCATION breakdowns of indicator values, which are optional and not asked for. Most projects have nothing to draw → **empty map**. There is no per-indicator "record by place" setting (only `disaggregationRequired`). | `Indicator` schema, `rollupByPlace` |
| F5 | ≈11 separate components touch places/maps (Settings → Places, pin editor, bulk walk, wizard picker, plan location field, location editor, Data Center by place, dashboard widget, Studio map panel, canvas map block, indicator results panel). | `apps/web/src/features/*` |
| F6 | GIS controls on the first screen: opacity sliders and ↑/↓ layer order, plus overlays, context layers, analysis, flows, photos, 4 grounds × 4 colour modes × 4 label modes. | `LayerPanel.tsx`, `ResultsMap.tsx` (311 lines, composes ~20 parts) |
| F7 | No chart (pie/bar) markers anywhere. | `features/maps` |

## 1. Goal and definition of done

**A field officer with no training can go from "new project" to a shared map that shows place names, figures and a legend on a
grey ground, in three decisions: where we work, what to show, share.**

Measured by a browser harness (`test:simple-maps`, §9) that does exactly that in ≤ 8 clicks from the project page, and by the
visual baseline (light, dark, 390/768/1300 px).

Non-goals: GIS analysis beyond what exists, online tile services, satellite imagery by default, editing boundaries.

## 2. Batches

| Batch | What | Fixes | Migration | Scope |
| --- | --- | --- | --- | --- |
| 53.0 | Parity rows, golden pictures of today's maps, harness skeleton | — | no | web |
| 53.1 | **Report look**: one map preset table; defaults become the preset; open on the project's country | F1 F2 F3 | no | both |
| 53.2 | **Record by place**: indicator setting, entry by place, "why is my map empty" | F4 | yes | both |
| 53.3 | **One Map button**: indicator row + Visuals → New map; three-step builder; "More options" drawer | F6 | no | both |
| 53.4 | **Where we work**: one project page for places; every other surface links to it | F5 | no | web |
| 53.5 | **Chart markers**: pie/bar per place from recorded breakdowns | F7 | no | both |
| 53.6 | Translations (fr/es/ar drafts), support article, AGENTS.md, deploy | — | — | both |

Each batch is shippable alone; 53.1 alone answers most of "does not look like theirs".

---

## 3. Batch 53.1 — the Report look (presets, not defaults scattered in files)

### 3.1 Design
A **map preset** is a named, complete description of how a map looks. Today the look is spread over `DEFAULT_GROUND`,
`NEW_MAP_GROUND`, `DEFAULT_LAYERS`, `labels ?? "NONE"` and per-block defaults. They become one table.

```ts
// packages/domain/src/contexts/maps/map-presets.ts (pure; new context folder, browser-safe: no node:*)
export type MapPresetId = "REPORT" | "FIELD" | "DETAILED";
export interface MapPreset {
  id: MapPresetId;
  ground: MapGround;                 // REPORT → "SIMPLE", FIELD → "STREETS", DETAILED → "STREETS"
  areaStyle: Omit<AreaStyle, "palette">; // REPORT → colorBy VALUE, labels AUTO
  ramp: ColourRampId;                // REPORT → "BLUE" (sequential, theme roles rampStart/rampEnd)
  legend: boolean;                   // true
  callouts: "OFF" | "AUTO";
  borders: { colour: ThemeRole; width: number }; // white, 0.8
  layers: readonly ExplorerLayer[];
}
export const MAP_PRESETS: Readonly<Record<MapPresetId, MapPreset>>;
export const DEFAULT_MAP_PRESET: MapPresetId = "REPORT";
```

- `AreaLabels` gains `"AUTO"`: **name and figure** when the view shows ≤ `AUTO_LABEL_LIMIT` (40) areas, else name on hover only.
  Decided by one pure function `resolveLabels(mode, areaCount)`; collisions are left to MapLibre's own placement (no new layout code).
- `MapGround` moves to the domain (it is a rule, not a screen detail); `apps/web/.../ground.ts` re-exports it (no duplicate type).
- **Backward compatibility (Open/Closed):** a map that saved its own `ground`/`areaStyle` keeps it. Only maps with no saved choice
  and new maps take the preset. `resolveMapLook(saved, preset)` is the one merge rule, table-tested: saved field wins, field by field.
- The "plain" ground (`NONE`) stays available but is no longer the default for anything.

### 3.2 Opening on the right country (F3)
`homeCountry(places, results)` becomes a **chain of small rules** (Open/Closed: a new rule is a row):

```ts
export const HOME_COUNTRY_RULES: readonly HomeCountryRule[] = [
  onlyCountryPlace,      // today's first rule
  countryOfAllResults,   // today's second rule
  projectCountry,        // NEW: Project.country, matched to the boundary catalogue by name/ISO
];
export const homeCountry = (input: HomeCountryInput) => firstAnswer(HOME_COUNTRY_RULES, input); // null → world
```
`Project.country` reaches the map through `ExplorerProps.projectCountry` (server-read, no new endpoint: the project page already has it).

### 3.3 Files
| New / changed | Responsibility |
| --- | --- |
| `domain/.../maps/map-presets.ts` | the preset table (data only) |
| `domain/.../maps/map-look.ts` | `resolveMapLook`, `resolveLabels` (pure rules) |
| `domain/.../maps/home-country-rules.ts` | the rule chain |
| `web/features/maps/domain/ground.ts` | re-export; `DEFAULT_GROUND`/`NEW_MAP_GROUND` deleted, callers ask `resolveMapLook` |
| canvas MAP block `defaults()` | `{ view: "RESULTS", preset: "REPORT" }` |
| `MapLegend.tsx` | shown when `look.legend` |

### 3.4 Tests
- `map-presets.test.mjs`: every preset complete (exhaustive keys), REPORT colours pass contrast in light and dark (reuses `CONTRAST_PAIRS`).
- `map-look.test.mjs`: saved wins per field; unknown saved value falls back to preset; AUTO labels at 40/41 areas.
- `home-country.test.mjs`: existing cases unchanged + project country; unknown country name → world, never a guess.
- Visual baseline update (`test:visuals`, reviewed in the PR).

---

## 4. Batch 53.2 — record by place (the real reason maps are empty)

### 4.1 Rule
An indicator whose project has places **may be recorded by place**. When it is, every value is entered as one figure per place and
the total is their sum (additive types) or entered separately (rates: never summed, Phase 31 rule kept).

### 4.2 Model
- Migration `20261117090000_indicator_record_by_place`: `Indicator.recordByPlace Boolean @default(false)`,
  `Indicator.placeLevel Int?` (0–4, the level figures are entered at). Additive. `/ready` requires `Indicator.recordByPlace`.
- Domain: `placeRecording.ts` (`canRecordByPlace(indicator, projectPlaces)`, `placeRowsFor(indicator, places, level)`,
  `totalFromPlaces(type, entries)` → value or `null` for rates). Writes still go through the existing breakdown validation
  (`validateDisaggregation`, dimension `LOCATION`) — **no new write path**.
- Wizard and library: an indicator adopted into a project with ticked places is proposed `recordByPlace: true` at the ticked level
  (a suggestion the person sees and can untick; never silent).

### 4.3 Entry
- `Enter data` and the Entry Sheet render place rows through a new row source, not a branch:
  `ENTRY_ROW_SOURCES = [plainRow, byPlaceRows]` chosen by `rowSourceFor(indicator)`. The sheet engine already addresses columns
  generically; place rows are child rows with a computed parent (locked, CALCULATED).
- Offline pack v2 carries the place list for by-place indicators (places are already in the pack).

### 4.4 "Why is my map empty?"
`mapReadiness(project)` (pure) returns ordered reasons from `MAP_READINESS_RULES`:
`NO_PLACES` → link to Where we work; `NO_INDICATOR_BY_PLACE` → "Record these by place" with the list; `NO_VALUES_YET`;
`PLACES_WITHOUT_AREA` (typed names no boundary matches) → "Places to confirm". The map shows the first reason as one sentence
and one button instead of an empty ground. Copy keys `maps.ready.<CODE>`, exhaustive over the codes.

### 4.5 Tests
Domain table tests for every rule; `byPlaceRows` sum/rate cases; harness: tick 3 districts → indicator proposed by place →
enter 3 figures → map shows 3 shaded areas with figures.

---

## 5. Batch 53.3 — one Map button, three steps, the rest behind "More"

### 5.1 Flow
1. **Map** button on every indicator row (logframe, Data Center, Enter data) and **Visuals → New map**.
2. Builder (`MapBuilder`, one screen): *Project* (preselected when known) → *What to show* (indicator, or "Activities" for the sites
   map) → preview drawn live in the REPORT look.
3. **Add to dashboard** / **Share link** / **Download picture**. Done.

### 5.2 Progressive disclosure
`MAP_OPTION_GROUPS` (table): `BASIC` (period, level, labels on/off) shown; `MORE` (ground, colour mode, bands, opacity, order,
overlays, context layers, analysis, flows, photos) in a collapsed "More options" drawer. A group's visibility is data, so the
explorer, the canvas block and the dashboard widget read the **same** table. `LayerPanel`'s ↑/↓ and opacity move to MORE.

### 5.3 Decomposing `ResultsMap.tsx` (311 lines, ~20 responsibilities)
| New unit | Single responsibility |
| --- | --- |
| `useResultsData` | reading results for (project, level, period); nothing else |
| `useDrillPath` | the drill path and the address bar |
| `useMapLook` | preset + saved settings → resolved look |
| `ResultsCanvas` | draws the scene; decides nothing |
| `MapSidePanel` | composes BASIC controls + the More drawer |
| `ResultsMap` | composition only (≤ 120 lines) |

### 5.4 Tests
Harness: from a project page, Map on an indicator row → Add to dashboard in ≤ 4 clicks; More drawer closed by default;
keyboard path through the builder; `map-options.test.mjs` pins every option in exactly one group.

---

## 6. Batch 53.4 — "Where we work": one page for places

- Route `/projects/[id]/places` with three tabs over **existing** components: *Areas* (the wizard's `PlacePicker` tick tree + map),
  *Points* (`PlacePinEditor`, bulk walk, import), *To confirm* (`ListUnconfirmedLocationsHandler`).
- `PlacePicker` is lifted out of `project-setup/pcw` into `features/places/presentation` behind a `PlaceSelectionPort`
  (`load`, `tick`, `untick`): the wizard implements it over the draft, the project page over the places handlers. Same component,
  two adapters.
- Every other surface (plan location field, Data Center by place, map empty state, Settings → Places) **links** here; Settings →
  Places stays the organisation-wide list.
- Project setup check: "Where we work" counts as done when ≥ 1 area is ticked.

Tests: port contract test run against both adapters (`place-selection-contract.mjs`), harness for the page.

---

## 7. Batch 53.5 — chart markers on places

- New area style `markers: "NONE" | "PIE" | "BAR"` in `AreaStyle`; `placeMarkers(results, dimension)` (domain, pure) returns per
  place the recorded split for one dimension (SEX, AGE_GROUP, DISABILITY, OTHER).
- **Honesty rules** (validator rows in `MARKER_RULES`): a place gets a marker only when every category of the split was recorded;
  a rate is never a pie; a single category is not a pie; size of a marker ∝ the place's total only for additive types; places
  without a full split show the plain figure and are counted in a note. Missing ≠ 0.
- Drawing: a `MarkerRenderer` port with one MapLibre adapter (SVG images registered per place, ≤ 60 markers, else the option is
  refused with a sentence). The print painter gets the same model (`placeMarkers`) and draws it in SVG — screen and file agree.
- Share links: markers carry only figures the link may already show.

Tests: rule table, adapter snapshot, print parity row added to `canvas-print-parity.test.mjs`.

---

## 8. SOLID — how each principle is kept, and how it is checked

| Principle | Applied as | Enforced by |
| --- | --- | --- |
| **S** — single responsibility | Presets are data; `map-look` merges; `home-country-rules` decide; hooks read; canvases draw; `ResultsMap` only composes. `ResultsMap.tsx` split (§5.3). | Architecture test: map files ≤ 300 lines (existing), new: presentation files ≤ 1 component, `features/maps/presentation/*.tsx` may not import `@/lib/actions` except `results-loader.ts` and `MapServices.tsx`. |
| **O** — open/closed | New look = row in `MAP_PRESETS`; new home-country rule = row; new readiness reason = row in `MAP_READINESS_RULES`; new entry row kind = row in `ENTRY_ROW_SOURCES`; new marker kind = row in `MARKER_RULES`; new option = row in `MAP_OPTION_GROUPS`. No `switch` on a preset/marker id outside its table. | Grep-test (as Phase 46): no `=== "REPORT"`, `=== "PIE"` etc. outside the tables; `assertExhaustive` on every table. |
| **L** — Liskov substitution | Every `PlaceSelectionPort` adapter (draft, project) passes one contract suite; every `MarkerRenderer` adapter returns the same model for the same input; the `none` map engine (no WebGL) still honours the look (table + legend). | `place-selection-contract.mjs`, renderer contract test, existing no-WebGL harness case. |
| **I** — interface segregation | Small ports: `PlaceSelectionPort` (3 methods), `MarkerRenderer` (draw/clear), `ProjectCountryReader` (1 method). The explorer's 20-prop `ExplorerProps` is split into `LookProps`, `DataProps`, `InteractionProps`. | Type-level: no port over 4 methods (architecture test counts members of `ports/*.ts`). |
| **D** — dependency inversion | Domain rules know no MapLibre/React; presentation depends on ports; adapters wired only in `composition.ts` (existing rule) and the new `places/composition.ts`. | Existing `architecture-boundaries.test.mjs` extended to `contexts/maps` and `features/places`. |

## 9. Verification

- Targeted unit tests per batch (AGENTS.md fast loop): `pnpm --filter @donordesk/domain test`, the changed web unit files.
- New harness `pnpm --filter @donordesk/web test:simple-maps` (Chromium, stubbed actions): new project → tick 3 districts → indicator
  by place → enter 3 figures → Map → Add to dashboard → share link opens signed out (fresh context, Phase 50 lesson) showing grey
  ground, names, figures, legend. Click count asserted ≤ 8.
- `test:visuals` and `test:tiles` re-run; baselines reviewed in the PR.
- Before release: full suites once (schema change in 53.2).

## 10. Deploy

| Batch | Steps |
| --- | --- |
| 53.1, 53.3, 53.4, 53.5 | no migration, no env; `BUILD_ON=host SCOPE=both` (53.4 web only) |
| 53.2 | fresh backup → migration `20261117090000_indicator_record_by_place` (additive, before the code) → `/ready` pair `Indicator.recordByPlace` → deploy `SCOPE=both`. No RLS change (column on an existing table). |

Batch the five into two deploys if possible (53.1+53.2, then 53.3–53.5).

## 11. Risks and decisions for the owner

1. **Existing dashboards change look?** Plan: no — only maps with no saved choice and new maps get REPORT. Alternative: a one-time
   "Use the new look" button on old maps. *Owner to choose.*
2. **Record by place proposed by default** when places are ticked — this adds entry rows for field staff. Plan: proposed, visible,
   untickable; never forced.
3. **Pie markers** can mislead with partial splits; rules in §7 refuse rather than guess.
4. Translations remain drafts without a native reviewer.

## 12. Sources (read 2026-11-13)
ActivityInfo: designing-a-map, editing-a-map-report, publishing-a-report, referencing-the-geodatabase, geographic-point-field
(support/docs), webinars 2021-10-07 thematic maps and 2024-03-27 report design, blog 2020-09-14 and 2020-10-19.
DevResults: choropleth-and-graduated-symbols-maps, define-a-location, assign-a-geography-to-a-project, update-admin-divisions,
geography-glossary, about-kml-files, which-administrative-division-levels-should-i-use, mapping-functionality,
dashboard-tile-geotagged-photos-map, add-map-overlays, visualizations, define-a-dashboard (help.devresults.com); blog choropleth-map.
