import { test } from "node:test";
import assert from "node:assert/strict";
import { closingActionHref, closingStatusLabel, closingSummary } from "../../src/features/reporting/application/closing-report-view.ts";

test("status labels are plain and unknown falls back to to-do", () => {
  assert.equal(closingStatusLabel("DONE"), "Done");
  assert.equal(closingStatusLabel("AFTER_START"), "After you start");
  assert.equal(closingStatusLabel("???"), "To do");
});
test("action links resolve; inputs need the final period and fall back to reports before it exists", () => {
  assert.equal(closingActionHref("OPEN_LOGFRAME", "p"), "/projects/p/logframe");
  assert.equal(closingActionHref("OPEN_INPUTS", "p", "f"), "/projects/p/reports/f/inputs");
  assert.equal(closingActionHref("OPEN_INPUTS", "p"), "/projects/p/reports");
  assert.equal(closingActionHref("NEW_KIND", "p"), "/projects/p/reports");
});
test("summary sentences", () => {
  assert.equal(closingSummary(0, true, false), "Everything is ready. Start the closing report.");
  assert.match(closingSummary(1, true, false), /^1 thing to sort out first/);
  assert.match(closingSummary(3, true, false), /^3 things/);
  assert.equal(closingSummary(2, false, false), "The closing report cannot be started yet.");
  assert.equal(closingSummary(0, false, true), "The closing report has been started.");
});
