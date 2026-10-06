import { test } from "node:test";
import assert from "node:assert/strict";
import { activityEvidenceFormData, evidenceTypeForFile, failedUploads, titleForFile } from "../../src/features/activities/domain/activity-evidence.ts";

test("images are photos; a file named like a register is an attendance sheet; the rest is other", () => {
  assert.equal(evidenceTypeForFile({ name: "a.JPG", type: "" }), "PHOTO");
  assert.equal(evidenceTypeForFile({ name: "a", type: "image/png" }), "PHOTO");
  assert.equal(evidenceTypeForFile({ name: "register.csv", type: "text/csv" }), "ATTENDANCE_SHEET");
  assert.equal(evidenceTypeForFile({ name: "notes.csv", type: "text/csv" }), "OTHER");
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

test("a file's type is suggested from its name (demo 5: everything was 'Other')", async () => {
  const { evidenceTypeForFile, defaultFileSettings, defaultIndicatorForActivity, activityEvidenceFormData } = await import("../../src/features/activities/domain/activity-evidence.ts");
  const f = (name: string, type = "application/pdf") => ({ name, type });
  const table: Array<[string, string]> = [
    ["Training_Attendance_March.pdf", "ATTENDANCE_SHEET"], ["mentorship-visits-log.xlsx", "MONITORING_REPORT"], ["Training report.docx", "TRAINING_RECORD"],
    ["distribution list May.xlsx", "DISTRIBUTION_LIST"], ["meeting minutes.docx", "MEETING_MINUTES"], ["Invoice 2291.pdf", "FINANCIAL_DOCUMENT"],
    ["kobo_export.csv", "KOBO_ODK_EXPORT"], ["notes.pdf", "OTHER"],
  ];
  for (const [name, type] of table) assert.equal(evidenceTypeForFile(f(name)), type, name);
  assert.equal(evidenceTypeForFile(f("site.jpg", "image/jpeg")), "PHOTO");
  assert.deepEqual(defaultFileSettings(f("attendance.pdf"), "ind-1"), { evidenceType: "ATTENDANCE_SHEET", confidentialityLevel: "INTERNAL", indicatorId: "ind-1" });
  const inds = [{ id: "a", logframeItemId: "act-1" }, { id: "b", logframeItemId: "act-2" }, { id: "c", logframeItemId: "act-2" }];
  assert.equal(defaultIndicatorForActivity("act-1", inds), "a", "exactly one indicator under the node: preselected");
  assert.equal(defaultIndicatorForActivity("act-2", inds), "", "several: the person chooses");
  assert.equal(defaultIndicatorForActivity("", inds), "");
  const fd = activityEvidenceFormData(new File(["x"], "attendance.pdf"), { projectId: "p", activityId: "a", reportingPeriodId: "r" }, { evidenceType: "ATTENDANCE_SHEET", confidentialityLevel: "SENSITIVE", indicatorId: "ind-1" });
  assert.equal(fd.get("evidenceType"), "ATTENDANCE_SHEET");
  assert.equal(fd.get("confidentialityLevel"), "SENSITIVE");
  assert.equal(fd.get("indicatorId"), "ind-1");
  assert.equal(activityEvidenceFormData(new File(["x"], "a.pdf"), { projectId: "p", activityId: "a", reportingPeriodId: "r" }).get("indicatorId"), null);
});
