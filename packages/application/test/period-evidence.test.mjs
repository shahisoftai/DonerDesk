import assert from "node:assert/strict";
import test from "node:test";
import { RecordChunkBuilder } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const period = { id: "p1", projectId: "pr1", reportType: "MONTHLY", scope: {}, duration: { start: new Date("2026-03-01"), end: new Date("2026-03-31") } };
const activity = { id: "a1", attachedEvidenceIds: ["attached-act"], status: "ACCEPTED" };
const files = [
  { id: "tagged-period", reportingPeriodId: "p1", activityId: undefined },
  { id: "tagged-act", reportingPeriodId: undefined, activityId: "a1" },
  { id: "elsewhere", reportingPeriodId: undefined, activityId: "other" },
];
const evidence = { search: async (f) => ok({ items: f.reportingPeriodId ? files.filter((x) => x.reportingPeriodId === "p1") : files, total: 3, page: 1, pageSize: 200 }) };
const builder = (ev) => new RecordChunkBuilder(
  { findById: async () => ok(period) },
  {},
  { findByReportingPeriod: async () => ok([activity]), findByProject: async () => ok([activity]) },
  {},
  { findByReportingPeriod: async () => ok([{ attachedEvidenceIds: ["attached-upd"] }]) },
  ev,
);

test("a re-assessment verifies against the period's evidence: attached to a record, or verified and tagged to the period or an activity", async () => {
  const r = await builder(evidence).evidenceIds({ tenantId: "t", projectId: "pr1", reportingPeriodId: "p1" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.sort(), ["attached-act", "attached-upd", "tagged-act", "tagged-period"]);
});

test("without the evidence repository only attached evidence counts", async () => {
  const r = await builder(undefined).evidenceIds({ tenantId: "t", projectId: "pr1", reportingPeriodId: "p1" });
  assert.deepEqual(r.value.sort(), ["attached-act", "attached-upd"]);
});
