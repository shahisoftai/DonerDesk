import test from "node:test";
import assert from "node:assert/strict";
import { TenantId } from "@donordesk/domain";
import {
  VisualDataService, QueryVisualDataHandler, GetVisualDataCatalogueHandler, GetVisualDataVersionHandler, createSourceReaders, withDataVersioning,
} from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctxOf = (role = "PROJECT_MANAGER") => ({ tenant: { tenantId, userId: "u1", role }, requestId: "r" });

const sheet = {
  projectId: "p1",
  periods: [{ id: "m1", label: "Jan", start: "2026-01-01", end: "2026-01-31", reportType: "MONTHLY", locked: false }, { id: "m2", label: "Feb", start: "2026-02-01", end: "2026-02-28", reportType: "MONTHLY", locked: false }],
  indicators: [{ id: "a", code: "A", name: "Trained", level: "OUTPUT", type: "COUNT", baseline: "0", target: "100", isRate: false }],
  cells: [{ indicatorId: "a", periodId: "m1", periodValue: "10", cumulativeValue: "10", status: "VERIFIED" }, { indicatorId: "a", periodId: "m2", periodValue: "5", cumulativeValue: "15", status: "DRAFT" }],
  finance: [],
};
const extras = {
  plan: async () => [{ id: "x", title: "Training", kind: "ACTIVITY", start: "2026-01-01", end: "2026-01-02", status: "PLANNED", signal: "ON_TIME", signalLabel: "On time" }],
  activityDays: async () => [{ date: "2026-01-02", count: 3 }],
  budget: async () => [{ donor: "D", category: "Staff", currency: "USD", budgeted: 100, spent: 40 }],
};

function service({ visible = ["p1"], sheetOk = true, withExtras = true } = {}) {
  const calls = { sheet: 0 };
  const versions = { read: async () => ({ epoch: "e1", versions: { "indicator-values": 4 } }), bump: async () => {} };
  const s = new VisualDataService(
    createSourceReaders(withExtras ? extras : undefined),
    { handle: async () => { calls.sheet++; return sheetOk ? { ok: true, value: sheet } : { ok: false, error: new Error("down") }; } },
    { for: async () => ({ ok: true, value: visible.map((id) => ({ id })) }) },
    versions, () => new Date("2026-11-09T10:00:00Z"),
  );
  return { s, calls, versions };
}
const q = (over = {}) => ({ source: "indicator-values", measures: ["period_value"], groupBy: ["period"], includeDraft: false, ...over });

test("a sound question is answered with a table, the sources it read, their versions and the time", async () => {
  const { s } = service();
  const r = await s.query(ctxOf(), "p1", q());
  assert.equal(r.ok, true);
  assert.equal(r.value.state, "ready");
  assert.deepEqual(r.value.table.rows, [{ period: "Jan", period_value: 10 }, { period: "Feb", period_value: null }]);
  assert.ok(r.value.table.notes.some((n) => /not verified yet/.test(n)), "the withheld draft is named");
  assert.deepEqual(r.value.versions, { "indicator-values": 4 });
  assert.equal(r.value.asOf, "2026-11-09T10:00:00.000Z");
});

test("a refused question is a validation error with a plain sentence; nothing is read", async () => {
  const { s, calls } = service();
  const r = await s.query(ctxOf(), "p1", q({ measures: ["rate_value"], aggregate: { rate_value: "SUM" } }));
  assert.equal(r.ok, false);
  assert.match(r.error.message, /never added up/);
  assert.equal(calls.sheet, 0);
});

test("a project the person cannot see, a source their role cannot open and a guest on a money source are all unavailable, not empty", async () => {
  const hidden = await service({ visible: [] }).s.query(ctxOf(), "p1", q());
  assert.deepEqual(hidden.value, { state: "unavailable", reason: "This is from a project you cannot see." });
  const spending = { source: "spending", measures: ["spent"], groupBy: ["category"], currency: "USD", includeDraft: false };
  const noRole = await service().s.query(ctxOf("COMPLIANCE_OFFICER"), "p1", { source: "tasks", measures: ["task_count"], groupBy: [], includeDraft: false });
  assert.equal(noRole.value.state, "unavailable");
  const guest = await service().s.query(ctxOf("VIEWER"), "p1", spending, { guest: true });
  assert.match(guest.value.reason, /share link/);
});

test("the data sheet is read once for a question that touches several sources", async () => {
  const { s, calls } = service();
  const r = await s.query(ctxOf(), "p1", q({ groupBy: ["indicator"], measures: ["period_value", "disaggregation.group_value"] }));
  assert.equal(r.value.state, "ready");
  assert.equal(calls.sheet, 1);
});

