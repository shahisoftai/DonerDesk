import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryOutboxStore, createSerialFlusher, flushOutbox, retryEntry, type OutboxEntry, type OutboxSender } from "../../src/features/offline/domain/outbox.ts";

const entry = (id: string, createdAt: number, over: Partial<OutboxEntry> = {}): OutboxEntry => ({ id, kind: "activity", title: id, payload: {}, createdAt, attempts: 0, state: "waiting", ...over });

async function storeWith(...entries: OutboxEntry[]) {
  const store = createMemoryOutboxStore();
  for (const e of entries) await store.put(e);
  return store;
}

test("sent entries leave the outbox, oldest first", async () => {
  const store = await storeWith(entry("b", 2), entry("a", 1));
  const order: string[] = [];
  const summary = await flushOutbox(store, async (e) => { order.push(e.id); return { kind: "sent" }; });
  assert.deepEqual(order, ["a", "b"]);
  assert.deepEqual(summary, { sent: 2, waiting: 0, needsAttention: 0, offline: false });
  assert.equal((await store.list()).length, 0);
});

test("offline stops the flush and keeps everything else untouched", async () => {
  const store = await storeWith(entry("a", 1), entry("b", 2));
  const seen: string[] = [];
  const summary = await flushOutbox(store, async (e) => { seen.push(e.id); return { kind: "offline", message: "no network" }; });
  assert.deepEqual(seen, ["a"]);
  assert.equal(summary.offline, true);
  assert.equal(summary.waiting, 2);
  const a = (await store.list()).find((e) => e.id === "a")!;
  assert.equal(a.attempts, 1);
  assert.equal(a.lastError, "no network");
  assert.equal(a.state, "waiting");
});

test("a refused entry is parked with its reason and the others still go; parked ones are not retried by themselves", async () => {
  const store = await storeWith(entry("a", 1), entry("b", 2));
  const send: OutboxSender = async (e) => (e.id === "a" ? { kind: "rejected", message: "Title is too short" } : { kind: "sent" });
  const first = await flushOutbox(store, send);
  assert.deepEqual(first, { sent: 1, waiting: 0, needsAttention: 1, offline: false });
  let calls = 0;
  await flushOutbox(store, async () => { calls += 1; return { kind: "sent" }; });
  assert.equal(calls, 0);
  await retryEntry(store, "a");
  const again = await flushOutbox(store, async () => ({ kind: "sent" }));
  assert.equal(again.sent, 1);
});

test("progress saved by the sender survives an interrupted send, and a thrown error counts as offline", async () => {
  const store = await storeWith(entry("a", 1, { payload: { createdActivityId: undefined } }));
  await flushOutbox(store, async (e, save) => {
    await save({ payload: { createdActivityId: "act-1" } });
    throw new Error("connection reset");
  });
  const kept = (await store.list())[0]!;
  assert.deepEqual(kept.payload, { createdActivityId: "act-1" });
  assert.equal(kept.lastError, "connection reset");
  assert.equal(kept.state, "waiting");
});

test("two flushes at once share one run", async () => {
  const store = await storeWith(entry("a", 1));
  let calls = 0;
  const flush = createSerialFlusher(store, async () => { calls += 1; await new Promise((r) => setTimeout(r, 10)); return { kind: "sent" }; });
  const [x, y] = await Promise.all([flush(), flush()]);
  assert.equal(calls, 1);
  assert.deepEqual(x, y);
});
