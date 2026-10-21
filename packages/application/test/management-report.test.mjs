import test from "node:test";
import assert from "node:assert/strict";
import { GetManagementReportHandler } from "../dist/index.js";

const ok = (value) => ({ ok: true, value });
const ctx = { tenant: { tenantId: { toString: () => "t" } } };

function handler(over = {}) {
  const project = { title: "WASH", projectCode: "W-1", donorName: "UNHCR", country: "Pakistan", sector: "WASH", status: "ACTIVE", duration: { start: new Date("2026-01-01"), end: new Date("2026-12-31") } };
  const sheet = {
    projectId: "p", financeEnabled: false, finance: [],
    periods: [{ id: "p1", label: "Mar 2026", start: "2026-03-01", end: "2026-03-31", reportType: "MONTHLY", locked: false }, { id: "p2", label: "Jun 2026", start: "2026-06-01", end: "2026-06-30", reportType: "MONTHLY", locked: false }],
    indicators: [
      { id: "i1", code: "IND-1", name: "Water points", level: null, type: "NUMBER", unit: "points", baseline: "0", target: "25", isRate: false, targetSchedule: [{ asOf: "2026-06-30", target: "20" }] },
      { id: "i2", code: "IND-2", name: "Latrines", level: null, type: "NUMBER", baseline: "0", target: "40", isRate: false },
    ],
    cells: [
      { indicatorId: "i1", periodId: "p1", periodValue: "3", cumulativeValue: "3", status: "VERIFIED" },
      { indicatorId: "i1", periodId: "p2", periodValue: "9", cumulativeValue: "12", status: "VERIFIED" },
    ],
  };
  return new GetManagementReportHandler(
    { findById: async () => ok(project) },
    { forProjects: async () => ok([{ label: "Behind", reasons: ["late"], health: { planned: 6, overdue: 2, lateStart: 1, valuesOverdue: 3 } }]) },
    { handle: async () => ok(sheet) },
    { findByProject: async () => ok([{ title: "Delay", snapshot: () => ({ kind: "PROBLEM" }), seriousness: "HIGH", status: "OPEN", reviewBy: undefined }]) },
    { findByProject: async () => ok([{ id: "p2", isCancelled: false, duration: { start: new Date("2026-06-01") }, reportType: "MONTHLY", status: { toString: () => "NOT_STARTED" }, deadline: new Date("2026-07-05"), readinessScore: 20 }]) },
    { search: async (f) => ok({ total: f.verificationStatus === "VERIFIED" ? 4 : 0, items: [] }) },
    { findByProject: async () => ok([{ status: "ACCEPTED", participantsTotal: 640 }, { status: "SUBMITTED", participantsTotal: 20 }]) },
    { now: () => new Date("2026-10-21T10:00:00Z") },
  );
}

test("the report uses the latest recorded value per indicator, against the scheduled target", async () => {
  const r = await handler().handle(ctx, "p");
  assert.equal(r.ok, true);
  const rows = r.value.sections.find((s) => s.title === "Indicators").rows;
  assert.deepEqual(rows[0].slice(0, 7), ["IND-1", "Water points", "points", "25", "12", "2026-06-30", "48%"]);
  assert.equal(rows[0][7], "-8 (-40%)");
  assert.equal(rows[1][4], "Not measured");
});

test("delivery, reports, risks and evidence come from what the product already knows", async () => {
  const r = await handler().handle(ctx, "p");
  const by = Object.fromEntries(r.value.sections.map((s) => [s.title, s]));
  assert.equal(by.Delivery.rows.find((x) => x[0] === "Late activities")[1], "3");
  assert.equal(by.Delivery.rows.find((x) => x[0] === "People reached (accepted activities)")[1], "640"); // only accepted activities count
  assert.equal(by.Reports.rows[0][0], "Jun 2026");
  assert.equal(by.Reports.rows[0][4], "-108");
  assert.equal(by.Evidence.summary, "4 files on record.");
  assert.equal(by["Problems and risks"].summary, "1 open, 1 serious.");
});

test("an unknown project is not found", async () => {
  const h = new GetManagementReportHandler({ findById: async () => ok(null) }, {}, {}, {}, {}, {}, {}, { now: () => new Date() });
  assert.equal((await h.handle(ctx, "nope")).ok, false);
});
