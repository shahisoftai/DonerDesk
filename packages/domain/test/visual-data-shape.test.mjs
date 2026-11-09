import test from "node:test";
import assert from "node:assert/strict";
import { shapeTable, reduceByKey, indicatorValueRows, disaggregationRows, periodRows } from "../dist/index.js";

const sheet = {
  projectId: "p1",
  periods: [1, 2, 3].map((n) => ({ id: `p${n}`, label: `M${n}`, start: `2026-0${n}-01`, end: `2026-0${n}-28`, reportType: "MONTHLY", locked: false })),
  indicators: [
    { id: "a", code: "A", name: "People trained", level: "OUTPUT", type: "COUNT", baseline: "0", target: "100", isRate: false },
    { id: "r", code: "R", name: "Pass rate", level: "OUTCOME", type: "PERCENTAGE", baseline: "0", target: "80", isRate: true },
  ],
  cells: [
    { indicatorId: "a", periodId: "p1", periodValue: "10", cumulativeValue: "10", status: "VERIFIED" },
    { indicatorId: "a", periodId: "p2", periodValue: "20", cumulativeValue: "30", status: "DRAFT", breakdown: [{ dimension: "Sex", category: "Female", value: "12" }, { dimension: "Sex", category: "Male", value: "8" }] },
    { indicatorId: "r", periodId: "p1", periodValue: "70", cumulativeValue: "70", status: "VERIFIED" },
    { indicatorId: "r", periodId: "p2", periodValue: "", cumulativeValue: "", status: "", notApplicable: true },
  ],
  finance: [],
};
const q = (over = {}) => ({ source: "indicator-values", measures: ["period_value"], groupBy: ["indicator"], includeDraft: true, ...over });

test("sheet rows: a gap is null, a rate is kept out of the additive column, not applicable is an answer", () => {
  const rows = indicatorValueRows(sheet);
  assert.equal(rows.length, 6, "one row per indicator and period, gaps included");
  const get = (ind, p) => rows.find((r) => r.values.indicator === ind && r.values.period === p).values;
  assert.equal(get("People trained", "M3").period_value, null, "nothing recorded is null, never 0");
  assert.equal(get("People trained", "M1").period_value, 10);
  assert.equal(get("Pass rate", "M1").period_value, null, "a rate never sits in the additive column");
  assert.equal(get("Pass rate", "M1").rate_value, 70);
  assert.equal(get("Pass rate", "M1").percent_of_target, null, "a rate has no percent of target");
  assert.equal(get("People trained", "M1").percent_of_target, 10);
  assert.equal(get("Pass rate", "M2").status, "Not applicable");
  assert.deepEqual(indicatorValueRows(sheet, { indicatorIds: ["a"], fromPeriodId: "p2", toPeriodId: "p3" }).map((r) => r.values.period), ["M2", "M3"]);
});

test("a total adds only recorded rows, never counts a gap as 0, and says when rows were left out", () => {
  const t = shapeTable(indicatorValueRows(sheet), q({ aggregate: { period_value: "SUM" } }));
  const a = t.rows.find((r) => r.indicator === "People trained");
  assert.equal(a.period_value, 30);
  assert.ok(t.notes.some((n) => /not verified yet/.test(n)));
  assert.ok(t.notes.some((n) => /never counted as 0/.test(n)), "a gap in the group is named");
  const none = t.rows.find((r) => r.indicator === "Pass rate");
  assert.equal(none.period_value, null, "a group with nothing recorded is not measured, not 0");
});

test("drafts are left out and counted unless asked for", () => {
  const t = shapeTable(indicatorValueRows(sheet), q({ includeDraft: false, groupBy: ["indicator", "period"] }));
  assert.equal(t.rows.find((r) => r.indicator === "People trained" && r.period === "M2").period_value, null);
  assert.ok(t.notes.some((n) => /left out/.test(n)));
  const withDrafts = shapeTable(indicatorValueRows(sheet), q({ groupBy: ["indicator", "period"] }));
  assert.equal(withDrafts.rows.find((r) => r.indicator === "People trained" && r.period === "M2").period_value, 20);
  assert.ok(withDrafts.notes.some((n) => /of \d+ values are not verified/.test(n)));
});

