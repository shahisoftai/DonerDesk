import { buildKpi, validateKpiQuery, type KpiQuery, type KpiTile } from "../../dashboards/kpi.js";
import type { DataSheet } from "../../reporting/data-sheet.js";
import { projectSlot } from "../binding.js";
import { defineBlock } from "../block-definition.js";

/** One indicator's latest figure with change, status and sparkline. All rules live in `buildKpi`; nothing is restated here. */
export const kpiBlock = defineBlock<KpiQuery, KpiTile, { sheet: DataSheet }>({
  kind: "KPI",
  family: "NUMBERS",
  labelKey: "canvas.block.KPI",
  requiresSetup: true,
  defaults: () => ({ indicatorId: "", includeDraft: false }),
  validate: (q) => { const m = validateKpiQuery(q); return m ? [{ message: m }] : []; },
  slots: [projectSlot(["PERIOD", "DRAFTS"])],
  sizes: { min: { w: 2, h: 2 }, max: { w: 6, h: 4 }, default: { w: 3, h: 2 } },
  lint: [],
  resolve: (q, { sheet }) => { const r = buildKpi(sheet, q); return r.ok ? { state: "ready", model: r.tile, notes: [] } : { state: "unavailable", reason: r.reason }; },
});
