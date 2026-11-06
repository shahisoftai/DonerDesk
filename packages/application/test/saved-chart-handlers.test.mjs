import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { ListSavedChartsHandler, GetSavedChartHandler, SaveSavedChartHandler, DeleteSavedChartHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const as = (userId, role = "PROJECT_MANAGER") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const amina = as("amina"), bashir = as("bashir"), vera = as("vera", "VIEWER");
let n = 0;
const ids = { generate: () => `c${++n}` };
const audit = { events: [], record: async function (e) { this.events.push(e.eventType); } };
let now = new Date("2026-10-10T08:00:00Z");
const clock = { now: () => now };
const spec = (over = {}) => ({ version: 2, kind: "BAR", dataset: { template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "PERIOD", showTarget: false, includeDraft: true }, ...over });
const input = (over = {}) => ({ name: "Trainings", scope: "MINE", projectId: "p1", spec: spec(), ...over });

function world(visible = ["p1"]) {
  const charts = new Map();
  const repo = {
    create: async (c) => (charts.set(c.id, c), ok()),
    update: async (c, expected) => { const cur = charts.get(c.id); if (expected && cur.updatedAt.getTime() !== expected.getTime()) return ok(false); charts.set(c.id, c); return ok(true); },
    delete: async (id) => (charts.delete(id), ok()),
    findById: async (id) => ok(charts.get(id) ?? null),
    listForProject: async (_t, projectId, ownerId) => ok([...charts.values()].filter((c) => c.projectId === projectId && (c.scope === "PROJECT" || c.ownerId === ownerId))),
  };
  const vis = { for: async () => ok(visible.map((id) => ({ id }))) };
  return {
    charts, save: new SaveSavedChartHandler(ids, repo, vis, audit, clock), list: new ListSavedChartsHandler(repo, vis), get: new GetSavedChartHandler(repo, vis), del: new DeleteSavedChartHandler(repo, vis, audit),
  };
}

test("a chart is saved with its specification, never data, and listed for its owner only when personal", async () => {
  const w = world();
  const r = await w.save.handle(amina, input());
  assert.equal(r.ok, true);
  assert.equal(w.charts.get(r.value.id).spec.kind, "BAR");
  assert.ok(audit.events.includes("chart.created"));
  assert.equal((await w.list.handle(amina, "p1")).value.charts.length, 1);
  assert.equal((await w.list.handle(bashir, "p1")).value.charts.length, 0, "a personal chart is its owner's");
  assert.equal((await w.get.handle(bashir, r.value.id)).ok, false, "to anyone else it does not exist");
});

test("a project chart is shared with everyone who can see the project, and only someone who manages projects may make one", async () => {
  const w = world();
  const shared = await w.save.handle(amina, input({ scope: "PROJECT" }));
  assert.equal(shared.ok, true);
  assert.equal((await w.list.handle(bashir, "p1")).value.charts.length, 1);
  assert.equal((await w.list.handle(vera, "p1")).value.charts[0].canEdit, false, "a viewer can read it, not change it");
  const refused = await w.save.handle(vera, input({ scope: "PROJECT" }));
  assert.equal(refused.ok, false);
  assert.equal((await w.save.handle(vera, input())).ok, true, "a viewer may keep a personal chart");
});

test("the specification is checked by the shared validator: an impossible one is refused with its first problem", async () => {
  const w = world();
  const bad = await w.save.handle(amina, input({ spec: spec({ kind: "NOPE" }) }));
  assert.equal(bad.ok, false);
  assert.match(bad.error.message, /not offered/);
  const noAxis = await w.save.handle(amina, input({ spec: spec({ axes: { y: { min: 50 } } }) }));
  assert.equal(noAxis.ok, false, "a bar chart that does not start at zero");
  assert.equal((await w.save.handle(amina, input({ spec: spec({ kind: "SANKEY" }) }))).ok, false, "a kind we cannot draw yet");
  assert.equal((await w.save.handle(amina, input({ name: "   " }))).ok, false);
});

test("a chart can only name a project the saver can see", async () => {
  const w = world(["p1"]);
  assert.equal((await w.save.handle(amina, input({ projectId: "p2" }))).ok, false);
  assert.equal((await w.list.handle(amina, "p2")).ok, false);
});

test("a chart in a project the viewer can no longer see does not exist for them", async () => {
  const w = world(["p1"]);
  const r = await w.save.handle(amina, input({ scope: "PROJECT" }));
  const closed = { ...w, get: new GetSavedChartHandler({ findById: async (id) => ok(w.charts.get(id)) }, { for: async () => ok([]) }) };
  assert.equal((await closed.get.handle(bashir, r.value.id)).ok, false);
});

test("an update keeps the scope and project, needs the version it was opened at, and refuses a stale save", async () => {
  const w = world();
  const r = await w.save.handle(amina, input());
  const id = r.value.id;
  now = new Date("2026-10-10T09:00:00Z");
  const first = await w.save.handle(amina, input({ name: "Renamed", expectedUpdatedAt: r.value.updatedAt }), id);
  assert.equal(first.ok, true);
  assert.equal(w.charts.get(id).name, "Renamed");
  const stale = await w.save.handle(amina, input({ name: "Late", expectedUpdatedAt: r.value.updatedAt }), id);
  assert.equal(stale.ok, false);
  assert.match(stale.error.message, /Someone else has changed/);
  assert.equal(w.charts.get(id).name, "Renamed");
  assert.equal((await w.save.handle(amina, input({ scope: "PROJECT" }), id)).ok, false, "the scope is fixed at creation");
  assert.equal((await w.save.handle(amina, input({ projectId: "p9" }), id)).ok, false);
});

test("a project chart may be changed and deleted by someone who manages projects; a personal one only by its owner", async () => {
  const w = world();
  const shared = await w.save.handle(amina, input({ scope: "PROJECT" }));
  assert.equal((await w.save.handle(bashir, input({ scope: "PROJECT", name: "Bashir's edit" }), shared.value.id)).ok, true);
  assert.equal((await w.del.handle(vera, shared.value.id)).ok, false);
  const mine = await w.save.handle(amina, input());
  assert.equal((await w.del.handle(bashir, mine.value.id)).ok, false, "not found for anyone else");
  assert.equal((await w.del.handle(amina, mine.value.id)).ok, true);
  assert.equal(w.charts.has(mine.value.id), false);
  assert.equal((await w.del.handle(bashir, shared.value.id)).ok, true);
  assert.ok(audit.events.includes("chart.deleted"));
});

test("each change keeps the version it replaced (newest first, capped), a save that changes nothing keeps none, and only the single-chart read carries them", async () => {
  const w = world();
  const r = await w.save.handle(amina, input({ name: "First" }));
  const id = r.value.id;
  assert.deepEqual(w.charts.get(id).versions, [], "a new chart has no earlier versions");
  now = new Date("2026-10-11T08:00:00Z");
  await w.save.handle(amina, input({ name: "First" }), id);
  assert.equal(w.charts.get(id).versions.length, 0, "nothing changed");
  now = new Date("2026-10-11T09:00:00Z");
  await w.save.handle(amina, input({ name: "Second", spec: spec({ kind: "LINE" }) }), id);
  now = new Date("2026-10-11T10:00:00Z");
  await w.save.handle(amina, input({ name: "Third", spec: spec({ kind: "AREA" }) }), id);
  const versions = w.charts.get(id).versions;
  assert.deepEqual(versions.map((v) => [v.name, v.spec.kind]), [["Second", "LINE"], ["First", "BAR"]]);
  assert.equal(versions[0].at, "2026-10-11T10:00:00.000Z", "when it was replaced");
  assert.equal(versions[0].by, "amina");
  const one = await w.get.handle(amina, id);
  assert.deepEqual(one.value.versions.map((v) => v.name), ["Second", "First"]);
  assert.equal("versions" in (await w.list.handle(amina, "p1")).value.charts[0], false);
  for (let i = 0; i < 14; i += 1) { now = new Date(Date.UTC(2026, 9, 12, i)); await w.save.handle(amina, input({ name: `n${i}` }), id); }
  assert.equal(w.charts.get(id).versions.length, 10);
});
