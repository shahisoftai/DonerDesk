# Feature 62: Visual Studio

**DonorDesk Version 4.01**

> **Version 4.000 layout (2026-11-14, Phase 55):** the shell's tabs are **Designs** (cards), **Templates**, **Datasets** and a **Tools ▾** menu (Chart Studio, Maps, Images and brand, Data alerts, TV display). "Add to a dashboard" is one control (`AddToDashboard`) used by the Data Center, the Chart Studio and maps. See [66](66-New-UX-Version-4.md).

Phase 48 (2026-11-09 to 2026-11-10, branch `0018-optimisation`). Plan `../imp/phase48-visual-studio.md` (log §14), parity `../imp/phase48-parity.md`, retirement `../imp/phase48-retirement.md`. Invariants: AGENTS.md "Phase 48" sections. Support article: `apps/web/content/support/how-to/how-to-use-the-visual-studio.md`.

## What it is
One shell at `/visuals` (tabs Designs, Charts, Maps, Templates, Assets, Alerts, TV) hosting the canvas editor, Chart Studio and map explorer. Old chart, map, dashboard and infographic addresses redirect into it (route files kept as redirects; delete after 14 days of no traffic).

## Built
- Editing: selection, arrange, clipboard, command palette, layers, 200-step history.
- Data: one catalogue, live refresh over a 30 s version poll, threshold alerts (`DataAlert`).
- Look: themes, fonts (5 bundled extra), shapes and icons, 159 starters.
- Outputs: Present, TV, embed, CSV/xlsx data download, PDF/PNG/SVG/PPTX.
- Charts: parliament, proportion bar, small multiples, dot density, hex grid, beeswarm, violin, ridgeline, marimekko, alluvial, chord, bar race; bivariate and flow maps.
- Drill (level, indicator), motion, email subscriptions (title and link only), presence over SSE (memory only).

## Deploy facts
Migrations `20261112090000_data_alerts`, `20261113090000_place_flows`, `20261113100000_canvas_subscriptions`; RLS per table; `/ready` pairs `DataAlert.ruleKind`, `PlaceFlow.quantity`, `CanvasSubscription.every`; install `scripts/run-reminders.sh` and the nginx apiv1 file by hand. Deployed `20261110130415`, `20261110132856`.

## Not built / not seen live
Population pyramid (by design). Not seen live: bivariate/flow drawing with pinned data, a second person's presence chip, a delivered subscription email.
