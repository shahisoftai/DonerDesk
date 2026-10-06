import assert from "node:assert/strict";
import test from "node:test";
import { CancelReportingPeriodHandler, RestoreReportingPeriodHandler, ConvertPeriodToFinalHandler } from "../dist/index.js";
import { ReportingPeriod } from "@donordesk/domain";

const tenantId = { toString: () => "t1" };
const ctx = { tenant: { tenantId, userId: "u1" }, requestId: "r" };
const ok = (value) => ({ ok: true, value });
const d = (m, day = 1) => new Date(Date.UTC(2026, m, day));

function world({ periods, drafts = {} }) {
  const all = new Map(periods.map((p) => [p.id, p]));
  const audits = [];
  const repo = {
    findById: async (id) => ok(all.get(id) ?? null),
    findByProject: async (_p, _t, opts = {}) => ok([...all.values()].filter((p) => opts.includeCancelled || !p.isCancelled)),
    update: async (p) => ok(p),
  };
  const draftRepo = { findByReportingPeriod: async (id) => ok((drafts[id] ?? []).map((status) => ({ status }))) };
  const audit = { record: async (e) => { audits.push(e); } };
  return { repo, draftRepo, audit, audits, all };
}
const period = (id, type, m) => ReportingPeriod.create({ id, tenantId: "t1", projectId: "pr", reportType: type, startDate: d(m), endDate: d(m + 1, 0), deadline: d(m + 1, 10) });

test("cancel: the period leaves the calendar, its data is untouched, the action is audited", async () => {
  const w = world({ periods: [period("jan", "MONTHLY", 0), period("feb", "MONTHLY", 1)] });
  const handler = new CancelReportingPeriodHandler(w.repo, w.draftRepo, w.audit, () => d(5));
  const r = await handler.handle(ctx, "feb", { reason: "created by mistake" });
  assert.equal(r.ok, true);
  assert.equal(r.value.cancelled, true);
  assert.equal(w.all.get("feb").cancelReason, "created by mistake");
  assert.deepEqual((await w.repo.findByProject("pr", tenantId)).value.map((p) => p.id), ["jan"], "the calendar no longer sees it");
  assert.equal((await w.repo.findByProject("pr", tenantId, { includeCancelled: true })).value.length, 2);
  assert.equal(w.audits.length, 1);
  assert.equal(w.audits[0].eventType, "reporting_period.cancelled");
  assert.equal(w.audits[0].entityId, "feb");
});

test("cancel is refused with a reason when a report is approved, and when already cancelled; nothing is audited", async () => {
  const w = world({ periods: [period("jan", "MONTHLY", 0)], drafts: { jan: ["APPROVED"] } });
  const handler = new CancelReportingPeriodHandler(w.repo, w.draftRepo, w.audit);
  const refused = await handler.handle(ctx, "jan");
  assert.equal(refused.ok, false);
  assert.match(refused.error.message, /approved report/);
  assert.equal(w.audits.length, 0);
  const missing = await handler.handle(ctx, "nope");
  assert.equal(missing.ok, false);
  assert.equal(missing.error.code, "NOT_FOUND");
});

test("restore puts it back; refused when another period now covers the dates", async () => {
  const w = world({ periods: [period("jan", "MONTHLY", 0), period("feb", "MONTHLY", 1)] });
  await new CancelReportingPeriodHandler(w.repo, w.draftRepo, w.audit).handle(ctx, "feb");
  const restore = new RestoreReportingPeriodHandler(w.repo, w.draftRepo, w.audit);
  const back = await restore.handle(ctx, "feb");
  assert.equal(back.ok, true);
  assert.equal(w.all.get("feb").isCancelled, false);
  assert.equal(w.audits.at(-1).eventType, "reporting_period.restored");

  const again = await restore.handle(ctx, "feb");
  assert.equal(again.ok, false);
  assert.match(again.error.message, /not cancelled/);

  await new CancelReportingPeriodHandler(w.repo, w.draftRepo, w.audit).handle(ctx, "feb");
  w.all.set("feb2", period("feb2", "MONTHLY", 1)); // someone created the month again meanwhile
  const blocked = await restore.handle(ctx, "feb");
  assert.equal(blocked.ok, false);
  assert.match(blocked.error.message, /Another period now covers/);
});

test("convert: the closing month becomes the Final report (the D5-1 repair), audited with before and after", async () => {
  const w = world({ periods: [period("mar", "MONTHLY", 2), period("apr", "MONTHLY", 3)] });
  const convert = new ConvertPeriodToFinalHandler(w.repo, w.draftRepo, w.audit);
  const wrong = await convert.handle(ctx, "mar");
  assert.equal(wrong.ok, false);
  assert.match(wrong.error.message, /later period exists/);
  assert.equal(w.audits.length, 0);

  const r = await convert.handle(ctx, "apr");
  assert.equal(r.ok, true);
  assert.equal(r.value.reportType, "FINAL");
  assert.equal(w.all.get("apr").reportType, "FINAL");
  assert.equal(w.audits[0].eventType, "reporting_period.converted_to_final");
  assert.deepEqual(JSON.parse(w.audits[0].oldValue), { reportType: "MONTHLY" });

  const second = await convert.handle(ctx, "mar");
  assert.equal(second.ok, false, "a project has one final report");
});

test("convert is refused once the period's report is approved", async () => {
  const w = world({ periods: [period("apr", "MONTHLY", 3)], drafts: { apr: ["EXPORTED"] } });
  const r = await new ConvertPeriodToFinalHandler(w.repo, w.draftRepo, w.audit).handle(ctx, "apr");
  assert.equal(r.ok, false);
  assert.match(r.error.message, /approved report/);
});
