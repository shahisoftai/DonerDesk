// Boundary files an organisation uploads per country and level (Phase 41.7) on a scratch Postgres: the repository replaces rather than
// duplicates and keeps tenants apart, and upload / list / read / remove work end to end. Opt-in: PLACES_VERIFY_DATABASE_URL.
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { TenantId } from "@donordesk/domain";
import { BOUNDARY_LAYER_MAX_LAYERS } from "@donordesk/domain";
import { ListBoundaryLayersHandler, ReadBoundaryLayerHandler, RemoveBoundaryLayerHandler, UploadBoundaryLayerHandler, boundaryLayerKey } from "@donordesk/application";
import { PrismaTenantBoundaryLayerRepository } from "../dist/repositories/tenant-boundary-layer.js";

const url = process.env.PLACES_VERIFY_DATABASE_URL;
const skip = url ? false : "PLACES_VERIFY_DATABASE_URL not set";
const T = TenantId.create("tenant-bl");
const OTHER = TenantId.create("tenant-bl-other");

async function inRollback(prisma, work) {
  const sentinel = new Error("rollback");
  try { await prisma.$transaction(async (tx) => { await work(tx); throw sentinel; }); } catch (e) { if (e !== sentinel) throw e; }
}
const withDb = (fn) => async () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try { await inRollback(prisma, fn); } finally { await prisma.$disconnect(); }
};

const sq = (x, y) => ({ type: "Polygon", coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] });
const file = (...rows) => Buffer.from(JSON.stringify({ type: "FeatureCollection", features: rows.map(([ward, code, parent], i) => ({ type: "Feature", properties: { WARD: ward, CODE: code, PARENT: parent }, geometry: sq(32 + i, 0.3) })) }));
const fields = (over = {}) => ({ iso: "uga", countryName: "Uganda", adminLevel: 4, nameField: "WARD", pcodeField: "CODE", parentPcodeField: "PARENT", ...over });
const ctxFor = (tenantId, role = "ADMIN") => ({ tenant: { tenantId, userId: "u1", role }, requestId: "r" });
const record = (over = {}) => ({ id: "l1", tenantId: T, iso: "UGA", countryName: "Uganda", adminLevel: 4, name: "wards", nameField: "WARD", pcodeField: "CODE", parentPcodeField: "PARENT", storageKey: "k", sizeBytes: 10, featureCount: 2, uploadedById: "u1", updatedAt: new Date(), ...over });

function fakeStorage() {
  const files = new Map();
  return { files, put: async ({ key, body }) => { files.set(key, Buffer.from(body)); return { url: key, key, size: body.length }; }, read: async (key) => { if (!files.has(key)) throw new Error("missing"); return files.get(key); }, remove: async (key) => { files.delete(key); }, getSignedUrl: async (k) => k };
}
const auditLog = () => { const events = []; return { events, record: async (e) => { events.push(e); } }; };

test("the repository keeps one layer per country and level (a second save replaces it), clears optional fields, and keeps tenants apart", { skip }, withDb(async (prisma) => {
  const repo = new PrismaTenantBoundaryLayerRepository(prisma);
  await repo.save(record());
  await repo.save(record({ id: "ignored-on-update", name: "wards v2", featureCount: 9, pcodeField: null, parentPcodeField: null }));
  await repo.save(record({ id: "l2", adminLevel: 3, name: "sub-counties" }));
  const all = await repo.list(T);
  assert.deepEqual(all.map((l) => [l.adminLevel, l.name]), [[3, "sub-counties"], [4, "wards v2"]]);
  const four = await repo.find(T, "UGA", 4);
  assert.deepEqual([four.id, four.featureCount, four.pcodeField, four.parentPcodeField], ["l1", 9, null, null]);
  assert.equal(await repo.find(OTHER, "UGA", 4), null);
  assert.equal((await repo.list(OTHER)).length, 0);
  assert.equal(await repo.remove(T, "UGA", 4), true);
  assert.equal(await repo.remove(T, "UGA", 4), false);
  assert.equal(await repo.find(T, "UGA", 3).then((l) => l?.name), "sub-counties");
}));

