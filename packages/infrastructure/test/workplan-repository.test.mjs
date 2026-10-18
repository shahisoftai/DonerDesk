// Repository round-trip on a scratch Postgres. Opt-in: set WORKPLAN_VERIFY_DATABASE_URL to a throwaway database that has
// had `prisma migrate deploy` run (see the scratch-DB note). Foreign keys are relaxed inside the transaction (superuser).
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PlannedActivity, Project, TenantId } from "@donordesk/domain";
import { PrismaProjectRepository } from "../dist/repositories/projects.js";
import { PrismaPlannedActivityRepository, PrismaPlanRevisionRepository, PrismaPlanContextReader, PrismaDeliveryFactsReader, PrismaMemberDirectory, PrismaMyWeekReader } from "../dist/repositories/workplan.js";

const url = process.env.WORKPLAN_VERIFY_DATABASE_URL;
const skip = url ? false : "WORKPLAN_VERIFY_DATABASE_URL not set";
const T = TenantId.create("tenant-wp");

async function inRollback(prisma, work) {
  const sentinel = new Error("rollback");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
      await work(tx);
      throw sentinel;
    });
  } catch (e) { if (e !== sentinel) throw e; }
}

// An omitted key and a key set to undefined mean the same thing.
const plain = (x) => JSON.parse(JSON.stringify(x));
const make = (extra = {}) => PlannedActivity.create({ id: "pa1", tenantId: "tenant-wp", projectId: "p1", title: "Outreach", plannedStart: "2026-03-10", plannedEnd: "2026-03-12", createdById: "u1", ...extra }).value;

test("planned activities round-trip every field, including clearing optional ones", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const repo = new PrismaPlannedActivityRepository(tx);
      const item = make({ location: "Ward 4", description: "Door to door", logframeActivityId: "n1", outputId: "o1", targetParticipants: 30, targetCount: 4, requiredFiles: ["ATTENDANCE_SHEET", "PHOTO"], people: { ownerUserId: "u2", supportUserIds: ["u3"] }, seriesId: "s1", recurrence: { every: "MONTH", interval: 1, until: "2026-12-31" } });
      await repo.create(item);
      const back = (await repo.findById("pa1", T)).value;
      assert.deepEqual(plain(back.snapshot()), plain(item.snapshot()));
      assert.equal(back.kind, "ACTIVITY");

      // every mutable field persists
      item.reschedule({ start: "2026-03-11", end: "2026-03-13" }, { today: "2026-03-01", reportUsesIt: false });
      item.assign({ ownerUserId: "u4", supportUserIds: [] });
      item.setRequiredFiles(["PHOTO"]);
      item.updateDetails({ title: "Renamed", description: "x", location: undefined, targetCount: 5, targetParticipants: undefined }, { today: "2026-03-01", reportUsesIt: false });
      item.applyStatus("CANCEL", { at: new Date("2026-03-02T10:00:00Z"), reason: "Funding cut" });
      await repo.update(item);
      const changed = (await repo.findById("pa1", T)).value;
      assert.deepEqual(plain(changed.snapshot()), plain(item.snapshot()));
      assert.equal(changed.snapshot().location, undefined, "cleared");
      assert.deepEqual(changed.snapshot().requiredFiles, ["PHOTO"], "the list of files we will need persists");
      assert.equal(changed.snapshot().targetParticipants, undefined, "cleared");
      assert.equal(changed.originalStart, "2026-03-10", "original dates never move");
      item.applyStatus("RESTORE", { at: new Date() });
      await repo.update(item);
      const restored = (await repo.findById("pa1", T)).value.snapshot();
      assert.equal(restored.statusReason, undefined);
      assert.equal(restored.cancelledAt, undefined);

      assert.equal((await repo.findById("pa1", TenantId.create("other-tenant"))).value, null, "tenant scoped");
      await repo.createMany([make({ id: "pa2", seriesId: "s1" }), make({ id: "pa3", seriesId: "s1", plannedStart: "2026-04-10", plannedEnd: "2026-04-10" })]);
      assert.equal((await repo.findBySeries("s1", T)).value.length, 3);
      assert.equal((await repo.findByProject("p1", T)).value.length, 3);
    });
  } finally { await prisma.$disconnect(); }
});

test("revisions append and read back newest-first per project", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const repo = new PrismaPlanRevisionRepository(tx);
      const rev = (id, at, reason) => ({ id, tenantId: "tenant-wp", projectId: "p1", plannedActivityId: "pa1", change: { plannedEnd: { from: "a", to: "b" } }, ...(reason ? { reason } : {}), changedById: "u1", changedAt: new Date(at) });
      await repo.append(rev("r1", "2026-03-01T00:00:00Z"));
      await repo.append(rev("r2", "2026-03-02T00:00:00Z", "Floods"));
      assert.deepEqual((await repo.findByPlannedActivity("pa1", T)).value.map((r) => r.id), ["r1", "r2"]);
      const recent = (await repo.findRecentByProject("p1", T, 1)).value;
      assert.equal(recent[0].id, "r2");
      assert.equal(recent[0].reason, "Floods");
      assert.equal("reason" in (await repo.findByPlannedActivity("pa1", T)).value[0], false);
    });
  } finally { await prisma.$disconnect(); }
});

