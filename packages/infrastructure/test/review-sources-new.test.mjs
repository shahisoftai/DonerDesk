import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { ValueReviewAssignmentSource, RecordReviewAssignmentSource } from "../dist/assignment-sources/review-sources.js";
import { assignmentSourceContract } from "../../application/test/support/assignment-source-contract.mjs";

/**
 * The two review sources Phase 44's Data inbox reads, run against the same contract as every other source, over a hand-made
 * database. (The sources that read the real database are checked in tasks-repository.test.mjs when a scratch database is set.)
 */
const T = TenantId.create("tenant-x");
const query = { tenantId: T, today: "2026-03-10", assigneeId: "u1" };

function fake({ values = [], groups = [], role = "ADMIN" } = {}) {
  const seen = { permission: [], where: [] };
  return {
    seen,
    user: { findFirst: async () => ({ role }) },
    projectMember: { findMany: async () => [] },
    project: { findMany: async (args) => (args.select?.title ? [{ id: "p1", title: "Borno WASH" }] : [{ id: "p1" }]) },
    indicatorUpdate: { findMany: async (args) => { seen.where.push(args.where); return values; } },
    collectionRecord: { groupBy: async (args) => { seen.where.push(args.where); return groups; } },
    collectionForm: { findMany: async () => [{ id: "f1", name: "Household visit" }] },
  };
}
const valueRow = { id: "u-1", periodAchievement: "320", reportingPeriodId: "per-1", indicator: { code: "WS-1", name: "People", projectId: "p1", project: { title: "Borno WASH" } } };
const group = { formId: "f1", projectId: "p1", _count: { _all: 6 } };

assignmentSourceContract(test, "VALUE_REVIEW", {
  make: async () => ({ source: new ValueReviewAssignmentSource(fake({ values: [valueRow] })), query }),
  makeEmpty: async () => ({ source: new ValueReviewAssignmentSource(fake()), query }),
});
assignmentSourceContract(test, "RECORD_REVIEW", {
  make: async () => ({ source: new RecordReviewAssignmentSource(fake({ groups: [group] })), query }),
  makeEmpty: async () => ({ source: new RecordReviewAssignmentSource(fake()), query }),
});

test("a number waiting to be verified names the indicator and the figure, and opens the period's sheet", async () => {
  const out = await new ValueReviewAssignmentSource(fake({ values: [valueRow] })).list(query);
  assert.deepEqual(out.value.map((a) => [a.key, a.title, a.href]), [["VALUE_REVIEW:u-1", "WS-1: 320", "/projects/p1/reports/per-1/inputs?tab=indicators"]]);
});

test("only SUBMITTED numbers are asked for, and only in projects the person may verify in", async () => {
  const db = fake({ values: [valueRow] });
  await new ValueReviewAssignmentSource(db).list(query);
  assert.equal(db.seen.where[0].verificationStatus, "SUBMITTED");
  assert.deepEqual(db.seen.where[0].indicator, { projectId: { in: ["p1"] } });
});

test("a person who cannot verify anything anywhere gets nothing, and the database is never asked for values", async () => {
  const db = { ...fake({ values: [valueRow], role: "VIEWER" }), project: { findMany: async () => [] } };
  const out = await new ValueReviewAssignmentSource(db).list(query);
  assert.deepEqual(out.value, []);
  assert.deepEqual(db.seen.where, []);
});

test("records waiting are one item per form, with the count, opening the form", async () => {
  const out = await new RecordReviewAssignmentSource(fake({ groups: [group] })).list(query);
  assert.deepEqual(out.value.map((a) => [a.key, a.title, a.href]), [["RECORD_REVIEW:f1", "Household visit · 6", "/projects/p1/forms/f1"]]);
});

test("only PENDING records are counted", async () => {
  const db = fake({ groups: [group] });
  await new RecordReviewAssignmentSource(db).list(query);
  assert.equal(db.seen.where[0].status, "PENDING");
});

test("a team query (no person named) returns nothing: these are role-based", async () => {
  assert.deepEqual((await new ValueReviewAssignmentSource(fake({ values: [valueRow] })).list({ ...query, assigneeId: undefined })).value, []);
  assert.deepEqual((await new RecordReviewAssignmentSource(fake({ groups: [group] })).list({ ...query, assigneeId: undefined })).value, []);
});
