import assert from "node:assert/strict";
import test from "node:test";
import { latestPreviousValues, nextRunningTotal, suggestRunningTotal, parseEntryNumber } from "../dist/index.js";

const p = (id, s, e) => ({ id, start: new Date(s), end: new Date(e) });
const v = (indicatorId, reportingPeriodId, periodAchievement, cumulativeAchievement, dataSource) => ({ indicatorId, reportingPeriodId, periodAchievement, cumulativeAchievement, dataSource });

test("the latest earlier period with a value wins; the current and later periods are ignored", () => {
  const periods = [p("jan", "2027-01-01", "2027-01-31"), p("feb", "2027-02-01", "2027-02-28"), p("mar", "2027-03-01", "2027-03-31")];
  const out = latestPreviousValues(periods, [v("i1", "jan", "10", "10", "Register"), v("i1", "feb", "20", "30", "Clinic log"), v("i1", "mar", "99", "99"), v("i2", "jan", "", "")], new Date("2027-03-01"));
  assert.equal(out.get("i1")?.periodAchievement, "20");
  assert.equal(out.get("i1")?.dataSource, "Clinic log");
  assert.equal(out.get("i1")?.periodEnd, "2027-02-28");
  assert.equal(out.has("i2"), false);
});

test("numbers are read with thousands separators; text is not a number", () => {
  assert.equal(parseEntryNumber("1,240"), 1240);
  assert.equal(parseEntryNumber("1 240.5"), 1240.5);
  assert.equal(parseEntryNumber("40%"), undefined);
  assert.equal(parseEntryNumber(""), undefined);
  assert.equal(parseEntryNumber(undefined), undefined);
});

test("a running total is suggested only for an indicator that adds up, with numbers on both sides", () => {
  assert.equal(suggestRunningTotal({ aggregation: "SUM", periodValue: "40", previousCumulative: "1,200" }), "1240");
  assert.equal(suggestRunningTotal({ aggregation: "SUM", periodValue: "0.1", previousCumulative: "0.2" }), "0.3");
  assert.equal(suggestRunningTotal({ aggregation: "LATEST", periodValue: "40", previousCumulative: "1200" }), undefined);
  assert.equal(suggestRunningTotal({ aggregation: "PERCENTAGE", periodValue: "40", previousCumulative: "1200" }), undefined);
  assert.equal(suggestRunningTotal({ aggregation: "SUM", periodValue: "n/a", previousCumulative: "1200" }), undefined);
  assert.equal(suggestRunningTotal({ aggregation: "SUM", periodValue: "40", previousCumulative: undefined }), undefined);
});

test("the running total follows the period value until the person types their own", () => {
  const a = nextRunningTotal({ aggregation: "SUM", periodValue: "4", currentCumulative: "", previousCumulative: "100", lastSuggestion: undefined });
  assert.deepEqual(a, { cumulative: "104", suggestion: "104" });
  const b = nextRunningTotal({ aggregation: "SUM", periodValue: "40", currentCumulative: "104", previousCumulative: "100", lastSuggestion: "104" });
  assert.equal(b.cumulative, "140");
  const own = nextRunningTotal({ aggregation: "SUM", periodValue: "50", currentCumulative: "999", previousCumulative: "100", lastSuggestion: "140" });
  assert.equal(own.cumulative, "999");
  const cleared = nextRunningTotal({ aggregation: "SUM", periodValue: "", currentCumulative: "140", previousCumulative: "100", lastSuggestion: "140" });
  assert.equal(cleared.cumulative, "");
});
