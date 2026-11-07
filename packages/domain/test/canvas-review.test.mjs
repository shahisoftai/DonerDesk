import test from "node:test";
import assert from "node:assert/strict";
import { reviewTransition, REVIEW_ACTIONS, REVIEW_STATUSES, snapshotDue, publishBlocker, statusAfterEdit, asReviewStatus, asSnapshotSchedule, blankCanvas } from "../dist/index.js";

test("every action has a way in from at least one status, and only the listed ones work", () => {
  for (const action of REVIEW_ACTIONS) {
    const works = REVIEW_STATUSES.filter((s) => reviewTransition(s, action, { isReviewer: true, note: "why" }).ok);
    assert.ok(works.length > 0, action);
  }
  assert.equal(reviewTransition("DRAFT", "APPROVE", { isReviewer: true }).ok, false, "cannot approve what is not in review");
  assert.equal(reviewTransition("IN_REVIEW", "APPROVE", { isReviewer: false }).ok, false);
  assert.equal(reviewTransition("IN_REVIEW", "REQUEST_CHANGES", { isReviewer: true }).ok, false, "needs a reason");
  assert.equal(reviewTransition("APPROVED", "REOPEN", { isReviewer: false }).status, "DRAFT");
  assert.equal(statusAfterEdit("APPROVED"), "DRAFT");
  assert.equal(asReviewStatus("nonsense"), "DRAFT"); assert.equal(asSnapshotSchedule("nonsense"), "NONE");
});

test("a snapshot is due once its days have passed, never when off", () => {
  const now = new Date("2026-11-30T00:00:00Z");
  assert.equal(snapshotDue("NONE", undefined, now), false);
  assert.equal(snapshotDue("WEEKLY", undefined, now), true);
  assert.equal(snapshotDue("WEEKLY", new Date("2026-11-25T00:00:00Z"), now), false);
  assert.equal(snapshotDue("WEEKLY", new Date("2026-11-22T00:00:00Z"), now), true);
  assert.equal(snapshotDue("MONTHLY", new Date("2026-11-10T00:00:00Z"), now), false);
  assert.equal(snapshotDue("MONTHLY", new Date("2026-10-30T00:00:00Z"), now), true);
});

test("a donor canvas needs approval; an internal live canvas needs nothing", () => {
  const donor = { ...blankCanvas({ id: "c", title: "t", scope: "PROJECT" }), profile: "DONOR_REPORT" };
  assert.match(publishBlocker(donor, "DRAFT") ?? "", /approved|Design check/);
  const internal = blankCanvas({ id: "c", title: "t", scope: "PROJECT" });
  assert.equal(publishBlocker(internal, "DRAFT"), null);
});
