import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { ListPlacesHandler, CreatePlaceHandler, UpdatePlaceHandler, ArchivePlaceHandler, ImportPlacesHandler, ResolvePlacesHandler, ListUnconfirmedLocationsHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const PM = ctxFor("pm", "PROJECT_MANAGER");
const VIEWER = ctxFor("v", "VIEWER");
const ok = (value) => ({ ok: true, value });

function world(usage = []) {
  const store = new Map();
  const audit = [];
  let n = 0;
  const repo = {
    list: async (t, o = {}) => ok([...store.values()].filter((p) => o.includeArchived || !p.archivedAt)),
    findById: async (id) => ok(store.get(id) ?? null),
    createMany: async (ps) => { for (const p of ps) store.set(p.id, p); return ok(undefined); },
    update: async (p) => { store.set(p.id, p); return ok(undefined); },
  };
  const ids = { generate: () => `p${++n}` };
  const log = { record: async (e) => void audit.push(e) };
  const reader = { distinctLocations: async () => ok(usage) };
  return {
    store, audit,
    list: new ListPlacesHandler(repo), create: new CreatePlaceHandler(ids, repo, log), update: new UpdatePlaceHandler(repo, log),
    archive: new ArchivePlaceHandler(repo, log, () => new Date("2026-10-28T00:00:00Z")), imp: new ImportPlacesHandler(ids, repo, log),
    resolve: new ResolvePlacesHandler(repo), unconfirmed: new ListUnconfirmedLocationsHandler(repo, reader),
  };
}
const area = (name, adminLevel, parentId, extra = {}) => ({ name, kind: "AREA", adminLevel, aliases: [], ...(parentId ? { parentId } : {}), ...extra });

test("only project editors change the list; everyone reads it; every change is audited", async () => {
  const w = world();
  assert.equal((await w.create.handle(VIEWER, area("Sudan", 0))).error.code, "FORBIDDEN");
  const sd = (await w.create.handle(PM, area("Sudan", 0))).value.id;
  assert.equal(w.audit.at(-1).eventType, "place.created");
  const listed = await w.list.handle(VIEWER);
  assert.equal(listed.value.places.length, 1);
  assert.equal(listed.value.canEdit, false);
  assert.equal((await w.update.handle(VIEWER, sd, { name: "X" })).error.code, "FORBIDDEN");
});

test("a place sits below its parent, and a pin makes it a point", async () => {
  const w = world();
  const sd = (await w.create.handle(PM, area("Sudan", 0))).value.id;
  const wn = (await w.create.handle(PM, area("White Nile", 1, sd))).value.id;
  assert.match((await w.create.handle(PM, area("Bad", 1, wn))).error.message, /must sit below/);
  const site = await w.create.handle(PM, area("Um Gargur", 4, wn, { latitude: 13.2, longitude: 32.7 }));
  assert.equal(w.store.get(site.value.id).kind, "POINT");
  const dto = (await w.list.handle(PM)).value.places.find((p) => p.name === "Um Gargur");
  assert.equal(dto.path, "Um Gargur › White Nile › Sudan");
});

test("update clears a field with null and keeps one that is omitted", async () => {
  const w = world();
  const sd = (await w.create.handle(PM, area("Sudan", 0, undefined, { code: "SD" }))).value.id;
  await w.update.handle(PM, sd, { name: "Republic of Sudan" });
  assert.equal(w.store.get(sd).code, "SD");
  await w.update.handle(PM, sd, { code: null });
  assert.equal(w.store.get(sd).code, undefined);
  assert.equal((await w.update.handle(PM, "nope", { name: "x" })).error.code, "NOT_FOUND");
});

test("archiving is refused while live places are inside; restore needs the parent back", async () => {
  const w = world();
  const sd = (await w.create.handle(PM, area("Sudan", 0))).value.id;
  const wn = (await w.create.handle(PM, area("White Nile", 1, sd))).value.id;
  assert.match((await w.archive.handle(PM, sd, true)).error.message, /still has 1 place inside/);
  assert.ok((await w.archive.handle(PM, wn, true)).ok);
  assert.ok((await w.archive.handle(PM, sd, true)).ok);
  assert.equal((await w.list.handle(PM)).value.places.length, 0);
  assert.equal((await w.list.handle(PM, { includeArchived: true })).value.places.length, 2);
  assert.match((await w.archive.handle(PM, wn, false)).error.message, /Bring back Sudan first/);
  assert.ok((await w.archive.handle(PM, sd, false)).ok);
  assert.ok((await w.archive.handle(PM, wn, false)).ok);
});

test("import previews without saving, then applies all at once; a bad row saves nothing", async () => {
  const w = world();
  const sheet = "Name,Level,Parent\nSudan,Country,\nWhite Nile,State,Sudan\nRabak,District,White Nile\n";
  const preview = await w.imp.handle(PM, { text: sheet, apply: false });
  assert.equal(preview.value.create.length, 3);
  assert.equal(preview.value.applied, false);
  assert.equal(w.store.size, 0);
  const applied = await w.imp.handle(PM, { text: sheet, apply: true });
  assert.equal(applied.value.applied, true);
  assert.equal(w.store.size, 3);
  assert.equal(w.audit.at(-1).eventType, "place.imported");
  const again = await w.imp.handle(PM, { text: sheet, apply: true });
  assert.equal(again.value.skipped.length, 3);
  assert.equal(again.value.applied, false);
  const bad = await w.imp.handle(PM, { text: "Name,Level,Parent\nA,District,Nowhere\n", apply: true });
  assert.equal(bad.value.problems.length, 1);
  assert.equal(w.store.size, 3);
});

test("resolve suggests and never changes; unconfirmed lists what no place answers to, most used first", async () => {
  const w = world([
    { text: "Rabak", sources: ["PLAN"], count: 6 },
    { text: "Sinja", sources: ["INDICATOR", "PLAN"], count: 9 },
    { text: "Singa", sources: ["PLAN"], count: 2 },
  ]);
  await w.imp.handle(PM, { text: "Name,Level,Parent\nSudan,Country,\nRabak,District,Sudan\nSinja,District,Sudan\nSinja,Community,Rabak\n", apply: true });
  const r = await w.resolve.handle(VIEWER, { texts: ["rabak", "Atlantis", "Sinja"] });
  assert.deepEqual(r.value.map((x) => x.status), ["RESOLVED", "UNRESOLVED", "AMBIGUOUS"]);
  assert.equal(r.value[0].place.path, "Rabak › Sudan");
  const queue = await w.unconfirmed.handle(VIEWER);
  assert.equal(queue.value.confirmed, 1);
  assert.deepEqual(queue.value.items.map((i) => [i.text, i.status]), [["Sinja", "AMBIGUOUS"], ["Singa", "UNRESOLVED"]]);
});

test("a place can be marked as a facility, shown as one, and unmarked; an unmarked place carries no flag", async () => {
  const w = world();
  const sd = (await w.create.handle(PM, area("Sudan", 0))).value.id;
  const clinic = (await w.create.handle(PM, area("Rabak Clinic", 4, sd, { facility: true, latitude: 13.2, longitude: 32.7 }))).value.id;
  const plain = (await w.create.handle(PM, area("Rabak", 2, sd))).value.id;
  const byId = async () => new Map((await w.list.handle(VIEWER)).value.places.map((p) => [p.id, p]));
  assert.equal((await byId()).get(clinic).facility, true);
  assert.equal((await byId()).get(plain).facility, undefined);
  assert.equal((await w.update.handle(PM, clinic, { facility: false })).ok, true);
  assert.equal((await byId()).get(clinic).facility, undefined);
  assert.equal((await w.update.handle(PM, plain, { facility: true })).ok, true);
  assert.equal((await byId()).get(plain).facility, true);
});
