import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, SECTOR_TEMPLATES, copyTemplate } from "@donordesk/domain";
import { ListDashboardTemplatesHandler, GetDashboardTemplateHandler, SaveDashboardTemplateHandler, DeleteDashboardTemplateHandler, ApplyDashboardTemplateHandler, SaveDashboardHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const as = (userId, role = "PROJECT_MANAGER") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const amina = as("amina"), vera = as("vera", "VIEWER");
let n = 0;
const ids = { generate: () => `id${++n}` };
const audit = { events: [], record: async function (e) { this.events.push(e.eventType); } };
let now = new Date("2026-10-10T08:00:00Z");
const clock = { now: () => now };
const wash = SECTOR_TEMPLATES.find((t) => t.id === "tpl-wash-access-hygiene");
const body = (t, over = {}) => ({ title: t.title, description: t.description, sector: t.sector, audience: t.audience, roles: t.roles, widgets: t.widgets, ...over });

function world() {
  const rows = new Map();
  const repo = {
    create: async (t) => (rows.set(t.id, t), ok()),
    update: async (t, expected) => { const cur = rows.get(t.id); if (expected && cur.updatedAt.getTime() !== expected.getTime()) return ok(false); rows.set(t.id, t); return ok(true); },
    delete: async (id) => (rows.delete(id), ok()),
    findById: async (id) => ok(rows.get(id) ?? null),
    list: async () => ok([...rows.values()]),
  };
  const dashboards = new Map();
  const dashRepo = { create: async (d) => (dashboards.set(d.id, d), ok()), update: async () => ok(true), delete: async () => ok(), findById: async (id) => ok(dashboards.get(id) ?? null), listVisible: async () => ok([...dashboards.values()]) };
  const visible = { for: async () => ok([{ id: "p1" }]) };
  const save = new SaveDashboardHandler(ids, dashRepo, visible, audit, clock);
  return { rows, dashboards, list: new ListDashboardTemplatesHandler(repo), get: new GetDashboardTemplateHandler(repo), put: new SaveDashboardTemplateHandler(ids, repo, audit, clock), del: new DeleteDashboardTemplateHandler(repo, audit), apply: new ApplyDashboardTemplateHandler(ids, repo, save) };
}

test("the built-in templates are listed as drafts that cannot be changed in place; the organisation's own come first and can", async () => {
  const w = world();
  const first = await w.list.handle(amina);
  assert.equal(first.value.templates.length, SECTOR_TEMPLATES.length);
  assert.ok(first.value.templates.every((t) => t.origin === "BUILT_IN" && t.canEdit === false));
  const made = await w.put.handle(amina, body(copyTemplate(wash, { id: "x" }), { basedOn: wash.id }));
  assert.equal(made.ok, true);
  const after = await w.list.handle(amina);
  assert.equal(after.value.templates[0].origin, "ORGANISATION");
  assert.equal(after.value.templates[0].basedOn, wash.id);
  assert.equal(after.value.templates[0].canEdit, true);
  assert.equal((await w.list.handle(vera)).value.templates[0].canEdit, false, "a viewer can read it, not change it");
  const one = await w.get.handle(amina, made.value.id);
  assert.equal(one.value.canEdit, true);
  assert.equal((await w.get.handle(amina, wash.id)).value.canEdit, false);
  assert.equal((await w.get.handle(amina, "nope")).ok, false);
});

test("only someone who manages projects changes templates; a template that cannot be applied cannot be saved", async () => {
  const w = world();
  assert.equal((await w.put.handle(vera, body(wash))).ok, false);
  assert.equal((await w.put.handle(amina, body(wash, { title: " " }))).ok, false);
  const badRole = body(wash, { widgets: [{ id: "x", kind: "CHART", title: "T", x: 0, y: 0, w: 6, h: 4, chart: { kind: "BAR", template: "INDICATOR_OVER_TIME", roleKeys: ["nope"], measure: "PERIOD", showTarget: false } }] });
  const refused = await w.put.handle(amina, badRole);
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /role that is not in the template/);
  assert.equal((await w.put.handle(amina, body(wash, { sector: "NOPE" }))).ok, false);
});

