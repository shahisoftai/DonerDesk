// Repositories for the phase 28.1 tables, on a scratch Postgres. Opt-in: WORKPLAN_VERIFY_DATABASE_URL (a throwaway database that has had
// `prisma migrate deploy` run).
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import {
  PrismaPlanDependencyRepository, PrismaProjectFieldRepository, PrismaCustomFieldValueRepository, PrismaBudgetRepository,
  PrismaMemberCapacityRepository, PrismaAutomationSettings, PrismaBeneficiaryRepository, PrismaBeneficiaryLinkRepository,
  PrismaPlannedActivityIndicatorRepository, PrismaProgressRepository,
} from "../dist/repositories/workplan.js";

const url = process.env.WORKPLAN_VERIFY_DATABASE_URL;
const skip = url ? false : "WORKPLAN_VERIFY_DATABASE_URL not set";
const T = TenantId.create("tenant-gc");
const OTHER = TenantId.create("tenant-other");
const NOW = new Date("2026-10-19T09:00:00Z");

// These repositories use unique keys and their own transactions, so the tests use a real client and delete what they create
// (rows of the two test tenants only) before and after. Use a throwaway database.
const TABLES = ["plannedActivityDependency", "customFieldValue", "projectField", "budgetExpense", "budgetLine", "memberCapacity", "projectAutomation", "beneficiaryActivityLink", "beneficiary", "plannedActivityIndicator", "progressEntry"];
const clean = (prisma) => Promise.all(TABLES.map((t) => prisma[t].deleteMany({ where: { tenantId: { in: ["tenant-gc", "tenant-other"] } } })));
const withDb = (fn) => async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try { await clean(prisma); await fn(prisma); } finally { await clean(prisma); await prisma.$disconnect(); }
};

test("dependencies: a repeated pair is a conflict, removal says whether it removed, and reads are tenant-scoped", { skip }, withDb(async (tx) => {
  const repo = new PrismaPlanDependencyRepository(tx);
  const link = (id, p, s) => ({ id, tenantId: "tenant-gc", projectId: "p1", predecessorId: p, successorId: s, createdById: "u1", createdAt: NOW });
  assert.equal((await repo.add(link("d1", "a", "b"))).ok, true);
  const dup = await repo.add(link("d2", "a", "b"));
  assert.equal(dup.ok, false);
  assert.equal(dup.error.code, "CONFLICT");
  assert.equal((await repo.findByProject("p1", T)).value.length, 1);
  assert.equal((await repo.findByProject("p1", OTHER)).value.length, 0);
  assert.equal((await repo.remove("a", "b", T)).value, true);
  assert.equal((await repo.remove("a", "b", T)).value, false);
}));

test("custom fields: a field name is unique per project; a value is replaced, and a blank removes it", { skip }, withDb(async (tx) => {
  const fields = new PrismaProjectFieldRepository(tx);
  const values = new PrismaCustomFieldValueRepository(tx);
  const field = (id, key, projectId = "p1") => ({ id, tenantId: "tenant-gc", projectId, key, label: key, type: "TEXT", choices: [], createdById: "u1", createdAt: NOW });
  assert.equal((await fields.create(field("f1", "code"))).ok, true);
  assert.equal((await fields.create(field("f2", "code"))).error.code, "CONFLICT");
  assert.equal((await fields.create(field("f3", "code", "p2"))).ok, true, "another project may use the name");
  const entity = { tenantId: "tenant-gc", projectId: "p1", entityId: "act1", userId: "u1", now: NOW };
  await values.setValues(entity, [{ fieldId: "f1", value: "X1" }]);
  await values.setValues(entity, [{ fieldId: "f1", value: "X2" }]);
  assert.deepEqual((await values.findByEntity("act1", T)).value, { f1: "X2" });
  assert.deepEqual((await values.findByProject("p1", T)).value, { act1: { f1: "X2" } });
  await values.setValues(entity, [{ fieldId: "f1", value: null }]);
  assert.deepEqual((await values.findByEntity("act1", T)).value, {}, "blank is no row");
  assert.equal(await tx.customFieldValue.count(), 0);
}));

test("budget: lines and expenses read back per activity and per project, and money stays whole minor units", { skip }, withDb(async (tx) => {
  const repo = new PrismaBudgetRepository(tx);
  const line = (id, activity, amountMinor, currency = "USD") => ({ id, tenantId: "tenant-gc", projectId: "p1", plannedActivityId: activity, code: id, category: "TRAVEL", description: "", donorName: "", currency, amountMinor, createdById: "u1", createdAt: NOW });
  await repo.addLine(line("l1", "act1", 125050));
  await repo.addLine(line("l2", "act2", 20000, "EUR"));
  assert.equal((await repo.countLines("act1", T)).value, 1);
  assert.equal((await repo.findLinesByProject("p1", T)).value.length, 2);
  assert.equal((await repo.findLinesByProject("p1", OTHER)).value.length, 0);
  assert.equal((await repo.findLineById("l1", T)).value.amountMinor, 125050);
  await repo.addExpense({ id: "e1", tenantId: "tenant-gc", projectId: "p1", budgetLineId: "l1", expenseDate: "2026-10-11", amountMinor: 5, description: "fuel", createdById: "u1", createdAt: NOW });
  const expenses = (await repo.findExpensesByLines(["l1", "l2"], T)).value;
  assert.deepEqual(expenses.map((e) => [e.budgetLineId, e.expenseDate, e.amountMinor]), [["l1", "2026-10-11", 5]]);
  assert.deepEqual((await repo.findExpensesByLines([], T)).value, []);
}));

