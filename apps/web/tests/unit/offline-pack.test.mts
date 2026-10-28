import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryPackStore, describePackFreshness, packFromServer, packsFor, suggestPackPlaces } from "../../src/features/offline/domain/offline-pack.ts";
import { collectionRecordEntry, createCollectionRecordSender } from "../../src/features/offline/domain/collection-outbox.ts";

const DAY = 86_400_000;
const pack = (over = {}) => packFromServer({
  userId: "u1", userName: "Amina", projectId: "p1", projectName: "WASH", generatedAt: "2026-10-01T00:00:00Z",
  forms: [{ id: "f1", name: "Distribution", fields: [] }],
  places: [{ id: "a", name: "Gulu", path: "Gulu › Uganda" }, { id: "b", name: "Gulu", path: "Gulu › South Sudan" }, { id: "c", name: "Kampala", path: "Kampala › Uganda" }, { id: "d", name: "Bugulu", path: "Bugulu › Uganda" }],
  ...over,
});

test("a pack says how old it is, and an old one asks to be downloaded again without blocking", () => {
  const p = pack();
  const t0 = Date.parse("2026-10-01T00:00:00Z");
  assert.deepEqual(describePackFreshness(p, t0 + 3600_000), { stale: false, sentence: "Downloaded today." });
  assert.equal(describePackFreshness(p, t0 + 3 * DAY).sentence, "Downloaded 3 days ago.");
  assert.equal(describePackFreshness(p, t0 + DAY).sentence, "Downloaded 1 day ago.");
  const old = describePackFreshness(p, t0 + 20 * DAY);
  assert.equal(old.stale, true);
  assert.match(old.sentence, /Download it again/);
});

test("place suggestions come from the pack: names that start with the text first, same names both listed with their paths", () => {
  const p = pack();
  assert.deepEqual(suggestPackPlaces(p.places, "gul").map((x) => x.id), ["a", "b", "d"]);
  assert.deepEqual(suggestPackPlaces(p.places, "gulu uganda").map((x) => x.id), ["a", "d"], "the path narrows it to the Gulu in Uganda");
  assert.deepEqual(suggestPackPlaces(p.places, "g"), [], "one letter suggests nothing");
  assert.deepEqual(suggestPackPlaces(p.places, "KAMPÁLA").map((x) => x.id), ["c"], "accents and case do not matter");
});

test("packs belong to the person who downloaded them", async () => {
  const store = createMemoryPackStore();
  await store.put(pack());
  await store.put(pack({ userId: "u2", projectId: "p2", projectName: "Health" }));
  assert.deepEqual(packsFor(await store.list(), "u1").map((x) => x.projectId), ["p1"]);
  await store.remove("p1");
  assert.equal((await store.list()).length, 1);
  await store.clear();
  assert.equal((await store.list()).length, 0);
});

const save = async () => undefined;
const entry = () => collectionRecordEntry({ id: "rec-key-0001", title: "Distribution", payload: { formId: "f1", answers: { day: "2026-10-03", kits: 4 }, files: [{ fieldKey: "photo", name: "p.png", type: "image/png", blob: new Blob(["x"]) }] }, now: 1 });

test("a queued record sends its photo first, then the answers with the photo's id and its own key", async () => {
  const calls: unknown[] = [];
  const saved: unknown[] = [];
  const send = createCollectionRecordSender({
    uploadFile: async (formId, file) => (calls.push(["upload", formId, file.name]), { ok: true, value: { id: "file-id-0001" } }),
    submit: async (formId, input) => (calls.push(["submit", formId, input]), { ok: true, value: {} }),
  });
  assert.deepEqual(await send(entry(), async (patch) => void saved.push(patch)), { kind: "sent" });
  assert.deepEqual(calls, [["upload", "f1", "p.png"], ["submit", "f1", { id: "rec-key-0001", answers: { day: "2026-10-03", kits: 4, photo: "file-id-0001" } }]]);
  assert.equal(saved.length, 1, "progress is saved after the upload");
});

test("a retry does not upload a photo twice", async () => {
  const e = entry();
  e.payload.uploaded = { photo: "file-id-0001" };
  const calls: string[] = [];
  const send = createCollectionRecordSender({
    uploadFile: async () => (calls.push("upload"), { ok: true, value: { id: "x" } }),
    submit: async () => (calls.push("submit"), { ok: true, value: {} }),
  });
  await send(e, save);
  assert.deepEqual(calls, ["submit"]);
});

test("no connection or a signed-out phone keeps it waiting; a closed form parks it with the reason", async () => {
  const down = createCollectionRecordSender({ uploadFile: async () => ({ ok: false, error: { kind: "unavailable", message: "You are offline.", retryable: true } }), submit: async () => ({ ok: true, value: {} }) });
  assert.deepEqual(await down(entry(), save), { kind: "offline", message: "You are offline." });
  const signedOut = createCollectionRecordSender({ uploadFile: async () => ({ ok: true, value: { id: "i" } }), submit: async () => ({ ok: false, error: { kind: "unauthenticated", message: "x" } }) });
  assert.deepEqual(await signedOut(entry(), save), { kind: "offline", message: "Sign in again to send this." });
  const closed = createCollectionRecordSender({ uploadFile: async () => ({ ok: true, value: { id: "i" } }), submit: async () => ({ ok: false, error: { kind: "conflict", message: "This form is not open for answers." } }) });
  assert.deepEqual(await closed(entry(), save), { kind: "rejected", message: "This form is not open for answers." });
});
