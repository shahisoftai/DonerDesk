import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import {
  CreatePlannedActivityHandler, ReschedulePlannedActivityHandler, AddPlanDependencyHandler, RemovePlanDependencyHandler,
  ChangePlanStatusHandler, PlanAccess, PlanRecorder,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const FIELD = ctxFor("fo", "FIELD_OFFICER");
const ok = (value) => ({ ok: true, value });
const fail = (code, message) => ({ ok: false, error: { code, message } });

function world({ today = "2026-03-01", reportUses = false } = {}) {
  const store = new Map();
  const revisions = [];
  const audit = [];
  const links = [];
  let n = 0;
  const ids = { generate: () => `id${++n}` };
  const clock = { now: () => new Date(`${today}T09:00:00Z`) };
  const repo = {
    create: async (i) => (store.set(i.id, i), ok(i)),
    createMany: async (list) => (list.forEach((i) => store.set(i.id, i)), ok(list)),
    update: async (i) => (store.set(i.id, i), ok(i)),
    findById: async (id) => ok(store.get(id) ?? null),
    findByProject: async (p) => ok([...store.values()].filter((i) => i.projectId === p)),
    findBySeries: async (s) => ok([...store.values()].filter((i) => i.seriesId === s)),
  };
  const deps = {
    add: async (link) => {
      if (links.some((l) => l.predecessorId === link.predecessorId && l.successorId === link.successorId)) return fail("CONFLICT", "dup");
      links.push(link);
      return ok(undefined);
    },
    remove: async (p, s) => {
      const i = links.findIndex((l) => l.predecessorId === p && l.successorId === s);
      if (i < 0) return ok(false);
      links.splice(i, 1);
      return ok(true);
    },
    findByProject: async (p) => ok(links.filter((l) => store.get(l.predecessorId)?.projectId === p)),
  };
  const context = {
    activeMemberIds: async () => ok(new Set(["pm", "fo", "me"])),
    reportUsesDates: async () => ok(reportUses),
    projectDates: async () => ok({ start: "2026-01-01", end: "2026-12-31" }),
  };
  const logframe = { findByProject: async () => ok([]) };
  const auditLogger = { record: async (e) => void audit.push(e) };
  const recorder = new PlanRecorder(ids, { append: async (r) => (revisions.push(r), ok(undefined)) }, auditLogger, clock);
  const access = new PlanAccess(repo);
  return {
    store, revisions, audit, links,
    create: new CreatePlannedActivityHandler(ids, repo, context, logframe, auditLogger),
    status: new ChangePlanStatusHandler(access, repo, recorder, clock),
    move: new ReschedulePlannedActivityHandler(access, repo, context, recorder, clock, deps),
    moveWithoutDeps: new ReschedulePlannedActivityHandler(access, repo, context, recorder, clock),
    addDep: new AddPlanDependencyHandler(repo, deps, ids, auditLogger, clock),
    removeDep: new RemovePlanDependencyHandler(repo, deps, auditLogger),
  };
}

const activity = (title, start, end, extra = {}) => ({ title, plannedStart: start, plannedEnd: end, supportUserIds: [], ...extra });

async function twoLinked(w) {
  const a = (await w.create.handle(PM, "p", activity("Survey", "2026-03-10", "2026-03-12"))).value.ids[0];
  const b = (await w.create.handle(PM, "p", activity("Training", "2026-03-13", "2026-03-14"))).value.ids[0];
  return { a, b };
}

test("only a manager can add a link, and a loop, a duplicate or a self link is refused", async () => {
  const w = world();
  const { a, b } = await twoLinked(w);
  assert.equal((await w.addDep.handle(FIELD, { predecessorId: a, successorId: b })).error.code, "FORBIDDEN");
  assert.equal((await w.addDep.handle(PM, { predecessorId: a, successorId: a })).ok, false);
  assert.equal((await w.addDep.handle(PM, { predecessorId: a, successorId: b })).ok, true);
  assert.equal((await w.addDep.handle(PM, { predecessorId: a, successorId: b })).ok, false, "duplicate");
  assert.equal((await w.addDep.handle(PM, { predecessorId: b, successorId: a })).ok, false, "loop");
  assert.equal((await w.addDep.handle(PM, { predecessorId: a, successorId: "missing" })).ok, false);
  assert.equal(w.links.length, 1);
  assert.equal(w.audit.filter((e) => e.eventType === "workplan.dependency_added").length, 1);
});

test("a link across projects is refused", async () => {
  const w = world();
  const a = (await w.create.handle(PM, "p", activity("Survey", "2026-03-10", "2026-03-12"))).value.ids[0];
  const other = (await w.create.handle(PM, "q", activity("Other", "2026-03-20", "2026-03-21"))).value.ids[0];
  const res = await w.addDep.handle(PM, { predecessorId: a, successorId: other });
  assert.equal(res.ok, false);
  assert.match(res.error.message, /same project/);
});

test("moving an activity pushes the one that waits for it, records the cause, and never pulls one back", async () => {
  const w = world();
  const { a, b } = await twoLinked(w);
  await w.addDep.handle(PM, { predecessorId: a, successorId: b });

  const earlier = await w.move.handle(PM, a, { plannedStart: "2026-03-01", plannedEnd: "2026-03-02", scope: "THIS" });
  assert.equal(earlier.value.movedByDependency.length, 0, "moving earlier does not pull the next activity");
  assert.equal(w.store.get(b).plannedStart, "2026-03-13");

  const later = await w.move.handle(PM, a, { plannedStart: "2026-03-20", plannedEnd: "2026-03-22", scope: "THIS" });
  assert.deepEqual(later.value.movedByDependency.map((m) => [m.id, m.plannedStart, m.plannedEnd]), [[b, "2026-03-23", "2026-03-24"]]);
  assert.equal(w.store.get(b).plannedStart, "2026-03-23");
  assert.equal(w.store.get(b).plannedEnd, "2026-03-24", "duration kept");
  const pushed = w.revisions.find((r) => r.plannedActivityId === b);
  assert.match(pushed.reason, /Moved to follow "Survey"/);
  assert.ok(w.audit.some((e) => e.eventType === "workplan.item_moved_by_dependency" && e.entityId === b));
});

test("the push carries through a chain of three", async () => {
  const w = world();
  const a = (await w.create.handle(PM, "p", activity("One", "2026-03-10", "2026-03-10"))).value.ids[0];
  const b = (await w.create.handle(PM, "p", activity("Two", "2026-03-11", "2026-03-11"))).value.ids[0];
  const c = (await w.create.handle(PM, "p", activity("Three", "2026-03-12", "2026-03-12"))).value.ids[0];
  await w.addDep.handle(PM, { predecessorId: a, successorId: b });
  await w.addDep.handle(PM, { predecessorId: b, successorId: c });
  const res = await w.move.handle(PM, a, { plannedStart: "2026-03-20", plannedEnd: "2026-03-20", scope: "THIS" });
  assert.deepEqual(res.value.movedByDependency.map((m) => m.id), [b, c]);
  assert.equal(w.store.get(c).plannedStart, "2026-03-22");
});

test("a finished successor is not moved; the conflict is reported", async () => {
  const w = world();
  const { a, b } = await twoLinked(w);
  await w.addDep.handle(PM, { predecessorId: a, successorId: b });
  assert.equal((await w.status.handle(PM, b, { action: "COMPLETE" })).ok, true);
  const res = await w.move.handle(PM, a, { plannedStart: "2026-03-20", plannedEnd: "2026-03-22", scope: "THIS" });
  assert.deepEqual(res.value.movedByDependency, []);
  assert.deepEqual(res.value.blockedByDependency, [{ id: b, title: "Training", reason: "DONE" }]);
  assert.equal(w.store.get(b).plannedStart, "2026-03-13", "not changed");
});

test("removing a link stops the push; removing a missing link says so", async () => {
  const w = world();
  const { a, b } = await twoLinked(w);
  await w.addDep.handle(PM, { predecessorId: a, successorId: b });
  assert.equal((await w.removeDep.handle(FIELD, { predecessorId: a, successorId: b })).error.code, "FORBIDDEN");
  assert.equal((await w.removeDep.handle(PM, { predecessorId: a, successorId: b })).ok, true);
  assert.equal((await w.removeDep.handle(PM, { predecessorId: a, successorId: b })).ok, false);
  const res = await w.move.handle(PM, a, { plannedStart: "2026-03-20", plannedEnd: "2026-03-22", scope: "THIS" });
  assert.deepEqual(res.value.movedByDependency, []);
});

test("without a dependency repository the move behaves exactly as before", async () => {
  const w = world();
  const { a } = await twoLinked(w);
  const res = await w.moveWithoutDeps.handle(PM, a, { plannedStart: "2026-03-20", plannedEnd: "2026-03-22", scope: "THIS" });
  assert.deepEqual(res.value, { moved: 1, movedByDependency: [], blockedByDependency: [] });
});
