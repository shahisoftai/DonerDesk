import assert from "node:assert/strict";
import test from "node:test";
import {
  decimalAdd,
  decimalSubtract,
  decimalMultiply,
  decimalDivide,
  decimalRound,
  formatDecimal,
  parseDecimal,
  computeIndicator,
  evaluatePerformance,
  defaultSemanticsForType,
  inferIndicatorSemantics,
  sanitizeIndicatorSemantics,
  evaluateReportGate,
  gateDecisionFor,
  ReportClaim,
  createReportPlan,
  ReportGenerationRun,
  resolveClaimDecision,
} from "../dist/index.js";

// ---------------------------------------------------------------------------
// Decimal-safe arithmetic
// ---------------------------------------------------------------------------

test("decimal arithmetic avoids floating point drift", () => {
  const a = parseDecimal("0.1");
  const b = parseDecimal("0.2");
  assert.ok(a && b);
  assert.equal(formatDecimal(decimalAdd(a, b), 2), "0.3");
  assert.equal(formatDecimal(decimalSubtract(a, b), 2), "-0.1");
  const c = parseDecimal("1.5");
  const d = parseDecimal("2");
  assert.ok(c && d);
  assert.equal(formatDecimal(decimalMultiply(c, d), 2), "3");
  const q = decimalDivide(parseDecimal("1"), parseDecimal("4"), 6);
  assert.ok(q);
  assert.equal(formatDecimal(q, 6), "0.25");
});

test("ratio with zero denominator is null (never a number)", () => {
  assert.equal(decimalDivide(parseDecimal("5"), parseDecimal("0"), 6), null);
});

test("rounding is half-up at the requested scale", () => {
  const r = decimalRound(parseDecimal("2.675"), 2);
  assert.ok(r);
  assert.equal(formatDecimal(r, 2), "2.68");
});

// ---------------------------------------------------------------------------
// Indicator mathematics
// ---------------------------------------------------------------------------

const records = [
  { id: "u1", periodAchievement: "10", cumulativeAchievement: "10", verificationStatus: "VERIFIED", updatedAt: new Date("2026-08-01") },
  { id: "u2", periodAchievement: "20", cumulativeAchievement: "30", verificationStatus: "VERIFIED", updatedAt: new Date("2026-08-02") },
  { id: "u3", periodAchievement: "30", cumulativeAchievement: "60", verificationStatus: "DRAFT", updatedAt: new Date("2026-08-03") },
  { id: "u4", periodAchievement: "40", cumulativeAchievement: "100", verificationStatus: "DRAFT", updatedAt: new Date("2026-08-04") },
  { id: "u5", periodAchievement: "50", cumulativeAchievement: "150", verificationStatus: "DRAFT", updatedAt: new Date("2026-08-05") },
];

test("computeIndicator SUM aggregates only verified updates", () => {
  const finding = computeIndicator({
    indicatorId: "ind-1",
    indicatorCode: "IND-1",
    indicatorType: "NUMBER",
    unit: "people",
    semantics: { aggregation: "SUM", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "INFERRED" },
    disaggregationRequired: false,
    updates: records,
  });
  assert.equal(finding.value, "30");
  assert.equal(finding.sourceRecordIds.join(","), "u1,u2");
  assert.ok(finding.qualityFlags.includes("LOW_COVERAGE"));
});

test("computeIndicator AVERAGE, MIN, MAX, LATEST", () => {
  const base = {
    indicatorId: "ind-1",
    indicatorCode: "IND-1",
    indicatorType: "NUMBER",
    disaggregationRequired: false,
    updates: records.filter((u) => u.verificationStatus === "VERIFIED"),
  };
  const avg = computeIndicator({ ...base, semantics: { aggregation: "AVERAGE", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "INFERRED" } });
  assert.equal(avg.value, "15");
  const min = computeIndicator({ ...base, semantics: { aggregation: "MIN", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "INFERRED" } });
  assert.equal(min.value, "10");
  const max = computeIndicator({ ...base, semantics: { aggregation: "MAX", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "INFERRED" } });
  assert.equal(max.value, "20");
  const latest = computeIndicator({ ...base, semantics: { aggregation: "LATEST", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "INFERRED" } });
  assert.equal(latest.value, "20");
});

test("computeIndicator PERCENTAGE is weighted via numerator/denominator", () => {
  const finding = computeIndicator({
    indicatorId: "ind-pct",
    indicatorCode: "PCT",
    indicatorType: "PERCENTAGE",
    semantics: { aggregation: "PERCENTAGE", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "INFERRED", numeratorIndicatorId: "num", denominatorIndicatorId: "den" },
    disaggregationRequired: false,
    updates: [],
    numeratorValues: ["25", "25"],
    denominatorValues: ["100", "100"],
  });
  assert.equal(finding.value, "25");
  assert.equal(finding.qualityFlags.includes("MISSING_DENOMINATOR"), false);
});

