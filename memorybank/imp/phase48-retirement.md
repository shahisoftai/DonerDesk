# Phase 48 — retirement register

Plan: `phase48-visual-studio.md` §12. Parity: `phase48-parity.md`. Test: `apps/web/tests/unit/visual-parity.test.mts`.

Rows are `| item | kind | replaced by | status | removed in |`.
- `kind`: `route` (a web route, written `web:/path`), `nav` (a menu entry or tab), `feature` (a folder or file), `api` (a route prefix, written `api:/path`), `table` (database), `test` (harness), `doc` (article or note).
- `status`: `live` (nothing moved yet), `redirected` (links repointed, page redirects, route still answers), `removed` (deleted), `kept` (stays on purpose, with the reason in "replaced by").
- A route marked `redirected` or `removed` may not be linked from any source file outside the register's own redirect pages: the test fails on the first link it finds.
- Gates before `removed` (plan §12.2): parity rows green, harness green on the Studio, signed-in check, 14 days of zero traffic on the redirect, no importer left.
- **Every route and every API route of the visual files must have a row here or a row in the parity file** (the test reads both).

## Web routes

| item | kind | replaced by | status | removed in |
|---|---|---|---|---|
| `web:/dashboards` | route | `/visuals` | redirected | 48.10 |
| `web:/dashboards/[id]` | route | `/visuals/[id]` (canvas converted once) | redirected | 48.10 |
| `web:/dashboards/templates` | route | Studio → Templates | redirected | 48.10 |
| `web:/dashboards/templates/[id]` | route | Studio → Templates | redirected | 48.10 |
| `web:/projects/[id]/charts` | route | Studio → Charts (project filter) | redirected | 48.10 |
| `web:/projects/[id]/maps` | route | Studio → Maps (project filter) | redirected | 48.10 |
| `web:/projects/[id]/infographics` | route | Studio → Designs (project filter) | redirected | 48.10 |
| `web:/projects/[id]/infographics/[designId]` | route | `/visuals/[id]` | redirected | 48.10 |
| `web:/portfolio/infographics` | route | Studio → Designs (portfolio) | redirected | 48.10 |
| `web:/portfolio/infographics/[designId]` | route | `/visuals/[id]` | redirected | 48.10 |
| `web:/shared/dashboard/[token]` | route | `/shared/canvas/[token]` (old tokens resolve through an adapter) (kept on purpose: links already sent must keep working) | kept | - |
| `web:/shared/infographic/[token]` | route | `/shared/canvas/[token]` (kept on purpose: links already sent must keep working) | kept | - |
| `web:/embed/dashboard/[token]` | route | canvas embed (kept on purpose: links already sent must keep working) | kept | - |
| `web:/api/infographics` | route | `/api/canvases` | live | 48.10 |
| `web:/api/infographic-studio` | route | canvas editor routes | live | 48.10 |
| `web:/api/shared-infographic` | route | `/api/shared/canvas` | live | 48.10 |
| `web:/api/projects/[id]/infographics` | route | `/api/canvases` | live | 48.10 |
| `web:/api/projects/[id]/infographic-data` | route | `/api/visual-data` | live | 48.10 |
| `web:/api/shared/dashboard` | route | `/api/shared/canvas` | live | 48.10 |
| `web:/visuals` | route | the Visual Studio | kept | - |
| `web:/visuals/new` | route | the Visual Studio (New flow) | kept | - |
| `web:/visuals/[id]` | route | the Visual Studio | kept | - |
| `web:/shared/canvas` | route | the one public path | kept | - |
| `web:/embed/canvas` | route | the one embed path | kept | - |
| `web:/api/canvases` | route | the canvas API proxy | kept | - |
| `web:/api/shared/canvas` | route | the one public path | kept | - |
| `web:/projects/[id]/data` | route | Data Center stays the data tool | kept | - |
| `web:/projects/[id]/report-builder` | route | Report Builder stays the data tool | kept | - |
| `web:/maps/sources` | route | map sources page stays | kept | - |
| `web:/dashboard` | route | Home (not a visual surface) | kept | - |
| `web:/api/organization/map-layer` | route | boundary layer proxy stays (Assets → Boundaries) | kept | - |

## Navigation

