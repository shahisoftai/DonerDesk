import { test } from "node:test";
import assert from "node:assert/strict";
import {
  projectStatusTone,
  reportStatusTone,
  severityTone,
  verificationStatusTone,
  checklistStatusTone,
  activityStatusTone,
  toneFor,
} from "../../src/lib/shared/tone.ts";

test("projectStatusTone maps statuses", () => {
  assert.equal(projectStatusTone("ACTIVE"), "success");
  assert.equal(projectStatusTone("PAUSED"), "warning");
  assert.equal(projectStatusTone("COMPLETED"), "info");
  assert.equal(projectStatusTone("ARCHIVED"), "neutral");
  assert.equal(projectStatusTone("UNKNOWN"), "neutral");
});

test("severityTone groups critical/high as danger", () => {
  assert.equal(severityTone("CRITICAL"), "danger");
  assert.equal(severityTone("HIGH"), "danger");
  assert.equal(severityTone("MEDIUM"), "warning");
  assert.equal(severityTone("LOW"), "info");
});

test("verificationStatusTone maps verification states", () => {
  assert.equal(verificationStatusTone("VERIFIED"), "success");
  assert.equal(verificationStatusTone("REJECTED"), "danger");
  assert.equal(verificationStatusTone("PENDING"), "warning");
});

test("reportStatusTone maps lifecycle states", () => {
  assert.equal(reportStatusTone("APPROVED"), "success");
  assert.equal(reportStatusTone("UNDER_REVIEW"), "info");
  assert.equal(reportStatusTone("NOT_STARTED"), "neutral");
});

test("activityStatusTone maps accept/reject", () => {
  assert.equal(activityStatusTone("ACCEPTED"), "success");
  assert.equal(activityStatusTone("REJECTED"), "danger");
  assert.equal(activityStatusTone("PENDING"), "warning");
});

test("checklistStatusTone maps checklist states", () => {
  assert.equal(checklistStatusTone("RESOLVED"), "success");
  assert.equal(checklistStatusTone("OPEN"), "danger");
  assert.equal(checklistStatusTone("IN_PROGRESS"), "warning");
});

test("toneFor falls back to neutral for unknown tones", () => {
  assert.equal(toneFor("nope"), "neutral");
  assert.equal(toneFor("danger"), "danger");
});
