import { test } from "node:test";
import assert from "node:assert/strict";
import { activityOptionLabel, periodContainingDate, periodOptionLabel, recentFirst } from "../../src/lib/shared/option-labels.ts";

test("a period reads type and month, a longer one its range", () => {
  assert.equal(periodOptionLabel({ reportType: "MONTHLY", startDate: "2026-03-01T00:00:00.000Z", endDate: "2026-03-31T00:00:00.000Z" }), "Monthly · Mar 2026");
  assert.equal(periodOptionLabel({ reportType: "FINAL", startDate: "2026-08-01T00:00:00.000Z", endDate: "2026-08-31T00:00:00.000Z" }), "Final · Aug 2026");
  assert.equal(periodOptionLabel({ reportType: "SEMI_ANNUAL", startDate: "2026-03-01T00:00:00.000Z", endDate: "2026-08-31T00:00:00.000Z" }), "Semi-annual · Mar 2026 – Aug 2026");
  assert.equal(periodOptionLabel({ reportType: "MONTHLY", startDate: "bad", endDate: "bad" }), "Monthly");
});

test("an activity reads date, title and place", () => {
  assert.equal(activityOptionLabel({ activityTitle: "Hygiene session", activityDate: "2026-03-06T00:00:00.000Z", location: "Bhan Syedabad" }), "6 Mar 2026 · Hygiene session (Bhan Syedabad)");
  assert.equal(activityOptionLabel({ activityTitle: "Hygiene session", activityDate: "nope" }), "Hygiene session");
});

test("most recent comes first and the input is not mutated", () => {
  const input = [{ d: "2026-01-01" }, { d: "2026-03-01" }, { d: "2026-02-01" }];
  assert.deepEqual(recentFirst(input, (x) => x.d).map((x) => x.d), ["2026-03-01", "2026-02-01", "2026-01-01"]);
  assert.equal(input[0]?.d, "2026-01-01");
});

test("the period containing a date is found, the narrowest wins, none when outside", () => {
  const periods = [
    { id: "m3", reportType: "MONTHLY", startDate: "2026-03-01T00:00:00.000Z", endDate: "2026-03-31T00:00:00.000Z" },
    { id: "m4", reportType: "MONTHLY", startDate: "2026-04-01T00:00:00.000Z", endDate: "2026-04-30T00:00:00.000Z" },
    { id: "custom", reportType: "CUSTOM", startDate: "2026-03-01T00:00:00.000Z", endDate: "2026-04-30T00:00:00.000Z" },
  ];
  assert.equal(periodContainingDate(periods, "2026-03-31"), "m3");
  assert.equal(periodContainingDate(periods, "2026-04-15"), "m4");
  assert.equal(periodContainingDate(periods, "2026-06-01"), undefined);
  assert.equal(periodContainingDate(periods, "garbage"), undefined);
});
