import assert from "node:assert/strict";
import test from "node:test";
import { STYLE_FIELDS, STYLE_GROUPS, STYLE_SCOPE_KINDS, inScope, validateChartSpec, validateChartStyle, applyChartStyle, applyScreenInteraction, buildChart, retheme, CHART_KIND_ORDER, CHART_KINDS } from "../dist/index.js";
import { LIGHT_ROLES, DARK_ROLES } from "../dist/contexts/reporting/chart-theme-roles.js";
import { CASES, build, measureFor, spec as baseSpec } from "./support/chart-fixtures.mjs";

const caseSpec = (kind, style) => baseSpec(kind, CASES[kind][0], CASES[kind][1], { dataset: { measure: measureFor(kind) }, ...(style ? { style } : {}) });
const setPath = (path, v) => path.split(".").reduceRight((acc, k) => ({ [k]: acc }), v);
// A function in an option is compared by its presence, so a formatter that only changes its output needs its own probe.
const shape = (o) => JSON.stringify(o, (_, v) => (typeof v === "function" ? "fn" : v));
const kindsFor = (scope) => CHART_KIND_ORDER.filter((k) => CHART_KINDS[k].status === "BUILT" && CASES[k] && inScope(scope, k));
const drawable = (kind, style) => { const b = build(caseSpec(kind, style)); return b.ok && b.render === "ECHART" ? b : null; };

function candidates(f) {
  if (f.type === "choice") return f.options.filter((o) => o !== f.default);
  if (f.type === "flag") return [true, false];
  if (f.type === "text") return ["€"];
  const at = (t) => { const v = f.min + (f.max - f.min) * t; return f.integer ? Math.round(v) : Math.round(v * 100) / 100; };
  return [at(0.7), at(0.3), f.min, f.max];
}

// What a field changes only through a function (its output, not its presence), checked by calling it.
const PROBES = {
  "map.symbolScale": (o) => typeof o.series?.[0]?.symbolSize === "function" && o.series[0].symbolSize([0, 0, 0]) !== 8,
  "xAxis.prefix": (o) => o.xAxis?.axisLabel?.formatter === "€{value}", "xAxis.suffix": (o) => o.xAxis?.axisLabel?.formatter === "{value}€",
  "yAxis.prefix": (o) => o.yAxis?.axisLabel?.formatter === "€{value}", "yAxis.suffix": (o) => o.yAxis?.axisLabel?.formatter === "{value}€",
};

test("every option in the table is valid in its own scope, changes the drawing, and is refused out of range", () => {
  assert.ok(STYLE_FIELDS.length >= 100, "the table is extensive");
  for (const f of STYLE_FIELDS) {
    const kinds = f.scope === "ALL" ? CHART_KIND_ORDER.filter((k) => CHART_KINDS[k].status === "BUILT" && CASES[k]) : kindsFor(f.scope);
    assert.ok(kinds.length > 0, `${f.path}: a scope with a drawable chart type`);
    let changed = false;
    for (const v of candidates(f)) {
      const style = setPath(f.path, v);
      for (const kind of kinds) {
        const plain = drawable(kind);
        if (!plain) continue;
        const sp = caseSpec(kind, style);
        const problems = validateChartStyle(style, kind);
        assert.deepEqual(problems, [], `${f.path}=${v} on ${kind}`);
        if (f.path.startsWith("interaction.") || f.path === "animation.stagger") { if (shape(applyScreenInteraction(plain.option, sp)) !== shape(plain.option)) changed = true; continue; }
        const styled = drawable(kind, style);
        assert.ok(styled, `${f.path} on ${kind} still draws`);
        if (shape(styled.option) !== shape(plain.option)) changed = true;
        if (PROBES[f.path] && PROBES[f.path](styled.option)) changed = true;
      }
    }
    if (!changed && f.path !== "gauge.bands") assert.fail(`${f.path} changed nothing on any chart type in its scope (${kinds.join(", ")})`);
    // Out of range or unknown is refused, with the field's own path.
    const bad = f.type === "number" ? [f.min - 1, f.max + 1, Number.NaN] : f.type === "choice" ? ["NOPE", 3] : f.type === "flag" ? ["yes", 1] : ["x".repeat(f.maxLength + 1), "<b>"];
    for (const v of bad) assert.ok(validateChartStyle(setPath(f.path, v), kinds[0]).some((p) => p.path === `style.${f.path}`), `${f.path}=${String(v)} is refused`);
    // Outside its scope an option is named as not for this chart type.
    const outside = CHART_KIND_ORDER.find((k) => CHART_KINDS[k].status === "BUILT" && !inScope(f.scope, k));
    if (outside) assert.ok(validateChartStyle(setPath(f.path, candidates(f)[0]), outside).some((p) => p.code === "STYLE_NOT_FOR_KIND" && p.path === `style.${f.path.split(".")[0]}`), `${f.path} on ${outside}`);
  }
});

