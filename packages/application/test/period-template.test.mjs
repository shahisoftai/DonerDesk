import assert from "node:assert/strict";
import test from "node:test";
import { DonorTemplate, ReportingPeriod, TenantId, createSection } from "@donordesk/domain";
import { ChangePeriodTemplateHandler, DefaultTemplateResolver } from "../dist/index.js";

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u-1", role: "ADMIN" }, requestId: "r" };

function template(id, reportType, { status = "REVIEWED", projectId = "p-1", day = 1, name } = {}) {
  const sections = [createSection({ id: "s1", title: "Summary", reviewStatus: "REVIEWED" })];
  return DonorTemplate.create({ id, tenantId, projectId, templateName: name ?? `Template ${id}`, donorName: "Donor", reportType, language: "en", uploadedById: "u-1", sections, status });
}
function period(over = {}) {
  return ReportingPeriod.create({ id: "rp-1", tenantId: "tenant-a", projectId: "p-1", reportType: "FINAL", startDate: new Date("2026-08-01"), endDate: new Date("2026-08-31"), deadline: new Date("2026-09-15"), ...over });
}
function world({ templates = [], profileDefault, p = period(), drafts = [] } = {}) {
  const audit = { events: [], async record(e) { this.events.push(e); } };
  const state = { period: p };
  return {
    audit,
    state,
    resolver: new DefaultTemplateResolver(
      { findByProject: async () => ({ ok: true, value: templates }) },
      { findByProject: async () => ({ ok: true, value: profileDefault ? { defaultTemplateId: profileDefault } : null }) },
    ),
    handler: new ChangePeriodTemplateHandler(
      { findById: async () => ({ ok: true, value: state.period }), update: async (x) => { state.period = x; return { ok: true, value: x }; } },
      { findByReportingPeriod: async () => ({ ok: true, value: drafts }) },
      { findById: async (id) => ({ ok: true, value: templates.find((t) => t.id === id) ?? null }) },
      audit,
    ),
  };
}

test("the resolver names the reviewed Final template even when the profile default is a monthly one", async () => {
  const w = world({ templates: [template("m", "MONTHLY"), template("f", "FINAL", { name: "GWHF Final Project Report" })], profileDefault: "m" });
  const r = await w.resolver.resolve(tenantId, "p-1", "FINAL");
  assert.deepEqual(r.value, { source: "TYPE_MATCH", templateId: "f", templateName: "GWHF Final Project Report", status: "REVIEWED" });
});

test("a monthly period keeps the profile default (golden: behaviour as before)", async () => {
  const w = world({ templates: [template("m", "MONTHLY")], profileDefault: "m" });
  const r = await w.resolver.resolve(tenantId, "p-1", "MONTHLY");
  assert.equal(r.value.templateId, "m");
});

test("no templates resolve to none", async () => {
  const w = world();
  assert.deepEqual((await w.resolver.resolve(tenantId, "p-1", "FINAL")).value, { source: "NONE" });
});

test("before a draft the template is re-pinned, audited, and nothing needs regenerating", async () => {
  const f = template("f", "FINAL");
  const w = world({ templates: [f] });
  const r = await w.handler.handle(ctx, { reportingPeriodId: "rp-1", donorTemplateId: "f" });
  assert.deepEqual(r.value, { changed: true, regenerateNeeded: false });
  assert.equal(w.state.period.donorTemplateId, "f");
  assert.match(w.state.period.templateSnapshotJson, /"id":"f"/);
  assert.equal(w.audit.events[0].eventType, "reporting_period.template_changed");
  assert.equal(w.audit.events[0].oldValue, "none");
  assert.equal(w.audit.events[0].newValue, "f");
});

test("after a draft it re-pins and says regeneration is needed, without regenerating", async () => {
  const w = world({ templates: [template("f", "FINAL")], drafts: [{ status: "IN_REVIEW" }] });
  const r = await w.handler.handle(ctx, { reportingPeriodId: "rp-1", donorTemplateId: "f" });
  assert.deepEqual(r.value, { changed: true, regenerateNeeded: true });
});

test("an approved report is not changed", async () => {
  for (const status of ["APPROVED", "EXPORTED", "SUBMITTED"]) {
    const w = world({ templates: [template("f", "FINAL")], drafts: [{ status }] });
    const r = await w.handler.handle(ctx, { reportingPeriodId: "rp-1", donorTemplateId: "f" });
    assert.equal(r.ok, false, status);
    assert.equal(w.state.period.donorTemplateId, undefined);
  }
});

test("the same template is a no-op; null clears back to the built-in structure and the locks", async () => {
  const w = world({ templates: [template("f", "FINAL")], p: period({ donorTemplateId: "f", donorTemplateVersion: 2, donorTemplateMappingId: "map-1" }) });
  assert.deepEqual((await w.handler.handle(ctx, { reportingPeriodId: "rp-1", donorTemplateId: "f" })).value, { changed: false, regenerateNeeded: false });
  const cleared = await w.handler.handle(ctx, { reportingPeriodId: "rp-1", donorTemplateId: null });
  assert.equal(cleared.value.changed, true);
  assert.equal(w.state.period.donorTemplateId, undefined);
  assert.equal(w.state.period.donorTemplateVersion, undefined);
  assert.equal(w.state.period.donorTemplateMappingId, undefined);
  assert.equal(w.state.period.templateSnapshotJson, "{}");
});

test("refused: another project's template, a wrong type for an activity report, an unapproved template, an unknown one", async () => {
  const foreign = world({ templates: [template("x", "FINAL", { projectId: "p-2" })] });
  assert.equal((await foreign.handler.handle(ctx, { reportingPeriodId: "rp-1", donorTemplateId: "x" })).ok, false);
  const wrongType = world({ templates: [template("m", "MONTHLY")], p: period({ reportType: "ACTIVITY" }) });
  assert.equal((await wrongType.handler.handle(ctx, { reportingPeriodId: "rp-1", donorTemplateId: "m" })).ok, false);
  const unapproved = world({ templates: [template("f", "FINAL", { status: "NEEDS_REVIEW" })] });
  assert.equal((await unapproved.handler.handle(ctx, { reportingPeriodId: "rp-1", donorTemplateId: "f" })).ok, false);
  const unknown = world();
  assert.equal((await unknown.handler.handle(ctx, { reportingPeriodId: "rp-1", donorTemplateId: "nope" })).ok, false);
  assert.equal(unknown.audit.events.length, 0);
});

test("the default per report type is loaded once for every type", async () => {
  const { GetDefaultTemplatesHandler } = await import("../dist/index.js");
  let loads = 0;
  const templates = [template("m", "MONTHLY"), template("f", "FINAL")];
  const resolver = new DefaultTemplateResolver(
    { findByProject: async () => { loads += 1; return { ok: true, value: templates }; } },
    { findByProject: async () => ({ ok: true, value: { defaultTemplateId: "m" } }) },
  );
  const r = await new GetDefaultTemplatesHandler(resolver).handle(ctx, "p-1");
  assert.equal(loads, 1);
  assert.equal(r.value.types.FINAL.templateId, "f");
  assert.equal(r.value.types.MONTHLY.templateId, "m");
  assert.equal(r.value.types.ACTIVITY.source, "NONE");
  assert.equal(Object.keys(r.value.types).length, 8);
});
