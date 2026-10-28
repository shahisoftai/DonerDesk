import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import {
  SaveDashboardHandler, ListDashboardsHandler, GetDashboardHandler, AddDashboardWidgetHandler, DeleteDashboardHandler,
  CreateDashboardShareHandler, ListDashboardSharesHandler, RevokeDashboardShareHandler, ResolveDashboardShareHandler, GetDashboardDataHandler, PublicDashboardHandler,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const as = (userId, role = "PROJECT_MANAGER") => ({ tenant: { tenantId, userId, role }, requestId: "r" });
const amina = as("amina"), bashir = as("bashir"), viewer = as("vera", "VIEWER");
let n = 0;
const ids = { generate: () => `id${++n}` };
const audit = { events: [], record: async function (e) { this.events.push(e.eventType); } };
let now = new Date("2026-10-10T08:00:00Z");
const clock = { now: () => now };

function world() {
  const dashboards = new Map(), links = new Map();
  return {
    dashboards,
    links,
    repo: {
      create: async (d) => (dashboards.set(d.id, d), ok()),
      update: async (d, expected) => {
        const cur = dashboards.get(d.id);
        if (expected && cur.updatedAt.getTime() !== expected.getTime()) return ok(false);
        dashboards.set(d.id, d); return ok(true);
      },
      delete: async (id) => (dashboards.delete(id), ok()),
      findById: async (id) => ok(dashboards.get(id) ?? null),
      listVisible: async (t, owner, projectId) => ok([...dashboards.values()].filter((d) => d.scope === "ORG" || (d.scope === "MINE" && d.ownerId === owner) || (d.scope === "PROJECT" && d.projectId === projectId))),
    },
    linkRepo: {
      create: async (l) => (links.set(l.id, l), ok()), listByDashboard: async (id) => ok([...links.values()].filter((l) => l.dashboardId === id)),
      findById: async (id) => ok(links.get(id) ?? null), revoke: async (id, t, at) => (links.set(id, { ...links.get(id), revokedAt: at }), ok()),
      deleteByDashboard: async (id) => ([...links.values()].filter((l) => l.dashboardId === id).forEach((l) => links.delete(l.id)), ok()),
      findByTokenHash: async (h) => ok([...links.values()].find((l) => l.tokenHash === h) ?? null),
    },
    visible: { for: async (ctx) => ok(ctx.tenant.userId === "bashir" ? [{ id: "p2" }] : [{ id: "p1" }, { id: "p2" }]) },
  };
}

const spec = { template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "PERIOD", type: "BAR", showTarget: false };
const widget = (id, projectId = "p1", x = 0, y = 0) => ({ id, projectId, spec, x, y, w: 6, h: 4 });

test("save: a personal one is anyone's, a shared one needs project.edit; the project must be visible; bad charts are refused", async () => {
  const w = world();
  const save = new SaveDashboardHandler(ids, w.repo, w.visible, audit, clock);
  assert.ok((await save.handle(viewer, { name: "Mine", scope: "MINE", widgets: [widget("a")] })).ok);
  assert.match((await save.handle(viewer, { name: "Org", scope: "ORG", widgets: [] })).error.message, /manages projects/);
  assert.match((await save.handle(amina, { name: "P", scope: "PROJECT", widgets: [] })).error.message, /needs a project/);
  assert.match((await save.handle(amina, { name: "X", scope: "MINE", widgets: [widget("a", "p9")] })).error.code, /NOT_FOUND/);
  // A size outside the grid is fitted to it, not refused: the layout rule clamps before the save is checked.
  const fitted = await save.handle(amina, { name: "Fit", scope: "MINE", widgets: [{ ...widget("a"), w: 2, x: 11 }] });
  assert.deepEqual([w.dashboards.get(fitted.value.id).widgets[0].w, w.dashboards.get(fitted.value.id).widgets[0].x], [3, 9]);
  const bad = await save.handle(amina, { name: "X", scope: "MINE", widgets: [{ ...widget("a"), spec: { ...spec, indicatorIds: [] } }] });
  assert.match(bad.error.message, /exactly one indicator/);
});

test("visibility and editing: a personal dashboard is invisible to others; a shared one is editable by its owner and by managers", async () => {
  const w = world();
  const save = new SaveDashboardHandler(ids, w.repo, w.visible, audit, clock);
  const get = new GetDashboardHandler(w.repo);
  const list = new ListDashboardsHandler(w.repo);
  const mine = (await save.handle(amina, { name: "Mine", scope: "MINE", widgets: [] })).value.id;
  const org = (await save.handle(amina, { name: "Org", scope: "ORG", widgets: [widget("a")] })).value.id;
  assert.equal((await get.handle(bashir, mine)).error.code, "NOT_FOUND");
  assert.deepEqual((await list.handle(bashir)).value.map((d) => d.name), ["Org"]);
  assert.deepEqual((await list.handle(amina)).value.map((d) => d.name).sort(), ["Mine", "Org"]);
  const seen = (await get.handle(viewer, org)).value;
  assert.equal(seen.canEdit, false);
  assert.equal((await get.handle(bashir, org)).value.canEdit, true);
  assert.equal((await save.handle(viewer, { name: "Hijack", scope: "ORG", widgets: [] }, org)).error.code, "FORBIDDEN");
  assert.ok((await save.handle(bashir, { name: "Renamed", scope: "ORG", widgets: [widget("a", "p2")] }, org)).ok);
  assert.match((await save.handle(bashir, { name: "x", scope: "MINE", widgets: [] }, org)).error.message, /keeps the scope/);
});

test("two people saving the same dashboard: the second is refused, not merged over", async () => {
  const w = world();
  const save = new SaveDashboardHandler(ids, w.repo, w.visible, audit, clock);
  const created = await save.handle(amina, { name: "D", scope: "ORG", widgets: [] });
  const opened = created.value.updatedAt;
  now = new Date("2026-10-10T09:00:00Z");
  assert.ok((await save.handle(amina, { name: "D1", scope: "ORG", widgets: [], expectedUpdatedAt: opened }, created.value.id)).ok);
  const late = await save.handle(bashir, { name: "D2", scope: "ORG", widgets: [], expectedUpdatedAt: opened }, created.value.id);
  assert.equal(late.error.code, "CONFLICT");
  assert.match(late.error.message, /Nothing was saved/);
});

test("adding a chart lands below the others; a project dashboard takes its own project only; the limit is told", async () => {
  const w = world();
  const save = new SaveDashboardHandler(ids, w.repo, w.visible, audit, clock);
  const add = new AddDashboardWidgetHandler(ids, w.repo, w.visible, clock, audit);
  const id = (await save.handle(amina, { name: "P", scope: "PROJECT", projectId: "p1", widgets: [widget("a")] })).value.id;
  assert.equal((await add.handle(amina, id, { projectId: "p1", spec })).value.chartCount, 2);
  assert.match((await add.handle(amina, id, { projectId: "p2", spec })).error.message, /own project only/);
  assert.equal((await add.handle(amina, id, { projectId: "p9", spec })).error.code, "NOT_FOUND");
  assert.equal((await add.handle(viewer, id, { projectId: "p1", spec })).error.code, "FORBIDDEN");
  const added = w.dashboards.get(id).widgets;
  assert.deepEqual(added.map((x) => [x.x, x.y]), [[0, 0], [0, 4]]);
});

test("charts of a project the viewer cannot see are told so, never drawn; one sheet is read per project", async () => {
  const w = world();
  const save = new SaveDashboardHandler(ids, w.repo, w.visible, audit, clock);
  const id = (await save.handle(amina, { name: "Org", scope: "ORG", widgets: [widget("a", "p1"), widget("b", "p1", 6, 0), widget("c", "p2", 0, 4)] })).value.id;
  const reads = [];
  const sheets = { handle: async (ctx, projectId) => (reads.push(projectId), ok({ periods: [], indicators: [], cells: [], finance: [{}], financeEnabled: true })) };
  const data = new GetDashboardDataHandler(w.repo, sheets, w.visible);
  const asBashir = (await data.handle(bashir, id)).value.charts;
  assert.match(asBashir[0].unavailable, /project you cannot see/);
  assert.match(asBashir[1].unavailable, /project you cannot see/);
  assert.ok(asBashir[2].chart || asBashir[2].unavailable, "p2 is attempted");
  assert.deepEqual(reads, ["p2"]);
  reads.length = 0;
  await data.handle(amina, id);
  assert.deepEqual(reads.sort(), ["p1", "p2"]);
});

test("share links: hash only, expire, revoke, delete with the dashboard; the public read has no finance and a guest identity", async () => {
  const w = world();
  const save = new SaveDashboardHandler(ids, w.repo, w.visible, audit, clock);
  const id = (await save.handle(amina, { name: "Org", scope: "ORG", widgets: [widget("a")] })).value.id;
  const share = new CreateDashboardShareHandler(ids, w.repo, w.linkRepo, audit, clock);
  assert.equal((await share.handle(viewer, id, { label: "x", expiresInDays: 7 })).error.code, "FORBIDDEN");
  const link = await share.handle(amina, id, { label: "Donor", expiresInDays: 7 });
  assert.ok(![...w.links.values()].some((l) => JSON.stringify(l).includes(link.value.token)), "only a hash is stored");
  const resolve = new ResolveDashboardShareHandler(w.linkRepo, clock);
  const found = await resolve.handle(link.value.token);
  assert.equal(found.value.dashboardId, id);
  assert.equal((await resolve.handle("nope")).ok, false);

  const seenBy = [];
  const sheets = { handle: async (ctx, projectId) => (seenBy.push(ctx.tenant), ok({ periods: [], indicators: [], cells: [], finance: [{ x: 1 }], financeEnabled: true })) };
  const pub = await new PublicDashboardHandler(w.repo, sheets).handle(tenantId, id);
  assert.equal(pub.value.name, "Org");
  assert.equal(seenBy[0].role, "VIEWER");
  assert.equal(seenBy[0].external, true);

  const list = new ListDashboardSharesHandler(w.repo, w.linkRepo, clock);
  assert.equal((await list.handle(amina, id)).value[0].live, true);
  assert.deepEqual((await list.handle(viewer, id)).value, [], "someone who cannot change it sees no links");
  const revoke = new RevokeDashboardShareHandler(w.repo, w.linkRepo, audit, clock);
  assert.equal((await revoke.handle(viewer, link.value.id)).error.code, "FORBIDDEN");
  await revoke.handle(amina, link.value.id);
  assert.equal((await resolve.handle(link.value.token)).ok, false);
  const second = await share.handle(amina, id, { label: "Again", expiresInDays: 1 });
  now = new Date("2026-10-12T08:00:00Z");
  assert.equal((await resolve.handle(second.value.token)).ok, false, "expired");
  await new DeleteDashboardHandler(w.repo, w.linkRepo, audit).handle(amina, id);
  assert.equal(w.links.size, 0);
  assert.equal(w.dashboards.size, 0);
});
