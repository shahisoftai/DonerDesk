import assert from "node:assert/strict";
import test from "node:test";
import { DeterministicAssertionExtractor } from "../dist/llm/assertion-extractor.js";
import { DeterministicClaimVerifier } from "../dist/llm/claim-verifier.js";

/**
 * Report-Quality regression tests.
 *
 * The verifier previously produced ~109 false-positive "figure doesn't match"
 * issues against legitimate donor-template content: dates, participant counts,
 * summary counts, indicator tables, evidence counts, and "80%" in an indicator
 * name. Root cause: any sentence containing a number was classified as a
 * NUMERIC achievement claim. These tests pin the fix — metadata/reference
 * numbers must not become verifiable achievement claims, while genuine
 * performance figures still must.
 */

const extractor = new DeterministicAssertionExtractor();

async function typesFor(content) {
  const r = await extractor.extract({ content, writerClaims: [] });
  assert.ok(r.ok);
  return r.value.map((a) => ({ type: a.type, text: a.text, materiality: a.materiality, atoms: a.numericAtoms.map((n) => n.value) }));
}

test("RQ: summary/count metadata is not a numeric achievement claim", async () => {
  const rows = await typesFor(
    "This report summarises implementation progress. 20 indicator finding(s), 10 activity record(s), and 12 evidence file(s) support the claims below.",
  );
  const summary = rows.find((r) => r.text.includes("finding(s)"));
  assert.ok(summary, "summary sentence present");
  assert.notEqual(summary.type, "NUMERIC", "count metadata must not be a NUMERIC claim");
  assert.notEqual(summary.materiality, "MATERIAL", "count metadata must not be material");
});

test("RQ: activity date + participant count is not a numeric achievement claim", async () => {
  const rows = await typesFor(
    "- Activity: Establishment of Child Protection Referral Pathways (2026-02-28), 25 participant(s).",
  );
  const activity = rows.find((r) => r.text.includes("Establishment"));
  assert.ok(activity, "activity line present");
  assert.notEqual(activity.type, "NUMERIC", "date + participant count must not be a NUMERIC claim");
});

test("RQ: evidence count is not a numeric achievement claim", async () => {
  const rows = await typesFor("The evidence pack contains 12 file(s).");
  assert.notEqual(rows[0].type, "NUMERIC");
  assert.notEqual(rows[0].materiality, "MATERIAL");
});

test("RQ: evidence reference lists are metadata, not numeric achievement claims", async () => {
  const rows = await typesFor(
    "Evidence: Learning Centre Establishment Photos - January 2026, Learning Centre Inspection Report - May 2026 - Remedial Support Sessions for Struggling Students (2026-06-01), All 75 Learning Centres - Implemented targeted remedial support sessions for 1,860 students.",
  );
  assert.equal(rows.length, 0, "evidence reference lists must not become claims");
});

test("RQ: markdown table rows are skipped entirely", async () => {
  const rows = await typesFor("| OUT-1 (Number of learning centres established) | 30 centres | / target 120 |");
  assert.equal(rows.length, 0, "table rows must not become claims");
});

test("RQ: '80%+' inside an indicator name is not an achievement atom (5600 remains)", async () => {
  const rows = await typesFor(
    "OUT-5 (Number of children attending regularly (80%+ attendance)): 5600 children recorded for the period against a target of 6400 children.",
  );
  const out5 = rows.find((r) => r.text.includes("OUT-5"));
  assert.ok(out5, "OUT-5 sentence present");
  assert.equal(out5.type, "NUMERIC", "OUT-5 is a real achievement claim");
  assert.ok(!out5.atoms.includes("80"), `'80' must not be an achievement atom; got ${out5.atoms.join(",")}`);
  assert.ok(out5.atoms.includes("5600"), "achievement 5600 must remain");
});

test("RQ: genuine performance figures remain verifiable NUMERIC claims", async () => {
  const rows = await typesFor("Reached 500 beneficiaries this quarter.");
  const numeric = rows.find((r) => r.type === "NUMERIC");
  assert.ok(numeric, "genuine performance sentence must be NUMERIC");
  assert.equal(numeric.materiality, "MATERIAL");
  assert.ok(numeric.atoms.includes("500"));
});

test("RQ: ordinal/identifier labels ('Batch 2', 'Phase 1') are not numeric claims", async () => {
  const rows = await typesFor("- Teacher Training on Accelerated Learning - Batch 2: Scheduling during Ramadan required adjustment.");
  const batch = rows.find((r) => r.text.includes("Batch 2"));
  assert.ok(batch, "batch line present");
  assert.notEqual(batch.type, "NUMERIC", "'Batch 2' ordinal must not be a NUMERIC claim");
  assert.notEqual(batch.materiality, "MATERIAL");
});

test("RQ: the OUT-5 achievement sentence verifies cleanly (no VALUE_MISMATCH on 80/6400)", async () => {
  const content =
    "OUT-5 (Number of children attending regularly (80%+ attendance)): 5600 children recorded for the period against a target of 6400 children.";
  const extraction = await extractor.extract({ content, writerClaims: [] });
  assert.ok(extraction.ok);
  const out5 = extraction.value.find((a) => a.text.includes("OUT-5"));
  assert.ok(out5);

  // A verified finding for OUT-5 = 5600 (so the achievement binds; the target
  // 6400 and the name's "80%" are references and must not fail verification).
  const finding = {
    indicatorId: "ind-5",
    indicatorCode: "OUT-5",
    indicatorName: "Number of children attending regularly (80%+ attendance)",
    value: "5600",
    unit: "children",
    target: "6400",
    calculationMethod: "SUM:neutral:period",
    qualityFlags: [],
    performanceEvaluation: undefined,
    comparisonValue: undefined,
  };
  const verifier = new DeterministicClaimVerifier();
  const v = await verifier.verify({
    claim: { text: out5.text, type: "NUMERIC", proposedSources: [] },
    findings: [finding],
    evidencePackages: [],
  });
  assert.ok(v.ok);
  assert.equal(v.value.result, "PASSED", `OUT-5 achievement must verify clean; got ${v.value.result}: ${v.value.detail}`);
});
