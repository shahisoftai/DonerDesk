import { buildChart, resolveDataset, datasetQueryFor } from "../../dist/index.js";

// Fixtures shared by the chart tests of Phase 47 (a copy of the ones in chart-render.test.mjs).
export const periods = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((label, i) => ({ id: `p${i + 1}`, label, start: `2026-0${i + 1}-01`, end: `2026-0${i + 1}-28`, reportType: "MONTHLY", locked: false }));
export const ind = (id, extra = {}) => ({ id, code: id.toUpperCase(), name: `Indicator ${id}`, level: "OUTPUT", type: "COUNT", unit: "people", baseline: "10", target: "200", isRate: false, ...extra });
export const cells = (id, vals, cum, status = "VERIFIED") => vals.flatMap((v, i) => (v === null ? [] : [{ indicatorId: id, periodId: `p${i + 1}`, periodValue: String(v), cumulativeValue: String(cum?.[i] ?? ""), status }]));
export const sheet = {
  projectId: "x", periods,
  finance: [
    { periodId: "p1", currency: "USD", budget: "1000", expenditure: "100", balance: "900", burnRatePercent: "10.0", verified: true },
    { periodId: "p2", currency: "USD", budget: "1000", expenditure: "250", balance: "750", burnRatePercent: "25.0", verified: true },
    { periodId: "p3", currency: "USD", budget: "1000", expenditure: "400", balance: "600", burnRatePercent: "40.0", verified: false },
  ],
  indicators: [ind("a", { level: "OUTCOME" }), ind("b", { target: "100" }), ind("c", { unit: "kits", target: "50" }), ind("r", { type: "PERCENTAGE", unit: "%", isRate: true, target: "90" }), ind("n", { baseline: "0" }), ind("w", { baseline: "0" })],
  cells: [
    ...cells("a", [10, 20, 30, 40, 50, 60], [10, 30, 60, 100, 150, 210]),
    ...cells("b", [5, 8, 6, 12, 9, 15], [5, 13, 19, 31, 40, 55]),
    ...cells("c", [1, 2, null, 4, 5, 6], [1, 3, null, 7, 12, 18], "DRAFT"),
    ...cells("r", [60, 62, 65, 70, 72, 75], [60, 62, 65, 70, 72, 75], "SUBMITTED"),
    ...cells("n", [3, -2, 4, null, null, null], [3, 1, 5]),
    ...cells("w", [1, -5, 2, null, null, null], [1, -4, -2]),
  ],
};
export const q = (ids, over = {}) => ({ indicatorIds: ids, measure: "PERIOD", includeDraft: true, ...over });
export const ds = (ids, over) => resolveDataset(sheet, q(ids, over));
export const spec = (kind, template, ids, over = {}) => ({ version: 2, kind, dataset: { template, indicatorIds: ids, measure: "PERIOD", showTarget: false, includeDraft: true, ...(over.dataset ?? {}) }, ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== "dataset")) });
export const ALL = ["a", "b", "c", "r", "n", "w"];
/** Data the server attaches (plan, completed-activity days, budget lines): a fixture, as the sheet has none of it. */
export const EXTRA = {
  plan: [
    { id: "1", title: "Drill boreholes", kind: "ACTIVITY", start: "2026-01-05", end: "2026-02-20", status: "DONE", signal: "DONE", signalLabel: "Done" },
    { id: "2", title: "Train committees", kind: "ACTIVITY", start: "2026-02-01", end: "2026-04-30", status: "IN_PROGRESS", signal: "LATE", signalLabel: "Late" },
    { id: "3", title: "Handover", kind: "MILESTONE", start: "2026-05-15", end: "2026-05-15", status: "PLANNED", signal: "ON_TIME", signalLabel: "On time" },
  ],
  activityDays: [{ date: "2026-01-12", count: 2 }, { date: "2026-01-13", count: 1 }, { date: "2026-03-02", count: 4 }],
  places: [
    { name: "Sudan", path: "Sudan", level: 0, value: 500, partly: false, latitude: 15.5, longitude: 32.5 },
    { name: "Chad", path: "Chad", level: 0, value: 200, partly: true },
    { name: "Kenya", path: "Kenya", level: 0, value: null, partly: false },
    { name: "Rabak", path: "Rabak › White Nile › Sudan", level: 2, value: 120, partly: false, latitude: 13.2, longitude: 32.7 },
  ],
  budget: [
    { donor: "USAID", category: "Equipment", currency: "USD", budgeted: 1000, spent: 400 },
    { donor: "USAID", category: "Training", currency: "USD", budgeted: 500, spent: 600 },
    { donor: "EU", category: "Equipment", currency: "USD", budgeted: 300, spent: 0 },
  ],
};
export const build = (s, data) => buildChart(s, data ?? { ...resolveDataset(sheet, datasetQueryFor(s, ALL)), ...EXTRA });
export const seriesOf = (b) => b.option.series;