test("delivery facts count live completed activities per planned activity and leave withdrawn ones out", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const row = (id, status, date, plannedActivityId = "pa1") => tx.activityUpdate.create({ data: { id, tenantId: "tenant-wp", projectId: "p1", reportingPeriodId: "rp", activityTitle: "V", activityDate: new Date(date), summary: "s", status, submittedById: "u1", plannedActivityId } });
      await row("a1", "ACCEPTED", "2026-03-10");
      await row("a2", "SUBMITTED", "2026-03-12");
      await row("a3", "WITHDRAWN", "2026-03-11");
      await row("a4", "ACCEPTED", "2026-03-11", null);
      const file = (id, activityId, evidenceType) => tx.evidenceFile.create({ data: { id, tenantId: "tenant-wp", projectId: "p1", title: id, fileName: id, fileType: "x", fileSize: 1, fileUrl: "u", evidenceType, uploadedById: "u1", activityId } });
      await file("f1", "a1", "PHOTO"); await file("f2", "a2", "PHOTO"); await file("f3", "a3", "ATTENDANCE_SHEET"); await file("f4", "a4", "DISTRIBUTION_LIST");
      const facts = (await new PrismaDeliveryFactsReader(tx).factsByPlannedActivity("p1", T)).value;
      assert.deepEqual(facts.get("pa1"), { liveRecords: 2, acceptedRecords: 1, deliveredCount: 1, firstRecordDate: "2026-03-10", lastRecordDate: "2026-03-12", evidenceTypes: ["PHOTO"] }, "kinds of file on its live completed activities only: not the withdrawn one, not an unlinked one");
      assert.equal(facts.size, 1);
    });
  } finally { await prisma.$disconnect(); }
});

test("row level security isolates tenants for the app role", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      await new PrismaPlannedActivityRepository(tx).create(make());
      await tx.$executeRawUnsafe("SET LOCAL ROLE donordesk_app");
      await tx.$executeRawUnsafe("SELECT set_config('app.current_tenant', 'tenant-wp', true)");
      assert.equal((await tx.plannedActivity.count()), 1);
      await tx.$executeRawUnsafe("SELECT set_config('app.current_tenant', 'someone-else', true)");
      assert.equal((await tx.plannedActivity.count()), 0);
      await tx.$executeRawUnsafe("SELECT set_config('app.current_tenant', 'tenant-wp', true)");
      assert.equal((await tx.planRevision.count()), 0);
    });
  } finally { await prisma.$disconnect(); }
});

test("the plan context reader lists active members only", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const member = (id, userId, status) => tx.projectMember.create({ data: { id, tenantId: "tenant-wp", projectId: "p1", userId, role: "FIELD_OFFICER", status, assignedById: "u0", assignedAt: new Date() } });
      await member("m1", "u1", "ACTIVE");
      await member("m2", "u2", "REMOVED");
      const set = (await new PrismaPlanContextReader(tx).activeMemberIds("p1", T)).value;
      assert.deepEqual([...set], ["u1"]);
    });
  } finally { await prisma.$disconnect(); }
});

test("report-covered ranges are the non-cancelled periods that have a draft", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const period = (id, start, end, cancelledAt = null) => tx.reportingPeriod.create({ data: { id, tenantId: "tenant-wp", projectId: "p1", reportType: "QUARTERLY", startDate: new Date(start), endDate: new Date(end), deadline: new Date(end), cancelledAt } });
      await period("rp1", "2026-01-01", "2026-03-31");
      await period("rp2", "2026-04-01", "2026-06-30");
      await period("rp3", "2026-07-01", "2026-09-30", new Date());
      for (const [id, rp] of [["d1", "rp1"], ["d3", "rp3"]]) await tx.reportDraft.create({ data: { id, tenantId: "tenant-wp", projectId: "p1", reportingPeriodId: rp, title: id, createdById: "u0" } });
      const reader = new PrismaPlanContextReader(tx);
      assert.deepEqual((await reader.reportCoveredRanges("p1", T)).value, [{ start: "2026-01-01", end: "2026-03-31" }]);
      assert.equal((await reader.reportUsesDates("p1", T, { start: "2026-03-01", end: "2026-03-05" })).value, true);
      assert.equal((await reader.reportUsesDates("p1", T, { start: "2026-05-01", end: "2026-05-05" })).value, false, "a period without a draft does not count");
    });
  } finally { await prisma.$disconnect(); }
});

