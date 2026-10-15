import assert from "node:assert/strict";
import test from "node:test";
import { SectionDataChartsHandler, SectionChartService } from "../dist/index.js";
import { TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u", role: "ADMIN" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });

function setup({ status = "DRAFTED", draftStatus = "DRAFT" } = {}) {
  const sheet = {
    projectId: "proj",
    financeEnabled: false,
    periods: [{ id: "p1", label: "Jan 2026", start: "2026-01-01", end: "2026-01-31", reportType: "MONTHLY", locked: false }, { id: "p2", label: "Feb 2026", start: "2026-02-01", end: "2026-02-28", reportType: "MONTHLY", locked: false }],
    indicators: [{ id: "i1", code: "OUT-1", name: "Trained", level: "OUTPUT", type: "COUNT", unit: "people", baseline: "0", target: "100", isRate: false }],
    cells: [{ indicatorId: "i1", periodId: "p1", periodValue: "10", cumulativeValue: "10", status: "VERIFIED" }, { indicatorId: "i1", periodId: "p2", periodValue: "15", cumulativeValue: "25", status: "DRAFT" }],
    finance: [],
  };
  const section = { id: "s1", reportDraftId: "d1", status, sectionTitle: "Results", content: "text", resetToDraft() { this.status = "DRAFTED"; } };
  let stored = [];
  let n = 0;
  const artifacts = {
    findBySection: async () => ok(stored),
    replaceForSection: async ({ artifacts: list }) => { stored = list.map((a) => ({ ...a, id: `a${++n}`, caption: a.caption ?? null, rows: [] })); return ok(undefined); },
  };
  const audit = []; 
  const handler = new SectionDataChartsHandler(
    { findById: async () => ok(section), update: async (s) => ok(s) },
    { findById: async () => ok({ reportingPeriodId: "rp", isSuperseded: false, status: draftStatus }) },
    { findById: async () => ok({ projectId: "proj" }) },
    artifacts,
    { handle: async () => ok(sheet) },
    { generate: (() => { let i = 0; return () => `chart-${++i}`; })() },
    { record: async (e) => { audit.push(e.eventType); } },
    () => new Date("2026-03-01T00:00:00Z"),
  );
  return { handler, sheet, section, artifacts, audit, stored: () => stored };
}

const spec = { template: "INDICATOR_OVER_TIME", indicatorIds: ["i1"], measure: "PERIOD", type: "BAR", showTarget: false };

test("adding a chart stores its settings and the data it showed, counts draft values, and is audited", async () => {
  const t = setup();
  const r = await t.handler.add(ctx, "s1", { spec, caption: "Trainees by month" });
  assert.equal(r.value.id, "chart-1");
  const saved = t.stored()[0];
  assert.equal(saved.kind, "CHART");
  assert.equal(saved.caption, "Trainees by month");
  assert.deepEqual(saved.payload.series[0].data, [10, 15]);
  assert.deepEqual([saved.payload.dataCenter.points, saved.payload.dataCenter.unverified], [2, 1]);
  assert.deepEqual(t.audit, ["report.section.data_chart.added"]);
});

test("a chart is stale once the data moves, and Update redraws it from its settings", async () => {
  const t = setup();
  await t.handler.add(ctx, "s1", { spec });
  assert.equal((await t.handler.list(ctx, "s1")).value[0].stale, false);
  t.sheet.cells[1].periodValue = "20";
  assert.equal((await t.handler.list(ctx, "s1")).value[0].stale, true);
  await t.handler.refresh(ctx, "s1", "chart-1");
  assert.deepEqual(t.stored()[0].payload.series[0].data, [10, 20]);
  assert.equal((await t.handler.list(ctx, "s1")).value[0].stale, false);
});

test("a chart whose indicator was retired is reported as broken, never silently dropped", async () => {
  const t = setup();
  await t.handler.add(ctx, "s1", { spec });
  t.sheet.indicators.length = 0;
  const [view] = (await t.handler.list(ctx, "s1")).value;
  assert.equal(view.stale, true);
  assert.ok(view.broken);
});

test("an unknown indicator or an empty selection is refused with a plain message", async () => {
  const t = setup();
  const a = await t.handler.add(ctx, "s1", { spec: { ...spec, indicatorIds: ["nope"] } });
  assert.equal(a.ok, false);
  const b = await t.handler.add(ctx, "s1", { spec: { ...spec, indicatorIds: [] } });
  assert.equal(b.ok, false);
  assert.equal(t.stored().length, 0);
});

test("charts can be reordered among themselves and removed", async () => {
  const t = setup();
  await t.handler.add(ctx, "s1", { spec, caption: "first" });
  await t.handler.add(ctx, "s1", { spec: { ...spec, type: "LINE" }, caption: "second" });
  assert.deepEqual((await t.handler.list(ctx, "s1")).value.map((c) => c.caption), ["first", "second"]);
  await t.handler.move(ctx, "s1", "chart-2", "UP");
  assert.deepEqual((await t.handler.list(ctx, "s1")).value.map((c) => c.caption), ["second", "first"]);
  assert.equal((await t.handler.move(ctx, "s1", "chart-2", "UP")).value.moved, false);
  await t.handler.remove(ctx, "s1", "chart-1");
  assert.deepEqual((await t.handler.list(ctx, "s1")).value.map((c) => c.caption), ["second"]);
  assert.equal((await t.handler.remove(ctx, "s1", "chart-1")).ok, false);
});

test("editing the caption or settings keeps the chart's id and position", async () => {
  const t = setup();
  await t.handler.add(ctx, "s1", { spec, caption: "first" });
  await t.handler.add(ctx, "s1", { spec, caption: "second" });
  await t.handler.update(ctx, "s1", "chart-1", { caption: "renamed", spec: { ...spec, type: "LINE" } });
  const list = (await t.handler.list(ctx, "s1")).value;
  assert.deepEqual(list.map((c) => [c.id, c.caption, c.spec.type]), [["chart-1", "renamed", "LINE"], ["chart-2", "second", "BAR"]]);
});

test("changing a chart reopens an approved section; a report that is no longer a draft refuses", async () => {
  const approved = setup({ status: "APPROVED" });
  await approved.handler.add(ctx, "s1", { spec });
  assert.equal(approved.section.status, "DRAFTED");
  const submitted = setup({ draftStatus: "APPROVED" });
  const r = await submitted.handler.add(ctx, "s1", { spec });
  assert.equal(r.ok, false);
  assert.equal(submitted.stored().length, 0);
  // listing is allowed whatever the state
  assert.equal((await submitted.handler.list(ctx, "s1")).ok, true);
});

test("rebuilding a section's table charts after a text edit leaves Data Center charts alone", async () => {
  const t = setup();
  await t.handler.add(ctx, "s1", { spec, caption: "mine" });
  const svc = new SectionChartService(t.artifacts);
  await svc.refresh({ tenantId: ctx.tenant.tenantId, sectionId: "s1", revisionId: null, title: "Results", content: "No tables here." });
  const list = (await t.handler.list(ctx, "s1")).value;
  assert.deepEqual(list.map((c) => c.caption), ["mine"]);
});
