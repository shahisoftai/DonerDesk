import test from "node:test";
import assert from "node:assert/strict";
import { planCadencePeriods } from "../dist/index.js";

test("a six-month monthly project plans five months and leaves the last for the closing report", () => {
  const plan = planCadencePeriods("MONTHLY", "2026-03-01", "2026-08-31");
  assert.deepEqual(plan.periods.map((p) => p.startDate), ["2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01"]);
  assert.deepEqual(plan.periods.map((p) => p.endDate), ["2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30", "2026-07-31"]);
  assert.deepEqual(plan.closing, { startDate: "2026-08-01", endDate: "2026-08-31" });
});

test("periods that already exist are not planned again", () => {
  const plan = planCadencePeriods("MONTHLY", "2026-03-01", "2026-08-31", ["2026-03-31", "2026-04-30"]);
  assert.deepEqual(plan.periods.map((p) => p.startDate), ["2026-05-01", "2026-06-01", "2026-07-01"]);
  assert.equal(plan.closing?.startDate, "2026-08-01");
});

test("quarterly cadence, and a project that is fully covered plans nothing", () => {
  const q = planCadencePeriods("QUARTERLY", "2026-01-01", "2026-12-31");
  assert.deepEqual(q.periods.map((p) => p.endDate), ["2026-03-31", "2026-06-30", "2026-09-30"]);
  assert.equal(q.closing?.endDate, "2026-12-31");
  const done = planCadencePeriods("MONTHLY", "2026-03-01", "2026-04-30", ["2026-03-31", "2026-04-30"]);
  assert.deepEqual(done, { periods: [], closing: null });
});

test("a project shorter than one block is only a closing period; a type without a cadence plans nothing", () => {
  assert.deepEqual(planCadencePeriods("QUARTERLY", "2026-03-01", "2026-04-15"), { periods: [], closing: { startDate: "2026-03-01", endDate: "2026-04-15" } });
  assert.deepEqual(planCadencePeriods("CUSTOM", "2026-03-01", "2026-08-31"), { periods: [], closing: null });
  assert.deepEqual(planCadencePeriods("MONTHLY", "bad", "worse"), { periods: [], closing: null });
});
