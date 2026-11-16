/**
 * Suggested settings for an indicator read from a document or a sheet (Phase 58.1). A sheet rarely says what kind of number an indicator
 * is or which way is better, so the wizard used to leave both empty and ask for them on every card. This is the one rule that proposes
 * them. Pure: no clock, no framework. Every suggestion carries its reason, and a title it cannot judge gets no suggestion (never a guess).
 */
export type SuggestedType = "NUMBER" | "PERCENTAGE";
export type SuggestedDirection = "HIGHER" | "LOWER";

export interface IndicatorDefaultsInput {
  readonly title: string | null;
  readonly type: string | null;
  readonly unit: string | null;
  readonly target: string | null;
}

export interface IndicatorSuggestion {
  readonly type: { readonly value: SuggestedType; readonly reason: string } | null;
  readonly direction: { readonly value: SuggestedDirection; readonly reason: string } | null;
}

/** Words that make a smaller figure the better one. Checked first, so "non-response" and "defaulted" never read as progress. */
const LOWER_WORDS: ReadonlyArray<RegExp> = [
  /\bdeath/i, /\bdied\b/i, /\bmortalit/i, /\bdefault/i, /\bnon[- ]?respon/i, /\bnon[- ]?recover/i, /\bdrop[- ]?out/i, /\bstock[- ]?out/i,
  /\bincidence\b/i, /\bprevalence\b/i, /\bwasting\b/i, /\bstunting\b/i, /\bdelay/i, /\bwaiting time/i, /\bmorbidity\b/i, /\babsentee/i, /\bmoved out\b/i, /\bviolations?\b/i,
];

/** Words that make a larger figure the better one (work done, people reached, things delivered). */
const HIGHER_WORDS: ReadonlyArray<RegExp> = [
  /\bcure/i, /\brecover/i, /\bscreened\b/i, /\breached\b/i, /\btrained\b/i, /\breceived\b/i, /\benrolled\b/i, /\badmitted\b|\badmissions\b/i, /\bfunctional\b/i,
  /\bcoverage\b/i, /\battendance\b/i, /\baccess/i, /\bheld\b/i, /\bdistributed\b|\bdistribution\b/i, /\bsupported\b/i, /\bsubmitted\b/i, /\bcounselled\b/i,
  /\bdischarged\b/i, /\bconsumed\b/i, /\bestablished\b/i, /\bcompleted\b/i, /\bprovided\b/i, /\bvisits?\b/i, /\bsessions?\b/i,
];

const NUMERIC = /^\s*[-+]?\d[\d,]*(\.\d+)?\s*$/;

export function suggestIndicatorSetup(input: IndicatorDefaultsInput): IndicatorSuggestion {
  const title = input.title ?? "";
  const percentLike = /%|percent|\brate\b|\bproportion\b|\bshare of\b/i.test(`${input.unit ?? ""} ${title}`);
  let type: IndicatorSuggestion["type"] = null;
  if (!input.type) {
    if (percentLike) type = { value: "PERCENTAGE", reason: "The unit or the name says it is a rate or a percentage." };
    else if (input.target && NUMERIC.test(input.target)) type = { value: "NUMBER", reason: "The target is a plain number, so it counts things." };
  }
  let direction: IndicatorSuggestion["direction"] = null;
  const lower = LOWER_WORDS.find((w) => w.test(title));
  if (lower) direction = { value: "LOWER", reason: "A smaller figure is better for this kind of indicator (deaths, defaulting, stock-outs and similar)." };
  else if (HIGHER_WORDS.some((w) => w.test(title))) direction = { value: "HIGHER", reason: "It counts work done or people reached, so a larger figure is better." };
  return { type, direction };
}
