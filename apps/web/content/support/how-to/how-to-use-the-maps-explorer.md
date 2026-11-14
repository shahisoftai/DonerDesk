# How to Use the Maps Explorer (Results by Place)

The **Maps explorer** shows a project's results on a map, place by place: shaded areas for a figure, symbols for places and activities, and optional context such as population. It reads only what was recorded. A place with no figure is shown grey as **Not measured**, never as zero.

Open **Dashboards and infographics → Tools ▾ → Maps**, choose the project (or open it from a project's own pages: **Data → Map**, **Data → More → Maps**, or the **Map** link beside an indicator recorded by place).

## What you need

Results appear by place only when values were recorded **with a breakdown by location** (see [How to update indicator values](/support/how-to/update-indicator-values)) and the place names match your [places list](/support/how-to/set-up-your-places-list). If nothing was recorded by place, the map says so instead of drawing.

## The top of the page

- **Breadcrumb** (for example *World › Nepal*): click **World** to go back out.
- **Indicator**: choose which indicator the shading shows.
- **Ground**: what is drawn under the data. **Streets and terrain**, **Simple (land, water, borders, names)**, **This country only** or **None (boundaries only)**. Choose **None** for the lightest, fastest map or a clean print.
- **Compare the latest periods side by side** draws several small maps with one shared scale.
- **Print this map** prints it with its legend and sources.
- **Play** and the period slider step through the project's reporting periods (the label shows the period, for example *Nov 2026*). **All periods** shows everything together.

## Go down into a country

On the right, **Places in this project** lists the places that carry activities or figures, with two numbers: the number of activities, and (✓) how many places have a figure.

1. Click a place, for example a province. The map zooms in and a panel names it (for example *Karnali › Nepal*).
2. Click **Open its districts** (or *provinces*, *sub-districts*, depending on the level) to see the next level down and its list of places.
3. Click **Show every place** to list every place, not only those with figures.

The line under the map says how many places have a figure, how many are pinned and how many are not on the map for lack of a pin. A note says which is the finest boundary level available for the country and whether places were matched to their boundary **by name only**; add their codes under **Settings → Places** for an exact match.

## Layers

Under **Layers** tick or untick **Boundaries**, **Place symbols** and **Results fill**. Each has a slider for transparency and ↑ ↓ arrows to change which is drawn on top.

### Context
Under **Context** switch on **Where people live (population)**, **Health facilities** and **Settlements and towns**. They help you find your way and are never part of your results. Their sources are credited on the map. An administrator chooses which are offered: see [How to use context layers on a map](/support/how-to/use-context-layers-on-a-map).

### Overlays
Under **Overlays** you can look at a file of your own, such as rivers, roads or a camp outline. Click **Look at a file** and choose a KML, KMZ, GeoJSON or shapefile (a `.zip` containing the `.shp`, `.dbf` and `.prj`), up to 3 MB. It is **Showing “your file name”** for this visit only. Click **Keep for everyone** to save it for the organisation, or **Remove from this map** to drop it. Overlays are context only: nothing is reported against them.

## Photos on the map
**Photos on the map** shows image evidence that has a written location, at that place. If none has been added it says so.

## Movements between places
**Movements between places** records what moved from one place to another, for the Flow map. See [How to record movements between places](/support/how-to/record-movements-between-places).

## Analyse
When places that have a figure are also pinned, an **Analyse** panel appears: see [How to analyse places on a map](/support/how-to/analyse-places-on-a-map).

## Table, charts and downloads

- **View as a table** shows the same places as a table. It is also what you get on a device that cannot draw maps.
- Below the map, **Map charts and saved views** is the Chart Studio for places: choose **Data shown** (**Results by place**, **Two indicators by place** or **Flows between places**), the places level, the periods and a map type (choropleth, dot density, hexagon grid, bivariate, flow or graduated symbols). Download it as an image (PNG or SVG), data (CSV), or **Places (KML)** / **Places (GeoJSON)**. See [How to download places and map results](/support/how-to/download-places-and-map-results).
- **Map sources and licences** opens the page that credits every boundary and layer.
