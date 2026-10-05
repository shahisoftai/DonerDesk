import assert from "node:assert/strict";
import test from "node:test";
import { ReportGenerationContextBuilder } from "../dist/index.js";

const tenantId = "t1";
const ok = (value) => ({ ok: true, value });
const period = { id: "p1", projectId: "pr1", reportType: "MONTHLY", scope: {}, duration: { start: new Date("2026-03-01"), end: new Date("2026-03-31") }, deadline: new Date("2026-04-10"), readinessScore: 0, storyContext: {}, daysUntilDeadline: () => 5, reportingProfileSnapshotJson: "{}" };
const project = { title: "P", projectCode: "C", donorName: "D", implementingOrganization: "O", country: "K", sector: "EDUCATION", duration: { start: new Date("2026-03-01"), end: new Date("2026-08-31") }, reportingFrequency: "MONTHLY" };
const activity = { id: "a1", activityTitle: "Drive", activityDate: new Date("2026-03-05"), summary: "s", achievements: "", challenges: "", lessonsLearned: "", nextSteps: "", attachedEvidenceIds: ["attached-1"], status: "ACCEPTED" };
const file = (id, over = {}) => ({ id, activityId: undefined, reportingPeriodId: undefined, verificationStatus: "VERIFIED", ...over });

function build(evidenceFiles) {
  let built;
  const builder = new ReportGenerationContextBuilder(
    { findById: async () => ok(period) },
    { findById: async () => ok(project) },
    {},
    {},
    { findByReportingPeriod: async () => ok([]) },
    { findByReportingPeriod: async () => ok([activity]), findByProject: async () => ok([activity]) },
    { computeFindings: async () => ok([]) },
    { build: async (input) => { built = input.evidenceIds; return ok([]); } },
    async () => ({}),
    undefined,
    evidenceFiles,
  );
  return { builder, ids: () => built };
}

test("verified evidence tagged to the period or an activity reaches the writer, not only attached evidence", async () => {
  const items = [file("tagged-period", { reportingPeriodId: "p1" }), file("tagged-activity", { activityId: "a1" }), file("elsewhere", { activityId: "other" })];
  const search = async (filter) => ok({ items: filter.reportingPeriodId ? items.filter((i) => i.reportingPeriodId === "p1") : items, total: items.length, page: 1, pageSize: 200 });
  const { builder, ids } = build({ search });
  const result = await builder.loadInputs({ tenant: { tenantId } }, "p1", { period, project });
  assert.equal(result.ok, true);
  assert.deepEqual([...ids()].sort(), ["attached-1", "tagged-activity", "tagged-period"]);
});

test("only verified evidence is searched for, and without the evidence repository only attached files are used", async () => {
  const filters = [];
  const search = async (filter) => { filters.push(filter); return ok({ items: [], total: 0, page: 1, pageSize: 200 }); };
  await build({ search }).builder.loadInputs({ tenant: { tenantId } }, "p1", { period, project });
  assert.ok(filters.length > 0 && filters.every((f) => f.verificationStatus === "VERIFIED"));
  const none = build(undefined);
  await none.builder.loadInputs({ tenant: { tenantId } }, "p1", { period, project });
  assert.deepEqual(none.ids(), ["attached-1"]);
});
