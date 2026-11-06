import { buildChart, type ChartBuild } from "../../reporting/chart-render.js";
import { validateChartSpec, type ChartSpecV2 } from "../../reporting/chart-spec-v2.js";
import type { DatasetResult } from "../../reporting/dataset-query.js";
import { projectSlot } from "../binding.js";
import { defineBlock } from "../block-definition.js";

export interface ChartProps { spec: ChartSpecV2 }

/** Any Chart Studio chart. The one builder and the one validator are the studio's own, so a chart means the same everywhere. */
export const chartBlock = defineBlock<ChartProps, Extract<ChartBuild, { ok: true }>, DatasetResult>({
  kind: "CHART",
  family: "CHARTS",
  labelKey: "canvas.block.CHART",
  requiresSetup: true,
  needsAlt: true,
  defaults: () => ({ spec: undefined as unknown as ChartSpecV2 }),
  validate: ({ spec }) => (spec ? validateChartSpec(spec).slice(0, 1).map((p) => ({ message: p.message })) : [{ message: "A chart needs its settings." }]),
  slots: [projectSlot(["PERIOD", "DRAFTS"])],
  sizes: { min: { w: 3, h: 3 }, max: { w: 12, h: 10 }, default: { w: 6, h: 4 } },
  lint: [],
  resolve: ({ spec }, data) => { const r = buildChart(spec, data); return r.ok ? { state: "ready", model: r, notes: [] } : { state: "unavailable", reason: r.reason }; },
});
