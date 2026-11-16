# 67 — Place-first entry, the By place sheet and Excel by place

**DonorDesk Version 4.01 (Phase 57)**
**Status:** built and deployed 2026-11-16 (releases `20261116120000` both, `20261116140000` both, `20261116160000` web); checked in a signed-in browser on production (DEMO-16 Kenya Education, owner's demo account). No migration, no env, no RLS change.
**Plan and decisions:** [`../imp/phase57-place-first-entry.md`](../imp/phase57-place-first-entry.md). **Rules:** `AGENTS.md` → "Phase 57 invariants". **Support:** `apps/web/content/support/how-to/how-to-record-figures-by-place.md`, `how-to-record-data.md`, `how-to-update-indicator-values.md`, `how-to-use-the-field-app-offline.md`.
Builds on [60](60-Record-One-Data-Entry-Flow.md) (Record sheet), [54](54-Entry-Sheet.md) (Entry Sheet) and Phase 56 (one place tree: footprints, `entryRows`, places linked by id).

## Why

Field work is organised by place: an officer visits a site and has several things to enter for it. ActivityInfo nests entry as partner → location → month; DevResults lays its Excel out as rows = places, columns = indicators. DonorDesk's entry was indicator-first only. Phase 57 adds both as second ways in; indicator-first stays.

## What a person gets

| Surface | What it does |
|---|---|
| **Record → Everything at a place** (first in the chooser, for anyone with `indicator.update` or `activity.create`) | Choose a place (searchable; the last one used per project is first) and a day (Today / Yesterday / Pick a day; the period follows from the day). Shows **Planned here** (the person's open planned work at the place or a place inside it, each with **What happened?**) and **Figures for this place** (every indicator measured there, its current figure, empty first). A locked figure says why (verified, calculated, period closed, not applicable). **Split this figure** splits a place's figure by sex, age group, disability or another group; Save stays off until the groups add up. Only changed boxes are sent. |
| **Report → Inputs → Indicators → By place** | Rows = places, columns = indicators measured by place, a live **Total** row (counts only; a rate has none). Type, or paste a block from Excel (fills right and down, skips grey cells). Grey = locked or not measured at that place (—). **Save changes** sends only changed cells. The choice of view is remembered on the device. |
| **Download Excel / Upload Excel** (By place) | One tab per level of places (Provinces, Districts…), hidden place ids (column A) and indicator ids (row 2), a Read me tab. An upload is checked first: any bad cell blocks the whole file and is named; with none, "Changes in the file: n" and **Apply the file**. An empty cell never clears a figure. |
| **Field app (offline)** | Pack v3 carries the places to start from, where each indicator is measured, and the current figures of the latest two open periods for those places. Entries made with no signal wait as "Figures for a place" and send themselves on reconnect. An older period offline says only the latest open periods are kept on the phone. |
| **Project header Record button** | Opens the chooser (it used to jump straight to "A number"). |

## How it works

- **One place's figure is merged on the server.** `setPlaceCells` (domain, `logframe/place-cell.ts`) replaces only the named places' LOCATION entries; `SetPlaceCellsHandler` saves through the ordinary bulk save with the version it read, and on a version conflict reads and merges again (3 attempts). A cell whose figure changed since the person opened it is refused, naming it ("Someone else has changed OP1-1a at Turkana County…"). Entry windows, locks, verified values, breakdown checks, audit and simple review are the bulk save's own.
- **Totals are added up, never typed** (counts); a rate keeps its project figure and its place figures are recorded as typed. The running total follows the previous period.
- **Splits inside a place** are breakdown entries of another dimension carrying the place id. `IndicatorUpdate.disaggregation` returns the project-wide entries only, so every report, chart, export and writer is unchanged; `placeSplits` returns the splits. When every place carries the same split, the project-wide split is added up from them.
- **Read models**: `placeAgenda` / `placeSheet` / `agendaPlaces` (domain, `places/place-agenda.ts`) use `entryRows`, so place-first, By place and the indicator form agree on where an indicator is measured. Excel: `placeSheetTabs` / `parsePlaceSheetTabs` (domain) + `buildPlaceSheetWorkbook` / `readPlaceSheetWorkbook` (infrastructure).
- **Web**: Record kind `PLACE` (`PlaceFirstView`, `PlacePickerList`, `PlaceCellRow`, pure rules in `features/record/domain/place-first.ts`), sink `PlaceCellSink` and outbox kind `place-cells`; By place is `EntryViewSwitch` + `PlaceSheetView` + `PlaceSheetFile` (pure rules in `features/reporting/domain/place-sheet-view.ts`). Copy: `place-entry-{en,fr,es,ar}.ts`.

## Routes (all in `RULES`, all on the partner allow-list; partners only inside the project's areas)

| Route | Permission |
|---|---|
| `GET /v1/projects/:id/entry-places` | `project.view` |
| `GET /v1/projects/:id/places/:placeId/agenda?periodId=|date=` | `project.view` |
| `GET /v1/projects/:id/place-sheet?periodId=` | `project.view` |
| `GET /v1/projects/:id/place-sheet/export?periodId=` (web `/api/projects/[id]/place-sheet/export`) | `project.view` |
| `POST /v1/projects/:id/place-sheet/import?periodId=` (multipart `apply`, `file`) | `indicator.update` |
| `POST /v1/projects/:id/place-cells` | `indicator.update` |

## Verified live (2026-11-16, DEMO-16)

Chooser order and "Last time"; place list (11 places); May figures locked with the reason; By place shows stored figures (260 × 5 = 1300); paste of a 2×2 block, live total 1318, Save off while a cell held "8x"; saved values merged in the database; split mismatch caught (270 ≠ 280) then saved with the split stored inside Turkana; a stale By place save refused and the server figure unchanged; Excel download (ids hidden, Read me), a bad file refused naming "Provinces, row 7, OC1a", a good file showing 2 changes and applied (1325); pack v3 (11 places, 2 indicators, 20 figures); offline save kept on the phone and sent on reconnect (Wajir 245, total 1125); Arabic right to left; no sideways scroll at 390 px. Test data was restored and re-verified afterwards. OP1-1a and OC1a on DEMO-16 were left measured per county.

## Not built

- Native review of the French, Spanish and Arabic copy (drafts).
- A splits column in the By place sheet and the Excel file (splits are entered in place-first only).
- Choosing a week or month as such: the day picker chooses the period.
- A place-first view of forms and files (photos still travel with an activity).