test("capacity and automations: blank is null, a stored choice wins, an unset rule is on", { skip }, withDb(async (tx) => {
  const cap = new PrismaMemberCapacityRepository(tx);
  const by = { userId: "pm", now: NOW };
  await cap.set("u1", 4, by, T);
  await cap.set("u2", null, by, T);
  const found = (await cap.findMany(["u1", "u2", "u3"], T)).value;
  assert.deepEqual([found.get("u1"), found.get("u2"), found.has("u3")], [4, null, false]);
  await cap.set("u1", 6, by, T);
  assert.equal((await cap.findMany(["u1"], T)).value.get("u1"), 6, "set again replaces");
  const auto = new PrismaAutomationSettings(tx);
  assert.deepEqual([...(await auto.enabledRules("p1", T)).value].sort(), ["FILES_STILL_NEEDED", "START_WITHOUT_LEAD"]);
  await auto.set("p1", "START_WITHOUT_LEAD", false, by, T);
  assert.deepEqual([...(await auto.enabledRules("p1", T)).value], ["FILES_STILL_NEEDED"]);
  assert.deepEqual((await auto.stored("p1", T)).value, { START_WITHOUT_LEAD: false });
}));

test("beneficiaries: a case code is unique per project; an import is all or none; links count a person once", { skip }, withDb(async (tx) => {
  const people = new PrismaBeneficiaryRepository(tx);
  const links = new PrismaBeneficiaryLinkRepository(tx);
  const person = (id, code, projectId = "p1") => ({ id, tenantId: "tenant-gc", projectId, caseCode: code, sex: "FEMALE", ageGroup: "UNDER_5", location: "", enrolledOn: "2026-10-14", consentRecordedById: "u1", createdById: "u1", createdAt: NOW });
  assert.equal((await people.add(person("b1", "NG-1"))).ok, true);
  assert.equal((await people.add(person("b2", "NG-1"))).error.code, "CONFLICT");
  assert.equal((await people.add(person("b3", "NG-1", "p2"))).ok, true, "another project may reuse a code");
  const batch = await people.addMany([person("b4", "NG-2"), person("b5", "NG-1")]);
  assert.equal(batch.ok, false, "one clash refuses the whole batch");
  assert.equal(await tx.beneficiary.count({ where: { id: { in: ["b4", "b5"] } } }), 0, "nothing from the batch was saved");
  await people.addMany([person("b4", "NG-2")]);
  assert.deepEqual((await people.findByProject("p1", T)).value.map((b) => b.caseCode), ["NG-1", "NG-2"]);

  const add = (ids) => links.add({ tenantId: "tenant-gc", projectId: "p1", plannedActivityId: "act1", beneficiaryIds: ids, userId: "u1", now: NOW });
  assert.equal((await add(["b1", "b4"])).value, 2);
  assert.equal((await add(["b1"])).value, 0, "already linked");
  assert.deepEqual((await links.findBeneficiaryIds("act1", T)).value.sort(), ["b1", "b4"]);
  assert.equal((await links.remove("act1", ["b1", "zzz"], T)).value, 1);
}));

test("progress: a day is unique per activity; saving a month absorbs its days; removing it gives them back", { skip }, withDb(async (tx) => {
  const repo = new PrismaProgressRepository(tx);
  const entry = (id, kind, from, to, total) => ({
    id, tenantId: "tenant-gc", projectId: "p1", plannedActivityId: "act1", kind, from, to,
    values: { total, breakdowns: { "SEX|women": null }, sessions: null, unique: null },
    narrative: { notes: "", summary: "", achievements: "", challenges: "", nextSteps: "", lessons: "" },
    absorbedById: null, createdById: "u1", updatedById: "u1", createdAt: NOW, updatedAt: NOW,
  });
  assert.equal((await repo.save(entry("d1", "DAILY", "2026-10-14", "2026-10-14", 8), [])).ok, true);
  await repo.save(entry("d2", "DAILY", "2026-10-15", "2026-10-15", 9), []);
  const clash = await repo.save(entry("d3", "DAILY", "2026-10-14", "2026-10-14", 1), []);
  assert.equal(clash.ok, false, "the same day twice");
  assert.equal(clash.error.code, "CONFLICT");
  await repo.save(entry("m1", "MONTHLY", "2026-10-14", "2026-10-31", 17), ["d1", "d2"]);
  const list = (await repo.findByItem("act1", T)).value;
  assert.deepEqual(list.filter((e) => e.absorbedById === "m1").map((e) => e.id).sort(), ["d1", "d2"]);
  assert.deepEqual(list.find((e) => e.id === "d1").values, { total: 8, breakdowns: { "SEX|women": null }, sessions: null, unique: null }, "a blank figure round-trips as null");
  assert.equal((await repo.remove("m1", "act1", T)).value, true);
  assert.equal((await repo.findByItem("act1", T)).value.filter((e) => e.absorbedById).length, 0, "released");
  assert.equal((await repo.remove("m1", "act1", T)).value, false);
}));

test("activity indicators: replacing the set is one step and leaves other activities alone", { skip }, withDb(async (tx) => {
  const repo = new PrismaPlannedActivityIndicatorRepository(tx);
  const set = (activity, ids) => repo.replace({ tenantId: "tenant-gc", projectId: "p1", plannedActivityId: activity, indicatorIds: ids, userId: "u1", now: NOW });
  await set("act1", ["i1", "i2"]);
  await set("act2", ["i3"]);
  await set("act1", ["i2"]);
  assert.deepEqual((await repo.findIndicatorIds("act1", T)).value, ["i2"]);
  assert.deepEqual((await repo.findIndicatorIds("act2", T)).value, ["i3"]);
  await set("act1", []);
  assert.deepEqual((await repo.findIndicatorIds("act1", T)).value, []);
}));
