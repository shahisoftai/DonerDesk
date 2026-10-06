import { test } from "node:test";
import assert from "node:assert/strict";
import { planSummary } from "../../src/features/reporting/domain/periods-plan-copy.ts";

test("six months: five periods and the closing report", () => {
  const plan = {
    periods: [{ startDate: "2026-03-01", endDate: "2026-03-31" }, { startDate: "2026-04-01", endDate: "2026-04-30" }, { startDate: "2026-05-01", endDate: "2026-05-31" }, { startDate: "2026-06-01", endDate: "2026-06-30" }, { startDate: "2026-07-01", endDate: "2026-07-31" }],
    closing: { startDate: "2026-08-01", endDate: "2026-08-31" },
  };
  assert.equal(planSummary(plan), "5 periods: Mar 2026 – Jul 2026. The last one (Aug 2026) is the closing report, created from its own steps.");
});

test("one period, nothing left, only a closing period", () => {
  assert.equal(planSummary({ periods: [{ startDate: "2026-03-01", endDate: "2026-03-31" }], closing: null }), "1 period: Mar 2026.");
  assert.equal(planSummary({ periods: [], closing: null }), "Every period this project needs already exists.");
  assert.match(planSummary({ periods: [], closing: { startDate: "2026-08-01", endDate: "2026-08-31" } }), /closing report/);
});
