import assert from "node:assert/strict";
import test from "node:test";
import { buildChart, resolveDataset, datasetQueryFor, validateChartSpec, kindsForTemplate, CHART_KINDS } from "../dist/index.js";
import { niceUnit } from "../dist/contexts/reporting/chart-render-kinds.js";
import { ICON_PATHS } from "../dist/contexts/reporting/chart-icons.js";
import { ALL, EXTRA, build, sheet, spec } from "./support/chart-fixtures.mjs";

const cum = { dataset: { measure: "CUMULATIVE" } };

test("pictorial bar: one icon per whole unit, the exact figure written at the end, a gap said plainly", () => {
  const b = build(spec("PICTORIAL_BAR", "INDICATORS_PROGRESS", ["a", "b"], cum));
  assert.equal(b.ok, true, b.reason);
  const [icons, ends] = b.option.series;
  const [a, bb] = [210, 55];
  const unit = niceUnit(210);
  const whole = icons.data.filter((d) => d.itemStyle === undefined).length;
  assert.equal(whole, Math.floor(a / unit) + Math.floor(bb / unit));
  assert.equal(icons.data.length - whole, 2, "each value that is not a whole number of units ends in one fainter icon (a part), never nothing");
  assert.ok(icons.data.filter((d) => d.itemStyle).every((d) => d.itemStyle.opacity >= 0.25 && d.itemStyle.opacity < 1));
  assert.match(b.notes.join(" "), new RegExp(`Each icon stands for ${unit}`));
  assert.equal(icons.symbol, ICON_PATHS.PERSON);
  assert.ok(ends.data.every((d) => d.label.show && d.label.formatter === "{b}"), "the figure is text, not a function");
  assert.deepEqual(ends.data.map((d) => d.name), ["210", "55"]);
  // a missing value is "Not measured", never an empty row or a zero
  const gap = build(spec("PICTORIAL_BAR", "INDICATORS_PROGRESS", ["a", "n"], { dataset: { measure: "CUMULATIVE", toPeriodId: "p2" } }));
  assert.equal(gap.ok, true);
  const rate = build(spec("PICTORIAL_BAR", "INDICATORS_PROGRESS", ["a", "r"], cum));
  assert.equal(rate.ok, false, "a rate is not counted in icons");
});

test("niceUnit gives 1, 2 or 5 times a power of ten", () => {
  for (const [max, unit] of [[9, 1], [25, 2], [49, 5], [101, 10], [210, 20], [1800, 200], [0.4, 0.05]]) assert.equal(niceUnit(max), unit, String(max));
});

test("rose: counts only, the radius carries the value", () => {
  const b = build(spec("ROSE", "INDICATORS_PROGRESS", ["a", "b", "c"], cum));
  assert.equal(b.ok, true);
  assert.equal(b.option.series[0].roseType, "area");
  assert.equal(build(spec("ROSE", "INDICATORS_PROGRESS", ["a", "r", "b"], cum)).ok, false);
});

test("radial bar: polar bars from zero, a negative value refused", () => {
  const b = build(spec("RADIAL_BAR", "INDICATORS_PROGRESS", ["a", "b"], cum));
  assert.equal(b.option.series[0].coordinateSystem, "polar");
  assert.equal(b.option.angleAxis.min, 0);
  const neg = build(spec("RADIAL_BAR", "INDICATORS_PROGRESS", ["w", "a"], { dataset: { measure: "PERIOD", toPeriodId: "p2" } }));
  assert.equal(neg.ok, false);
});

test("range band and range bars need exactly two indicators, and a period missing either has no band", () => {
  for (const kind of ["AREA_RANGE", "RANGE_BAR"]) {
    assert.equal(build(spec(kind, "INDICATORS_OVER_TIME", ["a", "b", "n"])).ok, false, `${kind} with three`);
    const b = build(spec(kind, "INDICATORS_OVER_TIME", ["a", "n"]));
    assert.equal(b.ok, true, b.reason);
    const base = b.option.series[0];
    assert.equal(base.silent, true, "the hidden base is a helper");
    assert.equal(base.data[3], null, "n has no value from April: no band, not a zero");
    assert.equal(base.data[0], 3, "the lower of the two");
    assert.match(b.notes[0], /missing either value/);
  }
  assert.equal(build(spec("AREA_RANGE", "INDICATORS_OVER_TIME", ["a", "c"])).ok, false, "different units cannot share one band");
});

