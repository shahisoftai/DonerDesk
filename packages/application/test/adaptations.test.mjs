import test from "node:test";
import assert from "node:assert/strict";
import { RecordAdaptationHandler, UpdateAdaptationHandler, recordChunksFromAdaptations } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const ctx = { tenant: { tenantId: { toString: () => "t" }, userId: "u1" } };
const input = { recordedOn: "2026-03-02", whatChanged: "Moved drilling to the dry season", why: "Roads were flooded" };

function setup() {
  const store = new Map();
  const audits = [];
  const repo = {
    create: async (a) => (store.set(a.id, { ...a }), ok(a)),
    update: async (a) => (store.set(a.id, { ...a }), ok(a)),
    findById: async (id) => ok(store.get(id) ?? null),
  };
  const deps = {
    planned: { findById: async (id) => ok(id === "act1" ? { projectId: "p1" } : id === "other" ? { projectId: "p2" } : null) },
    indicators: { findById: async (id) => ok(id === "ind1" ? { projectId: "p1" } : null) },
    periods: { findById: async (id) => ok(id === "per1" ? { projectId: "p1" } : null) },
  };
  let n = 0;
  return {
    store, audits,
    record: new RecordAdaptationHandler({ generate: () => `a${++n}` }, repo, { record: async (e) => audits.push(e) }, deps),
    update: new UpdateAdaptationHandler(repo, { record: async (e) => audits.push(e) }, deps),
  };
}

test("an adaptation is recorded with its links and audited", async () => {
  const { record, store, audits } = setup();
  const r = await record.handle(ctx, "p1", { ...input, effectOnResults: " Three wells slip ", plannedActivityId: "act1", indicatorId: "ind1", reportingPeriodId: "per1" });
  assert.equal(r.ok, true);
  assert.deepEqual(store.get(r.value.id), { id: "a1", projectId: "p1", recordedOn: "2026-03-02", whatChanged: input.whatChanged, why: input.why, effectOnResults: "Three wells slip", plannedActivityId: "act1", indicatorId: "ind1", reportingPeriodId: "per1", recordedById: "u1" });
  assert.equal(audits[0].eventType, "project.adaptation.recorded");
});

test("a missing reason, a bad day, or a link from another project is refused", async () => {
  const { record } = setup();
  assert.equal((await record.handle(ctx, "p1", { ...input, why: " " })).ok, false);
  assert.equal((await record.handle(ctx, "p1", { ...input, recordedOn: "2026-13-01" })).ok, false);
  const wrong = await record.handle(ctx, "p1", { ...input, plannedActivityId: "other" });
  assert.equal(wrong.ok, false);
  assert.match(wrong.error.message, /planned activity/);
  assert.equal((await record.handle(ctx, "p1", { ...input, indicatorId: "nope" })).ok, false);
});

test("an update changes only what is sent; an empty effect or link clears it", async () => {
  const { record, update, store } = setup();
  const id = (await record.handle(ctx, "p1", { ...input, effectOnResults: "Slip", indicatorId: "ind1" })).value.id;
  assert.equal((await update.handle(ctx, id, { why: "Flooded roads and a strike" })).ok, true);
  assert.equal(store.get(id).why, "Flooded roads and a strike");
  assert.equal(store.get(id).whatChanged, input.whatChanged);
  assert.equal(store.get(id).indicatorId, "ind1");
  assert.equal((await update.handle(ctx, id, { effectOnResults: "", indicatorId: "" })).ok, true);
  assert.equal(store.get(id).effectOnResults, undefined);
  assert.equal(store.get(id).indicatorId, undefined);
  assert.equal((await update.handle(ctx, id, { why: "" })).ok, false);
  assert.equal((await update.handle(ctx, "missing", { why: "x" })).ok, false);
});

test("adaptations become records a claim about a change of plan can be checked against", () => {
  const chunks = recordChunksFromAdaptations([{ ...input }, { ...input, recordedOn: "2026-03-09", effectOnResults: "Three wells slip." }]);
  assert.deepEqual(chunks.map((c) => c.chunkId), ["record:adaptation:0", "record:adaptation:1"]);
  assert.match(chunks[1].text, /^On 2026-03-09: Moved drilling to the dry season\. The reason: Roads were flooded\. Effect on results: Three wells slip\.$/);
  assert.ok(chunks.every((c) => c.chunkId.startsWith("record:")));
});
