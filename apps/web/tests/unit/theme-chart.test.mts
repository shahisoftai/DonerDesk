import test from "node:test";
import assert from "node:assert/strict";
import { CHART_PALETTES } from "@donordesk/domain/contexts/reporting/data-charts.js";
import { themeChartOption } from "../../src/features/canvas/domain/theme-chart.ts";

const colours = { palette: ["#111111", "#222222"], line: "#cccccc", muted: "#666666", body: "#333333", ink: "#000000" };

test("the product's default colours give way to the theme's palette", () => {
  const option = { color: [...CHART_PALETTES[0]!.colors], series: [{ type: "bar", itemStyle: { color: "#3b5be6" } }], xAxis: { type: "category" }, yAxis: { type: "value" } };
  const out = themeChartOption(option, colours) as { color: string[]; series: Array<{ itemStyle: { color?: string } }>; yAxis: { axisLine: { lineStyle: { color: string } } } };
  assert.deepEqual(out.color, colours.palette);
  assert.equal(out.series[0]!.itemStyle.color, undefined);
  assert.equal(out.yAxis.axisLine.lineStyle.color, "#cccccc");
  assert.equal((option.series[0]!.itemStyle as { color: string }).color, "#3b5be6", "the drawing is not changed");
});

test("a colour set a person chose is kept as it is", () => {
  const option = { color: ["#ff0000", "#00ff00"], series: [{ type: "bar", itemStyle: { color: "#ff0000" } }] };
  assert.deepEqual(themeChartOption(option, colours), option);
});
