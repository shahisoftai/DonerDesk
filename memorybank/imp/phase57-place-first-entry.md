# Phase 57 — place-first entry and the by-place sheet (2026-11-16: built, deployed 20261116160000, browser-verified on DEMO-16)

DonorDesk Version 4.01. Two new ways in, beside the ones that stay:
- **A. Place first** (ActivityInfo pattern: partner → location → month): pick a place and a period, see everything due there, fill it.
- **B. By-place sheet** (DevResults Excel pattern): one period, rows = places, columns = indicators (on screen and as .xlsx out/in).

Indicator-first (Record → value, Enter data) and the Entry Sheet stay unchanged.

## 1. Audit — what exists

| Piece | Where | Relevant fact |
| --- | --- | --- |
| Record kinds | `apps/web/src/features/record/domain/record-kinds.ts` | One table; NUMBER and ACTIVITY are PACKED offline. No place step. |
| Indicator value form | `record/presentation/ValueForm.tsx`, `PlaceFigures.tsx` | Indicator → day chips (period derived by `dateLanding`) → one box per place. Saves the whole LOCATION breakdown + total. |
| What happened? | `record/presentation/WorkOutcomeView.tsx` | Planned activity first; places are inherited from it (`inheritPlaces`). |
| Completed activity | contracts `activities.ts` `placeIds` (≤20) | Several places per activity already. |
| Value storage | `IndicatorUpdate` + `indicator-disaggregation.ts` | **One value per indicator per period.** Places are LOCATION entries with `placeId`. **Every dimension must add up to the total** (`validateDisaggregation`). |
| Where measured | `Indicator.placeScope` PROJECT/LEVEL/CHOSEN, `entryRows` | Decides the place rows of an indicator. |
| Footprint | `ProjectArea`, `placesForNewWork` | Project's open areas; closed areas not offered. |
| Plan by place | `PlannedActivityPlace` | Planned work linked to places by id. |
| Bulk save | `BulkUpsertIndicatorUpdatesHandler` | `expectedUpdatedAt` conflict check, entry window, locks, verified values; whole-breakdown replace. |
| Quick save | `QuickEnterIndicatorValueHandler` | Date → period, then atomic `createIndicatorUpdate`. |
| Offline pack v2 | `GetOfflinePackHandler` | Indicators, periods, places, own 14-day plan. No footprint, no current by-place figures. |
| Templates | `exports/templates/`, `IMPORT_TEMPLATES` | Indicator template is indicator-per-row; nothing by place. |

## 2. The one hard problem: writing one place's figure

Place-first writes **one cell** (place P, indicator I, period T) of a value that is stored **whole** (total + all places).
Two officers at two places saving at once would overwrite each other if the browser sent the whole breakdown.

**Rule: a place cell is merged on the server, never assembled in the browser.**
- New application service `PlaceCellWriter.set({indicatorId, periodId, placeId, value | "" , expectedCellValue?})`:
  read the current value → replace/remove only that place's LOCATION entry → total = sum of place entries (additive types only) → write through the **existing** `createIndicatorUpdate` / bulk path (so window, lock, verified, audit all apply). No new write path to the table.
- Retried once on a version conflict (merging is safe because it touches only its own cell); a refusal names the cause.
- **Refused, with a sentence**, when: the value is VERIFIED or the period locked; the indicator is calculated.
- **Splits inside a place (owner decision 1: yes).** A place cell may carry its own SEX/AGE/… split: entries of another dimension get the same optional `placeId` ("within this place"). Rules in `validateDisaggregation`: the split of a place adds up to that place's figure; the project-wide split of a dimension is **derived** (sum of the places' splits, never typed twice) when every place carries it, else typed as today; entries without `placeId` keep their meaning (old values unchanged). Stored in the existing `disaggregationJson` (no migration); `MAX_DISAGGREGATION_ENTRIES` (50) rises to fit places × categories (proposed 500, checked in the validator). Reports, Data Center, maps and the writer keep reading project-wide entries; per-place splits reach "Results by place" and the by-place sheet.
- A cleared cell removes the entry (never 0). The total is never typed in place-first.
- The cell conflict check is per cell (`expectedCellValue`), not per value, so two places never block each other.
- Offline: a new outbox kind `place-cell` (one entry per cell, id = idempotency key), same parking rules.

Rate indicators (PERCENTAGE/RATIO) recorded by place: store the place entries without a computed total (today a rate with LOCATION entries already has no summed total — confirm in `validateDisaggregation` during 57.1 and pin with a test).

## 3. A — place first

