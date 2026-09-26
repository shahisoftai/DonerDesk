/**
 * Pure, dependency-free lexical similarity scoring shared by claim entailment
 * verification and evidence retrieval ranking (donor-report quality audit,
 * 2026-09-17). Both consumers previously reimplemented raw, un-stemmed token
 * overlap independently — a claim written as "58 teachers were recruited"
 * scores poorly against evidence phrased "recruited 58 teachers for
 * training" purely because "recruited"/"teachers" don't line up as identical
 * strings when inflected differently elsewhere in the same document. This
 * module fixes that without any new dependency or external service: a light
 * suffix-stripping stemmer plus stopword-aware weighting, entirely pure
 * TypeScript, consistent with the zero-infra-deps domain layer.
 *
 * This is NOT semantic/embedding-based similarity — it remains a lexical
 * heuristic, just a meaningfully better-informed one. When a real embedding
 * provider is available, callers should prefer that; this module is the
 * always-available fallback/baseline.
 */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "into", "over",
  "was", "were", "are", "is", "be", "been", "being", "a", "an", "of",
  "to", "in", "on", "at", "by", "as", "it", "its", "their", "they",
  "report", "section", "project", "period", "during",
]);

/**
 * Strip common English inflectional suffixes so related word forms collapse
 * to (approximately) the same stem: "trained"/"training"/"train",
 * "teacher"/"teachers", "recruitment"/"recruited". Deliberately conservative
 * (guarded by minimum stem length) to avoid over-stemming short/unrelated
 * words into false matches.
 */
export function stem(token: string): string {
  let t = token;
  if (t.length > 6 && t.endsWith("ization")) t = t.slice(0, -7) + "ize";
  if (t.length > 5 && t.endsWith("ations")) t = t.slice(0, -6) + "ate";
  if (t.length > 5 && t.endsWith("ation")) t = t.slice(0, -5) + "ate";
  if (t.length > 5 && t.endsWith("ities")) t = t.slice(0, -5) + "y";
  if (t.length > 4 && t.endsWith("ity")) t = t.slice(0, -3);
  if (t.length > 5 && t.endsWith("ments")) t = t.slice(0, -5);
  if (t.length > 4 && t.endsWith("ment")) t = t.slice(0, -4);
  if (t.length > 5 && t.endsWith("ing") && t.length - 3 > 3) t = t.slice(0, -3);
  if (t.length > 4 && t.endsWith("ed") && t.length - 2 > 3) t = t.slice(0, -2);
  if (t.length > 4 && t.endsWith("es")) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) t = t.slice(0, -1);
  return t;
}

function normalizeText(text: string): string {
  return (text ?? "").toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Tokenize, drop stopwords/very-short tokens, and stem each remaining token. */
export function scoreTokens(text: string): string[] {
  return normalizeText(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map(stem);
}

/**
 * Weight a stemmed token by rarity-as-length heuristic: longer, more
 * specific words (domain terms, proper nouns) carry more evidence than
 * short common ones, approximating an IDF effect without needing corpus
 * document-frequency statistics.
 */
function tokenWeight(token: string): number {
  if (token.length <= 3) return 0.5;
  if (token.length <= 5) return 1;
  return 1.5;
}

/**
 * Weighted-overlap similarity between two free-text strings, normalised to
 * [0, 1]. Symmetric by construction (weighted Dice coefficient): scores the
 * shared weighted tokens against the combined weight of both sides, so
 * `scoreSimilarity(a, b) === scoreSimilarity(b, a)`.
 */
export function scoreSimilarity(a: string, b: string): number {
  const setA = new Set(scoreTokens(a));
  const setB = new Set(scoreTokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;

  const totalA = [...setA].reduce((sum, t) => sum + tokenWeight(t), 0);
  const totalB = [...setB].reduce((sum, t) => sum + tokenWeight(t), 0);
  let sharedWeight = 0;
  for (const token of setA) {
    if (setB.has(token)) sharedWeight += tokenWeight(token);
  }
  const denominator = totalA + totalB;
  if (denominator === 0) return 0;
  return Math.min(1, (2 * sharedWeight) / denominator);
}

export interface SimilarityCandidate {
  id: string;
  text: string;
}

export interface SimilarityMatch {
  id: string;
  score: number;
}

/** Best-scoring candidate for a query string, or undefined if every candidate scores 0. */
export function bestMatch(query: string, candidates: ReadonlyArray<SimilarityCandidate>): SimilarityMatch | undefined {
  let best: SimilarityMatch | undefined;
  for (const candidate of candidates) {
    const score = scoreSimilarity(query, candidate.text);
    if (score > 0 && (!best || score > best.score)) {
      best = { id: candidate.id, score };
    }
  }
  return best;
}
