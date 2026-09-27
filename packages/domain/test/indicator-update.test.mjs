import assert from "node:assert/strict";
import test from "node:test";
import { IndicatorUpdate } from "../dist/index.js";

test("indicator update submit is idempotent for SUBMITTED rows (verify endpoint works)", () => {
  const upd = IndicatorUpdate.create({
    id: "iu-1",
    tenantId: "tenant-a",
    indicatorId: "ind-1",
    reportingPeriodId: "rp-1",
    periodAchievement: "9772",
    cumulativeAchievement: "9772",
    createdById: "user-1",
  });
  assert.equal(upd.verificationStatus, "DRAFT");
  upd.submit();
  assert.equal(upd.verificationStatus, "SUBMITTED");
  // Second submit (e.g. verify endpoint re-running submit before verify) is a no-op.
  upd.submit();
  assert.equal(upd.verificationStatus, "SUBMITTED");
  upd.verify("verifier-1");
  assert.equal(upd.verificationStatus, "VERIFIED");
  assert.ok(upd.verifiedAt);
});

test("indicator update submit still rejects from VERIFIED", () => {
  const upd = IndicatorUpdate.create({
    id: "iu-2",
    tenantId: "tenant-a",
    indicatorId: "ind-1",
    reportingPeriodId: "rp-1",
    periodAchievement: "81.4",
    cumulativeAchievement: "81.4",
    createdById: "user-1",
  });
  upd.submit();
  upd.verify("verifier-1");
  assert.throws(() => upd.submit(), /Cannot submit from status VERIFIED/);
});

function submitted(id) {
  const upd = IndicatorUpdate.create({
    id,
    tenantId: "tenant-a",
    indicatorId: "ind-1",
    reportingPeriodId: "rp-1",
    periodAchievement: "10",
    cumulativeAchievement: "10",
    createdById: "user-1",
  });
  upd.submit();
  return upd;
}

test("request correction from VERIFIED clears the verifier and stores the reason", () => {
  const upd = submitted("iu-c1");
  upd.verify("verifier-1");
  upd.requestCorrection("  Wrong source  ");
  assert.equal(upd.verificationStatus, "NEEDS_CORRECTION");
  assert.equal(upd.comments, "Wrong source");
  assert.equal(upd.verifiedById, undefined);
  assert.equal(upd.verifiedAt, undefined);
  upd.submit();
  assert.equal(upd.verificationStatus, "SUBMITTED");
});

test("request correction requires a reason and a reviewable status", () => {
  assert.throws(() => submitted("iu-c2").requestCorrection("   "));
  const draft = IndicatorUpdate.create({
    id: "iu-c3", tenantId: "t", indicatorId: "i", reportingPeriodId: "p",
    periodAchievement: "1", cumulativeAchievement: "1", createdById: "u",
  });
  assert.throws(() => draft.requestCorrection("reason"));
});

test("reject only from SUBMITTED, with a reason", () => {
  const upd = submitted("iu-r1");
  assert.throws(() => upd.reject(""));
  upd.reject("Duplicate entry");
  assert.equal(upd.verificationStatus, "REJECTED");
  assert.equal(upd.comments, "Duplicate entry");
  assert.throws(() => upd.reject("again"));
  const verified = submitted("iu-r2");
  verified.verify("v");
  assert.throws(() => verified.reject("late"));
});
