import test from "node:test";
import assert from "node:assert/strict";
import {
  activityEvidenceItems, activityRecordAcceptedItems, cumulativeDataItems, priorReportItem, DetectMissingEvidenceHandler,
} from "../dist/index.js";
import { ReportingPeriod, TenantId, checklistTemplateForReportType } from "@donordesk/domain";

const act = (id, status = "ACCEPTED", evidence = []) => ({ id, activityTitle: `Activity ${id}`, status, attachedEvidenceIds: evidence });

test("activity items are per activity: evidence missing, record not accepted", () => {
  const acts = [act("a1", "ACCEPTED", ["e1"]), act("a2", "SUBMITTED"), act("a3", "ACCEPTED")];
  assert.deepEqual(activityEvidenceItems(acts).map((i) => i.relatedEntityId), ["a2", "a3"]);
  const accepted = activityRecordAcceptedItems(acts);
  assert.deepEqual(accepted.map((i) => [i.type, i.relatedEntityId]), [["ACTIVITY_RECORD_ACCEPTED", "a2"]]);
});

const finding = (over = {}) => ({ indicatorId: "i1", indicatorCode: "OUT-1", baseline: "0", target: "100", semantics: { aggregation: "SUM" }, lifeOfProject: { value: "10" }, ...over });

test("cumulative data items name what is missing and skip ratios and percentages", () => {
  assert.deepEqual(cumulativeDataItems([finding()], "ANNUAL"), []);
  const [item] = cumulativeDataItems([finding({ target: undefined, lifeOfProject: undefined })], "FINAL");
  assert.equal(item.type, "CUMULATIVE_DATA_COMPLETE");
  assert.equal(item.severity, "HIGH");
  assert.match(item.description, /project target, verified cumulative value/);
  assert.equal(item.relatedEntityId, "i1");
  assert.deepEqual(cumulativeDataItems([finding({ semantics: { aggregation: "PERCENTAGE" }, lifeOfProject: undefined })], "ANNUAL"), []);
  assert.equal(cumulativeDataItems([finding({ baseline: "", })], "ANNUAL")[0].severity, "MEDIUM");
});

const prior = (id, reportType, finished) => ({ period: { id, reportType, duration: {} }, finished });

test("prior-report item appears only when comparable earlier reports exist and none is finished", () => {
  const semi = { reportType: "SEMI_ANNUAL", scope: {} };
  assert.equal(priorReportItem(semi, []), undefined, "a first report has nothing to compare with");
  assert.equal(priorReportItem(semi, [prior("q2", "QUARTERLY", true), prior("q1", "QUARTERLY", false)]), undefined, "only the most recent report matters");
  const item = priorReportItem(semi, [prior("q2", "QUARTERLY", false), prior("q1", "QUARTERLY", true)]);
  assert.equal(item.type, "PRIOR_REPORT_LINKED");
  assert.equal(item.relatedEntityId, "q2");
  assert.equal(priorReportItem({ reportType: "ACTIVITY", scope: {} }, [prior("x", "ACTIVITY", false)]), undefined);
  assert.equal(priorReportItem({ reportType: "QUARTERLY", scope: {} }, [prior("m1", "MONTHLY", false)]), undefined, "a monthly report is not a quarterly's prior");
});

test("the situation template raises its own item type", () => {
  assert.ok(checklistTemplateForReportType("SITUATION").items.some((i) => i.type === "AFFECTED_FIGURES_CONFIRMED"));
  assert.ok(!checklistTemplateForReportType("SITUATION").items.some((i) => i.type === "MISSING_APPROVAL"));
});

// ── handler: the new items are created once, and legacy open items are respected ──

const tenantId = TenantId.create("tenant-a");
const ctx = { tenant: { tenantId, userId: "u1" }, requestId: "r" };

function handlerFor({ period, activities = [], existing = [], findings = [], previous = [], draftsByPeriod = {} }) {
  const created = [];
  let n = 0;
  const h = new DetectMissingEvidenceHandler(
    { generate: () => `id${++n}` },
    { findByReportingPeriod: async () => ({ ok: true, value: existing }), create: async (i) => (created.push(i), { ok: true, value: i }) },
    { detect: async () => [] },
    { findById: async () => ({ ok: true, value: period }), findPreviousPeriods: async () => ({ ok: true, value: previous }) },
    { findByReportingPeriod: async (id) => ({ ok: true, value: draftsByPeriod[id] ?? [] }) },
    { findById: async () => ({ ok: true, value: null }) },
    { findByReportingPeriod: async () => ({ ok: true, value: [] }) },
    { findByReportDraft: async () => ({ ok: true, value: [] }) },
    { findByReportingPeriod: async () => ({ ok: true, value: activities }), findByProject: async () => ({ ok: true, value: activities }) },
    { search: async () => ({ ok: true, value: { total: 0 } }) },
    { record: async () => undefined },
    { computeFindings: async () => ({ ok: true, value: findings }) },
  );
  return { h, created };
}

const makePeriod = (reportType, scope = {}, id = "p1") =>
  ReportingPeriod.create({ id, tenantId: "tenant-a", projectId: "proj", reportType, startDate: new Date("2028-05-01"), endDate: new Date("2028-05-07"), deadline: new Date("2028-05-14"), scopeJson: JSON.stringify(scope) });

test("an activity report gets one accepted-record item per unaccepted activity", async () => {
  const { h, created } = handlerFor({ period: makePeriod("ACTIVITY", { activityIds: ["a1"] }), activities: [act("a1", "SUBMITTED", ["e"])] });
  await h.handle(ctx, "p1");
  assert.deepEqual(created.filter((i) => i.type === "ACTIVITY_RECORD_ACCEPTED").map((i) => i.relatedEntityId), ["a1"]);
});

test("a legacy open approval item for the same activity is not duplicated", async () => {
  const existing = [{ type: "MISSING_APPROVAL", relatedEntityId: "a1", status: "OPEN" }];
  const { h, created } = handlerFor({ period: makePeriod("ACTIVITY", { activityIds: ["a1"] }), activities: [act("a1", "SUBMITTED", ["e"])], existing });
  await h.handle(ctx, "p1");
  assert.equal(created.filter((i) => i.type === "ACTIVITY_RECORD_ACCEPTED").length, 0);
});

test("an annual report gets cumulative-data items and a prior-report item", async () => {
  const { h, created } = handlerFor({
    period: makePeriod("ANNUAL"),
    findings: [finding({ lifeOfProject: undefined })],
    previous: [{ id: "prev", reportType: "ANNUAL" }],
    draftsByPeriod: { prev: [{ status: "DRAFT" }] },
  });
  await h.handle(ctx, "p1");
  assert.equal(created.filter((i) => i.type === "CUMULATIVE_DATA_COMPLETE").length, 1);
  assert.equal(created.filter((i) => i.type === "PRIOR_REPORT_LINKED").length, 1);
});

test("a quarterly report never reads life-of-project findings", async () => {
  const { h, created } = handlerFor({ period: makePeriod("QUARTERLY"), findings: [finding({ lifeOfProject: undefined })] });
  await h.handle(ctx, "p1");
  assert.equal(created.filter((i) => i.type === "CUMULATIVE_DATA_COMPLETE").length, 0);
});
