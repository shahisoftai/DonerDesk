import { test } from "node:test";
import assert from "node:assert/strict";
import { activityEntry, createActivitySender, type ActivitySendDeps } from "../../src/features/offline/domain/activity-outbox.ts";
import { createMemoryOutboxStore, flushOutbox } from "../../src/features/offline/domain/outbox.ts";

const settings = { evidenceType: "PHOTO", confidentialityLevel: "INTERNAL", indicatorId: "" } as const;
const entry = (files: string[]) =>
  activityEntry({
    id: "form-1",
    title: "Hygiene session",
    now: 1,
    payload: {
      projectId: "p", reportingPeriodId: "rp", create: { activityTitle: "Hygiene session" },
      files: files.map((name) => ({ name, type: "image/png", blob: new Blob(["x"]), settings })),
    },
  });

function deps(over: Partial<ActivitySendDeps> = {}): ActivitySendDeps & { created: string[]; uploaded: string[] } {
  const created: string[] = [];
  const uploaded: string[] = [];
  return {
    created,
    uploaded,
    createActivity: async (_input, options) => { created.push(options.idempotencyKey); return { ok: true, value: { id: "act-1" } }; },
    uploadEvidence: async (form) => { uploaded.push((form.get("file") as File).name); return { ok: true, value: {} }; },
    ...over,
  };
}

test("an activity is created with the entry id as its idempotency key, then each file is uploaded against it", async () => {
  const d = deps();
  const store = createMemoryOutboxStore();
  await store.put(entry(["a.png", "b.png"]));
  const summary = await flushOutbox(store, createActivitySender(d));
  assert.deepEqual(d.created, ["form-1"]);
  assert.deepEqual(d.uploaded, ["a.png", "b.png"]);
  assert.equal(summary.sent, 1);
});

test("dropping offline after the activity exists resumes with only the missing files, and never creates twice", async () => {
  let online = false;
  const base = deps();
  const d: ActivitySendDeps = {
    ...base,
    uploadEvidence: async (form) => {
      const name = (form.get("file") as File).name;
      if (name === "b.png" && !online) return { ok: false, error: { kind: "unavailable", message: "offline", retryable: true } };
      base.uploaded.push(name);
      return { ok: true, value: {} };
    },
  };
  const store = createMemoryOutboxStore();
  await store.put(entry(["a.png", "b.png"]));
  const first = await flushOutbox(store, createActivitySender(d));
  assert.equal(first.offline, true);
  assert.deepEqual(base.uploaded, ["a.png"]);
  online = true;
  const second = await flushOutbox(store, createActivitySender(d));
  assert.equal(second.sent, 1);
  assert.deepEqual(base.created, ["form-1"]);
  assert.deepEqual(base.uploaded, ["a.png", "b.png"]);
});

test("a refused create is parked with the reason; a refused file does not stop the others and is named", async () => {
  const refusedCreate = deps({ createActivity: async () => ({ ok: false, error: { kind: "validation", message: "Summary is required", fields: {} } }) });
  const s1 = createMemoryOutboxStore();
  await s1.put(entry([]));
  const a = await flushOutbox(s1, createActivitySender(refusedCreate));
  assert.equal(a.needsAttention, 1);
  assert.equal((await s1.list())[0]!.lastError, "Summary is required");

  const base = deps();
  const d: ActivitySendDeps = { ...base, uploadEvidence: async (form) => ((form.get("file") as File).name === "big.png" ? { ok: false, error: { kind: "validation", message: "too large", fields: {} } } : (base.uploaded.push("ok.png"), { ok: true, value: {} })) };
  const s2 = createMemoryOutboxStore();
  await s2.put(entry(["big.png", "ok.png"]));
  const b = await flushOutbox(s2, createActivitySender(d));
  assert.equal(b.needsAttention, 1);
  assert.deepEqual(base.uploaded, ["ok.png"]);
  assert.match((await s2.list())[0]!.lastError!, /big\.png \(too large\)/);
});
