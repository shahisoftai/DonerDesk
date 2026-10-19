import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity } from "@donordesk/domain";
import { AddBudgetLineHandler, AddBudgetExpenseHandler, GetPlanItemBudgetHandler, PlanAccess } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const LEAD = ctxFor("fo", "FIELD_OFFICER");
const STRANGER = ctxFor("me", "VIEWER");
const ok = (value) => ({ ok: true, value });

function world() {
  const items = new Map();
  const lines = new Map();
  const expenses = [];
  const audit = [];
  let n = 0;
  const ids = { generate: () => `id${++n}` };
  const clock = { now: () => new Date("2026-03-01T09:00:00Z") };
  const itemRepo = {
    findById: async (id) => ok(items.get(id) ?? null),
    findByProject: async (p) => ok([...items.values()].filter((i) => i.projectId === p)),
  };
  const budgets = {
    addLine: async (l) => (lines.set(l.id, l), ok(undefined)),
    countLines: async (itemId) => ok([...lines.values()].filter((l) => l.plannedActivityId === itemId).length),
    findLineById: async (id) => ok(lines.get(id) ?? null),
    findLinesByItem: async (itemId) => ok([...lines.values()].filter((l) => l.plannedActivityId === itemId)),
    addExpense: async (e) => (expenses.push(e), ok(undefined)),
    findExpensesByLines: async (ids2) => ok(expenses.filter((e) => ids2.includes(e.budgetLineId))),
  };
  const auditLogger = { record: async (e) => void audit.push(e) };
  const access = new PlanAccess(itemRepo);
  items.set("item1", PlannedActivity.create({ id: "item1", tenantId: "tenant-a", projectId: "p", title: "Training", plannedStart: "2026-03-10", plannedEnd: "2026-03-12", people: { ownerUserId: "fo", supportUserIds: [] }, createdById: "pm" }).value);
  items.set("item2", PlannedActivity.create({ id: "item2", tenantId: "tenant-a", projectId: "p", title: "Other", plannedStart: "2026-03-10", plannedEnd: "2026-03-12", createdById: "pm" }).value);
  return {
    audit, expenses,
    addLine: new AddBudgetLineHandler(access, budgets, ids, auditLogger, clock),
    addExpense: new AddBudgetExpenseHandler(access, budgets, ids, auditLogger, clock),
    get: new GetPlanItemBudgetHandler(access, budgets),
  };
}

const line = { code: "2.1-T", category: "TRAVEL", currency: "USD", amount: "500" };

test("only a manager sets a budget line; a bad amount or code is refused and nothing is saved", async () => {
  const w = world();
  assert.equal((await w.addLine.handle(LEAD, "item1", line)).error.code, "FORBIDDEN");
  assert.equal((await w.addLine.handle(PM, "item1", { ...line, amount: "-1" })).ok, false);
  assert.equal((await w.addLine.handle(PM, "item1", { ...line, code: "" })).ok, false);
  assert.equal((await w.get.handle(PM, "item1")).value.length, 0);
  assert.equal((await w.addLine.handle(PM, "item1", line)).ok, true);
  assert.equal(w.audit.filter((e) => e.eventType === "workplan.budget_line_added").length, 1);
});

test("the lead books expenses against the activity's own lines; a stranger or another activity's line is refused", async () => {
  const w = world();
  const { value: { id: lineId } } = await w.addLine.handle(PM, "item1", line);
  const { value: { id: otherLine } } = await w.addLine.handle(PM, "item2", line);
  assert.equal((await w.addExpense.handle(STRANGER, "item1", lineId, { date: "2026-03-11", amount: "100" })).ok, false);
  assert.equal((await w.addExpense.handle(LEAD, "item1", otherLine, { date: "2026-03-11", amount: "100" })).error.code, "NOT_FOUND");
  assert.equal((await w.addExpense.handle(LEAD, "item1", lineId, { date: "2026-03-11", amount: "100" })).ok, true);
  assert.equal((await w.addExpense.handle(LEAD, "item1", lineId, { date: "2026-02-30", amount: "1" })).ok, false);
});

test("the position reads spent against the budget, and an overspend is flagged but the expense is still kept", async () => {
  const w = world();
  const { value: { id: lineId } } = await w.addLine.handle(PM, "item1", line);
  await w.addExpense.handle(LEAD, "item1", lineId, { date: "2026-03-11", amount: "300" });
  await w.addExpense.handle(LEAD, "item1", lineId, { date: "2026-03-12", amount: "250.50" });
  const [view] = (await w.get.handle(STRANGER, "item1")).value;
  assert.equal(view.position.spentMinor, 55050);
  assert.equal(view.position.remainingMinor, -5050);
  assert.equal(view.position.overspent, true);
  assert.equal(w.expenses.length, 2, "an overspend is never blocked");
  assert.deepEqual(view.expenses.map((e) => e.date), ["2026-03-11", "2026-03-12"]);
});
