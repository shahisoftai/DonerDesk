import assert from "node:assert/strict";
import test from "node:test";
import { PlanClosingReportHandler, StartClosingReportHandler } from "../dist/index.js";
import { TenantId, Project, ReportingPeriod, Indicator, IndicatorUpdate } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u", role: "ADMIN" }, requestId: "r" };

function project(over = {}) {
  return Project.create({ id: "p", tenantId: TenantId.create("tenant-a"), props: { title: "Clean Water", projectCode: "CW-1", donorName: "UNICEF", implementingOrganization: "NGO", country: "Somalia", sector: "WASH", startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), reportingFrequency: "MONTHLY", projectManagerId: "pm", meOfficerId: "me", ...over } });
}
function period(id, reportType, start, end) {
  return ReportingPeriod.create({ id, tenantId: "tenant-a", projectId: "p", reportType, startDate: new Date(start), endDate: new Date(end), deadline: new Date(end) });
}
function build({ proj = project(), periods = [], drafts = {}, indicators = [], updates = {}, activities = [] } = {}) {
  const created = [];
  const plan = new PlanClosingReportHandler(
    { async findById() { return { ok: true, value: proj }; } },
    { async findByProject() { return { ok: true, value: periods }; } },
    { async findByReportingPeriod(id) { return { ok: true, value: drafts[id] ?? [] }; } },
    { async findByProject() { return { ok: true, value: indicators }; } },
    { async findByIndicator(id) { return { ok: true, value: updates[id] ?? [] }; } },
    { async findByProject() { return { ok: true, value: activities }; } },
    { async findByProject() { return { ok: true, value: null }; } },
    { async findById() { return { ok: true, value: null }; } },
  );
  const checklist = { calls: [], async handle(_c, id) { this.calls.push(id); return { ok: true, value: {} }; } };
  const start = new StartClosingReportHandler(
    plan,
    { async handle(_c, input) { created.push(input); return { ok: true, value: { id: "final-1" } }; } },
    { async findByProject() { return { ok: true, value: null }; } },
    checklist,
  );
  return { plan, start, created, checklist };
}
const ind = (id, over = {}) => Indicator.create({ id, tenantId: "tenant-a", projectId: "p", logframeItemId: "o", code: id.toUpperCase(), name: "Children enrolled", type: "NUMBER", baseline: "0", target: "100", ...over });

test("plan reports unconfirmed calculations, missing cumulative values and unapproved earlier reports", async () => {
  const w = build({
    periods: [period("m1", "MONTHLY", "2026-01-01", "2026-11-30")],
    indicators: [ind("i-1", { name: "Widgets" }), ind("i-2", { target: "" })],
  });
  const r = await w.plan.handle(ctx, "p");
  assert.equal(r.ok, true);
  const by = Object.fromEntries(r.value.steps.map((s) => [s.key, s]));
  assert.equal(by.calculations.status, "TODO");
  assert.equal(by.periods.status, "TODO");
  assert.match(by.figures.detail, /I-1 \(verified cumulative value\)/);
  assert.match(by.figures.detail, /I-2 \(project target, verified cumulative value\)/);
});

test("a verified cumulative value clears the figures step", async () => {
  const update = IndicatorUpdate.create({ id: "u", tenantId: "tenant-a", indicatorId: "i-1", reportingPeriodId: "m1", periodAchievement: "5", cumulativeAchievement: "5", createdById: "x" });
  update.submit(); update.verify("y");
  const w = build({ periods: [period("m1", "MONTHLY", "2026-01-01", "2026-11-30")], indicators: [ind("i-1")], updates: { "i-1": [update] } });
  const r = await w.plan.handle(ctx, "p");
  assert.equal(r.value.steps.find((s) => s.key === "figures").status, "DONE");
});

test("sign-offs: a project without a manager or M&E officer gets a TODO", async () => {
  const w = build({ proj: project({ projectManagerId: undefined, meOfficerId: undefined }) });
  const r = await w.plan.handle(ctx, "p");
  assert.equal(r.value.steps.find((s) => s.key === "signoffs").status, "TODO");
});