test("every group has a name and every field belongs to a named group", () => {
  const named = new Set(STYLE_GROUPS.map((g) => g.group));
  assert.equal(named.size, STYLE_GROUPS.length);
  for (const f of STYLE_FIELDS) assert.ok(named.has(f.path.split(".")[0]), f.path);
  for (const g of named) assert.ok(g === "gauge" || STYLE_FIELDS.some((f) => f.path.startsWith(`${g}.`)), `${g} has fields`);
  for (const scope of Object.keys(STYLE_SCOPE_KINDS)) assert.ok(STYLE_SCOPE_KINDS[scope].size > 0, scope);
});

test("every field has a unique path and a label a person can read", () => {
  const seen = new Set();
  for (const f of STYLE_FIELDS) { assert.ok(!seen.has(f.path), f.path); seen.add(f.path); assert.ok(f.label.length > 3 && !/[_.]/.test(f.label), f.label); }
});

test("a broad style never stops a chart drawing, on any chart type", () => {
  for (const kind of CHART_KIND_ORDER.filter((k) => CHART_KINDS[k].status === "BUILT" && CASES[k])) {
    const plain = build(caseSpec(kind));
    let style = {};
    for (const f of STYLE_FIELDS) if (inScope(f.scope, kind) && !f.path.startsWith("pie.rose") && f.path !== "pie.innerRadius") { const v = candidates(f)[0]; style = { ...style, [f.path.split(".")[0]]: { ...(style[f.path.split(".")[0]] ?? {}), ...setPath(f.path.split(".").slice(1).join("."), v) } }; }
    const styled = build(caseSpec(kind, style));
    assert.equal(styled.ok, plain.ok, `${kind}: ${styled.reason}`);
    assert.deepEqual(validateChartSpec(caseSpec(kind, style)), [], kind);
  }
});

test("highest, lowest, average and latest are marked on a line, and never on a stack", () => {
  const line = drawable("LINE", { marks: { max: true, min: true, average: true, latest: true } }).option.series[0];
  assert.deepEqual(line.markPoint.data.map((d) => d.name), ["Highest", "Lowest", "Latest"]);
  assert.equal(line.markLine.data.at(-1).type, "average");
  assert.equal(validateChartStyle({ marks: { max: true } }, "BAR_STACKED")[0].code, "STYLE_NOT_FOR_KIND");
  assert.equal(validateChartStyle({ marks: { max: true } }, "WATERFALL")[0].code, "STYLE_NOT_FOR_KIND");
  const stacked = applyChartStyle({ series: [{ type: "bar", stack: "total", data: [1, 2] }] }, { kind: "BAR", style: { marks: { max: true } } });
  assert.equal(stacked.series[0].markPoint, undefined, "a stack's parts are never marked");
});

