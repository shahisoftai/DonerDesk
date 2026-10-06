import { indicatorLabelRanges } from "./numeric-atom.js";

/**
 * Cross-section contradiction lint.
 *
 * The per-section verifier binds each prose number to its own indicator
 * finding. That loop cannot see report-level inconsistencies: a figure that
 * matches no verified record at all, a percentage whose denominator never
 * existed, the same quantity quoted with different values in different
 * sections, dates that fall outside the reporting period, or gender-
 * disaggregated figures quoted while the verified data carries no
 * disaggregation. The EERP-2026-Q2 approval showed all five classes reaching
 * a donor because each sentence was individually "resolvable with a note".
 *
 * This lint is deliberately CONTENT-derived, not claim-derived: its findings
 * are recomputed from the current section text on every evaluation and are
 * never persisted as claims. Consequence: they cannot be closed with an
 * ACCEPTED_WITH_LIMITATION note — only by correcting the text. BLOCKER
 * findings map onto the NUMERIC_CONTRADICTION gate kind (approval: BLOCK).
 *
 * Pure domain: no infrastructure, application, or LLM dependency. Precision
 * over recall: every rule prefers staying silent to raising a false positive
 * on legitimate phrasing (deltas, table rows, quoted testimony, provenance
 * lines, dates, indicator codes, years, and numbers <= 4 are all exempt).
 */

export type ContradictionKind =
  | "PROSE_VALUE_NOT_IN_VERIFIED_DATA"
  | "PERCENTAGE_WITHOUT_BASIS"
  | "SAME_METRIC_DIVERGENCE"
  | "OUT_OF_PERIOD_DATE"
  | "DISAGGREGATION_CONTRADICTION";

export const CONTRADICTION_KINDS: ContradictionKind[] = [
  "PROSE_VALUE_NOT_IN_VERIFIED_DATA",
  "PERCENTAGE_WITHOUT_BASIS",
  "SAME_METRIC_DIVERGENCE",
  "OUT_OF_PERIOD_DATE",
  "DISAGGREGATION_CONTRADICTION",
];

export type ContradictionSeverity = "BLOCKER" | "WARNING";

export interface ContradictionLintFinding {
  kind: ContradictionKind;
  severity: ContradictionSeverity;
  sectionId: string;
  sectionTitle: string;
  /** Trimmed sentence (or short span) the finding came from. */
  excerpt: string;
  /** Human-language explanation with the fix; shown directly to reviewers. */
  detail: string;
}

export interface ContradictionLintSection {
  id: string;
  title: string;
  content: string;
}

/** Minimal structural view of a verified finding (no domain type import). */
export interface ContradictionLintFindingData {
  indicatorCode: string;
  value: string;
  unit?: string;
  baseline?: string;
  target?: string;
  comparisonValue?: string;
  qualityFlags: readonly string[];
  /** Life-of-project and cumulative figures, and every recorded breakdown value (period and life-of-project). */
  cumulativeValue?: string;
  priorCumulativeValue?: string;
  lifeValue?: string;
  breakdownValues?: readonly string[];
}

/** The lint's view of a verified finding, from the finding itself. */
export function toLintFindingData(f: {
  indicatorCode: string;
  value: string;
  unit?: string;
  baseline?: string;
  target?: string;
  comparisonValue?: string;
  qualityFlags: readonly string[];
  cumulativeValue?: string;
  priorCumulativeValue?: string;
  lifeOfProject?: { value: string; disaggregation?: ReadonlyArray<{ value: string }> } | null;
  disaggregation?: ReadonlyArray<{ value: string }>;
}): ContradictionLintFindingData {
  return {
    indicatorCode: f.indicatorCode,
    value: f.value,
    unit: f.unit,
    baseline: f.baseline,
    target: f.target,
    comparisonValue: f.comparisonValue,
    qualityFlags: f.qualityFlags,
    cumulativeValue: f.cumulativeValue,
    priorCumulativeValue: f.priorCumulativeValue,
    lifeValue: f.lifeOfProject?.value,
    breakdownValues: [...(f.disaggregation ?? []), ...(f.lifeOfProject?.disaggregation ?? [])].map((e) => e.value),
  };
}

