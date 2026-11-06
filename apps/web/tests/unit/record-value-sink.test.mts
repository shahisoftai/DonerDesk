import test from "node:test";
import assert from "node:assert/strict";
import { createValueSink, NOTHING_KEPT_MESSAGE } from "../../src/features/record/adapters/value-sink.ts";
import type { ValueInput } from "../../src/features/record/ports/record-sink.ts";
import type { OutboxEntry } from "../../src/features/offline/domain/outbox.ts";
import { offlineRow } from "../../src/features/reporting/domain/quick-entry-view.ts";

const input: ValueInput = { indicatorId: "i1", code: "A1", date: "2026-11-06", periodId: "p1", periodLabel: "November 2026", value: " 320 " };
const saved = { id: "u", reportingPeriodId: "p1", chosenBy: "DATE" as const, cumulative: "", cumulativeSource: "NONE" as const, outcome: "SAVED_DRAFT" as const, notices: ["A running total was suggested."] };

function harness(send: (p: Record<string, unknown>) => Promise<never> | Promise<unknown>, canQueue = true) {
  const queued: OutboxEntry[] = [];
  const sent: Array<Record<string, unknown>> = [];
  const sink = createValueSink({
    send: (p) => { sent.push(p); return send(p) as never; },
    enqueue: async (e) => void queued.push(e),
    canQueue, newId: () => "entry-1", now: () => 1000,
  });
  return { sink, queued, sent };
}

test("with a connection the number is saved on the server and nothing is queued", async () => {
  const h = harness(async () => ({ ok: true, value: saved }));
  const r = await h.sink.saveValue(input);
  assert.deepEqual(r, { ok: true, value: { queued: false, code: "A1", periodLabel: "November 2026", reportingPeriodId: "p1", notices: ["A running total was suggested."] } });
  assert.deepEqual(h.queued, []);
  assert.deepEqual(h.sent[0], { indicatorId: "i1", date: "2026-11-06", periodAchievement: "320" }, "the value is trimmed; empty optionals are not sent");
});

test("the note, source and breakdown are sent when given", async () => {
  const h = harness(async () => ({ ok: true, value: saved }));
  await h.sink.saveValue({ ...input, note: " n ", source: " s ", disaggregation: [{ dimension: "SEX", category: "Female", value: "180" }] });
  assert.deepEqual(h.sent[0], { indicatorId: "i1", date: "2026-11-06", periodAchievement: "320", comments: "n", dataSource: "s", disaggregation: [{ dimension: "SEX", category: "Female", value: "180" }] });
});

test("no connection keeps the number on the phone, with the row the sheet's save would send", async () => {
  const h = harness(async () => ({ ok: false, error: { kind: "unavailable", message: "You appear to be offline.", retryable: true } }));
  const r = await h.sink.saveValue({ ...input, disaggregation: [{ dimension: "SEX", category: "Female", value: "180" }] });
  assert.deepEqual(r, { ok: true, value: { queued: true, code: "A1", periodLabel: "November 2026", reportingPeriodId: "p1", notices: [] } });
  assert.equal(h.queued.length, 1);
  const entry = h.queued[0]!;
  assert.equal(entry.kind, "indicator-values");
  assert.equal(entry.id, "entry-1", "the entry id is the idempotency key, so a repeated send is stored once");
  assert.equal(entry.title, "A1: 320");
  assert.deepEqual(entry.payload, { periodId: "p1", rows: [offlineRow({ indicatorId: "i1", value: "320", disaggregation: [{ dimension: "SEX", category: "Female", value: "180" }] })] });
});

test("a refusal from the server is shown as it is and never queued", async () => {
  const h = harness(async () => ({ ok: false, error: { kind: "validation", message: "That report is locked.", fields: {} } }));
  assert.deepEqual(await h.sink.saveValue(input), { ok: false, message: "That report is locked." });
  assert.deepEqual(h.queued, []);
});

test("a device that cannot keep the number says so instead of pretending", async () => {
  const h = harness(async () => ({ ok: false, error: { kind: "unavailable", message: "x", retryable: true } }), false);
  assert.deepEqual(await h.sink.saveValue(input), { ok: false, message: NOTHING_KEPT_MESSAGE });
  assert.deepEqual(h.queued, []);
});

test("offlineRow carries a breakdown only when there is one", () => {
  assert.equal("disaggregation" in offlineRow({ indicatorId: "i", value: "1" }), false);
  assert.equal("disaggregation" in offlineRow({ indicatorId: "i", value: "1", disaggregation: [] }), false);
  assert.deepEqual((offlineRow({ indicatorId: "i", value: "1", disaggregation: [{ dimension: "SEX", category: "F", value: "1" }] }) as { disaggregation: unknown }).disaggregation, [{ dimension: "SEX", category: "F", value: "1" }]);
});
