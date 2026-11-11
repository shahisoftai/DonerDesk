# Phase 51 — map and page weight (investigation 2026-11-11, proposal; nothing below is built unless marked)

**DonorDesk Version 3.007** · measured on the Nepal dashboard link (`/shared/canvas/<token>`), signed-out visitor, software-rendered Chromium on a busy
machine, so absolute times are inflated 3–5× against a normal laptop: **read the ratios, not the seconds**.

## 1. What was measured

| Thing | Result |
|---|---|
| Time to a drawn map on the live link | about 18–20 s |
| Main thread blocked (long tasks) in that time | **12.2 s** (one 4.8 s block right after load, then ~1 s blocks) |
| Tiles actually downloaded | 106 KB (basemap) + 10 KB (boundaries): **the network is not the problem** |
| JavaScript on the page | 42 files, **4.7 MB** decoded (3.0 MB compressed) |
| Server | API 0.12 s; page time to first byte ~0.9 s |
| Page HTML before the fix | 188 KB (of which 132 KB was the organisation's whole places list) |

### Where the 4.7 MB of JavaScript goes
| KB | What | Needed to *view* a map? |
|---|---|---|
| 1,089 | ECharts, **the full build** (`await import("echarts")` in `DashboardChart`, `StudioChart`, `ReportChartPanel`) | The charts are; ~60 % of it is chart kinds the page does not use |
| 1,008 | MapLibre | yes |
| 601 | map chunk: PMTiles + Protomaps style **+ gazetteer (word list of 7,000 places) + Terra Draw (the outline-drawing tool)** | PMTiles and the style only |
| 301 | **all four languages' message catalogues** (`I18nProvider`) | only the visitor's language |
| 163 | world country shapes | only for the "World ›" breadcrumb and a country outline |
| ~1,500 | the rest of the app shell (forms, editor pieces, zod…) | a viewer needs little of it |

Not loaded on the link (good): the 2.2 MB bundled all-countries provinces file (a fallback only).

### What the basemap draws today
Full Protomaps style: **67 layers** (41 line layers, 39 of them roads; 15 fills; 10 labels) over the whole South Asia region file, so India, China, Bhutan,
Bangladesh… come along with every label, road and building.

### Isolated benchmark (same MapLibre, same tiles, same Nepal data; software GL)
| Ground | Layers | Drawn after | Per frame | Memory |
|---|---|---|---|---|
| Full street map (today) | 69 | 3.6 s | 410 ms | 21 MB |
| **Simple**: land, water, borders, place names | 16 | 3.3 s | 308 ms (−25 %) | 23 MB |
| Simple + **mask** (one country only) | 17 | 3.0 s | 334 ms | 38 MB |
| **None**: no basemap, provinces/districts only | 3 | **1.3 s (−64 %)** | **226 ms (−45 %)** | 17 MB |

Harness: `scratchpad/bench/` (Playwright answers `https://bench.local/` from local files, so no port is opened).

## 2. Built already (2026-11-11)
- A signed-out visitor was **thrown to the login page ~20 s after the link opened** (`listBoundaryLayersAction` needs a session; a server action's redirect cannot be caught). Public pages now build map services with `signedIn: false`; guarded by `public-pages-no-session.test.mts`.
- A link's page carried the organisation's **whole places list** (Kenya, Ethiopia…): 134 KB → 49 KB, HTML 188 → 90 KB, and other projects' place names no longer go out (`placesOfResultCountries`).
- Visitors can drag map cards for themself (session only).

## 3. Proposal (not built; needs a decision on defaults)

### A. One setting per map: **ground**
`ground: "STREETS" | "SIMPLE" | "COUNTRY" | "NONE"` on the map block (and the Maps page), stored in the block, shown in the Format tab and as a toggle on the map.

- **NONE**: flat ground in the page colour; provinces/districts only. Fastest (−64 % to draw, −45 % per frame), and the neighbours disappear. Best for dashboards and link pages.
- **COUNTRY**: simple basemap with everything outside the chosen country hidden by one *mask* polygon (the world minus the country, cut from the boundary files we already load; no new data). Needs `maxBounds` = the country's box + 10 % so nobody pans into the empty area, and a country picker when a map spans several countries (the Home map).
- **SIMPLE**: keeps context (rivers, towns, borders) for 16 layers instead of 67; no roads, buildings, land use.
- **STREETS**: today's look; kept for the Places pin picker, outline drawing and the plan's site map, where streets matter.
- **Default**: NONE for new dashboard/canvas maps, STREETS where a person pins or draws. Existing maps keep STREETS until someone changes them (or flip them by one migration).
- Where it goes (ports and adapters, nothing in the domain changes): `BasemapMode` gains a detail; `ProtomapsBasemap.styleFor` filters its layer list by tile layer; one `MASK` layer spec in `scene.ts`; `MapLibreRenderer` already swaps the ground without redrawing data.

### B. **Only one country, honestly**
Three ways, in order of cost: (1) NONE (nothing else is drawn); (2) mask (above); (3) a per-country PMTiles (`pmtiles extract --region` on the region file) so the *file* holds one country's tiles (border tiles still show a sliver of neighbours, so it still needs the mask). Recommendation: 1 + 2, skip 3.

### C. **JavaScript diet** (the real 12 s)
1. **ECharts tree-shaken** (`echarts/core` + only the chart kinds we draw, canvas renderer): about −600 KB.
2. **Language catalogues loaded per language** (English kept as the fallback): about −225 KB on every page.
3. **Map chunk split**: gazetteer and Terra Draw loaded only when a place form or the drawing tool opens: about −150 to −250 KB.
4. A **viewer entry** for `/shared/*` and `/embed/*`: no editor, no forms; the page imports only the block screens, the map and the chart module.
5. Defer charts below the fold (`useRenderWhenSeen` already exists) and start MapLibre while the data loads (the prefetch exists; make it start on `/shared`).
6. Measure after each: this document's table is the baseline; target ≤ 2.5 MB decoded and ≤ 4 s of main-thread blocking on the same machine.

### D. Rendering
- With `fadeDuration: 0`, `renderWorldCopies: false`, `minZoom`/`maxBounds` set from the data, and glyph ranges limited to the needed languages, a country map never requests the world file or other regions' fonts.
- Callout cards: already client-side and cheap; keep.

## 4. Decisions needed
1. Default ground for new dashboard maps: **NONE** or **SIMPLE**?
2. Flip existing maps now (faster, new look) or only on request?
3. Do the JavaScript diet (C) first (largest win, no visual change), or the ground setting (A) first (visible feature)?
