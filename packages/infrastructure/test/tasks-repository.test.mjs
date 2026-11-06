// Request repositories and every Prisma assignment source, on a scratch Postgres. Opt-in: WORKPLAN_VERIFY_DATABASE_URL
// (a throwaway database with `prisma migrate deploy` and infra/postgres/rls.sql applied). Foreign keys are relaxed in the transaction.
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PlannedActivity, ProjectTask, TenantId } from "@donordesk/domain";
import { PrismaProjectTaskRepository, PrismaTaskSubjectResolver, PrismaTaskFactsReader, PrismaProjectRoster, projectsWithPermission } from "../dist/repositories/tasks.js";
import { PrismaPlannedActivityRepository } from "../dist/repositories/workplan.js";
import { TaskAssignmentSource } from "../dist/assignment-sources/task-source.js";
import { PlanItemAssignmentSource } from "../dist/assignment-sources/plan-item-source.js";
import { ChecklistAssignmentSource } from "../dist/assignment-sources/checklist-source.js";
import { ReportDeadlineAssignmentSource } from "../dist/assignment-sources/report-deadline-source.js";
import { EvidenceReviewAssignmentSource, ActivityReviewAssignmentSource, ActivityFixAssignmentSource } from "../dist/assignment-sources/review-sources.js";
import { IndicatorValueAssignmentSource } from "../dist/assignment-sources/indicator-value-source.js";
import { PrismaCollectionFactsReader, PrismaRiskTrendStore } from "../dist/repositories/health.js";
import { RiskReviewAssignmentSource } from "../dist/assignment-sources/risk-review-source.js";
import { PrismaProjectRiskRepository } from "../dist/repositories/risks.js";
import { ProjectRisk } from "@donordesk/domain";
import { assignmentSourceContract } from "../../application/test/support/assignment-source-contract.mjs";

const url = process.env.WORKPLAN_VERIFY_DATABASE_URL;
const skip = url ? false : "WORKPLAN_VERIFY_DATABASE_URL not set";
const T = TenantId.create("tenant-tk");
const TODAY = "2026-03-10";
const plain = (x) => JSON.parse(JSON.stringify(x));

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
const withDb = (fn) => async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try { await inRollback(prisma, fn); } finally { await prisma.$disconnect(); }
};

const mkTask = (extra = {}) => ProjectTask.create({ id: "t1", tenantId: "tenant-tk", kind: "OTHER", projectId: "p1", title: "Send the form", assigneeId: "u2", assignedById: "u1", dueDate: "2026-03-14", ...extra }).value;

test("requests round-trip every field and every change persists", { skip }, withDb(async (tx) => {
  const repo = new PrismaProjectTaskRepository(tx);
  const task = mkTask({ kind: "ENTER_INDICATOR_VALUE", subjectType: "indicator", subjectId: "i1", reportingPeriodId: "rp1", details: "Before Friday", urgent: true });
  await repo.create(task);
  assert.deepEqual(plain((await repo.findById("t1", T)).value.snapshot()), plain(task.snapshot()));
  assert.equal((await repo.findById("t1", TenantId.create("other-tenant"))).value, null, "tenant scoped");
  task.closeByData(new Date("2026-03-11T08:00:00Z"));
  await repo.update(task);
  const back = (await repo.findById("t1", T)).value;
  assert.deepEqual([back.status, back.snapshot().closedByData, back.snapshot().completedAt.toISOString()], ["DONE", true, "2026-03-11T08:00:00.000Z"]);
  assert.deepEqual((await repo.findOpenByAssignee("u2", T)).value, [], "closed ones are not open");
  const other = mkTask({ id: "t2" });
  await repo.create(other);
  assert.deepEqual((await repo.findOpenByAssignee("u2", T)).value.map((t) => t.id), ["t2"]);
  assert.deepEqual((await repo.findOpenByProject("p1", T)).value.map((t) => t.id), ["t2"]);
  other.complete("u2", new Date(), "Sent");
  await repo.update(other);
  assert.equal((await repo.findById("t2", T)).value.snapshot().completionNote, "Sent");
}));

