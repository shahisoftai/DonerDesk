import { parseDecimal, type Decimal } from "./indicator-calculator.js";

/**
 * Semantic role of a numeric atom inside an assertion. A single sentence can
 * carry several numbers with different meanings (achievement vs target vs
 * baseline vs previous period); verification must bind each atom to the right
 * role instead of matching the first number in the sentence.
 */
export type NumericAtomRole =
  | "ACHIEVEMENT"
  | "TARGET"
  | "BASELINE"
  | "COMPARISON"
  | "PERCENT"
  | "CURRENCY"
  | "DATE"
  | "COUNT"
  | "DISAGGREGATION"
  | "OTHER";

export const NUMERIC_ATOM_ROLES: NumericAtomRole[] = [
  "ACHIEVEMENT",
  "TARGET",
  "BASELINE",
  "COMPARISON",
  "PERCENT",
  "CURRENCY",
  "DATE",
  "COUNT",
  "DISAGGREGATION",
  "OTHER",
];

/** Roles that are references/metadata, never a report-value achievement claim. */
export const NON_ACHIEVEMENT_ROLES: ReadonlySet<NumericAtomRole> = new Set<NumericAtomRole>([
  "TARGET",
  "BASELINE",
  "COMPARISON",
  "PERCENT",
  "CURRENCY",
  "DATE",
  "COUNT",
  "DISAGGREGATION",
]);

/**
 * True when at least one atom is an achievement-like magnitude (a report-value
 * claim). Sentences whose numbers are all dates / counts / targets / percentages
 * are metadata or references, NOT numeric achievement claims, and must not be
 * verified as such (which is what previously produced VALUE_MISMATCH noise on
 * dates, participant counts, summary counts, and table cells).
 */
export function hasAchievementNumber(atoms: NumericAtom[]): boolean {
  return atoms.some((a) => !NON_ACHIEVEMENT_ROLES.has(a.role));
}

/**
 * Returns the character ranges (relative to `text`) that belong to an indicator
 * label prefix `CODE (Indicator Name)` — including nested parentheticals — up to
 * (but not including) the value after the colon. Numbers embedded inside an
 * indicator name (e.g. "80%+ attendance" in "OUT-5 (Number of children
 * attending regularly (80%+ attendance)): 5600 …") are part of the label, not a
 * report-value assertion, and must never become numeric atoms. Shared by the
 * extractor AND the verifier so a masked label number can never be re-introduced
 * during verification.
 */
export function indicatorLabelRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const codeMatch = text.match(/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*/);
  // Only an indicator-like code (contains a digit, e.g. OUT-5, IND-H-003)
  // marks a following parenthetical as an indicator-name label. A bare word
  // ("The project …") must not trigger label masking.
  if (!codeMatch || codeMatch[0].length === 0 || !/[0-9]/.test(codeMatch[0])) return ranges;
  const codeEnd = codeMatch[0].length;
  ranges.push([0, codeEnd]);
  let i = codeEnd;
  while (i < text.length && /\s/.test(text.charAt(i))) i++;
  while (i < text.length && text.charAt(i) === "(") {
    const groupStart = i;
    let depth = 0;
    do {
      if (text.charAt(i) === "(") depth += 1;
      else if (text.charAt(i) === ")") depth -= 1;
      i += 1;
    } while (i < text.length && depth > 0);
    if (depth === 0) ranges.push([groupStart, i]);
    while (i < text.length && /\s/.test(text.charAt(i))) i++;
  }
  return ranges;
}

/**
 * A single numeric atom extracted from an assertion. `value` is the raw text
 * token (for currency/percent it excludes the symbol); the optional binding
 * fields are filled during verification so the same number cannot validate a
 * sentence about the wrong indicator, unit, period, or entity.
 */
export interface NumericAtom {
  /** Offset of the numeric token within the normalized assertion text. */
  charStart: number;
  charEnd: number;
  value: string;
  role: NumericAtomRole;
  unit?: string;
  currency?: string;
  isPercent?: boolean;
  indicatorId?: string;
  indicatorCode?: string;
  reportingPeriodId?: string;
  entity?: string;
  population?: string;
  /** True when this atom has been bound to a verified finding authority. */
  bound: boolean;
}

export interface NumericAtomInput {
  value: string;
  role?: NumericAtomRole;
  unit?: string;
  currency?: string;
  isPercent?: boolean;
  indicatorId?: string;
  indicatorCode?: string;
  reportingPeriodId?: string;
  entity?: string;
  population?: string;
}