test("parallel: every axis keeps its own unit, periods missing a value are left out and counted", () => {
  const b = build(spec("PARALLEL", "INDICATORS_OVER_TIME", ["a", "b", "c"]));
  assert.equal(b.ok, true, b.reason);
  assert.deepEqual(b.option.parallelAxis.map((x) => x.name), ["A (people)", "B (people)", "C (kits)"]);
  assert.equal(b.option.series[0].data.length, 5);
  assert.match(b.notes.join(" "), /1 period is left out/);
  assert.equal(build(spec("PARALLEL", "INDICATORS_OVER_TIME", ["a", "c", "n"])).ok, false, "fewer than three complete periods");
});

test("tree groups indicators by logframe level and says Not measured for a gap", () => {
  const b = build(spec("TREE", "INDICATORS_PROGRESS", ["a", "b", "n"], cum));
  assert.equal(b.ok, true, b.reason);
  const root = b.option.series[0].data[0];
  assert.equal(root.children.map((c) => c.name).join(), "Outcome,Output");
  assert.ok(JSON.stringify(root).includes("A · 210"));
});

test("network: donors and categories linked by the budgeted amount; one currency only", () => {
  const b = build(spec("NETWORK", "BUDGET_FLOW", []));
  assert.equal(b.ok, true, b.reason);
  const g = b.option.series[0];
  assert.equal(g.layout, "circular", "a fixed layout, so a picture is the same every time");
  assert.deepEqual(g.data.map((d) => d.name).sort(), ["Category: Equipment", "Category: Training", "Donor: EU", "Donor: USAID"]);
  const base = resolveDataset(sheet, datasetQueryFor(spec("NETWORK", "BUDGET_FLOW", []), ALL));
  assert.match(build(spec("NETWORK", "BUDGET_FLOW", []), { ...base, budget: [...EXTRA.budget, { donor: "X", category: "Y", currency: "EUR", budgeted: 5, spent: 0 }] }).reason, /more than one currency/);
  assert.match(build(spec("NETWORK", "BUDGET_FLOW", []), { ...base, budget: [EXTRA.budget[0]] }).reason, /at least two budget lines/);
});

test("theme river: a missing value is not a point, never a zero", () => {
  const b = build(spec("THEME_RIVER", "INDICATORS_OVER_TIME", ["c"]));
  assert.equal(b.ok, true, b.reason);
  const rows = b.option.series[0].data;
  assert.equal(rows.length, 5, "c has five recorded periods; March is not a point");
  assert.ok(!rows.some((r) => r[0] === "2026-03-01"));
  assert.equal(build(spec("THEME_RIVER", "INDICATORS_OVER_TIME", ["a", "n"])).ok, false, "a negative value cannot be added into a stream");
  assert.ok(rows.every((r) => r[1] !== null));
  assert.equal(build(spec("THEME_RIVER", "INDICATORS_OVER_TIME", ["a", "r"])).ok, false, "a rate cannot be added into a stream");
});

test("fill gauge: caps at full with a note, and a rate has no share of target", () => {
  const b = build(spec("FILL_GAUGE", "INDICATOR_VS_TARGET", ["a"], cum));
  assert.equal(b.ok, true, b.reason);
  assert.equal(b.option.series[1].data[0], 100, "105% of target shows a full shape");
  assert.match(b.notes[0], /target is passed \(105%\)/);
  assert.equal(b.option.series[0].silent, true, "the outline is a helper");
  assert.equal(build(spec("FILL_GAUGE", "INDICATOR_VS_TARGET", ["r"], cum)).ok, false);
});

test("progress rings: cumulative or % of target only; a rate or a missing target is left out and named", () => {
  assert.match(build(spec("MULTI_RING", "INDICATORS_PROGRESS", ["a", "b"])).reason, /cumulative figure or % of target/);
  const b = build(spec("MULTI_RING", "INDICATORS_PROGRESS", ["a", "b", "r"], cum));
  assert.equal(b.ok, true, b.reason);
  assert.equal(b.option.series.length, 2);
  assert.match(b.notes.join(" "), /A 105%, B 55%/);
  assert.match(b.notes.join(" "), /Left out .*: R/);
  assert.equal(build(spec("MULTI_RING", "INDICATORS_PROGRESS", ["a", "r"], cum)).ok, false, "fewer than two rings");
});

test("every new kind is catalogued as drawable and the pyramid stays planned for a stated reason", () => {
  for (const k of ["PICTORIAL_BAR", "ROSE", "RADIAL_BAR", "AREA_RANGE", "RANGE_BAR", "PARALLEL", "TREE", "NETWORK", "THEME_RIVER", "FILL_GAUGE", "MULTI_RING"]) assert.equal(CHART_KINDS[k].status, "BUILT", k);
  assert.equal(CHART_KINDS.POPULATION_PYRAMID.status, "PLANNED");
  assert.deepEqual(validateChartSpec(spec("TREE", "INDICATORS_PROGRESS", ["a", "b"])), []);
});

