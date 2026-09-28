import type { DocumentBlock, TextStyle } from "@donordesk/application";

const MD_HEADING = /^(#{1,6})\s+(.+)$/;
const NUMBERED_HEADING = /^((?:\d+\.){0,3}\d+)\.?\s+(\S.*)$/;
const LABELED_HEADING = /^(?:section|part|chapter|annex|appendix|attachment)\s+[\dIVXA-Z]+[.:)\-–]?\s*\S/i;
const ROMAN_HEADING = /^[IVX]{1,5}[.)]\s+\S/;
const LETTER_HEADING = /^[A-H][.)]\s+[A-Z]/;
const BULLET = /^([ \t]*)[-*•▪◦·●○■□➢►]\s+(.+)$/;
const ORDERED_ITEM = /^([ \t]*)(?:\d+|[a-z]|[ivx]+)[.)]\s+(.+)$/;
const TERMINATED = /[.?!:;]["')\]]?$/;

export interface SourceLine {
  text: string;
  page?: number;
  style?: TextStyle;
}

function isAllCapsTitle(t: string): boolean {
  const letters = t.replace(/[^A-Za-z]/g, "");
  return letters.length >= 4 && t.length <= 90 && letters === letters.toUpperCase() && /[A-Z]{2}/.test(t) && !/[.!?]$/.test(t);
}

function looksLikeHeading(t: string): boolean {
  return t.length <= 120 && !TERMINATED.test(t.replace(/:$/, "")) && t.split(/\s+/).length <= 16;
}

/** A whole line wrapped in brackets is a form placeholder ("[ACTIVITY TITLE]", "[MM, DD, YYYY]"), never a heading. */
const BRACKET_ONLY = /^\[.*\]$/;
/** A document's own navigational scaffolding, not a section of its content. */
const STRUCTURAL_LABEL = /^(contents|table of contents|index)\s*\d*$/i;

/** Heading level for numbered/labelled lines, or undefined when not a heading. */
export function headingLevel(t: string): number | undefined {
  if (BRACKET_ONLY.test(t) || STRUCTURAL_LABEL.test(t)) return undefined;
  const md = MD_HEADING.exec(t);
  if (md) return md[1]!.length;
  const num = NUMBERED_HEADING.exec(t);
  // A table-of-contents dot-leader entry that lost its title (mammoth flattens
  // the leader dots away) leaves just a page number, e.g. "1.     6" — reject
  // any numbered "heading" whose remaining text has no letters at all.
  if (num && /[A-Za-z]/.test(num[2]!) && looksLikeHeading(num[2]!) && !/^\d+\s+(?:days?|words?|pages?|%)/i.test(t)) {
    return Math.min(4, num[1]!.split(".").length);
  }
  if ((LABELED_HEADING.test(t) || ROMAN_HEADING.test(t) || LETTER_HEADING.test(t)) && looksLikeHeading(t)) return 1;
  if (isAllCapsTitle(t)) return 1;
  return undefined;
}

function tableCells(t: string): string[] | undefined {
  if (/^\|.*\|$/.test(t)) {
    const cells = t.slice(1, -1).split("|").map((c) => c.trim());
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return [];
    return cells;
  }
  if ((t.match(/\t/g) ?? []).length >= 1 && t.split("\t").filter((c) => c.trim()).length >= 2) return t.split("\t").map((c) => c.trim());
  return undefined;
}

/**
 * Segments line-oriented text (PDF pages, TXT, Markdown) into blocks.
 * Wrapped lines are re-joined into paragraphs; numbered/capitalised/markdown
 * lines become headings with a level; bullets and tables are preserved.
 */
export function linesToBlocks(lines: readonly SourceLine[]): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let para: { text: string; page?: number; lastLineLength: number; style?: TextStyle } | undefined;
  let table: { rows: string[][]; page?: number } | undefined;
  const flushPara = () => {
    if (para?.text.trim()) blocks.push({ kind: "PARAGRAPH", text: para.text.trim(), ...(para.page ? { page: para.page } : {}), ...(para.style ? { style: para.style } : {}) });
    para = undefined;
  };
  const flushTable = () => {
    if (table && table.rows.length > 0) blocks.push({ kind: "TABLE", rows: table.rows, ...(table.page ? { page: table.page } : {}) });
    table = undefined;
  };
  for (const line of lines) {
    const raw = line.text.replace(/ /g, " ").replace(/\s+$/, "");
    const t = raw.trim();
    const page = line.page ? { page: line.page } : {};
    const style = line.style ? { style: line.style } : {};
    if (!t) {
      flushPara();
      flushTable();
      continue;
    }
    const cells = tableCells(t);
    if (cells) {
      flushPara();
      table ??= { rows: [], page: line.page };
      if (cells.length > 0) table.rows.push(cells);
      continue;
    }
    flushTable();
    const md = MD_HEADING.exec(t);
    if (md) {
      flushPara();
      blocks.push({ kind: "HEADING", level: md[1]!.length, text: md[2]!.trim(), ...page, ...style });
      continue;
    }
    const bullet = BULLET.exec(raw);
    if (bullet) {
      flushPara();
      blocks.push({ kind: "LIST_ITEM", text: bullet[2]!.trim(), ordered: false, depth: Math.floor(bullet[1]!.replace(/\t/g, "  ").length / 2), ...page });
      continue;
    }
    const level = headingLevel(t);
    if (level !== undefined) {
      flushPara();
      blocks.push({ kind: "HEADING", level, text: t.replace(/:$/, ""), ...page, ...style });
      continue;
    }
    const ordered = ORDERED_ITEM.exec(raw);
    if (ordered) {
      flushPara();
      blocks.push({ kind: "LIST_ITEM", text: ordered[2]!.trim(), ordered: true, depth: Math.floor(ordered[1]!.replace(/\t/g, "  ").length / 2), ...page });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (!para && last?.kind === "LIST_ITEM" && !TERMINATED.test(last.text) && /^[a-z(]/.test(t)) {
      last.text = `${last.text} ${t}`;
      continue;
    }
    if (para && !TERMINATED.test(para.text) && (para.lastLineLength >= 50 || /^[a-z(,;]/.test(t))) {
      para.text = `${para.text} ${t}`;
      para.lastLineLength = t.length;
    } else {
      flushPara();
      para = { text: t, page: line.page, lastLineLength: t.length, style: line.style };
    }
  }
  flushPara();
  flushTable();
  return blocks;
}

function blockText(b: DocumentBlock): string | undefined {
  return b.kind === "TABLE" ? undefined : b.text;
}

/**
 * A running header/footer baked into the document body (a page-break-repeated
 * heading/paragraph such as "[xx] Report: [name] P 2/16") always contains a
 * number that changes page to page and text that otherwise repeats verbatim.
 * Any block whose text, with its digits blanked out, is identical to at least
 * `minOccurrences` other blocks is boilerplate, not content, and is dropped.
 * Text with no digit at all is never touched, so a genuinely repeated heading
 * like "Introduction" is untouched — this only targets page/date markers.
 */
export function stripRepeatedBoilerplate(blocks: readonly DocumentBlock[], minOccurrences = 3): DocumentBlock[] {
  const keyOf = (text: string): string | undefined => {
    if (!/\d/.test(text)) return undefined;
    const key = text.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
    return key.length >= 6 ? key : undefined;
  };
  const counts = new Map<string, number>();
  for (const b of blocks) {
    const text = blockText(b);
    const key = text && keyOf(text);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return blocks.filter((b) => {
    const text = blockText(b);
    const key = text && keyOf(text);
    return !key || (counts.get(key) ?? 0) < minOccurrences;
  });
}
