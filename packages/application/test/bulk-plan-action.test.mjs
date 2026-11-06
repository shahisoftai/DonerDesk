import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity } from "@donordesk/domain";
import { UndoBulkPlanActionHandler, BULK_STRATEGIES, BulkPlanActionHandler, AssignPlannedActivityHandler, ReschedulePlannedActivityHandler, ChangePlanStatusHandler, PlanAccess, PlanRecorder } from "../dist/index.js";

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
  const bulk = new BulkPlanActionHandler(access, repo, context,
    new AssignPlannedActivityHandler(access, repo, context, recorder),
    new ReschedulePlannedActivityHandler(access, repo, context, recorder, clock, deps),
    new ChangePlanStatusHandler(access, repo, recorder, clock), clock);
  return {
    store, revisions, audit,
    bulk,
    undo: new UndoBulkPlanActionHandler(bulk),
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

test("a bulk change returns the steps that put each activity back, and undoing restores dates and leads", async () => {
  const w = world();
  const moved = await w.bulk.handle(PM, { ids: ["a", "b"], action: { kind: "SHIFT", days: 7 }, apply: true });
  assert.deepEqual(moved.value.undo.map((u) => [u.id, u.action.days]), [["a", -7], ["b", -7]]);
  assert.equal((await w.undo.handle(PM, moved.value.undo)).value.undone, 2);
  assert.equal(w.store.get("a").plannedStart, "2026-03-10");

  const lead = await w.bulk.handle(PM, { ids: ["a", "c"], action: { kind: "SET_LEAD", leadUserId: "pm" }, apply: true });
  assert.deepEqual(lead.value.undo.map((u) => u.action.leadUserId), ["fo", "me"], "each activity goes back to its own lead");
  await w.undo.handle(PM, lead.value.undo);
  assert.equal(w.store.get("a").ownerUserId, "fo");
  assert.equal(w.store.get("c").ownerUserId, "me");
});

test("only changes that can be reversed offer an undo step; a cancel is undone by a restore", async () => {
  const w = world();
  const started = await w.bulk.handle(PM, { ids: ["a"], action: { kind: "SET_STATUS", status: "START" }, apply: true });
  assert.deepEqual(started.value.undo, [], "starting cannot be reversed");
  const cancelled = await w.bulk.handle(PM, { ids: ["b"], action: { kind: "SET_STATUS", status: "CANCEL" }, reason: "Funding cut", apply: true });
  assert.deepEqual(cancelled.value.undo, [{ id: "b", action: { kind: "SET_STATUS", status: "RESTORE" } }]);
  await w.undo.handle(PM, cancelled.value.undo);
  assert.equal(w.store.get("b").status, "PLANNED");
  assert.equal((await w.undo.handle(PM, [])).ok, false);
});

test("every bulk action kind is a strategy with the five parts the handler needs", () => {
  for (const [kind, s] of Object.entries(BULK_STRATEGIES)) {
    for (const part of ["needs", "preview", "precheck", "apply", "inverse"]) assert.ok(s[part] !== undefined, `${kind} has ${part}`);
  }
});
