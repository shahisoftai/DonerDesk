# Feature 55: Dashboards v2, sector templates, tabs, full screen and print

**DonorDesk Version 3.007 (Phase 34.3)**
**Status:** built, tested and deployed 2026-10-28 (migration `20261030100000_dashboard_templates`; tabs, report tables and text blocks need no migration because they live in the dashboard's stored widgets). Harness: `pnpm --filter @donordesk/web test:templates` (14 checks). Not yet tried by a person in the signed-in app.
**Rules:** `AGENTS.md` → "Phase 34.3". Builds on [Feature 48](./48-Dashboards.md).

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

## Not built

A viewer-side period filter and cross-filtering (both need a new data call that redraws charts); pinning a dashboard as a Home tile; sections inside a tab; publishing to partners and the admin switch (34.9).