| item | kind | replaced by | status | removed in |
|---|---|---|---|---|
| nav key `DASHBOARDS` ("Older dashboards") | nav | `VISUALS` | removed | 48.10 |
| project tab "Dashboards" | nav | project filter in Studio | redirected | 48.10 |
| project tab "Infographics" | nav | project filter in Studio | redirected | 48.10 |
| portfolio button "Infographics" | nav | Studio → Designs | redirected | 48.10 |
| Data Center / Report Builder links to Chart Studio and Maps | nav | "Send to Visual Studio" | redirected | 48.10 |
| `MovedToVisuals` notice and `OpenAsCanvasButton` list on `/visuals` | nav | converted designs only | removed | 48.10 |

## Web features and server actions

| item | kind | replaced by | status | removed in |
|---|---|---|---|---|
| `apps/web/src/features/dashboards/presentation/` | feature | canvas blocks and Studio panels | live | 48.10 |
| `apps/web/src/features/infographics/presentation/` | feature | canvas editor and Assets library | live | 48.10 |
| `apps/web/src/features/charts/presentation/ChartStudio.tsx` (page shell only; editor core kept as the hosted block editor) | feature | chart block editor | live | 48.10 |
| `apps/web/src/features/maps/presentation/MapExplorer.tsx` (page shell only; explorer kept as the hosted editor) | feature | map block editor | live | 48.10 |
| `apps/web/src/features/data-center/presentation/DataChartBuilder.tsx` | feature | Send to Visual Studio | live | 48.10 |
| `apps/web/src/features/report-editor/presentation/inspector/DataChartsPanel.tsx` | feature | insert from the Studio library | live | 48.10 |
| `apps/web/src/lib/actions/dashboards.ts` `apps/web/src/lib/actions/data-charts.ts` `apps/web/src/lib/actions/map-widgets.ts` | feature | canvas actions | live | 48.10 |
| The ECharts map engine: SiteMapFigure, LocationPickerFigure, the ECharts MapCanvas, map-option.ts and the NEXT_PUBLIC_MAP_ENGINE switch | feature | MapLibre for every map; a device with no WebGL gets the table (results, sites) or typed coordinates (a pin). ECharts geo charts (Chart Studio, infographics) keep map-assets. | removed | 49.9 |

## API routes and handlers

| item | kind | replaced by | status | removed in |
|---|---|---|---|---|
| `api:/v1/dashboards` `api:/v1/dashboard` `api:/v1/dashboard-preview` `api:/v1/dashboard-links` | api | `/v1/canvases` (resolve, preview, shares) | live | 48.10 |
| `api:/v1/dashboard-templates` | api | Studio templates API | live | 48.10 |
| `api:/v1/infographics` `api:/v1/infographic-templates` `api:/v1/infographic-share-links` `api:/v1/projects/:projectId/infographics` `api:/v1/portfolio/infographics` `api:/v1/portfolio/infographic-data` | api | `/v1/canvases` and templates API | live | 48.10 |
| `api:/public/dashboards` `api:/public/infographics` | api | `/public/canvases` | live | 48.10 |
| `api:/v1/report-sections/:id/data-charts` | api | insert-from-library route | live | 48.10 |

## Data

| item | kind | replaced by | status | removed in |
|---|---|---|---|---|
| tables `Dashboard`, `DashboardShareLink`, `DashboardTemplate`, `FeaturedDashboard` | table | `Canvas`, `CanvasShareLink`, Studio templates, canvas pins | live | 48.10 |
| tables `ProjectInfographic`, `InfographicExport`, `InfographicShareLink` | table | `Canvas`, `CanvasExport`, `CanvasShareLink` | live | 48.10 |
| infographic brand, asset and template tables | table | Assets library (brand, images) and Templates | live | 48.10 |

## Tests and docs

| item | kind | replaced by | status | removed in |
|---|---|---|---|---|
| harnesses `test:tiles`, `test:templates`, `test:maps-extras` (ported to the Studio first) | test | `test:studio-shell`, `test:canvas-*` | live | 48.10 |
| support articles on dashboards, infographics, Chart Studio, maps and Data Center charts | doc | Visual Studio articles | live | 48.10 |
| AGENTS.md phase sections for retired surfaces | doc | marked "superseded by Phase 48", kept as history | live | 48.10 |
