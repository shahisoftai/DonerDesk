import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPeriodFilter, periodForLabel } from "../../src/features/dashboards/domain/cross-filter.ts";

const periods = [{ id: "p1", label: "Jan 2026" }, { id: "p2", label: "Feb 2026" }];
test("a period label is found regardless of case and spacing; other words are not periods", () => {
  assert.equal(periodForLabel(periods, " feb 2026 "), "p2");
  assert.equal(periodForLabel(periods, "Mar 2026"), null);
  assert.equal(periodForLabel(periods, "OC1 People reached"), null);
  assert.equal(periodForLabel(periods, ""), null);
});
test("clicking a period sets the filter, the same one again clears it, a non-period leaves it", () => {
  assert.equal(nextPeriodFilter("", periods, "Jan 2026"), "p1");
  assert.equal(nextPeriodFilter("p1", periods, "Feb 2026"), "p2");
  assert.equal(nextPeriodFilter("p2", periods, "Feb 2026"), "");
  assert.equal(nextPeriodFilter("p2", periods, "Kassala"), "p2");
});
