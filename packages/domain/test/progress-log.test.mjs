import test from "node:test";
import assert from "node:assert/strict";
import { progressFields, progressRange, sourcesFor, sumValues, overlapping, parseCount, blankValues } from "../dist/index.js";

const act = { start: "2026-10-14", end: "2026-11-20" };
const fields = progressFields([
  { code: "1.1", targetBreakdowns: [{ dimension: "SEX", category: "Women" }, { dimension: "SEX", category: "Men" }] },
  { code: "1.2", targetBreakdowns: [{ dimension: "SEX", category: "Women" }] },
]);

const entry = (id, kind, from, to, v, absorbedById = null) => ({ id, kind, from, to, values: { ...blankValues(fields), ...v }, absorbedById });

test("each breakdown is one field even when two indicators need it, and it names both indicators", () => {
  assert.deepEqual(fields.map((f) => [f.label, f.usedBy]), [["Women", ["1.1", "1.2"]], ["Men", ["1.1"]]]);
});

test("a monthly report is clipped to the activity; a week may not cross a month end", () => {
  assert.deepEqual(progressRange("MONTHLY", "2026-10", act).value, { from: "2026-10-14", to: "2026-10-31" });
  assert.deepEqual(progressRange("MONTHLY", "2026-11", act).value, { from: "2026-11-01", to: "2026-11-20" });
  assert.equal(progressRange("MONTHLY", "2026-12", act).ok, false);
  assert.equal(progressRange("WEEKLY", "2026-10-26", act).ok, false, "26 Oct to 1 Nov crosses into November");
  assert.deepEqual(progressRange("WEEKLY", "2026-10-19", act).value, { from: "2026-10-19", to: "2026-10-25" });
  assert.equal(progressRange("DAILY", "2026-10-13", act).ok, false);
});

test("a monthly figure is the sum of what was recorded in that month; nothing recorded stays blank, never zero", () => {
  const live = [entry("d1", "DAILY", "2026-10-14", "2026-10-14", { total: 8, breakdowns: { "SEX|women": 3 } }), entry("d2", "DAILY", "2026-10-15", "2026-10-15", { total: 9 })];
  const src = sourcesFor("MONTHLY", progressRange("MONTHLY", "2026-10", act).value, live);
  const v = sumValues(src, fields);
  assert.equal(v.total, 17);
  assert.equal(v.breakdowns["SEX|women"], 3);
  assert.equal(v.breakdowns["SEX|men"], null, "not recorded stays blank");
  assert.equal(sumValues([], fields).total, null);
});

test("an entry absorbed by a monthly report does not block a new entry, and a live day does", () => {
  const range = { from: "2026-10-15", to: "2026-10-15" };
  const absorbed = [entry("d2", "DAILY", "2026-10-15", "2026-10-15", {}, "m1"), entry("m1", "MONTHLY", "2026-10-14", "2026-10-31", {})];
  assert.equal(overlapping(absorbed, "DAILY", range)?.id, "m1", "the month still covers the day");
  const live = [entry("d2", "DAILY", "2026-10-15", "2026-10-15", {})];
  assert.equal(overlapping(live, "DAILY", range)?.id, "d2");
  assert.equal(overlapping(live, "DAILY", { from: "2026-10-16", to: "2026-10-16" }), undefined);
});

test("typed figures: blank is null, numbers are whole and not negative", () => {
  assert.deepEqual(parseCount(" 12 ").value, 12);
  assert.equal(parseCount("").value, null);
  assert.equal(parseCount("-1").ok, false);
  assert.equal(parseCount("1.5").ok, false);
});
