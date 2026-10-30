# Phase 35.H — Home snapshot (plan)

Status: **PLAN ONLY, nothing built.** Branch `0015-compitition`. Version: DonorDesk 3.007. Written 2026-10-29.
Compared with: DevResults' Dashboard (tour page: "interactive map of all projects, financial metrics for funds obligated / awarded / disbursed, results visualisations, upcoming tasks, alerts for overdue milestones and over-budget projects, breakdowns of projects by sector, status and mechanism, bookmarking").

## 1. What Home already does (do not rebuild)

`/dashboard` picks a Home by role (`homeVariantFor`): `PortfolioHome` (director, manager), `FieldHome`, `ReviewerHome` (grants, compliance). `PortfolioHome` already has:

| DevResults item | Ours today | Where |
|---|---|---|
| Upcoming tasks | "Your work", My week (field), deadline tiles, upcoming reports | `work-items`, `DeadlineTiles` |
| Alerts: overdue milestones, over budget | Needs-you strip (reports overdue, serious risks, review overdue, evidence, activities, blockers); late planned activities; values overdue; **Budget pace** per project | `needsYouItems`, `PaceBar` |
| Results visualisations | Results against target (bars), project health table, delivery sparkline, report pipeline | `HomeWidgets` |
| Bookmarks | `BookmarksPanel` | 34.7 |
| Funding | Grants cards (director with `org.manage`) | `FundingResponseSchema` |

So the gaps are **four**, not eight:

