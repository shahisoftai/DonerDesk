import test from "node:test";
import assert from "node:assert/strict";
import { dueTrialNotice } from "../dist/index.js";

const DAY = 86_400_000;
const end = new Date("2026-10-20T08:00:00Z");
const at = (days) => new Date(end.getTime() + days * DAY);
const due = (days, sent = []) => dueTrialNotice({ endsAt: end, now: at(days), alreadySent: new Set(sent) });

test("told three days before, a day before, and once after it ended; nothing in between or long after", () => {
  assert.equal(due(-10), null);
  assert.equal(due(-4), null);
  assert.equal(due(-3).rule, "TRIAL_3D");
  assert.match(due(-3).title, /ends in 3 days/);
  assert.match(due(-2.5).title, /ends in 2 days/, "whole days left, rounded down");
  assert.equal(due(-2.5).rule, "TRIAL_3D");
  assert.equal(due(-1).rule, "TRIAL_1D");
  assert.equal(due(-0.2).rule, "TRIAL_1D");
  assert.equal(due(0.1).rule, "TRIAL_ENDED");
  assert.equal(due(6).rule, "TRIAL_ENDED");
  assert.equal(due(8), null, "an ended trial is no longer news after a week");
});

test("each notice is sent once; a late run sends only the most urgent one that still applies", () => {
  assert.equal(due(-3, ["TRIAL_3D"]), null);
  assert.equal(due(-1, ["TRIAL_3D"]).rule, "TRIAL_1D");
  assert.equal(due(-1, ["TRIAL_3D", "TRIAL_1D"]), null);
  assert.equal(due(-2, ["TRIAL_1D"]), null, "the day-before notice already covers it");
  assert.equal(due(1, ["TRIAL_3D", "TRIAL_1D"]).rule, "TRIAL_ENDED");
  assert.equal(due(1, ["TRIAL_ENDED"]), null);
  assert.equal(due(-1).rule, "TRIAL_1D", "never having been told, a run on the last day sends the last-day notice, not the three-day one");
});

test("the notice says nothing is deleted and where to choose a plan", () => {
  for (const n of [due(-3), due(-1), due(1)]) {
    assert.match(n.message, /Plan & billing/);
    assert.match(n.message, /nothing was deleted|nothing is deleted|Nothing was deleted/i);
  }
});
