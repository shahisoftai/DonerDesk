import { test } from "node:test";
import assert from "node:assert/strict";
import { createPlanStatusSender, planStatusEntry } from "../../src/features/offline/domain/plan-status-outbox.ts";

const entry = (action: "START" | "COMPLETE" | "CANCEL" = "COMPLETE", reason?: string) =>
  planStatusEntry({ id: "e1", title: "Clinic visit", payload: { itemId: "pa1", action, ...(reason ? { reason } : {}) }, now: 1 });
const save = async () => undefined;

test("a queued status change is sent as it was made", async () => {
  const calls: unknown[] = [];
  const send = createPlanStatusSender({ changeStatus: async (itemId, input) => (calls.push([itemId, input]), { ok: true, value: true }) });
  assert.deepEqual(await send(entry("CANCEL", "Funding cut"), save), { kind: "sent" });
  assert.deepEqual(calls, [["pa1", { action: "CANCEL", reason: "Funding cut" }]]);
  await send(entry("START"), save);
  assert.deepEqual(calls[1], ["pa1", { action: "START" }], "no empty reason is sent");
});

test("no connection keeps it waiting; a refusal parks it with the reason", async () => {
  const offline = createPlanStatusSender({ changeStatus: async () => ({ ok: false, error: { kind: "unavailable", message: "You are offline." } }) });
  assert.deepEqual(await offline(entry(), save), { kind: "offline", message: "You are offline." });
  const refused = createPlanStatusSender({ changeStatus: async () => ({ ok: false, error: { kind: "validation", message: "Only an open activity can be marked done" } }) });
  assert.deepEqual(await refused(entry(), save), { kind: "rejected", message: "Only an open activity can be marked done" });
});

test("the entry starts waiting with the title the banner shows", () => {
  const e = entry();
  assert.deepEqual([e.kind, e.state, e.attempts, e.title], ["plan-status", "waiting", 0, "Clinic visit"]);
});

test("a Done made offline keeps the day it was made, so sending it later does not make the work look late", async () => {
  const calls: unknown[] = [];
  const send = createPlanStatusSender({ changeStatus: async (itemId, input) => (calls.push([itemId, input]), { ok: true, value: true }) });
  const done = planStatusEntry({ id: "e2", title: "Clinic visit", payload: { itemId: "pa1", action: "COMPLETE", completedOn: "2026-10-12" }, now: 1 });
  await send(done, save);
  assert.deepEqual(calls, [["pa1", { action: "COMPLETE", completedOn: "2026-10-12" }]]);
});
