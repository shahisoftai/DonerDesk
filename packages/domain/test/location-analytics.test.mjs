import test from "node:test";
import assert from "node:assert/strict";
import {
  indicatorLocationRows,
  locationTargetActual,
  locationComparison,
  locationTrends,
  uniqueReach,
  activitiesByLocation,
  isAdditiveIndicatorType,
} from "../dist/index.js";

const loc = (category, value) => ({ dimension: "LOCATION", category, value: String(value) });
const upd = (periodId, entries, status = "VERIFIED", periodAchievement = "", cumulativeAchievement = "") => ({
  reportingPeriodId: periodId,
  periodAchievement,
  cumulativeAchievement,
  verificationStatus: status,
  disaggregation: entries,
});
const countIndicator = { id: "i1", code: "#1", name: "Boreholes", type: "NUMBER" };
const rateIndicator = { id: "i2", code: "#2", name: "Functional share", type: "PERCENTAGE" };

test("additive types are summed per location; spellings fold into one row", () => {
  const view = indicatorLocationRows(countIndicator, [
    upd("p1", [loc("Gulu", 10), loc("Lira", 5)]),
    upd("p2", [loc("Gulu District", 4)]),
  ]);
  assert.equal(view.kind, "ADDITIVE");
  const gulu = view.rows.find((r) => r.key === "gulu");
  const lira = view.rows.find((r) => r.key === "lira");
  assert.equal(gulu.value, "14", '"Gulu District" folds into "Gulu" and sums');
  assert.equal(gulu.location, "Gulu", "display stays the typed spelling");
  assert.equal(lira.value, "5");
  assert.equal(view.rows.length, 2);
});

test("a rate is never summed: its location rows are the latest recorded values", () => {
  const view = indicatorLocationRows(rateIndicator, [
    upd("p1", [loc("Gulu", "61%")]),
    upd("p2", [loc("Gulu", "87%")]),
  ]);
  assert.equal(view.kind, "RECORDED", "marked RECORDED so no renderer totals it");
  assert.equal(view.rows[0].value, "87%", "latest recorded, not 61 + 87");
});

test("qualitative types are shown as recorded too", () => {
  const view = indicatorLocationRows({ ...countIndicator, type: "TEXT" }, [upd("p1", [loc("Gulu", "Functional")])]);
  assert.equal(view.kind, "RECORDED");
  assert.equal(view.rows[0].value, "Functional");
});

test("no LOCATION entries anywhere means PROJECT_WIDE — never an invented breakdown", () => {
  assert.equal(indicatorLocationRows(countIndicator, [upd("p1", [])]).kind, "PROJECT_WIDE");
  assert.equal(indicatorLocationRows(countIndicator, [upd("p1", [{ dimension: "SEX", category: "Female", value: "3" }])]).kind, "PROJECT_WIDE");
});

test("unverified values are counted per row and flip the row's verified flag", () => {
  const view = indicatorLocationRows(countIndicator, [
    upd("p1", [loc("Gulu", 10)]),
    upd("p2", [loc("Gulu", 4)], "DRAFT"),
  ]);
  const gulu = view.rows[0];
  assert.equal(gulu.unverified, 1);
  assert.equal(gulu.verified, false);
  assert.equal(gulu.value, "14", "a draft value still shows, but badged");
});

test("targets: only recorded group targets appear; the project target is never divided", () => {
  const indicator = { ...countIndicator, targetBreakdowns: [loc("Gulu", 40), loc("Kitgum", 30)] };
  const view = locationTargetActual(indicator, [upd("p1", [loc("Gulu", 34), loc("Amuru", 12)])]);
  assert.equal(view.kind, "WITH_TARGETS");
  const gulu = view.rows.find((r) => r.key === "gulu");
  const kitgum = view.rows.find((r) => r.key === "kitgum");
  const amuru = view.rows.find((r) => r.key === "amuru");
  assert.equal(gulu.target, "40");
  assert.equal(gulu.actual, "34");
  assert.equal(gulu.gap, "6");
  assert.equal(gulu.percentOfTarget, "85");
  assert.equal(kitgum.actual, null, "no recorded value is 'not reported', never 0");
  assert.equal(kitgum.percentOfTarget, undefined);
  assert.equal(amuru.target, undefined, "no district target was planned, so none is shown");
  assert.equal(amuru.percentOfTarget, undefined, "an actual without a location target has no % of target");
});

test("zero and negative targets give no percentage; lower-is-better suppresses it too", () => {
  const zero = locationTargetActual({ ...countIndicator, targetBreakdowns: [loc("Gulu", 0)] }, [upd("p1", [loc("Gulu", 12)])]);
  assert.equal(zero.rows[0].percentOfTarget, undefined);
  const ceiling = locationTargetActual({ ...countIndicator, lowerIsBetter: true, targetBreakdowns: [loc("Gulu", 50)] }, [upd("p1", [loc("Gulu", 25)])]);
  assert.equal(ceiling.rows[0].percentOfTarget, undefined, "a worse result must not read as ahead");
});

test("no recorded group targets means NO_LOCATION_TARGETS — the caller never fabricates them", () => {
  const view = locationTargetActual({ ...countIndicator, target: "2000" }, [upd("p1", [loc("Gulu", 100)])]);
  assert.equal(view.kind, "NO_LOCATION_TARGETS");
  assert.equal(view.rows[0].target, undefined);
});

