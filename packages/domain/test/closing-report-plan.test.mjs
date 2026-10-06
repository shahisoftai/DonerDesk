import test from "node:test";
import assert from "node:assert/strict";
import { planClosingReport, missingCumulativeFields, CLOSING_STEP_RULES } from "../dist/index.js";

const d = (s) => new Date(`${s}T00:00:00Z`);
const ready = {
  projectStatus: "ACTIVE", projectStart: d("2026-01-01"), projectEnd: d("2026-12-31"),
  existing: [{ id: "m1", reportType: "MONTHLY", start: d("2026-01-01"), end: d("2026-11-30"), finished: true }],
  activityCount: 3, unacceptedActivityCount: 0, unconfirmedCalculationCount: 0, cumulativeGaps: [],
  financeMode: "OFF", templateState: "REVIEWED", projectManagerAssigned: true, meOfficerAssigned: true,
};
const step = (plan, key) => plan.steps.find((s) => s.key === key);

test("a ready project can start: every step done, suggested period closes the cadence", () => {
  const p = planClosingReport(ready);
  assert.equal(p.canStart, true);
  assert.equal(p.todoCount, 0);
  assert.deepEqual(p.suggestedPeriod, { startDate: "2026-12-01", endDate: "2026-12-31" });
  assert.equal(p.steps.length, CLOSING_STEP_RULES.length);
  assert.ok(p.steps.every((s) => s.status === "DONE"));
});

test("each unmet requirement is a TODO with a sentence and a button", () => {
  const p = planClosingReport({
    ...ready,
    unconfirmedCalculationCount: 2,
    existing: [{ id: "m1", reportType: "MONTHLY", start: d("2026-01-01"), end: d("2026-11-30"), finished: false }],
    cumulativeGaps: [{ code: "O1.1", missing: ["project target"] }],
    unacceptedActivityCount: 1,
    templateState: "NOT_REVIEWED",
    projectManagerAssigned: false,
  });
  for (const key of ["calculations", "periods", "figures", "activities", "template", "signoffs"]) {
    const s = step(p, key);
    assert.equal(s.status, "TODO", key);
    assert.ok(s.detail && s.action?.label, key);
  }
  assert.match(step(p, "figures").detail, /O1\.1 \(project target\)/);
  assert.match(step(p, "signoffs").detail, /project manager/);
  assert.equal(p.todoCount, 6);
  assert.equal(p.canStart, true, "unmet steps guide; they do not forbid starting (the report can be drafted and fixed)");
});

test("finance: off is done; on before the report exists is after-start; on after is driven by its status", () => {
  assert.equal(step(planClosingReport(ready), "finance").status, "DONE");
  assert.equal(step(planClosingReport({ ...ready, financeMode: "ON" }), "finance").status, "AFTER_START");
  assert.equal(planClosingReport({ ...ready, financeMode: "ON" }).todoCount, 0);
  const on = { ...ready, financeMode: "ON", existing: [...ready.existing, { id: "f", reportType: "FINAL", start: d("2026-12-01"), end: d("2026-12-31"), finished: false }] };
  assert.equal(step(planClosingReport({ ...on, finalFinance: "MISSING" }), "finance").status, "TODO");
  assert.equal(step(planClosingReport({ ...on, finalFinance: "UNVERIFIED" }), "finance").status, "TODO");
  assert.equal(step(planClosingReport({ ...on, finalFinance: "VERIFIED" }), "finance").status, "DONE");
});

test("an existing final report: cannot start again, points to it", () => {
  const p = planClosingReport({ ...ready, existing: [...ready.existing, { id: "f", reportType: "FINAL", start: d("2026-12-01"), end: d("2026-12-31"), finished: false }] });
  assert.equal(p.canStart, false);
  assert.equal(p.existingFinalId, "f");
  assert.match(p.blockedReason, /already exists/);
});

test("completed projects cannot start and every step is blocked with a reason", () => {
  const p = planClosingReport({ ...ready, projectStatus: "COMPLETED" });
  assert.equal(p.canStart, false);
  assert.match(p.blockedReason, /completed/);
  assert.ok(p.steps.every((s) => s.status === "BLOCKED"));
});

test("a fully covered project (no room for a final) is blocked with the next action", () => {
  const p = planClosingReport({ ...ready, existing: [{ id: "a", reportType: "ANNUAL", start: d("2026-01-01"), end: d("2026-12-31"), finished: true }] });
  assert.equal(p.canStart, false);
  assert.match(p.blockedReason, /already has a period/);
});

test("only regular reports count as 'earlier reports'; custom/activity ones never block", () => {
  const p = planClosingReport({ ...ready, existing: [...ready.existing, { id: "c", reportType: "CUSTOM", start: d("2026-02-01"), end: d("2026-03-01"), finished: false }] });
  assert.equal(step(p, "periods").status, "DONE");
});

test("cumulative field rule", () => {
  assert.deepEqual(missingCumulativeFields({ baseline: "0", target: "10", hasVerifiedCumulative: true }), []);
  assert.deepEqual(missingCumulativeFields({ baseline: "", target: undefined, hasVerifiedCumulative: false }), ["baseline", "project target", "verified cumulative value"]);
});

test("the template step names the template that will structure the closing report", () => {
  const named = step(planClosingReport({ ...ready, templateState: "REVIEWED", templateName: "GWHF Final Project Report" }), "template");
  assert.equal(named.status, "DONE");
  assert.match(named.detail, /GWHF Final Project Report/);
  const none = step(planClosingReport({ ...ready, templateState: "NONE" }), "template");
  assert.match(none.detail, /built-in/);
  assert.equal(step(planClosingReport({ ...ready, templateState: "REVIEWED" }), "template").detail, "The donor template is approved.");
});