test("an icon style changes the outline and the fill together", () => {
  const b = build(spec("FILL_GAUGE", "INDICATOR_VS_TARGET", ["a"], { ...cum, style: { pictorial: { icon: "HOUSE" } } }));
  assert.equal(b.option.series[0].symbol, ICON_PATHS.HOUSE);
  assert.equal(b.option.series[1].symbol, ICON_PATHS.HOUSE);
  const p = build(spec("PICTORIAL_BAR", "INDICATORS_PROGRESS", ["a", "b"], { ...cum, style: { pictorial: { icon: "DROP" } } }));
  assert.equal(p.option.series[0].symbol, ICON_PATHS.DROP);
});

test("Phase 48.11 kinds: each refuses what it cannot honestly draw, with a sentence", () => {
  const reason = (kind, template, ids, measure = "PERIOD") => { const b = build(spec(kind, template, ids, { dataset: { measure } })); return b.ok ? "" : b.reason; };
  assert.match(reason("DIVERGING_BAR", "INDICATORS_PROGRESS", ["a", "b"], "CUMULATIVE"), /both sides of zero/);
  assert.match(reason("BUMP", "INDICATORS_OVER_TIME", ["a"]), /at least two/);
  assert.match(reason("BUMP", "INDICATORS_OVER_TIME", ["a", "c"]), /different units/, "counts of different units are not ranked together");
  assert.match(reason("CONNECTED_SCATTER", "INDICATORS_OVER_TIME", ["a", "b", "n"]), /exactly two/);
  assert.match(reason("THERMOMETER", "INDICATOR_VS_TARGET", ["r"], "CUMULATIVE"), /rate|target/);
  assert.equal(reason("DUMBBELL", "INDICATORS_OVER_TIME", ["a", "b"]), "");
  const dumb = build(spec("DUMBBELL", "INDICATORS_OVER_TIME", ["a", "b"], { dataset: { measure: "PERIOD" } }));
  assert.equal(dumb.ok, true, dumb.reason);
  assert.ok(dumb.notes.some((n) => /first to the latest period that has a figure/.test(n)));
  assert.equal(CHART_KINDS.BUMP.status, "BUILT");
});

test("parliament and proportion bar: counts only, 100 dots exactly, a gap is named; small multiples keep each panel's own scale", () => {
  const p = build(spec("PARLIAMENT", "INDICATORS_PROGRESS", ["a", "b", "c"], cum));
  assert.equal(p.ok, true, p.reason);
  assert.equal(p.option.series.reduce((t, s) => t + s.data.length, 0), 100, "the dots always add to 100");
  assert.equal(build(spec("PARLIAMENT", "INDICATORS_PROGRESS", ["a", "r"], cum)).ok, false, "a rate is not a part of a whole");
  const bar = build(spec("PROPORTION_BAR", "INDICATORS_PROGRESS", ["a", "b", "c"], cum));
  assert.equal(bar.ok, true, bar.reason);
  assert.equal(bar.option.series.length, 3);
  assert.equal(build(spec("PROPORTION_BAR", "INDICATORS_PROGRESS", ["a", "r"], cum)).ok, false);
  const sm = build(spec("SMALL_MULTIPLES", "INDICATORS_OVER_TIME", ["a", "b", "c"], { dataset: { measure: "PERIOD" } }));
  assert.equal(sm.ok, true, sm.reason);
  assert.equal(sm.option.series.length, 3);
  assert.equal(sm.option.grid.length, 3, "one panel, one grid, one scale each");
  assert.match(sm.notes.join(" "), /own scale/);
  assert.equal(build(spec("SMALL_MULTIPLES", "INDICATORS_OVER_TIME", ["a"], { dataset: { measure: "PERIOD" } })).ok, false);
});