test("the comparison matrix lists only indicators with location entries; gaps are absent cells", () => {
  const matrix = locationComparison([
    { indicator: countIndicator, updates: [upd("p1", [loc("Gulu", 34), loc("Lira", 19)])] },
    { indicator: rateIndicator, updates: [upd("p1", [])] },
  ]);
  assert.deepEqual(matrix.indicators.map((i) => i.id), ["i1"], "the project-wide indicator contributes no cells");
  assert.equal(matrix.locations.length, 2);
  assert.equal(matrix.cells.filter((c) => c.indicatorId === "i2").length, 0);
  assert.equal(matrix.cells.find((c) => c.key === "lira").value, "19");
});

test("trends refuse a single period and non-additive types; a real series aligns gaps as nulls", () => {
  const one = locationTrends(countIndicator, [upd("p1", [loc("Gulu", 10)])], ["p1"]);
  assert.equal(one.kind, "NOT_COMPARABLE");
  const rate = locationTrends(rateIndicator, [upd("p1", [loc("Gulu", 10)]), upd("p2", [loc("Gulu", 12)])], ["p1", "p2"]);
  assert.equal(rate.kind, "NOT_COMPARABLE", "recorded rates are never read as a series");
  const ok = locationTrends(
    countIndicator,
    [upd("p1", [loc("Gulu", 10), loc("Lira", 5)]), upd("p2", [loc("Gulu", 14)])],
    ["p1", "p2"],
  );
  assert.equal(ok.kind, "OK");
  const gulu = ok.series.find((s) => s.key === "gulu");
  const lira = ok.series.find((s) => s.key === "lira");
  assert.deepEqual(gulu.points.map((p) => p.value), ["10", "14"]);
  assert.equal(lira.points[0].value, "5");
  assert.equal(lira.points[1].value, null, "a period with no record is a gap, never 0");
});

test("unique reach: registered people dedupe by id; attendances stay a different metric", () => {
  const beneficiaries = [
    { id: "b1", location: "Gulu" },
    { id: "b2", location: "Gulu" },
    { id: "b3", location: "Lira" },
    { id: "b4", location: "" },
    { id: "b5", location: "Gulu District" },
  ];
  const links = [
    { plannedActivityId: "a1", beneficiaryId: "b1" },
    { plannedActivityId: "a1", beneficiaryId: "b2" },
    { plannedActivityId: "a2", beneficiaryId: "b1" },
    { plannedActivityId: "a2", beneficiaryId: "b5" },
    { plannedActivityId: "a3", beneficiaryId: "b3" },
    { plannedActivityId: "a3", beneficiaryId: "b4" },
  ];
  const activities = [
    { plannedActivityId: "a1", location: "Gulu" },
    { plannedActivityId: "a2", location: "Gulu District" },
    { plannedActivityId: "a3", location: "Lira" },
  ];
  const reach = uniqueReach({ beneficiaries, links, activities });
  assert.equal(reach.overallUnique, 5, "five distinct people");
  const gulu = reach.registeredByLocation.find((r) => r.key === "gulu");
  assert.equal(gulu.unique, 3, "b1, b2 and b5 (registered in Gulu / Gulu District) count once per person");
  const lira = reach.registeredByLocation.find((r) => r.key === "lira");
  assert.equal(lira.unique, 1);
  assert.equal(reach.beneficiariesWithoutLocation, 1, "b4 is reported, never dropped");
  const attendanceGulu = reach.attendancesByActivityLocation.find((r) => r.key === "gulu");
  assert.equal(attendanceGulu.attendances, 4, "a1 (2 links) + a2 (2 links) — the activity's location");
  assert.equal(reach.attendancesByActivityLocation.find((r) => r.key === "lira").attendances, 2);
  assert.notEqual(attendanceGulu.attendances, gulu.unique, "attendances and unique reach are distinct metrics");
});

test("attendances at activities without a location are counted apart, not folded somewhere", () => {
  const reach = uniqueReach({
    beneficiaries: [{ id: "b1", location: "Gulu" }],
    links: [
      { plannedActivityId: "a1", beneficiaryId: "b1" },
      { plannedActivityId: "a2", beneficiaryId: "b1" },
    ],
    activities: [{ plannedActivityId: "a1", location: "Gulu" }],
  });
  assert.equal(reach.attendancesByActivityLocation.length, 1);
  assert.equal(reach.attendancesWithoutLocation, 1);
});

test("activities by location reuse the delivery signals; unlocated ones are reported apart", () => {
  const result = activitiesByLocation([
    { location: "Gulu", signal: "DONE" },
    { location: "Gulu District", signal: "DONE" },
    { location: "Gulu", signal: "LATE" },
    { location: "Lira", signal: "ON_TIME" },
    { location: "Lira", signal: "CANCELLED" },
    { location: "", signal: "ON_TIME" },
  ]);
  const gulu = result.rows.find((r) => r.key === "gulu");
  const lira = result.rows.find((r) => r.key === "lira");
  assert.equal(gulu.planned, 3);
  assert.equal(gulu.done, 2);
  assert.equal(gulu.late, 1);
  assert.equal(lira.cancelled, 1);
  assert.equal(result.unlocated, 1, "never folded into a place");
});

test("isAdditiveIndicatorType agrees with the summation rule", () => {
  assert.equal(isAdditiveIndicatorType("NUMBER"), true);
  assert.equal(isAdditiveIndicatorType("CURRENCY"), true);
  assert.equal(isAdditiveIndicatorType("PERCENTAGE"), false);
  assert.equal(isAdditiveIndicatorType("RATIO"), false);
  assert.equal(isAdditiveIndicatorType("YES_NO"), false);
  assert.equal(isAdditiveIndicatorType("TEXT"), false);
});
