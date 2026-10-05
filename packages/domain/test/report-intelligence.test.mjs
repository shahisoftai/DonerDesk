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
  extractNumericAtoms,
  classifyNumericAtomRoles,
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

test("evaluateReportGate surfaces blocking issues with claim/section/evidence IDs", () => {
  const result = evaluateReportGate({
    claimOutcomes: [
      { kind: "NUMERIC_CONTRADICTION", detail: "claim A", claimId: "c1", sectionId: "s1", evidenceId: "e1" },
      { kind: "NUMERIC_CONTRADICTION", detail: "claim B", claimId: "c2", sectionId: "s2" },
      { kind: "VERIFIED", detail: "ok", claimId: "c3" },
      { kind: "ASSERTION_COVERAGE_GAP", detail: "no revision", sectionId: "s3" },
      { kind: "SUBJECTIVE_CONCERN", detail: "subjective", claimId: "c4" },
    ],
    unresolvedSemantics: 0,
  });
  // Only the blocking kinds appear in blockingIssues (NUMERIC_CONTRADICTION and
  // ASSERTION_COVERAGE_GAP). VERIFIED and SUBJECTIVE_CONCERN do not block.
  const kinds = result.blockingIssues.map((i) => i.kind);
  assert.deepEqual(kinds.sort(), ["ASSERTION_COVERAGE_GAP", "NUMERIC_CONTRADICTION", "NUMERIC_CONTRADICTION"]);
  const numeric = result.blockingIssues.filter((i) => i.kind === "NUMERIC_CONTRADICTION");
  assert.equal(numeric.length, 2);
  assert.equal(numeric[0].claimId, "c1");
  assert.equal(numeric[0].sectionId, "s1");
  assert.equal(numeric[0].evidenceId, "e1");
  assert.equal(numeric[1].claimId, "c2");
  const coverage = result.blockingIssues.find((i) => i.kind === "ASSERTION_COVERAGE_GAP");
  assert.equal(coverage.sectionId, "s3");
  assert.equal(coverage.claimId, undefined);
});

test("evaluateReportGate blockingIssues include unresolved-semantics synthetic item", () => {
  const result = evaluateReportGate({ claimOutcomes: [], unresolvedSemantics: 3 });
  assert.equal(result.blockingIssues.length, 1);
  assert.equal(result.blockingIssues[0].kind, "NUMERIC_CONTRADICTION");
  assert.match(result.blockingIssues[0].detail, /unresolved semantics/);
});

// ---------------------------------------------------------------------------
// Cumulative figures + directly reported rates
// ---------------------------------------------------------------------------

test("computeIndicator exposes verified cumulative and prior-cumulative for SUM indicators", () => {
  const finding = computeIndicator({
    indicatorId: "ind-1",
    indicatorCode: "OUT-4",
    indicatorType: "NUMBER",
    semantics: { aggregation: "SUM", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "INFERRED" },
    disaggregationRequired: false,
    updates: [
      { id: "u1", periodAchievement: "2500", cumulativeAchievement: "7000", verificationStatus: "VERIFIED", updatedAt: new Date() },
    ],
  });
  assert.equal(finding.value, "2500");
  assert.equal(finding.cumulativeValue, "7000");
  assert.equal(finding.priorCumulativeValue, "4500");
});

