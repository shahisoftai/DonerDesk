import test from "node:test";
import assert from "node:assert/strict";
import { highlightPeriod } from "../../src/features/logframe/domain/period-highlight.ts";

const option = () => ({ xAxis: { type: "category", data: ["Jan", "Feb", "Mar"] }, series: [{ type: "line", data: [1, 2, 3] }, { type: "line", data: [3, 3, 3] }] });

test("a period on the axis gets one dashed line on the first series, and the rest is untouched", () => {
  const out = highlightPeriod(option(), "Feb") as { series: Array<{ markLine?: { data: unknown[] } }> };
  assert.deepEqual(out.series[0]!.markLine!.data, [{ xAxis: "Feb" }]);
  assert.equal(out.series[1]!.markLine, undefined);
});

test("no period, or one the chart does not have, gives the chart back as it was", () => {
  const o = option();
  assert.equal(highlightPeriod(o, null), o);
  assert.equal(highlightPeriod(o, "Dec"), o);
  assert.equal(highlightPeriod({ xAxis: { type: "value" }, series: [] }, "Feb").series?.length, 0);
});

test("the input is never changed, and a line already there is kept", () => {
  const o = option();
  const before = JSON.stringify(o);
  highlightPeriod(o, "Feb");
  assert.equal(JSON.stringify(o), before);
  const withLine = { ...o, series: [{ type: "line", data: [1], markLine: { data: [{ yAxis: 10 }] } }] };
  const out = highlightPeriod(withLine, "Jan") as { series: Array<{ markLine: { data: unknown[] } }> };
  assert.deepEqual(out.series[0]!.markLine.data, [{ yAxis: 10 }, { xAxis: "Jan" }]);
});

test("an axis with object entries and a list of axes are read too", () => {
  const out = highlightPeriod({ xAxis: [{ data: [{ value: "Jan" }, { value: "Feb" }] }], series: [{ type: "bar" }] }, "Feb") as { series: Array<{ markLine?: unknown }> };
  assert.ok(out.series[0]!.markLine);
});

import { narrowAxis } from "../../src/features/logframe/domain/period-highlight.ts";

test("narrowAxis lets overlapping period labels be hidden, drops the forced interval, and never changes its input", () => {
  const o = { xAxis: { type: "category", data: ["a"], axisLabel: { interval: 0, hideOverlap: false, width: 90, overflow: "break", color: "#333" } }, series: [] };
  const before = JSON.stringify(o);
  const out = narrowAxis(o) as { xAxis: { axisLabel: Record<string, unknown> } };
  assert.equal(out.xAxis.axisLabel.interval, "auto");
  assert.equal(out.xAxis.axisLabel.hideOverlap, true);
  assert.equal("width" in out.xAxis.axisLabel, false);
  assert.equal(out.xAxis.axisLabel.color, "#333");
  assert.equal(JSON.stringify(o), before);
  assert.equal(narrowAxis({ series: [] }).xAxis, undefined);
});
