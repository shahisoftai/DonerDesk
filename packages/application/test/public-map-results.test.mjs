import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import { PublicDashboardMapResultsHandler } from "../dist/index.js";

const T = TenantId.create("tenant-pm");
const widgets = [
  { id: "w-results", kind: "MAP", projectId: "proj-1", map: { view: "RESULTS" } },
  { id: "w-activities", kind: "MAP", projectId: "proj-1", map: { view: "ACTIVITIES" } },
  { id: "w-chart", kind: "CHART", projectId: "proj-2" },
];
const setup = (over = {}) => {
  const calls = [];
  const repo = { findById: async (id, tenant) => (id === "d1" && String(tenant) === String(T) ? { ok: true, value: { widgets } } : { ok: true, value: null }) };
  const maps = { places: async () => undefined, activities: async () => undefined, results: async (ctx, projectId, options) => { calls.push({ ctx, projectId, options }); return over.results === undefined ? { level: options?.level, rows: [] } : over.results; } };
  return { handler: new PublicDashboardMapResultsHandler(repo, maps), calls };
};

test("a results map on the shared dashboard can be asked for another level and period; the project is the widget's own", async () => {
  const { handler, calls } = setup();
  const r = await handler.handle(T, "d1", { widgetId: "w-results", level: 3, periodId: "p9" });
  assert.deepEqual(r, { ok: true, value: { level: 3, rows: [] } });
  assert.deepEqual([calls[0].projectId, calls[0].options], ["proj-1", { level: 3, periodId: "p9" }]);
  assert.deepEqual([calls[0].ctx.tenant.role, calls[0].ctx.tenant.external, calls[0].ctx.tenant.userId], ["VIEWER", true, "share-link"], "the same read-only outside guest the link already draws as");
  assert.deepEqual((await handler.handle(T, "d1", { widgetId: "w-results", level: 1 })), { ok: true, value: { level: 1, rows: [] } });
  assert.deepEqual(calls[1].options, { level: 1 });
});

test("nothing but a results map is reachable: not the activity map, not a chart, not a widget that is not there", async () => {
  const { handler, calls } = setup();
  for (const id of ["w-activities", "w-chart", "nope", ""]) assert.equal((await handler.handle(T, "d1", { widgetId: id, level: 1 })).ok, false, id);
  assert.equal(calls.length, 0, "nothing was read for any of them");
});

test("a dashboard of another organisation, an unknown dashboard and a map the reader cannot answer are all 'not available'; a level outside 0-4 is refused", async () => {
  const { handler, calls } = setup();
  assert.equal((await handler.handle(TenantId.create("someone-else"), "d1", { widgetId: "w-results", level: 1 })).ok, false);
  assert.equal((await handler.handle(T, "d2", { widgetId: "w-results", level: 1 })).ok, false);
  for (const level of [-1, 5, 1.5, Number.NaN]) assert.equal((await handler.handle(T, "d1", { widgetId: "w-results", level })).ok, false, String(level));
  assert.equal(calls.length, 0);
  const silent = setup({ results: null });
  assert.equal((await silent.handler.handle(T, "d1", { widgetId: "w-results", level: 1 })).ok, true, "an empty answer is still an answer");
  const none = new PublicDashboardMapResultsHandler({ findById: async () => ({ ok: true, value: { widgets } }) }, { places: async () => undefined, activities: async () => undefined, results: async () => undefined });
  assert.equal((await none.handle(T, "d1", { widgetId: "w-results", level: 1 })).ok, false);
});