test("upload, list, read and remove end to end: normalised in storage, replaced not duplicated, administrators only, tenants apart, audited", { skip }, withDb(async (prisma) => {
  const repo = new PrismaTenantBoundaryLayerRepository(prisma);
  const storage = fakeStorage(), audit = auditLog();
  const upload = new UploadBoundaryLayerHandler(storage, repo, audit), list = new ListBoundaryLayersHandler(repo), read = new ReadBoundaryLayerHandler(storage, repo), remove = new RemoveBoundaryLayerHandler(storage, repo, audit);
  const ctx = ctxFor(T);

  const first = await upload.handle(ctx, { ...fields(), fileName: "kampala-wards.geojson", buffer: file(["Kisenyi", "UG0101", "UG01"], ["Nakawa", "UG0102", "UG01"]) });
  assert.equal(first.ok, true);
  assert.deepEqual([first.value.iso, first.value.adminLevel, first.value.name, first.value.featureCount, first.value.hasCodes], ["UGA", 4, "kampala-wards", 2, true]);
  const key = boundaryLayerKey(T, "UGA", 4);
  assert.equal(key, "boundary-layers/tenant-bl/UGA-4.json");
  assert.deepEqual(JSON.parse(storage.files.get(key).toString()).features[0].properties, { name: "Kisenyi", id: "UG0101", parentId: "UG01" });
  assert.deepEqual((await read.handle(ctx, "uga", 4)).value, storage.files.get(key).toString());

  const again = await upload.handle(ctx, { ...fields({ pcodeField: undefined, parentPcodeField: undefined }), fileName: "v2.geojson", buffer: file(["Kisenyi"], ["Nakawa"], ["Ntinda"]) });
  assert.equal(again.value.featureCount, 3);
  assert.equal(again.value.hasCodes, false);
  assert.equal((await list.handle(ctx)).value.length, 1, "replaced, not duplicated");
  assert.equal(storage.files.size, 1);

  assert.match((await upload.handle(ctx, { ...fields(), buffer: file(["A", "1"], ["B", "1"]) })).error.message, /code 1 is used by two boundaries/);
  assert.equal((await list.handle(ctx)).value[0].featureCount, 3, "a refused file changes nothing");

  await assert.rejects(() => upload.handle(ctxFor(T, "VIEWER"), { ...fields(), buffer: file(["A", "1"]) }));
  assert.equal((await list.handle(ctxFor(T, "VIEWER"))).value.length, 1, "any member may see what their maps draw");
  assert.equal((await read.handle(ctxFor(OTHER), "UGA", 4)).ok, false);
  assert.deepEqual((await list.handle(ctxFor(OTHER))).value, []);
  await assert.rejects(() => remove.handle(ctxFor(T, "VIEWER"), "UGA", 4));

  assert.deepEqual((await remove.handle(ctx, "UGA", 4)).value, { removed: true });
  assert.equal(storage.files.size, 0);
  assert.deepEqual((await remove.handle(ctx, "UGA", 4)).value, { removed: false });
  assert.equal((await read.handle(ctx, "UGA", 4)).ok, false);
  assert.deepEqual(audit.events.map((e) => e.eventType), ["boundary_layer.uploaded", "boundary_layer.replaced", "boundary_layer.removed"]);
}));

test("an organisation keeps at most sixty boundary files; replacing one is always allowed", { skip }, withDb(async (prisma) => {
  const repo = new PrismaTenantBoundaryLayerRepository(prisma);
  const upload = new UploadBoundaryLayerHandler(fakeStorage(), repo, auditLog());
  const ctx = ctxFor(T);
  for (let i = 0; i < BOUNDARY_LAYER_MAX_LAYERS; i += 1) await repo.save(record({ id: `l${i}`, iso: `A${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`, adminLevel: 2 }));
  const over = await upload.handle(ctx, { ...fields({ iso: "ZZZ" }), buffer: file(["A", "1"]) });
  assert.match(over.error.message, /at most 60 boundary files/);
  const replace = await upload.handle(ctx, { ...fields({ iso: "AAA", adminLevel: 2 }), buffer: file(["A", "1"]) });
  assert.equal(replace.ok, true);
}));