/** One combination per drawable kind that must draw. */
export const CASES = {
  BAR: ["INDICATOR_OVER_TIME", ["a"]], BAR_HORIZONTAL: ["INDICATORS_PROGRESS", ["a", "b"]], BAR_GROUPED: ["INDICATORS_OVER_TIME", ["a", "b"]], BAR_STACKED: ["INDICATORS_OVER_TIME", ["a", "b"]],
  BAR_STACKED_100: ["INDICATORS_OVER_TIME", ["a", "b"]], LOLLIPOP: ["INDICATORS_PROGRESS", ["a", "b"]], BULLET: ["INDICATOR_VS_TARGET", ["a"]], DOT_PLOT: ["INDICATORS_PROGRESS", ["a", "b"]],
  LINE: ["INDICATOR_OVER_TIME", ["a"]], STEP_LINE: ["INDICATOR_OVER_TIME", ["a"]], AREA: ["INDICATOR_OVER_TIME", ["a"]], AREA_STACKED: ["INDICATORS_OVER_TIME", ["a", "b"]], SPARKLINE: ["INDICATOR_OVER_TIME", ["a"]],
  SLOPE: ["INDICATORS_OVER_TIME", ["a", "b"]], PIE: ["INDICATORS_PROGRESS", ["a", "b"]], DONUT: ["INDICATORS_PROGRESS", ["a", "b"]], TREEMAP: ["STATUS_DISTRIBUTION", []],
  HISTOGRAM: ["INDICATOR_OVER_TIME", ["a"]], BOX_PLOT: ["INDICATORS_OVER_TIME", ["a", "b"]], SCATTER: ["INDICATORS_OVER_TIME", ["a", "b"]], BUBBLE: ["INDICATORS_OVER_TIME", ["a", "b", "n"]],
  HEATMAP: ["INDICATORS_OVER_TIME", ["a", "b"]], FUNNEL: ["INDICATORS_PROGRESS", ["a", "b"]], WATERFALL: ["INDICATOR_OVER_TIME", ["a"]], GAUGE: ["INDICATOR_VS_TARGET", ["a"]],
  PROGRESS_RING: ["INDICATOR_VS_TARGET", ["a"]], PROGRESS_BAR: ["INDICATOR_VS_TARGET", ["a"]], KPI_NUMBER: ["INDICATOR_VS_TARGET", ["a"]], RADAR: ["INDICATORS_PROGRESS", ["a", "b", "c"]],
  CHOROPLETH: ["RESULTS_BY_PLACE", ["a"]], GRADUATED_SYMBOLS: ["RESULTS_BY_PLACE", ["a"]], DOT_DENSITY: ["RESULTS_BY_PLACE", ["a"]], HEX_GRID: ["RESULTS_BY_PLACE", ["a"]],
  GANTT: ["PLAN_TIMELINE", []], CALENDAR_HEATMAP: ["ACTIVITY_DAYS", []], SANKEY: ["BUDGET_FLOW", []],
  SUNBURST: ["INDICATORS_PROGRESS", ["a", "b", "c", "n"]], WAFFLE: ["INDICATORS_PROGRESS", ["a", "b"]],
  PICTORIAL_BAR: ["INDICATORS_PROGRESS", ["a", "b"]], ROSE: ["INDICATORS_PROGRESS", ["a", "b", "c"]], RADIAL_BAR: ["INDICATORS_PROGRESS", ["a", "b"]], AREA_RANGE: ["INDICATORS_OVER_TIME", ["a", "b"]],
  RANGE_BAR: ["INDICATORS_OVER_TIME", ["a", "b"]], PARALLEL: ["INDICATORS_OVER_TIME", ["a", "b", "c"]], TREE: ["INDICATORS_PROGRESS", ["a", "b", "c"]], NETWORK: ["BUDGET_FLOW", []],
  DUMBBELL: ["INDICATORS_OVER_TIME", ["a", "b"]], DIVERGING_BAR: ["INDICATORS_PROGRESS", ["n", "w"]], THERMOMETER: ["INDICATOR_VS_TARGET", ["a"]], BUMP: ["INDICATORS_OVER_TIME", ["a", "b"]], CONNECTED_SCATTER: ["INDICATORS_OVER_TIME", ["a", "b"]],
  THEME_RIVER: ["INDICATORS_OVER_TIME", ["a", "b"]], FILL_GAUGE: ["INDICATOR_VS_TARGET", ["a"]], MULTI_RING: ["INDICATORS_PROGRESS", ["a", "b", "c"]],
  BAR_LINE_COMBO: ["INDICATORS_OVER_TIME", ["a", "b"]], PIVOT_TABLE: ["INDICATORS_OVER_TIME", ["a", "b"]], SCORECARD_TABLE: ["INDICATORS_PROGRESS", ["a", "b", "r"]],
};
export const measureFor = (kind) => (["GAUGE", "PROGRESS_RING", "PROGRESS_BAR", "KPI_NUMBER", "BULLET", "FILL_GAUGE", "MULTI_RING"].includes(kind) ? "CUMULATIVE" : ["FUNNEL", "PIE", "DONUT", "TREEMAP", "LOLLIPOP", "DOT_PLOT", "BAR_HORIZONTAL", "RADAR", "SUNBURST", "WAFFLE"].includes(kind) ? "CUMULATIVE" : "PERIOD");
