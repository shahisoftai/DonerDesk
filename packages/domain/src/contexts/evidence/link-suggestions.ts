import { scoreSimilarity, scoreTokens } from "../ai/text-similarity.js";

/**
 * Which activity or indicator a file most likely proves, and *why*: the reason is shown to the person, so a
 * suggestion is something they can judge instead of a number. Never applied automatically.
 */
export interface SuggestionEvidence {
  title: string;
  fileName: string;
  notes?: string | undefined;
  extractedText?: string | undefined;
  /** The activity the file already belongs to, when it does. */
  activityId?: string | undefined;
}

export interface SuggestionActivity {
  id: string;
  title: string;
  /** The logframe Activity node the record delivers. */
  logframeActivityId?: string | undefined;
  /** The indicator the record feeds. */
  indicatorId?: string | undefined;
  alreadyAttached: boolean;
}

export interface SuggestionIndicator {
  id: string;
  code: string;
  name: string;
  logframeItemId?: string | undefined;
}

export interface LinkSuggestion {
  targetType: "activity" | "indicator";
  /** An activity id, or an indicator id (the caller maps it to the period value). */
  targetId: string;
  label: string;
  score: number;
  /** Plain words: "same activity node", "the file name mentions 'mentorship visits'". */
  reason: string;
}

/** Below this a match is more likely coincidence than a relationship. */
export const SUGGESTION_THRESHOLD = 0.2;
const NODE_SCORE = 0.7;
const FEED_SCORE = 0.8;
const EXTRACTED_TEXT_WEIGHT = 0.8;
const EXTRACTED_TEXT_CHARS = 2000;

/** The content words two texts share, as written in `a` (not stemmed), longest first (for the reason). */
export function sharedWords(a: string, b: string, limit = 3): string[] {
  const inB = new Set(scoreTokens(b));
  const seen = new Set<string>();
  const words: string[] = [];
  for (const word of a.match(/[\p{L}\p{N}]+/gu) ?? []) {
    const stem = scoreTokens(word)[0];
    if (stem === undefined || !inB.has(stem) || seen.has(stem)) continue;
    seen.add(stem);
    words.push(word.toLowerCase());
  }
  return words.sort((x, y) => y.length - x.length).slice(0, limit);
}

const withoutExtension = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");

function lexical(evidence: SuggestionEvidence, target: string): { score: number; reason: string } | undefined {
  const named = `${evidence.title} ${withoutExtension(evidence.fileName)} ${evidence.notes ?? ""}`;
  const fromName = scoreSimilarity(named, target);
  const fromText = evidence.extractedText ? scoreSimilarity(evidence.extractedText.slice(0, EXTRACTED_TEXT_CHARS), target) * EXTRACTED_TEXT_WEIGHT : 0;
  const score = Math.max(fromName, fromText);
  if (score < SUGGESTION_THRESHOLD) return undefined;
  const words = sharedWords(fromName >= fromText ? named : evidence.extractedText ?? "", target);
  const where = fromName >= fromText ? "the file name or title" : "the text of the file";
  return { score, reason: words.length > 0 ? `${where} mentions "${words.join(" ")}"` : `${where} is similar` };
}

export function suggestEvidenceLinks(input: {
  evidence: SuggestionEvidence;
  activities: ReadonlyArray<SuggestionActivity>;
  indicators: ReadonlyArray<SuggestionIndicator>;
  limit?: number;
}): LinkSuggestion[] {
  const out = new Map<string, LinkSuggestion>();
  const offer = (s: LinkSuggestion) => {
    const key = `${s.targetType}:${s.targetId}`;
    const existing = out.get(key);
    if (!existing || s.score > existing.score) out.set(key, s);
  };

  for (const activity of input.activities) {
    if (activity.alreadyAttached) continue;
    const match = lexical(input.evidence, activity.title);
    if (match) offer({ targetType: "activity", targetId: activity.id, label: activity.title, ...match });
  }

  const own = input.activities.find((a) => a.id === input.evidence.activityId);
  for (const indicator of input.indicators) {
    const label = `${indicator.code} — ${indicator.name}`;
    const match = lexical(input.evidence, `${indicator.code} ${indicator.name}`);
    if (match) offer({ targetType: "indicator", targetId: indicator.id, label, ...match });
    // The file belongs to an activity: what that activity feeds, or measures under the same node, is the likeliest proof.
    if (own?.indicatorId === indicator.id) {
      offer({ targetType: "indicator", targetId: indicator.id, label, score: FEED_SCORE, reason: "the activity this file belongs to records this indicator" });
    } else if (own?.logframeActivityId && indicator.logframeItemId === own.logframeActivityId) {
      offer({ targetType: "indicator", targetId: indicator.id, label, score: NODE_SCORE, reason: "same activity node in the logframe" });
    }
  }

  return [...out.values()].sort((a, b) => b.score - a.score).slice(0, input.limit ?? 5);
}