/** Verbatim recorded update strings per indicator (period/cumulative/comments). */
export interface ContradictionLintRecordedValues {
  indicatorCode: string;
  texts: readonly string[];
}

/** Activity-level context (participants, titles) that is legitimate to cite. */
export interface ContradictionLintActivityContext {
  title: string;
  date?: string;
  participantNumbers?: readonly number[];
}

export interface ContradictionLintInput {
  sections: readonly ContradictionLintSection[];
  findings?: readonly ContradictionLintFindingData[];
  recordedValues?: readonly ContradictionLintRecordedValues[];
  activities?: readonly ContradictionLintActivityContext[];
  /**
   * Figures the project's own records state (activity participant counts, record and evidence counts, the project
   * budget, verified finance, life-of-project totals): each is a real figure a report may quote, plain or as a percent.
   */
  groundedFigures?: readonly string[];
  /** ISO dates bounding the reporting period; enables the date-window check. */
  periodStart?: string;
  periodEnd?: string;
}

export interface ContradictionLintResult {
  findings: ContradictionLintFinding[];
  blockers: number;
  warnings: number;
}

// ---------------------------------------------------------------------------
// Text plumbing
// ---------------------------------------------------------------------------

interface ProseSentence {
  text: string;
  sectionId: string;
  sectionTitle: string;
  /** Blockquote content — attributed speech, exempt from value checks. */
  quoted: boolean;
}

const TABLE_ROW_RE = /^\s*\|/;
const HEADING_RE = /^\s*#{1,6}\s+/;
const BLOCKQUOTE_RE = /^\s*>\s?/;
const PROVENANCE_RE = /^\s*(source|sources|data source|provenance|reference|references|evidence|notes recorded by)\s*:/i;
const BULLET_LABEL_RE = /^\s*[-*•]\s*(evidence|annex|reference)\s*:/i;
const CITATION_MARKER_RE = /\[(needs verification|needs source verification|insert|citation)[^\]]*\]/i;
const DELTA_CONTEXT_RE =
  /\b(increase[ds]?|decrease[ds]?|grew|rose|fell|dropped|up from|down from|compared|previous period|prior period|respectively|against (a|the) (target|baseline)|baseline|target of)\b/i;
