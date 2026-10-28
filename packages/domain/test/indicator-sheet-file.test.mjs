import assert from "node:assert/strict";
import test from "node:test";
import { ENTRY_FILE_HEADERS, entryFileRows, parseIndicatorSheetTable } from "../dist/index.js";

const items = [
  { id: "i1", code: "OUT-1", name: "People trained", baseline: "0", target: "100", previousCumulative: "40", periodAchievement: "10", cumulativeAchievement: "50", comments: "ok", dataSource: "register", locked: false },
  { id: "i2", code: "OUT-2", name: "Verified one", baseline: "0", target: "5", previousCumulative: "", periodAchievement: "3", cumulativeAchievement: "3", comments: "", dataSource: "", locked: true },
];
const known = items.map(({ id, code, name }) => ({ id, code, name }));

test("the file's rows carry a header, the values, the indicator id and the locked mark", () => {
  const t = entryFileRows(items);
  assert.deepEqual(t[0], [...ENTRY_FILE_HEADERS]);
  assert.deepEqual(t[1], ["OUT-1", "People trained", "0", "100", "40", "10", "50", "ok", "register", "i1", ""]);
  assert.equal(t[2][10], "yes");
});

test("what the file wrote reads back to the same values, matched by id, locked rows marked", () => {
  const [header, ...body] = entryFileRows(items);
  const r = parseIndicatorSheetTable(header, body, known);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.rows.map((x) => [x.indicatorId, x.periodAchievement, x.cumulativeAchievement, x.comments, x.dataSource, x.matched, x.locked]), [["i1", "10", "50", "ok", "register", true, false], ["i2", "3", "3", "", "", true, true]]);
});

test("a renamed code still matches by id; an unknown code is kept, named and not matched", () => {
  const table = [[...ENTRY_FILE_HEADERS], ["NEW-CODE", "x", "", "", "", "7", "", "", "", "i1", ""], ["GHOST", "y", "", "", "", "9", "", "", "", "", ""]];
  const r = parseIndicatorSheetTable(table[0], table.slice(1), known);
  assert.equal(r.rows[0].indicatorId, "i1");
  assert.equal(r.rows[0].matched, true);
  assert.equal(r.rows[1].matched, false);
  assert.equal(r.rows[1].indicatorId, null);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /GHOST/);
});

test("the Google Sheet's own headers are still understood, case and spacing aside; a missing column is said, not guessed", () => {
  const r = parseIndicatorSheetTable(["Indicator Code", "Achievement", "Notes", "Source"], [["out-1", "12", "n", "s"], ["", "", "", ""]], known);
  assert.deepEqual(r.rows.map((x) => [x.indicatorId, x.periodAchievement, x.comments, x.dataSource, x.locked]), [["i1", "12", "n", "s", false]]);
  const bad = parseIndicatorSheetTable(["Foo", "Bar"], [["a", "b"]], known);
  assert.equal(bad.warnings.length, 2);
  assert.deepEqual(bad.rows, []);
  assert.equal(parseIndicatorSheetTable(["Code", "Period achievement"], [["OUT-1", "  5  "]], known).rows[0].periodAchievement, "5", "values are trimmed");
});
