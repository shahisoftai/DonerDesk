import assert from "node:assert/strict";
import test from "node:test";
import { NumericAssertionVerifier } from "../dist/llm/verifier-strategies.js";
import { DeterministicEvidenceRetriever } from "../dist/llm/evidence-retriever.js";
import { DeterministicRequirementEvaluator } from "../dist/llm/requirement-evaluator.js";
import { ChecklistUnsupportedClaimProjector } from "../dist/llm/checklist-projector.js";
import { stableFingerprint } from "@donordesk/domain";

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

test("numeric verifier explains percentage failures with missing denominators", () => {
  const verifier = new NumericAssertionVerifier();
  const result = verifier.verify({
    atoms: [{ charStart: 0, charEnd: 2, value: "78", role: "PERCENT", isPercent: true, bound: false }],
    findings: [
      finding({ value: "0", unit: "%", qualityFlags: ["MISSING_DENOMINATOR"], indicatorCode: "OUT-7" }),
    ],
  });
  assert.equal(result.result, "FAILED");
  assert.ok(result.detail.includes("denominator"));
  assert.ok(result.detail.includes("OUT-7"));
});

test("numeric verifier explains unmatched values in plain language", () => {
  const verifier = new NumericAssertionVerifier();
  const result = verifier.verify({
    atoms: [{ charStart: 0, charEnd: 3, value: "120", role: "OTHER", bound: false }],
    findings: [finding({ value: "30", indicatorCode: "IND-1" })],
  });
  assert.equal(result.result, "FAILED");
  assert.ok(result.detail.includes("120"));
  assert.ok(result.detail.includes("no verified indicator value"));
});

test("numeric verifier accepts natural prose with derived percentages and target figures", () => {
  const verifier = new NumericAssertionVerifier();
  const result = verifier.verify({
    atoms: [
      { charStart: 0, charEnd: 1, value: "8", role: "OTHER", bound: false },
      { charStart: 2, charEnd: 7, value: "6.67", role: "PERCENT", isPercent: true, bound: false },
      { charStart: 8, charEnd: 11, value: "120", role: "OTHER", bound: false },
    ],
    findings: [finding({ value: "8", target: "120", indicatorCode: "OUT-1", unit: "centres" })],
  });
  assert.equal(result.result, "PASSED", result.detail);
});

test("numeric verifier accepts multiple indicators combined in one sentence", () => {
  const verifier = new NumericAssertionVerifier();
  const result = verifier.verify({
    atoms: [
      { charStart: 0, charEnd: 3, value: "521", role: "OTHER", bound: false },
      { charStart: 4, charEnd: 6, value: "58", role: "OTHER", bound: false },
    ],
    findings: [
      finding({ value: "521", indicatorCode: "OUT-2", unit: "kits" }),
      finding({ value: "58", indicatorCode: "OUT-3", unit: "teachers" }),
    ],
  });
  assert.equal(result.result, "PASSED", result.detail);
});

test("numeric verifier rejects a target figure without a matched value", () => {
  const verifier = new NumericAssertionVerifier();
  const result = verifier.verify({
    atoms: [{ charStart: 0, charEnd: 3, value: "120", role: "OTHER", bound: false }],
    findings: [finding({ value: "8", target: "120", indicatorCode: "OUT-1" })],
  });
  assert.equal(result.result, "FAILED");
});