test("value prefix and suffix wrap the number the axis already formats", () => {
  const o = drawable("BAR", { yAxis: { prefix: "$", suffix: " k" } }).option;
  assert.equal(o.yAxis.axisLabel.formatter, "${value} k", "a template, so a dashboard or a file keeps it");
  assert.equal(JSON.parse(JSON.stringify(o)).yAxis.axisLabel.formatter, "${value} k", "and it survives being sent as data");
  assert.equal(validateChartStyle({ xAxis: { prefix: "<b>" } }, "BAR")[0].path, "style.xAxis.prefix");
});

test("patterns, shadows, fades and gradients", () => {
  assert.equal(drawable("BAR", { effects: { decals: true } }).option.aria.decal.show, true);
  assert.ok(drawable("BAR", { effects: { decals: true } }).option.aria.label.description, "the text description is kept");
  assert.equal(drawable("BAR", { effects: { shadow: true } }).option.series[0].itemStyle.shadowBlur, 8);
  const bar = drawable("BAR", { bars: { gradient: true } }, ).option.series[0].itemStyle.color;
  assert.equal(bar.type, "linear");
  const own = build(caseSpec("BAR", { bars: { gradient: true } }));
  assert.equal(own.ok, true);
  const area = drawable("AREA", { area: { fade: true, opacity: 0.5 } }).option.series[0].areaStyle;
  assert.equal(area.color.colorStops[1].color.endsWith(",0)"), true);
});

test("gauge bands become coloured stretches of the dial; bad bands are refused", () => {
  const g = drawable("GAUGE", { gauge: { bands: [{ upTo: 30, tone: "NEGATIVE" }, { upTo: 70, tone: "NEUTRAL" }, { upTo: 100, tone: "POSITIVE" }] } }).option.series[0];
  assert.deepEqual(g.axisLine.lineStyle.color, [[0.3, LIGHT_ROLES.negative], [0.7, LIGHT_ROLES.neutral], [1, LIGHT_ROLES.positive]]);
  assert.equal(g.progress.show, false, "the coloured stretches are the dial, so the plain progress arc does not cover them");
  assert.equal(drawable("GAUGE", { gauge: { bands: [{ upTo: 50, tone: "POSITIVE" }] } }).option.series[0].axisLine.lineStyle.color.at(-1)[0], 1, "the rest of the dial is a track");
  for (const bands of [[{ upTo: 60, tone: "NEUTRAL" }, { upTo: 40, tone: "NEGATIVE" }], [{ upTo: 120, tone: "NEUTRAL" }], [{ upTo: 50, tone: "PURPLE" }], Array.from({ length: 6 }, (_, i) => ({ upTo: 10 * (i + 1), tone: "NEUTRAL" }))])
    assert.ok(validateChartStyle({ gauge: { bands } }, "GAUGE").some((p) => p.code === "STYLE_RANGE"), JSON.stringify(bands));
  assert.equal(validateChartStyle({ gauge: { bands: [{ upTo: 50, tone: "NEUTRAL" }] } }, "BAR").some((p) => p.code === "STYLE_NOT_FOR_KIND"), true);
});

test("heat colour steps and ramps", () => {
  const vm = drawable("HEATMAP", { heat: { ramp: "GREEN", steps: 5, showScale: false } }).option.visualMap;
  assert.equal(vm.type, "piecewise");
  assert.equal(vm.splitNumber, 5);
  assert.equal(vm.show, false);
  assert.equal(vm.inRange.color[1], "#166534");
  assert.equal(validateChartStyle({ heat: { steps: 2 } }, "HEATMAP")[0].code, "STYLE_RANGE");
});

test("rose settings apply to a pie or donut only", () => {
  assert.equal(drawable("PIE", { pie: { rose: "AREA" } }).option.series[0].roseType, "area");
  assert.equal(validateChartStyle({ pie: { rose: "AREA" } }, "BAR").some((p) => p.code === "STYLE_NOT_FOR_KIND"), true);
});

