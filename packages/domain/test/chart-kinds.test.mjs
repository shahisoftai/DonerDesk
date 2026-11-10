import assert from "node:assert/strict";
import test from "node:test";
import { buildChart, resolveDataset, datasetQueryFor, validateChartSpec, CHART_KINDS } from "../dist/index.js";
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
