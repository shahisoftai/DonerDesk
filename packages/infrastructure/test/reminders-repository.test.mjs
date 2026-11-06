// Reminder repositories and a whole run on real sources, on a scratch Postgres. Opt-in: WORKPLAN_VERIFY_DATABASE_URL.
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { AssignmentQueue, PersonNotifier, RunRemindersHandler } from "@donordesk/application";
import { TenantId } from "@donordesk/domain";
import { PrismaReminderLedger, PrismaNotificationPreferences, PrismaReminderAudience } from "../dist/repositories/reminders.js";
import { PrismaNotificationRepository } from "../dist/repositories/support.js";
import { ChecklistAssignmentSource } from "../dist/assignment-sources/checklist-source.js";
import { TaskAssignmentSource } from "../dist/assignment-sources/task-source.js";

const url = process.env.WORKPLAN_VERIFY_DATABASE_URL;
const skip = url ? false : "WORKPLAN_VERIFY_DATABASE_URL not set";
const T = TenantId.create("tenant-rm");

async function inRollback(prisma, work) {
  const sentinel = new Error("rollback");
  try {
    await prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica"); await work(tx); throw sentinel; });
  } catch (e) { if (e !== sentinel) throw e; }
}
const withDb = (fn) => async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try { await inRollback(prisma, fn); } finally { await prisma.$disconnect(); }
};
const user = (tx, id, extra = {}) => tx.user.create({ data: { id, tenantId: "tenant-rm", email: `${id}@x.org`, name: id[0].toUpperCase() + id.slice(1), passwordHash: "x", role: "FIELD_OFFICER", status: "ACTIVE", ...extra } });

test("the ledger remembers, ignores repeats, is tenant-scoped, and tells 'ever' from 'that day'", { skip }, withDb(async (tx) => {
  const ledger = new PrismaReminderLedger(tx);
  const e = { tenantId: T, recipientId: "u1", subjectKey: "summary", ruleKey: "DAILY_SUMMARY", sentOn: "2026-03-10" };
  assert.equal((await ledger.wasSent(T, "u1", "summary", "DAILY_SUMMARY", "2026-03-10")).value, false);
  assert.equal((await ledger.record(e)).ok, true);
  assert.equal((await ledger.record(e)).ok, true, "recording twice is not an error");
  assert.equal(await tx.reminderLedgerEntry.count(), 1);
  assert.equal((await ledger.wasSent(T, "u1", "summary", "DAILY_SUMMARY", "2026-03-10")).value, true);
  assert.equal((await ledger.wasSent(T, "u1", "summary", "DAILY_SUMMARY", "2026-03-11")).value, false, "another day is another summary");
  assert.equal((await ledger.wasSent(T, "u1", "summary", "DAILY_SUMMARY")).value, true, "'ever' ignores the day");
  assert.equal((await ledger.wasSent(TenantId.create("other-tenant"), "u1", "summary", "DAILY_SUMMARY")).value, false);
  assert.equal((await ledger.wasSent(T, "u2", "summary", "DAILY_SUMMARY")).value, false);
}));

test("the one setting: defaults to the daily summary, stores the choice, reads an unknown value as the default", { skip }, withDb(async (tx) => {
  await user(tx, "amina"); await user(tx, "joe", { emailSummaryMode: "NEVER" }); await user(tx, "odd", { emailSummaryMode: "WEEKLY" });
  const prefs = new PrismaNotificationPreferences(tx);
  assert.equal((await prefs.get(T, "amina")).value, "DAILY_SUMMARY");
  assert.equal((await prefs.get(T, "ghost")).value, "DAILY_SUMMARY", "an unknown person reads as the default");
  assert.deepEqual([...(await prefs.modes(T, ["amina", "joe", "odd"])).value].sort(), [["amina", "DAILY_SUMMARY"], ["joe", "NEVER"], ["odd", "DAILY_SUMMARY"]]);
  await prefs.set(T, "amina", "URGENT_ONLY");
  assert.equal((await prefs.get(T, "amina")).value, "URGENT_ONLY");
  await prefs.set(TenantId.create("other-tenant"), "amina", "NEVER");
  assert.equal((await prefs.get(T, "amina")).value, "URGENT_ONLY", "another organisation cannot change it");
}));

