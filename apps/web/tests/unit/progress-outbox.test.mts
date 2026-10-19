import { test } from "node:test";
import assert from "node:assert/strict";
import { createProgressSender, progressEntry, PROGRESS_LOG_KIND } from "../../src/features/offline/domain/progress-outbox.ts";

const entry = () => progressEntry({ id: "p1", title: "Screening: day of 5 Oct", payload: { itemId: "a1", input: { kind: "DAILY", key: "2026-10-05" } }, now: 1 });
const save = async () => undefined;

test("a queued progress entry is sent exactly as it was written", async () => {
  const calls: unknown[] = [];
  const send = createProgressSender({ save: async (itemId, input) => (calls.push([itemId, input]), { ok: true, value: { id: "e1", absorbed: 0 } }) });
  assert.deepEqual(await send(entry(), save), { kind: "sent" });
  assert.deepEqual(calls, [["a1", { kind: "DAILY", key: "2026-10-05" }]]);
});

test("no connection keeps it waiting; a refusal parks it with the reason and is not retried by itself", async () => {
  const offline = createProgressSender({ save: async () => ({ ok: false, error: { kind: "unavailable", message: "You are offline." } }) });
  assert.deepEqual(await offline(entry(), save), { kind: "offline", message: "You are offline." });
  const refused = createProgressSender({ save: async () => ({ ok: false, error: { kind: "conflict", message: "That day is already logged. Open that entry to change it." } }) });
  assert.deepEqual(await refused(entry(), save), { kind: "rejected", message: "That day is already logged. Open that entry to change it." });
});

test("the entry starts waiting under its own kind with the title the banner shows", () => {
  const e = entry();
  assert.deepEqual([e.kind, e.state, e.attempts, e.title], [PROGRESS_LOG_KIND, "waiting", 0, "Screening: day of 5 Oct"]);
});
