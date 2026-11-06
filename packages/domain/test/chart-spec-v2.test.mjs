import assert from "node:assert/strict";
import test from "node:test";
import { CHART_KINDS, CHART_KIND_ORDER, DATA_CHART_TEMPLATES, migrateChartSpec, toLegacySpec, validateChartSpec, kindsForTemplate, kindsByFamily, buildDataChart } from "../dist/index.js";

const v1 = { template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "CUMULATIVE", type: "LINE", showTarget: true, title: "Water", colors: ["#112233"], fromPeriodId: "p1" };
const v2 = (over = {}) => ({ version: 2, kind: "BAR", dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "PERIOD", showTarget: false, includeDraft: true }, ...over });
const codes = (spec, o) => validateChartSpec(spec, o).map((p) => p.code);

test("every kind row is coherent: a drawn kind names the data shapes it can show, a catalogued one claims none", () => {
  assert.ok(CHART_KIND_ORDER.length >= 40);
  for (const k of CHART_KIND_ORDER) {
    const r = CHART_KINDS[k];
    assert.ok(r.label && r.family, k);
    if (r.status === "BUILT") assert.ok(r.shapes.length > 0, `${k} is drawn so it names its data shapes`);
    else { assert.equal(r.legacyType, undefined, `${k} is not drawn yet`); assert.deepEqual(r.shapes, [], k); }
    if (r.legacyType) assert.equal(r.status, "BUILT", `${k} has an older renderer so it is drawn`);
    assert.ok(r.minPoints >= 1, k);
  }
  const legacy = CHART_KIND_ORDER.filter((k) => CHART_KINDS[k].legacyType).sort();
  assert.deepEqual(legacy, ["AREA", "BAR", "GAUGE", "LINE", "PIE", "RADAR"], "only the original six have an older renderer");
  const planned = CHART_KIND_ORDER.filter((k) => CHART_KINDS[k].status === "PLANNED").sort();
  assert.deepEqual(planned, ["POPULATION_PYRAMID"], "the only kind left needs age-by-sex values, which the data sheet does not carry");
});

test("a v1 spec is lifted to v2 without losing a field and lowers back to the same v1 spec", () => {
  const up = migrateChartSpec(v1);
  assert.equal(up.version, 2);
  assert.equal(up.kind, "LINE");
  assert.equal(up.dataset.includeDraft, true);
  assert.deepEqual(toLegacySpec(up), v1);
  assert.deepEqual(validateChartSpec(up), []);
});

test("every v1 chart type migrates and a v2 spec passes through; anything else is refused", () => {
  for (const type of ["BAR", "LINE", "PIE", "AREA", "RADAR", "GAUGE"]) assert.equal(migrateChartSpec({ ...v1, type }).kind, type);
  const s = v2();
  assert.equal(migrateChartSpec(s), s);
  assert.equal(migrateChartSpec(null), null);
  assert.equal(migrateChartSpec("x"), null);
  assert.equal(migrateChartSpec({ version: 3 }), null);
  assert.equal(migrateChartSpec({ template: "X", type: "DONUT" }), null);
});

test("a kind that needs data we do not hold yet is refused on save but can be previewed", () => {
  const s = v2({ kind: "POPULATION_PYRAMID" });
  assert.ok(codes(s).includes("KIND_NOT_DRAWN_YET"));
  assert.ok(!codes(s, { allowPlanned: true }).includes("KIND_NOT_DRAWN_YET"));
  assert.equal(toLegacySpec(s), null);
  assert.equal(toLegacySpec(v2({ kind: "FUNNEL" })), null, "a kind the older renderer does not know has no v1 form");
  assert.ok(codes(v2({ kind: "NOPE" })).includes("UNKNOWN_KIND"));
  assert.deepEqual(codes(null), ["NOT_A_SPEC"]);
});

