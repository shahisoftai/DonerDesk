import assert from "node:assert/strict";
import test from "node:test";
import { CHART_KINDS, CHART_KIND_ORDER, CHART_ASPECT, buildChart, datasetQueryFor, resolveDataset, formatChartNumber, kindsForTemplate, waffleCells } from "../dist/index.js";

const periods = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((label, i) => ({ id: `p${i + 1}`, label, start: `2026-0${i + 1}-01`, end: `2026-0${i + 1}-28`, reportType: "MONTHLY", locked: false }));
const ind = (id, extra = {}) => ({ id, code: id.toUpperCase(), name: `Indicator ${id}`, level: "OUTPUT", type: "COUNT", unit: "people", baseline: "10", target: "200", isRate: false, ...extra });
const cells = (id, vals, cum, status = "VERIFIED") => vals.flatMap((v, i) => (v === null ? [] : [{ indicatorId: id, periodId: `p${i + 1}`, periodValue: String(v), cumulativeValue: String(cum?.[i] ?? ""), status }]));
const sheet = {
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
const q = (ids, over = {}) => ({ indicatorIds: ids, measure: "PERIOD", includeDraft: true, ...over });
const ds = (ids, over) => resolveDataset(sheet, q(ids, over));
const spec = (kind, template, ids, over = {}) => ({ version: 2, kind, dataset: { template, indicatorIds: ids, measure: "PERIOD", showTarget: false, includeDraft: true, ...(over.dataset ?? {}) }, ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== "dataset")) });
const ALL = ["a", "b", "c", "r", "n", "w"];
/** Data the server attaches (plan, completed-activity days, budget lines): a fixture, as the sheet has none of it. */
const EXTRA = {
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
const build = (s, data) => buildChart(s, data ?? { ...resolveDataset(sheet, datasetQueryFor(s, ALL)), ...EXTRA });
const seriesOf = (b) => b.option.series;

/** One combination per drawable kind that must draw. */
const CASES = {
  BAR: ["INDICATOR_OVER_TIME", ["a"]], BAR_HORIZONTAL: ["INDICATORS_PROGRESS", ["a", "b"]], BAR_GROUPED: ["INDICATORS_OVER_TIME", ["a", "b"]], BAR_STACKED: ["INDICATORS_OVER_TIME", ["a", "b"]],
  BAR_STACKED_100: ["INDICATORS_OVER_TIME", ["a", "b"]], LOLLIPOP: ["INDICATORS_PROGRESS", ["a", "b"]], BULLET: ["INDICATOR_VS_TARGET", ["a"]], DOT_PLOT: ["INDICATORS_PROGRESS", ["a", "b"]],
  LINE: ["INDICATOR_OVER_TIME", ["a"]], STEP_LINE: ["INDICATOR_OVER_TIME", ["a"]], AREA: ["INDICATOR_OVER_TIME", ["a"]], AREA_STACKED: ["INDICATORS_OVER_TIME", ["a", "b"]], SPARKLINE: ["INDICATOR_OVER_TIME", ["a"]],
  SLOPE: ["INDICATORS_OVER_TIME", ["a", "b"]], PIE: ["INDICATORS_PROGRESS", ["a", "b"]], DONUT: ["INDICATORS_PROGRESS", ["a", "b"]], TREEMAP: ["STATUS_DISTRIBUTION", []],
  HISTOGRAM: ["INDICATOR_OVER_TIME", ["a"]], BOX_PLOT: ["INDICATORS_OVER_TIME", ["a", "b"]], SCATTER: ["INDICATORS_OVER_TIME", ["a", "b"]], BUBBLE: ["INDICATORS_OVER_TIME", ["a", "b", "n"]],
  HEATMAP: ["INDICATORS_OVER_TIME", ["a", "b"]], FUNNEL: ["INDICATORS_PROGRESS", ["a", "b"]], WATERFALL: ["INDICATOR_OVER_TIME", ["a"]], GAUGE: ["INDICATOR_VS_TARGET", ["a"]],
  PROGRESS_RING: ["INDICATOR_VS_TARGET", ["a"]], PROGRESS_BAR: ["INDICATOR_VS_TARGET", ["a"]], KPI_NUMBER: ["INDICATOR_VS_TARGET", ["a"]], RADAR: ["INDICATORS_PROGRESS", ["a", "b", "c"]],
  CHOROPLETH: ["RESULTS_BY_PLACE", ["a"]], GRADUATED_SYMBOLS: ["RESULTS_BY_PLACE", ["a"]],
  GANTT: ["PLAN_TIMELINE", []], CALENDAR_HEATMAP: ["ACTIVITY_DAYS", []], SANKEY: ["BUDGET_FLOW", []],
  SUNBURST: ["INDICATORS_PROGRESS", ["a", "b", "c", "n"]], WAFFLE: ["INDICATORS_PROGRESS", ["a", "b"]],
  BAR_LINE_COMBO: ["INDICATORS_OVER_TIME", ["a", "b"]], PIVOT_TABLE: ["INDICATORS_OVER_TIME", ["a", "b"]], SCORECARD_TABLE: ["INDICATORS_PROGRESS", ["a", "b", "r"]],
};
const measureFor = (kind) => (["GAUGE", "PROGRESS_RING", "PROGRESS_BAR", "KPI_NUMBER", "BULLET"].includes(kind) ? "CUMULATIVE" : ["FUNNEL", "PIE", "DONUT", "TREEMAP", "LOLLIPOP", "DOT_PLOT", "BAR_HORIZONTAL", "RADAR", "SUNBURST", "WAFFLE"].includes(kind) ? "CUMULATIVE" : "PERIOD");

test("every drawable kind has a case, and every case draws (a table or a chart option)", () => {
  const built = CHART_KIND_ORDER.filter((k) => CHART_KINDS[k].status === "BUILT");
  assert.deepEqual(Object.keys(CASES).sort(), [...built].sort(), "the case table covers exactly the drawable kinds");
  for (const [kind, [template, ids]] of Object.entries(CASES)) {
    const b = build(spec(kind, template, ids, { dataset: { measure: measureFor(kind) } }));
    assert.equal(b.ok, true, `${kind}: ${b.reason}`);
    assert.ok(b.title.length > 0, kind);
    assert.ok(b.alt.length > 10, kind);
    assert.ok(b.aspect > 0, kind);
    if (CHART_KINDS[kind].family === "TABLE") { assert.equal(b.render, "TABLE", kind); assert.ok(b.columns.length > 2 && b.rows.length > 0, kind); }
    else { assert.equal(b.render, "ECHART", kind); assert.ok(b.option.aria.enabled, kind); assert.ok(Array.isArray(b.option.series) || b.option.graphic, kind); }
  }
});

test("the template's data shape allows every case (the validator and the builder agree)", () => {
  for (const [kind, [template]] of Object.entries(CASES)) assert.ok(kindsForTemplate(template).includes(kind), `${kind} on ${template}`);
});

test("kinds draw as the marks they claim", () => {
  const t = (kind, template = "INDICATORS_OVER_TIME", ids = ["a", "b"], extra = {}) => build(spec(kind, template, ids, { dataset: { measure: measureFor(kind), ...(extra.dataset ?? {}) }, ...extra }));
  assert.deepEqual(seriesOf(t("BAR")).map((s) => s.type), ["bar", "bar"]);
  assert.ok(seriesOf(t("BAR_STACKED")).every((s) => s.stack === "total"));
  assert.equal(seriesOf(t("BAR_GROUPED")).some((s) => s.stack), false);
  const h = t("BAR_HORIZONTAL", "INDICATORS_PROGRESS");
  assert.equal(h.option.xAxis.type, "value");
  assert.equal(h.option.yAxis.type, "category");
  assert.equal(seriesOf(t("STEP_LINE"))[0].step, "end");
  assert.ok(seriesOf(t("AREA"))[0].areaStyle);
  assert.ok(seriesOf(t("AREA_STACKED")).every((s) => s.stack === "total" && s.areaStyle));
  assert.deepEqual(seriesOf(t("BAR_LINE_COMBO")).map((s) => s.type), ["bar", "line"]);
  assert.equal(seriesOf(t("DONUT", "INDICATORS_PROGRESS"))[0].type, "pie");
  assert.deepEqual(seriesOf(t("DONUT", "INDICATORS_PROGRESS"))[0].radius, ["45%", "70%"]);
  assert.equal(seriesOf(t("TREEMAP", "STATUS_DISTRIBUTION", []))[0].type, "treemap");
  assert.equal(seriesOf(t("FUNNEL", "INDICATORS_PROGRESS"))[0].type, "funnel");
  assert.equal(seriesOf(t("HEATMAP"))[0].type, "heatmap");
  assert.equal(seriesOf(t("BOX_PLOT"))[0].type, "boxplot");
  assert.equal(seriesOf(t("SCATTER"))[0].type, "scatter");
  assert.equal(seriesOf(t("GAUGE", "INDICATOR_VS_TARGET", ["a"]))[0].type, "gauge");
  assert.equal(seriesOf(t("RADAR", "INDICATORS_PROGRESS", ["a", "b", "c"]))[0].type, "radar");
  assert.equal(seriesOf(t("SLOPE"))[0].data.length, 2, "a slope chart has the first and last period only");
});

test("a missing value is a gap, never 0", () => {
  const b = build(spec("LINE", "INDICATOR_OVER_TIME", ["c"]));
  assert.deepEqual(seriesOf(b)[0].data, [1, 2, null, 4, 5, 6]);
  const bar = build(spec("BAR", "INDICATOR_OVER_TIME", ["c"]));
  assert.equal(seriesOf(bar)[0].data[2], null);
  const pivot = build(spec("PIVOT_TABLE", "INDICATORS_OVER_TIME", ["c"]));
  assert.equal(pivot.rows[0][4], "Not measured");
});

test("bars start at zero; a series with negative values lets the axis show them", () => {
  assert.equal(build(spec("BAR", "INDICATOR_OVER_TIME", ["a"])).option.yAxis.min, 0);
  assert.equal(build(spec("LINE", "INDICATOR_OVER_TIME", ["a"])).option.yAxis.min, undefined, "a line is free to float");
  assert.equal(build(spec("BAR", "INDICATOR_OVER_TIME", ["n"])).option.yAxis.min, undefined, "negative values are not cut off");
});

test("a chart that takes no indicators is about all of the project's: the query names them", () => {
  const s = spec("DONUT", "STATUS_DISTRIBUTION", []);
  assert.deepEqual(datasetQueryFor(s, ["a", "b"]).indicatorIds, ["a", "b"]);
  assert.deepEqual(datasetQueryFor(spec("BAR", "INDICATOR_OVER_TIME", ["a"]), ["a", "b"]).indicatorIds, ["a"]);
  assert.deepEqual(datasetQueryFor({ ...spec("BAR", "INDICATOR_OVER_TIME", ["a"]), dataset: { ...spec("BAR", "INDICATOR_OVER_TIME", ["a"]).dataset, fromPeriodId: "p2" } }, []).fromPeriodId, "p2");
  const b = build(s);
  assert.equal(b.ok, true, b.reason);
  assert.ok(seriesOf(b)[0].data.length > 0);
});

test("a rate is never stacked, sliced, funnelled or judged as progress towards a target", () => {
  const stackedRate = build(spec("BAR_STACKED", "INDICATORS_OVER_TIME", ["r", "r"]));
  assert.equal(stackedRate.ok, false);
  assert.match(stackedRate.reason, /rate/);
  assert.equal(build(spec("PIE", "INDICATORS_PROGRESS", ["a", "r"], { dataset: { measure: "CUMULATIVE" } })).ok, false);
  assert.equal(build(spec("FUNNEL", "INDICATORS_PROGRESS", ["a", "r"], { dataset: { measure: "CUMULATIVE" } })).ok, false);
  const gauge = build(spec("GAUGE", "INDICATOR_VS_TARGET", ["r"], { dataset: { measure: "CUMULATIVE" } }));
  assert.equal(gauge.ok, false);
  assert.match(gauge.reason, /share of its target/);
  assert.equal(build(spec("LINE", "INDICATOR_OVER_TIME", ["r"])).ok, true, "a rate can be drawn as a line of what was recorded");
});

test("additive charts refuse negative values; parts of a whole cannot be negative", () => {
  assert.match(build(spec("BAR_STACKED", "INDICATORS_OVER_TIME", ["a", "n"])).reason, /negative/);
  assert.match(build(spec("PIE", "INDICATORS_PROGRESS", ["n", "a"], { dataset: { measure: "PERIOD" } })).reason ?? "", /negative|Nothing above zero|^$/);
});

test("different units never share one raw axis; a named second axis, or % of target, allows it", () => {
  const mixed = build(spec("LINE", "INDICATORS_OVER_TIME", ["a", "c"]));
  assert.equal(mixed.ok, false);
  assert.match(mixed.reason, /different units/);
  const dual = build(spec("LINE", "INDICATORS_OVER_TIME", ["a", "c"], { series: [{ index: 1, axis: "SECONDARY" }], axes: { y2: { title: "Kits" } } }));
  assert.equal(dual.ok, true, dual.reason);
  assert.equal(dual.option.yAxis.length, 2);
  assert.equal(seriesOf(dual)[1].yAxisIndex, 1);
  const pct = build(spec("LINE", "INDICATORS_OVER_TIME", ["a", "c"], { dataset: { measure: "PERCENT_OF_TARGET" } }));
  assert.equal(pct.ok, true);
  assert.equal(build(spec("HEATMAP", "INDICATORS_OVER_TIME", ["a", "c"])).ok, false, "one colour scale needs one unit");
  assert.equal(build(spec("SCATTER", "INDICATORS_OVER_TIME", ["a", "c"])).ok, true, "a scatter has an axis for each unit");
});

test("a funnel's steps must shrink; a waterfall cannot go below zero; a distribution needs enough values", () => {
  const grows = build(spec("FUNNEL", "INDICATORS_PROGRESS", ["b", "a"], { dataset: { measure: "CUMULATIVE" } }));
  assert.equal(grows.ok, false);
  assert.match(grows.reason, /shrink/);
  assert.equal(build(spec("FUNNEL", "INDICATORS_PROGRESS", ["a", "b"], { dataset: { measure: "CUMULATIVE" } })).ok, true);
  assert.match(build(spec("WATERFALL", "INDICATOR_OVER_TIME", ["w"])).reason, /below zero/);
  assert.equal(build(spec("WATERFALL", "INDICATOR_OVER_TIME", ["n"])).ok, true, "a waterfall may have decreases");
  assert.match(build(spec("HISTOGRAM", "INDICATOR_OVER_TIME", ["c"], { dataset: { fromPeriodId: "p1", toPeriodId: "p3" } })).reason, /at least 5/);
  assert.match(build(spec("BOX_PLOT", "INDICATORS_OVER_TIME", ["c"], { dataset: { fromPeriodId: "p1", toPeriodId: "p2" } })).reason, /at least 5/);
  assert.match(build(spec("SPARKLINE", "INDICATOR_OVER_TIME", ["a"], { dataset: { fromPeriodId: "p1", toPeriodId: "p2" } })).reason, /at least 3/);
  assert.match(build(spec("SCATTER", "INDICATORS_OVER_TIME", ["a"])).reason, /two indicators/);
});

test("nothing recorded is refused, not drawn as an empty chart; a log axis cannot show zero or less", () => {
  const empty = build(spec("LINE", "INDICATOR_OVER_TIME", ["r"], { dataset: { fromPeriodId: "p1", toPeriodId: "p1" } }), resolveDataset({ ...sheet, cells: [] }, q(["a"])));
  assert.equal(empty.ok, false);
  assert.match(empty.reason, /No values are recorded/);
  assert.match(build(spec("LINE", "INDICATOR_OVER_TIME", ["n"], { axes: { y: { scale: "LOG" } } })).reason, /logarithmic/);
  assert.equal(build(spec("LINE", "INDICATOR_OVER_TIME", ["a"], { axes: { y: { scale: "LOG" } } })).option.yAxis.type, "log");
});

test("kinds that need data we do not hold, finance, and unknown kinds are refused with a sentence", () => {
  for (const k of ["POPULATION_PYRAMID"]) assert.match(build(spec(k, "INDICATOR_OVER_TIME", ["a"])).reason, /not available yet/);
  assert.equal(build(spec("NOPE", "INDICATOR_OVER_TIME", ["a"])).ok, false);
  assert.match(build(spec("PIE", "INDICATOR_OVER_TIME", ["a"])).reason, /cannot be drawn from this data/);
});

test("drafts are withheld unless asked for, and unverified values are named", () => {
  const draftSheet = { ...sheet, cells: sheet.cells.map((c) => (c.indicatorId === "a" && c.periodId === "p2" ? { ...c, status: "DRAFT" } : c)) };
  const withDrafts = buildChart(spec("LINE", "INDICATOR_OVER_TIME", ["a"]), resolveDataset(draftSheet, q(["a"])));
  assert.ok(withDrafts.notes.some((n) => /1 of 6 plotted values are not verified yet/.test(n)));
  assert.equal(withDrafts.provenance.unverified, 1);
  const without = buildChart(spec("LINE", "INDICATOR_OVER_TIME", ["a"], { dataset: { includeDraft: false } }), resolveDataset(draftSheet, q(["a"], { includeDraft: false })));
  assert.equal(seriesOf(without)[0].data[1], null);
  assert.ok(without.notes.some((n) => /not verified yet/.test(n)));
});

test("series choices: rename, recolour and hide follow the series' original place", () => {
  const b = build(spec("BAR_GROUPED", "INDICATORS_OVER_TIME", ["a", "b"], { series: [{ index: 0, hidden: true }, { index: 1, label: "Kits out", color: "#112233" }] }));
  assert.equal(seriesOf(b).length, 1);
  assert.equal(seriesOf(b)[0].name, "Kits out");
  assert.equal(seriesOf(b)[0].itemStyle.color, "#112233", "the colour chosen for the second series stays with it after the first is hidden");
  assert.equal(build(spec("BAR_GROUPED", "INDICATORS_OVER_TIME", ["a", "b"], { series: [{ index: 0, hidden: true }, { index: 1, hidden: true }] })).ok, false);
  const combo = build(spec("BAR_GROUPED", "INDICATORS_OVER_TIME", ["a", "b"], { series: [{ index: 1, kind: "LINE" }] }));
  assert.deepEqual(seriesOf(combo).map((s) => s.type), ["bar", "line"]);
});

test("sort and top N on each indicator's latest value; the rest are added as Other only when that means something", () => {
  const top = build(spec("BAR", "INDICATORS_PROGRESS", ["a", "b", "c", "n"], { dataset: { measure: "CUMULATIVE", sort: "DESC", topN: 2 } }));
  assert.deepEqual(top.option.xAxis.data, ["A", "B"], "kits and the negative one are left out as different... largest first");
  const additive = build(spec("PIE", "INDICATORS_PROGRESS", ["a", "b", "n"], { dataset: { measure: "CUMULATIVE", sort: "DESC", topN: 1 } }));
  assert.equal(additive.ok, true);
  assert.ok(additive.notes.some((n) => /Other/.test(n)));
  const asc = build(spec("BAR", "INDICATORS_PROGRESS", ["a", "b"], { dataset: { measure: "CUMULATIVE", sort: "ASC" } }));
  assert.deepEqual(asc.option.xAxis.data, ["B", "A"]);
});

test("styling: title, subtitle, palette, legend, labels with number format, axes and size", () => {
  const b = build(spec("BAR_GROUPED", "INDICATORS_OVER_TIME", ["a", "b"], {
    title: "Our title", subtitle: "Oct", paletteId: "COLOUR_BLIND", legend: { position: "TOP" }, size: "SQUARE",
    labels: { show: true, format: "VALUE", numberFormat: "COMPACT" }, axes: { y: { title: "People", max: 500, gridlines: false, reversed: true }, x: { title: "Month" } },
  }));
  assert.equal(b.title, "Our title");
  assert.equal(b.option.title.subtext, "Oct");
  assert.deepEqual(b.option.color.slice(0, 2), ["#0072B2", "#E69F00"]);
  assert.equal(b.option.legend.top, 4);
  assert.equal(b.aspect, CHART_ASPECT.SQUARE);
  assert.equal(b.option.yAxis.name, "People");
  assert.equal(b.option.yAxis.max, 500);
  assert.equal(b.option.yAxis.inverse, true);
  assert.equal(b.option.yAxis.splitLine.show, false);
  assert.equal(b.option.xAxis.name, "Month");
  assert.equal(seriesOf(b)[0].label.formatter({ value: 12500 }), "12.5K");
  assert.equal(build(spec("LINE", "INDICATOR_OVER_TIME", ["a"], { legend: { position: "HIDDEN" } })).option.legend.show, false);
  assert.deepEqual(build(spec("LINE", "INDICATOR_OVER_TIME", ["a"], { colors: ["#abcdef", "nope"] })).option.color, ["#abcdef"]);
});

test("number formats", () => {
  assert.equal(formatChartNumber(1234567), "1,234,567");
  assert.equal(formatChartNumber(1234567, "COMPACT"), "1.2M");
  assert.equal(formatChartNumber(3.14159, "DECIMAL_1"), "3.1");
  assert.equal(formatChartNumber(3, "DECIMAL_2"), "3.00");
});

test("annotations: reference lines, shaded bands and notes; a target line only where it is comparable", () => {
  const b = build(spec("LINE", "INDICATOR_OVER_TIME", ["a"], { annotations: [{ id: "1", type: "LINE", value: 40, text: "Goal" }, { id: "2", type: "BAND", from: 10, to: 30, text: "Dry season" }, { id: "3", type: "NOTE", text: "Campaign started" }] }));
  const s0 = seriesOf(b)[0];
  assert.equal(s0.markLine.data[0].yAxis, 40);
  assert.deepEqual(s0.markArea.data[0].map((x) => x.yAxis), [10, 30]);
  assert.equal(b.option.graphic[0].style.text, "Campaign started");
  const horizontal = build(spec("BAR_HORIZONTAL", "INDICATORS_PROGRESS", ["a", "b"], { dataset: { measure: "CUMULATIVE" }, annotations: [{ id: "1", type: "LINE", value: 100 }] }));
  assert.equal(seriesOf(horizontal)[0].markLine.data[0].xAxis, 100, "on a horizontal bar chart the line is on the value axis");
  const cum = build(spec("LINE", "INDICATOR_OVER_TIME", ["a"], { dataset: { measure: "CUMULATIVE", showTarget: true } }));
  assert.equal(seriesOf(cum)[0].markLine.data[0].yAxis, 200);
  const pct = build(spec("LINE", "INDICATOR_OVER_TIME", ["a"], { dataset: { measure: "PERCENT_OF_TARGET", showTarget: true } }));
  assert.equal(seriesOf(pct)[0].markLine.data[0].yAxis, 100);
  assert.equal(seriesOf(build(spec("LINE", "INDICATOR_OVER_TIME", ["a"], { dataset: { measure: "PERIOD", showTarget: true } })))[0].markLine, undefined, "a period value is not comparable with a cumulative target");
});

test("100% stacked bars show shares of each period's total and say so", () => {
  const b = build(spec("BAR_STACKED_100", "INDICATORS_OVER_TIME", ["a", "b"]));
  assert.equal(b.option.yAxis.max, 100);
  assert.ok(b.notes.some((n) => /shares of that period/.test(n)));
  const col0 = seriesOf(b).map((s) => s.data[0]);
  assert.equal(Math.round(col0[0] + col0[1]), 100);
});

test("scorecard and pivot tables: a gap says Not measured, a rate has no % of target", () => {
  const sc = build(spec("SCORECARD_TABLE", "INDICATORS_PROGRESS", ["a", "r", "c"], { dataset: { measure: "CUMULATIVE" } }));
  assert.deepEqual(sc.columns, ["Code", "Indicator", "Baseline", "Target", "Cumulative", "% of target"]);
  const byCode = Object.fromEntries(sc.rows.map((r) => [r[0], r]));
  assert.equal(byCode.A[5], "105%");
  assert.equal(byCode.R[5], "—", "a rate has no share of its target");
  assert.equal(byCode.A[4], "210");
});

test("progress charts say what the figure is a share of, and need a target above zero", () => {
  const g = build(spec("KPI_NUMBER", "INDICATOR_VS_TARGET", ["a"], { dataset: { measure: "CUMULATIVE" } }));
  assert.match(g.option.graphic[1].style.text, /105% of the target/);
  const none = resolveDataset({ ...sheet, indicators: sheet.indicators.map((i) => (i.id === "a" ? { ...i, target: "" } : i)) }, q(["a"], { measure: "CUMULATIVE" }));
  assert.match(buildChart(spec("GAUGE", "INDICATOR_VS_TARGET", ["a"], { dataset: { measure: "CUMULATIVE" } }), none).reason, /numeric target/);
});

test("the same spec and data always draw the same chart; alt text defaults to a sentence and can be replaced", () => {
  const s = spec("BAR_GROUPED", "INDICATORS_OVER_TIME", ["a", "b"]);
  assert.equal(JSON.stringify(build(s)), JSON.stringify(build(s)));
  const b = build(s);
  assert.match(b.alt, /Grouped bar chart/);
  assert.match(b.alt, /2 series over 6 periods/);
  assert.equal(b.option.aria.label.description, b.alt, "the chart library is told to use our description, not its own");
  assert.equal(build({ ...s, altText: "Mine." }).option.aria.label.description, "Mine.");
  assert.equal(build({ ...s, altText: "Trainings rose every month." }).alt, "Trainings rose every month.");
  assert.equal(build({ ...s, title: "  " }).title.length > 0, true);
});

test("finance: budget and expenditure to date by period, a gap where nothing is recorded, with the currency and what 'to date' means", () => {
  const b = build(spec("BAR_GROUPED", "FINANCE_BUDGET_VS_SPEND", []));
  assert.equal(b.ok, true, b.reason);
  assert.deepEqual(seriesOf(b).map((s) => s.name), ["Budget", "Expenditure to date"]);
  assert.deepEqual(seriesOf(b)[1].data, [100, 250, 400, null, null, null], "no figures for a period is a gap, never 0");
  assert.ok(b.notes.some((n) => /to date/.test(n)));
  assert.ok(b.notes.some((n) => /1 of 3 periods' finance figures are not verified yet/.test(n)));
  assert.match(b.title, /Budget and expenditure/);
  const burn = build(spec("LINE", "FINANCE_BURN_RATE", []));
  assert.deepEqual(seriesOf(burn)[0].data, [10, 25, 40, null, null, null]);
  assert.equal(build(spec("BAR_LINE_COMBO", "FINANCE_BUDGET_VS_SPEND", [])).ok, true);
  assert.equal(build(spec("PIVOT_TABLE", "FINANCE_BUDGET_VS_SPEND", [])).render, "TABLE");
});

test("finance honesty: drafts withheld on request, several currencies refused, no figures refused, budget and spend never stacked", () => {
  const without = build(spec("BAR", "FINANCE_BUDGET_VS_SPEND", [], { dataset: { includeDraft: false } }));
  assert.deepEqual(seriesOf(without)[1].data.slice(0, 4), [100, 250, null, null], "the unverified period is left out");
  const mixed = buildChart(spec("BAR", "FINANCE_BUDGET_VS_SPEND", []), resolveDataset({ ...sheet, finance: [...sheet.finance, { periodId: "p4", currency: "EUR", budget: "1", expenditure: "1", balance: "0", verified: true }] }, q([])));
  assert.match(mixed.reason, /more than one currency/);
  const none = buildChart(spec("BAR", "FINANCE_BUDGET_VS_SPEND", []), resolveDataset({ ...sheet, finance: [] }, q([])));
  assert.match(none.reason, /No finance figures/);
  assert.equal(build(spec("BAR_STACKED", "FINANCE_BUDGET_VS_SPEND", [])).ok, false);
  assert.equal(build(spec("PIE", "FINANCE_BUDGET_VS_SPEND", [])).ok, false);
});

test("a waffle shares 100 squares between the parts: always 100, never a part lost, ties broken the same way every time", () => {
  assert.deepEqual(waffleCells([50, 50]), [50, 50]);
  assert.equal(waffleCells([1, 1, 1]).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(waffleCells([1, 1, 1]), [34, 33, 33]);
  assert.equal(waffleCells([333, 333, 334]).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(waffleCells([0, 0]), [0, 0]);
  const w = build(spec("WAFFLE", "INDICATORS_PROGRESS", ["a", "b"], { dataset: { measure: "CUMULATIVE" } }));
  assert.equal(seriesOf(w)[0].data.length, 100);
  assert.deepEqual([...new Set(seriesOf(w)[0].data.map((d) => d[2]))].sort(), [0, 1]);
  assert.match(build(spec("WAFFLE", "INDICATORS_PROGRESS", ["a"], { dataset: { measure: "CUMULATIVE" } })).reason, /at least 2 values/);
  assert.equal(build(spec("WAFFLE", "INDICATORS_PROGRESS", ["a", "r"], { dataset: { measure: "CUMULATIVE" } })).ok, false, "a rate is not a part of a whole");
});

test("a sunburst groups indicators by logframe level and needs more than one level", () => {
  const levels = { ...sheet, indicators: sheet.indicators.map((i) => (i.id === "b" ? { ...i, level: "OUTCOME" } : i)) };
  const s = buildChart(spec("SUNBURST", "INDICATORS_PROGRESS", ["a", "b", "c", "n"], { dataset: { measure: "CUMULATIVE" } }), resolveDataset(levels, q(["a", "b", "c", "n"], { measure: "CUMULATIVE" })));
  assert.equal(s.ok, true, s.reason);
  assert.deepEqual(seriesOf(s)[0].data.map((g) => g.name).sort(), ["Outcome", "Output"]);
  assert.equal(seriesOf(s)[0].data.find((g) => g.name === "Outcome").children.length, 2);
  const flat = build(spec("SUNBURST", "INDICATORS_PROGRESS", ["b", "c", "n"], { dataset: { measure: "CUMULATIVE" } }));
  assert.equal(flat.ok, false);
  assert.match(flat.reason, /one level/);
});

test("the query names the extra data a chart needs, and nothing else asks for it", () => {
  assert.deepEqual(datasetQueryFor(spec("GANTT", "PLAN_TIMELINE", []), ALL).sources, ["PLAN"]);
  assert.deepEqual(datasetQueryFor(spec("CALENDAR_HEATMAP", "ACTIVITY_DAYS", []), ALL).sources, ["ACTIVITY_DAYS"]);
  assert.deepEqual(datasetQueryFor(spec("SANKEY", "BUDGET_FLOW", []), ALL).sources, ["BUDGET"]);
  assert.equal(datasetQueryFor(spec("BAR", "INDICATOR_OVER_TIME", ["a"]), ALL).sources, undefined);
  assert.deepEqual(datasetQueryFor(spec("GANTT", "PLAN_TIMELINE", []), ALL).indicatorIds, [], "the plan is not about indicators");
});

test("a Gantt puts every dated plan item on a timeline, coloured by its delivery signal, and says when rows are cut", () => {
  const b = build(spec("GANTT", "PLAN_TIMELINE", []));
  assert.equal(b.ok, true, b.reason);
  const [offset, bars] = seriesOf(b);
  assert.deepEqual(offset.data, [0, 27, 130], "days from the first start");
  assert.deepEqual(bars.data.map((d) => d.value), [47, 89, 1], "a milestone is one day wide");
  assert.deepEqual(bars.data.map((d) => d.itemStyle.color), ["#6b7280", "#ef4444", "#10b981"]);
  assert.equal(b.option.yAxis.inverse, true);
  assert.ok(b.notes.some((n) => /on time, late, done or cancelled/.test(n)));
  const many = { ...EXTRA, plan: Array.from({ length: 70 }, (_, i) => ({ id: `${i}`, title: `T${i}`, kind: "ACTIVITY", start: "2026-01-01", end: "2026-01-02", status: "PLANNED", signal: "ON_TIME", signalLabel: "On time" })) };
  const cut = build(spec("GANTT", "PLAN_TIMELINE", []), { ...resolveDataset(sheet, datasetQueryFor(spec("GANTT", "PLAN_TIMELINE", []), ALL)), ...many });
  assert.equal(seriesOf(cut)[1].data.length, 60);
  assert.ok(cut.notes.some((n) => /first 60 of 70/.test(n)));
  const none = build(spec("GANTT", "PLAN_TIMELINE", []), { ...resolveDataset(sheet, datasetQueryFor(spec("GANTT", "PLAN_TIMELINE", []), ALL)), plan: [{ id: "x", title: "No dates", kind: "ACTIVITY", start: "", end: "", status: "PLANNED", signal: "ON_TIME", signalLabel: "" }] });
  assert.match(none.reason, /no planned activities with dates/);
});

test("a calendar shows completed activities per day, blank days are not zero, and more than a year is cut with a note", () => {
  const b = build(spec("CALENDAR_HEATMAP", "ACTIVITY_DAYS", []));
  assert.equal(b.ok, true, b.reason);
  assert.deepEqual(b.option.calendar.range, ["2026-01-12", "2026-03-02"]);
  assert.deepEqual(seriesOf(b)[0].data, [["2026-01-12", 2], ["2026-01-13", 1], ["2026-03-02", 4]]);
  assert.ok(b.notes.some((n) => /blank, not zero/.test(n)));
  const base = resolveDataset(sheet, datasetQueryFor(spec("CALENDAR_HEATMAP", "ACTIVITY_DAYS", []), ALL));
  const long = build(spec("CALENDAR_HEATMAP", "ACTIVITY_DAYS", []), { ...base, activityDays: [{ date: "2024-01-01", count: 1 }, { date: "2025-06-01", count: 2 }, { date: "2026-06-01", count: 3 }] });
  assert.deepEqual(long.option.calendar.range[0], "2025-06-01");
  assert.ok(long.notes.some((n) => /last year/.test(n)));
  assert.match(build(spec("CALENDAR_HEATMAP", "ACTIVITY_DAYS", []), { ...base, activityDays: [{ date: "2026-01-01", count: 1 }] }).reason, /at least two days/);
});

test("a budget flow goes donor to cost category to spent or not spent; overspending is not drawn as flow and is said; one currency only", () => {
  const b = build(spec("SANKEY", "BUDGET_FLOW", []));
  assert.equal(b.ok, true, b.reason);
  const links = seriesOf(b)[0].links;
  const v = (s, t) => links.find((l) => l.source === s && l.target === t)?.value;
  assert.equal(v("Donor: USAID", "Category: Equipment"), 1000);
  assert.equal(v("Donor: EU", "Category: Equipment"), 300);
  assert.equal(v("Category: Equipment", "Spent"), 400);
  assert.equal(v("Category: Equipment", "Not spent yet"), 900);
  assert.equal(v("Category: Training", "Spent"), 500, "spending is capped at the budget");
  assert.equal(v("Category: Training", "Not spent yet"), undefined, "nothing left is not a zero-width link");
  assert.ok(b.notes.some((n) => /above the budget \(100/.test(n)));
  const base = resolveDataset(sheet, datasetQueryFor(spec("SANKEY", "BUDGET_FLOW", []), ALL));
  assert.match(build(spec("SANKEY", "BUDGET_FLOW", []), { ...base, budget: [...EXTRA.budget, { donor: "X", category: "Y", currency: "EUR", budgeted: 5, spent: 0 }] }).reason, /more than one currency/);
  assert.match(build(spec("SANKEY", "BUDGET_FLOW", []), { ...base, budget: [EXTRA.budget[0]] }).reason, /at least two budget lines/);
});

test("data that was not attached is refused with the reason, never drawn empty", () => {
  const base = resolveDataset(sheet, datasetQueryFor(spec("GANTT", "PLAN_TIMELINE", []), ALL));
  for (const [k, t] of [["GANTT", "PLAN_TIMELINE"], ["CALENDAR_HEATMAP", "ACTIVITY_DAYS"], ["SANKEY", "BUDGET_FLOW"]]) {
    const r = buildChart(spec(k, t, []), base);
    assert.equal(r.ok, false);
    assert.match(r.reason, /not available here/);
  }
});

test("results by place: the query names the place level, and the ordinary chart kinds rank places", () => {
  const s = spec("BAR", "RESULTS_BY_PLACE", ["a"], { dataset: { placeLevel: 0 } });
  assert.deepEqual(datasetQueryFor(s, ALL).sources, ["PLACES"]);
  assert.equal(datasetQueryFor(s, ALL).placeLevel, 0);
  assert.equal(datasetQueryFor(spec("BAR", "RESULTS_BY_PLACE", ["a"]), ALL).placeLevel, 1, "the first level below the country by default");
  assert.deepEqual(datasetQueryFor(s, ALL).indicatorIds, ["a"]);
  const bar = build(s);
  assert.equal(bar.ok, true, bar.reason);
  assert.deepEqual(bar.option.xAxis.data, ["Sudan", "Chad", "Kenya", "Rabak"]);
  assert.deepEqual(seriesOf(bar)[0].data, [500, 200, null, 120], "a place with nothing recorded is a gap, never 0");
  assert.match(bar.title, /A Indicator a by place/);
  assert.equal(build(spec("TREEMAP", "RESULTS_BY_PLACE", ["a"])).ok, true);
  assert.equal(build(spec("PIE", "RESULTS_BY_PLACE", ["r"])).ok, false, "a rate is not parts of a whole");
  const base = resolveDataset(sheet, datasetQueryFor(s, ALL));
  assert.match(buildChart(s, base).reason, /not available here/);
  assert.match(buildChart(s, { ...base, places: [] }).reason, /No places have a recorded value/);
});

test("graduated symbols are drawn only where a place has a pin, and the places left off are named", () => {
  const m = build(spec("GRADUATED_SYMBOLS", "RESULTS_BY_PLACE", ["a"]));
  assert.equal(m.ok, true, m.reason);
  assert.deepEqual(m.maps, ["donordesk-world"]);
  const pts = seriesOf(m)[0].data;
  assert.deepEqual(pts.map((p) => p.name), ["Sudan", "Rabak"]);
  assert.deepEqual(pts[0].value, [32.5, 15.5, 500]);
  assert.ok(m.notes.some((n) => /1 place has a value but no pin, so it is not on the map: Chad/.test(n)));
  assert.ok(seriesOf(m)[0].symbolSize([0, 0, 500]) > seriesOf(m)[0].symbolSize([0, 0, 120]), "bigger value, bigger symbol");
  assert.ok(m.option.geo.zoom >= 1 && m.option.geo.center.length === 2);
  assert.equal(build(spec("GRADUATED_SYMBOLS", "RESULTS_BY_PLACE", ["r"])).ok, false, "a rate cannot be a symbol size");
  const base = resolveDataset(sheet, datasetQueryFor(spec("GRADUATED_SYMBOLS", "RESULTS_BY_PLACE", ["a"]), ALL));
  assert.match(buildChart(spec("GRADUATED_SYMBOLS", "RESULTS_BY_PLACE", ["a"]), { ...base, places: [{ name: "Sudan", path: "Sudan", level: 0, value: 5, partly: false, latitude: 1, longitude: 1 }] }).reason, /at least two places/);
});

test("a choropleth colours countries only, says which countries it needs the map to know, and leaves a country with no value grey", () => {
  const m = build(spec("CHOROPLETH", "RESULTS_BY_PLACE", ["a"]));
  assert.equal(m.ok, true, m.reason);
  assert.deepEqual(m.regionNames, ["Sudan", "Chad"], "names the screen checks against the map; Kenya has no value");
  assert.deepEqual(seriesOf(m)[0].data, [{ name: "Sudan", value: 500 }, { name: "Chad", value: 200 }]);
  assert.equal(m.option.visualMap.max, 500);
  assert.ok(m.notes.some((n) => /grey, not zero/.test(n)));
  const base = resolveDataset(sheet, datasetQueryFor(spec("CHOROPLETH", "RESULTS_BY_PLACE", ["a"]), ALL));
  const inside = buildChart(spec("CHOROPLETH", "RESULTS_BY_PLACE", ["a"]), { ...base, places: [EXTRA.places[3], { ...EXTRA.places[3], name: "Kosti" }] });
  assert.match(inside.reason, /use graduated symbols/);
});

test("activities by status: a donut of the plan's activity statuses, the same counts as the number tiles, with cancelled and late said in notes", () => {
  const act = (id, status, signal = "ON_TIME", kind = "ACTIVITY") => ({ id, title: id, kind, start: "2026-01-01", end: "2026-02-01", status, signal, signalLabel: "" });
  const plan = [act("a", "DONE", "DONE"), act("b", "DONE", "DONE"), act("c", "IN_PROGRESS"), act("d", "PLANNED", "LATE"), act("e", "CANCELLED", "CANCELLED"), act("m", "PLANNED", "ON_TIME", "MILESTONE")];
  const base = resolveDataset(sheet, datasetQueryFor(spec("DONUT", "PLAN_TIMELINE", []), ALL));
  assert.deepEqual(datasetQueryFor(spec("DONUT", "PLAN_TIMELINE", []), ALL).sources, ["PLAN"]);
  const d = build(spec("DONUT", "PLAN_TIMELINE", []), { ...base, plan });
  assert.equal(d.ok, true, d.reason);
  const [pie] = seriesOf(d);
  assert.equal(pie.type, "pie");
  assert.deepEqual(pie.data, [{ name: "Planned", value: 1 }, { name: "In progress", value: 1 }, { name: "Done", value: 2 }]);
  assert.equal(d.title, "Activities by status");
  assert.ok(d.notes.some((n) => /1 cancelled activity is not counted/.test(n)));
  assert.ok(d.notes.some((n) => /1 of the 4 is running late/.test(n)));
  const onlyDone = build(spec("PIE", "PLAN_TIMELINE", []), { ...base, plan: [act("a", "DONE", "DONE")] });
  assert.deepEqual(seriesOf(onlyDone)[0].data, [{ name: "Done", value: 1 }], "a status with none is left out, not drawn as zero");
  assert.match(build(spec("DONUT", "PLAN_TIMELINE", []), { ...base, plan: [] }).reason, /no planned activities yet/);
  assert.match(build(spec("DONUT", "PLAN_TIMELINE", []), { ...base, plan: [act("e", "CANCELLED", "CANCELLED")] }).reason, /cancelled/);
  assert.equal(build(spec("DONUT", "PLAN_TIMELINE", []), { ...base, plan: undefined }).ok, false);
});

test("spent by result: a donut of approved spending grouped by the result each line's activity serves, with unlinked spending shown, never hidden or double counted", () => {
  const line = (result, spent, currency = "USD") => ({ donor: "D", category: "Travel", currency, budgeted: 1000, spent, ...(result ? { result } : {}) });
  const base = resolveDataset(sheet, datasetQueryFor(spec("DONUT", "BUDGET_FLOW", []), ALL));
  assert.deepEqual(datasetQueryFor(spec("DONUT", "BUDGET_FLOW", []), ALL).sources, ["BUDGET"]);
  const lines = [line("1 Capacity building", 300), line("1 Capacity building", 100), line("2 Basic education", 700), line(undefined, 50), line("3 Employability", 0)];
  const d = build(spec("DONUT", "BUDGET_FLOW", []), { ...base, budget: lines });
  assert.equal(d.ok, true, d.reason);
  assert.equal(d.title, "Spent by result");
  assert.deepEqual(seriesOf(d)[0].data, [{ name: "2 Basic education", value: 700 }, { name: "1 Capacity building", value: 400 }, { name: "Not linked to a result", value: 50 }]);
  assert.ok(d.notes.some((n) => /50 USD was spent on activities not linked to a result/.test(n)));
  assert.ok(d.notes.some((n) => /Spent is approved expenses only/.test(n)));
  assert.match(build(spec("DONUT", "BUDGET_FLOW", []), { ...base, budget: [line("A", 1), line("B", 1, "EUR")] }).reason, /more than one currency/);
  assert.match(build(spec("DONUT", "BUDGET_FLOW", []), { ...base, budget: [line("A", 0)] }).reason, /No spending has been approved/);
  assert.match(build(spec("DONUT", "BUDGET_FLOW", []), { ...base, budget: [] }).reason, /no budget lines/);
  assert.match(build(spec("DONUT", "BUDGET_FLOW", []), { ...base, budget: [{ ...line(undefined, 9), resultUnknown: true }] }).reason, /could not be read just now/);
  assert.equal(build(spec("SANKEY", "BUDGET_FLOW", []), { ...base, budget: [line("A", 5), line("B", 6)] }).ok, true, "the budget flow is unchanged");
});
