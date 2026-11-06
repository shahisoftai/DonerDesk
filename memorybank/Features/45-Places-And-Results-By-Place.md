# Feature 45: Places and results by place

**DonorDesk Version 3.007 (Phase 33.1 + 33.2)**
**Status:** built and tested; deployed 2026-10-27 (`releaseId=20261027154750`). Not yet checked by a person in a signed-in browser.
**Plan:** `../imp/phase33-competitive-parity-plan.md` · **Rules:** `AGENTS.md` → "Phase 33 invariants — programme management" and "Phase 33.1–33.2 (places)".

## What a person gets

| Piece | In plain words | Where |
|---|---|---|
| Places list | The organisation's own list of where it works: a country, region, district or site, with aliases and optional coordinates | Settings → Places |
| Sheet import | Places pasted or uploaded as a sheet; a preview first; one bad row blocks the sheet and names the row | Settings → Places → Import |
| Places to confirm | Typed locations that no place answers to, listed so someone can add the place or fix the name | Settings → Places |
| Results by place | Each indicator rolled up through the place tree at a chosen level, with the figures that were recorded for each place | Data Center → **By place** |
| CSV | The place roll-up as a file | Data Center → By place → Download |

## Rules

- A place is checked as a whole: its parent sits strictly above it, no cycles, coordinates come in pairs, an area has no pin, no duplicate name under one parent.
- Matching uses the one location normaliser (`normalizeLocationKey`). "Rabak, White Nile" narrows the match; two places with nothing to tell them apart are **AMBIGUOUS**, never guessed.
- Retiring a place is refused while live places sit inside it. Records keep the text that was typed; they are resolved when read, never rewritten.
- Additive indicator types sum up the tree. A rate or ratio is shown for the place that recorded it and is **never combined** with other places. A parent is "partly reported" when a child place recorded nothing.
- A value typed against a location that matches no place, several places, or an area bigger than the chosen level is listed apart as unplaced. It is never dropped and never spread across places.
- An indicator with no location breakdown is listed, never shown as zero.

## Who can do what

Reading places and results: any member who can see the project (`project.view`). Changing the list: `project.edit`. Every change is audited.

## Public API

`GET /api/v1/projects/:id/place-results?level=` with a key that has the `places:read` scope. See feature 51 for the API keys and the rest of the integrations.

## Not built

Place targets; choropleth and map of the roll-up in reports; report tables and infographic blocks that read the roll-up; per-place assignment to a project ("Where we work"); entry-time suggestions in the indicator grid; a bigger bundled gazetteer.