1. **A map of all projects** (where we work, with each project's delivery state).
2. **A funding snapshot** (money by status, honestly limited by what we record).
3. **Breakdowns by sector, status, country and funder**, each click filtering the projects table.
4. **Pinned tiles**: a person pins a KPI tile, chart or dashboard to their own Home.

Alerts for "over budget" and "overdue milestone" exist per project; the gap is only that Home shows counts, not the named projects. That is folded into (3) as a filter (`?alert=…`), not a new widget.

## 2. Rules (these bind every batch; they restate AGENTS.md, nothing new)

- **Reads only.** Home writes nothing except pinning (own row, per person, like bookmarks). Every action on it is a link to the surface that owns the work.
- **A missing value is never 0.** A project with no budget shows "—"; a total says how many projects it leaves out ("of 9 projects; 2 have no budget recorded").
- **Different currencies never add.** Money is summed per currency and shown per currency; no conversion (rates are manual and 34.6 is not built).
- **Only what the person may see** (`VisibleProjects`); an outside partner has no Home (they land on Projects), unchanged.
- **Hidden, never disabled**: a tile a role may not use is not rendered. One table decides (see §4), exhaustive over `Role`, with a test.
- **No new health score.** The existing delivery band (`healthBand`) is the only label; breakdowns count projects, they do not rate them.
- **One rule per concept**: breakdown grouping is one pure function (`groupProjects`), the table filter reads the same keys; the map reads `siteMapData`/the Places list, not a second geocoder.
- **Writers never see any of it.**

## 3. Batches

### H1 — Breakdowns and the filtered project table (smallest, most useful; no API change)
- Domain (`features/dashboard/domain/home-breakdown.ts`, pure): `groupProjects(rows, by)` for `by ∈ SECTOR | STATUS | COUNTRY | FUNDER`, returning `{ key, label, count, projectIds }[]` sorted by count then label; unknown/empty key is "Not recorded", never dropped. `filterProjects(rows, { by, key, alert })`.
- `PortfolioOverview` rows need `sector` (add to `PortfolioOverviewSchema` and the portfolio overview handler's row; `donorName`, `country`, `status` already there). Additive API field.
- UI: a "Projects by …" panel with a segmented control (Sector · Status · Country · Funder) drawing horizontal bars (counts); clicking a bar sets `?by=&key=` and the existing **Project health** table filters to it, with a "Showing 3 of 9 — clear" line (same pattern as the dashboard's period filter). Alerts counts in the Needs-you strip become links with `?alert=reports-overdue|late|budget-behind|risk-review`.
- Tests: grouping (empty key, ties, stable order), filter (alert filters agree with the counts shown), unknown `by`.
- Roles: director, manager, viewer (portfolio Home). Not field/reviewer Homes.

### H2 — Map of all projects
- Data: one new read `GET /v1/portfolio/map` (`project.view`, in `RULES`, read-only): per visible project, its **sites** = planned-activity locations resolved by `siteMapData` plus the project's place pins; falling back to the project's country (Places country-level pin or the bundled country centroid) so every project appears at least once. A project with nothing locatable is listed "not on the map", never guessed.
- Reuse: `MapCanvas` + a new `portfolio-map-option.ts` (pure): one symbol per site coloured by the **project's** delivery band (existing `SITE_SIGNAL_COLOR`-style table, exhaustive over `healthBand`, word + colour). Hover = project name, donor, band; click = side panel listing the projects at that site with links (DevResults' "popup listing the projects working there").
- Lazy: ECharts and geo load only when the tile is in view (`React.lazy`), as on the plan page; nothing enters the first bundle.
- Tests: option builder (band → colour, unplaced listed), the handler (visibility, fallback to country, no pins → empty), RULES coverage test.

### H3 — Funding snapshot
- Honest scope: today we record **project budget** (`Project.budgetAmount/Currency`), **grants** (amount, currency, dates under programmes) and **expenses** (work-plan budget lines). We do **not** record "obligated vs awarded vs disbursed" or a disbursement register: that is Phase 34.6 (finance) and is not built.
- So H3 shows only what exists: per currency — total grant amount awarded, total project budget, expenditure to date (where a budget with expenses exists), and the share of each (no derived "burn" label beyond the existing Budget pace). Each figure says what it covers and what it leaves out. The words "obligated" and "disbursed" are **not used** until 34.6 records them.
- Role gate: `org.manage` or `budget.view`-style capability already used by Funding/Budget routes; others do not see the tile.
- Data: reuse `FundingResponseSchema` and the per-project budget read the Overview already uses (one batched read; no per-project call from Home).
- Tests: per-currency sums (no mixing), missing budget excluded and counted, role gate.

### H4 — Pinned tiles
- Model: `HomePin` (per person, tenant-scoped, RLS) = `{ id, userId, kind: KPI | DASHBOARD | CHART, ref, position }`, max 12 per person, own rows only (like `Bookmark`: no handler takes a user id). `kind=KPI` pins a **KPI tile query** (`{ projectId, indicatorId, includeDraft }`) directly (no dashboard needed); `DASHBOARD`/`CHART` pins a link-card with the saved chart or dashboard drawn small.
- Reuse: `buildKpi` and `drawCharts` for drawing (one sheet read per project, however many pins); a pin to something the person can no longer see shows "from a project you cannot see" (same as dashboards), never hides silently.
- UI: a "Pin to Home" button on the Chart Studio's KPI add, on a dashboard's header and on a saved chart; a "Your tiles" panel on Home with drag to reorder (reuse `settleLayout` as a one-column list) and remove.
- Migration: `HomePin` (additive, before the code) + `rls.sql` entry + `/ready` pair; routes `GET/POST /v1/home-pins`, `DELETE /v1/home-pins/:id`, `PUT /v1/home-pins/order` (all in `RULES`).
- Tests: cap, own-rows-only, reorder, a pin whose target was deleted, RLS coverage test.

### H5 — Role layout and polish
- One table `HOME_TILES_BY_ROLE` (exhaustive over `Role`, pinned by a test like `ROLE_SURFACES`) decides which of: needs-you, headline tiles, breakdowns, map, funding, pinned, bookmarks each Home shows. Field officer and reviewers keep their current Homes; only portfolio roles gain H1–H4 tiles.
- Loading: each tile is its own `Suspense` boundary (a slow map or funding read never delays the page); each part returns `SectionData<T>` so a failing call shows "unavailable", not a broken page (same as the Overview).
- Copy through `t()`/`tp()` in the four languages; the copy lint scans new strings; right-to-left uses logical utilities.
- Accessibility: every tile has a heading and a text equivalent (the map has the "N of M projects placed" sentence and a table fallback).
- Browser harness: `pnpm --filter @donordesk/web test:home` (bundled real tiles, stubbed actions), run after changing Home.

## 4. Role matrix (initial; one table in code)

| Tile | Director | Manager / M&E | Grants | Compliance | Field | Viewer |
|---|---|---|---|---|---|---|
| Needs you | ✓ | ✓ | ✓ | ✓ | (own) | – |
| Breakdowns (H1) | ✓ | ✓ | – | – | – | ✓ |
| Map (H2) | ✓ | ✓ | ✓ | – | – | ✓ |
| Funding (H3) | ✓ (`org.manage`) | – | ✓ | – | – | – |
| Pinned (H4) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## 5. Order, size and dependencies

| Batch | Size | Needs | Can ship alone |
|---|---|---|---|
| H1 | small | one additive API field (`sector`) | yes |
| H2 | medium | one new read route; boundary files only for the country fallback (bundled centroid is enough) | yes |
| H3 | small | none (existing reads); gated by 34.6 for any wording beyond what we record | yes |
| H4 | medium | migration + RLS + 4 routes | yes |
| H5 | small | H1–H4 | after them |

Recommended: **H1 → H4 → H2 → H3 → H5**. H1 is useful at once and needs no migration; H4 (pinned KPI tiles) makes the KPI tile just built reachable from Home; H2 is the most visible but the heaviest; H3 should wait for a decision on whether to build 34.6 first.

## 6. Not in this plan (and why)

- "Obligated / awarded / disbursed", disbursement register, multi-currency conversion: Phase 34.6 (not built).
- A health **score** or ranking across projects: refused (AGENTS.md "no new health score").
- Partner-facing Home and partner-built dashboards: 34.9.
- Editing from Home: refused (reads only).

## 7. Questions for the owner

1. Funding tile: show only what we record (grant amount, project budget, expenses), or build 34.6's disbursement register first so "disbursed" can be said?
2. Map: is a project with only a country (no sites) acceptable as one symbol at the country, or should it be listed apart?
3. Pinned tiles: personal only (as planned), or also an organisation-wide default Home an admin can set?

## 8. Deploy notes (when built)

H1: additive API field, ship api and web together. H2: new route, `SCOPE=both`. H4: migration `HomePin` (additive, before the code), re-run `rls.sql` and check `rowsecurity`, `/ready` requires the new column, routes in `RULES`. Nothing in H1–H3 changes the database.
