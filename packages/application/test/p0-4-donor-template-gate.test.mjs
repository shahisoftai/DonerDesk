import assert from "node:assert/strict";
import test from "node:test";
import { GenerateReportDraftHandler, InferredReportPlanner } from "../dist/index.js";

const noop = async () => ({ ok: true, value: undefined });
const okValue = (value) => ({ ok: true, value });

/**
 * P0-4 — Donor Template Gate.
 *
 * "Generate AI draft" must not create a donor report unless a donor template
 * (or explicit approved report structure) exists. No silent fallback to a
 * single "Narrative Report" section; no draft/sections created when the
 * requirement is unmet; valid templates produce exactly their sections.
 */

test("P0-4 planner: empty templateSections returns a blocking error (no Narrative Report fallback)", async () => {
  const planner = new InferredReportPlanner({ generate: () => "plan-1" });
  const result = await planner.plan({
    reportingPeriodId: "period-1",
    projectId: "proj-1",
    tenantId: { toString: () => "tenant-a" },
    templateSections: [],
    templateVersion: 1,
    profileVersion: 1,
    reportingProfileSnapshot: { tone: "FORMAL", language: "en", formattingRules: [], sectionOverrides: {} },
  });
  assert.ok(!result.ok);
  assert.equal(result.error.code, "REPORT_GATE_BLOCKED");
  assert.match(result.error.message, /report sections are defined/i);
});

test("P0-4 planner: valid template sections produce exactly those sections, in order", async () => {
  const planner = new InferredReportPlanner({ generate: () => "plan-1" });
  const result = await planner.plan({
    reportingPeriodId: "period-1",
    projectId: "proj-1",
    tenantId: { toString: () => "tenant-a" },
    templateSections: [
      { id: "s1", title: "Executive Summary", description: "", inputType: "NARRATIVE", required: true, evidenceNeeded: "" },
      { id: "s2", title: "Indicator Progress", description: "", inputType: "INDICATOR_TABLE", required: true, evidenceNeeded: "" },
    ],
    templateVersion: 1,
    profileVersion: 1,
    reportingProfileSnapshot: { tone: "FORMAL", language: "en", formattingRules: [], sectionOverrides: {} },
  });
  assert.ok(result.ok);
  assert.deepEqual(result.value.sections.map((s) => s.title), ["Executive Summary", "Indicator Progress"]);
});

test("P0-4 handler: blocks generation when no donor template is attached, creating no draft or sections", async () => {
  let draftCreated = false;
  let sectionCreated = false;

  const handler = new GenerateReportDraftHandler(
    { generate: () => "id" },
    // periods
    { findById: async () => okValue({ id: "period-1", projectId: "proj-1", donorTemplateId: undefined, reportType: "QUARTERLY", duration: { start: new Date(), end: new Date() }, deadline: new Date(), readinessScore: 0, daysUntilDeadline: () => 30 }) },
    // drafts
    { create: async () => { draftCreated = true; return okValue({}); }, findByReportingPeriod: async () => okValue([]), update: noop },
    // sections
    { create: async () => { sectionCreated = true; return okValue({}); }, findById: noop },
    // projects
    { findById: async () => okValue({ id: "proj-1", title: "P", projectCode: "P1", donorName: "D", implementingOrganization: "I", country: "C", sector: "S", duration: { start: new Date(), end: new Date() }, reportingFrequency: "QUARTERLY" }) },
    // organizations
    { findByTenant: async () => okValue({ aiEnabled: true }) },
    // templates
    { findById: noop },
    // indicatorUpdates / activities
    { findByReportingPeriod: async () => okValue([]) },
    { findByReportingPeriod: async () => okValue([]) },
    // planner
    { plan: async () => okValue({ sections: [] }) },
    // requirementResolver
    { resolve: async () => okValue({ snapshot: [] }) },
    // analytics
    { computeFindings: async () => okValue([]) },
    // evidencePackages
    { build: async () => okValue([]) },
    // generationRuns / reportPlans
    { create: noop },
    { createNextVersion: noop, create: noop },
    // revisionService / assuranceService
    { commitChange: noop },
    { assessRevision: noop },
    // getGenerator
    async () => ({ model: { modelId: "stub" } }),
    // audit
    { record: noop },
    // entitlements / usage / llmRuns
    { resolve: noop },
    { get: noop, add: noop },
    { recordRun: noop, countAiReportDrafts: async () => okValue(0) },
  );

  const result = await handler.handle(
    { tenant: { tenantId: { toString: () => "tenant-a" }, userId: "user-1" }, requestId: "r" },
    "period-1",
  );

  assert.ok(!result.ok);
  assert.equal(result.error.code, "REPORT_GATE_BLOCKED");
  assert.match(result.error.message, /donor template/i);
  assert.equal(draftCreated, false, "no draft must be created when the template requirement is unmet");
  assert.equal(sectionCreated, false, "no sections must be created when the template requirement is unmet");
});
