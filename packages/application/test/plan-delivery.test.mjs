import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity } from "@donordesk/domain";
import { PlanDeliveryService, GetPlanStorySuggestionHandler, recordChunksFromPlan } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const make = (id, start, end) => PlannedActivity.create({ id, tenantId: "tenant-a", projectId: "p", title: id, plannedStart: start, plannedEnd: end, createdById: "u" }).value;

function world() {
  const done = make("a", "2026-07-01", "2026-07-03");
  done.applyStatus("COMPLETE", { at: new Date("2026-07-04T00:00:00Z") });
  const moved = make("b", "2026-07-10", "2026-07-12");
  moved.reschedule({ start: "2026-08-10", end: "2026-08-12" }, { today: "2026-07-01", reportUsesIt: false, reason: "Flood closed the road" });
  const outside = make("c", "2026-11-01", "2026-11-02");
  const plans = { findByProject: async () => ok([done, moved, outside]) };
  const revisions = { findByPlannedActivity: async (id) => ok(id === "b" ? [{ id: "r", change: { plannedEnd: { from: "2026-07-12", to: "2026-08-12" } }, reason: "Flood closed the road" }] : []) };
  return new PlanDeliveryService(plans, revisions);
}

test("summarises the period from the plan and its history", async () => {
  const r = await world().forPeriod({ tenantId, projectId: "p", start: new Date("2026-07-01T00:00:00Z"), end: new Date("2026-09-30T00:00:00Z") });
  assert.equal(r.ok, true);
  assert.deepEqual([r.value.planned, r.value.held, r.value.notHeld, r.value.moved], [2, 1, 1, 1]);
  assert.deepEqual(r.value.movedReasons, ["Flood closed the road"]);
});
test("plan chunks are record: statements; none without a plan", async () => {
  const r = await world().forPeriod({ tenantId, projectId: "p", start: "2026-07-01", end: "2026-09-30" });
  const chunks = recordChunksFromPlan(r.value);
  assert.ok(chunks.length >= 3 && chunks.every((c) => c.chunkId.startsWith("record:plan:")));
  assert.match(chunks[0].text, /2 activities were planned for this period and 1 were held/);
  assert.deepEqual(recordChunksFromPlan(undefined), []);
});
test("the story suggestion handler refuses an unknown period and suggests from the plan", async () => {
  const svc = world();
  const periods = { findById: async (id) => ok(id === "x" ? { projectId: "p", duration: { start: new Date("2026-07-01T00:00:00Z"), end: new Date("2026-09-30T00:00:00Z") } } : null) };
  const h = new GetPlanStorySuggestionHandler(periods, svc);
  const ctx = { tenant: { tenantId, userId: "u", role: "PROJECT_MANAGER" }, requestId: "r" };
  assert.equal((await h.handle(ctx, "nope")).ok, false);
  const s = await h.handle(ctx, "x");
  assert.match(s.value.challenges, /1 of the 2/);
});
