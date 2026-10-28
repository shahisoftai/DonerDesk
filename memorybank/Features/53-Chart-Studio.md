# Feature 53: Chart Studio and saved charts

**DonorDesk Version 3.007 (Phase 34.1)**
**Status:** built, tested and deployed 2026-10-28 (`releaseId=20261028133938`, migration `20261030090000_saved_charts`). Browser-tested in a harness (`pnpm --filter @donordesk/web test:studio`, 21 checks); not yet tried by a person in the signed-in app.
**Rules:** `AGENTS.md` → "Phase 34.0", "Phase 34.1" and "Phase 34.3". **Plan:** `imp/phase34-devresults-parity-plan.md` §3.

## What a person gets

- **A chart workshop** at `/projects/:id/charts` (link on the Data Center page): data on the left, the drawing in the middle, type and style on the right.
- **43 kinds of chart** from one set of recorded figures: bars (vertical, horizontal, grouped, stacked, 100% stacked), lollipop, bullet, lines, areas, pies, donuts, funnel, waterfall, gauge, radar, treemap, sunburst, waffle, scatter, histogram, box plot, heatmap, pivot and scorecard tables, finance charts (budget against spending, burn rate), a Gantt of the work plan, a calendar of completed activities, a Sankey of the budget (donor → cost category → spent), results by place and, on the bundled world map, graduated symbols and a country choropleth. Only the population pyramid is not drawable (needs an age × sex split the data sheet does not hold).
- **Choose the data**: one indicator over time, several indicators, latest progress, baseline–target–result, status of the data, finance, the work plan, activity days, the budget, or results by place; a measure (period value, cumulative, percent of target); a range of periods; whether not-yet-verified values are drawn.
- **Full editing**: series colour, label, line style, axis and visibility; axis titles, minimum, maximum, log scale and a second axis; annotations (up to 12); legend position; label and number formats; sort and top N; size presets (square, wide, tall, A4, slide); title, subtitle and a text description for screen readers.
- **Undo and redo** (50 steps); one edit is one step.
- **Export** as PNG, SVG or CSV of the plotted data.
- **Save** a chart for yourself or share it with the project; every save keeps the **last 10 versions** and a version can be restored (it becomes a version again only when saved).
- **Add to a dashboard**, from the same screen.
- Kind and family names, and all studio labels, in English, French, Spanish and Arabic.

## Rules (see AGENTS.md for the full list)

- One builder (`buildChart`) and one validator (`validateChartSpec`) for the studio, the API, saved charts and dashboards.
- A chart **refuses rather than misleads**, in a plain sentence with a one-click fix where there is one: different units on one raw axis, a rate stacked or sliced or judged as progress, a funnel that grows, a waterfall below zero, a log axis with zero, too few values for a distribution, nothing recorded.
- A missing value is a gap, never 0. Not-yet-verified values are drawn only when asked for, and counted in a note.
- Charts store the specification only, never data.
- A personal chart is its owner's; a project chart is seen by everyone who can see the project and made or changed only by someone with `project.edit`. A save over someone else's change is refused.
- ECharts' own generic description would overwrite ours, so the description is handed to it explicitly.

## Not built

Population pyramid; a chart split by group or by place inside the studio (use the report builder or the By-place charts); server-side PNG for the donor-template Word export; translating the English sentences that the validator writes.
