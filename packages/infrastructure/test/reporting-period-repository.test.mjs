import assert from "node:assert/strict";
import test from "node:test";
import { PrismaReportingPeriodRepository } from "../dist/repositories/reporting.js";
import { ReportingPeriod, TenantId } from "@donordesk/domain";

const tenant = TenantId.create("tenant-a");

function row(id, reportType, start, scope = {}) {
  return {
    id, tenantId: "tenant-a", projectId: "proj", donorTemplateId: null, donorTemplateVersion: null, donorTemplateMappingId: null,
    reportType, startDate: new Date(start), endDate: new Date(start), deadline: new Date(start), internalReviewDeadline: null,
    status: "NOT_STARTED", readinessScore: 0, responsibleOfficerId: null, reportingProfileSnapshotJson: "{}", templateSnapshotJson: "{}",
    storyContextJson: "{}", scopeJson: JSON.stringify(scope), createdAt: new Date(start), updatedAt: new Date(start),
  };
}

function fakePrisma(rows) {
  const calls = { updates: [], finds: [] };
  return {
    calls,
    reportingPeriod: {
      update: async (args) => (calls.updates.push(args), {}),
      findFirst: async () => ({ startDate: new Date("2028-07-01") }),
      findMany: async (args) => (calls.finds.push(args), rows),
    },
  };
}

test("update persists the scope", async () => {
  const prisma = fakePrisma([]);
  const period = ReportingPeriod.rehydrate({ id: "p1", tenantId: "tenant-a", projectId: "proj", createdAt: new Date(), props: {
    reportType: "ACTIVITY", duration: { start: new Date("2028-05-01"), end: new Date("2028-05-02"), overlaps: () => false }, deadline: new Date("2028-05-09"),
    status: { toString: () => "NOT_STARTED" }, readinessScore: 0, reportingProfileSnapshotJson: "{}", templateSnapshotJson: "{}", scopeJson: "{}",
  } });
  period.setScope({ activityIds: ["a1", "a2"] });
  await new PrismaReportingPeriodRepository(prisma).update(period);
  assert.equal(prisma.calls.updates[0].data.scopeJson, JSON.stringify({ activityIds: ["a1", "a2"] }));
});

test("findPreviousPeriods filters by report type in the query and keeps the default limit semantics", async () => {
  const prisma = fakePrisma([row("a", "QUARTERLY", "2028-04-01"), row("b", "QUARTERLY", "2028-01-01")]);
  const repo = new PrismaReportingPeriodRepository(prisma);
  const result = await repo.findPreviousPeriods("proj", "cur", tenant, 4, { reportTypes: ["QUARTERLY", "SEMI_ANNUAL"] });
  assert.deepEqual(result.value.map((p) => p.id), ["a", "b"]);
  const where = prisma.calls.finds[0].where;
  assert.deepEqual(where.reportType, { in: ["QUARTERLY", "SEMI_ANNUAL"] });
  assert.equal(prisma.calls.finds[0].take, 4);

  await repo.findPreviousPeriods("proj", "cur", tenant);
  assert.equal("reportType" in prisma.calls.finds[1].where, false, "no filter: every earlier period, as before");
  assert.equal(prisma.calls.finds[1].take, 4);
});

test("findPreviousPeriods narrows to one situation event and applies the limit afterwards", async () => {
  const rows = [
    row("s3", "SITUATION", "2028-06-01", { eventName: "Flood", situationDate: "2028-06-01" }),
    row("x", "SITUATION", "2028-05-20", { eventName: "Drought" }),
    row("s2", "SITUATION", "2028-05-01", { eventName: "  flood " }),
    row("s1", "SITUATION", "2028-04-01", { eventName: "FLOOD" }),
  ];
  const prisma = fakePrisma(rows);
  const result = await new PrismaReportingPeriodRepository(prisma).findPreviousPeriods("proj", "cur", tenant, 2, { reportTypes: ["SITUATION"], eventKey: "flood" });
  assert.deepEqual(result.value.map((p) => p.id), ["s3", "s2"]);
  assert.ok(prisma.calls.finds[0].take >= 50, "a wider window is read so the event filter cannot starve the limit");
});

test("limit is clamped to 1..20", async () => {
  const prisma = fakePrisma([]);
  const repo = new PrismaReportingPeriodRepository(prisma);
  await repo.findPreviousPeriods("proj", "cur", tenant, 500);
  await repo.findPreviousPeriods("proj", "cur", tenant, 0);
  assert.deepEqual(prisma.calls.finds.map((f) => f.take), [20, 1]);
});
