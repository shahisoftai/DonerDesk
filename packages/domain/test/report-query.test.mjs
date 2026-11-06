import test from "node:test";
import assert from "node:assert/strict";
import { validateReportQuery, describeReportQuery, runReport, reportCsv } from "../dist/index.js";

const data = {
  indicators: [{ id: "a", code: "A1", name: "Trained", unit: "people" }, { id: "b", code: "B1", name: "Coverage", unit: "%" }],
  periods: [{ id: "p1", label: "Q1" }, { id: "p2", label: "Q2" }],
  points: [{ indicatorId: "a", periodId: "p1", value: 1200, status: "VERIFIED", verified: true }, { indicatorId: "a", periodId: "p2", value: null, status: "", verified: false }, { indicatorId: "b", periodId: "p1", value: 40.25, status: "DRAFT", verified: false }, { indicatorId: "b", periodId: "p2", value: 0, status: "VERIFIED", verified: true }],
  missingIndicatorIds: ["gone"], mixedUnits: true, finance: [], withheldDrafts: 0, provenance: { points: 3, unverified: 1 }, notes: [],
};
const q = { indicatorIds: ["a", "b"], measure: "PERIOD", rows: "INDICATOR", includeDraft: true };

test("a report is checked", () => {
  assert.deepEqual(validateReportQuery(q), []);
  assert.equal(validateReportQuery({ ...q, indicatorIds: [] })[0].code, "NO_INDICATOR");
  assert.equal(validateReportQuery({ ...q, indicatorIds: ["a", "a"] })[0].code, "DUPLICATE_INDICATOR");
});

test("indicators down, periods across; a gap stays a gap and a real zero stays zero", () => {
  const t = runReport(data, q);
  assert.deepEqual(t.columns, ["Indicator", "Q1", "Q2"]);
  assert.deepEqual(t.rows[0], { label: "A1 Trained (people)", cells: ["1,200", null] });
  assert.deepEqual(t.rows[1].cells, ["40.25", "0"]);
  assert.ok(t.notes.some((n) => /not verified/.test(n)) && t.notes.some((n) => /no longer in the project/.test(n)));
});

test("periods down, indicators across; percent of target is written with a sign", () => {
  const t = runReport(data, { ...q, rows: "PERIOD", measure: "PERCENT_OF_TARGET" });
  assert.deepEqual(t.columns, ["Period", "A1 Trained (people)", "B1 Coverage (%)"]);
  assert.equal(t.rows[0].cells[1], "40.3%");
});

test("the sentence and the CSV", () => {
  assert.match(describeReportQuery(q, { periods: () => "x" }), /^Showing results for 2 indicators for every period; display the value for each period by indicator, broken down by period, including values not yet verified\.$/);
  assert.match(describeReportQuery({ ...q, fromPeriodId: "p1", toPeriodId: "p2", includeDraft: false }, { periods: (id) => id }), /from p1 to p2.*verified values only/);
  const csv = reportCsv({ columns: ["Indicator", "Q1"], rows: [{ label: "=cmd, \"x\"", cells: [null] }], notes: [] });
  assert.equal(csv, 'Indicator,Q1\r\n"\'=cmd, ""x""",\r\n');
});

import { breakdownPie } from "../dist/index.js";
const split = (cats) => cats.map(([category, value]) => ({ dimension: "SEX", category, value }));
const withSplit = { ...data, indicators: [{ ...data.indicators[0], type: "NUMBER", isRate: false }, { ...data.indicators[1], type: "PERCENTAGE", isRate: true }],
  points: [{ indicatorId: "a", periodId: "p1", periodLabel: "Q1", value: 1200, status: "VERIFIED", verified: true, breakdown: split([["Female", "700"], ["Male", "500"]]) }, { indicatorId: "a", periodId: "p2", periodLabel: "Q2", value: 10, status: "VERIFIED", verified: true, breakdown: split([["Female", "6"], ["Male", "4"]]) }, { indicatorId: "b", periodId: "p2", periodLabel: "Q2", value: 40, status: "VERIFIED", verified: true, breakdown: split([["Female", "30"], ["Male", "50"]]) }] };

test("a breakdown report puts the groups across for the last period, with the recorded total", () => {
  const bq = { ...q, indicatorIds: ["a", "b"], breakdown: "SEX" };
  assert.deepEqual(validateReportQuery(bq), []);
  assert.equal(validateReportQuery({ ...bq, measure: "CUMULATIVE" })[0].code, "BREAKDOWN_NEEDS_PERIOD_VALUE");
  const t = runReport(withSplit, bq);
  assert.deepEqual(t.columns, ["Indicator", "Female", "Male", "Recorded total"]);
  assert.deepEqual(t.rows[0].cells, ["6", "4", "10"], "Q2 is the last period; the total is the value recorded for it");
  assert.match(describeReportQuery({ ...bq, toPeriodId: "p2" }, { periods: () => "Q2" }), /broken down by sex/);
});

test("a pie is drawn only when the parts add up", () => {
  assert.equal(breakdownPie(withSplit, "a").ok, true);
  assert.match(breakdownPie(withSplit, "b").reason, /rate or a ratio/);
  const zero = { ...withSplit, points: [{ ...withSplit.points[0], breakdown: split([["Female", "0"], ["Male", "5"]]) }] };
  assert.match(breakdownPie(zero, "a").reason, /no people/);
  assert.match(breakdownPie({ ...withSplit, points: [] }, "a").reason, /No split/);
});
