import assert from "node:assert/strict";
import test from "node:test";
import * as echarts from "echarts";
import { buildChart, resolveDataset, datasetQueryFor, CHART_KIND_ORDER, CHART_KINDS, CHART_PALETTES, applyChartStyle } from "@donordesk/domain";
import { themedOption } from "../dist/infographics/blocks-core.js";
import { CASES, EXTRA, ALL, sheet, spec, measureFor } from "../../domain/test/support/chart-fixtures.mjs";

// A file is drawn from the option as data (functions are dropped by `themedOption`), server-side, with no browser: every drawable kind must come out as a picture.
const ctx = { t: { palette: ["#2f7be8", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"], line: "#cccccc", muted: "#666666", body: "#333333", ink: "#111111", warn: "#cc0000" }, font: "sans-serif" };
const svgOf = (option) => {
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 640, height: 360 });
  chart.setOption({ ...themedOption(ctx, option), animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
};
const drawn = (kind, style) => {
  const [template, ids] = CASES[kind];
  const s = spec(kind, template, ids, { dataset: { measure: measureFor(kind) }, ...(style ? { style } : {}) });
  return buildChart(s, { ...resolveDataset(sheet, datasetQueryFor(s, ALL)), ...EXTRA });
};

test("every drawable chart type renders to a server-side picture", () => {
  for (const kind of CHART_KIND_ORDER.filter((k) => CHART_KINDS[k].status === "BUILT" && CASES[k])) {
    const b = drawn(kind);
    assert.equal(b.ok, true, `${kind}: ${b.reason}`);
    if (b.render !== "ECHART" || b.maps?.length) continue; // a map needs its geography registered by the screen or the file's own code
    const svg = svgOf(b.option);
    assert.ok(svg.startsWith("<svg"), kind);
    assert.ok(/<(path|rect|circle|text|polygon|line)\b/.test(svg), `${kind} drew something`);
  }
});

test("a pictorial bar's exact figures are text in the file", () => {
  const svg = svgOf(drawn("PICTORIAL_BAR").option);
  assert.ok(/>60</.test(svg) && />15</.test(svg), "the latest figures of A (60) and B (15) are written as text");
});

test("a broad style on every drawable chart type still renders", () => {
  const style = { text: { size: 13 }, title: { align: "LEFT", size: 18 }, labels: { size: 11 }, legend: { icon: "CIRCLE" }, effects: { decals: true, shadow: true }, frame: { background: "SURFACE" }, animation: { enabled: false } };
  for (const kind of CHART_KIND_ORDER.filter((k) => CHART_KINDS[k].status === "BUILT" && CASES[k])) {
    const b = drawn(kind, style);
    if (!b.ok || b.render !== "ECHART" || b.maps?.length) continue;
    assert.ok(svgOf(b.option).startsWith("<svg"), kind);
  }
});

test("the export has no zoom bars or toolbox, whatever the style asks for", () => {
  const s = spec("BAR", "INDICATOR_OVER_TIME", ["a"], { style: { interaction: { zoom: "BOTH", toolbox: true } } });
  const b = buildChart(s, { ...resolveDataset(sheet, datasetQueryFor(s, ALL)), ...EXTRA });
  assert.equal(b.option.dataZoom, undefined);
  assert.equal(b.option.toolbox, undefined);
  assert.ok(!svgOf(b.option).includes("toolbox"));
});

test("styling an option leaves a decal pattern in the picture", () => {
  const plain = svgOf(drawn("BAR").option);
  const decal = svgOf(drawn("BAR", { effects: { decals: true } }).option);
  assert.notEqual(plain, decal);
  assert.ok(/pattern/.test(decal), "a pattern definition is in the file");
});

test("a file takes the brand colours for the product's default palette, and keeps a colour set a person chose", () => {
  const brand = ["#111111", "#222222", "#333333", "#444444"];
  const c = { ...ctx, t: { ...ctx.t, palette: brand } };
  // The product's own default palette (whatever the brand is today), read from the domain rather than copied here.
  const standard = CHART_PALETTES[0].colors;
  const plain = themedOption(c, { color: standard, series: [{ type: "bar", itemStyle: { color: "#ff0000" }, data: [1] }] });
  assert.deepEqual(plain.color, brand, "the default palette is replaced by the brand's");
  assert.equal(plain.series[0].itemStyle.color, undefined);
  const theme = ["#d87c7c", "#919e8b", "#d7ab82", "#6e7074"];
  const chosen = themedOption(c, { color: theme, series: [{ type: "bar", itemStyle: { color: "#ff0000" }, data: [1] }] });
  assert.deepEqual(chosen.color, theme, "a theme's colours are kept");
  assert.equal(chosen.series[0].itemStyle.color, "#ff0000", "so are a person's own series colours");
});