export function createNumericAtom(input: NumericAtomInput, offset = 0): NumericAtom {
  const value = input.value.trim();
  const decimal = parseDecimal(value);
  if (decimal === null) throw new Error(`Invalid numeric atom value: ${input.value}`);
  return {
    charStart: offset,
    charEnd: offset + value.length,
    value,
    role: input.role ?? "OTHER",
    unit: input.unit,
    currency: input.currency,
    isPercent: input.isPercent,
    indicatorId: input.indicatorId,
    indicatorCode: input.indicatorCode,
    reportingPeriodId: input.reportingPeriodId,
    entity: input.entity,
    population: input.population,
    bound: false,
  };
}

export function atomDecimal(atom: NumericAtom): Decimal | null {
  return parseDecimal(atom.value);
}

export function atomsEqual(a: NumericAtom, b: NumericAtom): boolean {
  if (a.value !== b.value) return false;
  if (a.role !== b.role) return false;
  if ((a.unit ?? "") !== (b.unit ?? "")) return false;
  if ((a.currency ?? "") !== (b.currency ?? "")) return false;
  if (Boolean(a.isPercent) !== Boolean(b.isPercent)) return false;
  return true;
}

/**
 * Extracts every numeric token from normalized text with its character offset.
 * Uses the same strict decimal parser as the deterministic analyst so no
 * value can slip through with a different number grammar.
 *
 * Two parsing rules keep extraction aligned with normal professional writing:
 * - Thousands separators are normalized, so "3,251 children" is a single atom
 *   with value "3251" instead of two unrelated atoms ("3", "251").
 * - Digits embedded in alphanumeric or hyphenated tokens ("OUT-1", "OUT1",
 *   "Stage-2") are not extracted; a leading minus is only a sign at a token
 *   boundary, never part of an identifier.
 */
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function extractNumericAtoms(text: string): NumericAtom[] {
  const atoms: NumericAtom[] = [];
  // An identifier cited in prose ("evidence: 14141986-6483-...") is not a figure, even when its first group is all digits.
  const identifiers = [...text.matchAll(UUID_RE)].map((m) => [m.index ?? 0, (m.index ?? 0) + m[0].length] as const);
  const re = /-?\d+(?:[.,]\d+)*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (identifiers.some(([s, e]) => start >= s && end <= e)) continue;
    if (isEmbeddedNumber(text, start, end)) continue;
    const value = normalizeNumberToken(match[0]);
    if (value === null || parseDecimal(value) === null) continue;
    atoms.push({
      charStart: start,
      charEnd: end,
      value,
      role: "OTHER",
      bound: false,
    });
  }
  return atoms;
}

/**
 * True when a candidate numeric token is part of a word or identifier rather
 * than a standalone number: immediately adjacent to a word character, or
 * following a hyphen that is itself attached to a letter ("OUT-1").
 */
function isEmbeddedNumber(text: string, start: number, end: number): boolean {
  const before = text.charAt(start - 1);
  if (before === "-") {
    const beforeHyphen = text.charAt(start - 2);
    if (/[A-Za-z]/.test(beforeHyphen)) return true;
  }
  if (/[\w]/.test(before)) return true;
  const after = text.charAt(end);
  if (/[\w]/.test(after)) return true;
  return false;
}

/**
 * Removes commas only when they group exactly three digits toward the end of
 * the token ("3,251" -> "3251", "1,234,567.89" -> "1234567.89"). An ambiguous
 * token such as "12,5" is left untouched so the strict decimal parser rejects
 * it instead of silently misreading the number.
 */
function normalizeNumberToken(token: string): string | null {
  let current = token;
  let previous: string;
  do {
    previous = current;
    current = current.replace(/,(?=\d{3}(?:,\d{3})*(?:\.\d+)?$)/, "");
  } while (current !== previous);
  return current;
}

/**
 * Groups a raw token list with coarse roles inferred from surrounding text.
 * Deterministic heuristics only; the structured verifier later binds atoms to
 * findings. This helper is intentionally conservative: anything it cannot
 * classify stays OTHER.
 */
/**
 * The count nouns that signal a number is a COUNT (how many things), not an
 * achievement magnitude. e.g. "25 participant(s)", "12 evidence file(s)",
 * "10 activity record(s)", "20 indicator finding(s)".
 */
