import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { SeedPlacesFromBoundariesHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const VIEWER = ctxFor("v", "VIEWER");
const ok = (value) => ({ ok: true, value });

function world() {
  const store = new Map();
  const audit = [];
  let n = 0;
  const repo = {
    list: async (t, o = {}) => ok([...store.values()].filter((p) => o.includeArchived || !p.archivedAt)),
    findById: async (id) => ok(store.get(id) ?? null),
    createMany: async (ps) => { for (const p of ps) store.set(p.id, p); return ok(undefined); },
    update: async (p) => { store.set(p.id, p); return ok(undefined); },
  };
  return { store, audit, seed: new SeedPlacesFromBoundariesHandler({ generate: () => `p${++n}` }, repo, { record: async (e) => void audit.push(e) }) };
}
const input = (apply) => ({
  country: { name: "Uganda" },
  units: [
    { ref: "UG3", level: 1, name: "Northern" },
    { ref: "UG3064", parentRef: "UG3", level: 2, name: "Abim", code: "UG3064" },
  ],
  apply,
});

test("only project editors may seed", async () => {
  const w = world();
  assert.equal((await w.seed.handle(VIEWER, input(true))).error.code, "FORBIDDEN");
  assert.equal(w.store.size, 0);
});

test("a preview counts by level and saves nothing", async () => {
  const w = world();
  const r = await w.seed.handle(PM, input(false));
  assert.deepEqual(r.value.createdByLevel, { 0: 1, 1: 1, 2: 1 });
  assert.equal(r.value.applied, false);
  assert.equal(w.store.size, 0);
  assert.equal(w.audit.length, 0);
});

test("apply creates the places once, audited; a repeat creates nothing", async () => {
  const w = world();
  const first = await w.seed.handle(PM, input(true));
  assert.equal(first.value.applied, true);
  assert.equal(w.store.size, 3);
  assert.equal(w.audit.at(-1).eventType, "place.seeded");
  const again = await w.seed.handle(PM, input(true));
  assert.equal(again.value.applied, false);
  assert.equal(again.value.skipped, 2);
  assert.equal(w.store.size, 3);
});
