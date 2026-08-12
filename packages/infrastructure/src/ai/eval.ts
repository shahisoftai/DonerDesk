import type { LlmFeedback } from "@donordesk/domain";

export interface EvaluationScore {
  metric: string;
  score: number;
  details?: string;
}

export interface EvalResult {
  overall: number;
  scores: EvaluationScore[];
  passed: boolean;
  threshold: number;
}

export interface RougeScore extends EvaluationScore {
  metric: "rouge-1" | "rouge-2" | "rouge-l";
  score: number;
  details: string;
}

export interface BleuScore extends EvaluationScore {
  metric: "bleu";
  score: number;
  details: string;
}

function lcs(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const ai = a[i - 1] ?? "";
      const bj = b[j - 1] ?? "";
      if (ai === bj) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }
  return dp[m]![n]!;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
}

function ngrams(tokens: string[], size: number): string[] {
  if (tokens.length < size) return [];
  return Array.from({ length: tokens.length - size + 1 }, (_, index) => tokens.slice(index, index + size).join(" "));
}

function clippedOverlap(reference: string[], hypothesis: string[]): number {
  const counts = new Map<string, number>();
  for (const token of reference) counts.set(token, (counts.get(token) ?? 0) + 1);
  let overlap = 0;
  for (const token of hypothesis) {
    const available = counts.get(token) ?? 0;
    if (available > 0) {
      overlap++;
      counts.set(token, available - 1);
    }
  }
  return overlap;
}

function f1(overlap: number, referenceCount: number, hypothesisCount: number): number {
  if (overlap === 0 || referenceCount === 0 || hypothesisCount === 0) return 0;
  const precision = overlap / hypothesisCount;
  const recall = overlap / referenceCount;
  return 2 * precision * recall / (precision + recall);
}

export class RougeEvaluator {
  evaluate(reference: string, hypothesis: string): RougeScore[] {
    const refTokens = tokenize(reference);
    const hypTokens = tokenize(hypothesis);
    const hypLen = hypTokens.length;
    const refLen = refTokens.length;

    if (hypLen === 0 || refLen === 0) {
      return [
        { metric: "rouge-1", score: 0, details: "Empty input" },
        { metric: "rouge-2", score: 0, details: "Empty input" },
        { metric: "rouge-l", score: 0, details: "Empty input" },
      ];
    }

    const rouge1 = f1(clippedOverlap(refTokens, hypTokens), refLen, hypLen);
    const refBigrams = ngrams(refTokens, 2);
    const hypBigrams = ngrams(hypTokens, 2);
    const rouge2 = f1(clippedOverlap(refBigrams, hypBigrams), refBigrams.length, hypBigrams.length);
    const rougeL = f1(lcs(refTokens, hypTokens), refLen, hypLen);

    return [
      { metric: "rouge-1", score: rouge1, details: `unigram overlap: ${(rouge1 * 100).toFixed(2)}%` },
      { metric: "rouge-2", score: rouge2, details: `bigram overlap: ${(rouge2 * 100).toFixed(2)}%` },
      { metric: "rouge-l", score: rougeL, details: `LCS-based: ${(rougeL * 100).toFixed(2)}%` },
    ];
  }
}

export class BleuEvaluator {
  evaluate(reference: string, hypothesis: string): BleuScore {
    const refTokens = tokenize(reference);
    const hypTokens = tokenize(hypothesis);

    if (hypTokens.length === 0) {
      return { metric: "bleu", score: 0, details: "Empty hypothesis" };
    }

    const hypLen = hypTokens.length;
    const refLen = refTokens.length;
    const bp = hypLen >= refLen ? 1 : Math.exp(1 - refLen / hypLen);
    const order = Math.min(4, hypLen, refLen);
    const precisions = Array.from({ length: order }, (_, index) => {
      const ref = ngrams(refTokens, index + 1);
      const hyp = ngrams(hypTokens, index + 1);
      return hyp.length === 0 ? 0 : clippedOverlap(ref, hyp) / hyp.length;
    });
    const geoMean = precisions.some((value) => value === 0)
      ? 0
      : Math.exp(precisions.reduce((sum, value) => sum + Math.log(value), 0) / precisions.length);
    const bleu = bp * geoMean;
    return {
      metric: "bleu",
      score: bleu,
      details: `brevity penalty: ${(bp * 100).toFixed(2)}%, precision: ${precisions.map((value) => `${(value * 100).toFixed(2)}%`).join("/")}`,
    };
  }
}