const COUNT_NOUN_RE = /(participant|file|record|finding|result|evidence|item|session|batch|checklist item|performed|could)s?\b/i;

const MONTH_NAMES = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
/** "10 May", "10th of May" — the day number of a calendar date. */
const DAY_BEFORE_MONTH_RE = new RegExp(`^(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTH_NAMES})\\b`, "i");
/** "May 10", "May 10-22" — the day number(s) of a calendar date. */
const DAY_AFTER_MONTH_RE = new RegExp(`(?:${MONTH_NAMES})\\.?\\s*$`, "i");
/** "6-month", "5 day", "12 weeks" — a duration, not an achievement magnitude. */
const DURATION_RE = /^[-\s]?(?:hour|day|week|month|year|quarter)s?\b/i;

/**
 * Marks atoms that are DATES, COUNTs, or trailing percentages — references and
 * metadata, never achievement claims. This is the root-cause guard that stops
 * legitimate content (dates, participant counts, summary counts, "80%+")
 * from being treated as report-value numbers and failing verification.
 */
export function classifyNumericAtomRoles(
  text: string,
  atoms: NumericAtom[],
): NumericAtom[] {
  const lower = text.toLowerCase();
  const hasTarget = /target|planned|goal|expected/i.test(lower);
  const hasBaseline = /baseline|initial|at (the )?start/i.test(lower);
  const hasPercent = /percent|%|rate/i.test(lower);
  const hasCurrency = /\b(usd|eur|gbp|kes|uzs|afn|npr|rwh|rwf|pkr)\b|\$|€|£/i.test(lower);
  const hasPrevious = /previous|prior|last (month|quarter|year|period)|compared to|vs\.?/i.test(lower);

  // Ranges of full dates like "2026-02-28" and standalone 4-digit years.
  const nonAchievementRanges: Array<[number, number]> = [];
  const dateSeqRe = /(?:19|20)\d{2}[-/.]\d{1,2}[-/.]\d{1,2}/g;
  let dateMatch: RegExpExecArray | null;
  while ((dateMatch = dateSeqRe.exec(text)) !== null) {
    nonAchievementRanges.push([dateMatch.index, dateMatch.index + dateMatch[0].length]);
  }
  const yearRe = /(?:19|20)\d{2}/g;
  let yearMatch: RegExpExecArray | null;
  while ((yearMatch = yearRe.exec(text)) !== null) {
    if (yearMatch.index >= 0) nonAchievementRanges.push([yearMatch.index, yearMatch.index + yearMatch[0].length]);
  }

  return atoms.map((atom, index) => {
    const copy: NumericAtom = { ...atom, role: "OTHER" as NumericAtomRole };

    // Trailing percent: "80%" in "80%+ attendance" — a rate, not a magnitude.
    if (text.charAt(atom.charEnd) === "%") {
      copy.role = "PERCENT";
      copy.isPercent = true;
    } else if (nonAchievementRanges.some(([s, e]) => atom.charStart >= s && atom.charStart < e)) {
      copy.role = "DATE";
    } else if (
      DAY_BEFORE_MONTH_RE.test(text.slice(atom.charEnd, atom.charEnd + 24)) ||
      DAY_AFTER_MONTH_RE.test(text.slice(Math.max(0, atom.charStart - 12), atom.charStart))
    ) {
      copy.role = "DATE";
    } else if (DURATION_RE.test(text.slice(atom.charEnd, atom.charEnd + 12))) {
      copy.role = "COUNT";
    } else if (COUNT_NOUN_RE.test(text.slice(atom.charEnd, atom.charEnd + 34))) {
      copy.role = "COUNT";
    } else if (/\b(batch|phase|step|stage|group|round|version|edition)\s*$/i.test(text.slice(0, atom.charStart))) {
      // Ordinal/identifier labels ("Batch 2", "Phase 1") — not magnitudes.
      copy.role = "COUNT";
    } else if (hasCurrency) {
      copy.role = "CURRENCY";
    } else if (hasPercent && index === atoms.length - 1 && /percent|rate/i.test(lower.slice(atom.charEnd - 8, atom.charEnd + 12))) {
      copy.role = "PERCENT";
      copy.isPercent = true;
    } else if (hasTarget && index === 1) {
      copy.role = "TARGET";
    } else if (hasBaseline && index === 2) {
      copy.role = "BASELINE";
    } else if (hasPrevious) {
      copy.role = "COMPARISON";
    }
    return copy;
  });
}
