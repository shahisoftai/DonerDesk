# Phase 43 — Places by ticking, list and map (2026-11-05, branch 0017-maps-v2)

**Decision (user):** the wizard's Places slide shows the country's admin tree on the left and an interactive map on the right. Ticking an area
selects it, and it is saved with the rest of the draft, so choosing places is one step, not a form of names, kinds and parents.

## What changed
| Layer | Change |
| --- | --- |
| Domain | `PlaceDef.code` (the file's P-code, when it has one), `PlaceDef.mapRef` (stable boundary key: marks a place ticked on the map), `PlaceDef.viaChildren` (listed only as the parent of ticked areas). New place operation `SET_BOUNDARY_PLACES` replaces exactly the map-made places and keeps everything typed or proposed by a document, except a place the map now names itself (same name and kind; a document place with no kind matches by name). `placesSheet` sends a `Code` column. `places.area` is met when anything was ticked. |
| Contracts | `PlaceDefSchema` gains the three fields; `SetupPlaceOperationSchema` gains `SET_BOUNDARY_PLACES` (≤ 1500 areas). |
| Web domain | `pcw/domain/place-picker.ts` (tick rules, rows, parents by P-code else position, search, document matching) and `place-picker-scene.ts` (the map scene). Pure, unit-tested. |
| Web UI | `PlacePicker` (list + map + chips), `PlacePickTree`, `PlacePickMap` (MapLibre when WebGL starts, else `PickSvgMap`), `TickedChips`, `OtherPlaces`, `usePlaceLevels`. `PlacesSlide` is now these four parts. The typed Kind/Inside dropdowns, "project area" and "boundary level" fields are gone. |

## Rules
- Ticking an area means the project works across all of it. An area inside a ticked one shows ticked and locked; ticking a larger area drops ticks inside it. A mixed box means "some inside".
- Parents come from the file's parent P-codes, else position (the map's own rule). Admin 1 (Natural Earth) has no P-codes; admin 2–4 (OCHA) do. Never joined by name alone.
- Every tick is saved at once, one request at a time (the last tick wins, none is lost). Launch is unchanged: places go through the ordinary places import, now with their codes.
- Levels load as the person opens them; search and "match the documents' places" load them all.
- No online tile service: the basemap is the self-hosted one where it exists, otherwise boundaries on a plain ground; with no WebGL the same areas are drawn as plain shapes.
- Document places: one button matches them to areas by name and kind (a name shared by several areas is never guessed); what is left stays under "Other places" to confirm or remove.

## Not done / owed
- Browser harness for the slide (`test:pcw` needs the new slide's stubs).
- A native reader for the French, Spanish and Arabic sentences (drafts).
- Level names are generic ("State or province", "District"…); a country's own words (parish, sub-county) are not used.
- Areas at admin 4 for large countries are loaded as a whole level when searched.
