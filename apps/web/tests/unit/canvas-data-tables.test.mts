import test from "node:test";
import assert from "node:assert/strict";
import { tablesCsv, tablesOfDrawings } from "../../src/features/canvas/domain/data-tables.ts";

const bar = { chart: { title: "Children enrolled", option: { xAxis: { type: "category", data: ["Jan", "Feb"] }, yAxis: { type: "value" }, series: [{ type: "bar", name: "A", data: [5, null] }] } } };

test("a chart with a gap becomes a table that says so and never writes 0", () => {
  const [t] = tablesOfDrawings([bar]);
  assert.equal(t!.name, "Children enrolled");
  assert.deepEqual(t!.rows, [["Jan", "5"], ["Feb", "Not measured"]]);
});

test("key figures gather into one table first, names stay unique, and a map is not a table", () => {
  const tables = tablesOfDrawings([bar, bar, { kpi: { title: "Teachers", unit: "teachers", value: 40, periodLabel: "Aug", target: "450", percentOfTarget: null } }, { chart: { title: "Map", option: { series: [{ type: "map", data: [] }] } } }]);
  assert.deepEqual(tables.map((t) => t.name), ["Key figures", "Children enrolled", "Children enrolled (2)"]);
  assert.deepEqual(tables[0]!.rows[0], ["Teachers", 40, "teachers", "Aug", "450", null]);
});

test("the CSV defuses a leading formula character and quotes commas", () => {
  const csv = tablesCsv([{ name: "=cmd", columns: ["a,b", "c"], rows: [["+1", null], ["x", 2]] }]);
  assert.equal(csv, "'=cmd\n\"a,b\",c\n'+1,\nx,2");
});