test("the data shape decides how many indicators a chart takes", () => {
  assert.ok(codes(v2({ dataset: { ...v2().dataset, indicatorIds: [] } })).includes("INDICATOR_COUNT"));
  assert.ok(codes(v2({ dataset: { ...v2().dataset, indicatorIds: ["a", "b"] } })).includes("INDICATOR_COUNT"));
  assert.ok(codes(v2({ dataset: { ...v2().dataset, template: "STATUS_DISTRIBUTION", indicatorIds: ["a"] }, kind: "PIE" })).includes("INDICATOR_COUNT"));
  assert.ok(codes(v2({ dataset: { ...v2().dataset, template: "NOPE" } })).includes("UNKNOWN_TEMPLATE"));
  assert.ok(codes(v2({ kind: "GAUGE" })).includes("KIND_NOT_FOR_TEMPLATE"), "a gauge needs one indicator's baseline, target and result, not a time series");
  assert.ok(codes(v2({ kind: "FUNNEL" })).includes("KIND_NOT_FOR_TEMPLATE"), "a funnel needs each indicator's latest value");
  assert.ok(!codes(v2({ kind: "HEATMAP", dataset: { ...v2().dataset, template: "INDICATORS_OVER_TIME", indicatorIds: ["a", "b"] } })).includes("KIND_NOT_FOR_TEMPLATE"));
});

test("a rate is never added up: additive-only kinds refuse it, others accept it", () => {
  const facts = { indicators: [{ id: "i1", isRate: true }] };
  const stacked = v2({ kind: "BAR_STACKED", dataset: { ...v2().dataset, template: "INDICATORS_OVER_TIME", indicatorIds: ["i1"] } });
  assert.ok(codes(stacked, { ...facts, allowPlanned: true }).includes("RATE_NOT_ADDITIVE"));
  assert.ok(!codes(stacked, { indicators: [{ id: "i1", isRate: false }], allowPlanned: true }).includes("RATE_NOT_ADDITIVE"));
  const line = v2({ kind: "LINE", dataset: { ...v2().dataset, template: "INDICATORS_OVER_TIME", indicatorIds: ["i1"] } });
  assert.ok(!codes(line, facts).includes("RATE_NOT_ADDITIVE"));
});

test("axes: a bar starts at zero, ranges make sense, a log axis cannot include zero", () => {
  assert.ok(codes(v2({ axes: { y: { min: 50 } } })).includes("BAR_AXIS_NOT_ZERO"));
  assert.ok(!codes(v2({ axes: { y: { min: 0 } } })).includes("BAR_AXIS_NOT_ZERO"));
  assert.ok(!codes(v2({ kind: "LINE", axes: { y: { min: 50 } } })).includes("BAR_AXIS_NOT_ZERO"));
  assert.ok(codes(v2({ kind: "LINE", axes: { y: { min: 10, max: 5 } } })).includes("AXIS_RANGE"));
  assert.ok(codes(v2({ kind: "LINE", axes: { y: { min: Number.NaN } } })).includes("AXIS_RANGE"));
  assert.ok(codes(v2({ kind: "LINE", axes: { y: { scale: "LOG", min: 0 } } })).includes("LOG_NEEDS_POSITIVE"));
  assert.ok(!codes(v2({ kind: "LINE", axes: { y: { scale: "LOG", min: 1 } } })).includes("LOG_NEEDS_POSITIVE"));
});

test("two units never share one axis unannounced: a second axis needs a titled axis", () => {
  const series = [{ index: 1, axis: "SECONDARY" }];
  assert.ok(codes(v2({ series })).includes("SECONDARY_AXIS_UNNAMED"));
  assert.ok(!codes(v2({ series, axes: { y2: { title: "Households" } } })).includes("SECONDARY_AXIS_UNNAMED"));
  assert.ok(codes(v2({ series, axes: { y2: { title: "  " } } })).includes("SECONDARY_AXIS_UNNAMED"));
});

