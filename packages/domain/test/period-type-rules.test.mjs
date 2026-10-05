import test from "node:test";
import assert from "node:assert/strict";
import { describePeriodTypes, findCadenceOverlap, periodOverlapMessage, ROLL_UP_REPORT_TYPES } from "../dist/index.js";

const d = (s) => new Date(`${s}T00:00:00Z`);
const base = { projectStart: d("2026-01-01"), projectEnd: d("2026-12-31"), projectStatus: "ACTIVE", existing: [], activityCount: 2 };
const by = (opts) => Object.fromEntries(opts.map((o) => [o.type, o]));

test("a fresh active project can create every type; cadence types carry suggested dates", () => {
  const o = by(describePeriodTypes(base));
  assert.equal(Object.values(o).every((x) => x.available), true);
  assert.deepEqual(o.MONTHLY.suggestedDates, { startDate: "2026-01-01", endDate: "2026-01-31" });
  assert.deepEqual(o.FINAL.suggestedDates, { startDate: "2026-01-01", endDate: "2026-12-31" });
  assert.equal(o.ACTIVITY.suggestedDates, undefined);
});

test("finance is offered exactly on quarterly, semi-annual, annual and final", () => {
  const o = by(describePeriodTypes(base));
  assert.deepEqual(Object.values(o).filter((x) => x.financeAvailable).map((x) => x.type), ["QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL"]);
});

test("suggestions chain after the latest existing cadence period; ad-hoc periods don't move them", () => {
  const existing = [
    { id: "m1", reportType: "MONTHLY", start: d("2026-01-01"), end: d("2026-01-31") },
    { id: "c1", reportType: "CUSTOM", start: d("2026-01-05"), end: d("2026-06-30") },
  ];
  assert.equal(by(describePeriodTypes({ ...base, existing })).MONTHLY.suggestedDates.startDate, "2026-02-01");
});

test("once a final report exists no regular period can be added and the reason says what to do", () => {
  const existing = [{ id: "f", reportType: "FINAL", start: d("2026-01-01"), end: d("2026-12-31") }];
  const o = by(describePeriodTypes({ ...base, existing }));
  for (const t of ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL"]) {
    assert.equal(o[t].available, false);
    assert.match(o[t].why, /final report already closes/);
    assert.match(o[t].nextAction, /Custom/);
  }
  assert.equal(o.CUSTOM.available, true);
  assert.equal(o.SITUATION.available, true);
});

test("fully covered project dates block cadence types", () => {
  const existing = [{ id: "a", reportType: "ANNUAL", start: d("2026-01-01"), end: d("2026-12-31") }];
  const o = by(describePeriodTypes({ ...base, existing }));
  assert.equal(o.MONTHLY.available, false);
  assert.match(o.MONTHLY.why, /already has a period/);
});

test("an activity report needs recorded activities", () => {
  const o = by(describePeriodTypes({ ...base, activityCount: 0 }));
  assert.equal(o.ACTIVITY.available, false);
  assert.match(o.ACTIVITY.nextAction, /Record an activity/);
});

test("completed and archived projects take nothing and say how to continue", () => {
  for (const status of ["COMPLETED", "ARCHIVED"]) {
    const o = describePeriodTypes({ ...base, projectStatus: status });
    assert.equal(o.every((x) => !x.available && x.why && x.nextAction), true);
  }
});

test("paused and draft projects are not blocked by this catalog (setup gates live elsewhere)", () => {
  for (const status of ["DRAFT", "PAUSED"]) assert.equal(describePeriodTypes({ ...base, projectStatus: status }).some((x) => x.available), true);
});

test("overlap rule: cadence vs cadence refuses, ad-hoc never does (parity with the create handler)", () => {
  const existing = [{ id: "q1", reportType: "QUARTERLY", start: d("2026-01-01"), end: d("2026-03-31") }];
  const inside = { start: d("2026-02-01"), end: d("2026-02-28") };
  assert.equal(findCadenceOverlap("MONTHLY", inside, existing)?.id, "q1");
  assert.equal(findCadenceOverlap("FINAL", inside, existing)?.id, "q1");
  for (const t of ["ACTIVITY", "SITUATION", "CUSTOM"]) assert.equal(findCadenceOverlap(t, inside, existing), undefined);
  assert.equal(findCadenceOverlap("MONTHLY", { start: d("2026-04-01"), end: d("2026-04-30") }, existing), undefined);
  // an ad-hoc existing period never blocks a cadence one
  assert.equal(findCadenceOverlap("MONTHLY", inside, [{ id: "c", reportType: "CUSTOM", start: d("2026-01-01"), end: d("2026-12-31") }]), undefined);
});

test("overlap message tells a roll-up what to do; plain cadence types get the short form", () => {
  for (const t of ROLL_UP_REPORT_TYPES) assert.match(periodOverlapMessage(t), /closing period|Custom report/);
  assert.equal(periodOverlapMessage("MONTHLY"), "Reporting period overlaps an existing period for this project");
});

import { describeProjectLifecycle } from "../dist/index.js";

test("project lifecycle: every status has a plain label; only actionable states offer a step", () => {
  assert.equal(describeProjectLifecycle("DRAFT").label, "Draft — activate to report");
  assert.equal(describeProjectLifecycle("DRAFT").action.kind, "ACTIVATE");
  assert.equal(describeProjectLifecycle("PAUSED").action.label, "Resume project");
  assert.equal(describeProjectLifecycle("ARCHIVED").action.kind, "RESTORE");
  assert.equal(describeProjectLifecycle("COMPLETED").action, undefined);
  assert.equal(describeProjectLifecycle("ACTIVE").action, undefined);
  assert.equal(describeProjectLifecycle("SOMETHING").label, "Active");
});
