import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity } from "@donordesk/domain";
import { CompletePlannedActivityHandler, ChangePlanStatusHandler, PlanAccess, PlanRecorder } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const LEAD = ctxFor("fo", "FIELD_OFFICER");
const VIEWER = ctxFor("v", "VIEWER");
const ok = (value) => ({ ok: true, value });

function world({ periods = [{ id: "per1", duration: { start: new Date("2026-10-01"), end: new Date("2026-10-31") } }], createFails = false } = {}) {
  const store = new Map([["a1", PlannedActivity.create({ id: "a1", tenantId: "tenant-a", projectId: "p", title: "Distribution", location: "Ward 3", plannedStart: "2026-10-05", plannedEnd: "2026-10-12", people: { ownerUserId: "fo", supportUserIds: [] }, createdById: "pm" }).value]]);
  const repo = { update: async (i) => (store.set(i.id, i), ok(i)), findById: async (id) => ok(store.get(id) ?? null) };
  const created = [];
  const clock = { now: () => new Date("2026-10-19T09:00:00Z") };
  const recorder = new PlanRecorder({ generate: () => "rev" }, { append: async () => ok(undefined) }, { record: async () => undefined }, clock);
  const access = new PlanAccess(repo);
  const activities = { handle: async (ctx, input) => (createFails ? { ok: false, error: { code: "VALIDATION", message: "nope" } } : (created.push(input), ok({ id: `act${created.length}` }))) };
  const handler = new CompletePlannedActivityHandler(access, { findByProject: async () => ok(periods) }, activities, new ChangePlanStatusHandler(access, repo, recorder, clock), clock);
  return { store, created, handler };
}

test("one step: the completed activity is recorded for the right period and the plan item becomes done", async () => {
  const w = world();
  const res = await w.handler.handle(LEAD, "a1", { finishedOn: "2026-10-12", people: "40", note: "Two villages" });
  assert.equal(res.ok, true, res.error?.message);
  assert.equal(w.store.get("a1").status, "DONE");
  assert.equal(w.created.length, 1);
  assert.deepEqual([w.created[0].reportingPeriodId, w.created[0].plannedActivityId, w.created[0].participantsTotal, w.created[0].location, w.created[0].summary], ["per1", "a1", 40, "Ward 3", "Two villages"]);
});

test("people reached is left out when blank, never sent as zero; a missing note gets a plain summary", async () => {
  const w = world();
  await w.handler.handle(LEAD, "a1", { finishedOn: "2026-10-12", people: "  " });
  assert.equal("participantsTotal" in w.created[0], false);
  assert.equal(w.created[0].summary, "Completed: Distribution");
});

test("anything wrong refuses the whole thing and changes nothing", async () => {
  const w = world();
  assert.equal((await w.handler.handle(VIEWER, "a1", { finishedOn: "2026-10-12" })).ok, false, "a viewer cannot");
  assert.equal((await w.handler.handle(LEAD, "a1", { finishedOn: "2026-10-30" })).ok, false, "not in the future");
  assert.equal((await w.handler.handle(LEAD, "a1", { finishedOn: "2026-02-30" })).ok, false);
  assert.equal((await w.handler.handle(LEAD, "a1", { finishedOn: "2026-10-12", people: "many" })).ok, false);
  assert.equal((await world({ periods: [] }).handler.handle(LEAD, "a1", { finishedOn: "2026-10-12" })).ok, false, "no reporting period covers the day");
  assert.equal(w.created.length, 0);
  assert.equal(w.store.get("a1").status, "PLANNED");
});

test("if the completed activity cannot be saved, the plan item stays open; a done item cannot be done twice", async () => {
  const failing = world({ createFails: true });
  assert.equal((await failing.handler.handle(LEAD, "a1", { finishedOn: "2026-10-12" })).ok, false);
  assert.equal(failing.store.get("a1").status, "PLANNED");
  const w = world();
  await w.handler.handle(LEAD, "a1", { finishedOn: "2026-10-12" });
  assert.equal((await w.handler.handle(LEAD, "a1", { finishedOn: "2026-10-12" })).ok, false);
  assert.equal(w.created.length, 1, "no second completed activity");
});
