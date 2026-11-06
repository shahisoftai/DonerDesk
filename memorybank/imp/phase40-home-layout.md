# Phase 40 — Home layout: fix the empty space, then let people arrange it

Status (2026-11-03): Part A (steps 1–6 for the portfolio Home) and Part B (engine, storage, API, arrange list) are BUILT and tested, not deployed. See AGENTS.md "Phase 40". Left: Reviewer and Field Homes on the same grid, drag-and-drop, an organisation default, translations, a look at the real page with real data.
Deviations from the plan below: a layout is order + width + hidden (not x/y/w/h cells): Home panels differ in height with their data, so row heights cannot be fixed. The arrange list uses buttons and a select instead of dragging. Layout changes are audited (the repo rule is that every mutation is). Server validation checks the shape only; role visibility is applied on read.
Original status: Based on a read of `PortfolioHome.tsx`, `ReviewerHome.tsx`, `HomeParts.tsx` and `home-tiles.ts`; not yet looked at in a browser.

## 1. The problem

Home is a fixed list of rows. Each row is a CSS grid, and grid cells stretch to the tallest cell. When a heavy panel sits beside a light one, the light one becomes a tall, mostly empty card.

| Row (PortfolioHome) | Heavy | Light |
| --- | --- | --- |
| `xl:grid-cols-[1.6fr_1fr]` | Project health table (up to 8 rows of 2–3 lines) | Upcoming reports |
| `xl:grid-cols-[1.4fr_1fr]` | Report pipeline (grows with periods) | Risks and problems |
| `lg:grid-cols-3` | Results against target (6 bars + caption) | Delivery this week, Data and evidence (3-row stat lists) |
| `lg:grid-cols-2` | Your work (4 cards) | Notifications |

Also: nothing caps a panel's height, empty states keep a full-size card, and Funding, Where we work, Projects by … and Grants each take a full-width row. ReviewerHome uses the same two-column row pattern.

## 2. Part A — fix the layout (no new data, no migration)

Do first. Each step is small and local. Web only, `SCOPE=web`.

1. **Collapse empty panels.** A panel with nothing to show renders as a one-line bar ("Risks: none open"), not a card. Shared helper in `HomeParts.tsx`.
2. **Cap list heights.** Project health table 8 → 5 rows (full table is in the Portfolio). Lists get a `max-h` with internal scroll or a "Show N more" toggle. No panel grows without a limit.
3. **Re-pair the rows by size.**
   - Merge "Delivery this week" and "Data and evidence" into one "Delivery and data" card with two sections.
   - Pair Results against target with Upcoming reports (both medium), and Pipeline with Project health only where heights are similar.
   - Stat lists and short lists go together in one row of short panels.
4. **Shared `HomeGrid` wrapper** used by PortfolioHome, ReviewerHome and the other variants, so the rule lives in one place.
5. **Fill short panels with something useful**, not padding: next due date and readiness in Upcoming reports, counts by severity in Risks, unread count in Notifications.
6. **Merge thin bands**: headline cards and Funding as one strip.

Check at 390, 768 and 1300 px, light and dark. The existing harness approach (`test:visuals`) is the model for a Home picture test; add one rather than relying on the eye.

## 3. Part B — let each person arrange Home

Do after Part A. Most people will never customise, so the default must look right on its own.

### What a person can do
- **Edit layout** button on Home opens an edit mode: drag to move, resize, hide a panel, add back a hidden one. Keyboard does the same (arrows move, Shift + arrows resize), as on dashboards.
- Nothing is saved until **Save**. **Cancel** discards. **Reset to default** removes the saved layout.
- Under 640 px: fixed reading order, no dragging. A hidden panel stays hidden.

