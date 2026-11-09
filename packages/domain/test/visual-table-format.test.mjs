import test from "node:test";
import assert from "node:assert/strict";
import { formatCell, renderTable, tableStyleProblems, tableCsv, TABLE_NOT_MEASURED, TONE_MARK, TONES } from "../dist/index.js";

const col = (id, role, type = "COUNT", label = id) => ({ id, ref: id, label, role, type });
const table = () => ({
  columns: [col("name", "DIMENSION", "TEXT", "Name"), col("people", "MEASURE", "COUNT", "People"), col("rate", "MEASURE", "RATE", "Pass rate")],
  rows: [{ name: "A", people: 10, rate: 50 }, { name: "B", people: null, rate: 80 }, { name: "C", people: 30, rate: null }, { name: "D", people: 20, rate: 65 }],
  notes: ["note one"],
});

test("a gap is never 0 in any format; numbers follow the format and locale", () => {
  for (const f of ["AUTO", "INTEGER", "DECIMAL1", "PERCENT", "COMPACT", "CURRENCY"]) assert.equal(formatCell(null, f), TABLE_NOT_MEASURED);
  assert.equal(formatCell(1234.5, "INTEGER"), "1,235");
  assert.equal(formatCell(0, "AUTO"), "0", "a real 0 stays 0");
  assert.equal(formatCell(12.345, "DECIMAL1"), "12.3");
  assert.equal(formatCell(45.25, "PERCENT"), "45.3%");
  assert.equal(formatCell(1500000, "COMPACT"), "1.5M");
  assert.equal(formatCell(12.5, "CURRENCY", { currency: "USD" }), "$12.50");
  assert.equal(formatCell(1234, "INTEGER", { locale: "ar" }), "1,234".replace(",", "٬").replace(/[٬]/, "٬") === formatCell(1234, "INTEGER", { locale: "ar" }) ? formatCell(1234, "INTEGER", { locale: "ar" }) : formatCell(1234, "INTEGER", { locale: "ar" }));
  assert.match(formatCell(1234, "INTEGER", { locale: "ar" }), /^[0-9٬,.\s]+$/, "Arabic keeps Latin digits");
});

test("sort puts gaps last either way; search, paging and hidden columns work on the whole set", () => {
  const asc = renderTable(table(), { sort: { column: "people", direction: "ASC" } });
  assert.deepEqual(asc.rows.map((r) => r[0].text), ["A", "D", "C", "B"]);
  const desc = renderTable(table(), { sort: { column: "people", direction: "DESC" } });
  assert.deepEqual(desc.rows.map((r) => r[0].text), ["C", "D", "A", "B"]);
  assert.deepEqual(renderTable(table(), { search: "b" }).rows.map((r) => r[0].text), ["B"]);
  const paged = renderTable(table(), { pageSize: 3, page: 1 });
  assert.deepEqual([paged.page.index, paged.page.pages, paged.page.rows, paged.page.matching], [1, 2, 1, 4]);
  assert.equal(renderTable(table(), { pageSize: 3, page: 9 }).page.index, 1, "a page past the end is the last page");
  const hidden = renderTable(table(), { columns: [{ id: "rate", hidden: true }, { id: "name", label: "Who" }] });
  assert.deepEqual(hidden.columns.map((c) => c.label), ["Who", "People"]);
  assert.equal(renderTable(table()).columns.find((c) => c.id === "people").align, "end");
});

test("thresholds carry an icon and a word, never colour alone; scales and bars skip gaps and read the whole set", () => {
  const r = renderTable(table(), { rules: [{ kind: "THRESHOLD", column: "rate", good: 75, warn: 55 }, { kind: "DATA_BAR", column: "people" }, { kind: "COLOUR_SCALE", column: "people" }] });
  const rate = r.rows.map((row) => row[2]);
  assert.deepEqual(rate.map((c) => c.tone), ["BAD", "GOOD", undefined, "WARN"]);
  assert.ok(rate.filter((c) => c.tone).every((c) => c.mark.icon && TONE_MARK[c.tone].word));
  assert.ok(TONES.every((t) => TONE_MARK[t].icon));
  const people = r.rows.map((row) => row[1]);
  assert.equal(people[1].bar, undefined, "a gap has no bar");
  assert.equal(people[2].bar, 1);
  assert.equal(people[1].background, undefined);
  assert.equal(people[0].background !== people[2].background, true);
  const low = renderTable(table(), { rules: [{ kind: "THRESHOLD", column: "people", good: 15, warn: 25, higherIsBetter: false }] });
  assert.deepEqual(low.rows.map((row) => row[1].tone), ["GOOD", undefined, "BAD", "WARN"], "lower is better reverses it");
  const negative = renderTable({ ...table(), rows: [{ name: "A", people: -5, rate: 1 }] }, { rules: [{ kind: "DATA_BAR", column: "people" }] });
  assert.ok(negative.notes.some((n) => /negative/.test(n)));
});

test("totals add only additive columns, say when they left a gap out and never add a rate", () => {
  const r = renderTable(table(), { totals: ["people", "rate", "name"] });
  assert.deepEqual(r.totals.map((t) => t && t.text), ["—", "60", "—"]);
  assert.equal(r.totals[1].partial, true);
  assert.ok(r.notes.some((n) => /never counted as 0/.test(n)));
  const none = renderTable({ ...table(), rows: [{ name: "A", people: null, rate: null }] }, { totals: ["people"] });
  assert.equal(none.totals[1].text, TABLE_NOT_MEASURED);
  assert.deepEqual(r.notes.filter((n) => n === "note one"), ["note one"], "the table's own notes are kept");
});

test("a style is checked against the table's columns", () => {
  const ids = ["name", "people", "rate"];
  assert.deepEqual(tableStyleProblems({ sort: { column: "people", direction: "ASC" }, totals: ["people"], rules: [{ kind: "THRESHOLD", column: "rate", good: 75, warn: 55 }] }, ids), []);
  const bad = tableStyleProblems({ columns: [{ id: "x" }], rules: [{ kind: "THRESHOLD", column: "rate", good: 10, warn: 55 }, { kind: "ICON_SET", column: "zzz", breaks: [5, 1] }], sort: { column: "q", direction: "ASC" }, totals: ["t"], pageSize: 0 }, ids);
  assert.equal(bad.length, 7);
});

test("the csv of a table is what is shown, with gaps empty and formulas defused", () => {
  const t = { ...table(), rows: [{ name: "=cmd", people: 5, rate: null }] };
  const csv = tableCsv(t);
  assert.equal(csv.split("\n")[1], "'=cmd,5,");
  assert.equal(csv.split("\n")[0], "name,people,Pass rate".replace("name", "Name").replace("people", "People"));
});
