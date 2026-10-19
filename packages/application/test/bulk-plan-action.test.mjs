import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity } from "@donordesk/domain";
import { BulkPlanActionHandler, AssignPlannedActivityHandler, ReschedulePlannedActivityHandler, ChangePlanStatusHandler, PlanAccess, PlanRecorder } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const LEAD = ctxFor("fo", "FIELD_OFFICER");
const ok = (value) => ({ ok: true, value });

function world({ today = "2026-03-01", reportUses = false } = {}) {
  const store = new Map();
  const revisions = [];
  const audit = [];
  let n = 0;
  const ids = { generate: () => `id${++n}` };
  const clock = { now: () => new Date(`${today}T09:00:00Z`) };
  const repo = {
    update: async (i) => (store.set(i.id, i), ok(i)),
    findById: async (id) => ok(store.get(id) ?? null),
    findByProject: async (p) => ok([...store.values()].filter((i) => i.projectId === p)),
  };
  const context = {
    activeMemberIds: async () => ok(new Set(["pm", "fo", "me"])),
    reportUsesDates: async () => ok(reportUses),
  };
  const auditLogger = { record: async (e) => void audit.push(e) };
  const recorder = new PlanRecorder(ids, { append: async (r) => (revisions.push(r), ok(undefined)) }, auditLogger, clock);
  const access = new PlanAccess(repo);
  const deps = { findByProject: async () => ok([]) };
  for (const [id, title, start, end, owner] of [["a", "One", "2026-03-10", "2026-03-12", "fo"], ["b", "Two", "2026-03-20", "2026-03-21", "fo"], ["c", "Three", "2026-03-25", "2026-03-26", "me"]]) {
    store.set(id, PlannedActivity.create({ id, tenantId: "tenant-a", projectId: "p", title, plannedStart: start, plannedEnd: end, people: { ownerUserId: owner, supportUserIds: [] }, createdById: "pm" }).value);
  }
  return {
    store, revisions, audit,
    bulk: new BulkPlanActionHandler(access, repo, context,
      new AssignPlannedActivityHandler(access, repo, context, recorder),
      new ReschedulePlannedActivityHandler(access, repo, context, recorder, clock, deps),
      new ChangePlanStatusHandler(access, repo, recorder, clock), clock),
  };
}

test("a preview shows every change and saves nothing", async () => {
  const w = world();
  const res = await w.bulk.handle(PM, { ids: ["a", "b"], action: { kind: "SHIFT", days: 7 }, apply: false });
  assert.equal(res.value.applied, 0);
  assert.deepEqual(res.value.preview.map((r) => r.after), ["2026-03-17 to 2026-03-19", "2026-03-27 to 2026-03-28"]);
  assert.equal(w.store.get("a").plannedStart, "2026-03-10");
  assert.equal(w.revisions.length, 0);
});

test("a shift needs a reason when a report uses the dates; with one, every activity moves and is recorded", async () => {
  const refused = world({ reportUses: true });
  const no = await refused.bulk.handle(PM, { ids: ["a", "b"], action: { kind: "SHIFT", days: 7 }, apply: true });
  assert.equal(no.error.details.field, "reason");
  assert.equal(refused.store.get("a").plannedStart, "2026-03-10", "nothing moved");

  const yes = await refused.bulk.handle(PM, { ids: ["a", "b"], action: { kind: "SHIFT", days: 7 }, reason: "Floods", apply: true });
  assert.equal(yes.value.applied, 2);
  assert.equal(refused.store.get("b").plannedStart, "2026-03-27");
  assert.equal(refused.revisions.length, 2);
});

test("one activity the person may not change stops the whole batch before anything is saved", async () => {
  const w = world();
  // Leads may move their own activities; "c" belongs to someone else.
  const res = await w.bulk.handle(LEAD, { ids: ["a", "c"], action: { kind: "SHIFT", days: 2 }, apply: true });
  assert.equal(res.ok, false);
  assert.equal(w.store.get("a").plannedStart, "2026-03-10", "a was not moved either");
});

test("cancelling a set needs a reason, and setting the lead of many is one step for a manager", async () => {
  const w = world();
  assert.equal((await w.bulk.handle(PM, { ids: ["a"], action: { kind: "SET_STATUS", status: "CANCEL" }, apply: true })).ok, false);
  const lead = await w.bulk.handle(PM, { ids: ["a", "b"], action: { kind: "SET_LEAD", leadUserId: "me" }, apply: true });
  assert.equal(lead.value.applied, 2);
  assert.equal(w.store.get("b").ownerUserId, "me");
});
