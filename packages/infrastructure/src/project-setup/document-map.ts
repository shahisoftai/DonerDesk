/**
 * The document map (Phase 37 §9): a document's text split into sections by its own headings, so blocks follow sections and
 * every block knows the headings it sits under. Pure text functions; no model. A heading is one of: a lettered or numbered
 * code with a title ("C.3. Goals and Objectives", "2.1 Background"), a labelled word ("Section 4", "Annex B"), a short
 * labelled line ("Goal:", "Objective 1:"), an all-capitals title, or a short title-like line alone between blank lines. A
 * line inside a table row (more than one filled cell) is never a heading, except "code<TAB>title".
 */
export interface MapSection {
  /** 1 = top level. */
  level: number;
  title: string;
  /** Ancestor titles joined with " > ", ending with this one. */
  path: string;
  /** First line (the heading itself) and one past the last line of the section's own text. */
  start: number;
  end: number;
}

export const PREAMBLE_TITLE = "Start of document";

const SMALL_WORDS = new Set(["a", "an", "and", "the", "of", "to", "in", "on", "for", "with", "by", "at", "from", "as", "or", "et", "de", "la", "le", "les", "des", "du", "en", "y", "el", "los", "las", "del", "para", "por"]);
const LETTER_CODE = /^([A-Z]{1,2}\d{0,2}(?:\.\d+)+|[A-Z]\.\d+|\d+(?:\.\d+){0,3})\.?$/;
const LABEL_WORD = /^(section|part|chapter|annex|appendix|attachment|schedule|objective|specific objective|outcome|output|result|activity|task|component|goal|impact|purpose)\b/i;
const SENTENCE_END = /[.?!;,]["')\]]?$/;

const wordsOf = (t: string): string[] => t.split(/\s+/).filter(Boolean);

function capitalisedShare(title: string): number {
  const words = wordsOf(title).filter((w) => /[A-Za-z]/.test(w) && !SMALL_WORDS.has(w.toLowerCase()));
  return words.length === 0 ? 0 : words.filter((w) => /^[A-Z0-9(\[]/.test(w)).length / words.length;
}

/** Mostly letters: a date ("Jul. 31, 2023") or an amount ("PKR. 6,020,543.60") in a table cell is never a title. */
function letterShare(t: string): number {
  const chars = t.replace(/\s/g, "");
  return chars.length === 0 ? 0 : (chars.match(/\p{L}/gu) ?? []).length / chars.length;
}

function shortTitle(t: string, maxWords: number): boolean {
  const n = wordsOf(t).length;
  return n >= 1 && n <= maxWords && t.length <= 110 && !SENTENCE_END.test(t) && /[A-Za-z]/.test(t) && /^[A-Z0-9(\[]/.test(t) && letterShare(t) >= 0.7;
}

/** The code of a heading ("C.3", "2.1") and how deep it is, or null. */
function codedLevel(code: string): number {
  const dots = code.replace(/\.$/, "").split(".").length;
  return /^[A-Z]/.test(code) ? Math.max(1, dots - 1) : dots;
}

export interface Heading { level: number; title: string }

/** `previousBlank`/`nextBlank` say whether the line stands alone; only then may a plain title-like line be a heading. */
export function detectHeading(raw: string, standsAlone: boolean): Heading | null {
  // "C. 4 Milestones" is "C.4 Milestones".
  const line = raw.replace(/\s+$/, "").replace(/^(\s*)([A-Z])\.\s+(\d)/, "$1$2.$3");
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 140) return null;
  if (/^#\s+\S/.test(trimmed)) return { level: 1, title: trimmed.replace(/^#\s+/, "") };
  // A Word table row ("1.1 Allocation Window | Standard"): only a numbered label in its first cell is a heading, named without its value.
  if (trimmed.includes(" | ")) {
    const first = trimmed.split(" | ")[0]!.trim();
    const coded = /^([A-Z]{1,2}\d{0,2}(?:\.\d+)+|[A-Z]\.\d+|\d+(?:\.\d+){0,3})\.?\s+(\S.*)$/.exec(first);
    return coded && shortTitle(coded[2]!, 16) ? { level: codedLevel(coded[1]!), title: `${coded[1]} ${coded[2]}` } : null;
  }
  const cells = trimmed.split("\t").map((c) => c.trim()).filter(Boolean);
  if (cells.length > 2) return null;
  if (cells.length === 2) {
    const code = LETTER_CODE.exec(cells[0]!);
    return code && shortTitle(cells[1]!, 16) ? { level: codedLevel(code[1]!), title: `${cells[0]!.replace(/\.$/, "")} ${cells[1]}` } : null;
  }
  const spaced = /^([A-Z]{1,2}\d{0,2}(?:\.\d+)+|[A-Z]\.\d+|\d+(?:\.\d+){0,3})\.?\s+(\S.*)$/.exec(trimmed);
  if (spaced && shortTitle(spaced[2]!, 16)) return { level: codedLevel(spaced[1]!), title: `${spaced[1]} ${spaced[2]}` };
  const hasColon = /:$/.test(trimmed);
  const bare = trimmed.replace(/:$/, "").trim();
  if (LABEL_WORD.test(bare) && wordsOf(bare).length <= 12 && !SENTENCE_END.test(bare) && (hasColon || standsAlone)) return { level: 3, title: trimmed };
  if (hasColon && wordsOf(bare).length <= 8 && /^[A-Z]/.test(bare) && !SENTENCE_END.test(bare) && standsAlone && letterShare(bare) >= 0.7) return { level: 3, title: trimmed };
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 4 && trimmed === trimmed.toUpperCase() && !SENTENCE_END.test(trimmed) && wordsOf(trimmed).length <= 14 && standsAlone) return { level: 1, title: trimmed };
  if (standsAlone && shortTitle(trimmed, 10) && wordsOf(trimmed).length >= 2 && capitalisedShare(trimmed) >= 0.6) return { level: 2, title: trimmed };
  return null;
}

/** The sections of a document's lines, in order; text before the first heading is the "Start of document" section. */
export function buildDocumentMap(lines: ReadonlyArray<string>): MapSection[] {
  const headings: Array<{ at: number; level: number; title: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const before = i === 0 || lines[i - 1]!.trim() === "";
    const after = i === lines.length - 1 || lines[i + 1]!.trim() === "";
    const h = detectHeading(lines[i]!, before && after);
    if (h) headings.push({ at: i, ...h });
  }
  const sections: MapSection[] = [];
  const stack: Array<{ level: number; title: string }> = [];
  const first = headings[0]?.at ?? lines.length;
  if (lines.slice(0, first).some((l) => l.trim())) sections.push({ level: 1, title: PREAMBLE_TITLE, path: PREAMBLE_TITLE, start: 0, end: first });
  headings.forEach((h, n) => {
    while (stack.length > 0 && stack[stack.length - 1]!.level >= h.level) stack.pop();
    stack.push({ level: h.level, title: h.title });
    sections.push({ level: h.level, title: h.title, path: stack.map((s) => s.title).join(" > "), start: h.at, end: headings[n + 1]?.at ?? lines.length });
  });
  return sections;
}
