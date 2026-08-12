import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verificationStatusTone,
  confidentialityTone,
  activityStatusTone,
} from "../../src/lib/shared/tone.ts";

test("evidence verification status tones are exhaustive and safe", () => {
  assert.equal(verificationStatusTone("VERIFIED"), "success");
  assert.equal(verificationStatusTone("REJECTED"), "danger");
  assert.equal(verificationStatusTone("NEEDS_CORRECTION"), "danger");
  assert.equal(verificationStatusTone("PENDING_REVIEW"), "warning");
  assert.equal(verificationStatusTone("UPLOADED"), "info");
  assert.equal(verificationStatusTone("AI_TAGGED"), "info");
  assert.equal(verificationStatusTone("ARCHIVED"), "neutral");
  assert.equal(verificationStatusTone("UNKNOWN_VALUE"), "neutral");
});

test("confidentiality tones are safe", () => {
  assert.equal(confidentialityTone("HIGHLY_SENSITIVE"), "danger");
  assert.equal(confidentialityTone("SENSITIVE"), "danger");
  assert.equal(confidentialityTone("INTERNAL"), "warning");
  assert.equal(confidentialityTone("PUBLIC"), "success");
  assert.equal(confidentialityTone("WEIRD"), "neutral");
});

test("activity status tones are exhaustive and safe", () => {
  assert.equal(activityStatusTone("ACCEPTED"), "success");
  assert.equal(activityStatusTone("REJECTED"), "danger");
  assert.equal(activityStatusTone("NEEDS_REVISION"), "danger");
  assert.equal(activityStatusTone("DRAFT"), "neutral");
  assert.equal(activityStatusTone("SUBMITTED"), "info");
  assert.equal(activityStatusTone("UNKNOWN"), "warning");
});