export interface LlmJudgeResult extends EvaluationScore {
  metric: "llm-judge";
  score: number;
  details: string;
  reasoning?: string;
}

export class EvaluationHarness {
  private readonly rougeEvaluator = new RougeEvaluator();
  private readonly bleuEvaluator = new BleuEvaluator();
  private readonly defaultThreshold = 0.6;

  evaluate(
    reference: string,
    hypothesis: string,
    threshold = this.defaultThreshold,
  ): EvalResult {
    const rougeScores = this.rougeEvaluator.evaluate(reference, hypothesis);
    const bleuScore = this.bleuEvaluator.evaluate(reference, hypothesis);

    const allScores: EvaluationScore[] = [...rougeScores, bleuScore];

    const avgScore = allScores.reduce((sum, s) => sum + s.score, 0) / allScores.length;

    return {
      overall: avgScore,
      scores: allScores,
      passed: avgScore >= threshold,
      threshold,
    };
  }

  async evaluateWithLlmJudge(
    hypothesis: string,
    criteria: string,
    llmProvider: (prompt: string) => Promise<string>,
  ): Promise<LlmJudgeResult> {
    const response = await llmProvider([
      "Evaluate the candidate against the criteria. Return JSON only with score (0 to 1) and reasoning.",
      `Criteria: ${criteria}`,
      `Candidate: ${hypothesis}`,
    ].join("\n"));
    let parsed: unknown;
    try {
      parsed = JSON.parse(response);
    } catch {
      throw new Error("LLM judge returned invalid JSON");
    }
    const candidate = parsed as { score?: unknown; reasoning?: unknown };
    if (typeof candidate.score !== "number" || !Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 1) {
      throw new Error("LLM judge score must be between 0 and 1");
    }
    const reasoning = typeof candidate.reasoning === "string" ? candidate.reasoning : "No reasoning provided";
    return { metric: "llm-judge", score: candidate.score, details: reasoning, reasoning };
  }

  aggregateFeedbackSignals(feedbacks: LlmFeedback[]): {
    acceptanceRate: number;
    avgRating: number | null;
    byTaskType: Record<string, { count: number; acceptanceRate: number }>;
  } {
    if (feedbacks.length === 0) {
      return { acceptanceRate: 0, avgRating: null, byTaskType: {} };
    }

    const accepted = feedbacks.filter((f) => f.isAccepted()).length;
    const ratings = feedbacks.map((f) => f.rating).filter((r): r is number => r !== undefined);

    const byTaskType: Record<string, { count: number; acceptanceRate: number }> = {};
    for (const feedback of feedbacks) {
      const type = feedback.taskType;
      if (!byTaskType[type]) {
        byTaskType[type] = { count: 0, acceptanceRate: 0 };
      }
      byTaskType[type]!.count++;
      if (feedback.isAccepted()) {
        byTaskType[type]!.acceptanceRate =
          (byTaskType[type]!.acceptanceRate * (byTaskType[type]!.count - 1) + 1) / byTaskType[type]!.count;
      } else {
        byTaskType[type]!.acceptanceRate =
          byTaskType[type]!.acceptanceRate * (byTaskType[type]!.count - 1) / byTaskType[type]!.count;
      }
    }

    return {
      acceptanceRate: accepted / feedbacks.length,
      avgRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      byTaskType,
    };
  }
}

export function createEvaluationHarness(): EvaluationHarness {
  return new EvaluationHarness();
}
