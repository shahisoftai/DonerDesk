import { test } from "node:test";
import assert from "node:assert/strict";
import { createIndicatorValuesSender, indicatorValuesEntry, INDICATOR_VALUES_KIND } from "../../src/features/offline/domain/indicator-values-outbox.ts";
import { createMemoryOutboxStore, flushOutbox } from "../../src/features/offline/domain/outbox.ts";

const rows = [{ indicatorId: "i1", expectedUpdatedAt: "2026-10-01T00:00:00.000Z", periodAchievement: "10", cumulativeAchievement: "50", comments: "", dataSource: "", notApplicableReason: "" }];
const entry = (id = "e1") => indicatorValuesEntry({ id, title: "Indicator values for Oct", payload: { periodId: "p1", rows }, now: 1 });

test("a queued save carries the period, the rows and the versions they were saved against", () => {
  const e = entry();
  assert.equal(e.kind, INDICATOR_VALUES_KIND);
  assert.equal(e.state, "waiting");
  assert.deepEqual(e.payload.rows[0], rows[0]);
});

test("a save that goes through is sent exactly as queued and leaves the outbox", async () => {
  const calls: unknown[] = [];
  const send = createIndicatorValuesSender({ bulkSave: async (periodId, r) => (calls.push([periodId, r]), { ok: true, value: {} }) });
  const store = createMemoryOutboxStore();
  await store.put(entry());
  const summary = await flushOutbox(store, send);
  assert.deepEqual(calls, [["p1", rows]]);
  assert.equal(summary.sent, 1);
  assert.equal((await store.list()).length, 0);
});

test("no connection keeps the save waiting; nothing is lost", async () => {
  const send = createIndicatorValuesSender({ bulkSave: async () => ({ ok: false, error: { kind: "unavailable", message: "No connection", retryable: true } as never }) });
  const store = createMemoryOutboxStore();
  await store.put(entry());
  const summary = await flushOutbox(store, send);
  assert.equal(summary.offline, true);
  assert.equal((await store.list()).length, 1);
  assert.equal((await store.list())[0]!.state, "waiting");
});

test("a save the server refuses (someone saved since) is parked with the reason and never retried by itself", async () => {
  const send = createIndicatorValuesSender({ bulkSave: async () => ({ ok: false, error: { kind: "conflict", message: "OUT-1 was changed by someone else." } as never }) });
  const store = createMemoryOutboxStore();
  await store.put(entry());
  const summary = await flushOutbox(store, send);
  assert.equal(summary.needsAttention, 1);
  const parked = (await store.list())[0]!;
  assert.equal(parked.state, "needs-attention");
  assert.match(parked.lastError ?? "", /changed by someone else/);
  const again = await flushOutbox(store, send);
  assert.equal(again.sent, 0, "a parked entry is not sent again by itself");
});