test("computeIndicator PERCENTAGE without denominator flags MISSING_DENOMINATOR", () => {
  const finding = computeIndicator({
    indicatorId: "ind-pct",
    indicatorCode: "PCT",
    indicatorType: "PERCENTAGE",
    semantics: { aggregation: "PERCENTAGE", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "REQUIRES_REVIEW" },
    disaggregationRequired: false,
    updates: [],
  });
  assert.equal(finding.value, "0");
  assert.ok(finding.qualityFlags.includes("MISSING_DENOMINATOR"));
  assert.ok(finding.qualityFlags.includes("NEEDS_REVIEW"));
});

test("computeIndicator RATIO computes numerator/denominator", () => {
  const finding = computeIndicator({
    indicatorId: "ind-r",
    indicatorCode: "RAT",
    indicatorType: "RATIO",
    semantics: { aggregation: "RATIO", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "INFERRED", numeratorIndicatorId: "num", denominatorIndicatorId: "den" },
    disaggregationRequired: true,
    updates: [],
    numeratorValues: ["5"],
    denominatorValues: ["20"],
  });
  assert.equal(finding.value, "0.25");
  assert.ok(finding.qualityFlags.includes("MISSING_DISAGGREGATION"));
});

// ---------------------------------------------------------------------------
// Direction-aware narrative gating
// ---------------------------------------------------------------------------