test("colours, annotations, limits and texts are checked, each with its path", () => {
  const probs = validateChartSpec(v2({
    colors: ["red"],
    series: [{ index: 0, color: "#xyz" }, { index: 1, kind: "NOPE" }],
    dataset: { ...v2().dataset, topN: 0 },
    annotations: [
      { id: "a", type: "LINE", value: Number.NaN },
      { id: "a", type: "BAND", from: 5, to: 1 },
      { id: "c", type: "NOTE", text: " " },
    ],
    title: "x".repeat(201),
    altText: "x".repeat(501),
    legend: { position: "MIDDLE" },
    size: "HUGE",
  }));
  const by = (code) => probs.filter((p) => p.code === code).map((p) => p.path);
  assert.deepEqual(by("COLOUR_FORMAT").sort(), ["colors", "series.0.color"]);
  assert.deepEqual(by("SERIES_KIND_UNKNOWN"), ["series.1.kind"]);
  assert.deepEqual(by("TOP_N_RANGE"), ["dataset.topN"]);
  assert.equal(by("ANNOTATION_INVALID").length, 4);
  assert.deepEqual(by("TEXT_TOO_LONG").sort(), ["altText", "title"]);
  assert.deepEqual(by("UNKNOWN_SETTING").sort(), ["legend.position", "size"]);
  const many = Array.from({ length: 13 }, (_, i) => ({ id: `n${i}`, type: "NOTE", text: "t" }));
  assert.ok(codes(v2({ annotations: many })).includes("TOO_MANY_ANNOTATIONS"));
});

test("kinds are offered by what the data can honestly be drawn as, and grouped by family", () => {
  const over = kindsForTemplate("INDICATOR_OVER_TIME");
  for (const k of ["BAR", "LINE", "AREA", "STEP_LINE", "HEATMAP", "BOX_PLOT", "HISTOGRAM", "SPARKLINE"]) assert.ok(over.includes(k), k);
  for (const k of ["PIE", "FUNNEL", "GAUGE", "RADAR"]) assert.ok(!over.includes(k), `${k} is not a time-series chart`);
  const latest = kindsForTemplate("INDICATORS_PROGRESS");
  for (const k of ["PIE", "DONUT", "TREEMAP", "FUNNEL", "RADAR", "LOLLIPOP", "SCORECARD_TABLE", "SUNBURST", "WAFFLE"]) assert.ok(latest.includes(k), k);
  assert.deepEqual(kindsForTemplate("INDICATOR_VS_TARGET").filter((k) => ["GAUGE", "BULLET", "KPI_NUMBER", "PROGRESS_RING", "WATERFALL"].includes(k)).sort(), ["BULLET", "GAUGE", "KPI_NUMBER", "PROGRESS_RING", "WATERFALL"]);
  assert.deepEqual(kindsForTemplate("STATUS_DISTRIBUTION").sort(), ["BAR", "BAR_HORIZONTAL", "DONUT", "PIE", "TREEMAP", "WAFFLE"]);
  const fin = kindsForTemplate("FINANCE_BURN_RATE");
  for (const k of ["BAR", "LINE", "AREA", "BAR_LINE_COMBO", "PIVOT_TABLE"]) assert.ok(fin.includes(k), k);
  for (const k of ["PIE", "BAR_STACKED", "FUNNEL"]) assert.ok(!fin.includes(k), `${k} would mislead on budget and spend`);
  assert.deepEqual(kindsForTemplate("NOPE"), []);
  const fam = kindsByFamily();
  assert.equal(fam.flatMap((f) => f.kinds).length, CHART_KIND_ORDER.length);
  assert.ok(fam.length >= 10);
  for (const t of Object.keys(DATA_CHART_TEMPLATES)) assert.ok(Array.isArray(kindsForTemplate(t)));
});

test("a v2 chart of a drawn kind draws exactly what its v1 form draws", () => {
  const periods = [{ id: "p1", label: "Jan", start: "2026-01-01", end: "2026-01-31", reportType: "MONTHLY", locked: false }];
  const sheet = { projectId: "x", periods, indicators: [{ id: "i1", code: "A", name: "A", level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "100", isRate: false }], cells: [{ indicatorId: "i1", periodId: "p1", periodValue: "10", cumulativeValue: "10", status: "VERIFIED" }], finance: [] };
  const spec = migrateChartSpec(v1);
  const a = buildDataChart(sheet, toLegacySpec(spec));
  const b = buildDataChart(sheet, v1);
  assert.equal(a.ok, true);
  assert.deepEqual(a, b);
});