test("dot density and the hexagon grid: only pinned places, a stated unit, nothing added across levels, and a rate is refused", () => {
  const dots = build(spec("DOT_DENSITY", "RESULTS_BY_PLACE", ["a"]));
  assert.equal(dots.ok, true, dots.reason);
  assert.deepEqual(dots.maps, ["donordesk-world"]);
  assert.ok(dots.option.series[0].data.length >= 2, "every pinned place has at least one dot");
  assert.ok(dots.notes.some((n) => /One dot stands for/.test(n)));
  assert.ok(dots.notes.some((n) => /1 place has a value but no pin/.test(n)), "the place with no pin is named, not placed");
  assert.equal(build(spec("DOT_DENSITY", "RESULTS_BY_PLACE", ["r"])).ok, false);
  const hex = build(spec("HEX_GRID", "RESULTS_BY_PLACE", ["a"]));
  assert.equal(hex.ok, true, hex.reason);
  assert.ok(hex.notes.some((n) => /hexagons about \d+ km across/.test(n)));
  assert.ok(hex.notes.some((n) => /different levels/.test(n)), "mixed levels are said plainly when they cannot be told apart");
  const total = hex.option.series[0].data.reduce((t, d) => t + d.value[2], 0);
  assert.equal(total, 620, "every pinned place's value is in exactly one hexagon");
  assert.equal(build(spec("HEX_GRID", "RESULTS_BY_PLACE", ["r"])).ok, false);
});

test("beeswarm, violin, ridgeline and bar race draw only recorded figures, on one scale, with a gap left as a gap", () => {
  const swarm = build(spec("BEESWARM", "INDICATORS_OVER_TIME", ["a", "b"], { dataset: { measure: "PERIOD" } }));
  assert.equal(swarm.ok, true, swarm.reason);
  assert.equal(swarm.option.series.reduce((t, s) => t + s.data.length, 0), 12, "every recorded period figure is one dot");
  const vio = build(spec("VIOLIN", "INDICATORS_OVER_TIME", ["a", "b"], { dataset: { measure: "PERIOD" } }));
  assert.equal(vio.ok, true, vio.reason);
  assert.equal(vio.option.grid.length, 2, "one shape for each indicator");
  assert.match(vio.notes.join(" "), /estimate/);
  assert.equal(build(spec("VIOLIN", "INDICATORS_OVER_TIME", ["n"], { dataset: { measure: "PERIOD" } })).ok, false, "an indicator with only three recorded periods has no spread to estimate");
  const ridge = build(spec("RIDGELINE", "INDICATORS_OVER_TIME", ["a", "b"], { dataset: { measure: "PERIOD" } }));
  assert.equal(ridge.ok, true, ridge.reason);
  assert.equal(ridge.option.yAxis[0].max, ridge.option.yAxis[1].max, "every ridge has the same scale");
  assert.equal(build(spec("RIDGELINE", "INDICATOR_OVER_TIME", ["a"], { dataset: { measure: "PERIOD" } })).ok, false);
  const race = build(spec("BAR_RACE", "INDICATORS_OVER_TIME", ["a", "b"], { dataset: { measure: "PERIOD" } }));
  assert.equal(race.ok, true, race.reason);
  assert.equal(race.option.raceFrames.length, 6, "a frame for every period, each named");
  assert.deepEqual(race.option.raceFrames[0].names, ["A", "B"]);
  assert.equal(race.option.raceFrames.every((f) => typeof f.label === "string" && f.label !== ""), true);
});

test("marimekko needs a recorded split and one indicator; its widths are the recorded totals and a gap is not drawn", () => {
  const d = { ...resolveDataset(sheet, datasetQueryFor(spec("MARIMEKKO", "INDICATOR_OVER_TIME", ["a"]), ALL)), ...EXTRA };
  const split = (v) => [{ dimension: "Sex", category: "Female", value: String(Math.round(v * 0.6)) }, { dimension: "Sex", category: "Male", value: String(Math.round(v * 0.4)) }];
  const s = spec("MARIMEKKO", "INDICATOR_OVER_TIME", ["a"], { dataset: { measure: "PERIOD" } });
  const none = build(s, d);
  assert.equal(none.ok, false);
  assert.match(none.reason, /No split by group is recorded/);
  const withSplit = build(s, { ...d, points: d.points.map((p, i) => (i === 2 ? p : { ...p, breakdown: split(p.value ?? 0) })) });
  assert.equal(withSplit.ok, true, withSplit.reason);
  assert.equal(withSplit.option.xAxis.length, 5, "the period with no split is not drawn");
  assert.equal(withSplit.option.noTable, true);
  assert.match(withSplit.notes.join(" "), /1 period has no usable split/);
  const rateSpec = spec("MARIMEKKO", "INDICATOR_OVER_TIME", ["r"], { dataset: { measure: "PERIOD" } });
  const rateData = { ...resolveDataset(sheet, datasetQueryFor(rateSpec, ALL)), ...EXTRA };
  assert.equal(build(rateSpec, { ...rateData, points: rateData.points.map((p) => ({ ...p, breakdown: split(p.value ?? 0) })) }).ok, false, "a rate is not split into shares");
});

