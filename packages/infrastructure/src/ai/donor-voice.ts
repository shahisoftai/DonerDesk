/**
 * Deterministic donor-voice (language craft) signals — TS mirror of
 * `apps/workers/app/ai_reporter/donor_voice.py`.
 *
 * Warnings only: a heuristic must never discard a factually correct section.
 * The golden-corpus evaluator reports the score as the `donor-voice` metric.
 */

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/;
const PASSIVE_RE =
  /\b(?:was|were|is|are|been|being|be)\s+(?:\w+ly\s+)?(?:\w+ed|built|done|made|given|held|taken|seen|shown|written|known|found|brought|taught|met|paid|sent|spent|won|run|led)\b/i;
const TOPIC_LABEL_OPENING_RE =
  /^\s*(?:regarding|in terms of|with regards? to|as regards|as for|concerning|this section|the following section|in this section)\b/i;

export const FILLER_PHRASES: readonly string[] = [
  "it is worth noting",
  "it should be noted",
  "it is important to note",
  "needless to say",
  "in order to",
  "at the end of the day",
];
export const VAGUE_QUANTIFIERS: readonly string[] = ["a number of", "numerous", "various", "many people", "several beneficiaries"];

const LONG_SENTENCE_WORDS = 35;
const PASSIVE_RATIO_WARN = 0.35;
const LONG_RATIO_WARN = 0.2;

export interface DonorVoiceReport {
  score: number;
  warnings: string[];
}

function sentences(text: string): string[] {
  const prose = text
    .split("\n")
    .filter((line) => !/^\s*[|\-*#]/.test(line))
    .join(" ");
  return prose
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function assessDonorVoice(text: string): DonorVoiceReport {
  const sents = sentences(text ?? "");
  if (sents.length === 0) return { score: 1, warnings: [] };
  const lower = (text ?? "").toLowerCase();
  const warnings: string[] = [];
  let penalty = 0;

  const passive = sents.filter((s) => PASSIVE_RE.test(s)).length;
  const passiveRatio = passive / sents.length;
  if (passiveRatio > PASSIVE_RATIO_WARN) {
    warnings.push(`VOICE_PASSIVE: ${passive}/${sents.length} sentences are passive; name the actor in the active voice`);
    penalty += Math.min(0.3, passiveRatio - PASSIVE_RATIO_WARN);
  }

  const long = sents.filter((s) => s.split(/\s+/).length > LONG_SENTENCE_WORDS).length;
  if (long / sents.length > LONG_RATIO_WARN) {
    warnings.push(`VOICE_LONG_SENTENCES: ${long} sentences exceed ${LONG_SENTENCE_WORDS} words; split them`);
    penalty += 0.15;
  }

  if (TOPIC_LABEL_OPENING_RE.test(sents[0]!)) {
    warnings.push("VOICE_TOPIC_OPENING: open with the result, not a topic label");
    penalty += 0.15;
  }

  const fillers = FILLER_PHRASES.filter((p) => lower.includes(p));
  if (fillers.length > 0) {
    warnings.push(`VOICE_FILLER: remove filler (${fillers.join(", ")})`);
    penalty += 0.05 * fillers.length;
  }

  const vague = VAGUE_QUANTIFIERS.filter((p) => lower.includes(p));
  if (vague.length > 0) {
    warnings.push(`VOICE_VAGUE: replace vague quantifiers with recorded figures or remove them (${vague.join(", ")})`);
    penalty += 0.05 * vague.length;
  }

  return { score: Math.max(0, Math.round((1 - penalty) * 1000) / 1000), warnings };
}
