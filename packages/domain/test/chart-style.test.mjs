import assert from "node:assert/strict";
import test from "node:test";
import { buildChart, resolveDataset, validateChartSpec, validateChartStyle, applyChartStyle, STYLE_NUMBER_RULES } from "../dist/index.js";

const periods = ["Jan", "Feb", "Mar", "Apr"].map((label, i) => ({ id: `p${i + 1}`, label, start: `2026-0${i + 1}-01`, end: `2026-0${i + 1}-28`, reportType: "MONTHLY", locked: false }));
const ind = (id) => ({ id, code: id.toUpperCase(), name: `Indicator ${id}`, level: "OUTPUT", type: "COUNT", unit: "people", baseline: "10", target: "200", isRate: false });
const cells = (id, vals) => vals.map((v, i) => ({ indicatorId: id, periodId: `p${i + 1}`, periodValue: String(v), cumulativeValue: String(v), status: "VERIFIED" }));
const sheet = { projectId: "x", periods, finance: [], indicators: [ind("a"), ind("b")], cells: [...cells("a", [10, 20, 30, 40]), ...cells("b", [5, 8, 6, 12])] };
const draw = (kind, ids, style, extra = {}) => {
  const spec = { version: 2, kind, dataset: { template: ids.length > 1 ? "INDICATORS_OVER_TIME" : "INDICATOR_OVER_TIME", indicatorIds: ids, measure: "PERIOD", showTarget: false, includeDraft: true }, ...(style ? { style } : {}), ...extra };
  const r = buildChart(spec, resolveDataset(sheet, { indicatorIds: ids, measure: "PERIOD", includeDraft: true }));
  assert.equal(r.ok, true, r.reason);
  return { spec, option: r.option };
};
const latest = (kind, style) => {
  const spec = { version: 2, kind, dataset: { template: "INDICATORS_PROGRESS", indicatorIds: ["a", "b"], measure: "PERIOD", showTarget: false, includeDraft: true }, ...(style ? { style } : {}) };
  const r = buildChart(spec, resolveDataset(sheet, { indicatorIds: ["a", "b"], measure: "PERIOD", includeDraft: true }));
  assert.equal(r.ok, true, r.reason);
  return r.option;
};

test("no style, or an empty one, leaves the option exactly as drawn", () => {
  const plain = draw("BAR", ["a"]).option;
  // Two builds make two formatter functions, so compare the pictures as data (functions are left out of the comparison).
  assert.equal(JSON.stringify(draw("BAR", ["a"], {}).option), JSON.stringify(plain));
  assert.equal(applyChartStyle(plain, { kind: "BAR" }), plain);
  assert.equal(applyChartStyle(plain, { kind: "BAR", style: {} }), plain);
});

test("the defaults table matches what the builder draws", () => {
  const bar = draw("BAR", ["a"]).option;
  const def = Object.fromEntries(STYLE_NUMBER_RULES.map((r) => [r.path, r.default]));
  assert.equal(bar.title.textStyle.fontSize, def["title.size"]);
  assert.equal(bar.grid.left, def["grid.left"]);
  assert.equal(bar.grid.right, def["grid.right"]);
  assert.equal(bar.grid.top, def["grid.top"]);
  assert.equal(bar.grid.bottom, def["grid.bottom"]);
  assert.equal(draw("AREA", ["a"]).option.series[0].areaStyle.opacity, def["area.opacity"]);
  assert.equal(latest("DONUT").series[0].radius[0], "45%");
  assert.equal(latest("DONUT").series[0].radius[1], "70%");
  assert.equal(latest("PIE").series[0].radius, "68%");
});

test("bars: width, gap and rounded ends; a stack is never rounded", () => {
  const o = draw("BAR", ["a"], { bars: { width: 30, gap: 40, radius: 6 } }).option.series[0];
  assert.equal(o.barWidth, 30);
  assert.equal(o.barGap, "40%");
  assert.deepEqual(o.itemStyle.borderRadius, [6, 6, 0, 0]);
  assert.deepEqual(draw("BAR_HORIZONTAL", ["a"], { bars: { radius: 6 } }).option.series[0].itemStyle.borderRadius, [0, 6, 6, 0]);
  for (const s of draw("BAR_STACKED", ["a", "b"], { bars: { radius: 6 } }).option.series) assert.equal(s.itemStyle?.borderRadius, undefined);
});

test("a person's own series colour survives a radius", () => {
  const s = draw("BAR", ["a"], { bars: { radius: 4 } }, { series: [{ index: 0, color: "#ff0000" }] }).option.series[0];
  assert.equal(s.itemStyle.color, "#ff0000");
  assert.deepEqual(s.itemStyle.borderRadius, [4, 4, 0, 0]);
});

test("lines and areas: width, smoothing, symbol, area opacity", () => {
  const o = draw("AREA", ["a"], { lines: { width: 4, smooth: true, symbol: "DIAMOND", symbolSize: 9 }, area: { opacity: 0.6 } }).option.series[0];
  assert.equal(o.lineStyle.width, 4);
  assert.equal(o.smooth, true);
  assert.equal(o.symbol, "diamond");
  assert.equal(o.symbolSize, 9);
  assert.equal(o.areaStyle.opacity, 0.6);
});