test("the subject resolver reads title, project and end for each kind of subject", { skip }, withDb(async (tx) => {
  await new PrismaPlannedActivityRepository(tx).create(PlannedActivity.create({ id: "pa1", tenantId: "tenant-tk", projectId: "p1", title: "Outreach", plannedStart: "2026-03-10", plannedEnd: "2026-03-20", createdById: "u" }).value);
  await tx.activityUpdate.create({ data: { id: "au1", tenantId: "tenant-tk", projectId: "p1", reportingPeriodId: "rp", activityTitle: "Visit", activityDate: new Date("2026-03-02"), summary: "s", status: "SUBMITTED", submittedById: "u1" } });
  await tx.indicator.create({ data: { id: "i1", tenantId: "tenant-tk", projectId: "p1", logframeItemId: "l", code: "V-01", name: "Vaccinated", type: "NUMBER", baseline: "0", target: "10" } });
  const r = new PrismaTaskSubjectResolver(tx);
  assert.deepEqual((await r.resolve("plannedActivity", "pa1", T)).value, { projectId: "p1", title: "Outreach", end: "2026-03-20" });
  assert.deepEqual((await r.resolve("activityUpdate", "au1", T)).value, { projectId: "p1", title: "Visit" });
  assert.deepEqual((await r.resolve("indicator", "i1", T)).value, { projectId: "p1", title: "V-01 Vaccinated" });
  assert.equal((await r.resolve("indicator", "nope", T)).value, null);
  assert.equal((await r.resolve("indicator", "i1", TenantId.create("other-tenant"))).value, null);
}));

test("facts: each kind closes only on what it asks for, and only on things added since the request", { skip }, withDb(async (tx) => {
  const repo = new PrismaProjectTaskRepository(tx);
  const facts = new PrismaTaskFactsReader(tx);
  const long = new Date("2020-01-01T00:00:00Z");
  const act = (id, plannedActivityId, status = "SUBMITTED", createdAt = new Date()) => tx.activityUpdate.create({ data: { id, tenantId: "tenant-tk", projectId: "p1", reportingPeriodId: "rp", activityTitle: id, activityDate: new Date("2026-03-02"), summary: "s", status, submittedById: "u2", plannedActivityId, createdAt } });
  const file = (id, extra, createdAt = new Date()) => tx.evidenceFile.create({ data: { id, tenantId: "tenant-tk", projectId: "p1", title: id, fileName: id, fileType: "x", fileSize: 1, fileUrl: "u", evidenceType: "PHOTO", uploadedById: "u2", createdAt, ...extra } });

  const record = mkTask({ id: "rec", kind: "RECORD_ACTIVITY", subjectType: "plannedActivity", subjectId: "pa1" });
  const fileForPlan = mkTask({ id: "fpl", kind: "PROVIDE_EVIDENCE", subjectType: "plannedActivity", subjectId: "pa1" });
  const fileForAct = mkTask({ id: "fac", kind: "PROVIDE_EVIDENCE", subjectType: "activityUpdate", subjectId: "au-x" });
  const value = mkTask({ id: "val", kind: "ENTER_INDICATOR_VALUE", subjectType: "indicator", subjectId: "i1", reportingPeriodId: "rp1" });
  const review = mkTask({ id: "rev", kind: "REVIEW_RECORD", subjectType: "activityUpdate", subjectId: "au-r" });
  const free = mkTask({ id: "free" });
  const all = [record, fileForPlan, fileForAct, value, review, free];
  for (const t of all) await repo.create(t);
  const met = async () => [...(await facts.satisfiedIds(all, T)).value].sort();

  assert.deepEqual(await met(), [], "nothing met yet");
  await act("old", "pa1", "SUBMITTED", long);
  assert.deepEqual(await met(), [], "a completed activity from before the request does not meet it");
  await act("new", "pa1");
  assert.deepEqual(await met(), ["rec"]);
  await file("f-old", { activityId: "new" }, long);
  assert.deepEqual(await met(), ["rec"], "an old file does not meet a request for a file");
  await file("f1", { activityId: "new" });
  assert.deepEqual(await met(), ["fpl", "rec"], "a file on a completed activity of the planned activity");
  await file("f2", { activityId: "au-x" });
  await tx.indicatorUpdate.create({ data: { id: "iu1", tenantId: "tenant-tk", indicatorId: "i1", reportingPeriodId: "rp1", periodAchievement: "5", cumulativeAchievement: "5", createdById: "u2" } });
  await act("au-r", undefined, "SUBMITTED");
  const afterValue = await met();
  assert.deepEqual(afterValue, ["fac", "fpl", "rec", "val"], "a review is not met while the activity is still submitted");
  await tx.activityUpdate.update({ where: { id: "au-r" }, data: { status: "ACCEPTED" } });
  assert.deepEqual(await met(), ["fac", "fpl", "rec", "rev", "val"]);
  assert.equal((await met()).includes("free"), false, "a free request is never met by data");
}));