test("numeric verifier rejects a baseline figure that contradicts the finding", () => {
  const verifier = new NumericAssertionVerifier();
  const result = verifier.verify({
    atoms: [{ charStart: 0, charEnd: 1, value: "0", role: "OTHER", bound: false }],
    findings: [finding({ value: "1", baseline: "0", indicatorCode: "OUT-19", unit: "incidents" })],
  });
  assert.equal(result.result, "FAILED");
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

test("checklist projector never recreates an item the user resolved", async () => {
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
  await projector.project({ tenantId: { toString: () => "t" }, periodId: "p1", projectId: "proj1", gaps });
  assert.equal(created.length, 1);

  // The user accepts the risk. The item no longer appears open, yet a
  // re-assessment of the same assertion must not create a duplicate.
  checklist.findByReportingPeriod = async () => ({
    ok: true,
    value: created.map((c) => ({ ...c, type: "UNSUPPORTED_REPORT_CLAIM", status: "ACCEPTED_RISK", relatedEntityId: c.relatedEntityId })),
  });
  await projector.project({ tenantId: { toString: () => "t" }, periodId: "p1", projectId: "proj1", gaps });
  assert.equal(created.length, 1);
});

test("numeric verifier accepts a verified cumulative figure and prior-cumulative reference", () => {
  const verifier = new NumericAssertionVerifier();
  const f = finding({ indicatorCode: "OUT-4", value: "2500", cumulativeValue: "7000", priorCumulativeValue: "4500", target: "8000" });
  const cumulative = verifier.verify({
    atoms: [{ charStart: 0, charEnd: 4, value: "7000", role: "ACHIEVEMENT", bound: false }],
    findings: [f],
  });
  assert.equal(cumulative.result, "PASSED");
  const withReference = verifier.verify({
    atoms: [
      { charStart: 0, charEnd: 4, value: "2500", role: "ACHIEVEMENT", bound: false },
      { charStart: 10, charEnd: 14, value: "4500", role: "ACHIEVEMENT", bound: false },
    ],
    findings: [f],
  });
  assert.equal(withReference.result, "PASSED");
});

test("numeric verifier still rejects a number that is neither period, cumulative nor a reference", () => {
  const verifier = new NumericAssertionVerifier();
  const result = verifier.verify({
    atoms: [{ charStart: 0, charEnd: 4, value: "7100", role: "ACHIEVEMENT", bound: false }],
    findings: [finding({ value: "2500", cumulativeValue: "7000" })],
  });
  assert.equal(result.result, "FAILED");
  assert.ok(result.reasonCodes.includes("VALUE_MISMATCH"));
});

test("numeric verifier ignores date and count atoms but still checks achievement values", () => {
  const verifier = new NumericAssertionVerifier();
  const f = finding({ value: "52", cumulativeValue: "100", target: "240" });
  const withMetadata = verifier.verify({
    atoms: [
      { charStart: 0, charEnd: 2, value: "52", role: "ACHIEVEMENT", bound: false },
      { charStart: 10, charEnd: 11, value: "2", role: "COUNT", bound: false },
      { charStart: 20, charEnd: 22, value: "10", role: "DATE", bound: false },
    ],
    findings: [f],
  });
  assert.equal(withMetadata.result, "PASSED");
  const metadataOnly = verifier.verify({ atoms: [{ charStart: 0, charEnd: 2, value: "10", role: "DATE", bound: false }], findings: [f] });
  assert.equal(metadataOnly.result, "PASSED");
  const wrong = verifier.verify({
    atoms: [{ charStart: 0, charEnd: 2, value: "53", role: "ACHIEVEMENT", bound: false }, { charStart: 5, charEnd: 6, value: "2", role: "COUNT", bound: false }],
    findings: [f],
  });
  assert.equal(wrong.result, "FAILED");
});

test("checklist projector closes open items whose statement no longer fails, and keeps those that still do", async () => {
  const mk = (key, status = "OPEN") => {
    const item = { type: "UNSUPPORTED_REPORT_CLAIM", status, relatedEntityId: stableFingerprint(key), resolved: undefined, resolve(note) { this.status = "RESOLVED"; this.resolved = note; } };
    return item;
  };
  const stale = mk("Old wording that was rewritten");
  const still = mk("Still failing statement");
  const done = mk("Already resolved", "RESOLVED");
  const other = { type: "MISSING_EVIDENCE", status: "OPEN", relatedEntityId: undefined, resolve() { throw new Error("must not touch"); } };
  const updated = [];
  const checklist = { findByReportingPeriod: async () => ({ ok: true, value: [stale, still, done, other] }), update: async (i) => (updated.push(i), { ok: true, value: i }) };
  const projector = new ChecklistUnsupportedClaimProjector({ generate: () => "x" }, checklist);
  const r = await projector.reconcile({ tenantId: { toString: () => "t" }, periodId: "p1", activeKeys: ["Still failing statement"] });
  assert.ok(r.ok);
  assert.equal(stale.status, "RESOLVED");
  assert.match(stale.resolved, /automatically/);
  assert.equal(still.status, "OPEN");
  assert.equal(done.status, "RESOLVED");
  assert.deepEqual(updated, [stale]);
});
