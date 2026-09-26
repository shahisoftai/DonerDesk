import mammoth from "mammoth";
import type { IDonorTemplateStructureParser } from "@donordesk/application";
import type { TemplateRegion } from "@donordesk/domain";

/**
 * Structural DOCX parser for donor-template region detection (docxtpl
 * rendering feature, 2026-09-17). `TolerantDocumentParser.parse()` only does
 * `mammoth.extractRawText()` — flat text, no headings/tables — which is
 * fine for search-indexing an evidence file but useless for detecting where
 * a donor template's sections actually are. This uses `mammoth.convertToHtml`
 * with an explicit Word-heading style map instead, then walks the resulting
 * HTML in document order to emit `HEADING`/`TABLE` regions.
 *
 * Deliberately does NOT attempt raw OOXML traversal — mammoth's HTML
 * conversion is already a proven, tolerant dependency in this codebase.
 * Region `id`s are positionally deterministic (`h-000N` / `t-000N`) so the
 * Python worker can relocate the same region later by walking the ORIGINAL
 * DOCX (via python-docx) in the same document order — this parser's HTML
 * view is only used for *detecting* regions, never for producing the final
 * rendered file.
 */

const STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='Title'] => h1:fresh",
];

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

/** Splits mammoth's HTML output into a flat sequence of top-level heading
 * and table blocks, in document order. Mammoth emits clean, non-nested
 * `<h1>`-`<h6>` and `<table>` tags at the top level, so a single regex scan
 * for these opening tags (paired with their matching close) is reliable
 * without a full DOM parser dependency. */
function walkBlocks(html: string): TemplateRegion[] {
  const regions: TemplateRegion[] = [];
  const blockRe = /<(h[1-6]|table)\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  let headingOrder = 0;
  let tableOrder = 0;
  let order = 0;

  while ((match = blockRe.exec(html)) !== null) {
    const tag = match[1]!.toLowerCase();
    const openEnd = match.index + match[0].length;
    const closeTag = `</${tag}>`;
    const closeIdx = html.indexOf(closeTag, openEnd);
    if (closeIdx === -1) continue;
    const inner = html.slice(openEnd, closeIdx);

    if (tag.startsWith("h")) {
      const level = Number(tag.slice(1));
      const text = stripTags(inner);
      if (text.length === 0) continue;
      regions.push({ id: `h-${String(headingOrder).padStart(4, "0")}`, kind: "HEADING", level, text, order: order++ });
      headingOrder++;
    } else {
      // First <tr> is treated as the header row for column matching.
      const rowMatch = /<tr\b[^>]*>([\s\S]*?)<\/tr>/i.exec(inner);
      const tableColumns: string[] = [];
      if (rowMatch) {
        const cellRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
        let cellMatch: RegExpExecArray | null;
        while ((cellMatch = cellRe.exec(rowMatch[1]!)) !== null) {
          const cellText = stripTags(cellMatch[1]!);
          if (cellText) tableColumns.push(cellText);
        }
      }
      regions.push({
        id: `t-${String(tableOrder).padStart(4, "0")}`,
        kind: "TABLE",
        text: tableColumns.join(" "),
        order: order++,
        tableColumns,
      });
      tableOrder++;
    }
  }
  return regions;
}

export class MammothDonorTemplateStructureParser implements IDonorTemplateStructureParser {
  async parseStructure(input: { buffer: Buffer; fileName: string }): Promise<{ regions: TemplateRegion[] }> {
    const result = await mammoth.convertToHtml({ buffer: input.buffer }, { styleMap: STYLE_MAP });
    return { regions: walkBlocks(result.value) };
  }
}
