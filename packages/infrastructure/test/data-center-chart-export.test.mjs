import assert from "node:assert/strict";
import test from "node:test";
import { renderChartPng, chartHasData } from "../dist/exports/chart-png-renderer.js";
import { optionFromResolved } from "@donordesk/domain";

const resolved = {
  type: "LINE",
  dataBinding: "DATA_CENTER",
  categories: ["Jan 2026", "Feb 2026", "Mar 2026"],
  series: [{ name: "Cumulative", data: [10, null, 40] }],
  unit: "children",
  title: "Screened",
  referenceLine: { name: "Target", value: 5000 },
};

test("a Data Center chart keeps its type (a line is not coerced to a bar) and its target line widens the axis", () => {
  const option = optionFromResolved(resolved, resolved.type);
  assert.equal(option.series[0].type, "line");
  assert.ok(option.yAxis.max >= 5000);
});

test("a stored Data Center chart is exported as a PNG", async () => {
  assert.equal(chartHasData({ resolved }), true);
  const png = await renderChartPng({ resolved, width: 720, height: 420 });
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.ok(png.length > 2000);
});
