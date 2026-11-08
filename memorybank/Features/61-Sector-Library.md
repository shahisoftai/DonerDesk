# Feature 61: The sector library — comprehensive indicators and sector packs

**DonorDesk Version 3.007**

Built and deployed 2026-11-08 (Phase 46, branch `0018-optimisation`, commits `0c8e41bb`, `9e91372f`; releases `20261108093248` and the fixes release after it). Plan and decisions: [`../imp/phase46-sector-library.md`](../imp/phase46-sector-library.md). Content notes: `../sphere.md`. Invariants: AGENTS.md "Phase 46 invariants". Public article: `apps/web/content/support/basic-information-sector-library.md`.

## What a person gets
- **30 main sectors + 4 themes** (protection/AAP, MEAL, finance and grants, safeguarding), about 280 indicators with source, edition, definition, kind, direction, breakdowns, means of verification and an optional reference standard. All start **unreviewed**; only three Sphere figures are marked checked.
- **Wizard**: the Start slide takes a main sector (and others), shows the sector's assessment questions, "Use the starting answers" fills what is empty (a pack exists for every main sector), Results can add the suggested results with their activities, Indicators/Results offer "Choose from the library". Launch has a first step that links the created indicators to their library entries.
- **Project Logframe page**: "Choose from the library", a "Sector library" label, the reference standard, and library updates shown as a diff and applied field by field.
- **Entry screens**: the reference standard beside the target (Form view) with a "meets / below the reference" line; it never replaces the target's stoplight.
- **Settings → Sector library**: review progress per sector, reviewer sheet out and back, organisation entries (added, reworded, hidden).
- **Generated**: 18 sector dashboard templates (`tpl-lib-*`) and 25 canvas templates (`lib-canvas-*`) from role-keyed headline indicators.

## Rules that were corrected after the first browser pass (2026-11-08)
- **Placement never guesses.** `pickNodeFor`: the sector's suggested result that fits, else a project result sharing two words, else nothing. The wizard raises `indicatorUnplaced` (requirement `indicators.placed`); the project picker skips with "Choose where it goes".
- **Frequencies are one table** (`FREQUENCY_CHOICES`): cadences and events ("Per survey" …). Event indicators are not due in an ordinary month.
- **The starting answers retry** on a lost save (3 attempts) and the button waits for a ready draft.
- **The Sheet shows a `Ref` tag** beside the target of an indicator with a reference (the comparison line stays in the row details and the Form view).
- **A taken project code is warned about while typing** (`CheckProjectCodeHandler`, `GET /v1/projects/code-available`, slides 2 and 10) and, if it still happens, is answered with a sentence about the code (`writeFailure`), never the database's message.

## Verification on production (2026-11-08)
One test project per main sector (30) created through the wizard on the test tenant, all launched with the library-links step Done; Logframe labels, reference tags, the project picker, Settings → Sector library (0 of 278 reviewed) and the Form-view reference line checked; all 30 test projects archived (the product hard-deletes demo projects only).

## Not built / owed
All 278 entries need human review; fr/es/ar chrome is draft and entry wording is English; IATI or other registry adapters; chart reference lines; chart reference lines.