test("start creates exactly one FINAL over the suggested closing dates with a deadline, then builds its checklist", async () => {
  const w = build({ periods: [period("m1", "MONTHLY", "2026-01-01", "2026-11-30")] });
  const r = await w.start.handle(ctx, "p");
  assert.deepEqual(r, { ok: true, value: { id: "final-1" } });
  assert.equal(w.created.length, 1);
  assert.equal(w.created[0].reportType, "FINAL");
  assert.equal(w.created[0].startDate, "2026-12-01T00:00:00.000Z");
  assert.equal(w.created[0].endDate, "2026-12-31T00:00:00.000Z");
  assert.equal(w.created[0].deadline, "2027-01-30T00:00:00.000Z");
  assert.deepEqual(w.checklist.calls, ["final-1"]);
});

test("start refuses when a closing report exists and points to it", async () => {
  const w = build({ periods: [period("m1", "MONTHLY", "2026-01-01", "2026-11-30"), period("f", "FINAL", "2026-12-01", "2026-12-31")] });
  const r = await w.start.handle(ctx, "p");
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "CONFLICT");
  assert.equal(w.created.length, 0);
});

test("start refuses on a completed project with the reason", async () => {
  const proj = project();
  proj.complete();
  const w = build({ proj });
  const r = await w.start.handle(ctx, "p");
  assert.equal(r.ok, false);
  assert.match(r.error.message, /completed/);
  assert.equal(w.created.length, 0);
});

test("unknown project is NOT_FOUND", async () => {
  const plan = new PlanClosingReportHandler({ async findById() { return { ok: true, value: null }; } }, {}, {}, {}, {}, {}, {}, {});
  assert.equal((await plan.handle(ctx, "x")).error.code, "NOT_FOUND");
});

test("sign-offs: a PM and an M&E officer assigned on the Team page count, though the project's own fields are empty (D5-11)", async () => {
  const proj = project({ projectManagerId: undefined, meOfficerId: undefined });
  const members = {
    async findByProject() {
      return { ok: true, value: [{ userId: "u1", role: "PROJECT_MANAGER", status: "ACTIVE" }, { userId: "u2", role: "ME_OFFICER", status: "ACTIVE" }] };
    },
  };
  const plan = new PlanClosingReportHandler(
    { async findById() { return { ok: true, value: proj }; } },
    { async findByProject() { return { ok: true, value: [] }; } },
    { async findByReportingPeriod() { return { ok: true, value: [] }; } },
    { async findByProject() { return { ok: true, value: [] }; } },
    { async findByIndicator() { return { ok: true, value: [] }; } },
    { async findByProject() { return { ok: true, value: [] }; } },
    { async findByProject() { return { ok: true, value: null }; } },
    { async findById() { return { ok: true, value: null }; } },
    undefined,
    undefined,
    members,
  );
  const r = await plan.handle(ctx, "p");
  assert.equal(r.value.steps.find((s) => s.key === "signoffs").status, "DONE");

  const removedOnly = { async findByProject() { return { ok: true, value: [{ userId: "u1", role: "PROJECT_MANAGER", status: "REMOVED" }] }; } };
  const alone = new PlanClosingReportHandler(
    { async findById() { return { ok: true, value: proj }; } },
    { async findByProject() { return { ok: true, value: [] }; } },
    { async findByReportingPeriod() { return { ok: true, value: [] }; } },
    { async findByProject() { return { ok: true, value: [] }; } },
    { async findByIndicator() { return { ok: true, value: [] }; } },
    { async findByProject() { return { ok: true, value: [] }; } },
    { async findByProject() { return { ok: true, value: null }; } },
    { async findById() { return { ok: true, value: null }; } },
    undefined,
    undefined,
    removedOnly,
  );
  assert.equal((await alone.handle(ctx, "p")).value.steps.find((s) => s.key === "signoffs").status, "TODO");
});
