import assert from "node:assert/strict";
import test from "node:test";
import { ListTeamWorkHandler } from "../dist/index.js";

const ctx = { tenant: { tenantId: "t1", userId: "manager", role: "ADMIN" }, requestId: "r" };
const item = (key, kind, assigneeId, extra = {}) => ({ key, kind, projectId: "p1", projectTitle: "P", title: key, assigneeId, state: "OPEN", urgent: false, href: "/x", urgency: 1, ...extra });
const queue = { list: async () => ({ ok: true, value: [item("task:1", "TASK", "grace", { dueDate: "2027-02-05" }), item("plan:1", "PLAN_ITEM", "grace"), item("task:2", "TASK", "ram", { state: "LATE" })] }) };
const reconciler = { reconcile: async () => ({ ok: true, value: undefined }) };
const clock = { now: () => new Date("2026-12-30T10:00:00Z") };

test("the project's open requests are returned whoever they are for, and only requests", async () => {
  const r = await new ListTeamWorkHandler(queue, reconciler, clock).handle(ctx, "p1");
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.requests.map((x) => [x.key, x.assigneeId]), [["task:1", "grace"], ["task:2", "ram"]]);
  assert.equal(r.value.requests[0].dueDate, "2027-02-05");
  assert.equal(r.value.requests[1].state, "LATE");
});

test("a person who may not see the team's work gets no requests either", async () => {
  const r = await new ListTeamWorkHandler(queue, reconciler, clock).handle({ ...ctx, tenant: { ...ctx.tenant, role: "VIEWER" } }, "p1");
  assert.equal(r.ok, false);
});
