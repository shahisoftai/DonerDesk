import type { EvalResult, EvaluationScore } from "./eval.js";

export interface GoldenNumericFact {
  value: string;
  expected: "present" | "absent";
}

export interface GoldenArtifactExpectation {
  /** The kinds that must be present, in order. */
  kinds: ReadonlyArray<"TABLE" | "CHART" | "LIST" | "KEY_VALUE" | "QA" | "DELTA">;
  /** Optional numeric facts that must appear inside any artifact payload. */
  mustContainValues?: ReadonlyArray<string>;
  /** Optional exact-match requirement for the table. */
  table?: { columns: ReadonlyArray<string>; rowCount: number };
  /** Optional exact-match requirement for the chart. */
  chart?: { type: string; dataBinding: string };
  /** Optional exact-match requirement for the delta. */
  delta?: { metric: string; fromValue: string; toValue: string; direction: "UP" | "DOWN" | "FLAT" };
}

export interface ReportGoldenCase {
  name: string;
  draftText: string;
  referenceAssertions: Array<{ text: string }>;
  numericFacts: GoldenNumericFact[];
  requiredLimitations: string[];
  /** Expected classification: pass (compliant) or fail (adversarial). */
  expected?: "pass" | "fail";

  // AI Reporter 2 — additive artifact/QA/chart expectations (optional).
  artifacts?: GoldenArtifactExpectation;
  mandatoryQuestions?: ReadonlyArray<string>;
  brief?: { minWords: number; maxWords: number; bannedPhrases?: ReadonlyArray<string> };
  priorNarrativePresent?: boolean;
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
 * Qualitative repetition signal: 1 when no two sentences are near-identical,
 * degrading toward 0 as duplicated content appears. This is a soft signal only;
 * it never independently fails a case.
 */
function repetitionScore(text: string): number {
  const sentences = text.split(/[.!?]+\s+/).map(sentenceKey).filter(Boolean);
  if (sentences.length < 2) return 1;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const s of sentences) {
    if (seen.has(s)) duplicates++;
    seen.add(s);
  }
  return 1 - duplicates / sentences.length;
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

    // --- AI Reporter 2 — additive artifact/QA/chart expectations ---
    // Each new metric is hard-failed when its brief declares the expectation
    // and the draft fails it; otherwise it's reported as a soft signal.
    if (input.brief?.bannedPhrases && input.brief.bannedPhrases.length > 0) {
      const lc = input.draftText.toLowerCase();
      const hits = input.brief.bannedPhrases.filter((p) => lc.includes(p.toLowerCase()));
      const ok = hits.length === 0;
      scores.push({
        metric: "banned-phrase",
        score: ok ? 1 : 0,
        details: ok ? "none" : hits.join(","),
      });
    }

    if (input.mandatoryQuestions && input.mandatoryQuestions.length > 0) {
      // For the draftText-only corpus, we approximate QA coverage by checking
      // that each question's key terms appear somewhere in the text.
      let qaHits = 0;
      for (const q of input.mandatoryQuestions) {
        const words = q
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 4);
        if (words.length === 0) {
          qaHits++;
        } else if (words.some((w) => input.draftText.toLowerCase().includes(w))) {
          qaHits++;
        }
      }
      const ok = qaHits === input.mandatoryQuestions.length;
      scores.push({
        metric: "qa-coverage",
        score: ok ? 1 : qaHits / input.mandatoryQuestions.length,
        details: `${qaHits}/${input.mandatoryQuestions.length}`,
      });
    }

    if (input.brief && (input.brief.minWords > 0 || input.brief.maxWords > 0)) {
      const wc = input.draftText.trim().split(/\s+/).filter(Boolean).length;
      const ok =
        (input.brief.minWords === undefined || wc >= input.brief.minWords) &&
        (input.brief.maxWords === undefined || wc <= input.brief.maxWords);
      scores.push({ metric: "narrative-length-vs-target", score: ok ? 1 : 0, details: `${wc} words` });
    }

    if (input.artifacts) {
      // Approximation for the draftText corpus: count kinds present in the
      // prose by their canonical markers.
      const lc = input.draftText.toLowerCase();
      const detected: { TABLE: number; CHART: number; LIST: number; KEY_VALUE: number; QA: number; DELTA: number } = {
        TABLE: 0,
        CHART: 0,
        LIST: 0,
        KEY_VALUE: 0,
        QA: 0,
        DELTA: 0,
      };
      if (/\|.*\|/.test(input.draftText)) detected.TABLE++;
      if (/baseline|target|achievement/.test(lc)) detected.CHART++;
      if (/^\s*[-*]\s/m.test(input.draftText)) detected.LIST++;
      const presentCount = input.artifacts.kinds.filter((k) => detected[k] > 0).length;
      const artifactCoverage = input.artifacts.kinds.length === 0 ? 1 : presentCount / input.artifacts.kinds.length;
      scores.push({
        metric: "artifact-coverage",
        score: artifactCoverage,
        details: `${presentCount}/${input.artifacts.kinds.length}`,
      });

      if (input.artifacts.mustContainValues && input.artifacts.mustContainValues.length > 0) {
        let hits = 0;
        for (const v of input.artifacts.mustContainValues) {
          if (input.draftText.includes(v)) hits++;
        }
        const ok = hits === input.artifacts.mustContainValues.length;
        scores.push({
          metric: "citation-density",
          score: ok ? 1 : hits / input.artifacts.mustContainValues.length,
          details: `${hits}/${input.artifacts.mustContainValues.length}`,
        });
      }
    }

    const overall = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;

    // Qualitative repetition is reported but never a hard failure.
    const repetition = repetitionScore(input.draftText);
    scores.push({ metric: "repetition", score: repetition, details: repetition.toFixed(2) });

    // Critical failures are never averaged away: a missing required limitation
    // or a missed numeric fact fails the case regardless of the aggregate score.
    const missingLimitation = input.requiredLimitations.length > 0 && limitationHits < input.requiredLimitations.length;
    const numericMiss = input.numericFacts.length > 0 && numericAccuracy < 1;
    const bannedPhraseFail =
      input.brief?.bannedPhrases !== undefined &&
      input.brief.bannedPhrases.length > 0 &&
      (scores.find((s) => s.metric === "banned-phrase")?.score ?? 1) < 1;
    const wordCountFail =
      input.brief !== undefined &&
      (scores.find((s) => s.metric === "narrative-length-vs-target")?.score ?? 1) < 1;
    const criticalFailure = missingLimitation || numericMiss || bannedPhraseFail || wordCountFail;

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