test("extras-backed sources answer; a source with no reader or an unfilled field says it is being connected", async () => {
  const { s } = service();
  const plan = await s.query(ctxOf(), "p1", { source: "plan", measures: ["activity_count"], groupBy: ["delivery_state"], includeDraft: true });
  assert.deepEqual(plan.value.table.rows, [{ delivery_state: "On time", activity_count: 1 }]);
  const money = await s.query(ctxOf(), "p1", { source: "spending", measures: ["spent"], groupBy: ["category"], currency: "USD", includeDraft: true });
  assert.deepEqual(money.value.table.rows, [{ category: "Staff", spent: 40 }]);
  const risks = await s.query(ctxOf(), "p1", { source: "risks", measures: ["risk_count"], groupBy: [], includeDraft: true });
  assert.match(risks.value.reason, /being connected/);
  const gap = await s.query(ctxOf(), "p1", q({ measures: ["life_of_project"] }));
  assert.match(gap.value.reason, /not available from indicator values yet/);
  const noExtras = await service({ withExtras: false }).s.query(ctxOf(), "p1", { source: "plan", measures: ["activity_count"], groupBy: [], includeDraft: true });
  assert.match(noExtras.value.reason, /being connected/);
});

test("when the sheet cannot be read the answer says so instead of an empty table", async () => {
  const r = await service({ sheetOk: false }).s.query(ctxOf(), "p1", q());
  assert.deepEqual(r.value, { state: "unavailable", reason: "The data for this could not be read just now." });
});

test("the catalogue shows what is connected and what the role may open", () => {
  const readers = createSourceReaders(extras);
  const handler = new GetVisualDataCatalogueHandler(readers);
  const r = handler.handle(ctxOf("VIEWER"), "people reached");
  const byId = Object.fromEntries(r.value.sources.map((x) => [x.id, x]));
  assert.equal(byId["indicator-values"].connected, true);
  assert.equal(byId["risks"].connected, false);
  assert.equal(byId["indicator-values"].fields.find((f) => f.id === "life_of_project").available, false);
  assert.equal(byId["tasks"].allowed, false, "a viewer cannot open tasks");
  assert.ok(r.value.hits.some((h) => h.source === "reach"));
});

test("versions are read only for projects the person can see, and bumped from the audit trail without ever failing the change", async () => {
  const store = new Map();
  const versions = { read: async (t, p) => ({ epoch: "e", versions: store.get(`${t}:${p}`) ?? {} }), bump: async (t, p, sources) => { const v = { ...(store.get(`${t}:${p}`) ?? {}) }; for (const s of sources) v[s] = (v[s] ?? 0) + 1; store.set(`${t}:${p}`, v); } };
  const events = [];
  const audit = withDataVersioning({ record: async (e) => { events.push(e.eventType); }, other: () => "kept" }, versions);
  await audit.record({ tenantId, actorId: "u", eventType: "activity.accept", entityType: "activity", entityId: "x", projectId: "p1" });
  await audit.record({ tenantId, actorId: "u", eventType: "unknown.thing", entityType: "x", entityId: "y", projectId: "p1" });
  await audit.record({ tenantId, actorId: "u", eventType: "activity.accept", entityType: "activity", entityId: "z" });
  assert.deepEqual(events.length, 3, "every event is still recorded");
  assert.equal(audit.other(), "kept");
  assert.deepEqual(store.get("tenant-a:p1"), { activities: 1, plan: 1, reach: 1, "results-by-place": 1 });
  const broken = withDataVersioning({ record: async () => {} }, { read: async () => ({}), bump: async () => { throw new Error("store down"); } });
  await broken.record({ tenantId, actorId: "u", eventType: "activity.accept", entityType: "a", entityId: "1", projectId: "p1" });
  const handler = new GetVisualDataVersionHandler(versions, { for: async () => ({ ok: true, value: [{ id: "p1" }] }) });
  const r = await handler.handle(ctxOf(), ["p1", "p2"]);
  assert.deepEqual(r.value.projects.map((p) => p.projectId), ["p1"], "a project the person cannot see is left out");
  assert.equal((await handler.handle(ctxOf(), [])).ok, false);
  const passed = await new QueryVisualDataHandler({ query: async () => ({ ok: true, value: { state: "unavailable", reason: "x" } }) }).handle(ctxOf("VIEWER"), "p1", q());
  assert.equal(passed.ok, true, "every role holds project.view; the service applies the finer per-source rules");
});