test("a style cannot name something the table does not know", () => {
  assert.equal(validateChartStyle({ bars: { glow: 3 } }, "BAR")[0].path, "style.bars.glow");
  assert.equal(validateChartStyle({ sparkle: { on: true } }, "BAR")[0].path, "style.sparkle.on");
  assert.equal(validateChartStyle({ bars: 3 }, "BAR")[0].code, "STYLE_INVALID");
});

test("zoom bars and the picture button are for a screen: a built chart never carries them", () => {
  const styled = build(caseSpec("BAR", { interaction: { zoom: "BOTH", toolbox: true } }));
  assert.equal(styled.option.dataZoom, undefined);
  assert.equal(styled.option.toolbox, undefined);
  const screen = applyScreenInteraction(styled.option, caseSpec("BAR", { interaction: { zoom: "BOTH", toolbox: true } }));
  assert.deepEqual(screen.dataZoom.map((z) => z.type), ["slider", "inside"]);
  assert.ok(screen.grid.bottom >= 64, "room for the slider");
  assert.ok(screen.toolbox.feature.saveAsImage);
  const horizontal = applyScreenInteraction(build(caseSpec("BAR_HORIZONTAL")).option, { style: { interaction: { zoom: "SLIDER" } } });
  assert.equal(horizontal.dataZoom[0].yAxisIndex, 0, "a horizontal bar chart zooms along its categories");
  const plain = build(caseSpec("BAR")).option;
  assert.equal(applyScreenInteraction(plain, { style: { interaction: { zoom: "NONE" } } }), plain);
});

test("a hidden base or track series is never repainted", () => {
  const wf = drawable("WATERFALL", { bars: { gradient: true, radius: 6, width: 20 }, effects: { shadow: true } }).option.series;
  assert.equal(wf[0].itemStyle.color, "transparent");
  assert.equal(wf[0].barWidth, undefined);
});

test("background and tones are roles, so a dark screen swaps them", () => {
  const o = drawable("BAR", { frame: { background: "SURFACE" } }).option;
  assert.equal(o.backgroundColor, LIGHT_ROLES.surface);
  assert.equal(retheme(o, DARK_ROLES).backgroundColor, DARK_ROLES.surface);
  const g = drawable("GAUGE", { gauge: { bands: [{ upTo: 100, tone: "POSITIVE" }] } }).option;
  assert.equal(retheme(g, DARK_ROLES).series[0].axisLine.lineStyle.color[0][1], DARK_ROLES.positive);
});

test("legend, hover and animation settings reach the option", () => {
  const o = drawable("BAR_GROUPED", { legend: { orient: "VERTICAL", gap: 22, mode: "PLAIN", selectable: false }, tooltip: { trigger: "ITEM", pointer: "SHADOW", size: 16, confine: true }, animation: { easing: "ELASTIC_OUT", stagger: 40 } }).option;
  assert.equal(o.animationDelay, undefined, "a delay between marks is a screen setting");
  assert.equal(applyScreenInteraction(o, { style: { animation: { stagger: 40 } } }).animationDelay(3), 120);
  assert.equal(o.legend.orient, "vertical");
  assert.equal(o.legend.itemGap, 22);
  assert.equal(o.legend.type, "plain");
  assert.equal(o.legend.selectedMode, false);
  assert.equal(o.tooltip.trigger, "item");
  assert.equal(o.tooltip.axisPointer.type, "shadow");
  assert.equal(o.tooltip.textStyle.fontSize, 16);
  assert.equal(o.tooltip.confine, true);
  assert.equal(o.animationEasing, "elasticOut");
});

test("a title at the bottom makes room and moves the legend up", () => {
  const o = drawable("BAR_GROUPED", { title: { position: "BOTTOM" } }).option;
  assert.equal(o.title.bottom, 4);
  assert.equal(o.title.top, undefined);
  assert.equal(o.legend.bottom, 24);
  assert.equal(o.grid.bottom, build(caseSpec("BAR_GROUPED")).option.grid.bottom + 24);
});
