// Repositories added with the automation settings, the saved import mapping, the due-days setting and the effort column, on a scratch
// Postgres. Opt-in: WORKPLAN_VERIFY_DATABASE_URL (a throwaway database that has had `prisma migrate deploy` run).
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PlannedActivity, TenantId } from "@donordesk/domain";
import {
  PrismaPlannedActivityRepository, PrismaAutomationSettings, PrismaAutomationHistory, PrismaProjectSubmissionMappingRepository,
} from "../dist/repositories/workplan.js";
import { PrismaEntryDueDays } from "../dist/repositories/health.js";

const url = process.env.WORKPLAN_VERIFY_DATABASE_URL;
const skip = url ? false : "WORKPLAN_VERIFY_DATABASE_URL not set";
const T = TenantId.create("tenant-ar");
const OTHER = TenantId.create("tenant-ar-other");
const NOW = new Date("2026-10-20T07:00:00Z");

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
const make = (id, projectId = "p1", extra = {}) => PlannedActivity.create({ id, tenantId: "tenant-ar", projectId, title: `Activity ${id}`, plannedStart: "2026-10-21", plannedEnd: "2026-10-22", createdById: "u1", ...extra }).value;

test("effort: stored with the activity, unset reads back as unset, and a change persists", { skip }, withDb(async (tx) => {
  const repo = new PrismaPlannedActivityRepository(tx);
  await repo.create(make("e1", "p1", { effort: 4 }));
  await repo.create(make("e2"));
  assert.equal((await repo.findById("e1", T)).value.snapshot().effort, 4);
  assert.equal((await repo.findById("e2", T)).value.snapshot().effort, undefined, "the default 1 reads as unset");
  const item = (await repo.findById("e2", T)).value;
  item.updateDetails({ effort: 3 }, { today: "2026-10-01", reportUsesIt: false });
  await repo.update(item);
  assert.equal((await repo.findById("e2", T)).value.snapshot().effort, 3);
  const row = await tx.plannedActivity.findFirst({ where: { id: "e2" } });
  assert.equal(row.effort, 3);
}));

test("saved import mapping: none at first, replaced on save, and scoped to the organisation", { skip }, withDb(async (tx) => {
  const repo = new PrismaProjectSubmissionMappingRepository(tx);
  assert.equal((await repo.find("p1", T)).value, null);
  await repo.save("p1", { case_code: "Form/Case ID", sex: "Gender" }, { userId: "u1", now: NOW }, T);
  assert.deepEqual((await repo.find("p1", T)).value, { case_code: "Form/Case ID", sex: "Gender" });
  await repo.save("p1", { case_code: "ID" }, { userId: "u2", now: NOW }, T);
  assert.deepEqual((await repo.find("p1", T)).value, { case_code: "ID" }, "the new mapping replaces the old one");
  assert.equal((await repo.find("p1", OTHER)).value, null, "another organisation sees nothing");
  assert.equal(await tx.projectSubmissionMapping.count({ where: { projectId: "p1" } }), 1);
}));

test("automation numbers: saving them never changes whether the rule is on, and a damaged value reads as none", { skip }, withDb(async (tx) => {
  const repo = new PrismaAutomationSettings(tx);
  const by = { userId: "u1", now: NOW };
  assert.deepEqual((await repo.storedSettings("p1", T)).value, {});
  await repo.setSettings("p1", "START_WITHOUT_LEAD", { days: 7 }, by, T);
  assert.deepEqual((await repo.storedSettings("p1", T)).value, { START_WITHOUT_LEAD: { days: 7 } });
  assert.equal((await repo.stored("p1", T)).value.START_WITHOUT_LEAD, true, "a new row starts with the rule's default: on");

  await repo.set("p1", "START_WITHOUT_LEAD", false, by, T);
  await repo.setSettings("p1", "START_WITHOUT_LEAD", { days: 5 }, by, T);
  assert.equal((await repo.stored("p1", T)).value.START_WITHOUT_LEAD, false, "still off after its numbers were saved");
  assert.deepEqual((await repo.storedSettings("p1", T)).value.START_WITHOUT_LEAD, { days: 5 });
  assert.deepEqual((await repo.storedSettings("p1", OTHER)).value, {}, "tenant scoped");

  await tx.projectAutomation.update({ where: { projectId_ruleKey: { projectId: "p1", ruleKey: "START_WITHOUT_LEAD" } }, data: { settingsJson: "{not json" } });
  assert.deepEqual((await repo.storedSettings("p1", T)).value, {}, "a damaged value does not fail the read");
}));

test("automation history: only this project's activities, newest first, limited, and not another organisation's", { skip }, withDb(async (tx) => {
  const items = new PrismaPlannedActivityRepository(tx);
  await items.create(make("h1", "p1"));
  await items.create(make("h2", "p2"));
  const ledger = (id, tenant, recipient, key, day) => tx.reminderLedgerEntry.create({ data: { id, tenantId: tenant, recipientId: recipient, subjectKey: key, ruleKey: "AUTOMATION", sentOn: new Date(`${day}T00:00:00Z`) } });
  await ledger("l1", "tenant-ar", "manager", "automation:START_WITHOUT_LEAD:h1", "2026-10-18");
  await ledger("l2", "tenant-ar", "lead", "automation:FILES_STILL_NEEDED:h1", "2026-10-20");
  await ledger("l3", "tenant-ar", "manager", "automation:START_WITHOUT_LEAD:h2", "2026-10-19");
  await ledger("l4", "tenant-ar-other", "manager", "automation:START_WITHOUT_LEAD:h1", "2026-10-19");
  await tx.reminderLedgerEntry.create({ data: { id: "l5", tenantId: "tenant-ar", recipientId: "manager", subjectKey: "summary", ruleKey: "DAILY_SUMMARY", sentOn: new Date("2026-10-20T00:00:00Z") } });

  const history = new PrismaAutomationHistory(tx);
  const rows = (await history.recent("p1", T, 50)).value;
  assert.deepEqual(rows.map((r) => [r.sentOn, r.ruleKey, r.itemId, r.recipientId]), [
    ["2026-10-20", "FILES_STILL_NEEDED", "h1", "lead"],
    ["2026-10-18", "START_WITHOUT_LEAD", "h1", "manager"],
  ]);
  assert.equal((await history.recent("p1", T, 1)).value.length, 1, "limited");
  assert.deepEqual((await history.recent("empty-project", T, 50)).value, []);
  assert.equal((await history.recent("p1", OTHER, 50)).value.length, 0, "another organisation has no activities in p1");
}));

test("due days: the default is 5, and setting them for a project with no reporting profile changes nothing", { skip }, withDb(async (tx) => {
  const repo = new PrismaEntryDueDays(tx);
  assert.equal(await repo.forProject("p1", T), 5);
  assert.equal(await repo.set("p1", 10, T), false);
  assert.equal(await repo.forProject("p1", T), 5);
}));
