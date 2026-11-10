import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import {
  AddPlaceFlowHandler, ListPlaceFlowsHandler, RemovePlaceFlowHandler, SubscribeToCanvasHandler, UnsubscribeFromCanvasHandler, RunCanvasSubscriptionsHandler,
  ListMyCanvasSubscriptionsHandler, InMemoryPresence, PRESENCE_TTL_MS, CanvasPresenceHandler, DatasetExtrasService,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-1");
const ok = (value) => ({ ok: true, value });
const ctxOf = (userId = "u1", role = "PROJECT_MANAGER") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const audit = () => { const events = []; return { events, record: async (e) => { events.push(e); } }; };
const clock = (iso = "2026-02-01T08:00:00Z") => ({ now: () => new Date(iso) });
const ids = () => { let n = 0; return { generate: () => `id${++n}` }; };
const place = (id, name, archived = false) => ({ id, name, kind: "AREA", adminLevel: 1, aliases: [], archived, tenantId, createdById: "u" });
const placeRepo = (list) => ({ list: async () => ok(list), findById: async () => ok(null), createMany: async () => ok(undefined), update: async () => ok(undefined) });
const flowRepo = (rows = []) => ({ rows, create: async (f) => { rows.push(f); return ok(undefined); }, delete: async (id, _t, projectId) => { const i = rows.findIndex((r) => r.id === id && r.projectId === projectId); if (i >= 0) rows.splice(i, 1); return ok(undefined); }, listByProject: async (_t, p) => ok(rows.filter((r) => r.projectId === p)) });

test("a movement needs two live places, is audited with ids only, and can be removed only from its own project", async () => {
  const flows = flowRepo(); const a = audit();
  const places = placeRepo([place("a", "Gulu"), place("b", "Kitgum"), place("c", "Old", true)]);
  const add = new AddPlaceFlowHandler(ids(), flows, places, a, clock());
  assert.equal((await add.handle(ctxOf(), "p1", { fromPlaceId: "a", toPlaceId: "c", what: "People", quantity: 5, unit: "people" })).ok, false, "an archived place is not a place to move to");
  assert.equal((await add.handle(ctxOf(), "p1", { fromPlaceId: "a", toPlaceId: "b", what: "People", quantity: 0, unit: "people" })).ok, false);
  const made = await add.handle(ctxOf(), "p1", { fromPlaceId: "a", toPlaceId: "b", what: "People", quantity: 300, unit: "households" });
  assert.equal(made.ok, true);
  assert.equal(made.value.from, "Gulu");
  assert.ok(!JSON.stringify(a.events).includes("People"), "what moves is not in the audit");
  const list = await new ListPlaceFlowsHandler(flows, places).handle(ctxOf("u1", "VIEWER"), "p1");
  assert.equal(list.value.flows.length, 1);
  assert.equal(list.value.canEdit, false);
  assert.equal((await add.handle(ctxOf("u1", "VIEWER"), "p1", { fromPlaceId: "a", toPlaceId: "b", what: "x", quantity: 1, unit: "" })).ok, false, "a viewer cannot change the list");
  await new RemovePlaceFlowHandler(flows, a).handle(ctxOf(), "other-project", made.value.id);
  assert.equal(flows.rows.length, 1, "another project's address does not remove it");
  await new RemovePlaceFlowHandler(flows, a).handle(ctxOf(), "p1", made.value.id);
  assert.equal(flows.rows.length, 0);
});

test("the dataset's movements carry the pins of each end and say nothing when the list cannot be read", async () => {
  const flows = flowRepo([{ id: "f1", tenantId, projectId: "p1", fromPlaceId: "a", toPlaceId: "b", what: "People", quantity: 10, unit: "people", createdById: "u", createdAt: new Date() }]);
  const places = placeRepo([{ ...place("a", "Gulu"), latitude: 2.7, longitude: 32.3 }, place("b", "Kitgum")]);
  const extras = new DatasetExtrasService({ handle: async () => ok([]) }, { findByProject: async () => ok([]) }, {}, undefined, places, undefined, undefined, undefined, undefined, flows);
  const rows = await extras.flows(ctxOf(), "p1");
  assert.deepEqual(rows[0], { from: "Gulu", to: "Kitgum", what: "People", quantity: 10, unit: "people", fromLatitude: 2.7, fromLongitude: 32.3 });
  const none = new DatasetExtrasService({ handle: async () => ok([]) }, { findByProject: async () => ok([]) }, {}, undefined, places);
  assert.equal(await none.flows(ctxOf(), "p1"), undefined);
});

const canvasRepo = (canvases) => ({ findById: async (id) => ok(canvases.find((c) => c.id === id) ?? null) });
const subRepo = (rows = []) => ({ rows,
  upsert: async (s) => { const i = rows.findIndex((r) => r.canvasId === s.canvasId && r.userId === s.userId); if (i >= 0) rows[i] = { ...rows[i], every: s.every }; else rows.push(s); return ok(undefined); },
  remove: async (c, _t, u) => { const i = rows.findIndex((r) => r.canvasId === c && r.userId === u); if (i >= 0) rows.splice(i, 1); return ok(undefined); },
  listForUser: async (_t, u) => ok(rows.filter((r) => r.userId === u)), listAll: async () => ok(rows), setSent: async (id, _t, at) => { rows.find((r) => r.id === id).lastSentAt = at; return ok(undefined); } });

test("a person subscribes only to a canvas they can see, choosing again changes the schedule, and nothing is sent to someone who lost access", async () => {
  const canvases = [{ id: "c1", scope: "ORG", ownerId: "u9", title: "Results" }, { id: "c2", scope: "MINE", ownerId: "u9", title: "Private" }];
  const rows = subRepo(); const a = audit();
  const sub = new SubscribeToCanvasHandler(ids(), rows, canvasRepo(canvases), a, clock());
  assert.equal((await sub.handle(ctxOf("u1"), "c2", "WEEKLY")).ok, false, "someone else's personal canvas does not exist for them");
  assert.equal((await sub.handle(ctxOf("u1"), "c1", "DAILY")).ok, false);
  assert.equal((await sub.handle(ctxOf("u1"), "c1", "WEEKLY")).ok, true);
  assert.equal((await sub.handle(ctxOf("u1"), "c1", "MONTHLY")).ok, true);
  assert.equal(rows.rows.length, 1);
  assert.equal((await new ListMyCanvasSubscriptionsHandler(rows).handle(ctxOf("u1"))).value.subscriptions[0].every, "MONTHLY");
  assert.equal((await new ListMyCanvasSubscriptionsHandler(rows).handle(ctxOf("u2"))).value.subscriptions.length, 0);
  const sent = [];
  const run = new RunCanvasSubscriptionsHandler(rows, canvasRepo(canvases), { send: async (n) => { sent.push(n); } }, clock("2026-03-15T08:00:00Z"));
  assert.equal((await run.handle(tenantId)).value.sent, 1);
  assert.equal(sent[0].recipientId, "u1");
  assert.equal(sent[0].message, "Results is ready to open with the latest figures.", "a title and a sentence, never a figure");
  assert.equal((await run.handle(tenantId)).value.sent, 0, "a repeat run does nothing until the next is due");
  canvases[0].scope = "MINE"; rows.rows[0].lastSentAt = new Date("2026-01-01");
  assert.equal((await run.handle(tenantId)).value.skipped, 1, "a canvas that became private is not sent to someone else");
  await new UnsubscribeFromCanvasHandler(rows, a).handle(ctxOf("u1"), "c1");
  assert.equal(rows.rows.length, 0);
});

test("presence lists others only, tells the room once when something changes, forgets the silent and the gone", () => {
  const p = new InMemoryPresence();
  const told = [];
  const off = p.subscribe("r", () => told.push("changed"));
  p.touch("r", { userId: "a", name: "Ada", blockId: null, editing: false }, 1000);
  p.touch("r", { userId: "a", name: "Ada", blockId: null, editing: false }, 2000);
  p.touch("r", { userId: "b", name: "Bo", blockId: "k1", editing: true }, 2000);
  assert.deepEqual(told, ["changed", "changed"], "a heartbeat that changes nothing tells nobody");
  assert.deepEqual(p.others("r", "a", 3000).map((x) => x.name), ["Bo"]);
  assert.deepEqual(p.others("r", "b", 3000).map((x) => x.name), ["Ada"]);
  assert.equal(p.others("r", "a", 2000 + PRESENCE_TTL_MS + 1).length, 0, "a person nobody has heard from is gone");
  p.leave("r", "b");
  assert.equal(told.length, 3);
  assert.equal(p.sweep(10 ** 9), 1);
  off();
});

test("only someone who can see a canvas can join it, and the name comes from the person's own record", async () => {
  const presence = new InMemoryPresence();
  const canvases = { handle: async (_ctx, id) => (id === "c1" ? ok({ id }) : { ok: false, error: new Error("not found") }) };
  const users = { findById: async (id) => ok({ name: id === "u1" ? "Ada Lovelace" : "Bo" }) };
  const handler = new CanvasPresenceHandler(presence, canvases, users);
  assert.equal((await handler.open(ctxOf("u1"), "nope")).ok, false);
  const a = await handler.open(ctxOf("u1"), "c1");
  const b = await handler.open(ctxOf("u2"), "c1");
  assert.deepEqual(a.value.others().map((x) => x.name), ["Bo"]);
  b.value.update({ blockId: "k", editing: true });
  assert.equal(a.value.others()[0].editing, true);
  b.value.close();
  assert.equal(a.value.others().length, 0);
});
