import test from "node:test";
import assert from "node:assert/strict";
import {
  collectionDue, collectionOwner, openCollection, collectionSummary, recordedKey, DEFAULT_ENTRY_DUE_DAYS,
  deliveryHealth, healthBand, healthReasons, lateActivities, HEALTH_BAND_LABEL, HEALTH_THRESHOLDS,
  ProjectRiskTrend, planAndCollectionFactors, findRawTokens,
} from "../dist/index.js";

const ind = (extra = {}) => ({ id: "i1", code: "V-01", name: "Vaccinated", frequency: "monthly", ...extra });
const march = { id: "rp-mar", start: "2026-03-01", end: "2026-03-31", isFinal: false };
const base = { indicator: ind(), period: march, projectStart: "2026-01-01", hasValue: false, today: "2026-04-02" };

test("a value is due five days after its period ends, and overdue after that", () => {
  assert.equal(DEFAULT_ENTRY_DUE_DAYS, 5);
  assert.deepEqual(collectionDue({ ...base, today: "2026-04-02" }), { indicatorId: "i1", periodId: "rp-mar", dueBy: "2026-04-05", state: "DUE" });
  assert.equal(collectionDue({ ...base, today: "2026-04-05" }).state, "DUE", "the due day itself is still on time");
  assert.equal(collectionDue({ ...base, today: "2026-04-06" }).state, "OVERDUE");
  assert.equal(collectionDue({ ...base, today: "2026-04-02", dueDays: 10 }).dueBy, "2026-04-10", "the profile's own number of days");
});

test("nothing is due while the period still runs, a recorded value is fine, and an indicator not due this period is never missing", () => {
  assert.equal(collectionDue({ ...base, today: "2026-03-20" }).state, "NOT_DUE");
  assert.equal(collectionDue({ ...base, today: "2026-03-31" }).state, "NOT_DUE", "the last day of the period is not yet");
  assert.equal(collectionDue({ ...base, today: "2026-06-01", hasValue: true }).state, "RECORDED");
  const quarterly = ind({ frequency: "quarterly" });
  assert.equal(collectionDue({ ...base, indicator: quarterly, today: "2026-05-01" }).state, "OVERDUE", "March closes a quarter counted from January: due, and by May it is overdue");
  const feb = { id: "rp-feb", start: "2026-02-01", end: "2026-02-28", isFinal: false };
  assert.equal(collectionDue({ ...base, indicator: quarterly, period: feb, today: "2026-05-01" }).state, "NOT_DUE", "February does not close a quarter: not missing");
  assert.equal(collectionDue({ ...base, indicator: quarterly, period: { ...feb, isFinal: true }, today: "2026-05-01" }).state, "OVERDUE", "the closing period is always due");
  assert.equal(collectionDue({ ...base, indicator: ind({ frequency: "something unrecognised" }), today: "2026-05-01" }).state, "OVERDUE", "unrecognised text means every period");
});

test("who collects: the indicator's lead, else the M&E officer, else the manager", () => {
  assert.equal(collectionOwner({ responsibleUserId: "amina" }, { meOfficerId: "me", projectManagerId: "pm" }), "amina");
  assert.equal(collectionOwner({}, { meOfficerId: "me", projectManagerId: "pm" }), "me");
  assert.equal(collectionOwner({ responsibleUserId: null }, { meOfficerId: null, projectManagerId: "pm" }), "pm");
  assert.equal(collectionOwner({}, {}), undefined);
});

test("what the project is waiting for: due and overdue values only, oldest first", () => {
  const out = openCollection({
    projectStart: "2026-01-01", today: "2026-04-10",
    indicators: [ind({ id: "i2", code: "B-02" }), ind()],
    periods: [march, { id: "rp-apr", start: "2026-04-01", end: "2026-04-30", isFinal: false }, { id: "rp-feb", start: "2026-02-01", end: "2026-02-28", isFinal: false }],
    recorded: new Set([recordedKey("i1", "rp-feb")]),
  });
  assert.deepEqual(out.map((o) => [o.indicator.code, o.periodId, o.state]), [["B-02", "rp-feb", "OVERDUE"], ["B-02", "rp-mar", "OVERDUE"], ["V-01", "rp-mar", "OVERDUE"]]);
  assert.deepEqual(openCollection({ projectStart: "2026-01-01", today: "2026-04-10", indicators: [], periods: [march], recorded: new Set() }), []);
});

const rows = (...states) => states.map(([status, state]) => ({ status, state }));

test("the collection summary counts overdue, due and recorded values", () => {
  const input = { projectStart: "2026-01-01", today: "2026-04-10", indicators: [ind({ id: "i2", code: "B-02" }), ind()], periods: [march, { id: "rp-apr", start: "2026-04-01", end: "2026-04-30", isFinal: false }], recorded: new Set([recordedKey("i1", "rp-mar")]) };
  assert.deepEqual(collectionSummary(input), { overdue: 1, due: 0, recorded: 1 }, "April is still running; March: one recorded, one overdue");
  assert.deepEqual(collectionSummary({ ...input, indicators: [] }), { overdue: 0, due: 0, recorded: 0 });
});

