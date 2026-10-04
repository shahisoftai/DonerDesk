/**
 * Deterministic number grounding — TS mirror of
 * `apps/workers/app/ai_reporter/grounding.py`.
 *
 * A grounded draft contains no number that is absent from its inputs, except a
 * finding's percent of target (0–2 decimals), the one derived figure the writer
 * contract allows. Codes ("OUT-1", "ev-1:0", "Q3") and list markers are not
 * numbers. Used by the API-side validator self-check and the golden-corpus
 * evaluator.
 */

const NUMBER_RE = /(?<![\w\-:/.])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?!\w)/g;
const ISO_DATE_RE = /(?<![\d-])(\d{4})-(\d{2})-(\d{2})(?![\d-])/g;
const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_ALT = Array.from(new Set([...MONTH_NAMES, ...MONTH_NAMES.map((m) => m.slice(0, 3)), "sept"]))
  .sort((a, b) => b.length - a.length)
  .join("|");
// "20 April 2028", "20th April", "April 20, 2028": grounded only as a whole, against an ISO date in the inputs.
const WRITTEN_DATE_RE = new RegExp(
  `\\b(?:(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?\\s+(${MONTH_ALT})\\.?(?:,?\\s+(\\d{4}))?|(${MONTH_ALT})\\.?\\s+(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?)\\b`,
  "gi",
);
const DATE_PREFIX = "date:";
const LIST_MARKER_RE = /^(\s*(?:#+\s*)?)\d+[.)](?=\s)/gm;

export function normaliseNumber(token: string): string {
  let s = token.replace(/,/g, "").trim();
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  s = s.replace(/^0+/, "") || "0";
  if (s.startsWith(".")) s = `0${s}`;
  return s;
}

function monthNumber(name: string): number {
  let n = name.toLowerCase().replace(/\.$/, "");
  if (n === "sept") n = "sep";
  const i = MONTH_NAMES.findIndex((full) => full === n || full.slice(0, 3) === n);
  return i + 1;
}

/** Blank out written dates ("20 April 2028") that match an ISO date in the inputs. */
function stripGroundedDates(text: string, allowed: ReadonlySet<string>): string {
  const dates = Array.from(allowed).filter((a) => a.startsWith(DATE_PREFIX)).map((a) => a.slice(DATE_PREFIX.length));
  if (dates.length === 0) return text;
  return text.replace(WRITTEN_DATE_RE, (whole, d1, m1, y1, m2, d2, y2) => {
    const day = Number(d1 ?? d2);
    const month = monthNumber(String(m1 ?? m2));
    const year = (y1 ?? y2) as string | undefined;
    const ok = dates.some((iso) => {
      const [y, m, d] = iso.split("-");
      return Number(m) === month && Number(d) === day && (!year || y === year);
    });
    return ok ? " " : whole;
  });
}

export function extractNumbers(text: string): string[] {
  if (!text) return [];
  const cleaned = text.replace(LIST_MARKER_RE, "$1");
  return Array.from(cleaned.matchAll(NUMBER_RE), (m) => m[1]!);
}

function toFloat(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function roundedVariants(value: number): string[] {
  return [0, 1, 2].map((d) => normaliseNumber(value.toFixed(d)));
}

export function percentOfTarget(value: unknown, target: unknown): number | null {
  const v = toFloat(value);
  const t = toFloat(target);
  if (v === null || t === null || t === 0) return null;
  return (v / t) * 100;
}

function walk(value: unknown, out: string[]): void {
  if (value === null || value === undefined || typeof value === "boolean") return;
  if (Array.isArray(value)) {
    for (const v of value) walk(v, out);
  } else if (value instanceof Date) {
    out.push(value.toISOString().slice(0, 10));
  } else if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) walk(v, out);
  } else {
    out.push(String(value));
  }
}

export interface GroundingFinding {
  value?: unknown;
  baseline?: unknown;
  target?: unknown;
  comparisonValue?: unknown;
  qualityFlags?: ReadonlyArray<string>;
  valueStatus?: string;
  /** Progress since the project started (semi-annual, annual, final). */
  lifeOfProject?: { value: string } | null;
}

/**
 * Every number a grounded draft may contain, normalised. `sources` is any
 * structured input (findings, activities, evidence, context …) — every string
 * and number inside it is scanned.
 */
export function allowedNumbers(sources: unknown, findings: ReadonlyArray<GroundingFinding> = []): Set<string> {
  const texts: string[] = [];
  walk(sources, texts);
  const allowed = new Set<string>();
  for (const t of texts) {
    for (const n of extractNumbers(t)) allowed.add(normaliseNumber(n));
    for (const m of t.matchAll(ISO_DATE_RE)) allowed.add(`${DATE_PREFIX}${m[1]}-${m[2]}-${m[3]}`);
  }
  for (const f of findings) {
    for (const raw of [f.value, f.baseline, f.target, f.comparisonValue]) {
      const n = toFloat(raw);
      if (n !== null) for (const v of roundedVariants(n)) allowed.add(v);
    }
    const notCalculable = f.valueStatus === "NOT_CALCULABLE" || (f.qualityFlags ?? []).includes("MISSING_DENOMINATOR");
    if (!notCalculable) {
      const pct = percentOfTarget(f.value, f.target);
      if (pct !== null) for (const v of roundedVariants(pct)) allowed.add(v);
    }
    if (f.lifeOfProject) {
      const cumulative = toFloat(f.lifeOfProject.value);
      if (cumulative !== null) for (const v of roundedVariants(cumulative)) allowed.add(v);
      const lifePct = percentOfTarget(f.lifeOfProject.value, f.target);
      if (lifePct !== null) for (const v of roundedVariants(lifePct)) allowed.add(v);
    }
  }
  return allowed;
}

/** Numbers in `text` (raw spelling, de-duplicated, in order) absent from `allowed`. */
export function ungroundedNumbers(text: string, allowed: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of extractNumbers(stripGroundedDates(text, allowed))) {
    const norm = normaliseNumber(raw);
    if (allowed.has(norm) || seen.has(norm)) continue;
    seen.add(norm);
    out.push(raw);
  }
  return out;
}
