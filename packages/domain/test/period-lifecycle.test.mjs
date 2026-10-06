import assert from "node:assert/strict";
import test from "node:test";
import { ReportingPeriod, checkCancelPeriod, checkRestorePeriod, checkConvertToFinal, hasReleasedReport } from "../dist/index.js";

const d = (m, day = 1) => new Date(Date.UTC(2026, m, day));
const fact = (id, reportType, startMonth) => ({ id, reportType, start: d(startMonth), end: d(startMonth + 1, 0) });
const reason = (check) => (check.ok ? "ok" : check.reason);

test("cancel: allowed until a report on the period is approved or sent", () => {
  assert.equal(checkCancelPeriod({ cancelled: false, draftStatuses: [] }).ok, true);
  assert.equal(checkCancelPeriod({ cancelled: false, draftStatuses: ["DRAFT", "UNDER_REVIEW"] }).ok, true);
  for (const status of ["APPROVED", "EXPORTED", "SUBMITTED"]) {
    assert.match(reason(checkCancelPeriod({ cancelled: false, draftStatuses: [status] })), /approved report/);
  }
  assert.match(reason(checkCancelPeriod({ cancelled: true, draftStatuses: [] })), /already cancelled/);
  assert.equal(hasReleasedReport(["DRAFT"]), false);
});

test("restore: only a cancelled period, and not into dates another period now covers", () => {
  assert.equal(checkRestorePeriod({ cancelled: true }).ok, true);
  assert.match(reason(checkRestorePeriod({ cancelled: false })), /not cancelled/);
  assert.match(reason(checkRestorePeriod({ cancelled: true, overlapping: fact("x", "MONTHLY", 3) })), /cannot be restored/);
});

test("convert to final: the last regular block only, once, and only without a released report", () => {
  const apr = fact("apr", "MONTHLY", 3);
  const base = { period: apr, cancelled: false, others: [fact("jan", "MONTHLY", 0), fact("feb", "MONTHLY", 1), fact("mar", "MONTHLY", 2)], draftStatuses: [] };
  assert.equal(checkConvertToFinal(base).ok, true, "the last month converts");
  assert.equal(checkConvertToFinal({ ...base, others: [] }).ok, true, "a single period converts");

  assert.match(reason(checkConvertToFinal({ ...base, period: fact("feb", "MONTHLY", 1) })), /later period exists/);
  assert.match(reason(checkConvertToFinal({ ...base, others: [...base.others, fact("f", "FINAL", 5)] })), /already has a final/);
  assert.match(reason(checkConvertToFinal({ ...base, period: { ...apr, reportType: "FINAL" } })), /already the final/);
  assert.match(reason(checkConvertToFinal({ ...base, period: { ...apr, reportType: "ACTIVITY" } })), /Only a regular period/);
  assert.match(reason(checkConvertToFinal({ ...base, draftStatuses: ["APPROVED"] })), /approved report/);
  assert.match(reason(checkConvertToFinal({ ...base, cancelled: true })), /Restore it first/);
});

test("an activity or custom report inside the period does not make it 'not the last block'", () => {
  const apr = fact("apr", "MONTHLY", 3);
  const others = [fact("mar", "MONTHLY", 2), { id: "act", reportType: "ACTIVITY", start: d(4), end: d(4, 20) }];
  assert.equal(checkConvertToFinal({ period: apr, cancelled: false, others, draftStatuses: [] }).ok, true);
});

test("the period entity cancels, restores and converts", () => {
  const period = ReportingPeriod.create({ id: "p", tenantId: "t", projectId: "pr", reportType: "MONTHLY", startDate: d(3), endDate: d(3, 30), deadline: d(4, 10) });
  assert.equal(period.isCancelled, false);
  period.cancel("  wrong month  ", d(5));
  assert.equal(period.isCancelled, true);
  assert.equal(period.cancelReason, "wrong month");
  assert.equal(period.cancelledAt.getTime(), d(5).getTime());
  period.restore();
  assert.equal(period.isCancelled, false);
  assert.equal(period.cancelReason, undefined);
  period.cancel(undefined, d(5));
  assert.equal(period.cancelReason, undefined);
  period.restore();
  period.convertToFinal();
  assert.equal(period.reportType, "FINAL");
});

test("a requirement key reads as a person would say it", async () => {
  const { plainRequirementName } = await import("../dist/index.js");
  assert.equal(plainRequirementName("annex_a_budget"), "Annex a budget");
  assert.equal(plainRequirementName("bp:monthly:exec"), "Monthly exec");
  assert.equal(plainRequirementName("executiveSummary"), "Executive summary");
  assert.equal(plainRequirementName(""), "A required item");
});