### Rules
- **Hide, never reveal.** `showsTile` / `HOME_TILES_BY_VARIANT` stays the rule for what a role may see. A saved layout can only hide or move what the role already shows. A tile the role later loses is ignored at read time.
- **A layout stores positions, never data.** Each panel is `{ key, x, y, w, h, hidden }` on the 12-column grid. Every figure is read fresh.
- **Unknown or new panels fall back to the default.** A panel added in a later release appears at its default place. A key that no longer exists is dropped on read. A malformed layout is ignored (default shown), never an error page.
- **Own layout only.** One layout per person per Home variant. No handler takes a user id. Nobody sees another person's layout. (Admin "set the default for everyone" is not in scope.)
- **A missing panel never leaves a hole**: the grid settles upward (`settleLayout`).

### Reuse
- `settleLayout`, `moveWidget`, `resizeWidget`, `removeWidget` are already generic over `GridBox` (Phase 34.0). Home uses them unchanged.
- Panels become named blocks. `HOME_TILES` today covers NEEDS_YOU, PINNED, BOOKMARKS, HEADLINES, FUNDING, MAP, BREAKDOWNS, PROJECT_HEALTH, GRANTS. Add the rest: UPCOMING_REPORTS, PIPELINE, RISKS, DELIVERY, DATA_EVIDENCE, RESULTS, YOUR_WORK, NOTIFICATIONS. The exhaustive-table test then forces a decision per variant for each.
- A renderer registry (same idea as dashboards' `widgets/registry.tsx`): a new panel is a registry row, not a branch in the Home component.
- Default layout per variant is a table next to `HOME_TILES_BY_VARIANT`. The Part A grouping becomes that default.

### Data and API
- New table `HomeLayout`: `id`, `tenantId`, `userId`, `variant`, `layoutJson`, `updatedAt`. Unique on `(tenantId, userId, variant)`. RLS forced; add to `rls.sql`; the RLS-coverage test must pass. Additive migration, applied before the code.
- Routes: `GET /v1/home-layout?variant=`, `PUT /v1/home-layout` (body: variant, layout, `expectedUpdatedAt`), `DELETE /v1/home-layout?variant=` (reset). All in `RULES` with `project.view` (any signed-in role that has a Home); the handler uses the caller's own id. Add to `EXTERNAL_ALLOWED` only if outside partners get a Home.
- Pure validation in the domain (`checkHomeLayout`): known keys only, inside the grid, no overlap after settling, size limits per panel. Same function on the server and in the edit mode.
- A save over a newer one is refused as a conflict (same as dashboards). No audit event needed for a personal view setting; confirm with the owner.
- `/ready` requires `HomeLayout.layoutJson`.

### Web
- Server component reads the layout with the page data (one extra small read, in parallel); a failed read shows the default.
- `HomeCanvas` (client) renders the registry rows in edit mode only; the normal view stays server-rendered. A function is never passed from a server to a client component (pass keys and booleans).
- Copy in the typed catalogue (four languages; drafts without a native reviewer).
- Logical start/end utilities for the new UI so Arabic works.

## 4. Tests

- Part A: Home picture test (light/dark, 390/768/1300) with a data-rich and a data-poor fixture; empty-state test.
- Part B domain: `checkHomeLayout` table tests; hidden tile of a role never revealed; unknown key dropped; new panel appended at default; exhaustive over variants.
- API: authorization coverage (rules present); RLS coverage; two users cannot read each other's layout; conflict on stale save.
- Browser harness: drag, resize, hide, save, reset, keyboard, phone fallback.
- Targeted tests per batch only; full suites before a deploy.

## 5. Order and deploy

1. Part A steps 1–2, ship. 2. Part A steps 3–6, ship. 3. Part B domain + registry + defaults (no schema yet; edit mode saves nothing). 4. Part B table, routes, save. 5. Harness and translations.

Deploy for Part A: web only. Deploy for Part B: migration (additive, first), `rls.sql` per table and check `rowsecurity`, `SCOPE=both`, smallest scope and the quick method in AGENTS.md.

## 6. Open questions for the owner

- Should an admin be able to set the default Home for the whole organisation, or is a personal layout enough?
- Should layouts follow the person across variants if their role changes, or restart from the new default? (Plan assumes one layout per variant.)
- Is an audit row wanted for layout changes? (Plan assumes no.)
- Does the Field Home need arranging, or only Director/Manager/Reviewer? (It has only pins and bookmarks today.)
