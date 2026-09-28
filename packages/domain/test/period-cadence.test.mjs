import assert from "node:assert/strict";
import test from "node:test";
import { suggestPeriodDates, suggestDeadline, DEFAULT_DEADLINE_OFFSET_DAYS } from "../dist/index.js";

const PROJECT = { start: "2026-01-01", end: "2026-12-31" };

test("suggestPeriodDates: first monthly period starts at the project start, not its end (the reported bug)", () => {
  const r = suggestPeriodDates("MONTHLY", PROJECT.start, PROJECT.end, []);
  assert.deepEqual(r, { startDate: "2026-01-01", endDate: "2026-01-31" });
  assert.notEqual(r.endDate, PROJECT.end, "a monthly period's end must never default to the project's end date");
});

test("suggestPeriodDates: quarterly and annual cadences", () => {
  assert.deepEqual(suggestPeriodDates("QUARTERLY", PROJECT.start, PROJECT.end, []), { startDate: "2026-01-01", endDate: "2026-03-31" });
  assert.deepEqual(suggestPeriodDates("ANNUAL", PROJECT.start, PROJECT.end, []), { startDate: "2026-01-01", endDate: "2026-12-31" });
  assert.deepEqual(suggestPeriodDates("SEMI_ANNUAL", PROJECT.start, PROJECT.end, []), { startDate: "2026-01-01", endDate: "2026-06-30" });
});

test("suggestPeriodDates: FINAL always runs to the project's own end date — the one case that IS correct", () => {
  assert.deepEqual(suggestPeriodDates("FINAL", PROJECT.start, PROJECT.end, ["2026-09-30"]), { startDate: "2026-10-01", endDate: "2026-12-31" });
});

test("suggestPeriodDates: chains after the latest existing period", () => {
  const r = suggestPeriodDates("MONTHLY", PROJECT.start, PROJECT.end, ["2026-01-31", "2026-02-28"]);
  assert.deepEqual(r, { startDate: "2026-03-01", endDate: "2026-03-31" });
});

test("suggestPeriodDates: a monthly period near the project end is clipped, never overruns it", () => {
  const r = suggestPeriodDates("MONTHLY", PROJECT.start, "2026-01-20", []);
  assert.deepEqual(r, { startDate: "2026-01-01", endDate: "2026-01-20" });
});

test("suggestPeriodDates: no fixed cadence (Activity/Situation/Custom) → left for the user to set manually", () => {
  assert.equal(suggestPeriodDates("ACTIVITY", PROJECT.start, PROJECT.end, []), null);
  assert.equal(suggestPeriodDates("SITUATION", PROJECT.start, PROJECT.end, []), null);
  assert.equal(suggestPeriodDates("CUSTOM", PROJECT.start, PROJECT.end, []), null);
});

test("suggestPeriodDates: the project's duration is already fully covered → null, no next period", () => {
  assert.equal(suggestPeriodDates("MONTHLY", PROJECT.start, PROJECT.end, [PROJECT.end]), null);
});

test("suggestPeriodDates: accepts full ISO datetime strings (as returned by the API), not just bare dates", () => {
  const r = suggestPeriodDates("MONTHLY", "2026-01-01T00:00:00.000Z", "2026-12-31T00:00:00.000Z", ["2026-01-31T02:00:00.000Z"]);
  assert.deepEqual(r, { startDate: "2026-02-01", endDate: "2026-02-28" });
});

test("suggestDeadline: adds the offset in days to the period's end date", () => {
  assert.equal(suggestDeadline("2026-01-31", 10), "2026-02-10");
  assert.equal(suggestDeadline("2026-01-31", 0), "2026-01-31");
});

test("DEFAULT_DEADLINE_OFFSET_DAYS is a positive, sane fallback", () => {
  assert.ok(DEFAULT_DEADLINE_OFFSET_DAYS > 0 && DEFAULT_DEADLINE_OFFSET_DAYS <= 90);
});
