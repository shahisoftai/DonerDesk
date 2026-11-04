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
