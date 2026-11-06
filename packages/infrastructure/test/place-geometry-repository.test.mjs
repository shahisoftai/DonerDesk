// Drawn outlines and routes (Phase 41.6) on a scratch Postgres: the repository keeps every new column and clears them when told to,
// and the set / get / clear handlers work end to end with the real repository. Opt-in: PLACES_VERIFY_DATABASE_URL (a throwaway
// database that has had `prisma migrate deploy` run).
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { ClearPlaceGeometryHandler, GetPlaceGeometryHandler, SetPlaceGeometryHandler, placeGeometryKey } from "@donordesk/application";
import { PrismaPlaceRepository } from "../dist/repositories/places.js";

const url = process.env.PLACES_VERIFY_DATABASE_URL;
const skip = url ? false : "PLACES_VERIFY_DATABASE_URL not set";
const T = TenantId.create("tenant-geo");
const OTHER = TenantId.create("tenant-geo-other");

async function inRollback(prisma, work) {
  const sentinel = new Error("rollback");
  try {
    await prisma.$transaction(async (tx) => { await work(tx); throw sentinel; });
  } catch (e) { if (e !== sentinel) throw e; }
}
const withDb = (fn) => async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try { await inRollback(prisma, fn); } finally { await prisma.$disconnect(); }
};

const place = (id, over = {}) => ({ id, tenantId: T, name: `Place ${id}`, kind: "AREA", adminLevel: 4, aliases: [], archived: false, createdById: "u1", ...over });
const ctxFor = (tenantId) => ({ tenant: { tenantId, userId: "u1", role: "ADMIN" }, requestId: "r" });
const square = { type: "Polygon", coordinates: [[[32.1, 2.7], [32.2, 2.7], [32.2, 2.8], [32.1, 2.8], [32.1, 2.7]]] };

function fakeStorage() {
  const files = new Map();
  return {
    files,
    put: async ({ key, body }) => { files.set(key, Buffer.from(body)); return { url: key, key, size: body.length }; },
    read: async (key) => { if (!files.has(key)) throw new Error("missing"); return files.get(key); },
    remove: async (key) => { files.delete(key); },
    getSignedUrl: async (key) => key,
  };
}
const auditLog = () => { const events = []; return { events, record: async (e) => { events.push(e); } }; };

test("the repository keeps the shape columns and how a place was placed, and clears them when told to", { skip }, withDb(async (prisma) => {
  const repo = new PrismaPlaceRepository(prisma);
  await repo.createMany([place("a", { geometryKind: "POLYGON", geometryKey: placeGeometryKey("tenant-geo", "a"), geometryBytes: 321, placedBy: "MAP_DRAWN" }), place("b", { kind: "POINT", latitude: 2.77, longitude: 32.27, placedBy: "GPS" })]);
  const a = (await repo.findById("a", T)).value;
  assert.deepEqual([a.geometryKind, a.geometryKey, a.geometryBytes, a.placedBy], ["POLYGON", "places/tenant-geo/a.geojson", 321, "MAP_DRAWN"]);
  assert.equal((await repo.findById("b", T)).value.placedBy, "GPS");
  assert.equal((await repo.findById("b", T)).value.geometryKind, undefined);

  // An update that carries the fields keeps them; one that leaves them out clears every one (Prisma ignores undefined, so `?? null` must be written).
  assert.equal((await repo.update({ ...a, name: "Renamed" })).ok, true);
  const kept = (await repo.findById("a", T)).value;
  assert.deepEqual([kept.name, kept.geometryKind, kept.geometryBytes, kept.placedBy], ["Renamed", "POLYGON", 321, "MAP_DRAWN"]);
  const { geometryKind: _k, geometryKey: _g, geometryBytes: _b, placedBy: _p, ...bare } = kept;
  assert.equal((await repo.update(bare)).ok, true);
  const cleared = (await repo.findById("a", T)).value;
  assert.deepEqual([cleared.geometryKind, cleared.geometryKey, cleared.geometryBytes, cleared.placedBy], [undefined, undefined, undefined, undefined]);
  assert.equal((await repo.findById("a", OTHER)).value, null);
}));

test("set, get and clear a shape end to end: stored in the tenant's storage, never visible to another tenant, audited, idempotent", { skip }, withDb(async (prisma) => {
  const repo = new PrismaPlaceRepository(prisma);
  const storage = fakeStorage(), audit = auditLog();
  const set = new SetPlaceGeometryHandler(repo, storage, audit), get = new GetPlaceGeometryHandler(repo, storage), clear = new ClearPlaceGeometryHandler(repo, storage, audit);
  await repo.createMany([place("camp"), place("clinic", { kind: "POINT", latitude: 2.7, longitude: 32.2 })]);
  const ctx = ctxFor(T);

  const done = await set.handle(ctx, "camp", { geometry: square });
  assert.deepEqual(done.value, { kind: "POLYGON", vertices: 4 });
  assert.ok(storage.files.has("places/tenant-geo/camp.geojson"));
  const row = (await repo.findById("camp", T)).value;
  assert.deepEqual([row.geometryKind, row.placedBy, row.geometryKey], ["POLYGON", "MAP_DRAWN", "places/tenant-geo/camp.geojson"]);
  assert.equal(row.geometryBytes, storage.files.get("places/tenant-geo/camp.geojson").length);
  assert.deepEqual((await get.handle(ctx, "camp")).value, { kind: "POLYGON", geometry: square });

  // A route replaces the outline; the same file is overwritten, not duplicated.
  assert.equal((await set.handle(ctx, "camp", { geometry: { type: "LineString", coordinates: [[32.1, 2.7], [32.2, 2.8]] } })).value.kind, "LINE");
  assert.equal(storage.files.size, 1);

  assert.match((await set.handle(ctx, "clinic", { geometry: square })).error.message, /not an outline/);
  assert.match((await set.handle(ctx, "camp", { geometry: { type: "Polygon", coordinates: [[[0, 0], [4, 4], [4, 0], [0, 4], [0, 0]]] } })).error.message, /crosses itself/);
  assert.equal((await repo.findById("camp", T)).value.geometryKind, "LINE", "a refused shape changes nothing");
  assert.equal((await set.handle(ctxFor(OTHER), "camp", { geometry: square })).ok, false);
  assert.equal((await get.handle(ctxFor(OTHER), "camp")).ok, false);
  assert.equal((await set.handle({ ...ctx, tenant: { ...ctx.tenant, role: "VIEWER" } }, "camp", { geometry: square })).ok, false);

  assert.equal((await clear.handle(ctx, "camp")).ok, true);
  assert.equal(storage.files.size, 0);
  const after = (await repo.findById("camp", T)).value;
  assert.deepEqual([after.geometryKind, after.geometryKey, after.placedBy], [undefined, undefined, undefined]);
  assert.equal((await get.handle(ctx, "camp")).ok, false);
  assert.equal((await clear.handle(ctx, "camp")).ok, true, "clearing a place with no shape is not an error");
  assert.deepEqual(audit.events.map((e) => e.eventType), ["place.geometry_set", "place.geometry_set", "place.geometry_cleared"]);
}));