const GENDER_NEAR_NUMBER_RE =
  /\b\d[\d,]*(?:\.\d+)?\s*%?\s*\w{0,12}\s+(girls?|boys?|women|men|females?|males?)\b|\b(girls?|boys?|women|men|females?|males?)\s*\(?\s*\d[\d,]*/i;
const MONTH_NAMES = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
const DATE_PATTERNS: RegExp[] = [
  new RegExp(`\\b(?:${MONTH_NAMES})[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, "gi"),
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_NAMES})[a-z]*\\.?,?\\s+\\d{4}\\b`, "gi"),
  /\b\d{4}-\d{2}-\d{2}\b/g,
  // A day without a year ("as of August 31", "by 31 August") is still a date, not a figure.
  new RegExp(`\\b(?:${MONTH_NAMES})[a-z]*\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, "gi"),
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTH_NAMES})[a-z]*\\b`, "gi"),
];

/**
 * A figure quoted for the life of the project ("to date", "since the start", "in total") is a different quantity
 * from the same metric quoted for the month: they are compared only with figures of their own basis.
 */
const LIFE_BASIS_RE =
  /\b(to date|cumulative(?:ly)?|since (?:the )?(?:start|beginning|inception|launch|project)|over the (?:life|course|duration) of the project|life of (?:the )?project|life-of-project|overall|in total|altogether|across the project|throughout the project|by the end of the project|project-wide|so far)\b/i;
// Words that name a category, not a metric: "35 female" (caregivers) and "656 female" (enrolment) are different metrics.
const GENERIC_METRIC_NOUNS = new Set(["female", "males", "male", "females", "women", "woman", "men", "man", "girls", "girl", "boys", "boy", "target", "targets", "baseline", "total", "percent", "usd", "female male"]);
const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g;
const STOPWORDS = new Set([
  "of", "the", "a", "an", "to", "in", "on", "and", "with", "for", "from",
  "were", "was", "is", "are", "have", "has", "had", "by", "at", "as", "be",
  "been", "their", "its", "our", "this", "that", "these", "those", "per",
]);

function parseDecimalSafe(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function normalizeKey(n: number): string {
  return String(round1(n));
}

/** Noun phrase following a number (up to 3 non-stopwords), for divergence keys. */
function followingNounPhrase(sentence: string, endIndex: number): string {
  const tail = sentence.slice(endIndex).toLowerCase();
  const words = tail.match(/[a-z][a-z-]*/g) ?? [];
  const picked: string[] = [];
  for (const w of words) {
    if (STOPWORDS.has(w)) {
      if (picked.length > 0) break;
      continue;
    }
    picked.push(w);
    if (picked.length >= 3) break;
  }
  return picked.join(" ");
}

function matchDates(text: string): string[] {
  const out: string[] = [];
  for (const re of DATE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.push(m[0]);
  }
  return out;
}

/** Spans occupied by dates and indicator codes — numbers inside are exempt. */
function exemptRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = dateRanges(text);
  // Inline indicator-code labels (OUT-5, IND-H-003): the shared
  // `indicatorLabelRanges` helper only anchors codes at sentence start, so
  // mid-sentence references need their own conservative span mask.
  const codeRe = /\b[A-Z]{2,}[A-Z0-9]*(?:-[A-Z0-9]+)+\b/g;
  let cm: RegExpExecArray | null;
  while ((cm = codeRe.exec(text)) !== null) {
    if (/[0-9]/.test(cm[0])) ranges.push([cm.index, cm.index + cm[0].length]);
  }
  // Ages are descriptions, not achievements: "children aged 6-14", "6 to 14 years", "ages 5-17", "10 years old".
  const ageRe = /\b(?:aged?|ages|between the ages of)\s+\d{1,2}(?:\s*(?:-|–|to|and)\s*\d{1,2})?\b|\b\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s*(?:years?|yrs?)(?:\s*old)?\b|\b\d{1,2}\s*(?:years?|yrs?)\s*old\b/gi;
  let am: RegExpExecArray | null;
  while ((am = ageRe.exec(text)) !== null) ranges.push([am.index, am.index + am[0].length]);
  // Award and agreement numbers ("72061526CA00012", "AID-OAA-A-17-00012" is covered above) mix capitals and digits without a hyphen.
  const awardRe = /\b(?=[A-Z0-9]*[0-9])(?=[A-Z0-9]*[A-Z])[A-Z0-9]{8,}\b/g;
  let wm: RegExpExecArray | null;
  while ((wm = awardRe.exec(text)) !== null) ranges.push([wm.index, wm.index + wm[0].length]);
  // Identifiers cited in prose (evidence ids) carry digits that are not figures.
  const idRe = /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b|\b[0-9a-f]{8}\b(?=[^0-9a-f]|$)/gi;
  let im: RegExpExecArray | null;
  while ((im = idRe.exec(text)) !== null) {
    if (/[0-9]/.test(im[0]) && /[a-f]/i.test(im[0])) ranges.push([im.index, im.index + im[0].length]);
  }
  try {
    for (const [start, end] of indicatorLabelRanges(text)) ranges.push([start, end]);
  } catch {
    // Defensive: label ranges are best-effort; the lint must never throw.
  }
  return ranges;
}

function dateRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const d of matchDates(text)) {
    const idx = text.indexOf(d);
    if (idx >= 0) ranges.push([idx, idx + d.length]);
  }
  return ranges;
}

