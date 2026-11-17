# Phase 60 — Humanitarian-standard dashboard and infographic templates (2026-11-17, branch `0025-place-tree`)

Source: the 2026-11-17 audit of `dashboards/` , `canvas/templates-builtin.ts` and `infographics/` against OCHA, UNICEF and WFP products.

## Rules for every batch (SOLID, made checkable)
- **S** one module, one reason to change: a disclaimer table, a funnel-stage resolver, a template file per product, a role matcher, a CSV writer are separate files.
- **O** a new product, border note, stage source or export format is a **row in a table**; no existing function gains a branch on a name.
- **L** every new template satisfies the same `CanvasTemplate` / `DashboardTemplate` contract and passes the same tests the old ones do (apply, validate, lint, golden).
- **I** consumers receive the narrow shape they use (`FunnelFacts`, `RoleIndicatorFacts`), not the whole facts object.
- **D** domain stays pure; the print painter and the screen model both call the one domain resolver; nothing imports an adapter.
- No migration, no env, no route change except `format=hxl` on the existing data-sheet export.

## Batches
| # | Batch | Files |
|---|---|---|
| 60.1 | Complete the UN map-disclaimer table (Western Sahara, Kosovo, Falklands/Malvinas, in four languages; Crimea, Palestine, Golan, Cyprus and the Gulf name are left out until the UN cartographic wording is confirmed, never invented) | `infographics/map-disclaimers.ts` (rows only) |
| 60.2 | A funnel stage can be bound to an indicator (people in need, targeted from recorded values); one resolver shared by screen and print | `canvas/funnel-stage.ts` (new), `models/numbers.ts`, `infographics/composition.ts`, `infrastructure/infographics/blocks-new.ts` |
| 60.3 | Four product canvases: Response dashboard (need to reached), Country brief, Results table (sitrep), Funding coverage (16:9 and A3 variants are not built) | `canvas/templates-humanitarian.ts` (new), `templates-builtin.ts` |
| 60.4 | Standard sector dashboard: no internal verification pie; the verification pie is dropped (the audit's "silent skip" claim was wrong: `headlineIndicators` already lists counts first) | `dashboards/standard-template.ts`, `sector-library/generated-templates.ts` |
| 60.5 | One house style: starters use the coordination theme | `canvas/templates-builtin.ts`, `template-kit.ts` |
| 60.6 | Role matching by library id first, keywords second | `dashboards/dashboard-templates.ts` (`suggestRoleMapping`), `sector-library/generated-templates.ts` |
| 60.7 | HXL-tagged CSV of the data sheet (`format=hxl`) | `reporting/hxl-sheet.ts` (new), existing data-sheet export route |

## Not in this phase (stated, not forgotten)
IATI export; tagged/accessible PDF (needs a test of the composer output first); native review of new FR/ES/AR text; confirming the demographic age bands (0-4, 5-11, 12-17, 18-59, 60+) and disability disaggregation.

## Verification
Domain tests for each batch; `canvas-golden` refreshed once with `UPDATE_GOLDEN=1` and reviewed; `pnpm --filter` typecheck of domain, infrastructure, api, web; the infographic/canvas print-parity test; deploy `SCOPE=both`; browser check on the open signed-in session.
