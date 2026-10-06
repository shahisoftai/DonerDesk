import { test } from "node:test";
import assert from "node:assert/strict";
import { activityEvidenceFormData, evidenceTypeForFile, failedUploads, titleForFile } from "../../src/features/activities/domain/activity-evidence.ts";

test("images are photos, everything else other", () => {
  assert.equal(evidenceTypeForFile({ name: "a.JPG", type: "" }), "PHOTO");
  assert.equal(evidenceTypeForFile({ name: "a", type: "image/png" }), "PHOTO");
  assert.equal(evidenceTypeForFile({ name: "register.csv", type: "text/csv" }), "OTHER");
});

test("a title drops the extension", () => {
  assert.equal(titleForFile({ name: "Chlorine test log.csv" }), "Chlorine test log");
  assert.equal(titleForFile({ name: ".csv" }), ".csv");
});

test("the form data carries the activity and period, with the file last", () => {
  const fd = activityEvidenceFormData(new File(["x"], "photo.png", { type: "image/png" }), {
    projectId: "p", activityId: "a", reportingPeriodId: "r", activityDate: "2026-03-06T00:00:00.000Z", location: "Dadu",
  });
  const keys = [...fd.keys()];
  assert.equal(keys[keys.length - 1], "file");
  assert.equal(fd.get("activityId"), "a");
  assert.equal(fd.get("reportingPeriodId"), "r");
  assert.equal(fd.get("evidenceType"), "PHOTO");
  assert.equal(fd.get("location"), "Dadu");
});

test("only failed uploads are returned for retry", () => {
  const out = failedUploads([{ name: "a", ok: true }, { name: "b", ok: false, error: "too big" }]);
  assert.deepEqual(out.map((o) => o.name), ["b"]);
});
