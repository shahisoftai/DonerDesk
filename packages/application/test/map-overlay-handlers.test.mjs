import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { AddMapOverlayHandler, ListMapOverlaysHandler, ReadMapOverlayHandler, RemoveMapOverlayHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = (role) => ({ tenant: { tenantId, userId: "u1", role }, requestId: "r" });
const geo = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "Nile" }, geometry: { type: "LineString", coordinates: [[32, 13], [33, 14]] } }] });

function world() {
  const rows = new Map(); const files = new Map(); const audit = []; let n = 0;
  const repo = { create: async (o) => (rows.set(o.id, o), { ok: true, value: undefined }), list: async () => ({ ok: true, value: [...rows.values()] }), findById: async (id) => ({ ok: true, value: rows.get(id) ?? null }), delete: async (id) => (rows.delete(id), { ok: true, value: undefined }) };
  const storage = { put: async ({ key, body }) => void files.set(key, body), read: async (k) => { if (!files.has(k)) throw new Error("x"); return files.get(k); }, remove: async (k) => void files.delete(k) };
  const log = { record: async (e) => void audit.push(e) };
  const ids = { generate: () => `o${++n}` };
  return { rows, files, audit, add: new AddMapOverlayHandler(ids, storage, repo, log, { now: () => new Date("2026-10-30T00:00:00Z") }), list: new ListMapOverlaysHandler(repo), read: new ReadMapOverlayHandler(storage, repo), remove: new RemoveMapOverlayHandler(storage, repo, log) };
}

test("project editors add and remove overlays (audited); anyone who sees projects lists and reads them; a viewer cannot change them", async () => {
  const w = world();
  assert.equal((await w.add.handle(ctx("VIEWER"), { name: "Rivers", geojson: geo })).error.code, "FORBIDDEN");
  const a = await w.add.handle(ctx("PROJECT_MANAGER"), { name: "Rivers.kml", geojson: geo });
  assert.equal(a.ok, true);
  assert.equal(a.value.name, "Rivers");
  assert.equal(w.audit.at(-1).eventType, "map_overlay.added");
  const listed = await w.list.handle(ctx("VIEWER"));
  assert.deepEqual([listed.value.overlays.length, listed.value.canEdit], [1, false]);
  assert.match((await w.read.handle(ctx("VIEWER"), a.value.id)).value, /FeatureCollection/);
  assert.equal((await w.add.handle(ctx("PROJECT_MANAGER"), { name: "rivers", geojson: geo })).error.code, "CONFLICT", "a name is used once");
  assert.equal((await w.remove.handle(ctx("VIEWER"), a.value.id)).ok, false);
  assert.equal((await w.remove.handle(ctx("PROJECT_MANAGER"), a.value.id)).ok, true);
  assert.equal(w.files.size, 0, "the file goes with the overlay");
  assert.equal((await w.read.handle(ctx("VIEWER"), a.value.id)).error.code, "NOT_FOUND");
});
