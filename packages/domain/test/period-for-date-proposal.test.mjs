import assert from "node:assert/strict";
import test from "node:test";
import { proposePeriodForDate } from "../dist/index.js";

const base = { projectStart: "2026-07-01", projectEnd: "2026-12-31", reportingFrequency: "MONTHLY", projectStatus: "ACTIVE" };
const month = (id, start, end, extra = {}) => ({ id, reportType: "MONTHLY", startDate: start, endDate: end, ...extra });

test("a day inside a period needs nothing", () => {
  const r = proposePeriodForDate({ ...base, date: "2026-10-15", periods: [month("oct", "2026-10-01", "2026-10-31")] });
  assert.deepEqual(r, { kind: "COVERED", periodId: "oct" });
});

test("the day after the last period proposes the next monthly one", () => {
  const r = proposePeriodForDate({ ...base, date: "2026-11-06", periods: [month("oct", "2026-10-01", "2026-10-31")] });
  assert.equal(r.kind, "PROPOSE");
  assert.deepEqual(r.target, { startDate: "2026-11-01", endDate: "2026-11-30" });
  assert.equal(r.periods.length, 1);
});

test("a day two months ahead lists every period to open, ending with the one that holds the day", () => {
  const r = proposePeriodForDate({ ...base, date: "2026-12-02", periods: [month("oct", "2026-10-01", "2026-10-31")] });
  assert.equal(r.kind, "PROPOSE");
  assert.deepEqual(r.periods.map((p) => p.startDate), ["2026-11-01", "2026-12-01"]);
  assert.equal(r.target.startDate, "2026-12-01");
});

test("with no periods at all the chain starts at the project start", () => {
  const r = proposePeriodForDate({ ...base, date: "2026-07-20", periods: [] });
  assert.equal(r.kind, "PROPOSE");
  assert.deepEqual(r.target, { startDate: "2026-07-01", endDate: "2026-07-31" });
});

test("a cancelled period does not cover its days", () => {
  const r = proposePeriodForDate({ ...base, date: "2026-10-15", periods: [month("oct", "2026-10-01", "2026-10-31", { cancelled: true })] });
  assert.notEqual(r.kind, "COVERED");
});

test("refusals say why", () => {
  assert.deepEqual(proposePeriodForDate({ ...base, date: "nope", periods: [] }), { kind: "NONE", reason: "BAD_DATE" });
  assert.deepEqual(proposePeriodForDate({ ...base, date: "2026-02-30", periods: [] }), { kind: "NONE", reason: "BAD_DATE" });
  assert.deepEqual(proposePeriodForDate({ ...base, date: "2026-06-30", periods: [] }), { kind: "NONE", reason: "BEFORE_PROJECT" });
  assert.deepEqual(proposePeriodForDate({ ...base, date: "2027-01-02", periods: [] }), { kind: "NONE", reason: "AFTER_PROJECT" });
  assert.deepEqual(proposePeriodForDate({ ...base, projectStatus: "COMPLETED", date: "2026-11-06", periods: [] }), { kind: "NONE", reason: "CLOSED_PROJECT" });
  assert.deepEqual(proposePeriodForDate({ ...base, reportingFrequency: "CUSTOM", date: "2026-11-06", periods: [] }), { kind: "NONE", reason: "NO_CADENCE" });
});

test("a day before the latest period cannot be reached by the next one in the chain", () => {
  const r = proposePeriodForDate({ ...base, date: "2026-09-10", periods: [month("aug", "2026-08-01", "2026-08-31"), month("nov", "2026-11-01", "2026-11-30")] });
  assert.deepEqual(r, { kind: "NONE", reason: "NOT_NEXT_IN_CHAIN" });
});

test("the proposal matches what the period form would suggest for the same dates", async () => {
  const { suggestPeriodDates } = await import("../dist/index.js");
  const r = proposePeriodForDate({ ...base, date: "2026-11-06", periods: [month("oct", "2026-10-01", "2026-10-31")] });
  assert.deepEqual(r.target, suggestPeriodDates("MONTHLY", base.projectStart, base.projectEnd, ["2026-10-31"]));
});