test("the audience: the organisation's zone (UTC by default), active people only, project managers", { skip }, withDb(async (tx) => {
  await tx.organization.create({ data: { id: "org1", tenantId: "tenant-rm", name: "Org", organizationType: "NGO", country: "KE", sectors: "[]", contactName: "c", contactEmail: "c@x.org" } });
  const audience = new PrismaReminderAudience(tx);
  assert.equal((await audience.timeZone(T)).value, "UTC");
  await tx.organization.update({ where: { tenantId: "tenant-rm" }, data: { timeZone: "Asia/Karachi" } });
  assert.equal((await audience.timeZone(T)).value, "Asia/Karachi");
  assert.equal((await audience.timeZone(TenantId.create("no-org"))).value, "UTC");
  await user(tx, "amina"); await user(tx, "gone", { status: "REMOVED" }); await user(tx, "invited", { status: "INVITED" });
  assert.deepEqual((await audience.activeUsers(T)).value, [{ userId: "amina", name: "Amina" }]);
  const project = (id, extra) => tx.project.create({ data: { id, tenantId: "tenant-rm", title: id, projectCode: id, donorName: "d", implementingOrganization: "o", country: "KE", sector: "HEALTH", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), reportingFrequency: "QUARTERLY", ...extra } });
  await project("p1", { projectManagerId: "amina" }); await project("p2", {}); await project("p3", { projectManagerId: "amina", archivedAt: new Date() });
  assert.deepEqual([...(await audience.projectManagers(T)).value], [["p1", "amina"]]);
}));

test("a whole run on real sources: a summary and an in-app note for each person, nothing twice, a late item escalated once", { skip }, withDb(async (tx) => {
  await tx.organization.create({ data: { id: "org1", tenantId: "tenant-rm", name: "Org", organizationType: "NGO", country: "KE", sectors: "[]", contactName: "c", contactEmail: "c@x.org" } });
  await user(tx, "amina"); await user(tx, "mgr", { role: "PROJECT_MANAGER" }); await user(tx, "quiet");
  await tx.project.create({ data: { id: "p1", tenantId: "tenant-rm", title: "Clinics", projectCode: "C", donorName: "d", implementingOrganization: "o", country: "KE", sector: "HEALTH", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), reportingFrequency: "QUARTERLY", projectManagerId: "mgr" } });
  await tx.reportingPeriod.create({ data: { id: "rp1", tenantId: "tenant-rm", projectId: "p1", reportType: "QUARTERLY", startDate: new Date("2026-01-01"), endDate: new Date("2026-03-31"), deadline: new Date("2026-04-30") } });
  const item = (id, extra) => tx.checklistItem.create({ data: { id, tenantId: "tenant-rm", projectId: "p1", reportingPeriodId: "rp1", type: "ATTESTATION", title: id, severity: "LOW", assignedToId: "amina", ...extra } });
  await item("Old item", { dueDate: new Date("2026-03-01") });       // 9 days late: escalates
  await item("Due today", { dueDate: new Date("2026-03-10") });
  await item("Far away", { dueDate: new Date("2026-06-01") });        // not yet

  const notes = [];
  const mails = [];
  const notifier = new PersonNotifier({ generate: () => crypto.randomUUID() }, new PrismaNotificationRepository(tx), { notify: async (m) => void mails.push(m) }, new PrismaNotificationPreferences(tx));
  const handler = new RunRemindersHandler(
    new AssignmentQueue([new ChecklistAssignmentSource(tx), new TaskAssignmentSource(tx)]),
    new PrismaReminderLedger(tx), new PrismaNotificationPreferences(tx), new PrismaReminderAudience(tx), notifier, { record: async (e) => void notes.push(e) },
    { now: () => new Date("2026-03-10T07:20:00Z") },
  );
  const ctx = { tenant: { tenantId: T, userId: "system:reminders", role: "ADMIN" }, requestId: "r" };
  const first = await handler.handle(ctx);
  assert.deepEqual(first.value, { ran: true, summariesSent: 1, quiet: 2, escalationsSent: 1 });
  const rows = await tx.notification.findMany({ orderBy: { createdAt: "asc" } });
  assert.deepEqual(rows.map((r) => [r.recipientId, r.type]).sort(), [["amina", "DEADLINE_REMINDER"], ["mgr", "DEADLINE_REMINDER"]]);
  const mine = rows.find((r) => r.recipientId === "amina");
  assert.equal(mine.title, "2 things need you today (1 late, 1 due today)");
  assert.match(mine.message, /Old item \(Clinics\): was due 1 Mar/);
  assert.equal(rows.find((r) => r.recipientId === "mgr").title, "Amina is 9 days late");
  assert.equal(mails.length, 2, "both are emailed (the default setting)");

  assert.deepEqual((await handler.handle(ctx)).value, { ran: true, summariesSent: 0, quiet: 2, escalationsSent: 0 }, "the same hour again sends nothing");
  assert.equal(await tx.notification.count(), 2);
  await tx.user.update({ where: { id: "amina" }, data: { emailSummaryMode: "NEVER" } });
  const next = new RunRemindersHandler(handler["queue"], handler["ledger"], handler["prefs"], handler["audience"], notifier, { record: async () => undefined }, { now: () => new Date("2026-03-11T07:20:00Z") });
  assert.equal((await next.handle(ctx)).value.summariesSent, 0, "'never' means no summary");
  assert.equal((await next.handle(ctx)).value.escalationsSent, 0, "and the manager is not told twice");
}));