test("the roster lists active members with their project role; access follows the role", { skip }, withDb(async (tx) => {
  await tx.user.create({ data: { id: "admin1", tenantId: "tenant-tk", email: "a@x.org", name: "Admin", passwordHash: "x", role: "ADMIN" } });
  await tx.user.create({ data: { id: "pm1", tenantId: "tenant-tk", email: "p@x.org", name: "PM", passwordHash: "x", role: "PROJECT_MANAGER" } });
  await tx.user.create({ data: { id: "fo1", tenantId: "tenant-tk", email: "f@x.org", name: "FO", passwordHash: "x", role: "FIELD_OFFICER" } });
  const project = (id) => tx.project.create({ data: { id, tenantId: "tenant-tk", title: id, projectCode: id, donorName: "d", implementingOrganization: "o", country: "KE", sector: "HEALTH", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), reportingFrequency: "QUARTERLY" } });
  await project("p1"); await project("p2");
  const member = (id, userId, projectId, role, status = "ACTIVE") => tx.projectMember.create({ data: { id, tenantId: "tenant-tk", projectId, userId, role, status, assignedById: "x", assignedAt: new Date() } });
  await member("m1", "pm1", "p1", "PROJECT_MANAGER"); await member("m2", "fo1", "p1", "FIELD_OFFICER"); await member("m3", "fo1", "p2", "FIELD_OFFICER", "REMOVED");
  assert.deepEqual((await new PrismaProjectRoster(tx).activeMembers("p1", T)).value.map((m) => [m.userId, m.role]).sort(), [["fo1", "FIELD_OFFICER"], ["pm1", "PROJECT_MANAGER"]]);
  assert.deepEqual(await projectsWithPermission(tx, T, "admin1", "activity.approve"), ["p1", "p2"].sort((a, b) => a.localeCompare(b)).filter(Boolean), "an admin acts everywhere");
  assert.deepEqual(await projectsWithPermission(tx, T, "pm1", "activity.approve"), ["p1"]);
  assert.deepEqual(await projectsWithPermission(tx, T, "fo1", "activity.approve"), [], "a field officer cannot approve");
  assert.deepEqual(await projectsWithPermission(tx, T, "fo1", "activity.create"), ["p1"], "a removed membership grants nothing");
  assert.deepEqual(await projectsWithPermission(tx, T, "nobody", "activity.create"), []);
}));

