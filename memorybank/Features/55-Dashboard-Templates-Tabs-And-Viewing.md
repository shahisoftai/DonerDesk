# Feature 55: Dashboards v2, sector templates, tabs, full screen and print

**DonorDesk Version 3.007 (Phase 34.3)**
**Status:** built, tested and deployed 2026-10-28 (Phase 39 additions below deployed 2026-11-03, `releaseId=20261103044136` and `20261103054323`) (migration `20261030100000_dashboard_templates`; tabs, report tables and text blocks need no migration because they live in the dashboard's stored widgets). Harnesses: `pnpm --filter @donordesk/web test:templates` (12 checks), `test:tiles` (18) and `test:visuals` (6 pictures); see the Phase 39 section. Tried in the signed-in app on 2026-11-03 (`demo/verification-2026-11-03-dashboards.md`).
**Rules:** `AGENTS.md` → "Phase 34.3" and "Phase 39 invariants". Builds on [Feature 48](./48-Dashboards.md).

## What a person gets

- **Any Chart Studio chart** on a dashboard (not only the original six), plus **tables**, **text blocks** and **saved-report tables** (see [Feature 57](./57-Indicator-Views-And-Report-Builder.md)). A chart that needs the plan, activity days, budget or place results gets them only when the viewer may see them; a share link never carries them.
- **Sector templates** at `/dashboards/templates`: six starters (WASH, health, nutrition, education, food security, protection) written as **roles, not indicators** ("people trained", "coverage rate"). Choose a project and a template, map each role to one of the project's indicators (suggestions only; you choose), and the dashboard is made. A chart whose role you leave unmapped is left out and listed by name; if nothing can be drawn the apply is refused.
- **Templates are always drafts and always editable.** There is no sign-off state. A built-in is never changed in place: **Copy** makes an organisation template you own. The editor changes name, sector and description, the roles, and every chart (add, change, move, resize, remove); removing a role that charts use is refused, naming them. Organisation templates are saved, listed and can be deleted.
- **Tabs**: in edit mode a "Tabs" list names the tab of each chart (up to 8 tabs, 1–40 characters). A tab bar appears on the dashboard and on a shared link. Charts with no name sit on an "Overview" tab that shows only when other tabs exist.
- **Full screen (TV mode)**: the dashboard fills the screen and refreshes every 60 seconds.
- **Print**: prints only the dashboard (menus hidden, charts not split).
- **Project filter**: a dashboard mixing projects gets a "Show one project" selector (view only, never saved).

## Rules

- A dashboard stores specifications and positions, never data; every figure is drawn when it opens.
- Templates name roles, never ids; `applyTemplate` answers `NEEDS_INDICATOR` instead of inventing a figure.
- Layout is one pure rule shared by dashboards and templates (`settleLayout`, `moveWidget`, `resizeWidget`).
- Sharing and conflict rules are those of Feature 48.

## Phase 39: how a dashboard looks and reads (2026-11-03)

Plan, as-built record and deviations: `imp/phase39-enh-dashboards.md` §12. Rules: `AGENTS.md` → "Phase 39 invariants".

- **One frame and one theme.** Every widget is a `Tile` drawn by a registered renderer (`presentation/widgets/registry.tsx`); charts use theme *roles* (text, muted, surface, positive, negative…) that swap for dark mode, and one chart-library theme built from the design tokens. A chart's title is shown once (in the tile header; the subtitle is its own line) and 2–4 lines are named at their ends instead of a legend.
- **KPI tiles** show the latest figure in compact form (full figure on hover), the change since the previous period (arrow and words, never colour alone), a progress bar to target, a sparkline that keeps its shape, and one sentence such as "42% of the 1000 target at Feb 2026". Nothing is judged for a rate, a missing target or no figure. There is no "behind" status: the share of target is against the final target, so a part-way figure cannot be called late.
- **View data** on every chart: the table of exactly the values drawn (a gap is "Not measured", never 0); also the way to read a chart without seeing it. Pointing at a period, slice or region highlights it in the other charts.
- **Headline row.** A dashboard made from a template starts with up to four KPI tiles for the mapped roles (required roles first, never the same indicator twice), the charts three rows lower. Existing dashboards are not changed.
- **Instant drawing while editing.** A tile you add, or whose settings you change in place, is drawn immediately; there is no "save first" step. Saving still decides what is kept.
- **Low-data mode** (toolbar button, kept on this device; the browser's "reduce data" request applies when nothing is chosen): charts show as tables and the chart library is not loaded. Charts draw only when scrolled into view; **Print** and **Download image** first draw every chart. Maps are not covered by low-data mode.
- **Phones and wall displays.** Below 640 px each kind of tile has its own height; full screen stretches the rows to fill the screen; touch controls are 44 px. The toolbar's project and period selects are width-capped so the page never scrolls sideways.
- **Share links** now show activity-count tiles, plan charts and maps (see [Feature 48](./48-Dashboards.md)); money, budgets and project lists stay out. A map on a link is drawn from data the server read once and sent with the page.
- **Home** keeps its own small server-drawn bars and line, now coloured from the same tokens.

## Not built

Filtering a dashboard by place, group or status (only the viewer's period filter, set by clicking a period label or the selector, exists); the ⋯ menu for Edit and Remove (they are visible buttons); hatched marks for unverified points; container-aware simplification of small charts; a measured bundle budget and a throttled-network check; a headline row for dashboards made before 2026-11-03; sections inside a tab; publishing to partners and the admin switch (34.9). Number tiles, KPI tiles, map tiles, project lists, pinning to Home and the viewer's period filter were built in Phase 35 (`AGENTS.md` → "Phase 35 invariants").
