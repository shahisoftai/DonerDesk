/**
 * Canonical form of report-section content.
 *
 * Sections are stored as a small markdown subset — exactly what the export
 * renderers (DOCX, PDF, donor template) and the report editor support:
 * paragraphs, `###`/`####` headings, `-`/`1.` lists, `>` quotes, GFM pipe
 * tables, `**bold**`, `*italic*`, `` `code` `` and `[label](url)`.
 *
 * `normalizeSectionMarkdown` is applied on every manual save so the stored
 * form stays inside that subset regardless of the client (raw HTML, images and
 * oversize headings are reduced to supported syntax), and so two texts that
 * differ only in line endings or blank-line runs compare equal. It is pure and
 * idempotent: normalize(normalize(x)) === normalize(x).
 */

export const SECTION_MARKDOWN_MAX_LENGTH = 100_000;

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;
const BR_TAG_RE = /<br\s*\/?>/gi;
const HTML_TAG_RE = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g;
const IMAGE_RE = /!\[([^\]\n]*)\]\([^)\n]*\)/g;
const INVISIBLE_RE = /[​﻿]/g;
const HEADING_RE = /^(#{1,6})(\s+)(.*)$/;

function normalizeLine(line: string): string {
  const heading = HEADING_RE.exec(line);
  if (heading) {
    // Inside a section only two heading levels exist: the section title is
    // the document's own heading, so `#`/`##` become `###` and `#####`+ `####`.
    const level = heading[1]!.length <= 3 ? 3 : 4;
    return `${"#".repeat(level)} ${heading[3]!.trim()}`;
  }
  return line.replace(/[ \t]+$/, "");
}

export function normalizeSectionMarkdown(content: string): string {
  const text = (content ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE_RE, "")
    .replace(HTML_COMMENT_RE, "")
    .replace(BR_TAG_RE, "\n")
    .replace(HTML_TAG_RE, "")
    .replace(IMAGE_RE, "$1");

  const lines = text.split("\n").map(normalizeLine);
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

/** True when two section texts are the same after normalisation. */
export function sectionMarkdownEquivalent(a: string, b: string): boolean {
  return normalizeSectionMarkdown(a) === normalizeSectionMarkdown(b);
}
