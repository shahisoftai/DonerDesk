import { test } from "node:test";
import assert from "node:assert/strict";
import { createDraftStore } from "../../src/lib/client/draft-store.ts";
import { createActivityDraftStore, emptyActivityDraft } from "../../src/features/activities/domain/activity-draft.ts";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

test("a typed activity is saved and comes back; an empty form leaves nothing behind", () => {
  const storage = memoryStorage();
  const store = createActivityDraftStore(storage, "p1");
  store.save({ ...emptyActivityDraft(), summary: "Held three clinics" });
  assert.equal(store.load()?.value.summary, "Held three clinics");
  store.save(emptyActivityDraft());
  assert.equal(storage.data.size, 0);
  assert.equal(store.load(), null);
});

test("drafts are per project and expire", () => {
  const storage = memoryStorage();
  let now = 1_000;
  const make = (id: string) => createDraftStore(storage, { key: `k.${id}`, ttlMs: 100, now: () => now, parse: (r) => (typeof r === "string" ? r : null), hasContent: (v) => v !== "" });
  make("a").save("text a");
  assert.equal(make("b").load(), null);
  now += 101;
  assert.equal(make("a").load(), null);
  assert.equal(storage.data.size, 0);
});

test("a corrupt or tampered draft is dropped, and broken storage is never an error", () => {
  const storage = memoryStorage();
  storage.data.set("donordesk.activity-draft.p1", "{not json");
  assert.equal(createActivityDraftStore(storage, "p1").load(), null);
  storage.data.set("donordesk.activity-draft.p1", JSON.stringify({ savedAt: Date.now(), value: { summary: 5, evil: "x", nextSteps: "go" } }));
  const loaded = createActivityDraftStore(storage, "p1").load();
  assert.equal(loaded?.value.summary, "");
  assert.equal(loaded?.value.nextSteps, "go");
  assert.equal("evil" in (loaded?.value ?? {}), false);
  const broken = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } };
  const store = createActivityDraftStore(broken, "p1");
  assert.equal(store.load(), null);
  assert.doesNotThrow(() => { store.save({ ...emptyActivityDraft(), summary: "s" }); store.clear(); });
  assert.equal(createActivityDraftStore(null, "p1").load(), null);
});
