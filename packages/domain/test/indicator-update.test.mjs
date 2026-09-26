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
