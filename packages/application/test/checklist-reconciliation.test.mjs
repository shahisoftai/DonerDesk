import test from "node:test";
import assert from "node:assert/strict";
import { DetectMissingEvidenceHandler, ChecklistReconciler, ListChecklistHandler } from "../dist/index.js";
import { ChecklistItem, Indicator, ReportingPeriod, TenantId } from "@donordesk/domain";

const ctx = { tenant: { tenantId: TenantId.create("tenant-a"), userId: "u1", role: "ADMIN" }, requestId: "r" };
const period = ReportingPeriod.create({ id: "p1", tenantId: "tenant-a", projectId: "proj", reportType: "MONTHLY", startDate: new Date("2026-03-01"), endDate: new Date("2026-03-31"), deadline: new Date("2026-04-10") });

function item(type, title, over = {}) {
  return ChecklistItem.create({ id: `${type}-${title}`.slice(0, 40), tenantId: "tenant-a", projectId: "proj", reportingPeriodId: "p1", type, title, description: "d", severity: "MEDIUM", ...over });
}

function build({ existing = [], activities = [], updates = [], indicators = [], evidenceTotal = 59, finance }) {
  const created = [];
  const updated = [];
  const audits = [];
  const h = new DetectMissingEvidenceHandler(
    { generate: () => `new-${created.length + 1}` },
    { findByReportingPeriod: async () => ({ ok: true, value: existing }), create: async (i) => (created.push(i), { ok: true, value: i }), update: async (i) => (updated.push(i), { ok: true, value: i }) },
    { detect: async () => [] },
    { findById: async () => ({ ok: true, value: period }), findPreviousPeriods: async () => ({ ok: true, value: [] }) },
    { findByReportingPeriod: async () => ({ ok: true, value: [] }) },
    { findById: async () => ({ ok: true, value: null }) },
    { findByReportingPeriod: async () => ({ ok: true, value: updates }) },
    { findByReportDraft: async () => ({ ok: true, value: [] }) },
    { findByReportingPeriod: async () => ({ ok: true, value: activities }), findByProject: async () => ({ ok: true, value: activities }) },
    { search: async () => ({ ok: true, value: { total: evidenceTotal } }) },
    { record: async (e) => { audits.push(e); } },
    { computeFindings: async () => ({ ok: true, value: [] }) },
    finance,
    { findByProject: async () => ({ ok: true, value: indicators }) },
  );
  return { h, created, updated, audits };
}

const activity = (id, status = "ACCEPTED") => ({ id, status, activityTitle: id, attachedEvidenceIds: ["e"], indicatorId: undefined });
const indicator = (id, over = {}) => Indicator.create({ id, tenantId: "tenant-a", projectId: "proj", logframeItemId: "item", code: id, name: id, type: "NUMBER", baseline: "0", target: "10", disaggregationRequired: false, ...over });
const value = (indicatorId, withBreakdown) => ({ indicatorId, verificationStatus: "VERIFIED", disaggregation: withBreakdown ? [{ dimension: "SEX", category: "Female", value: "1" }] : [] });

test("stale state items close on their own when the data satisfies them (demo 4: four items stayed open on a correct report)", async () => {
  const existing = [
    item("LATE_ACTIVITY_UPDATE", "No activity updates submitted for this period"),
    item("MISSING_DISAGGREGATION", "Beneficiary data disaggregated"),
    item("FINANCE_FIGURES_PROVIDED", "Financial figures entered"),
    item("UNVERIFIED_INDICATOR", "2 indicator updates pending verification"),
  ];
  const { h, updated } = build({
    existing,
    activities: [activity("a1"), activity("a2")],
    indicators: [indicator("i1", { disaggregationRequired: true })],
    updates: [value("i1", true)],
    finance: { statusFor: async () => ({ ok: true, value: "VERIFIED" }) },
  });
  await h.handle(ctx, "p1");
  assert.equal(existing.every((i) => i.status === "RESOLVED"), true, existing.map((i) => `${i.type}:${i.status}`).join(", "));
  assert.equal(updated.length, 4);
  assert.match(existing[0].resolutionNotes, /^Closed automatically: activity updates have been submitted\.$/);
});

test("the same items stay open while the data does not satisfy them", async () => {
  const existing = [
    item("LATE_ACTIVITY_UPDATE", "No activity updates submitted for this period"),
    item("MISSING_DISAGGREGATION", "Beneficiary data disaggregated"),
    item("FINANCE_FIGURES_PROVIDED", "Financial figures entered"),
  ];
  const { h } = build({
    existing,
    activities: [],
    indicators: [indicator("i1", { disaggregationRequired: true })],
    updates: [value("i1", false)],
    finance: { statusFor: async () => ({ ok: true, value: "UNVERIFIED" }) },
  });
  await h.handle(ctx, "p1");
  assert.deepEqual(existing.map((i) => i.status), ["OPEN", "OPEN", "OPEN"]);
});

