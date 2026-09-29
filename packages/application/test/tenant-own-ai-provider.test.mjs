import assert from "node:assert/strict";
import test from "node:test";
import { GenerateReportDraftHandler } from "../dist/index.js";

/**
 * A tenant drafting with its OWN AI provider (SuperAdmin tenant-scoped LLM
 * configuration) must not use DonorDesk AI: no credit check, no reservation.
 * The same tenant on DonorDesk's provider with 0 credits left is blocked.
 */

const noop = async () => ({ ok: true, value: undefined });
const okValue = (value) => ({ ok: true, value });

const reviewedTemplate = {
  id: "tpl-1",
  version: 1,
  status: "REVIEWED",
  isReviewed: true,
  templateName: "T",
  donorName: "D",
  reportType: "QUARTERLY",
  language: "en",
  sections: [{ id: "s1", title: "Narrative", description: "", inputType: "NARRATIVE", required: true, evidenceNeeded: [], mandatoryQuestions: [], requiredTables: [], level: 1, includeInReport: true }],
  requirements: { submission: { instructions: [] }, formatting: { rules: [] }, annexes: [], indicatorRequirements: [], compliance: [], generalInstructions: [] },
};

function buildHandler(generator, calls, audit = { record: noop }) {
  return new GenerateReportDraftHandler(
    { generate: () => "id" },
    { findById: async () => okValue({ id: "period-1", projectId: "proj-1", donorTemplateId: "tpl-1", reportType: "QUARTERLY", duration: { start: new Date(), end: new Date() }, deadline: new Date(), readinessScore: 0, daysUntilDeadline: () => 30, templateSnapshotJson: "{}", reportingProfileSnapshotJson: "{}", setSnapshots() {} }), update: noop },
    { create: async () => okValue({}), findByReportingPeriod: async () => okValue([]), update: noop },
    { create: async () => okValue({}), findById: noop },
    { findById: async () => okValue({ id: "proj-1", title: "P", projectCode: "P1", donorName: "D", implementingOrganization: "I", country: "C", sector: "S", duration: { start: new Date(), end: new Date() }, reportingFrequency: "QUARTERLY" }) },
    { findByTenant: async () => okValue({ aiEnabled: true }) },
    { findById: async () => okValue(reviewedTemplate) },
    { findByReportingPeriod: async () => okValue([]) },
    { findByReportingPeriod: async () => okValue([]) },
    { plan: async () => okValue({ sections: [{ templateSectionId: "s1", title: "Narrative", inputType: "NARRATIVE", required: true, mandatoryQuestions: [], evidenceNeeds: [] }] }) },
    { resolve: async () => okValue({ snapshot: [] }) },
    { computeFindings: async () => okValue([]) },
    { build: async () => okValue([]) },
    { create: noop },
    { createNextVersion: noop, create: noop },
    { commitChange: noop },
    { assessRevision: noop },
    async () => generator,
    audit,
    { resolve: async () => { calls.entitlements++; return okValue({ limits: { monthlyAiDraftCredits: 0 } }); } },
    { get: async () => okValue({ used: 0n }), add: async () => { calls.reserved++; return okValue({ used: 1n }); } },
    { recordRun: noop, countAiReportDrafts: async () => okValue(0) },
  );
}

const ctx = { tenant: { tenantId: { toString: () => "tenant-a" }, userId: "user-1" }, requestId: "r" };
const model = { modelId: "anthropic", modelVersion: "claude-haiku-4-5", promptVersion: 5 };

test("DonorDesk provider with no credits left: generation is blocked (AI_CREDITS_EXHAUSTED)", async () => {
  const calls = { entitlements: 0, reserved: 0 };
  const result = await buildHandler({ model, providerSource: "PLATFORM" }, calls).handle(ctx, "period-1");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "AI_CREDITS_EXHAUSTED");
  assert.equal(calls.entitlements, 1);
});

test("ENTITLEMENT_ENFORCEMENT=report lets generation through with no credits left and logs a would-block event", async () => {
  const prior = process.env.ENTITLEMENT_ENFORCEMENT;
  process.env.ENTITLEMENT_ENFORCEMENT = "report";
  try {
    const calls = { entitlements: 0, reserved: 0 };
    const audited = [];
    const result = await buildHandler({ model, providerSource: "PLATFORM" }, calls, {
      record: async (e) => { audited.push(e); },
    }).handle(ctx, "period-1");
    assert.notEqual(result?.error?.code, "AI_CREDITS_EXHAUSTED");
    assert.equal(audited.some((e) => e.eventType === "entitlement.limit_would_block"), true);
  } finally {
    if (prior === undefined) delete process.env.ENTITLEMENT_ENFORCEMENT;
    else process.env.ENTITLEMENT_ENFORCEMENT = prior;
  }
});

test("ENTITLEMENT_ENFORCEMENT=off skips the credit check entirely (no reservation attempted)", async () => {
  const prior = process.env.ENTITLEMENT_ENFORCEMENT;
  process.env.ENTITLEMENT_ENFORCEMENT = "off";
  try {
    const calls = { entitlements: 0, reserved: 0 };
    const audited = [];
    const result = await buildHandler({ model, providerSource: "PLATFORM" }, calls, {
      record: async (e) => { audited.push(e); },
    }).handle(ctx, "period-1");
    assert.notEqual(result?.error?.code, "AI_CREDITS_EXHAUSTED");
    assert.equal(calls.reserved, 0, "off mode must not touch the usage counter");
    assert.equal(audited.some((e) => e.eventType === "entitlement.limit_would_block"), false);
  } finally {
    if (prior === undefined) delete process.env.ENTITLEMENT_ENFORCEMENT;
    else process.env.ENTITLEMENT_ENFORCEMENT = prior;
  }
});

test("tenant's own provider: DonorDesk AI credits are neither checked nor reserved", async () => {
  const calls = { entitlements: 0, reserved: 0 };
  let result;
  try {
    result = await buildHandler({ model, providerSource: "TENANT" }, calls).handle(ctx, "period-1");
  } catch {
    // Later stages are not faked in full; only the credit gate is under test.
  }
  assert.notEqual(result?.error?.code, "AI_CREDITS_EXHAUSTED");
  assert.equal(calls.entitlements, 0, "credit limits must not be consulted");
  assert.equal(calls.reserved, 0, "no DonorDesk credit may be reserved");
});
