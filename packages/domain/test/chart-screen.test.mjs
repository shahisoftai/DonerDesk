import test from "node:test";
import assert from "node:assert/strict";
import { forScreen, DIRECT_LABEL_MAX_SERIES } from "../dist/contexts/reporting/chart-screen.js";

const line = (name) => ({ type: "line", name, data: [1, 2] });
const base = (n) => ({ title: { text: "T", subtext: "S" }, legend: { show: true }, grid: { left: 56, right: 24, top: 56, bottom: 52 }, series: Array.from({ length: n }, (_, i) => line(`s${i}`)) });

test("a tile drops the title, keeps the subtitle and gives the space back to the plot", () => {
  const r = forScreen(base(1));
  assert.equal(r.option.title, undefined);
  assert.equal(r.subtitle, "S");
  assert.equal(r.option.grid.top, 16);
  assert.equal(r.option.series[0].endLabel, undefined);
});

test("two to four lines are named at their ends and the legend goes; five keep the legend", () => {
  const r = forScreen(base(3));
  assert.equal(r.option.legend.show, false);
  assert.ok(r.option.series.every((s) => s.endLabel.formatter === "{a}"));
  assert.ok(r.option.grid.right >= 96);
  const many = forScreen(base(DIRECT_LABEL_MAX_SERIES + 1));
  assert.equal(many.option.legend.show, true);
});

test("bars are never end-labelled, and the original option is not changed", () => {
  const o = { ...base(2), series: [{ type: "bar", data: [1] }, line("x")] };
  const copy = JSON.stringify(o);
  assert.equal(forScreen(o).option.series[0].endLabel, undefined);
  assert.equal(JSON.stringify(o), copy);
});

import { optionToTable } from "../dist/contexts/reporting/chart-screen.js";
import { NOT_MEASURED } from "../dist/contexts/reporting/data-tables.js";

test("View data: a category chart becomes a table, a gap is 'Not measured' and never 0", () => {
  const t = optionToTable({ xAxis: { type: "category", data: ["Jan", "Feb", "Mar"] }, series: [{ type: "bar", name: "People", data: [10, null, { value: 1234.5 }] }, { type: "line", name: "Target", data: [5, 5, 5] }] });
  assert.deepEqual(t.columns, ["", "People", "Target"]);
  assert.deepEqual(t.rows[1], ["Feb", NOT_MEASURED, "5"]);
  assert.deepEqual(t.rows[2], ["Mar", "1,234.5", "5"]);
  assert.equal(t.notMeasured, 1);
});
test("View data: a pie lists its slices; a map or an empty option is not a table", () => {
  const t = optionToTable({ series: [{ type: "pie", name: "Status", data: [{ name: "Done", value: 3 }, { name: "Late", value: null }] }] });
  assert.deepEqual(t.rows, [["Done", "3"], ["Late", NOT_MEASURED]]);
  assert.equal(optionToTable({ series: [{ type: "map", data: [] }] }), null);
  assert.equal(optionToTable({}), null);
});
test("View data: the invisible base series of a waterfall or Gantt is not a column", () => {
  const t = optionToTable({ xAxis: { type: "category", data: ["a"] }, series: [{ type: "bar", name: "base", itemStyle: { color: "transparent" }, data: [1] }, { type: "bar", name: "Total", data: [2] }] });
  assert.deepEqual(t.columns, ["", "Total"]);
});

test("a tile shows every label of a small category axis, and leaves a long one alone", () => {
  const few = forScreen({ xAxis: { type: "category", data: ["Baseline", "Target", "Result"] }, series: [{ type: "bar", data: [1, 2, 3] }] });
  assert.equal(few.option.xAxis.axisLabel.interval, 0);
  const many = forScreen({ xAxis: { type: "category", data: Array.from({ length: 40 }, (_, i) => `p${i}`) }, series: [{ type: "bar", data: [] }] });
  assert.equal(many.option.xAxis.axisLabel, undefined);
  const value = forScreen({ xAxis: { type: "value" }, series: [{ type: "bar", data: [1] }] });
  assert.equal(value.option.xAxis.axisLabel, undefined);
});
