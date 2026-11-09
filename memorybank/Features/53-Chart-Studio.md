# Feature 53: Chart Studio and saved charts

**DonorDesk Version 3.007 (Phase 34.1, extended by Phase 47 on 2026-11-09: see the last section)**
**Status:** built, tested and deployed 2026-10-28 (`releaseId=20261028133938`, migration `20261030090000_saved_charts`). Browser-tested in a harness (`pnpm --filter @donordesk/web test:studio`, 21 checks); not yet tried by a person in the signed-in app.
**Rules:** `AGENTS.md` → "Phase 34.0", "Phase 34.1" and "Phase 34.3". **Plan:** `imp/phase34-devresults-parity-plan.md` §3.

## What a person gets

- **A chart workshop** at `/projects/:id/charts` (link on the Data Center page): data on the left, the drawing in the middle, type and style on the right.
- **50 kinds of chart** (43 before Phase 47; see the last section) from one set of recorded figures: bars (vertical, horizontal, grouped, stacked, 100% stacked), lollipop, bullet, lines, areas, pies, donuts, funnel, waterfall, gauge, radar, treemap, sunburst, waffle, scatter, histogram, box plot, heatmap, pivot and scorecard tables, finance charts (budget against spending, burn rate), a Gantt of the work plan, a calendar of completed activities, a Sankey of the budget (donor → cost category → spent), results by place and, on the bundled world map, graduated symbols and a country choropleth. Only the population pyramid is not drawable (needs an age × sex split the data sheet does not hold).
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

## Appearance since Phase 39 (2026-11-03)

The builder names colours by role (`chart-theme-roles.ts`; `LIGHT_ROLES` for stored and exported pictures, `retheme` for a dark screen) instead of writing hex, and a live tile prepares the option with `forScreen` (no embedded title, space given back to the plot, end labels for 2–4 lines). Reports, exports and the Studio keep the builder's own look and title. The light signal colours were deepened for contrast (`#059669`, `#dc2626`), which also changed exported pictures. See `imp/phase39-enh-dashboards.md` §12.

## Phase 47 (2026-11-09): style options, 40 themes, 11 new chart types

Deployed in three releases the same day (last `20261109125815`; no migration, no env); verified in a signed-in browser on production (DEMO-16). Plan and as-built record: `imp/phase47-chart-editing.md`; rules: `AGENTS.md` → "Phase 47 invariants". Public article: `apps/web/content/support/how-to/how-to-use-the-chart-studio.md`.

- **A style block on the spec** (`ChartSpecV2.style`, optional, no migration): about 110 options in 25 groups, all described by one table (`STYLE_FIELDS`) that also drives the validator, the Studio's "Look and feel" panel and the tests. Applied to the finished option (`applyChartStyle`); a spec with no style draws exactly as before.
- **"Look and feel" panel**: theme picker, one control per option grouped by part of the chart, defaults shown as placeholders, per-group reset and "Reset all style", click a bar/line/slice/title/axis to open its group, gauge colour-band editor. Changing the chart type drops the groups the new type cannot use (`pruneStyleForKind`). Option names in en/fr/es/ar (`style-copy.ts`; drafts).
- **40 themes** (`chart-presets.ts`): DonorDesk, Modern, Print, Quiet and the 36 stock Apache ECharts themes generated from the installed package (`scripts/build-chart-presets.mjs`), with colours fitted to 3:1 on light and dark surfaces. Dark screens draw a theme's dark colours.
- **11 new kinds** (`chart-render-kinds.ts`): pictorial bar (one icon per stated unit, a fainter icon for a part), rose, radial bar, range band and range bars (two chosen indicators), parallel coordinates, tree (by logframe level), network (donors and categories), stream, fill gauge, progress rings. **Not built on purpose:** error bars, word cloud, population pyramid.
- **Screen-only extras**: zoom bars, a save-as-picture button and the delay between marks (`applyScreenInteraction`); downloads and files never carry them. Axis prefix/suffix, the average line's text and every other option are plain data, so they survive dashboards and files.
- **Files and dashboards**: dashboards and canvas blocks carry the theme and screen settings; a file keeps a colour set a person chose and uses brand colours for the default palette; a chart added from the Studio to a dashboard now also lands on its converted canvas (it had been written only to the old record).
- **Design check**: tip for five or more colours without patterns, warning for a chosen colour too pale on white.
- **Tests**: `chart-style-fields.test.mjs` (every option: valid in scope, changes the drawing, refused out of range), `chart-kinds.test.mjs`, `chart-presets.test.mjs`, `chart-block-lint.test.mjs`, `chart-kinds-export.test.mjs` (server-side render of every kind), web `chart-studio-style` and `chart-style-copy`, and the Studio browser harness (`pnpm --filter @donordesk/web test:studio`, 41 checks; `STUDIO_ONLY=<regex>` runs a subset).
- **Left**: two hidden "ZZ TEST p47" widgets on the old dashboard record `7398dc9d-…` (no screen reaches it); a native review of the translations; table-derived report charts still use the older chart settings and carry no style.

