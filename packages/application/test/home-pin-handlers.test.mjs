import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { AddHomePinHandler, ListHomePinsHandler, MoveHomePinHandler, SetDashboardFeaturedHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxFor = (userId, role) => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const ADMIN = ctxFor("admin", "ADMIN"), PM = ctxFor("pm", "PROJECT_MANAGER"), OTHER = ctxFor("other", "PROJECT_MANAGER");
const ok = (value) => ({ ok: true, value });

function world() {
  const dashboards = new Map([
    ["d-org", { id: "d-org", scope: "ORG", ownerId: "admin", widgets: [1, 2] }],
    ["d-mine", { id: "d-mine", scope: "MINE", ownerId: "admin", widgets: [] }],
    ["d-pm", { id: "d-pm", scope: "MINE", ownerId: "pm", widgets: [1] }],
  ]);
  const pins = []; const feats = []; const audit = []; let n = 0;
  const dash = { findById: async (id) => ok(dashboards.get(id) ?? null) };
  const pinRepo = {
    create: async (p) => (pins.push(p), ok(undefined)),
    listForUser: async (_t, u) => ok(pins.filter((p) => p.userId === u).sort((a, b) => a.position - b.position)),
    delete: async () => ok(undefined),
    setOrder: async (_t, u, order) => { order.forEach((id, i) => { const p = pins.find((x) => x.id === id && x.userId === u); if (p) p.position = i; }); return ok(undefined); },
  };
  const featRepo = { list: async () => ok([...feats]), add: async (f) => (feats.some((x) => x.dashboardId === f.dashboardId && x.audience === f.audience) || feats.push(f), ok(undefined)), remove: async (id) => (feats.splice(0, feats.length, ...feats.filter((f) => f.dashboardId !== id)), ok(undefined)) };
  const log = { record: async (e) => void audit.push(e) };
  const ids = { generate: () => `x${++n}` }; const clock = { now: () => new Date("2026-10-30T00:00:00Z") };
  return { pins, feats, audit, add: new AddHomePinHandler(ids, pinRepo, dash, log, clock), list: new ListHomePinsHandler(pinRepo, dash, featRepo), move: new MoveHomePinHandler(pinRepo), feature: new SetDashboardFeaturedHandler(ids, featRepo, dash, log, clock) };
}

test("a person pins only a dashboard they can open, once; a deleted target is shown as gone, not hidden", async () => {
  const w = world();
  assert.equal((await w.add.handle(PM, { kind: "DASHBOARD", ref: "d-mine" })).error.code, "NOT_FOUND", "someone else's personal dashboard is not theirs to pin");
  assert.equal((await w.add.handle(PM, { kind: "DASHBOARD", ref: "d-org" })).ok, true);
  assert.equal((await w.add.handle(PM, { kind: "DASHBOARD", ref: "d-org" })).ok, false);
  w.pins.push({ id: "p-gone", tenantId, userId: "pm", kind: "DASHBOARD", ref: "deleted", position: 5 });
  const l = (await w.list.handle(PM)).value.pins;
  assert.equal(l[0].available, true);
  assert.equal(l[1].available, false);
});

test("pins are reordered for the person alone", async () => {
  const w = world();
  await w.add.handle(PM, { kind: "DASHBOARD", ref: "d-org" });
  await w.add.handle(PM, { kind: "DASHBOARD", ref: "d-pm" });
  const [a, b] = (await w.list.handle(PM)).value.pins;
  assert.equal((await w.move.handle(OTHER, a.id, 1)).error.code, "NOT_FOUND");
  assert.equal((await w.move.handle(PM, a.id, 1)).ok, true);
  assert.deepEqual((await w.list.handle(PM)).value.pins.map((p) => p.id), [b.id, a.id]);
});

test("an administrator shows an organisation dashboard on everyone's Home; it appears for others after their own pins, once, and cannot be a personal one", async () => {
  const w = world();
  assert.equal((await w.feature.handle(PM, "d-org", ["*"])).error.code, "FORBIDDEN");
  assert.match((await w.feature.handle(ADMIN, "d-mine", ["*"])).error.message, /whole organisation/);
  assert.equal((await w.feature.handle(ADMIN, "d-org", ["*"])).ok, true);
  assert.equal(w.audit.at(-1).eventType, "dashboard.featured");
  await w.add.handle(OTHER, { kind: "DASHBOARD", ref: "d-org" });
  assert.equal((await w.list.handle(OTHER)).value.pins.filter((p) => p.ref === "d-org").length, 1, "pinned and featured shows once");
  const forPm = (await w.list.handle(PM)).value.pins;
  assert.deepEqual([forPm.length, forPm[0].shared], [1, true]);
  assert.equal((await w.feature.handle(ADMIN, "d-org", [])).ok, true);
  assert.equal((await w.list.handle(PM)).value.pins.length, 0);
});

test("a dashboard can be shown to chosen people only: they see it, others do not, and a later choice replaces the earlier one", async () => {
  const w = world();
  assert.equal((await w.feature.handle(ADMIN, "d-org", ["pm"])).ok, true);
  assert.deepEqual((await w.list.handle(PM)).value.pins.map((p) => [p.ref, p.shared]), [["d-org", true]]);
  assert.match((await w.list.handle(PM)).value.pins[0].detail, /shared with you/);
  assert.equal((await w.list.handle(OTHER)).value.pins.length, 0, "not shown to anyone else");
  assert.equal((await w.feature.handle(ADMIN, "d-org", ["other", "other"])).ok, true);
  assert.equal((await w.list.handle(PM)).value.pins.length, 0, "the choice was replaced, not added to");
  assert.equal((await w.list.handle(OTHER)).value.pins.length, 1);
  assert.equal((await w.feature.handle(ADMIN, "d-org", ["*", "pm"])).ok, true);
  assert.equal(w.feats.length, 1, "everyone absorbs the individual choices");
});
