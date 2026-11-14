# 65 — Datasets and kits: bring in any table, build pages from it

**DonorDesk Version 3.007 (Phase 54)**

> **Version 4.000 layout (2026-11-14, Phase 55):** datasets are under **Dashboards and infographics → Datasets**, and in a project under **Data** (under **More → Datasets** until the project has one). See [66](66-New-UX-Version-4.md).
**Status:** built and deployed 2026-11-14 (releases `20261114090638` … `20261114122602`); checked in a signed-in browser on production (demo tenant, DEMO-14, synthetic ZZ TEST data).
**Plan:** `../imp/phase54-datasets-and-nutrition-kit.md` (§16.3 is the build record). **Rules:** `AGENTS.md` → "Phase 54 invariants — datasets and kits". Builds on [62](62-Visual-Studio.md) and [63](63-Maps-Hardening.md).

## What a person gets

| Where | What |
|---|---|
| Dashboards and infographics → Datasets; project → Datasets | Upload a CSV or Excel file (or pull DHIS2, or read a collection form's records). A wizard reads the sheet, guesses each column's kind and meaning, matches places by code, alias, then a unique name (never guessed), tidies it (rename, drop, fill down, unpivot, split, map values…) and checks it. A duplicate key blocks the save; problems download as a sheet. |
| Kit offer | When the columns fit a sector kit (Nutrition, WASH) the kit is offered: it relabels the columns, adds its figures and checks, and builds a set of pages. Kits are sector data only; every chart, calculation and rule works for any sector. Kit content is unreviewed. |
| Canvas blocks | **Data visual** (chart, table, card, map), **Slicer**, **Data completeness**, **What differs** (drivers). A slicer narrows every dataset block on the page and never its own column. |
| Map visual | The real Maps explorer: boundaries, colours, legend, indicator picker, drilling. Counts add up the place tree; a rate is Σ part ÷ Σ whole per area, never summed or averaged; rows whose place matched nothing are counted in a note. A slicer recolours the map at the level shown. |
| Seeing districts | The card opens at the country's first level (provinces). Click a province, then **Open its districts** in the panel under the map (scroll inside the card); go back with the trail above the map. **View as a table** lists the same figures. |
| Dataset page | Overview, versions (last 10 kept), links to indicators (written as drafts only; a verified value is never overwritten), sharing (restricted tier for personal data), connector. |
| Share links | Charts and maps show; partner, donor, money, hidden and restricted columns never go through a link. |

## Where it lives

| Concern | Code |
|---|---|
| Rules (pure) | `packages/domain/src/contexts/datasets/` (`browser.ts` is the browser subpath) |
| Queries and aggregates | `contexts/visual-data/` (`catalogue.ts` open catalogue, `aggregates.ts`, `wells.ts`, `shape.ts`) |
| Blocks | `contexts/canvas/blocks/data-*.ts`, map figures in `data-visual-map.ts` |
| Handlers | `packages/application/src/use-cases/datasets/` (`pipeline.ts` is the one path from file to rows; `dataset-sources.ts` reads rows and places for blocks) |
| Storage | `Dataset`, `DatasetVersion`, `DatasetRow` (jsonb), `DatasetIndicatorLink`; migration `20261118090000_datasets`; RLS forced |
| Routes | `/v1/datasets*`, `/internal/datasets/pull` (hourly, `run-reminders.sh`) |
| Web | `apps/web/src/features/datasets/` (wizard, dataset page, block screens, `DatasetMapView` through `DatasetMapProvider`); map reload on new data in `features/maps/presentation/ResultsMap.tsx` |

## Known gaps

- Uncoloured area: a place with no P-code whose name differs from the boundary file (for example "Sudurpashchim Province") until its code is added under Places.
- The map does not open at district level by itself, even for a district table.
- Not checked live: linking to indicators, refresh with a new month, DHIS2 pull, the restricted tier, drag in the wells editor, Arabic. Usability sessions with real people and native review of the translations are owed.
