import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { GetHomeLayoutHandler, ResetHomeLayoutHandler, SaveHomeLayoutHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId) => ({ tenant: { tenantId, userId, role: "PROJECT_MANAGER" }, requestId: "r" });
const ANNA = ctxFor("anna"), BEN = ctxFor("ben");
const ok = (value) => ({ ok: true, value });
const LAYOUT = [{ key: "RISKS", span: 6, hidden: false }, { key: "MAP", span: 12, hidden: true }];

/** An in-memory repository with the real contract: create-if-absent, replace-if-still-the-version-read, scoped to person and variant. */
function world() {
  const rows = new Map(); const audit = []; let n = 0; let tick = 0;
  const key = (t, u, v) => `${t}|${u}|${v}`;
  const repo = {
    find: async (t, u, v) => ok(rows.get(key(t.toString(), u, v)) ?? null),
    save: async (row, expected) => {
      const k = key(row.tenantId.toString(), row.userId, row.variant); const cur = rows.get(k);
      if (expected === null) { if (cur) return ok(false); rows.set(k, { ...row, updatedAt: new Date(Date.UTC(2026, 10, 5, 0, 0, ++tick)) }); return ok(true); }
      if (!cur || cur.updatedAt.getTime() !== expected.getTime()) return ok(false);
      rows.set(k, { ...cur, layoutJson: row.layoutJson, updatedAt: new Date(Date.UTC(2026, 10, 5, 0, 0, ++tick)) }); return ok(true);
    },
    delete: async (t, u, v) => (rows.delete(key(t.toString(), u, v)), ok(undefined)),
  };
  const log = { record: async (e) => void audit.push(e) };
  const ids = { generate: () => `l${++n}` }; const clock = { now: () => new Date("2026-11-05T00:00:00Z") };
  return { rows, audit, get: new GetHomeLayoutHandler(repo), save: new SaveHomeLayoutHandler(ids, repo, log, clock), reset: new ResetHomeLayoutHandler(repo, log) };
}

test("a person with no saved layout gets null (the default shows), not an error", async () => {
  const w = world();
  assert.deepEqual((await w.get.handle(ANNA, "MANAGER")).value, { layout: null, updatedAt: null });
});

test("a saved layout is read back with its version, per Home variant", async () => {
  const w = world();
  const saved = await w.save.handle(ANNA, { variant: "MANAGER", layout: LAYOUT, expectedUpdatedAt: null });
  assert.equal(saved.ok, true);
  const read = (await w.get.handle(ANNA, "MANAGER")).value;
  assert.deepEqual(read.layout, LAYOUT);
  assert.equal(read.updatedAt, saved.value.updatedAt);
  assert.equal((await w.get.handle(ANNA, "DIRECTOR")).value.layout, null, "another variant is a different layout");
});

test("nobody reads or changes another person's layout", async () => {
  const w = world();
  await w.save.handle(ANNA, { variant: "MANAGER", layout: LAYOUT, expectedUpdatedAt: null });
  assert.equal((await w.get.handle(BEN, "MANAGER")).value.layout, null);
  await w.reset.handle(BEN, "MANAGER");
  assert.deepEqual((await w.get.handle(ANNA, "MANAGER")).value.layout, LAYOUT);
});

test("a second tab saving from an old version is refused with a plain sentence, and nothing is overwritten", async () => {
  const w = world();
  const first = (await w.save.handle(ANNA, { variant: "MANAGER", layout: LAYOUT, expectedUpdatedAt: null })).value.updatedAt;
  const winner = await w.save.handle(ANNA, { variant: "MANAGER", layout: [{ key: "MAP", span: 8, hidden: false }], expectedUpdatedAt: first });
  assert.equal(winner.ok, true);
  const stale = await w.save.handle(ANNA, { variant: "MANAGER", layout: LAYOUT, expectedUpdatedAt: first });
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, "CONFLICT");
  assert.deepEqual((await w.get.handle(ANNA, "MANAGER")).value.layout, [{ key: "MAP", span: 8, hidden: false }]);
  const again = await w.save.handle(ANNA, { variant: "MANAGER", layout: LAYOUT, expectedUpdatedAt: null });
  assert.equal(again.error.code, "CONFLICT", "claiming there was no layout when there is one is also a conflict");
});

test("reset removes the layout so the default returns; every change is audited without the layout's content", async () => {
  const w = world();
  await w.save.handle(ANNA, { variant: "MANAGER", layout: LAYOUT, expectedUpdatedAt: null });
  assert.equal((await w.reset.handle(ANNA, "MANAGER")).ok, true);
  assert.equal((await w.get.handle(ANNA, "MANAGER")).value.layout, null);
  assert.deepEqual(w.audit.map((e) => e.eventType), ["home_layout.saved", "home_layout.reset"]);
  assert.deepEqual(JSON.parse(w.audit[0].newValue), { variant: "MANAGER", panels: 2, hidden: 1 });
});

test("a stored value that no longer parses reads as no layout, never an error", async () => {
  const w = world();
  w.rows.set("tenant-a|anna|MANAGER", { id: "x", tenantId, userId: "anna", variant: "MANAGER", layoutJson: "{not json", updatedAt: new Date() });
  assert.equal((await w.get.handle(ANNA, "MANAGER")).value.layout, null);
});
