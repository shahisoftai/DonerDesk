import assert from "node:assert/strict";
import test from "node:test";
import { dateLanding, enterableIndicators, filterIndicators, isLockedStatus, nextIndicatorId, offlineRow, valueProblem } from "../../src/features/reporting/domain/quick-entry-view.ts";

const periods = [
  { id: "jan", reportType: "MONTHLY", startDate: "2027-01-01T00:00:00.000Z", endDate: "2027-01-31T00:00:00.000Z", status: "APPROVED" },
  { id: "feb", reportType: "MONTHLY", startDate: "2027-02-01T00:00:00.000Z", endDate: "2027-02-28T00:00:00.000Z", status: "DRAFT" },
  { id: "old", reportType: "MONTHLY", startDate: "2027-03-01T00:00:00.000Z", endDate: "2027-03-31T00:00:00.000Z", cancelled: true },
];
const indicators = [
  { id: "a", code: "OUT-1.1", name: "Women trained" },
  { id: "b", code: "OUT-1.2", name: "Café visits" },
  { id: "c", code: "RATIO", name: "Share of women", formula: { op: "RATIO", terms: ["a", "b"] } },
];

test("a calculated indicator cannot be typed into", () => {
  assert.deepEqual(enterableIndicators(indicators).map((i) => i.id), ["a", "b"]);
});

test("the filter ignores case and accents and matches the code or the name", () => {
  assert.deepEqual(filterIndicators(indicators, "cafe").map((i) => i.id), ["b"]);
  assert.deepEqual(filterIndicators(indicators, "out-1.1").map((i) => i.id), ["a"]);
  assert.equal(filterIndicators(indicators, "  ").length, 3);
});

test("the date says where it will be recorded, and whether that report is locked", () => {
  const feb = dateLanding("2027-02-10", periods);
  assert.equal(feb.kind, "FOUND");
  assert.equal(feb.periodId, "feb");
  assert.equal(feb.locked, false);
  assert.match(feb.label, /Feb 2027/);
  assert.equal(dateLanding("2027-01-10", periods).locked, true);
});

test("a date in no live period, or no real date, is explained and not assigned", () => {
  assert.equal(dateLanding("2027-03-10", periods).kind, "NONE");
  assert.equal(dateLanding("2027-02-31", periods).kind, "INVALID");
});

test("after a save the next indicator of the list is offered, wrapping round", () => {
  const typable = enterableIndicators(indicators);
  assert.equal(nextIndicatorId(typable, "a"), "b");
  assert.equal(nextIndicatorId(typable, "b"), "a");
  assert.equal(nextIndicatorId(typable, "zzz"), "zzz");
});

test("locked statuses mirror the server", () => {
  for (const s of ["APPROVED", "SUBMITTED", "CLOSED"]) assert.equal(isLockedStatus(s), true);
  for (const s of ["DRAFT", "IN_REVIEW", undefined]) assert.equal(isLockedStatus(s), false);
});

test("an empty value is asked for; the offline row carries only what was typed", () => {
  assert.equal(valueProblem("  "), "Type the value.");
  assert.equal(valueProblem("0"), null);
  assert.deepEqual(offlineRow({ indicatorId: "a", value: " 12 " }), { indicatorId: "a", periodAchievement: "12", cumulativeAchievement: "" });
  assert.deepEqual(offlineRow({ indicatorId: "a", value: "12", note: "n", source: "s" }), { indicatorId: "a", periodAchievement: "12", cumulativeAchievement: "", comments: "n", dataSource: "s" });
});
