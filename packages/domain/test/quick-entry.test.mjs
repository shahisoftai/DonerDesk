import assert from "node:assert/strict";
import test from "node:test";
import { chooseQuickEntryPeriod, isQuickEntryDay, quickEntryCumulative, reviewDecision, reviewModeOf } from "../dist/index.js";

const periods = [
  { id: "jan", startDate: "2027-01-01", endDate: "2027-01-31" },
  { id: "feb", startDate: "2027-02-01", endDate: "2027-02-28" },
];

test("the period is found from the date, end day included", () => {
  assert.deepEqual(chooseQuickEntryPeriod({ date: "2027-01-31", periods }), { ok: true, periodId: "jan", chosenBy: "DATE" });
  assert.deepEqual(chooseQuickEntryPeriod({ date: "2027-02-01", periods }), { ok: true, periodId: "feb", chosenBy: "DATE" });
});

test("a date no period covers is never given to a neighbour", () => {
  const r = chooseQuickEntryPeriod({ date: "2027-03-05", periods });
  assert.equal(r.ok, false);
  assert.equal(r.code, "NO_PERIOD");
  assert.match(r.message, /2027-03-05/);
});

test("an impossible or badly written day is refused with a plain sentence", () => {
  assert.equal(isQuickEntryDay("2027-02-30"), false);
  assert.equal(isQuickEntryDay("15/03/2027"), false);
  assert.equal(isQuickEntryDay("2027-02-28"), true);
  assert.equal(chooseQuickEntryPeriod({ date: "2027-02-30", periods }).code, "BAD_DATE");
});

test("a period named by the caller must belong to the project; otherwise the date decides", () => {
  assert.deepEqual(chooseQuickEntryPeriod({ date: "2027-01-10", periods, periodId: "feb" }), { ok: true, periodId: "feb", chosenBy: "PERIOD" });
  assert.equal(chooseQuickEntryPeriod({ date: "2027-01-10", periods, periodId: "other" }).code, "UNKNOWN_PERIOD");
});

test("the running total: typed wins, a summing indicator is suggested, anything else stays empty", () => {
  assert.deepEqual(quickEntryCumulative({ aggregation: "SUM", periodValue: "20", previousCumulative: "30" }), { value: "50", source: "SUGGESTED" });
  assert.deepEqual(quickEntryCumulative({ aggregation: "SUM", periodValue: "20", typedCumulative: "55", previousCumulative: "30" }), { value: "55", source: "TYPED" });
  assert.deepEqual(quickEntryCumulative({ aggregation: "SUM", periodValue: "20", previousCumulative: undefined }), { value: "", source: "NONE" });
  assert.deepEqual(quickEntryCumulative({ aggregation: "LATEST", periodValue: "20", previousCumulative: "30" }), { value: "", source: "NONE" });
});

const base = { status: "DRAFT", hasFigure: true, canVerify: false, evidenceCount: 0 };

test("the full workflow never moves a value by itself", () => {
  const d = reviewDecision({ ...base, mode: "FULL", canVerify: true, evidenceCount: 2 });
  assert.deepEqual([d.submit, d.verify, d.outcome, d.notice], [false, false, "SAVED_DRAFT", null]);
});

test("simple review hands a value in; it verifies only for someone who may verify and only with a file", () => {
  assert.deepEqual(pick(reviewDecision({ ...base, mode: "SIMPLE" })), [true, false, "HANDED_IN"]);
  assert.deepEqual(pick(reviewDecision({ ...base, mode: "SIMPLE", canVerify: true })), [true, false, "HANDED_IN"]);
  assert.deepEqual(pick(reviewDecision({ ...base, mode: "SIMPLE", evidenceCount: 1 })), [true, false, "HANDED_IN"]);
  assert.deepEqual(pick(reviewDecision({ ...base, mode: "SIMPLE", canVerify: true, evidenceCount: 1 })), [true, true, "VERIFIED"]);
});

test("simple review: a missing file is a notice, not a block", () => {
  const d = reviewDecision({ ...base, mode: "SIMPLE", canVerify: true });
  assert.match(d.notice, /Attach a file/);
});

test("simple review leaves a value with no figure as a draft, and never moves a verified value", () => {
  assert.deepEqual(pick(reviewDecision({ ...base, mode: "SIMPLE", hasFigure: false })), [false, false, "SAVED_DRAFT"]);
  assert.deepEqual(pick(reviewDecision({ ...base, mode: "SIMPLE", status: "VERIFIED", canVerify: true, evidenceCount: 1 })), [false, false, "VERIFIED"]);
});

test("an already handed-in value is not submitted twice, but can still be verified", () => {
  assert.deepEqual(pick(reviewDecision({ ...base, mode: "SIMPLE", status: "SUBMITTED", canVerify: true, evidenceCount: 1 })), [false, true, "VERIFIED"]);
  assert.deepEqual(pick(reviewDecision({ ...base, mode: "SIMPLE", status: "SUBMITTED" })), [false, false, "HANDED_IN"]);
});

test("the mode follows the profile flag", () => {
  assert.equal(reviewModeOf(true), "SIMPLE");
  assert.equal(reviewModeOf(false), "FULL");
  assert.equal(reviewModeOf(undefined), "FULL");
});

function pick(d) { return [d.submit, d.verify, d.outcome]; }