test("alluvial and chord follow spent money, refuse two currencies and never call an unread result 'not linked'", () => {
  const d = { ...resolveDataset(sheet, datasetQueryFor(spec("ALLUVIAL", "BUDGET_FLOW", []), ALL)), ...EXTRA };
  const lines = [
    { donor: "USAID", category: "Equipment", currency: "USD", budgeted: 1000, spent: 400, result: "R1" },
    { donor: "EU", category: "Training", currency: "USD", budgeted: 500, spent: 300, result: "R2" },
    { donor: "EU", category: "Equipment", currency: "USD", budgeted: 500, spent: 100, resultUnknown: true },
  ];
  const al = build(spec("ALLUVIAL", "BUDGET_FLOW", []), { ...d, budget: lines });
  assert.equal(al.ok, true, al.reason);
  assert.equal(al.option.series[0].links.reduce((t, l) => t + l.value, 0), 2 * (400 + 300), "each unit of money passes both stages");
  assert.match(al.notes.join(" "), /1 line is left out because its result could not be read/);
  const ch = build(spec("CHORD", "BUDGET_FLOW", []), { ...d, budget: lines });
  assert.equal(ch.ok, true, ch.reason);
  assert.equal(build(spec("ALLUVIAL", "BUDGET_FLOW", []), { ...d, budget: lines.map((l, i) => (i === 0 ? { ...l, currency: "EUR" } : l)) }).ok, false);
  assert.equal(build(spec("CHORD", "BUDGET_FLOW", []), { ...d, budget: lines.slice(0, 1) }).ok, false);
});

test("a bivariate map needs both values and a pin; a flow map draws arrows only between pinned places in one unit", () => {
  const d = { ...resolveDataset(sheet, datasetQueryFor(spec("BIVARIATE_MAP", "RESULTS_BY_PLACE_PAIR", ["a", "b"]), ALL)), ...EXTRA };
  const pins = [["Gulu", 2.7, 32.3, 100, 30], ["Kitgum", 3.3, 32.9, 80, 60], ["Lira", 2.2, 32.9, 60, 90], ["Arua", 3.0, 30.9, 40, null]].map(([name, latitude, longitude, value, second]) => ({ place: { name, path: name, level: 1, value, partly: false, latitude, longitude }, second }));
  const places = pins.map((p) => p.place);
  const placesSecond = pins.map((p) => ({ ...p.place, value: p.second }));
  const bi = build(spec("BIVARIATE_MAP", "RESULTS_BY_PLACE_PAIR", ["a", "b"]), { ...d, places, placesSecond });
  assert.equal(bi.ok, true, bi.reason);
  assert.equal(bi.option.series[0].data.length, 3, "Arua has no second value, so it is not coloured as if it had one");
  assert.equal(bi.option.visualMap.pieces.length, 9);
  assert.match(bi.notes.join(" "), /1 place has a value for only one indicator/);
  assert.equal(build(spec("BIVARIATE_MAP", "RESULTS_BY_PLACE_PAIR", ["a", "b"]), { ...d, places: places.slice(0, 2), placesSecond: placesSecond.slice(0, 2) }).ok, false);
  assert.equal(build(spec("BIVARIATE_MAP", "RESULTS_BY_PLACE_PAIR", ["a", "b"]), { ...d, places }).ok, false, "without the second indicator it cannot be drawn");
  const flows = [{ from: "Gulu", to: "Kitgum", what: "People", quantity: 300, unit: "households", fromLatitude: 2.7, fromLongitude: 32.3, toLatitude: 3.3, toLongitude: 32.9 }, { from: "Lira", to: "Arua", what: "Tents", quantity: 50, unit: "households" }];
  const fm = build(spec("FLOW_MAP", "FLOWS_BETWEEN_PLACES", []), { ...d, flows });
  assert.equal(fm.ok, true, fm.reason);
  assert.equal(fm.option.series.filter((s) => s.type === "lines").reduce((t, s) => t + s.data.length, 0), 1, "the movement with no pin at an end is not drawn");
  assert.match(fm.notes.join(" "), /1 movement has an end with no pin/);
  assert.equal(build(spec("FLOW_MAP", "FLOWS_BETWEEN_PLACES", []), { ...d, flows: [flows[0], { ...flows[0], unit: "tents" }] }).ok, false, "two units cannot share widths");
  assert.equal(build(spec("FLOW_MAP", "FLOWS_BETWEEN_PLACES", []), { ...d, flows: undefined }).ok, false);
  assert.ok(!kindsForTemplate("RESULTS_BY_PLACE").includes("BIVARIATE_MAP") && kindsForTemplate("RESULTS_BY_PLACE_PAIR").join() === "BIVARIATE_MAP", "each special template offers only its own kind");
});
