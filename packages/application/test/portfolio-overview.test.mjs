import test from "node:test";
import assert from "node:assert/strict";
import { GetPortfolioOverviewHandler } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const ctx = { tenant: { tenantId: { toString: () => "t1" } }, requestId: "r" };
const project = (id, title, status = "ACTIVE") => ({ id, title, status, donorName: "D", country: "KE" });
const health = (projectId, band, over = {}) => ({ projectId, band, label: band, reasons: ["why"], health: { overdue: 2, lateStart: 1, valuesOverdue: 4, ...over } });

test("one ranked row per live project, with the same delivery label the project card gives", async () => {
  const handler = new GetPortfolioOverviewHandler(
    { for: async () => ok([project("a", "Alpha"), project("b", "Beta"), project("c", "Done", "COMPLETED")]) },
    { forProjects: async (_t, ids) => ok(ids.map((id) => health(id, id === "a" ? "ON_TRACK" : "OFF_TRACK"))) },
    { findByProject: async (id) => ok(id === "b" ? [{ status: "OPEN", seriousness: "HIGH", reviewBy: "2026-01-01" }] : []) },
    { findByProject: async () => ok([{ id: "p1", deadline: new Date("2026-11-01T00:00:00Z"), status: { toString: () => "NOT_STARTED" }, readinessScore: 10, isCancelled: false }]) },
    { now: () => new Date("2026-10-21T10:00:00Z") },
  );
  const r = await handler.handle(ctx);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value.rows.map((x) => x.title), ["Beta", "Alpha"]); // behind first; the completed project is left out
  const beta = r.value.rows[0];
  assert.equal(beta.delivery.lateActivities, 3);
  assert.equal(beta.delivery.valuesOverdue, 4);
  assert.deepEqual(beta.risks, { open: 1, high: 1, reviewOverdue: 1 });
  assert.equal(beta.reporting.daysUntil, 11);
  assert.equal(r.value.totals.projects, 2);
  assert.equal(r.value.totals.behind, 1);
});

test("a failing read is returned, not hidden", async () => {
  const handler = new GetPortfolioOverviewHandler(
    { for: async () => ok([project("a", "Alpha")]) },
    { forProjects: async () => ok([health("a", "ON_TRACK")]) },
    { findByProject: async () => ({ ok: false, error: new Error("db down") }) },
    { findByProject: async () => ok([]) },
    { now: () => new Date("2026-10-21T10:00:00Z") },
  );
  const r = await handler.handle(ctx);
  assert.equal(r.ok, false);
});
