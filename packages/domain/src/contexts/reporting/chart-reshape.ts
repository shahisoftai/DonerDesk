/**
 * Choosing a chart kind never hides it (Phase 61.2). Every drawable kind is offered; when the current data cannot be drawn as that kind, the
 * chart is reshaped to data that can ("Pie shows one value per category, so it now shows each indicator's latest value") and the person is
 * told. A kind that cannot honestly be drawn from anything the project holds is refused with the reason. Pure; the honesty rules stay in
 * `validateChartSpec` and the builders, which run on the result.
 */
import { CHART_KINDS, TEMPLATE_SHAPE, kindsForTemplate, type ChartKind, type ChartShape, type ChartSpecV2 } from "./chart-spec-v2.js";
import { DATA_CHART_TEMPLATES, type DataChartTemplate } from "./data-charts.js";

/** Which template to reach for first when a kind needs a shape; the first row whose kinds include the chosen kind wins. */
const TEMPLATE_PREFERENCE: readonly DataChartTemplate[] = [
  "INDICATORS_OVER_TIME", "INDICATOR_OVER_TIME", "INDICATORS_PROGRESS", "INDICATOR_VS_TARGET", "STATUS_DISTRIBUTION", "RESULTS_BY_PLACE",
  "FINANCE_BUDGET_VS_SPEND", "PLAN_TIMELINE", "ACTIVITY_DAYS", "BUDGET_FLOW", "RESULTS_BY_PLACE_PAIR", "FLOWS_BETWEEN_PLACES", "FINANCE_BURN_RATE",
];

const SHAPE_SENTENCE: Record<ChartShape, string> = {
  SERIES_BY_PERIOD: "one value for each period",
  LATEST: "each indicator's latest value",
  TARGET_TRIPLE: "one indicator's baseline, target and latest result",
  STATUS: "how many recorded values are verified, handed in or draft",
  FINANCE: "budget and spending by period",
  PLAN: "the work plan",
  DAYS: "completed activities by day",
  BUDGET: "budget lines by donor and cost category",
  PLACES: "each place's figure",
};

export type ReshapeResult = { ok: true; spec: ChartSpecV2; /** Set when the data changed to fit the kind: what the chart now shows, in a sentence. */ note: string | null } | { ok: false; reason: string };

/** The template a kind is drawn from: the current one when it fits, else the best one that does. */
export function templateForKind(kind: ChartKind, current: DataChartTemplate): DataChartTemplate | null {
  if (kindsForTemplate(current).includes(kind)) return current;
  return TEMPLATE_PREFERENCE.find((t) => TEMPLATE_SHAPE[t] !== null && kindsForTemplate(t).includes(kind)) ?? null;
}

/** Every kind a person can pick for a project's data: all BUILT kinds, in catalogue order. */
export const pickableKinds = (): ChartKind[] => (Object.keys(CHART_KINDS) as ChartKind[]).filter((k) => CHART_KINDS[k].status === "BUILT");

export function reshapeForKind(spec: ChartSpecV2, kind: ChartKind, allIndicatorIds: ReadonlyArray<string>): ReshapeResult {
  const rule = CHART_KINDS[kind];
  if (!rule) return { ok: false, reason: "That is not a chart kind the product knows." };
  if (rule.status === "PLANNED") return { ok: false, reason: `${rule.label} is not available yet: the records it needs are not held in a form it can be drawn from.` };
  const template = templateForKind(kind, spec.dataset.template);
  if (!template) return { ok: false, reason: `${rule.label} cannot be drawn from this project's data.` };
  if (template === spec.dataset.template) return { ok: true, spec: { ...spec, kind }, note: null };
  const info = DATA_CHART_TEMPLATES[template];
  const current = spec.dataset.indicatorIds;
  const pool = [...new Set([...current, ...allIndicatorIds])];
  const need = (rule.minPoints > 1 ? Math.min(rule.minPoints, 6) : 1);
  const indicatorIds = template === "RESULTS_BY_PLACE_PAIR" ? pool.slice(0, 2)
    : info.indicators === "none" ? []
    : info.indicators === "one" ? (current.length > 0 ? [current[0]!] : pool.slice(0, 1))
    : (current.length >= need ? current : pool.slice(0, Math.max(need, Math.min(6, pool.length))));
  const measure = template === "INDICATORS_PROGRESS" && spec.dataset.measure === "PERIOD" ? "PERCENT_OF_TARGET" : spec.dataset.measure;
  const shape = TEMPLATE_SHAPE[template]!;
  return {
    ok: true,
    spec: { ...spec, kind, dataset: { ...spec.dataset, template, indicatorIds, measure } },
    note: `${rule.label} needs ${SHAPE_SENTENCE[shape]}, so the chart now shows that.`,
  };
}