test("the member directory maps active members' emails to user ids", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      await tx.user.create({ data: { id: "u1", tenantId: "tenant-wp", email: "Amina@Org.org", name: "Amina", passwordHash: "x", role: "FIELD_OFFICER" } });
      await tx.user.create({ data: { id: "u2", tenantId: "tenant-wp", email: "gone@org.org", name: "Gone", passwordHash: "x", role: "FIELD_OFFICER" } });
      const member = (id, userId, status) => tx.projectMember.create({ data: { id, tenantId: "tenant-wp", projectId: "p1", userId, role: "FIELD_OFFICER", status, assignedById: "u0", assignedAt: new Date() } });
      await member("m1", "u1", "ACTIVE");
      await member("m2", "u2", "REMOVED");
      const map = (await new PrismaMemberDirectory(tx).activeUserIdsByEmail("p1", T)).value;
      assert.deepEqual([...map], [["amina@org.org", "u1"]]);
    });
  } finally { await prisma.$disconnect(); }
});

test("the 'Show work planning' setting is stored with the project and defaults to shown", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const repo = new PrismaProjectRepository(tx);
      const project = Project.create({ id: "pj1", tenantId: T, props: { title: "Clinics", projectCode: "C-1", donorName: "Donor", implementingOrganization: "Org", country: "KE", sector: "HEALTH", reportingFrequency: "QUARTERLY", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31") } });
      await repo.create(project);
      assert.equal((await repo.findById("pj1", T)).value.showWorkPlanning, true, "shown by default");
      project.setWorkPlanningVisible(false);
      await repo.update(project);
      assert.equal((await repo.findById("pj1", T)).value.showWorkPlanning, false);
      project.setWorkPlanningVisible(true);
      await repo.update(project);
      assert.equal((await repo.findById("pj1", T)).value.showWorkPlanning, true, "turning it back on is stored too");
    });
  } finally { await prisma.$disconnect(); }
});

test("my week: only the person's own open activities (lead or helper) in projects that show the plan, and what was sent back", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      const project = (id, title, showWorkPlanning = true) => tx.project.create({ data: { id, tenantId: "tenant-wp", title, projectCode: id, donorName: "d", implementingOrganization: "o", country: "KE", sector: "HEALTH", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), reportingFrequency: "QUARTERLY", showWorkPlanning } });
      await project("p1", "Clinics");
      await project("p2", "Hidden plan", false);
      const repo = new PrismaPlannedActivityRepository(tx);
      const mk = (id, projectId, extra = {}) => make({ id, projectId, ...extra });
      await repo.createMany([
        mk("own", "p1", { people: { ownerUserId: "u1", supportUserIds: [] } }),
        mk("helper", "p1", { people: { ownerUserId: "u2", supportUserIds: ["u1"] } }),
        mk("other", "p1", { people: { ownerUserId: "u2", supportUserIds: ["u10"] } }),
        mk("later", "p1", { plannedStart: "2026-06-01", plannedEnd: "2026-06-02", people: { ownerUserId: "u1", supportUserIds: [] } }),
        mk("hidden", "p2", { people: { ownerUserId: "u1", supportUserIds: [] } }),
        mk("done", "p1", { people: { ownerUserId: "u1", supportUserIds: [] } }),
      ]);
      const done = (await repo.findById("done", T)).value;
      done.applyStatus("COMPLETE", { at: new Date() });
      await repo.update(done);

      const reader = new PrismaMyWeekReader(tx);
      const open = (await reader.openPlannedFor("u1", T, "2026-03-22")).value;
      assert.deepEqual(open.map((o) => o.item.id).sort(), ["helper", "own"], "u10 is not u1; later, done and hidden-plan ones are left out");
      assert.equal(open[0].projectTitle, "Clinics");

      const row = (id, status, by) => tx.activityUpdate.create({ data: { id, tenantId: "tenant-wp", projectId: "p1", reportingPeriodId: "rp", activityTitle: id, activityDate: new Date("2026-03-02"), summary: "s", status, submittedById: by } });
      await row("sb1", "NEEDS_REVISION", "u1");
      await row("sb2", "REJECTED", "u1");
      await row("ok", "ACCEPTED", "u1");
      await row("theirs", "NEEDS_REVISION", "u2");
      const back = (await reader.sentBackFor("u1", T)).value;
      assert.deepEqual(back.map((b) => b.id).sort(), ["sb1", "sb2"]);
      assert.deepEqual(back.find((b) => b.id === "sb1"), { id: "sb1", projectId: "p1", projectTitle: "Clinics", title: "sb1", activityDate: "2026-03-02", status: "NEEDS_REVISION" });
    });
  } finally { await prisma.$disconnect(); }
});
