# Feature 48: Dashboards of Data Center charts

**DonorDesk Version 3.007 (Phase 33.8)**
**Status:** built and tested; deployed 2026-10-28 (`releaseId=20261028051819`, migration `20261029110000_dashboards`). Not yet checked by a person in a browser (dragging, sharing).
**Rules:** `AGENTS.md` → "Phase 33.8 invariants — dashboards".

## What a person gets

- **Dashboards** of charts from the Data Center, at three scopes: only you, the whole organisation, or one project. Listed under **Dashboards** in the navigation and as a tab on each project.
- **Add to a dashboard**: under the Data Center chart builder, choose a dashboard you can change; the chart is added below the others.
- **Layout**: charts sit on a 12-column grid. Drag by the title bar, resize from the corner, or use the keyboard (arrows move, Shift + arrows resize). Other charts make room; nothing overlaps. Nothing is kept until **Save**. On a narrow screen the charts stack in order.
- **Share**: a read-only link (1 to 180 days) and an iframe embed code. The link shows the charts as they stand whenever it is opened. Finance figures are never shown through a link.
- **Delete** removes the dashboard and its share links.

## Rules

- A dashboard stores chart specifications and positions, **never data**. Every figure is drawn from the project's data sheet when the dashboard opens.
- A chart whose project the viewer cannot see says so; it is never drawn.
- A personal dashboard is invisible to everyone else. A shared one can be created and changed only by someone with `project.edit`, and a chart can name only a project the saver can see.
- A save over someone else's change is refused with a plain message; nothing is merged.
- A size outside the grid is fitted to it, not refused.
- Up to 24 charts per dashboard.

## Not built

Table and number-tile widgets; per-viewer filters; password-protected links; a rate limit on the dashboard pages was added at the nginx layer (`dd_public_dashboards`), not in the app.