// ---- Every Prisma assignment source passes the same contract. -----------------------------------------------------------
const seedWorld = async (tx) => {
  const q = { tenantId: T, today: TODAY, assigneeId: "u2" };
  await tx.user.create({ data: { id: "u2", tenantId: "tenant-tk", email: "u2@x.org", name: "U2", passwordHash: "x", role: "PROJECT_MANAGER" } });
  await tx.project.create({ data: { id: "p1", tenantId: "tenant-tk", title: "Clinics", projectCode: "C", donorName: "d", implementingOrganization: "o", country: "KE", sector: "HEALTH", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), reportingFrequency: "QUARTERLY", reportingOfficerId: "u2" } });
  await tx.projectMember.create({ data: { id: "m", tenantId: "tenant-tk", projectId: "p1", userId: "u2", role: "PROJECT_MANAGER", assignedById: "x", assignedAt: new Date() } });
  return q;
};

const seedIndicators = async (tx, tenant = "tenant-tk", project = "p1", owner = "u2") => {
  // "Today" in these tests is 10 March: January and February have ended, March is still running, December is closed.
  const period = (id, start, end, extra = {}) => tx.reportingPeriod.create({ data: { id: `${tenant}-${id}`, tenantId: tenant, projectId: project, reportType: "MONTHLY", startDate: new Date(start), endDate: new Date(end), deadline: new Date(end), ...extra } });
  await period("jan", "2026-01-01", "2026-01-31"); await period("feb", "2026-02-01", "2026-02-28"); await period("mar", "2026-03-01", "2026-03-31"); await period("dec", "2025-12-01", "2025-12-31", { status: "CLOSED" });
  const ind = (id, extra = {}) => tx.indicator.create({ data: { id: `${tenant}-${id}`, tenantId: tenant, projectId: project, logframeItemId: "l", code: id.toUpperCase(), name: `Indicator ${id}`, type: "NUMBER", baseline: "0", target: "10", frequency: "monthly", ...extra } });
  await ind("i1", { responsibleUserId: owner });      // January recorded, February missing: overdue
  await ind("i2", { responsibleUserId: owner });      // recorded for January and February
  await ind("i3", { responsibleUserId: owner, archivedAt: new Date() });
  const value = (indicator, period) => tx.indicatorUpdate.create({ data: { id: `${tenant}-iu-${indicator}-${period}`, tenantId: tenant, indicatorId: `${tenant}-${indicator}`, reportingPeriodId: `${tenant}-${period}`, periodAchievement: "5", cumulativeAchievement: "5", createdById: "x" } });
  await value("i1", "jan"); await value("i2", "jan"); await value("i2", "feb");
};

const seedRisks = async (tx, tenant = "tenant-tk", project = "p1") => {
  const repo = new PrismaProjectRiskRepository(tx);
  const mk = (id, extra = {}) => ProjectRisk.create({ id: tenant === "tenant-tk" ? id : `${tenant}-${id}`, tenantId: tenant, projectId: project, kind: "PROBLEM", title: id, seriousness: "HIGH", action: "", raisedById: "u9", today: "2026-02-01", ownerId: "u2", ...extra }).value;
  await repo.create(mk("old-high"));                                          // review date 3 Mar: late on 10 Mar
  await repo.create(mk("new-high", { today: "2026-03-05" }));                 // review date 4 Apr: not late
  await repo.create(mk("medium", { seriousness: "MEDIUM" }));                 // no review date: not work
  await repo.create(mk("someone-elses", { ownerId: "u7" }));
  const closed = mk("closed"); closed.close("u2", "done", new Date()); await repo.create(closed);
};

