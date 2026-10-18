import test from "node:test";
import assert from "node:assert/strict";
import { TenantId, PlannedActivity, ProjectRiskTrend } from "@donordesk/domain";
import { ProjectHealthService, GetDeliveryHealthHandler, GetPortfolioHealthHandler, RefreshProjectRiskHandler, GetRiskTrendHandler, VisibleProjects, ListProjectsHandler, RunRemindersHandler } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ADMIN = { tenant: { tenantId, userId: "ad", role: "ADMIN" }, requestId: "r" };
const FIELD = { tenant: { tenantId, userId: "fo", role: "FIELD_OFFICER" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const clock = { now: () => new Date("2026-04-10T09:00:00Z") };

const plan = (id, projectId, start, end, extra = {}) => PlannedActivity.create({ id, tenantId: "tenant-a", projectId, title: id, plannedStart: start, plannedEnd: end, createdById: "u", ...extra }).value;

function world({ items = [], collection = [] } = {}) {
  const plans = { findByProject: async (p) => ok(items.filter((i) => i.projectId === p)) };
  const facts = { factsByPlannedActivity: async () => ok(new Map()) };
  const reader = { forProjects: async (_t, ids) => ok(collection.filter((c) => !ids || ids.includes(c.projectId))) };
  return { service: new ProjectHealthService(plans, facts, reader) };
}
const march = { id: "rp-mar", start: "2026-03-01", end: "2026-03-31", isFinal: false };
const coll = (projectId, recorded = []) => ({ projectId, projectTitle: projectId, projectStart: "2026-01-01", dueDays: 5, indicators: [{ id: "i1", code: "V-01", name: "Vaccinated", frequency: "monthly" }, { id: "i2", code: "V-02", name: "Visits", frequency: "monthly" }], periods: [march], recorded: new Set(recorded) });

test("health: a label with its two biggest reasons from the plan and from overdue values", async () => {
  const w = world({ items: [plan("a", "p1", "2026-03-01", "2026-03-05"), plan("b", "p1", "2026-03-02", "2026-03-06"), plan("c", "p1", "2026-06-01", "2026-06-05")], collection: [coll("p1")] });
  const out = await w.service.forProjects(tenantId, ["p1"], "2026-04-10");
  assert.equal(out.value[0].band, "OFF_TRACK", "two of three activities are late");
  assert.deepEqual(out.value[0].reasons, ["2 activities late", "2 indicator values overdue"]);
  assert.equal(out.value[0].label, "Behind");
  assert.equal(out.value[0].health.planned, 3);
});

test("health: recorded values and a project with no plan; nothing planned or due reads as no plan", async () => {
  const w = world({ collection: [coll("p1", ["i1|rp-mar", "i2|rp-mar"]), { ...coll("p2"), indicators: [], periods: [] }] });
  const out = await w.service.forProjects(tenantId, ["p1", "p2"], "2026-04-10");
  assert.deepEqual(out.value.map((h) => [h.projectId, h.band]), [["p1", "ON_TRACK"], ["p2", "NO_PLAN"]]);
  assert.deepEqual((await w.service.forProjects(tenantId, [], "2026-04-10")).value, []);
});

test("the project handler 404s an unknown project; the portfolio shows one line per visible live project with the top reason", async () => {
  const w = world({ items: [plan("a", "p1", "2026-03-01", "2026-03-05")], collection: [coll("p1"), coll("p2", ["i1|rp-mar", "i2|rp-mar"])] });
  const projects = { findById: async (id) => ok(id === "p1" ? { id } : null), listByTenant: async () => ok([{ id: "p1", title: "Clinics", status: "ACTIVE" }, { id: "p2", title: "Wells", status: "ACTIVE" }, { id: "p3", title: "Old", status: "ARCHIVED" }]) };
  const one = new GetDeliveryHealthHandler(projects, w.service, clock);
  assert.equal((await one.handle(ADMIN, "p1")).value.projectId, "p1");
  assert.equal((await one.handle(ADMIN, "nope")).error.code, "NOT_FOUND");
  const visible = new VisibleProjects(projects, { listActiveProjectIdsForUser: async (u) => ok(u === "fo" ? ["p2"] : []) });
  const portfolio = new GetPortfolioHealthHandler(visible, w.service, clock);
  const all = (await portfolio.handle(ADMIN)).value;
  assert.deepEqual(all.map((r) => [r.title, r.label, r.reasons.length]), [["Clinics", "Behind", 1], ["Wells", "On track", 1]], "an archived project is left out; one reason per line");
  assert.deepEqual((await portfolio.handle(FIELD)).value.map((r) => r.title), ["Wells"], "a member sees only their own projects");
});

test("the project list and the portfolio use the same visibility rule", async () => {
  const projects = { listByTenant: async () => ok([{ id: "p1", title: "A", status: "ACTIVE", projectCode: "A", donorName: "d", country: "c", sector: "s", reportingFrequency: "q", duration: { start: new Date(), end: new Date() }, daysRemaining: () => 1 }, { id: "p2", title: "B", status: "ACTIVE", projectCode: "B", donorName: "d", country: "c", sector: "s", reportingFrequency: "q", duration: { start: new Date(), end: new Date() }, daysRemaining: () => 1 }]) };
  const members = { listActiveProjectIdsForUser: async () => ok(["p2"]) };
  const list = await new ListProjectsHandler(projects, members).handle(FIELD);
  assert.deepEqual(list.value.map((p) => p.id), ["p2"]);
  assert.deepEqual((await new ListProjectsHandler(projects, members).handle(ADMIN)).value.map((p) => p.id), ["p1", "p2"]);
});

test("the daily snapshot: counts and factors from the same facts, one per project per day, never failing the caller", async () => {
  const w = world({ items: [plan("a", "p1", "2026-03-01", "2026-03-05")], collection: [coll("p1")] });
  const saved = [];
  const audit = [];
  const projects = { listByTenant: async () => ok([{ id: "p1", title: "Clinics", status: "ACTIVE" }]), findById: async () => ok({ id: "p1" }) };
  const checklist = { findByProject: async () => ok([{ type: "MISSING_EVIDENCE", status: "OPEN", dueDate: new Date("2026-04-01") }, { type: "MISSING_EVIDENCE", status: "RESOLVED" }, { type: "LATE_ACTIVITY_UPDATE", status: "OPEN" }]) };
  const periods = { findByProject: async () => ok([{ isCancelled: false, status: { toString: () => "DRAFTING" }, deadline: new Date("2026-04-01") }, { isCancelled: false, status: { toString: () => "APPROVED" }, deadline: new Date("2026-03-01") }, { isCancelled: true, status: { toString: () => "DRAFTING" }, deadline: new Date("2026-03-01") }]) };
  const refresh = new RefreshProjectRiskHandler(projects, w.service, checklist, periods, { save: async (t) => (saved.push(t), ok(undefined)), history: async () => ok([]) }, { record: async (e) => void audit.push(e) });
  await refresh.refreshAll(tenantId, "2026-04-10");
  assert.equal(saved.length, 1);
  const t = saved[0];
  assert.equal(t.id, "p1:2026-04-10");
  assert.deepEqual([t.missingEvidenceCount, t.deadlineSlipsCount, t.overdueChecklistItemsCount], [1, 1, 1]);
  assert.deepEqual(t.contributingFactors.map((f) => f.type).sort(), ["plan_slip", "value_overdue"]);
  assert.equal(audit[0].eventType, "risk.snapshots_saved");
  await assert.doesNotReject(() => new RefreshProjectRiskHandler({ listByTenant: async () => { throw new Error("db"); } }, w.service, checklist, periods, { save: async () => ok(undefined), history: async () => ok([]) }, { record: async () => undefined }).refreshAll(tenantId, "2026-04-10"));
});

test("the stored trend reads back as a level, its factors and recent days; no snapshot yet is null", async () => {
  const t = (day, count) => { const r = ProjectRiskTrend.create({ id: `p1:${day}`, tenantId: "tenant-a", projectId: "p1", periodStart: new Date(`${day}T00:00:00Z`), periodEnd: new Date(`${day}T23:59:59Z`) }); r.updateMetrics({ overdueChecklistItemsCount: count, missingEvidenceCount: 2 }); return r; };
  const store = { history: async () => ok([t("2026-04-10", 7), t("2026-04-09", 1)]), save: async () => ok(undefined) };
  const projects = { findById: async (id) => ok(id === "p1" ? { id } : null) };
  const handler = new GetRiskTrendHandler(store, projects);
  const out = (await handler.handle(ADMIN, "p1")).value;
  assert.deepEqual([out.level, out.score, out.history.map((h) => h.day)], ["MEDIUM", 26, ["2026-04-10", "2026-04-09"]]);
  assert.equal((await new GetRiskTrendHandler({ history: async () => ok([]) }, projects).handle(ADMIN, "p1")).value, null);
  assert.equal((await handler.handle(ADMIN, "nope")).error.code, "NOT_FOUND");
});

test("the reminder run refreshes the risk snapshots once, in the same hour", async () => {
  const calls = [];
  const handler = new RunRemindersHandler(
    { list: async () => ok([]) }, { wasSent: async () => ok(false), record: async () => ok(undefined) }, { modes: async () => ok(new Map()), get: async () => ok("DAILY_SUMMARY"), set: async () => ok(undefined) },
    { timeZone: async () => ok("UTC"), activeUsers: async () => ok([]), projectManagers: async () => ok(new Map()) }, { send: async () => undefined }, { record: async () => undefined },
    { now: () => new Date("2026-04-10T07:30:00Z") }, { refreshAll: async (t, day) => void calls.push([t.toString(), day]) },
  );
  await handler.handle({ tenant: { tenantId, userId: "system", role: "ADMIN" }, requestId: "r" });
  assert.deepEqual(calls, [["tenant-a", "2026-04-10"]]);
  await handler.handle({ tenant: { tenantId, userId: "system", role: "ADMIN" }, requestId: "r" }, {});
  assert.equal(calls.length, 2, "the snapshot is idempotent per day, so a second hour-run just replaces it");
});