test("computeIndicator reports a configured directly-reported rate without a denominator", () => {
  const finding = computeIndicator({
    indicatorId: "ind-13",
    indicatorCode: "OUT-13",
    indicatorType: "PERCENTAGE",
    semantics: { aggregation: "LATEST", direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD", status: "CONFIGURED" },
    disaggregationRequired: false,
    target: "100",
    updates: [
      { id: "u1", periodAchievement: "87", cumulativeAchievement: "87", verificationStatus: "VERIFIED", updatedAt: new Date() },
    ],
  });
  assert.equal(finding.value, "87");
  assert.ok(!finding.qualityFlags.includes("MISSING_DENOMINATOR"));
  assert.ok(!finding.qualityFlags.includes("NEEDS_REVIEW"));
  assert.equal(finding.performanceEvaluation.type, "NEGATIVE");
});

test("computeIndicator does not expose cumulative when the headline value is already cumulative", () => {
  const finding = computeIndicator({
    indicatorId: "ind-1",
    indicatorCode: "OUT-1",
    indicatorType: "NUMBER",
    semantics: { aggregation: "LATEST", direction: "NEUTRAL", reportingBasis: "CUMULATIVE", status: "CONFIGURED" },
    disaggregationRequired: false,
    updates: [
      { id: "u1", periodAchievement: "30", cumulativeAchievement: "75", verificationStatus: "VERIFIED", updatedAt: new Date() },
    ],
  });
  assert.equal(finding.value, "75");
  assert.equal(finding.cumulativeValue, undefined);
});

test("numeric atom classifier treats dates, durations and record counts as metadata", () => {
  const roles = (text) => classifyNumericAtomRoles(text, extractNumericAtoms(text)).map((a) => `${a.value}:${a.role}`);
  assert.deepEqual(roles("Started on 10 May 2026."), ["10:DATE", "2026:DATE"]);
  assert.deepEqual(roles("Held on May 10."), ["10:DATE"]);
  assert.equal(roles("6-month retention was 85%")[0], "6:COUNT");
  assert.equal(roles("recorded 20 verified indicator result(s)")[0], "20:COUNT");
  assert.equal(roles("4500 kits were distributed")[0], "4500:OTHER");
  assert.deepEqual(roles("1 performed favourably, 7 performed unfavourably, and 0 could not be assessed"), ["1:COUNT", "7:COUNT", "0:COUNT"]);
});

// ---------------------------------------------------------------------------
// Disaggregation: MISSING_DISAGGREGATION means "required and not recorded" (verified-finding.ts)
// ---------------------------------------------------------------------------

const sexEntries = (f, m) => [
  { dimension: "SEX", category: "Female", value: String(f) },
  { dimension: "SEX", category: "Male", value: String(m) },
];
const sumSemantics = { aggregation: "SUM", direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD", status: "CONFIGURED" };
const disBase = { indicatorId: "ind-d", indicatorCode: "IND-D", indicatorType: "NUMBER", semantics: sumSemantics, disaggregationRequired: true };

test("computeIndicator does not flag MISSING_DISAGGREGATION when a breakdown was recorded, and exposes it", () => {
  const finding = computeIndicator({
    ...disBase,
    updates: [{ id: "d1", periodAchievement: "150", cumulativeAchievement: "150", verificationStatus: "VERIFIED", updatedAt: new Date(), disaggregation: sexEntries(78, 72) }],
  });
  assert.ok(!finding.qualityFlags.includes("MISSING_DISAGGREGATION"));
  assert.deepEqual(finding.disaggregation, sexEntries(78, 72));
});

test("computeIndicator still flags MISSING_DISAGGREGATION when it is required and nothing was recorded", () => {
  const finding = computeIndicator({
    ...disBase,
    updates: [{ id: "d1", periodAchievement: "150", cumulativeAchievement: "150", verificationStatus: "VERIFIED", updatedAt: new Date(), disaggregation: [] }],
  });
  assert.ok(finding.qualityFlags.includes("MISSING_DISAGGREGATION"));
  assert.equal(finding.disaggregation, undefined);
});

test("computeIndicator ignores a breakdown that sits on an unverified update", () => {
  const finding = computeIndicator({
    ...disBase,
    updates: [{ id: "d1", periodAchievement: "150", cumulativeAchievement: "150", verificationStatus: "DRAFT", updatedAt: new Date(), disaggregation: sexEntries(78, 72) }],
  });
  assert.ok(finding.qualityFlags.includes("MISSING_DISAGGREGATION"));
  assert.equal(finding.disaggregation, undefined);
});

test("computeIndicator adds a SUM indicator's breakdown across verified updates", () => {
  const finding = computeIndicator({
    ...disBase,
    updates: [
      { id: "d1", periodAchievement: "150", cumulativeAchievement: "150", verificationStatus: "VERIFIED", updatedAt: new Date("2026-03-31"), disaggregation: sexEntries(78, 72) },
      { id: "d2", periodAchievement: "180", cumulativeAchievement: "330", verificationStatus: "VERIFIED", updatedAt: new Date("2026-04-30"), disaggregation: sexEntries(94, 86) },
    ],
  });
  assert.equal(finding.value, "330");
  assert.deepEqual(finding.disaggregation, sexEntries(172, 158));
});

test("computeIndicator takes the latest verified breakdown for a non-SUM indicator", () => {
  const finding = computeIndicator({
    ...disBase,
    semantics: { aggregation: "LATEST", direction: "NEUTRAL", reportingBasis: "PERIOD", status: "CONFIGURED" },
    updates: [
      { id: "d1", periodAchievement: "60", cumulativeAchievement: "60", verificationStatus: "VERIFIED", updatedAt: new Date("2026-03-31"), disaggregation: sexEntries(30, 30) },
      { id: "d2", periodAchievement: "70", cumulativeAchievement: "70", verificationStatus: "VERIFIED", updatedAt: new Date("2026-04-30"), disaggregation: sexEntries(36, 34) },
    ],
  });
  assert.deepEqual(finding.disaggregation, sexEntries(36, 34));
});

test("computeIndicator exposes a breakdown even when it is not required", () => {
  const finding = computeIndicator({
    ...disBase,
    disaggregationRequired: false,
    updates: [{ id: "d1", periodAchievement: "150", cumulativeAchievement: "150", verificationStatus: "VERIFIED", updatedAt: new Date(), disaggregation: sexEntries(78, 72) }],
  });
  assert.ok(!finding.qualityFlags.includes("MISSING_DISAGGREGATION"));
  assert.deepEqual(finding.disaggregation, sexEntries(78, 72));
});

test("a percentage with no numerator/denominator reports its latest verified rate instead of 'not calculable'", () => {
  const semantics = inferIndicatorSemantics({ type: "PERCENTAGE", name: "Average attendance rate" });
  assert.equal(semantics.aggregation, "LATEST");
  assert.equal(semantics.status, "REQUIRES_REVIEW", "still needs a human to confirm how it aggregates");
  const finding = computeIndicator({
    indicatorId: "ind-r", indicatorCode: "IND-R", indicatorType: "PERCENTAGE", baseline: "62", target: "85", semantics, disaggregationRequired: false,
    updates: [
      { id: "r1", periodAchievement: "79", cumulativeAchievement: "79", verificationStatus: "VERIFIED", updatedAt: new Date("2026-06-30") },
      { id: "r2", periodAchievement: "86", cumulativeAchievement: "86", verificationStatus: "VERIFIED", updatedAt: new Date("2026-08-31") },
    ],
  });
  assert.equal(finding.value, "86");
  assert.ok(!finding.qualityFlags.includes("MISSING_DENOMINATOR"));
  assert.ok(finding.qualityFlags.includes("NEEDS_REVIEW"));
  // With a numerator and denominator configured it is still a computed percentage.
  const computed = inferIndicatorSemantics({ type: "PERCENTAGE", name: "Pass rate", numeratorIndicatorId: "n", denominatorIndicatorId: "d" });
  assert.equal(computed.aggregation, "PERCENTAGE");
});

test("a value exactly on its target is a target met; exactly on a baseline is no change", () => {
  const sem = { aggregation: "SUM", direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD", status: "CONFIGURED" };
  assert.equal(evaluatePerformance({ value: "60", target: "60", baseline: "0", semantics: sem }).type, "POSITIVE");
  assert.equal(evaluatePerformance({ value: "245", target: "245", semantics: { ...sem, direction: "LOWER_IS_BETTER" } }).type, "POSITIVE");
  assert.equal(evaluatePerformance({ value: "40", baseline: "40", semantics: sem }).type, "NEUTRAL");
  assert.equal(evaluatePerformance({ value: "60", target: "60", semantics: { ...sem, direction: "NEUTRAL" } }).type, "NEUTRAL");
  assert.equal(evaluatePerformance({ value: "60", target: "60", semantics: { ...sem, status: "REQUIRES_REVIEW" } }).type, "NEUTRAL");
});

import { computeLifeOfProject } from "../dist/index.js";

test("life-of-project value carries the breakdown of the whole value, not of its last period", () => {
  const sum = { aggregation: "SUM", direction: "HIGHER_IS_BETTER", reportingBasis: "PERIOD", status: "CONFIGURED" };
  const sex = (f, m) => [{ dimension: "SEX", category: "Female", value: String(f) }, { dimension: "SEX", category: "Male", value: String(m) }];
  const update = (periodId, end, period, cumulative, disaggregation) => ({ periodId, periodEnd: new Date(end), periodAchievement: String(period), cumulativeAchievement: String(cumulative), verificationStatus: "VERIFIED", disaggregation });
  const life = computeLifeOfProject(sum, [
    update("p1", "2026-03-31", 150, 150, sex(78, 72)),
    update("p2", "2026-04-30", 180, 330, sex(94, 86)),
    update("p3", "2026-05-31", 240, 570, sex(125, 115)),
  ]);
  assert.equal(life.value, "570");
  assert.deepEqual(life.disaggregation, sex(297, 273), "78+94+125 and 72+86+115, not the last period's 125 / 115");
  const none = computeLifeOfProject(sum, [update("p1", "2026-03-31", 150, 150, undefined)]);
  assert.equal(none.disaggregation, undefined);
  const latest = computeLifeOfProject({ ...sum, aggregation: "LATEST" }, [update("p1", "2026-03-31", 60, 60, sex(30, 30)), update("p2", "2026-04-30", 70, 70, sex(36, 34))]);
  assert.deepEqual(latest.disaggregation, sex(36, 34));
});

import { scoreSimilarity } from "../dist/index.js";

test("number words and digits are the same figure for similarity", () => {
  assert.equal(scoreSimilarity("All six indicators met their targets", "All 6 indicators met their targets"), 1);
});