test("helper series are never repainted (a lollipop's dot, its hidden width)", () => {
  const series = latest("LOLLIPOP", { bars: { width: 10 }, lines: { width: 5 } }).series;
  assert.equal(series[0].barWidth, 10);
  assert.equal(series[1].lineStyle.width, 0);
});

test("pie and donut radii", () => {
  assert.equal(latest("PIE", { pie: { outerRadius: 80 } }).series[0].radius, "80%");
  assert.deepEqual(latest("DONUT", { pie: { innerRadius: 30 } }).series[0].radius, ["30%", "70%"]);
  assert.deepEqual(latest("DONUT", { pie: { innerRadius: 20, outerRadius: 90 } }).series[0].radius, ["20%", "90%"]);
});

test("title, grid, axis labels, legend and animation", () => {
  const o = draw("BAR_GROUPED", ["a", "b"], {
    title: { align: "LEFT", size: 20, weight: "BOLD" }, grid: { left: 80, bottom: 70 }, axisLabels: { size: 10, rotate: 45 },
    legend: { icon: "CIRCLE", size: 11 }, animation: { enabled: false, duration: 800 },
  }).option;
  assert.equal(o.title.left, "left");
  assert.equal(o.title.textStyle.fontSize, 20);
  assert.equal(o.title.textStyle.fontWeight, "bold");
  assert.equal(o.grid.left, 80);
  assert.equal(o.grid.bottom, 70);
  assert.equal(o.grid.right, 24, "an untouched side keeps its default");
  assert.equal(o.xAxis.axisLabel.rotate, 45);
  assert.equal(o.yAxis.axisLabel.fontSize, 10);
  assert.equal(typeof o.yAxis.axisLabel.formatter, "function", "the number formatter is kept");
  assert.equal(o.legend.icon, "circle");
  assert.equal(o.legend.textStyle.fontSize, 11);
  assert.equal(o.animation, false);
  assert.equal(o.animationDuration, 800);
});

test("styling never mutates the option it was given", () => {
  const plain = draw("BAR", ["a"]).option;
  const before = JSON.stringify(plain);
  applyChartStyle(plain, { kind: "BAR", style: { bars: { width: 9 }, title: { size: 30 }, grid: { left: 1 } } });
  assert.equal(JSON.stringify(plain), before);
});

test("the style checker names what is wrong and where", () => {
  const codes = (style, kind = "BAR") => validateChartStyle(style, kind).map((p) => `${p.code}@${p.path}`);
  assert.deepEqual(codes(undefined), []);
  assert.deepEqual(codes({ bars: { width: 30, radius: 6 }, title: { size: 20 } }), []);
  assert.deepEqual(codes({ bars: { width: 1 } }), ["STYLE_RANGE@style.bars.width"]);
  assert.deepEqual(codes({ bars: { radius: 2.5 } }), ["STYLE_RANGE@style.bars.radius"]);
  assert.deepEqual(codes({ title: { size: Number.NaN } }), ["STYLE_RANGE@style.title.size"]);
  assert.deepEqual(codes({ title: { align: "MIDDLE" } }), ["STYLE_UNKNOWN@style.title.align"]);
  assert.deepEqual(codes({ lines: { smooth: "yes" } }, "LINE"), ["STYLE_UNKNOWN@style.lines.smooth"]);
  assert.deepEqual(codes({ lines: { width: 2 } }), ["STYLE_NOT_FOR_KIND@style.lines"]);
  assert.deepEqual(codes({ bars: { width: 10 } }, "PIE"), ["STYLE_NOT_FOR_KIND@style.bars"]);
  assert.deepEqual(codes({ area: { opacity: 0.5 } }, "LINE"), ["STYLE_NOT_FOR_KIND@style.area"]);
  assert.deepEqual(codes({ pie: { innerRadius: 60, outerRadius: 50 } }, "DONUT"), ["STYLE_RANGE@style.pie.innerRadius"]);
  assert.deepEqual(codes("loud"), ["STYLE_INVALID@style"]);
});

test("validateChartSpec runs the style checker", () => {
  const spec = { version: 2, kind: "BAR", dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: ["a"], measure: "PERIOD", showTarget: false, includeDraft: true }, style: { bars: { width: 999 } } };
  assert.deepEqual(validateChartSpec(spec).map((p) => p.code), ["STYLE_RANGE"]);
  assert.deepEqual(validateChartSpec({ ...spec, style: { bars: { width: 20 } } }), []);
});

test("every numeric rule is reachable and its own default is valid", () => {
  for (const r of STYLE_NUMBER_RULES) {
    assert.ok(r.min < r.max, r.path);
    if (r.default !== null) assert.ok(r.default >= r.min && r.default <= r.max, `${r.path} default is in range`);
  }
});
