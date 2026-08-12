import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReportDates } from "../../src/lib/shared/report-dates.ts";

test("coherent dates have no errors", () => {
  const errors = validateReportDates({
    startDate: "2026-01-01",
    endDate: "2026-03-31",
    deadline: "2026-04-30",
    internalReviewDeadline: "2026-04-15",
  });
  assert.deepEqual(errors, {});
});

test("end before start is rejected", () => {
  const errors = validateReportDates({ startDate: "2026-03-01", endDate: "2026-01-01", deadline: "2026-04-01" });
  assert.ok(errors.endDate);
});

test("deadline before end is rejected", () => {
  const errors = validateReportDates({ startDate: "2026-01-01", endDate: "2026-03-01", deadline: "2026-02-01" });
  assert.ok(errors.deadline);
});

test("internal deadline after donor deadline is rejected", () => {
  const errors = validateReportDates({
    startDate: "2026-01-01",
    endDate: "2026-03-01",
    deadline: "2026-04-01",
    internalReviewDeadline: "2026-05-01",
  });
  assert.ok(errors.internalReviewDeadline);
});

test("missing required dates are flagged", () => {
  const errors = validateReportDates({});
  assert.ok(errors.startDate);
  assert.ok(errors.endDate);
  assert.ok(errors.deadline);
});

test("invalid dates are treated as missing", () => {
  const errors = validateReportDates({ startDate: "not-a-date", endDate: "", deadline: null });
  assert.ok(errors.startDate);
  assert.ok(errors.deadline);
});