test("a template is updated with its revision counted, refuses a stale save, and can be deleted", async () => {
  const w = world();
  const made = await w.put.handle(amina, body(wash));
  assert.equal(made.value.revision, 1);
  now = new Date("2026-10-10T09:00:00Z");
  const next = await w.put.handle(amina, body(wash, { title: "Our WASH", expectedUpdatedAt: made.value.updatedAt }), made.value.id);
  assert.equal(next.value.revision, 2);
  assert.equal(w.rows.get(made.value.id).template.title, "Our WASH");
  const stale = await w.put.handle(amina, body(wash, { title: "Late", expectedUpdatedAt: made.value.updatedAt }), made.value.id);
  assert.equal(stale.ok, false);
  assert.match(stale.error.message, /Someone else has changed/);
  assert.equal((await w.del.handle(vera, made.value.id)).ok, false);
  assert.equal((await w.del.handle(amina, made.value.id)).ok, true);
  assert.equal(w.rows.size, 0);
  assert.equal((await w.del.handle(amina, made.value.id)).ok, false);
  assert.ok(audit.events.includes("dashboard_template.created") && audit.events.includes("dashboard_template.deleted"));
});

test("applying a template makes a dashboard of the charts whose roles are chosen, names the ones left out, and keeps text blocks", async () => {
  const w = world();
  const withText = { ...wash, widgets: [...wash.widgets, { id: "note", kind: "TEXT", title: "Note", text: "Figures are cumulative.", x: 6, y: 12, w: 6, h: 2 }] };
  w.rows.set("mine", { id: "mine", tenantId, ownerId: "amina", template: { ...withText, id: "mine", origin: "ORGANISATION" }, createdAt: now, updatedAt: now });
  const r = await w.apply.handle(amina, "mine", { projectId: "p1", name: "WASH view", scope: "MINE", mapping: { people_basic_water: "i1" } });
  assert.equal(r.ok, true, r.error?.message);
  const dash = w.dashboards.get(r.value.dashboardId);
  const kinds = dash.widgets.map((x) => x.kind);
  assert.ok(kinds.includes("TEXT"));
  assert.ok(dash.widgets.some((x) => x.spec?.version === 2 && x.spec.dataset.indicatorIds.includes("i1")));
  assert.ok(dash.widgets.every((x) => x.projectId === "p1"));
  const titles = r.value.chartsLeftOut.map((c) => c.title);
  assert.ok(titles.length >= 2, "charts whose roles were not chosen are named, never drawn from a guess");
  assert.ok(r.value.chartsLeftOut.every((c) => c.missingRoles.length > 0));
  assert.ok(!dash.widgets.some((x) => x.spec && JSON.stringify(x.spec).includes("people_basic_sanitation")), "no role key leaks into a spec");
});

test("a built-in template applies too; with no role chosen nothing can be drawn and the person is told to choose; a project the person cannot see is refused", async () => {
  const w = world();
  const none = await w.apply.handle(amina, wash.id, { projectId: "p1", name: "x", scope: "MINE", mapping: {} });
  assert.equal(none.ok, true, "the status chart needs no role");
  assert.ok(none.value.chartsLeftOut.length >= 5);
  const noStatus = world();
  noStatus.rows.set("t", { id: "t", tenantId, ownerId: "amina", template: { ...wash, id: "t", origin: "ORGANISATION", widgets: wash.widgets.filter((x) => x.id === "trend-1") }, createdAt: now, updatedAt: now });
  const empty = await noStatus.apply.handle(amina, "t", { projectId: "p1", name: "x", scope: "MINE", mapping: {} });
  assert.equal(empty.ok, false);
  assert.match(empty.error.message, /choose which indicators/);
  assert.equal((await w.apply.handle(amina, wash.id, { projectId: "p9", name: "x", scope: "MINE", mapping: { people_basic_water: "i1" } })).ok, false);
  assert.equal((await w.apply.handle(amina, "missing", { projectId: "p1", name: "x", scope: "MINE", mapping: {} })).ok, false);
  assert.equal((await w.apply.handle(vera, wash.id, { projectId: "p1", name: "x", scope: "PROJECT", mapping: { people_basic_water: "i1" } })).ok, false, "a viewer cannot make a shared dashboard");
});