test("REQUIRES_REVIEW semantics never produce evaluative narrative", () => {
  const evaluation = evaluatePerformance({
    value: "90",
    baseline: "0",
    target: "100",
    semantics: { aggregation: "SUM", direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD", status: "REQUIRES_REVIEW" },
  });
  assert.equal(evaluation.type, "NEUTRAL");
});

test("NEUTRAL direction always yields descriptive-only evaluation", () => {
  const evaluation = evaluatePerformance({
    value: "90",
    target: "100",
    semantics: { aggregation: "SUM", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "CONFIGURED" },
  });
  assert.equal(evaluation.type, "NEUTRAL");
});

test("configured HIGHER_IS_BETTER with target comparison yields POSITIVE", () => {
  const evaluation = evaluatePerformance({
    value: "120",
    target: "100",
    semantics: { aggregation: "SUM", direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD", status: "CONFIGURED" },
  });
  assert.equal(evaluation.type, "POSITIVE");
});

// ---------------------------------------------------------------------------
// Gate rules (§2.4)
// ---------------------------------------------------------------------------

test("gate policy table: every row maps to the documented outcome", () => {
  assert.equal(gateDecisionFor("VERIFIED").approval, "ALLOW");
  assert.equal(gateDecisionFor("DESCRIPTIVE").approval, "ALLOW");
  assert.equal(gateDecisionFor("AUTO_FIXABLE").drafting, "FIX_SILENTLY");
  assert.equal(gateDecisionFor("UNSUPPORTED_MATERIAL_CLAIM").approval, "WARN");
  assert.equal(gateDecisionFor("UNSUPPORTED_MATERIAL_CLAIM").submit, "BLOCK_OR_EXCLUDE");
  assert.equal(gateDecisionFor("NUMERIC_CONTRADICTION").approval, "BLOCK");
  assert.equal(gateDecisionFor("CONFIDENTIALITY_VIOLATION").approval, "BLOCK");
  assert.equal(gateDecisionFor("SUBJECTIVE_CONCERN").submit, "HUMAN_DECISION");
  assert.equal(gateDecisionFor("MISSING_OPTIONAL_EVIDENCE").submit, "WARN");
});

test("evaluateReportGate blocks approval on contradictions and confidentiality", () => {
  const result = evaluateReportGate({
    claimOutcomes: [
      { kind: "VERIFIED", detail: "ok" },
      { kind: "NUMERIC_CONTRADICTION", detail: "contradicts" },
      { kind: "CONFIDENTIALITY_VIOLATION", detail: "confidential" },
    ],
    unresolvedSemantics: 0,
  });
  assert.equal(result.approvalBlocked, true);
  assert.equal(result.submitBlocked, true);
  assert.ok(result.blockReasons.length >= 2);
});

test("evaluateReportGate blocks evaluative statements from unresolved semantics", () => {
  const result = evaluateReportGate({ claimOutcomes: [], unresolvedSemantics: 2 });
  assert.equal(result.approvalBlocked, true);
});

test("evaluateReportGate allows verified and descriptive findings", () => {
  const result = evaluateReportGate({
    claimOutcomes: [
      { kind: "VERIFIED", detail: "ok" },
      { kind: "DESCRIPTIVE", detail: "descriptive" },
    ],
    unresolvedSemantics: 0,
  });
  assert.equal(result.approvalBlocked, false);
  assert.equal(result.submitBlocked, false);
});

// ---------------------------------------------------------------------------
// Claim model
// ---------------------------------------------------------------------------

test("ACCEPTED_WITH_LIMITATION requires a note and preserves failed status", () => {
  const claim = ReportClaim.create({
    id: "c1",
    tenantId: "tenant-a",
    projectId: "proj-1",
    reportDraftId: "draft-1",
    sectionId: "sec-1",
    text: "Claim text",
    type: "CAUSAL",
    verificationResult: "FAILED",
  });
  assert.throws(() => claim.resolve({ result: "ACCEPTED_WITH_LIMITATION", by: "user-1" }), /note/);
  claim.resolve({ result: "ACCEPTED_WITH_LIMITATION", notes: "accepted with limitations", by: "user-1" });
  assert.equal(claim.verificationResult, "FAILED");
  assert.equal(claim.resolutionNotes, "accepted with limitations");
  assert.equal(claim.resolvedById, "user-1");
});

test("resolveClaimDecision gates EXCLUDED on confidential sources", () => {
  const decision = resolveClaimDecision({ resolution: "EXCLUDED", isConfidentialSource: true });
  assert.equal(decision.requiredCapability, "report.override-confidentiality");
  const open = resolveClaimDecision({ resolution: "EXCLUDED", isConfidentialSource: false });
  assert.equal(open.requiredCapability, "NONE");
});

test("claim sources require hash, chunk, and evidence ids", () => {
  const claim = ReportClaim.create({
    id: "c2",
    tenantId: "tenant-a",
    projectId: "proj-1",
    reportDraftId: "draft-1",
    sectionId: "sec-1",
    text: "x",
    type: "FACTUAL",
  });
  assert.throws(() => claim.addSource({ evidenceId: "", chunkId: "c", sourceText: "t", evidenceHash: "h", evidenceUpdatedAt: new Date(), chunkerVersion: "v" }), /evidenceId/);
  const source = { evidenceId: "e1", chunkId: "c1", sourceText: "text", evidenceHash: "abc", evidenceUpdatedAt: new Date("2026-08-01"), chunkerVersion: "chunker-v1" };
  claim.addSource(source);
  assert.equal(claim.sources[0].evidenceHash, "abc");
});

// ---------------------------------------------------------------------------
// Report plan and generation run invariants
// ---------------------------------------------------------------------------

test("report plan requires at least one section and validates word limits", () => {
  assert.throws(() => createReportPlan({ id: "p1", tenantId: "t", projectId: "p", reportingPeriodId: "r", sections: [], style: { tone: "FORMAL", language: "en", formattingRules: [] } }), /at least one section/);
  assert.throws(
    () => createReportPlan({
      id: "p1", tenantId: "t", projectId: "p", reportingPeriodId: "r",
      sections: [{ templateSectionId: "s", title: "S", inputType: "NARRATIVE", required: true, mandatoryQuestions: [], evidenceNeeds: [], wordLimit: { min: 5, max: 2 } }],
      style: { tone: "FORMAL", language: "en", formattingRules: [] },
    }),
    /max/,
  );
});

test("generation run snapshot is persisted once and fields are stable", () => {
  const run = ReportGenerationRun.create({
    id: "run-1",
    tenantId: "tenant-a",
    projectId: "proj-1",
    reportingPeriodId: "period-1",
    draftId: "draft-1",
    templateVersion: 1,
    profileVersion: 1,
    plannerVersion: 1,
    indicatorUpdateIds: ["u1"],
    evidenceIds: ["e1"],
    verifiedFindings: [],
    modelId: "stub",
    promptVersion: 1,
    generationParams: {},
  });
  assert.equal(run.id, "run-1");
  assert.equal(run.snapshot.draftId, "draft-1");
  const rehydrated = ReportGenerationRun.rehydrate(run.snapshot);
  assert.equal(rehydrated.id, "run-1");
  assert.deepEqual(rehydrated.snapshot.indicatorUpdateIds, ["u1"]);
});

// ---------------------------------------------------------------------------
// Semantics defaults and inference
// ---------------------------------------------------------------------------

test("default semantics are conservative: NEUTRAL direction, REQUIRES_REVIEW for numeric", () => {
  const s = defaultSemanticsForType("NUMBER");
  assert.equal(s.direction, "NEUTRAL");
  assert.equal(s.status, "REQUIRES_REVIEW");
  assert.equal(s.aggregation, "SUM");
});

test("inference never claims a direction", () => {
  const inferred = inferIndicatorSemantics({ type: "NUMBER", name: "Beneficiaries reached" });
  assert.equal(inferred.aggregation, "SUM");
  assert.equal(inferred.direction, "NEUTRAL");
});

test("percentage semantics require numerator and denominator when configured", () => {
  assert.throws(() => sanitizeIndicatorSemantics({ aggregation: "PERCENTAGE", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "INFERRED" }), /numerator/);
});
