import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReportInputRows, summarizeIndicators } from "../../src/features/report-editor/application/report-inputs.ts";

const base = { storyAnswered: 0, evidenceCount: 0, inputsHref: "/r/inputs", activitiesHref: "/p/activities" };
const v = (status: string) => ({ update: { verificationStatus: status } });
const none = { update: null };

test("an indicator with no value entered is never counted as verified", () => {
  assert.deepEqual(summarizeIndicators([v("VERIFIED"), none, v("DRAFT")]), { total: 3, entered: 2, verified: 1, unverified: 1, notEntered: 1 });
  const rows = buildReportInputRows({ ...base, indicators: [none, none, none, none, none, none], scope: { reportType: "MONTHLY" } });
  const ind = rows.find((r) => r.key === "indicators")!;
  assert.equal(ind.value, "none entered");
  assert.equal(ind.ok, false);
});

test("partially entered indicators say how many are missing", () => {
  const ind = buildReportInputRows({ ...base, indicators: [v("VERIFIED"), v("VERIFIED"), none], scope: { reportType: "QUARTERLY" } }).find((r) => r.key === "indicators")!;
  assert.equal(ind.value, "2 of 2 verified · 1 not entered");
  assert.equal(ind.ok, false);
  assert.match(ind.gap!, /1 indicator has no value/);
});

test("activity report: activities row first, linked indicators only", () => {
  const rows = buildReportInputRows({ ...base, indicators: [], scope: { reportType: "ACTIVITY", activityCount: 2, acceptedActivityCount: 1 } });
  assert.deepEqual(rows.map((r) => r.key), ["activities", "indicators", "story", "evidence"]);
  assert.equal(rows[0]!.value, "2 selected · 1 accepted");
  assert.equal(rows[0]!.ok, false);
  assert.equal(rows[0]!.href, "/p/activities");
  assert.equal(rows[1]!.label, "Linked indicators");
  assert.equal(rows[1]!.value, "none linked");
  assert.equal(rows[1]!.ok, true);
});

test("situation report: activities in window, no indicator row", () => {
  const rows = buildReportInputRows({ ...base, indicators: [v("VERIFIED")], scope: { reportType: "SITUATION", activityCount: 1, acceptedActivityCount: 0 } });
  assert.deepEqual(rows.map((r) => r.key), ["activities", "story", "evidence"]);
  assert.equal(rows[0]!.label, "Activities in this window");
  assert.equal(rows[0]!.ok, true);
});