interface ProseNumber {
  raw: string;
  value: number;
  /** Number written as a percentage ("87%"). */
  isPercent: boolean;
  isYear: boolean;
  start: number;
  end: number;
}

function extractProseNumbers(text: string): ProseNumber[] {
  const out: ProseNumber[] = [];
  NUMBER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMBER_RE.exec(text)) !== null) {
    // "August 31, 2026" must not yield the figure "31,": a trailing comma is punctuation, not part of the number.
    const raw = m[0].replace(/,+$/, "");
    const value = parseDecimalSafe(raw);
    if (value === null) continue;
    const start = m.index;
    const end = m.index + raw.length;
    const after = text.slice(end, end + 12);
    const isPercent = /^\s*%/.test(after);
    const isYear = !isPercent && Number.isInteger(value) && value >= 1900 && value <= 2100;
    out.push({ raw, value, isPercent, isYear, start, end });
  }
  return out;
}

function splitProseSentences(content: string): string[] {
  return content
    .split(/\n{2,}|\.\s+(?=[A-Z0-9"'])|(?<=[.!?])\s*\n/)
    .map((s) => s.replace(/\s*\n\s*/g, " ").trim())
    .filter((s) => s.length >= 3);
}

// ---------------------------------------------------------------------------
// Accepted-number model
// ---------------------------------------------------------------------------

class AcceptedNumbers {
  private readonly plain = new Set<string>();
  private readonly percent = new Set<string>();

  addNumber(n: number): void {
    if (!Number.isFinite(n)) return;
    this.plain.add(normalizeKey(n));
  }

  addText(text: string | undefined): void {
    if (!text) return;
    for (const p of extractProseNumbers(text)) {
      if (p.isPercent) this.percent.add(normalizeKey(p.value));
      else this.addNumber(p.value);
    }
  }

  /** Percentage derivable from value/target (rounded, floored, and 1dp). */
  addRatio(value: number | null, target: number | null): void {
    if (value === null || target === null || target === 0) return;
    const pct = (value / target) * 100;
    this.percent.add(normalizeKey(Math.round(pct)));
    this.percent.add(normalizeKey(Math.floor(pct)));
    this.percent.add(normalizeKey(round1(pct)));
  }

  /** A figure from the records: legitimate plain, and as a percentage (a burn rate of 97 is "97%"). */
  addFigure(text: string): void {
    const n = parseDecimalSafe(text);
    if (n === null) return;
    this.addNumber(n);
    this.percent.add(normalizeKey(n));
  }

  hasPlain(n: number): boolean {
    return this.plain.has(normalizeKey(n));
  }

  hasPercent(n: number): boolean {
    return this.percent.has(normalizeKey(n));
  }
}

// ---------------------------------------------------------------------------
// Lint
// ---------------------------------------------------------------------------

export function lintReportContradictions(input: ContradictionLintInput): ContradictionLintResult {
  const findings: ContradictionLintFinding[] = [];
  const findingsData = input.findings ?? [];

  const accepted = new AcceptedNumbers();
  for (const f of findingsData) {
    accepted.addText(f.value);
    accepted.addText(f.baseline);
    accepted.addText(f.target);
    accepted.addText(f.comparisonValue);
    accepted.addRatio(parseDecimalSafe(f.value ?? ""), parseDecimalSafe(f.target ?? ""));
    for (const extra of [f.cumulativeValue, f.priorCumulativeValue, f.lifeValue, ...(f.breakdownValues ?? [])]) accepted.addText(extra);
    // Progress against the project target: cumulative to date, and the life-of-project total.
    accepted.addRatio(parseDecimalSafe(f.cumulativeValue ?? ""), parseDecimalSafe(f.target ?? ""));
    accepted.addRatio(parseDecimalSafe(f.lifeValue ?? ""), parseDecimalSafe(f.target ?? ""));
  }
  for (const figure of input.groundedFigures ?? []) accepted.addFigure(figure);
  for (const r of input.recordedValues ?? []) {
    for (const t of r.texts) accepted.addText(t);
  }
  for (const a of input.activities ?? []) {
    for (const n of a.participantNumbers ?? []) accepted.addNumber(n);
  }

  const sentences: ProseSentence[] = [];
  for (const section of input.sections) {
    for (const rawLine of section.content.split(/\n/)) {
      const line = rawLine.trim();
      if (!line || TABLE_ROW_RE.test(line) || HEADING_RE.test(line)) continue;
      const quoted = BLOCKQUOTE_RE.test(line);
      const stripped = line.replace(/^[>*\-•]\s*/, "");
      for (const sentence of splitProseSentences(stripped)) {
        sentences.push({ text: sentence, sectionId: section.id, sectionTitle: section.title, quoted });
      }
    }
  }

  const periodStart = parseDateSafe(input.periodStart);
  const periodEnd = parseDateSafe(input.periodEnd);
  const noDisaggregationAnywhere =
    findingsData.length > 0 && findingsData.every((f) => f.qualityFlags.includes("MISSING_DISAGGREGATION"));

  /** Divergence model: normalized noun phrase -> distinct values -> sections. */
  const metricValues = new Map<string, Map<string, { value: number; section: string; excerpt: string }>>();

  for (const sentence of sentences) {
    const text = sentence.text;
    if (!sentence.quoted) {
      if (PROVENANCE_RE.test(text) || BULLET_LABEL_RE.test(text) || CITATION_MARKER_RE.test(text)) continue;
    }
    const ranges = exemptRanges(text);
    const numbers = extractProseNumbers(text).filter((p) => !inRanges(p.start, p.end, ranges));

    for (const p of numbers) {
      if (p.isYear) continue;
      if (p.value < 5 && !p.isPercent) continue;

      if (p.isPercent) {
        if (!accepted.hasPercent(p.value) && !accepted.hasPlain(p.value)) {
          findings.push({
            kind: "PERCENTAGE_WITHOUT_BASIS",
            severity: "BLOCKER",
            sectionId: sentence.sectionId,
            sectionTitle: sentence.sectionTitle,
            excerpt: clip(text),
            detail: `The section states "${p.raw}" but no verified indicator result or recorded data supports this percentage. A percentage of a target can only be quoted when the indicator's denominator and target are recorded; correct the figure or state the raw values instead.`,
          });
        }
        continue;
      }

      if (!sentence.quoted && !accepted.hasPlain(p.value)) {
        findings.push({
          kind: "PROSE_VALUE_NOT_IN_VERIFIED_DATA",
          severity: "BLOCKER",
          sectionId: sentence.sectionId,
          sectionTitle: sentence.sectionTitle,
          excerpt: clip(text),
          detail: `The section states "${p.raw}" but this figure does not appear in the verified indicator results, recorded indicator updates, or activity records for this period. A reviewer note cannot resolve this: correct the figure or remove the sentence.`,
        });
      }

      // Same-metric divergence model.
      if (!sentence.quoted && !DELTA_CONTEXT_RE.test(text) && p.value >= 5) {
        const basis = LIFE_BASIS_RE.test(text) ? "life of project" : "period";
        const noun = `${followingNounPhrase(text, p.end)}|${basis}`;
        const phrase = followingNounPhrase(text, p.end);
        const genericOnly = phrase.split(" ").every((w) => GENERIC_METRIC_NOUNS.has(w));
        if (phrase.length >= 3 && !genericOnly) {
          const bucket = metricValues.get(noun) ?? new Map<string, { value: number; section: string; excerpt: string }>();
          if (!bucket.has(normalizeKey(p.value))) {
            bucket.set(normalizeKey(p.value), { value: p.value, section: sentence.sectionTitle, excerpt: clip(text) });
          }
          metricValues.set(noun, bucket);
        }
      }
    }

    // Disaggregation contradiction.
    if (!sentence.quoted && noDisaggregationAnywhere && GENDER_NEAR_NUMBER_RE.test(text)) {
      findings.push({
        kind: "DISAGGREGATION_CONTRADICTION",
        severity: "BLOCKER",
        sectionId: sentence.sectionId,
        sectionTitle: sentence.sectionTitle,
        excerpt: clip(text),
        detail: "The section reports gender-disaggregated figures, but the verified indicator data for this period carries no disaggregation. Quote disaggregation only from records that actually contain it, or remove the breakdown.",
      });
    }
  }

  // Out-of-period dates across all prose (including bullet lists).
  if (periodStart !== null && periodEnd !== null) {
    for (const sentence of sentences) {
      if (sentence.quoted) continue;
      for (const d of matchDates(sentence.text)) {
        const parsed = parseDateWords(d);
        if (parsed === null) continue;
        if (parsed < periodStart || parsed > periodEnd) {
          findings.push({
            kind: "OUT_OF_PERIOD_DATE",
            severity: "WARNING",
            sectionId: sentence.sectionId,
            sectionTitle: sentence.sectionTitle,
            excerpt: clip(sentence.text),
            detail: `This content is dated ${d}, outside the reporting period. Move earlier-period records to a context note or verify the date.`,
          });
        }
      }
    }
  }

  for (const [key, bucket] of metricValues) {
    if (bucket.size < 2) continue;
    const [noun = "", basis = "period"] = key.split("|");
    const values = [...bucket.values()].sort((a, b) => a.value - b.value);
    const distinctSections = [...new Set(values.map((v) => v.section))];
    const severity: ContradictionSeverity = bucket.size >= 3 ? "BLOCKER" : "WARNING";
    findings.push({
      kind: "SAME_METRIC_DIVERGENCE",
      severity,
      sectionId: input.sections[0]?.id ?? "",
      sectionTitle: distinctSections.join(", "),
      excerpt: values.map((v) => `${formatNumber(v.value)} (${v.section})`).join(" vs "),
      detail: `The report uses different figures for "${noun}"${basis === "life of project" ? " (for the life of the project)" : ""}: ${values
        .map((v) => `${formatNumber(v.value)} in "${v.section}"`)
        .join("; ")}. Confirm which figure is correct and use it consistently across all sections.`,
    });
  }

  // De-duplicate identical (kind, excerpt) pairs, keeping the first.
  const seen = new Set<string>();
  const deduped = findings.filter((f) => {
    const key = `${f.kind}:${f.excerpt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  deduped.sort((a, b) => (a.sectionId === b.sectionId ? a.kind.localeCompare(b.kind) : a.sectionId.localeCompare(b.sectionId)));

  return {
    findings: deduped,
    blockers: deduped.filter((f) => f.severity === "BLOCKER").length,
    warnings: deduped.filter((f) => f.severity === "WARNING").length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clip(text: string, max = 160): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString("en-US") : String(round1(n));
}

function inRanges(start: number, end: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([s, e]) => start >= s && end <= e);
}

function parseDateSafe(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Parses "March 12, 2026" / "12 March 2026" / "2026-03-12" to epoch ms. */
function parseDateWords(text: string): number | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (iso) {
    const t = Date.parse(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return Number.isFinite(t) ? t : null;
  }
  const monthName = new RegExp(`(?:${MONTH_NAMES})[a-z]*`, "i").exec(text);
  if (!monthName) return null;
  const key = monthName[0].slice(0, 3).toLowerCase();
  const month = MONTH_INDEX[key];
  if (month === undefined) return null;
  const yearMatch = /\d{4}/.exec(text);
  const dayMatch = /\b(\d{1,2})(?:st|nd|rd|th)?\b/.exec(text.replace(/\d{4}/, ""));
  if (!yearMatch || !dayMatch || dayMatch[1] === undefined) return null;
  const t = Date.parse(`${yearMatch[0]}-${String(month + 1).padStart(2, "0")}-${dayMatch[1].padStart(2, "0")}T00:00:00Z`);
  return Number.isFinite(t) ? t : null;
}