test("attestations are never closed by data: AI output reviewed and sensitive-data handling wait for a person", async () => {
  const existing = [item("UNREVIEWED_AI_OUTPUT", "AI-generated content reviewed"), item("SENSITIVE_DATA_WARNING", "Sensitive data handling confirmed")];
  const { h } = build({ existing, activities: [activity("a1")], updates: [value("i1", true)], indicators: [indicator("i1")] });
  await h.handle(ctx, "p1");
  assert.deepEqual(existing.map((i) => i.status), ["OPEN", "OPEN"]);
});

test("an attestation a person resolved is not raised again by the next scan", async () => {
  const sensitive = item("SENSITIVE_DATA_WARNING", "Sensitive data handling confirmed");
  sensitive.resolve("Checked with the data officer.");
  const ai = item("UNREVIEWED_AI_OUTPUT", "AI-generated content reviewed");
  ai.acceptRisk("Reviewed offline.");
  const { h, created } = build({ existing: [sensitive, ai], activities: [activity("a1")] });
  await h.handle(ctx, "p1");
  const types = created.map((i) => i.type);
  assert.equal(types.includes("SENSITIVE_DATA_WARNING"), false);
  assert.equal(types.includes("UNREVIEWED_AI_OUTPUT"), false);
  assert.equal(sensitive.status, "RESOLVED");
});

test("a resolved state item is raised again when the data goes wrong again", async () => {
  const resolved = item("MISSING_DISAGGREGATION", "Beneficiary data disaggregated");
  resolved.resolve("done");
  const { h, created } = build({ existing: [resolved], indicators: [indicator("i1", { disaggregationRequired: true })], updates: [value("i1", false)] });
  await h.handle(ctx, "p1");
  assert.equal(created.some((i) => i.type === "MISSING_DISAGGREGATION"), true);
});

test("a concern the data already satisfies is not raised, so scans do not churn items (create, close, create...)", async () => {
  const { h, created } = build({ existing: [], activities: [activity("a1")], indicators: [indicator("i1", { disaggregationRequired: true })], updates: [value("i1", true)] });
  await h.handle(ctx, "p1");
  assert.equal(created.some((i) => i.type === "MISSING_DISAGGREGATION"), false);
  // attestations are still raised once
  assert.equal(created.some((i) => i.type === "SENSITIVE_DATA_WARNING"), true);
});

test("RECONCILE closes what the data satisfies, raises nothing, and audits each closing (25.3)", async () => {
  const existing = [item("LATE_ACTIVITY_UPDATE", "No activity updates submitted for this period"), item("SENSITIVE_DATA_WARNING", "Sensitive data handling confirmed")];
  const { h, created, audits } = build({ existing, activities: [activity("a1")], indicators: [indicator("i1", { disaggregationRequired: true })], updates: [value("i1", false)] });
  const r = await h.handle(ctx, "p1", { mode: "RECONCILE" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { created: 0, closed: 1 });
  assert.equal(created.length, 0, "reading never creates work");
  assert.deepEqual(existing.map((i) => i.status), ["RESOLVED", "OPEN"]);
  const closing = audits.filter((a) => a.eventType === "checklist.closed_by_data");
  assert.equal(closing.length, 1);
  assert.equal(closing[0].entityId, existing[0].id);
  assert.equal(audits.some((a) => a.eventType === "compliance.checklist.detected"), false, "a reconcile is not a scan");
});

test("a SCAN reports what it closed too", async () => {
  const existing = [item("LATE_ACTIVITY_UPDATE", "No activity updates submitted for this period")];
  const { h } = build({ existing, activities: [activity("a1")] });
  const r = await h.handle(ctx, "p1");
  assert.equal(r.value.closed, 1);
});

test("listing the checklist closes the satisfied items first, so no manual scan is needed", async () => {
  const existing = [item("LATE_ACTIVITY_UPDATE", "No activity updates submitted for this period")];
  const { h } = build({ existing, activities: [activity("a1")] });
  const reconciler = new ChecklistReconciler(h);
  const list = new ListChecklistHandler({ findByReportingPeriod: async () => ({ ok: true, value: existing }) }, reconciler);
  const r = await list.handle(ctx, "p1");
  assert.equal(r.value[0].status, "RESOLVED");
});

test("the reconciler throttles per period, separates periods, and never fails a read", async () => {
  let calls = 0;
  let clock = 1000;
  const pass = { handle: async () => { calls += 1; if (calls === 3) throw new Error("db down"); return { ok: true, value: { created: 0, closed: 0 } }; } };
  const reconciler = new ChecklistReconciler(pass, 3000, () => clock);
  await reconciler.reconcile(ctx, "p1");
  await reconciler.reconcile(ctx, "p1");
  assert.equal(calls, 1, "a second read inside the window does no work");
  await reconciler.reconcile(ctx, "p2");
  assert.equal(calls, 2, "another period is separate");
  clock += 3001;
  await reconciler.reconcile(ctx, "p1");
  assert.equal(calls, 3);
  await assert.doesNotReject(() => reconciler.reconcile({ ...ctx, tenant: { ...ctx.tenant, tenantId: TenantId.create("tenant-b") } }, "p1"));
});
