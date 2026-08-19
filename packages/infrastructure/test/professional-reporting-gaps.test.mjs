import assert from "node:assert/strict";
import test from "node:test";
import { NumericAssertionVerifier } from "../dist/llm/verifier-strategies.js";
import { DeterministicEvidenceRetriever } from "../dist/llm/evidence-retriever.js";
import { DeterministicRequirementEvaluator } from "../dist/llm/requirement-evaluator.js";
import { ChecklistUnsupportedClaimProjector } from "../dist/llm/checklist-projector.js";

function finding(overrides = {}) {
  return {
    indicatorId: "ind-1",
    indicatorCode: "IND-1",
    value: "30",
    unit: "people",
    reportingPeriodId: "period-1",
    qualityFlags: [],
    ...overrides,
  };
}

test("numeric verifier binds period and fails on wrong-period match", () => {
  const verifier = new NumericAssertionVerifier();
  const result = verifier.verify({
    atoms: [{ charStart: 0, charEnd: 2, value: "30", role: "ACHIEVEMENT", reportingPeriodId: "period-2", bound: false }],
    findings: [finding({ value: "30", reportingPeriodId: "period-1" })],
  });
  assert.equal(result.result, "FAILED");
  assert.ok(result.reasonCodes.includes("PERIOD_MISMATCH"));
});

test("numeric verifier binds entity and fails on wrong-indicator match", () => {
  const verifier = new NumericAssertionVerifier();
  const result = verifier.verify({
    atoms: [{ charStart: 0, charEnd: 2, value: "30", role: "ACHIEVEMENT", indicatorCode: "IND-2", bound: false }],
    findings: [finding({ value: "30", indicatorCode: "IND-1" })],
  });
  assert.equal(result.result, "FAILED");
  assert.ok(result.reasonCodes.includes("ENTITY_MISMATCH"));
});

test("numeric verifier derives percentages via domain decimal math", () => {
  const verifier = new NumericAssertionVerifier();
  const result = verifier.verify({
    atoms: [{ charStart: 0, charEnd: 2, value: "50", role: "PERCENT", bound: false }],
    findings: [finding({ value: "25", target: "50", baseline: "10", reportingPeriodId: "period-1" })],
  });
  assert.equal(result.result, "PASSED");
});

test("numeric verifier fails a percentage that is not derived", () => {
  const verifier = new NumericAssertionVerifier();
  const result = verifier.verify({
    atoms: [{ charStart: 0, charEnd: 2, value: "71", role: "PERCENT", bound: false }],
    findings: [finding({ value: "25", target: "50" })],
  });
  assert.equal(result.result, "FAILED");
  assert.ok(result.reasonCodes.includes("DERIVATION_INVALID"));
});

test("evidence retriever ranks relevant chunks by query overlap", async () => {
  const packages = [
    {
      evidenceId: "e-1",
      title: "Attendance",
      fileName: "a.pdf",
      evidenceType: "ATTENDANCE_SHEET",
      verificationStatus: "VERIFIED",
      confidentialityLevel: "INTERNAL",
      chunks: [{ chunkId: "e-1:0", text: "Training sessions delivered to 45 participants", tokenCount: 6, chunkIndex: 0 }],
      evidenceHash: "h1",
      evidenceUpdatedAt: new Date(),
      chunkerVersion: "v1",
    },
    {
      evidenceId: "e-2",
      title: "Budget",
      fileName: "b.pdf",
      evidenceType: "BUDGET",
      verificationStatus: "VERIFIED",
      confidentialityLevel: "INTERNAL",
      chunks: [{ chunkId: "e-2:0", text: "Quarterly budget expenditure report", tokenCount: 4, chunkIndex: 0 }],
      evidenceHash: "h2",
      evidenceUpdatedAt: new Date(),
      chunkerVersion: "v1",
    },
  ];
  const retriever = new DeterministicEvidenceRetriever(packages);
  const result = await retriever.retrieve({ sectionTitle: "Training delivery", entities: [], dates: [], indicatorCodes: [] });
  assert.ok(result.ok);
  assert.equal(result.value[0].evidenceId, "e-1");
});

test("requirement evaluator uses requirementKeys and flags word-limit violations", async () => {
  const evaluator = new DeterministicRequirementEvaluator();
  const requirement = { id: "r1", key: "QUESTION:safeguarding-psea", kind: "QUESTION", required: true, severity: "BLOCKING", wordLimit: { max: 50 }, sourceReference: { sourceType: "DONOR_PACK", sourceId: "p", version: 1, label: "p" } };
  const result = await evaluator.evaluate({
    requirements: [requirement],
    sectionTitles: ["Safeguarding"],
    sectionRequirementKeys: [["QUESTION:safeguarding-psea"]],
    sectionContents: ["word ".repeat(60)],
  });
  assert.ok(result.ok);
  assert.ok(result.value.satisfied.includes("QUESTION:safeguarding-psea"));
  assert.ok(result.value.blocking.some((b) => b.key === "QUESTION:safeguarding-psea"));
});

test("requirement evaluator flags unmet mandatory requirements", async () => {
  const evaluator = new DeterministicRequirementEvaluator();
  const requirement = { id: "r2", key: "ANNEX:financial-statement", kind: "ANNEX", required: true, severity: "BLOCKING", sourceReference: { sourceType: "DONOR_PACK", sourceId: "p", version: 1, label: "p" } };
  const result = await evaluator.evaluate({
    requirements: [requirement],
    sectionTitles: ["Executive Summary"],
    sectionRequirementKeys: [[]],
    sectionContents: [""],
  });
  assert.ok(result.ok);
  assert.ok(result.value.unmet.includes("ANNEX:financial-statement"));
});

test("checklist projector deduplicates coverage gaps", async () => {
  const created = [];
  let next = 0;
  const checklist = {
    findByReportingPeriod: async () => ({ ok: true, value: [] }),
    create: async (item) => {
      created.push(item);
      return { ok: true, value: item };
    },
  };
  const ids = { generate: () => `id-${++next}` };
  const projector = new ChecklistUnsupportedClaimProjector(ids, checklist);
  const gaps = [{ key: "Reached 500 beneficiaries", title: "Unsupported claim", description: "failed" }];
  const first = await projector.project({ tenantId: { toString: () => "t" }, periodId: "p1", projectId: "proj1", gaps });
  assert.ok(first.ok);
  assert.equal(created.length, 1);
  assert.equal(created[0].type, "UNSUPPORTED_REPORT_CLAIM");

  // Second run sees the active item and does not duplicate it.
  checklist.findByReportingPeriod = async () => ({
    ok: true,
    value: created.map((c) => ({ ...c, type: "UNSUPPORTED_REPORT_CLAIM", status: "OPEN", relatedEntityId: c.relatedEntityId })),
  });
  await projector.project({ tenantId: { toString: () => "t" }, periodId: "p1", projectId: "proj1", gaps });
  assert.equal(created.length, 1);
});