test("a non-additive figure is shown only when the rows agree; two figures are never averaged", () => {
  const rows = [{ values: { indicator: "x", rate_value: 40 } }, { values: { indicator: "x", rate_value: 60 } }, { values: { indicator: "y", rate_value: 50 } }];
  const t = shapeTable(rows, { source: "indicator-values", measures: ["rate_value"], groupBy: ["indicator"], includeDraft: true });
  assert.equal(t.rows.find((r) => r.indicator === "x").rate_value, null);
  assert.equal(t.rows.find((r) => r.indicator === "y").rate_value, 50);
  assert.ok(t.notes.some((n) => /not measured/.test(n)));
  const latest = shapeTable(rows, { source: "indicator-values", measures: ["rate_value"], groupBy: ["indicator"], aggregate: { rate_value: "LATEST" }, includeDraft: true });
  assert.equal(latest.rows.find((r) => r.indicator === "x").rate_value, 60);
});

test("filters, limit and calculated figures work on the shaped table", () => {
  const rows = indicatorValueRows(sheet);
  const filtered = shapeTable(rows, q({ filters: [{ field: "level", values: ["OUTPUT"] }] }));
  assert.deepEqual(filtered.rows.map((r) => r.indicator), ["People trained"]);
  const limited = shapeTable(rows, q({ groupBy: ["indicator", "period"], limit: 2 }));
  assert.equal(limited.rows.length, 2);
  assert.ok(limited.notes.some((n) => /first 2 of 6/.test(n)));
  const calc = shapeTable(rows, q({ measures: ["period_value", "target"], groupBy: ["indicator"], aggregate: { period_value: "SUM", target: "VALUE" }, calculated: [{ id: "pct", label: "Share", op: "RATIO", terms: ["period_value", "target"], percent: true }] }));
  assert.equal(calc.rows.find((r) => r.indicator === "People trained").pct, 30);
  assert.equal(calc.rows.find((r) => r.indicator === "Pass rate").pct, null);
  assert.equal(calc.columns.at(-1).id, "pct");
});

test("breakdown rows keep their own recorded values; the total is never rebuilt from groups", () => {
  const rows = disaggregationRows(sheet);
  assert.equal(rows.length, 2);
  const t = shapeTable(rows, { source: "disaggregation", measures: ["group_value"], groupBy: ["category"], includeDraft: true });
  assert.deepEqual(t.rows.map((r) => [r.category, r.group_value]), [["Female", 12], ["Male", 8]]);
  assert.deepEqual(periodRows(sheet).map((r) => r.values.period_label), ["M1", "M2", "M3"]);
});

test("money is limited to the chosen currency and a join attaches one reduced row per key", () => {
  const spend = [{ values: { category: "Staff", currency: "USD", spent: 5 } }, { values: { category: "Staff", currency: "EUR", spent: 7 } }];
  const t = shapeTable(spend, { source: "spending", measures: ["spent"], groupBy: ["category"], currency: "USD", includeDraft: true });
  assert.equal(t.rows[0].spent, 5, "a currency is never added to another");
  const places = [{ values: { indicator: "A", place_value: 3 }, verified: true }, { values: { indicator: "A", place_value: 4 }, verified: true }, { values: { indicator: "B", place_value: 9 }, verified: true }];
  const reduced = reduceByKey("results-by-place", "indicator", places);
  assert.equal(reduced.find((r) => r.values.indicator === "A").values.place_value, 7, "additive values add within a key");
  const main = [{ values: { indicator: "A", period_value: 1 } }, { values: { indicator: "C", period_value: 2 } }];
  const joined = shapeTable(main, { source: "indicator-values", measures: ["period_value", "results-by-place.place_value"], groupBy: ["indicator"], includeDraft: true }, [{ source: "results-by-place", keyField: "indicator", mainKeyField: "indicator", rows: reduced }]);
  assert.equal(joined.rows.find((r) => r.indicator === "A")["results-by-place.place_value"], 7);
  assert.equal(joined.rows.find((r) => r.indicator === "C")["results-by-place.place_value"], null, "no match is not measured, not 0");
});
