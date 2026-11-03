# Feature 48: Dashboards of Data Center charts

**DonorDesk Version 3.007 (Phase 33.8)**
**Status:** built and tested; deployed 2026-10-28 (`releaseId=20261028051819`, migration `20261029110000_dashboards`). Look, reading aids, instant tile drawing and richer share links added in Phase 39 (deployed 2026-11-03, `releaseId=20261103044136` and `20261103054323`; see [Feature 55](./55-Dashboard-Templates-Tabs-And-Viewing.md) and `imp/phase39-enh-dashboards.md` §12). Checked in a signed-in browser on 2026-11-03: `demo/verification-2026-11-03-dashboards.md`.
**Rules:** `AGENTS.md` → "Phase 33.8 invariants — dashboards".

## What a person gets

- **Dashboards** of charts from the Data Center, at three scopes: only you, the whole organisation, or one project. Listed under **Dashboards** in the navigation and as a tab on each project.
- **Add to a dashboard**: under the Data Center chart builder, choose a dashboard you can change; the chart is added below the others.
- **Layout**: charts sit on a 12-column grid. Drag by the title bar, resize from the corner, or use the keyboard (arrows move, Shift + arrows resize). Other charts make room; nothing overlaps. Nothing is kept until **Save**. On a narrow screen the charts stack in order.
- **Share**: a read-only link (1 to 180 days) and an iframe embed code. The link shows the dashboard as it stands whenever it is opened. Since 2026-11-03 it shows indicator charts, **number tiles for activities, plan charts and maps** (the work plan and results by place); **money, budgets and lists of projects are never shown** through a link. A map on a link is a fixed snapshot (no drilling, no time slider). Anyone holding a link can therefore see planned-activity titles, places and delivery state, and results by place.
- **Delete** removes the dashboard and its share links.

## Rules

- A dashboard stores chart specifications and positions, **never data**. Every figure is drawn from the project's data sheet when the dashboard opens.
- A chart whose project the viewer cannot see says so; it is never drawn. A tile that cannot be drawn for any reason keeps its own name and says why.
- A personal dashboard is invisible to everyone else. A shared one can be created and changed only by someone with `project.edit`, and a chart can name only a project the saver can see.
- A save over someone else's change is refused with a plain message; nothing is merged.
- A size outside the grid is fitted to it, not refused.
- Up to 24 charts per dashboard.
- **A tile added or changed while editing is drawn at once**, without saving first: the page asks `POST /v1/dashboard-preview` (read-only, same visibility rules, nothing stored or audited) for any tile that has no drawing yet.

## Not built

Superseded in part by [Feature 55](./55-Dashboard-Templates-Tabs-And-Viewing.md) (Phase 34.3 added table, text and report widgets, tabs, full screen, print and a project filter; Phase 35 added number tiles, KPI tiles, map tiles, project lists, the viewer's period filter and pinning to Home; Phase 39 the visual work). Still not built: password-protected links; filtering a dashboard by place, group or status (only the period filter exists); a per-link switch to hide the plan and maps; a rate limit on the dashboard pages was added at the nginx layer (`dd_public_dashboards`), not in the app.
