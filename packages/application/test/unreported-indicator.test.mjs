import assert from "node:assert/strict";
import test from "node:test";
import { ReportGenerationContextBuilder } from "../dist/index.js";

const tenantId = "t1";
const ok = (value) => ({ ok: true, value });
const period = { id: "p1", projectId: "pr1", reportType: "MONTHLY", scope: {}, duration: { start: new Date("2026-03-01"), end: new Date("2026-03-31") }, deadline: new Date("2026-04-10"), readinessScore: 0, storyContext: {}, daysUntilDeadline: () => 5, reportingProfileSnapshotJson: "{}" };
const project = { title: "P", projectCode: "C", donorName: "D", implementingOrganization: "O", country: "K", sector: "HEALTH", duration: { start: new Date("2026-03-01"), end: new Date("2026-08-31") }, reportingFrequency: "MONTHLY" };
const finding = (indicatorId, over = {}) => ({ indicatorId, indicatorCode: indicatorId.toUpperCase(), indicatorName: indicatorId, value: "0", status: "REPORTED", qualityFlags: [], ...over });
const update = (indicatorId) => ({ indicatorId, periodAchievement: "5", cumulativeAchievement: "5", attachedEvidenceIds: [], verificationStatus: "VERIFIED" });

function build(findings, updates) {
  return new ReportGenerationContextBuilder(
    { findById: async () => ok(period) }, { findById: async () => ok(project) }, {}, {},
    { findByReportingPeriod: async () => ok(updates) },
    { findByReportingPeriod: async () => ok([]), findByProject: async () => ok([]) },
    { computeFindings: async () => ok(findings) },
    { build: async () => ok([]) },
    async () => ({}),
  );
}

test("an indicator with no value for the period (or only unverified values) is not handed to the writer as a result of 0", async () => {
  const builder = build([finding("measured"), finding("never-measured", { status: "NOT_MEASURED" }), finding("unverified", { status: "UNVERIFIED" })], [update("measured")]);
  const r = await builder.loadInputs({ tenant: { tenantId } }, "p1", { period, project });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.verifiedFindings.map((f) => f.indicatorId), ["measured"]);
});

test("an unmeasured indicator with a life-of-project figure stays (roll-up reports)", async () => {
  const builder = build([finding("never-measured", { status: "REPORTED", lifeOfProject: { value: "44" } })], []);
  const r = await builder.loadInputs({ tenant: { tenantId } }, "p1", { period, project });
  assert.equal(r.ok, true);
  assert.equal(r.value.verifiedFindings.length, 1);
});
