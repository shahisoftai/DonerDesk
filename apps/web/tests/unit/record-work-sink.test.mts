import test from "node:test";
import assert from "node:assert/strict";
import { createWorkSink, NEEDS_SIGNAL_MESSAGE, NOTHING_KEPT_MESSAGE } from "../../src/features/record/adapters/work-sink.ts";
import type { OutboxEntry } from "../../src/features/offline/domain/outbox.ts";

const offline = { ok: false, error: { kind: "unavailable", message: "x", retryable: true } } as never;
function harness(over: { complete?: () => Promise<never>; status?: () => Promise<never>; canQueue?: boolean } = {}) {
  const queued: OutboxEntry[] = [];
  const calls: Array<[string, Record<string, unknown>]> = [];
  const sink = createWorkSink({
    complete: (id, body) => { calls.push([`complete:${id}`, body]); return (over.complete ?? (async () => ({ ok: true, value: { activityId: "act-1" } })))() as never; },
    changeStatus: (id, body) => { calls.push([`status:${id}`, body]); return (over.status ?? (async () => ({ ok: true, value: true })))() as never; },
    enqueue: async (e) => void queued.push(e), canQueue: over.canQueue ?? true, newId: () => "e1", now: () => 5,
  });
  return { sink, queued, calls };
}

test("completing a planned item sends the day, people and note, trimmed and only when given", async () => {
  const h = harness();
  const r = await h.sink.completePlanned({ itemId: "i1", title: "Hygiene", finishedOn: "2026-11-06", people: " 42 ", note: "  " });
  assert.deepEqual(r, { ok: true, value: { activityId: "act-1" } });
  assert.deepEqual(h.calls[0], ["complete:i1", { finishedOn: "2026-11-06", people: "42" }]);
});

test("with no signal the one-step completion says it needs signal and queues nothing", async () => {
  const h = harness({ complete: async () => offline });
  assert.deepEqual(await h.sink.completePlanned({ itemId: "i1", title: "t", finishedOn: "2026-11-06" }), { ok: false, message: NEEDS_SIGNAL_MESSAGE });
  assert.deepEqual(h.queued, []);
});

test("a refusal of the completion is shown as it is", async () => {
  const h = harness({ complete: async () => ({ ok: false, error: { kind: "validation", message: "No reporting period covers that day.", fields: {} } }) as never });
  assert.deepEqual(await h.sink.completePlanned({ itemId: "i1", title: "t", finishedOn: "2026-11-06" }), { ok: false, message: "No reporting period covers that day." });
});

test("a status step goes straight through when online", async () => {
  const h = harness();
  assert.deepEqual(await h.sink.changeStatus({ itemId: "i1", title: "Hygiene", action: "CANCEL", reason: " Heavy rain " }), { ok: true, value: { queued: false } });
  assert.deepEqual(h.calls[0], ["status:i1", { action: "CANCEL", reason: "Heavy rain" }]);
});

test("a status step made with no signal is kept on the phone with its own day", async () => {
  const h = harness({ status: async () => offline });
  const r = await h.sink.changeStatus({ itemId: "i1", title: "Hygiene", action: "COMPLETE", completedOn: "2026-11-06" });
  assert.deepEqual(r, { ok: true, value: { queued: true } });
  assert.equal(h.queued.length, 1);
  assert.equal(h.queued[0]!.kind, "plan-status");
  assert.equal(h.queued[0]!.id, "e1");
  assert.deepEqual(h.queued[0]!.payload, { itemId: "i1", action: "COMPLETE", completedOn: "2026-11-06" });
});

test("a refused status step is never queued, and a device that cannot keep it says so", async () => {
  const refused = harness({ status: async () => ({ ok: false, error: { kind: "validation", message: "Only an open activity can be cancelled", fields: {} } }) as never });
  assert.deepEqual(await refused.sink.changeStatus({ itemId: "i1", title: "t", action: "CANCEL", reason: "r" }), { ok: false, message: "Only an open activity can be cancelled" });
  assert.deepEqual(refused.queued, []);
  const cannot = harness({ status: async () => offline, canQueue: false });
  assert.deepEqual(await cannot.sink.changeStatus({ itemId: "i1", title: "t", action: "START" }), { ok: false, message: NOTHING_KEPT_MESSAGE });
});
