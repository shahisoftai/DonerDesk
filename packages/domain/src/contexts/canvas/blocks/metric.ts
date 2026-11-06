import { computeMetric, validateMetricQuery, type MetricInputs, type MetricQuery, type MetricTile } from "../../dashboards/metric-tile.js";
import { projectSlot } from "../binding.js";
import { defineBlock } from "../block-definition.js";

/** A coloured money or activity-count tile; money is never added across currencies (see `computeMetric`). */
export const metricBlock = defineBlock<MetricQuery, MetricTile, MetricInputs>({
  kind: "METRIC",
  family: "NUMBERS",
  labelKey: "canvas.block.METRIC",
  defaults: () => ({ metric: "ACTIVITIES_TOTAL" as MetricQuery["metric"] }),
  validate: (q) => { const m = validateMetricQuery(q); return m ? [{ message: m }] : []; },
  slots: [projectSlot([])],
  sizes: { min: { w: 2, h: 2 }, max: { w: 6, h: 3 }, default: { w: 3, h: 2 } },
  lint: [],
  resolve: (q, inputs) => ({ state: "ready", model: computeMetric(q, inputs ?? {}), notes: [] }),
});
