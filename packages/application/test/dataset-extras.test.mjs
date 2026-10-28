import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { DatasetExtrasService, ResolveDatasetsHandler, GetDashboardDataHandler, PublicDashboardHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ok = (value) => ({ ok: true, value });
const ctx = { tenant: { tenantId, userId: "amina", role: "PROJECT_MANAGER" }, requestId: "r" };
const day = (iso) => new Date(`${iso}T09:00:00Z`);

const plan = [
  { id: "1", title: "Drill", kind: "ACTIVITY", plannedStart: "2026-01-05", plannedEnd: "2026-02-20", status: "DONE", state: "DONE", signal: "DONE", signalLabel: "Done" },
  { id: "2", title: "Handover", kind: "MILESTONE", plannedStart: "2026-05-15", plannedEnd: "2026-05-15", status: "PLANNED", state: "ON_TIME", signal: "ON_TIME", signalLabel: "On time" },
];
const activities = [
  { status: "ACCEPTED", activityDate: day("2026-03-02") }, { status: "ACCEPTED", activityDate: day("2026-03-02") }, { status: "ACCEPTED", activityDate: day("2026-03-01") },
  { status: "DRAFT", activityDate: day("2026-03-05") }, { status: "REJECTED", activityDate: day("2026-03-06") }, { status: "WITHDRAWN", activityDate: day("2026-03-07") },
];
const lines = [
  { id: "l1", donorName: "USAID", category: "Equipment", currency: "USD", amountMinor: 100000 },
  { id: "l2", donorName: "", category: "Training", currency: "USD", amountMinor: 50050 },
];
const expenses = [{ budgetLineId: "l1", amountMinor: 25000 }, { budgetLineId: "l1", amountMinor: 15000 }];

function service({ planOk = true, actOk = true, budOk = true } = {}) {
  return new DatasetExtrasService(
    { handle: async () => (planOk ? ok(plan) : { ok: false, error: new Error("no") }) },
    { findByProject: async () => (actOk ? ok(activities) : { ok: false, error: new Error("no") }) },
    { findLinesByProject: async () => (budOk ? ok(lines) : { ok: false, error: new Error("no") }), findExpensesByLines: async () => ok(expenses), findLineById: async () => ok(null), findLinesByItem: async () => ok([]) },
  );
}

test("the plan, the activity days and the budget are read into the shapes the charts use", async () => {
  const s = service();
  assert.deepEqual((await s.plan(ctx, "p1")).map((r) => [r.title, r.start, r.end, r.signal]), [["Drill", "2026-01-05", "2026-02-20", "DONE"], ["Handover", "2026-05-15", "2026-05-15", "ON_TIME"]]);
  assert.deepEqual(await s.activityDays(ctx, "p1"), [{ date: "2026-03-01", count: 1 }, { date: "2026-03-02", count: 2 }], "only accepted activities, counted on their day, oldest first");
  assert.deepEqual(await s.budget(ctx, "p1"), [
    { donor: "USAID", category: "Equipment", currency: "USD", budgeted: 1000, spent: 400 },
    { donor: "", category: "Training", currency: "USD", budgeted: 500.5, spent: 0 },
  ]);
});

test("a source that cannot be read is undefined, never an empty list (the chart then says it is not available)", async () => {
  const s = service({ planOk: false, actOk: false, budOk: false });
  assert.equal(await s.plan(ctx, "p1"), undefined);
  assert.equal(await s.activityDays(ctx, "p1"), undefined);
  assert.equal(await s.budget(ctx, "p1"), undefined);
  const empty = new DatasetExtrasService({ handle: async () => ok([]) }, { findByProject: async () => ok([]) }, { findLinesByProject: async () => ok([]), findExpensesByLines: async () => ok([]), findLineById: async () => ok(null), findLinesByItem: async () => ok([]) });
  assert.deepEqual(await empty.budget(ctx, "p1"), [], "a project with no budget lines has an empty budget");
});

const sheet = { projectId: "p1", periods: [], indicators: [], cells: [], finance: [], financeEnabled: false };
const q = (sources) => ({ indicatorIds: [], measure: "PERIOD", includeDraft: true, ...(sources ? { sources } : {}) });

test("the dataset call attaches only the extra data a chart asked for, and reads each source once", async () => {
  let reads = [];
  const extras = { plan: async () => (reads.push("plan"), []), activityDays: async () => (reads.push("days"), []), budget: async () => (reads.push("budget"), []) };
  const h = new ResolveDatasetsHandler({ handle: async () => ok(sheet) }, { for: async () => ok([{ id: "p1" }]) }, extras);
  const r = await h.handle(ctx, [{ key: "a", projectId: "p1", query: q() }, { key: "b", projectId: "p1", query: q(["PLAN"]) }, { key: "c", projectId: "p1", query: q(["BUDGET", "ACTIVITY_DAYS"]) }]);
  const by = Object.fromEntries(r.value.datasets.map((d) => [d.key, d.dataset]));
  assert.equal(by.a.plan, undefined);
  assert.deepEqual(by.b.plan, []);
  assert.equal(by.b.budget, undefined);
  assert.deepEqual([by.c.budget, by.c.activityDays], [[], []]);
  assert.deepEqual(reads.sort(), ["budget", "days", "plan"]);
  const without = await new ResolveDatasetsHandler({ handle: async () => ok(sheet) }, { for: async () => ok([{ id: "p1" }]) }).handle(ctx, [{ key: "b", projectId: "p1", query: q(["PLAN"]) }]);
  assert.equal(without.value.datasets[0].dataset.plan, undefined, "without a provider nothing is attached");
});

test("a project the person cannot see never has its plan or budget read", async () => {
  let reads = 0;
  const extras = { plan: async () => (reads++, []), activityDays: async () => (reads++, []), budget: async () => (reads++, []) };
  const h = new ResolveDatasetsHandler({ handle: async () => ok(sheet) }, { for: async () => ok([]) }, extras);
  const r = await h.handle(ctx, [{ key: "a", projectId: "p9", query: q(["PLAN", "BUDGET"]) }]);
  assert.match(r.value.datasets[0].unavailable, /cannot see/);
  assert.equal(reads, 0);
});

test("a dashboard draws a Gantt, calendar and budget flow for a signed-in viewer, once per source, and never through a share link", async () => {
  let reads = 0;
  const extras = { plan: async () => (reads++, [{ id: "1", title: "Drill", kind: "ACTIVITY", start: "2026-01-05", end: "2026-02-20", status: "DONE", signal: "DONE", signalLabel: "Done" }]), activityDays: async () => [{ date: "2026-01-01", count: 1 }, { date: "2026-01-02", count: 2 }], budget: async () => [{ donor: "A", category: "X", currency: "USD", budgeted: 10, spent: 5 }, { donor: "B", category: "Y", currency: "USD", budgeted: 20, spent: 1 }] };
  const spec = (kind, template) => ({ version: 2, kind, dataset: { template, indicatorIds: [], measure: "PERIOD", showTarget: false, includeDraft: true } });
  const widgets = [
    { id: "g1", projectId: "p1", x: 0, y: 0, w: 6, h: 4, spec: spec("GANTT", "PLAN_TIMELINE") }, { id: "g2", projectId: "p1", x: 6, y: 0, w: 6, h: 4, spec: spec("GANTT", "PLAN_TIMELINE") },
    { id: "c", projectId: "p1", x: 0, y: 4, w: 6, h: 4, spec: spec("CALENDAR_HEATMAP", "ACTIVITY_DAYS") }, { id: "s", projectId: "p1", x: 6, y: 4, w: 6, h: 4, spec: spec("SANKEY", "BUDGET_FLOW") },
  ];
  const dash = { id: "d1", tenantId, scope: "MINE", ownerId: "amina", name: "x", widgets, createdAt: new Date(), updatedAt: new Date() };
  const repo = { findById: async () => ok(dash) };
  const mine = new GetDashboardDataHandler(repo, { handle: async () => ok(sheet) }, { for: async () => ok([{ id: "p1" }]) }, extras);
  const r = await mine.handle(ctx, "d1");
  const by = Object.fromEntries(r.value.charts.map((c) => [c.widgetId, c]));
  assert.ok(by.g1.chart && by.g2.chart && by.c.chart && by.s.chart, JSON.stringify(Object.values(by).map((c) => c.unavailable)));
  assert.equal(reads, 1, "the plan is read once however many charts use it");
  const link = await new PublicDashboardHandler(repo, { handle: async () => ok(sheet) }).handle(tenantId, "d1");
  for (const c of link.value.charts) assert.match(c.unavailable, /not available here/, "the plan, activity days and budget never go out through a link");
});

/* ---------- results by place ---------- */
const rollupRows = [
  { placeId: "s", name: "Sudan", path: "Sudan", adminLevel: 0, value: "1,500", partly: false },
  { placeId: "r", name: "Rabak", path: "Rabak › White Nile › Sudan", adminLevel: 2, value: "120.5", partly: true },
  { placeId: "k", name: "Kosti", path: "Kosti › White Nile › Sudan", adminLevel: 2, value: null, partly: false },
];
const placeRecords = [{ id: "s", latitude: 15.5, longitude: 32.5 }, { id: "r", latitude: 13.2, longitude: 32.7 }, { id: "k" }];
function placeService({ fail = false, levels = [] } = {}) {
  return new DatasetExtrasService(
    { handle: async () => ok([]) }, { findByProject: async () => ok([]) }, { findLinesByProject: async () => ok([]), findExpensesByLines: async () => ok([]), findLineById: async () => ok(null), findLinesByItem: async () => ok([]) },
    { handle: async (_c, _p, level) => (levels.push(level), fail ? { ok: false, error: new Error("no") } : ok({ level, indicators: [{ id: "i1", rollup: { rows: rollupRows } }] })) },
    { list: async () => ok(placeRecords) },
  );
}

test("an indicator's value by place carries the number, whether it is partly reported and the pin; nothing recorded stays null, never 0", async () => {
  const rows = await placeService().places(ctx, "p1", "i1", 2);
  assert.deepEqual(rows[0], { name: "Sudan", path: "Sudan", level: 0, value: 1500, partly: false, latitude: 15.5, longitude: 32.5 });
  assert.equal(rows[1].value, 120.5);
  assert.equal(rows[1].partly, true);
  assert.equal(rows[2].value, null);
  assert.equal("latitude" in rows[2], false, "a place with no pin has none");
});

test("places: an indicator the read does not know is an empty list, an unreadable read is undefined, and the level is kept inside the tree", async () => {
  assert.deepEqual(await placeService().places(ctx, "p1", "nope", 1), []);
  assert.equal(await placeService({ fail: true }).places(ctx, "p1", "i1", 1), undefined);
  const levels = [];
  const s = placeService({ levels });
  await s.places(ctx, "p1", "i1", 9);
  await s.places(ctx, "p1", "i1", -3);
  await s.places(ctx, "p1", "i1", 1.7);
  assert.deepEqual(levels, [4, 0, 1]);
  const bare = new DatasetExtrasService({ handle: async () => ok([]) }, { findByProject: async () => ok([]) }, { findLinesByProject: async () => ok([]), findExpensesByLines: async () => ok([]), findLineById: async () => ok(null), findLinesByItem: async () => ok([]) });
  assert.equal(await bare.places(ctx, "p1", "i1", 1), undefined, "without the place readers it is unavailable, not empty");
});

test("the dataset call reads places for the first indicator at the level asked for, only when asked", async () => {
  const calls = [];
  const extras = { plan: async () => [], activityDays: async () => [], budget: async () => [], places: async (_c, projectId, indicatorId, level) => (calls.push([projectId, indicatorId, level]), [{ name: "Sudan", path: "Sudan", level: 0, value: 1, partly: false }]) };
  const h = new ResolveDatasetsHandler({ handle: async () => ok(sheet) }, { for: async () => ok([{ id: "p1" }]) }, extras);
  const r = await h.handle(ctx, [{ key: "a", projectId: "p1", query: { ...q(["PLACES"]), indicatorIds: ["i1", "i2"], placeLevel: 0 } }, { key: "b", projectId: "p1", query: q() }, { key: "c", projectId: "p1", query: { ...q(["PLACES"]), indicatorIds: ["i9"] } }]);
  const by = Object.fromEntries(r.value.datasets.map((d) => [d.key, d.dataset]));
  assert.deepEqual(calls, [["p1", "i1", 0], ["p1", "i9", 1]], "level 1 when none is given");
  assert.equal(by.b.places, undefined);
  assert.equal(by.a.places.length, 1);
});

test("a dashboard draws a map chart with its map names and the regions to match, and reads each indicator and level once", async () => {
  let reads = 0;
  const extras = { plan: async () => [], activityDays: async () => [], budget: async () => [], places: async () => (reads++, [{ name: "Sudan", path: "Sudan", level: 0, value: 5, partly: false, latitude: 15, longitude: 32 }, { name: "Chad", path: "Chad", level: 0, value: 2, partly: false, latitude: 15, longitude: 19 }]) };
  const spec = (kind) => ({ version: 2, kind, dataset: { template: "RESULTS_BY_PLACE", indicatorIds: ["i1"], measure: "PERIOD", placeLevel: 0, showTarget: false, includeDraft: true } });
  const withInd = { ...sheet, indicators: [{ id: "i1", code: "I1", name: "x", level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "1", isRate: false }] };
  const widgets = [{ id: "m1", projectId: "p1", x: 0, y: 0, w: 6, h: 4, spec: spec("CHOROPLETH") }, { id: "m2", projectId: "p1", x: 6, y: 0, w: 6, h: 4, spec: spec("GRADUATED_SYMBOLS") }];
  const dash = { id: "d1", tenantId, scope: "MINE", ownerId: "amina", name: "x", widgets, createdAt: new Date(), updatedAt: new Date() };
  const r = await new GetDashboardDataHandler({ findById: async () => ok(dash) }, { handle: async () => ok(withInd) }, { for: async () => ok([{ id: "p1" }]) }, extras).handle(ctx, "d1");
  const by = Object.fromEntries(r.value.charts.map((c) => [c.widgetId, c]));
  assert.deepEqual(by.m1.chart.maps, ["donordesk-world"]);
  assert.deepEqual(by.m1.chart.regionNames, ["Sudan", "Chad"]);
  assert.deepEqual(by.m2.chart.maps, ["donordesk-world"]);
  assert.equal(reads, 1);
});
