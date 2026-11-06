import test from "node:test";
import assert from "node:assert/strict";
import { buildManagementReport, managementReportCsv } from "../dist/index.js";

const input = (over = {}) => ({
  project: { title: "WASH Response", code: "W-1", donor: "UNHCR", country: "Pakistan", sector: "WASH", start: "2026-01-01", end: "2026-12-31", status: "ACTIVE" },
  today: "2026-10-21",
  delivery: { label: "Behind", reasons: ["5 activities are late"], planned: 6, lateActivities: 5, valuesOverdue: 2 },
  indicators: [
    { code: "IND-1", name: "Water points", unit: "points", target: "25", latest: "4", asOf: "2026-06-30", percentOfTarget: "16%", variance: "-1 (-20%)", status: "VERIFIED" },
    { code: "IND-2", name: "Households, with \"quotes\"", unit: "", target: "100", latest: null, asOf: null, percentOfTarget: "", variance: "", status: "" },
  ],
  periods: [{ label: "Jun 2026", reportType: "MONTHLY", status: "NOT_STARTED", deadline: "2026-07-05", daysUntil: -108, readiness: 20 }, { label: "May 2026", reportType: "MONTHLY", status: "APPROVED", deadline: "2026-06-05", daysUntil: -138, readiness: 100 }],
  risks: [{ title: "Contractor delayed", kind: "PROBLEM", seriousness: "HIGH", status: "OPEN", reviewBy: "2026-11-01" }, { title: "Old", kind: "RISK", seriousness: "LOW", status: "CLOSED" }],
  evidence: { total: 7, byStatus: { VERIFIED: 5, PENDING_REVIEW: 2, REJECTED: 0 } },
  activities: { total: 2, accepted: 2, participants: 664 },
  ...over,
});

test("the report has the six sections a manager reads, in order", () => {
  assert.deepEqual(buildManagementReport(input()).map((s) => s.title), ["Project", "Delivery", "Indicators", "Reports", "Problems and risks", "Evidence"]);
});

test("each section says in a sentence what it shows", () => {
  const s = Object.fromEntries(buildManagementReport(input()).map((x) => [x.title, x.summary]));
  assert.equal(s.Delivery, "Behind: 5 activities are late");
  assert.equal(s.Indicators, "1 of 2 indicators has a recorded value.");
  assert.equal(s.Reports, "1 report not finished yet.");
  assert.equal(s["Problems and risks"], "1 open, 1 serious.");
  assert.equal(s.Evidence, "7 files on record.");
});

test("an indicator with no recorded value is Not measured, never 0", () => {
  const rows = buildManagementReport(input()).find((s) => s.title === "Indicators").rows;
  assert.equal(rows[0][4], "4");
  assert.equal(rows[1][4], "Not measured");
  assert.equal(rows[1][6], "");
});

test("an empty project reads plainly instead of showing empty tables as problems", () => {
  const s = buildManagementReport(input({ indicators: [], periods: [], risks: [], evidence: { total: 0, byStatus: {} } }));
  const by = Object.fromEntries(s.map((x) => [x.title, x.summary]));
  assert.equal(by.Reports, "Every report is finished.");
  assert.equal(by["Problems and risks"], "Nothing is open.");
  assert.equal(by.Evidence, "0 files on record.");
});

test("the CSV keeps every section, escapes quotes and leaves a blank line between sections", () => {
  const csv = managementReportCsv(buildManagementReport(input()));
  assert.match(csv, /^Project\r?\n/);
  assert.ok(csv.includes('"Households, with ""quotes"""'));
  assert.equal(csv.split(/\r?\n\r?\n/).length, 6); // six sections, one blank line between each
  assert.ok(!/\bundefined\b/.test(csv));
  assert.ok(!csv.includes("REJECTED")); // a status with no files is not listed
});