test("health counts: planned excludes cancelled; late = overdue + late start; on-time rate is of what is done", () => {
  const h = deliveryHealth(rows(["DONE", "DONE"], ["DONE", "DONE_LATE"], ["PLANNED", "OVERDUE"], ["IN_PROGRESS", "LATE_START"], ["PLANNED", "DUE_SOON"], ["PLANNED", "UPCOMING"], ["CANCELLED", "CANCELLED"]), { overdue: 2, due: 1 });
  assert.deepEqual(h, { planned: 6, done: 2, doneLate: 1, overdue: 1, lateStart: 1, dueSoon: 1, valuesOverdue: 2, valuesDue: 1, valuesRecorded: 0, onTimeRate: 0.5 });
  assert.equal(lateActivities(h), 2);
  assert.equal(deliveryHealth([], { overdue: 0, due: 0 }).onTimeRate, null);
});

test("the three labels: nothing late is on track, something late needs attention, a lot is behind, and no plan says so", () => {
  const band = (r, c = { overdue: 0, due: 0 }) => healthBand(deliveryHealth(r, c));
  assert.equal(band([]), "NO_PLAN");
  assert.equal(band(rows(["PLANNED", "UPCOMING"], ["DONE", "DONE"])), "ON_TRACK");
  assert.equal(band(rows(["PLANNED", "UPCOMING"], ["PLANNED", "OVERDUE"], ["PLANNED", "UPCOMING"], ["PLANNED", "UPCOMING"], ["PLANNED", "UPCOMING"], ["PLANNED", "UPCOMING"], ["PLANNED", "UPCOMING"], ["PLANNED", "UPCOMING"], ["PLANNED", "UPCOMING"], ["PLANNED", "UPCOMING"])), "AT_RISK", "1 of 10 late");
  assert.equal(band(rows(["PLANNED", "OVERDUE"], ["PLANNED", "UPCOMING"], ["PLANNED", "UPCOMING"], ["PLANNED", "UPCOMING"])), "OFF_TRACK", "a quarter of the plan is late");
  assert.equal(band(rows(...Array.from({ length: 5 }, () => ["PLANNED", "OVERDUE"]), ...Array.from({ length: 40 }, () => ["PLANNED", "UPCOMING"]))), "OFF_TRACK", "five late is behind however big the plan");
  assert.equal(band([], { overdue: 0, due: 4 }), "ON_TRACK", "values being due is not trouble");
  assert.equal(band([], { overdue: 0, due: 0, recorded: 6 }), "ON_TRACK", "values are being tracked and all recorded: not 'no plan'");
  assert.equal(band(rows(["PLANNED", "UPCOMING"]), { overdue: 1, due: 0 }), "AT_RISK");
  assert.equal(band(rows(["PLANNED", "UPCOMING"]), { overdue: HEALTH_THRESHOLDS.offTrackOverdueValues, due: 0 }), "OFF_TRACK");
  assert.deepEqual(Object.values(HEALTH_BAND_LABEL), ["On track", "Needs attention", "Behind", "No plan yet"]);
});

test("the reasons are the two biggest, in words, and a quiet project says nothing is late", () => {
  const h = deliveryHealth(rows(...Array.from({ length: 4 }, () => ["PLANNED", "OVERDUE"]), ["PLANNED", "DUE_SOON"]), { overdue: 2, due: 3 });
  assert.deepEqual(healthReasons(h), ["4 activities late", "3 indicator values due"]);
  assert.deepEqual(healthReasons(deliveryHealth(rows(["PLANNED", "OVERDUE"]), { overdue: 1, due: 0 })), ["1 activity late", "1 indicator value overdue"]);
  assert.deepEqual(healthReasons(deliveryHealth(rows(["PLANNED", "UPCOMING"]), { overdue: 0, due: 0 })), ["Nothing is late"]);
  assert.deepEqual(healthReasons(deliveryHealth([], { overdue: 0, due: 0 })), []);
  for (const text of healthReasons(h)) assert.deepEqual(findRawTokens(text), []);
});

test("risk trend: the plan and collection factors join the stored score without changing its shape", () => {
  assert.deepEqual(planAndCollectionFactors({ lateActivities: 0, valuesOverdue: 0 }), []);
  const factors = planAndCollectionFactors({ lateActivities: 6, valuesOverdue: 1 });
  assert.deepEqual(factors.map((f) => [f.type, f.weight, f.severity, f.description]), [["plan_slip", 6, "HIGH", "6 planned activities are late"], ["value_overdue", 1, "LOW", "1 indicator value is overdue"]]);
  const trend = ProjectRiskTrend.create({ id: "r1", tenantId: "tenant-a", projectId: "p", periodStart: new Date("2026-03-01"), periodEnd: new Date("2026-03-31") });
  assert.equal(trend.riskScore, 0);
  for (const f of factors) trend.addRiskFactor(f);
  assert.equal(trend.riskScore, 15 + 3, "6 late = capped at 15; 1 overdue value = 3");
  trend.removeRiskFactor("plan_slip");
  assert.equal(trend.riskScore, 3);
  trend.updateMetrics({ missingEvidenceCount: 10, deadlineSlipsCount: 5, overdueChecklistItemsCount: 5, contributingFactors: factors });
  assert.ok(trend.riskScore <= 100);
});
