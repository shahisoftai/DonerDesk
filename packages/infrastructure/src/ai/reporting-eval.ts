import type { EvalResult, EvaluationScore } from "./eval.js";

export interface GoldenNumericFact {
  value: string;
  expected: "present" | "absent";
}

export interface ReportGoldenCase {
  name: string;
  draftText: string;
  referenceAssertions: Array<{ text: string }>;
  numericFacts: GoldenNumericFact[];
  requiredLimitations: string[];
  /** Expected classification: pass (compliant) or fail (adversarial). */
  expected?: "pass" | "fail";
}

const LIMITATION_MARKERS = [
  "based on partial records",
  "preliminary data",
  "denominator could not be established",
  "disaggregated data was not recorded",
  "predate the reporting period",
  "inconsistent units",
  "requires verification",
  "not independently verified",
  "data quality",
  "limitation",
];

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function sentenceKey(text: string): string {
  return normalize(text).replace(/[.!?]+$/, "");
}

/**
 * Deterministic reporting evaluation harness. Scores assertion recall,
 * numeric accuracy, and limitation disclosure against anonymized golden
 * cases so submission-readiness claims are measured, not asserted. LLM-judge
 * scoring can be layered on the same metric surface later.
 */
export class ReportDraftEvaluator {
  constructor(private readonly threshold = 0.6) {}

  evaluateCase(input: ReportGoldenCase): EvalResult {
    const scores: EvaluationScore[] = [];

    // Assertion recall: how many golden assertions appear (semantically) in
    // the draft. Trailing sentence punctuation is ignored so punctuation-only
    // differences do not mask a real match.
    const normalizedDraft = normalize(input.draftText);
    let matched = 0;
    for (const assertion of input.referenceAssertions) {
      const key = sentenceKey(assertion.text);
      const found = input.draftText.split(/[.!?]+\s+/).some((sentence) => sentenceKey(sentence) === key);
      if (found) matched++;
    }
    const recall = input.referenceAssertions.length === 0 ? 1 : matched / input.referenceAssertions.length;
    scores.push({ metric: "assertion-recall", score: recall, details: `${matched}/${input.referenceAssertions.length}` });

    // Numeric accuracy: each fact must be present (or absent) in the draft.
    let numericHits = 0;
    for (const fact of input.numericFacts) {
      const present = normalizedDraft.includes(fact.value);
      if ((fact.expected === "present") === present) numericHits++;
    }
    const numericAccuracy = input.numericFacts.length === 0 ? 1 : numericHits / input.numericFacts.length;
    scores.push({ metric: "numeric-accuracy", score: numericAccuracy, details: `${numericHits}/${input.numericFacts.length}` });

    // Limitation disclosure: required caveats must survive the draft.
    const draftLower = normalizedDraft;
    let limitationHits = 0;
    for (const limitation of input.requiredLimitations) {
      const key = limitation.toLowerCase();
      const found = LIMITATION_MARKERS.some((marker) => key.includes(marker) && draftLower.includes(marker));
      if (found || draftLower.includes(key)) limitationHits++;
    }
    const limitationScore = input.requiredLimitations.length === 0 ? 1 : limitationHits / input.requiredLimitations.length;
    scores.push({ metric: "limitation-disclosure", score: limitationScore, details: `${limitationHits}/${input.requiredLimitations.length}` });

    const overall = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    // Critical failures are never averaged away: a missing required limitation
    // or a missed numeric fact fails the case regardless of the aggregate score.
    const missingLimitation = input.requiredLimitations.length > 0 && limitationHits < input.requiredLimitations.length;
    const numericMiss = input.numericFacts.length > 0 && numericAccuracy < 1;
    const criticalFailure = missingLimitation || numericMiss;

    return {
      overall,
      scores,
      passed: overall >= this.threshold && !criticalFailure,
      threshold: this.threshold,
    };
  }
}

export function createReportDraftEvaluator(threshold = 0.6): ReportDraftEvaluator {
  return new ReportDraftEvaluator(threshold);
}