Domain (pure, `packages/domain/src/contexts/places/place-agenda.ts`):
- `placeAgenda({ place, period, indicators, plan, values, tree })` → what is due at this place:
  - **Planned activities** whose places include the place or a place inside it (via `PlaceTree`), with a planned end in the period, not DONE/CANCELLED.
  - **Indicators** whose place rows (`entryRows`) include the place, and that are due (`isDueInPeriod`), with the current cell value and its state (empty / draft / handed in / verified / read-only + reason).
  - Ordered by a table (`AGENDA_ORDER`), nothing branched on kind names.
- `placeChoicesForEntry(footprint, tree, recent)`: this project's open areas and sites; recent places first; never closed areas (`placesForNewWork`).

Web: new Record kind **`PLACE`** (one row in `RECORD_KINDS`, `anyOf: indicator.update | activity.create`, PACKED):
1. Place (the one `PlacePicker`) + period (`DayChips` / week / month chips; period derived as now).
2. Checklist: activities ("What happened?" opens `WorkOutcomeView` with the place pre-set) and indicator cells (inline number boxes, saved through `PlaceCellWriter`).
3. "Next place" keeps the period. Place and period are remembered per device (`record-prefs.ts`).
Offered to **everyone** (owner decision 2) as a first choice in Record: "Start from a place" beside "Start from an indicator"; the last one used is remembered per device.

Completed activity from place-first: `placeIds = [place]` unless the planned activity names more (then pre-ticked, editable).

Offline pack v3 (additive): footprint ids, and for the person's places the current cell values + versions of due by-place indicators for open periods only. Wiped on sign-out like now. Weigh against a lost phone: figures only for the person's own project, no names of people.

## 4. B — by-place sheet

Domain (pure, `packages/domain/src/contexts/reporting/place-sheet.ts`):
- `placeSheet({ period, indicators, values, tree, level? })` → rows = places (by `entryRows` union, grouped by level, path shown), columns = by-place indicators; a cell is value | `""` | locked(reason); a column a place does not measure is "—" (not measured there), never 0.
- `placeSheetDiff(before, after)` → list of cell writes for `PlaceCellWriter`.
- Column total row = sum for additive types, blank for rates.

Screen: Entry Sheet gets a **view switch "By indicator | By place"** (same page, same period picker, same engine features where they fit: paste from Excel, fill, undo, autosave = drafts only). Reuse `entry-sheet.ts` by making the row/column axes an argument instead of a second engine.

Excel: `buildPlaceSheetWorkbook` in `exports/templates/` on `template-kit.ts`: one tab per admin level, rows = places (hidden place id + code + path), columns = indicators (hidden indicator id), data validation, locked cells marked; parser `parsePlaceSheetTable` (by place id, else code; by indicator id, else code; unknown rows/columns named, never applied; any bad cell blocks the sheet; empty = untouched, never clears). Route: `GET …/reporting-periods/:id/place-sheet/export`, `POST …/place-sheet/parse` (in `RULES`), applied through `PlaceCellWriter`. Round-trip test like `import-templates.test.mjs`.

## 5. Batches

| Batch | Content | Ship |
| --- | --- | --- |
| 57.1 | Per-place splits in `validateDisaggregation` + `PlaceCellWriter` + rules + tests (DB journey: two places at once, verified, locked, SEX-split refusal, rate) + `POST /v1/indicator-updates/place-cell` | api |
| 57.2 | `placeAgenda`, PLACE record kind, place-first screen, prefs, landing for field roles | both |
| 57.3 | Offline pack v3 + `place-cell` outbox sender | both |
| 57.4 | `placeSheet` + "By place" view in the Entry Sheet | both |
| 57.5 | By-place .xlsx export/parse + round-trip test | both |
| 57.6 | Copy in four languages, support article (three registrations), `test:record` + new `test:place-sheet` harness, AGENTS.md section | web |

No migration expected (cells live in the existing breakdown). No env.

## 6. Decisions (owner, 2026-11-16): 1 yes (splits inside a place), 2 offered to all, 3 ok, 4 ok. Guiding rule: simplify every step for the user.

### Original questions
1. Should a value with a SEX/AGE split also be enterable per place (needs cross-tab breakdowns = schema change)? Proposed: **no, read-only in place-first for now**.
2. Who lands on place-first by default? Proposed: field officers and partners.
3. Offline pack v3 carrying current figures per place — acceptable for a lost phone? Proposed: yes, own places, open periods only.
4. Week as a choice in place-first when periods are monthly: proposed as a **day picker inside the period** only (the value is still per period).