const sources = {
  RISK_REVIEW: [(tx) => new RiskReviewAssignmentSource(tx), (tx) => seedRisks(tx)],
  INDICATOR_VALUE: [(tx) => new IndicatorValueAssignmentSource(new PrismaCollectionFactsReader(tx)), (tx) => seedIndicators(tx)],
  TASK: [(tx) => new TaskAssignmentSource(tx), async (tx) => {
    const repo = new PrismaProjectTaskRepository(tx);
    await repo.create(mkTask({ id: "t-late", dueDate: "2026-03-01" })); await repo.create(mkTask({ id: "t-soon", dueDate: "2026-03-20", urgent: true, kind: "RECORD_ACTIVITY", subjectType: "plannedActivity", subjectId: "pa1" }));
  }],
  PLAN_ITEM: [(tx) => new PlanItemAssignmentSource(tx), async (tx) => {
    const repo = new PrismaPlannedActivityRepository(tx);
    const mk = (id, start, end, people) => PlannedActivity.create({ id, tenantId: "tenant-tk", projectId: "p1", title: id, plannedStart: start, plannedEnd: end, createdById: "u", people }).value;
    await repo.createMany([mk("pa-late", "2026-02-01", "2026-02-05", { ownerUserId: "u2", supportUserIds: [] }), mk("pa-ok", "2026-04-01", "2026-04-05", { ownerUserId: "u9", supportUserIds: ["u2"] }), mk("pa-late-start", "2026-03-01", "2026-03-30", { ownerUserId: "u2", supportUserIds: [] })]);
  }],
  CHECKLIST_ITEM: [(tx) => new ChecklistAssignmentSource(tx), async (tx) => {
    await tx.reportingPeriod.create({ data: { id: "rp1", tenantId: "tenant-tk", projectId: "p1", reportType: "QUARTERLY", startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31"), deadline: new Date("2026-04-30") } });
    const item = (id, extra) => tx.checklistItem.create({ data: { id, tenantId: "tenant-tk", projectId: "p1", reportingPeriodId: "rp1", type: "ATTESTATION", title: id, severity: "HIGH", assignedToId: "u2", ...extra } });
    await item("c-late", { dueDate: new Date("2026-03-01") }); await item("c-open", {}); await item("c-done", { status: "RESOLVED" });
  }],
  REPORT_DEADLINE: [(tx) => new ReportDeadlineAssignmentSource(tx), async (tx) => {
    const period = (id, deadline, extra = {}) => tx.reportingPeriod.create({ data: { id, tenantId: "tenant-tk", projectId: "p1", reportType: "QUARTERLY", startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31"), deadline: new Date(deadline), ...extra } });
    await period("rp-late", "2026-03-01"); await period("rp-review", "2026-04-20", { internalReviewDeadline: new Date("2026-04-05") }); await period("rp-far", "2027-01-01"); await period("rp-done", "2026-03-02", { status: "APPROVED" });
  }],
  ACTIVITY_FIX: [(tx) => new ActivityFixAssignmentSource(tx), async (tx) => {
    const act = (id, status) => tx.activityUpdate.create({ data: { id, tenantId: "tenant-tk", projectId: "p1", reportingPeriodId: "rp", activityTitle: id, activityDate: new Date("2026-03-02"), summary: "s", status, submittedById: "u2" } });
    await act("a-back", "NEEDS_REVISION"); await act("a-draft", "DRAFT"); await act("a-ok", "ACCEPTED");
  }],
  EVIDENCE_REVIEW: [(tx) => new EvidenceReviewAssignmentSource(tx), async (tx) => {
    const file = (id, verificationStatus) => tx.evidenceFile.create({ data: { id, tenantId: "tenant-tk", projectId: "p1", title: id, fileName: id, fileType: "x", fileSize: 1, fileUrl: "u", evidenceType: "PHOTO", uploadedById: "u3", verificationStatus } });
    await file("e-new", "UPLOADED"); await file("e-tagged", "AI_TAGGED"); await file("e-ok", "VERIFIED");
  }],
  ACTIVITY_REVIEW: [(tx) => new ActivityReviewAssignmentSource(tx), async (tx) => {
    const act = (id, status) => tx.activityUpdate.create({ data: { id, tenantId: "tenant-tk", projectId: "p1", reportingPeriodId: "rp", activityTitle: id, activityDate: new Date("2026-03-02"), summary: "s", status, submittedById: "u3" } });
    await act("r-wait", "SUBMITTED"); await act("r-done", "ACCEPTED");
  }],
};

for (const [kind, [make, seed]] of Object.entries(sources)) {
  const lifecycle = async (fn) => {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    let result;
    try { await inRollback(prisma, async (tx) => { const query = await seedWorld(tx); await seed(tx); result = await fn(make(tx), query, tx); }); } finally { await prisma.$disconnect(); }
    return result;
  };
  // The contract helper wants a source it can call repeatedly; the world lives only inside one transaction, so each call
  // is wrapped to run inside a fresh seeded transaction.
  const wrapped = (source) => ({ kind: source.kind, list: (q) => lifecycle((s, base) => s.list({ ...base, ...q, assigneeId: "assigneeId" in q ? q.assigneeId : base.assigneeId })) });
  assignmentSourceContract(
    skip ? (name, fn) => test(name, { skip }, fn) : test, `prisma ${kind}`,
    {
      make: async () => ({ source: wrapped({ kind }), query: { tenantId: T, today: TODAY, assigneeId: "u2" } }),
      makeEmpty: async () => ({ source: { kind, list: async (q) => { const prisma = new PrismaClient({ datasources: { db: { url } } }); let out; try { await inRollback(prisma, async (tx) => { await seedWorld(tx); out = await make(tx).list({ ...q, assigneeId: "nobody-here" }); }); } finally { await prisma.$disconnect(); } return out; } }, query: { tenantId: T, today: TODAY, assigneeId: "nobody-here" } }),
    },
  );
}

test("what each source returns for the seeded world", { skip }, async () => {
  const keys = {};
  for (const [kind, [make, seed]] of Object.entries(sources)) {
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try { await inRollback(prisma, async (tx) => { const q = await seedWorld(tx); await seed(tx); const out = await make(tx).list(q); keys[kind] = out.value.map((a) => `${a.key.replace(`${kind}:`, "")}=${a.state}`).sort(); }); } finally { await prisma.$disconnect(); }
  }
  assert.deepEqual(keys.TASK, ["t-late=LATE", "t-soon=OPEN"]);
  assert.deepEqual(keys.PLAN_ITEM, ["pa-late-start:u2=LATE", "pa-late:u2=LATE", "pa-ok:u2=OPEN"], "a helper is listed too; a late start is late before its end date");
  assert.deepEqual(keys.CHECKLIST_ITEM, ["c-late=LATE", "c-open=OPEN"], "resolved items are not work");
  assert.deepEqual(keys.REPORT_DEADLINE, ["rp-late:donor=LATE", "rp-review:donor=OPEN", "rp-review:review=OPEN"], "finished reports and far-off deadlines are not work; the project's reporting officer owns an unowned report");
  assert.deepEqual(keys.ACTIVITY_FIX, ["a-back=OPEN", "a-draft=OPEN"]);
  assert.deepEqual(keys.EVIDENCE_REVIEW, ["e-new=OPEN", "e-tagged=OPEN"], "project manager may verify files");
  assert.deepEqual(keys.ACTIVITY_REVIEW, ["r-wait=OPEN"]);
  assert.deepEqual(keys.RISK_REVIEW, ["RISK_REVIEW:new-high=OPEN", "RISK_REVIEW:old-high=LATE"].map((k) => k.replace("RISK_REVIEW:", "")), "serious open ones with a review date; medium, closed and other people's are not this person's work");
  assert.deepEqual(keys.INDICATOR_VALUE, ["tenant-tk-i1:tenant-tk-feb=LATE"], "one value overdue; recorded, archived and still-running ones are not work; a closed period takes no values");
});

test("the collection reader: active projects, live indicators, open periods, recorded values, the profile's due days", { skip }, withDb(async (tx) => {
  await seedWorld(tx);
  await seedIndicators(tx);
  await tx.reportingProfile.create({ data: { id: "rpf", tenantId: "tenant-tk", projectId: "p1", createdById: "u", updatedById: "u", indicatorEntryDueDays: 9 } });
  const facts = (await new PrismaCollectionFactsReader(tx).forProjects(T)).value;
  assert.equal(facts.length, 1);
  const f = facts[0];
  assert.deepEqual([f.projectId, f.projectTitle, f.projectStart, f.dueDays], ["p1", "Clinics", "2026-01-01", 9]);
  assert.deepEqual(f.indicators.map((i) => i.code).sort(), ["I1", "I2"], "the archived indicator is left out");
  assert.deepEqual(f.periods.map((p) => p.id).sort(), ["tenant-tk-feb", "tenant-tk-jan", "tenant-tk-mar"], "a closed period is left out");
  assert.deepEqual([...f.recorded].sort(), ["tenant-tk-i1|tenant-tk-jan", "tenant-tk-i2|tenant-tk-feb", "tenant-tk-i2|tenant-tk-jan"]);
  assert.deepEqual((await new PrismaCollectionFactsReader(tx).forProjects(T, ["nope"])).value, []);
  assert.equal((await new PrismaCollectionFactsReader(tx).forProjects(TenantId.create("other-tenant"))).value.length, 0);
}));

test("risk snapshots: one per project per day (saving again replaces it), newest first, tenant scoped", { skip }, withDb(async (tx) => {
  const store = new PrismaRiskTrendStore(tx);
  const { ProjectRiskTrend } = await import("@donordesk/domain");
  const snap = (day, late) => { const t = ProjectRiskTrend.create({ id: `p1:${day}`, tenantId: "tenant-tk", projectId: "p1", periodStart: new Date(`${day}T00:00:00Z`), periodEnd: new Date(`${day}T23:59:59Z`) }); t.updateMetrics({ overdueChecklistItemsCount: late, contributingFactors: [{ type: "plan_slip", weight: late, description: `${late} late`, affectedIndicatorIds: [], severity: "LOW" }] }); return t; };
  await store.save(snap("2026-04-09", 1)); await store.save(snap("2026-04-10", 2));
  await store.save(snap("2026-04-10", 6));
  const rows = (await store.history("p1", T, 10)).value;
  assert.deepEqual(rows.map((r) => r.id), ["p1:2026-04-10", "p1:2026-04-09"]);
  assert.equal(rows[0].overdueChecklistItemsCount, 6, "the same day was replaced, not added");
  assert.deepEqual(rows[0].contributingFactors.map((f) => [f.type, f.weight]), [["plan_slip", 6]]);
  assert.equal(await tx.projectRiskTrend.count(), 2);
  assert.deepEqual((await store.history("p1", TenantId.create("other-tenant"), 10)).value, []);
  assert.equal((await store.history("p1", T, 1)).value.length, 1);
}));

test("no source leaks another organisation's work: the same data in two tenants stays apart", { skip }, async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    await inRollback(prisma, async (tx) => {
      for (const [tenant, project] of [["tenant-tk", "p1"], ["tenant-evil", "pe"]]) {
        // "u2" is the same person-id in both organisations on purpose: only the tenant filter can keep their work apart.
        if (tenant === "tenant-tk") await tx.user.create({ data: { id: "u2", tenantId: tenant, email: "u2@tk.org", name: "U2", passwordHash: "x", role: "PROJECT_MANAGER" } });
        await tx.project.create({ data: { id: project, tenantId: tenant, title: tenant, projectCode: project, donorName: "d", implementingOrganization: "o", country: "KE", sector: "HEALTH", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), reportingFrequency: "QUARTERLY", reportingOfficerId: "u2", meOfficerId: "u2", projectManagerId: "u2" } });
        await tx.projectMember.create({ data: { id: `m-${tenant}`, tenantId: tenant, projectId: project, userId: "u2", role: "PROJECT_MANAGER", assignedById: "x", assignedAt: new Date() } });
        await seedIndicators(tx, tenant, project, "u2");
        await seedRisks(tx, tenant, project);
        await tx.reportingPeriod.create({ data: { id: `rp-${tenant}`, tenantId: tenant, projectId: project, reportType: "QUARTERLY", startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31"), deadline: new Date("2026-03-15") } });
        await tx.checklistItem.create({ data: { id: `c-${tenant}`, tenantId: tenant, projectId: project, reportingPeriodId: `rp-${tenant}`, type: "ATTESTATION", title: "c", severity: "HIGH", assignedToId: "u2", dueDate: new Date("2026-03-01") } });
        await tx.activityUpdate.create({ data: { id: `a-${tenant}`, tenantId: tenant, projectId: project, reportingPeriodId: "rp", activityTitle: "a", activityDate: new Date("2026-03-02"), summary: "s", status: "SUBMITTED", submittedById: "u2" } });
        await tx.evidenceFile.create({ data: { id: `e-${tenant}`, tenantId: tenant, projectId: project, title: "e", fileName: "e", fileType: "x", fileSize: 1, fileUrl: "u", evidenceType: "PHOTO", uploadedById: "u3", verificationStatus: "UPLOADED" } });
        await new PrismaProjectTaskRepository(tx).create(ProjectTask.create({ id: `t-${tenant}`, tenantId: tenant, kind: "OTHER", projectId: project, title: "t", assigneeId: "u2", assignedById: "u1", dueDate: "2026-03-14" }).value);
        await new PrismaPlannedActivityRepository(tx).create(PlannedActivity.create({ id: `pa-${tenant}`, tenantId: tenant, projectId: project, title: "pa", plannedStart: "2026-03-01", plannedEnd: "2026-03-05", createdById: "u", people: { ownerUserId: "u2", supportUserIds: [] } }).value);
      }
      const all = [new TaskAssignmentSource(tx), new PlanItemAssignmentSource(tx), new ChecklistAssignmentSource(tx), new ReportDeadlineAssignmentSource(tx), new ActivityFixAssignmentSource(tx), new EvidenceReviewAssignmentSource(tx), new ActivityReviewAssignmentSource(tx), new IndicatorValueAssignmentSource(new PrismaCollectionFactsReader(tx)), new RiskReviewAssignmentSource(tx)];
      let seen = 0;
      for (const source of all) {
        for (const q of [{ tenantId: T, today: TODAY, assigneeId: "u2" }, { tenantId: T, today: TODAY }]) {
          const out = (await source.list(q)).value;
          seen += out.length;
          for (const a of out) assert.notEqual(a.projectId, "pe", `${source.kind} returned another organisation's project`);
        }
      }
      assert.ok(seen > 0, "the sources did return this organisation's own work");
    });
  } finally { await prisma.$disconnect(); }
});

test("risks round-trip every field, clearing the owner persists, and a closed one reads back closed", { skip }, withDb(async (tx) => {
  const repo = new PrismaProjectRiskRepository(tx);
  const r = ProjectRisk.create({ id: "rk1", tenantId: "tenant-tk", projectId: "p1", kind: "RISK", title: "Flooding", seriousness: "HIGH", action: "Sandbags", ownerId: "u2", raisedById: "u1", plannedActivityId: "pa1", today: "2026-03-10" }).value;
  await repo.create(r);
  assert.deepEqual(plain((await repo.findById("rk1", T)).value.snapshot()), plain(r.snapshot()));
  r.update({ ownerId: undefined, seriousness: "LOW", action: "Watching" }, "2026-03-11");
  await repo.update(r);
  const back = (await repo.findById("rk1", T)).value.snapshot();
  assert.deepEqual([back.ownerId, back.seriousness, back.reviewBy, back.action], [undefined, "LOW", undefined, "Watching"], "no owner and no review date once cleared");
  r.close("u1", "Water went down", new Date("2026-03-12T10:00:00Z"));
  await repo.update(r);
  const closed = (await repo.findById("rk1", T)).value.snapshot();
  assert.deepEqual([closed.status, closed.closedNote, closed.closedById], ["CLOSED", "Water went down", "u1"]);
  assert.equal((await repo.findById("rk1", TenantId.create("other-tenant"))).value, null);
  assert.deepEqual((await repo.findByProject("p1", T)).value.map((x) => x.id), ["rk1"]);
}));
