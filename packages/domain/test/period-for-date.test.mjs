import assert from "node:assert/strict";
import test from "node:test";
import { periodForDate } from "../dist/index.js";

const jan = { id: "jan", startDate: "2027-01-01", endDate: "2027-01-31" };
const feb = { id: "feb", startDate: "2027-02-01", endDate: "2027-02-28" };
const q1 = { id: "q1", startDate: "2027-01-01", endDate: "2027-03-31" };

test("the period containing the date is found, end day included", () => {
  assert.equal(periodForDate([jan, feb], "2027-01-31"), "jan");
  assert.equal(periodForDate([jan, feb], "2027-02-01"), "feb");
  assert.equal(periodForDate([jan, feb], new Date("2027-02-28T23:00:00Z")), "feb");
});

test("no period contains the date, or the date is unreadable: undefined", () => {
  assert.equal(periodForDate([jan, feb], "2027-03-05"), undefined);
  assert.equal(periodForDate([jan], "not a date"), undefined);
  assert.equal(periodForDate([], "2027-01-05"), undefined);
});

test("overlapping periods: the narrowest wins", () => {
  assert.equal(periodForDate([q1, jan], "2027-01-10"), "jan");
  assert.equal(periodForDate([q1, jan], "2027-03-10"), "q1");
});

test("a period with an unreadable date is ignored", () => {
  assert.equal(periodForDate([{ id: "bad", startDate: "x", endDate: "y" }, jan], "2027-01-10"), "jan");
});
