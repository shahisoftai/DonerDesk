import test from "node:test";
import assert from "node:assert/strict";
import { normalizeReportScope, missingScopeFields, describeReportScope, parseReportScope, checklistTemplateForReportType } from "../dist/index.js";

test("normalizeReportScope keeps only known non-empty fields and dedupes ids", () => {
  const s = normalizeReportScope({ activityIds: ["a", "a", "b", ""], eventName: "  Flood ", title: "", junk: 1 });
  assert.deepEqual(s, { activityIds: ["a", "b"], eventName: "Flood" });
});

test("missingScopeFields per report type", () => {
  assert.deepEqual(missingScopeFields("ACTIVITY", {}), ["activityIds"]);
  assert.deepEqual(missingScopeFields("ACTIVITY", { activityIds: ["a"] }), []);
  assert.deepEqual(missingScopeFields("SITUATION", { eventName: "x" }), ["situationDate"]);
  assert.deepEqual(missingScopeFields("CUSTOM", {}), ["title"]);
  assert.deepEqual(missingScopeFields("MONTHLY", {}), []);
});

test("describeReportScope names the focus; cadence reports have none", () => {
  assert.match(describeReportScope("ACTIVITY", { activityIds: ["a"] }, ["Water point repair"]), /Water point repair/);
  assert.match(describeReportScope("SITUATION", { eventName: "Flood", situationDate: "2026-10-01" }), /Flood.*2026-10-01/s);
  assert.equal(describeReportScope("MONTHLY", {}), "");
  assert.deepEqual(parseReportScope("not json"), {});
});

test("situation checklist is stricter than baseline", () => {
  assert.ok(checklistTemplateForReportType("SITUATION").items.length > checklistTemplateForReportType("CUSTOM").items.length);
});
