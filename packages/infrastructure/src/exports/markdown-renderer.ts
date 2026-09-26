import { Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, TextRun, BorderStyle, AlignmentType } from "docx";
import type PDFKit from "pdfkit";

/**
 * Deterministic markdown renderer for report exports.
 *
 * Report sections carry markdown (headings, bullets, tables, emphasis) that
 * previously shipped as literal pipe-and-dash text: buildWord wrapped each
 * whole section in one plain Paragraph and buildPdf printed it raw. This
 * module parses the markdown block structure once and renders it natively
 * for DOCX (real heading styles, bullet lists, bordered tables) and PDF
 * (styled headings, hanging-indent bullets, ruled tables with page breaks).
 *
 * The parser is intentionally small and total: unknown lines degrade to
 * paragraphs, so an export can never fail because of unexpected markdown.
 */

export interface MdInlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export type MdBlock =
  | { type: "heading"; level: number; inline: MdInlineRun[] }
  | { type: "paragraph"; inline: MdInlineRun[] }
  | { type: "bullet"; level: number; ordered: boolean; marker: string; inline: MdInlineRun[] }
  | { type: "quote"; inline: MdInlineRun[] }
  | { type: "table"; header: string[]; rows: string[][] };

const BULLET_RE = /^(\s*)[-*•]\s+(.*)$/;
const ORDERED_RE = /^(\s*)(\d{1,2})[.)]\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;

/**
 * Parses inline emphasis: **bold**, *italic*, `code`, and [label](url)
 * links (rendered as "label (url)"). Unmatched markers stay literal.
 */
export function parseInline(text: string): MdInlineRun[] {
  const runs: MdInlineRun[] = [];
  let cursor = 0;
  const push = (t: string, extra?: Partial<MdInlineRun>) => {
    if (!t) return;
    const last = runs[runs.length - 1];
    if (last && !extra && !last.bold && !last.italic && !last.code) {
      last.text += t;
      return;
    }
    runs.push({ text: t, ...extra });
  };

  while (cursor < text.length) {
    const rest = text.slice(cursor);
    const bold = /^\*\*([^*\n]+)\*\*/.exec(rest);
    const italic = /^\*([^*\n]+)\*/.exec(rest);
    const code = /^`([^`\n]+)`/.exec(rest);
    const link = /^\[([^\]\n]+)\]\(([^)\n]+)\)/.exec(rest);
    if (bold) {
      push(bold[1] ?? "", { bold: true });
      cursor += bold[0].length;
    } else if (code) {
      push(code[1] ?? "", { code: true });
      cursor += code[0].length;
    } else if (italic) {
      push(italic[1] ?? "", { italic: true });
      cursor += italic[0].length;
    } else if (link) {
      push(`${link[1] ?? ""} (${link[2] ?? ""})`);
      cursor += link[0].length;
    } else {
      // Advance to the next marker candidate.
      const next = rest.slice(1).search(/\*`\[|\*[^*]|`|\[/);
      const step = next < 0 ? rest.length : next + 1;
      push(rest.slice(0, step));
      cursor += step;
    }
  }
  return runs.length > 0 ? runs : [{ text }];
}

/** Splits a raw markdown document into typed blocks. Never throws. */
export function parseMarkdownBlocks(content: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  const lines = (content ?? "").replace(/\r\n?/g, "\n").split("\n");

  let i = 0;
  const flushParagraph: string[] = [];
  const pushParagraph = () => {
    if (flushParagraph.length === 0) return;
    blocks.push({ type: "paragraph", inline: parseInline(flushParagraph.join(" ").trim()) });
    flushParagraph.length = 0;
  };

  const splitRow = (line: string): string[] =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const isTableSeparator = (line: string): boolean =>
    /^\s*\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(line);

  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      pushParagraph();
      i += 1;
      continue;
    }

    const heading = HEADING_RE.exec(trimmed);
    if (heading) {
      pushParagraph();
      blocks.push({ type: "heading", level: (heading[1] ?? "#").length, inline: parseInline((heading[2] ?? "").trim()) });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("|")) {
      pushParagraph();
      const header = splitRow(line);
      const sep = isTableSeparator(lines[i + 1] ?? "");
      if (sep) i += 2;
      else i += 1;
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
        rows.push(splitRow(lines[i] ?? ""));
        i += 1;
      }
      if (header.length > 0) blocks.push({ type: "table", header, rows });
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      pushParagraph();
      const indent = bullet[1] ?? "";
      const level = Math.min(2, Math.floor(indent.replace(/\t/g, "  ").length / 2));
      blocks.push({ type: "bullet", level, ordered: false, marker: "", inline: parseInline((bullet[2] ?? "").trim()) });
      i += 1;
      continue;
    }

    const ordered = ORDERED_RE.exec(line);
    if (ordered) {
      pushParagraph();
      const indent = ordered[1] ?? "";
      const level = Math.min(2, Math.floor(indent.replace(/\t/g, "  ").length / 2));
      blocks.push({ type: "bullet", level, ordered: true, marker: `${ordered[2] ?? "1"}.`, inline: parseInline((ordered[3] ?? "").trim()) });
      i += 1;
      continue;
    }

    if (BLOCKQUOTE_START.test(trimmed)) {
      pushParagraph();
      blocks.push({ type: "quote", inline: parseInline(trimmed.replace(/^>\s?/, "")) });
      i += 1;
      continue;
    }

    flushParagraph.push(trimmed);
    i += 1;
  }
  pushParagraph();
  return blocks;
}

const BLOCKQUOTE_START = /^>\s?/;

// ---------------------------------------------------------------------------
// DOCX rendering
// ---------------------------------------------------------------------------

const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
};

function headingLevelFor(level: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  // Content headings sit below the section title (HEADING_2): level 1 -> 3.
  if (level <= 1) return HeadingLevel.HEADING_3;
  if (level === 2) return HeadingLevel.HEADING_4;
  if (level === 3) return HeadingLevel.HEADING_5;
  return HeadingLevel.HEADING_6;
}

function docxRuns(inline: MdInlineRun[]): TextRun[] {
  return inline.map((r) =>
    new TextRun({
      text: r.text,
      bold: r.bold,
      italics: r.italic,
      font: r.code ? "Courier New" : undefined,
    }),
  );
}

function docxTable(header: string[], rows: string[][]): Table {
  const cell = (text: string, bold: boolean) =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h) => cell(h, true)) }),
      ...rows.map((r) => new TableRow({ children: header.map((_, c) => cell(r[c] ?? "", false)) })),
    ],
  });
}

/** Renders parsed markdown blocks to DOCX paragraphs/tables. */
export function renderDocxBlocks(blocks: MdBlock[]): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        out.push(new Paragraph({ heading: headingLevelFor(block.level), children: docxRuns(block.inline) }));
        break;
      case "paragraph":
        out.push(new Paragraph({ children: docxRuns(block.inline) }));
        break;
      case "bullet":
        out.push(
          block.ordered
            ? new Paragraph({
                indent: { left: 720 + block.level * 360, hanging: 260 },
                children: docxRuns([{ text: `${block.marker} `, bold: false }, ...block.inline]),
              })
            : new Paragraph({
                bullet: { level: block.level },
                children: docxRuns(block.inline),
              }),
        );
        break;
      case "quote":
        out.push(
          new Paragraph({
            indent: { left: 480, right: 240 },
            spacing: { before: 80, after: 80 },
            children: docxRuns(block.inline.map((r) => ({ ...r, italic: r.italic ?? true }))),
          }),
        );
        break;
      case "table":
        out.push(docxTable(block.header, block.rows));
        out.push(new Paragraph({ children: [] }));
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// PDF rendering
// ---------------------------------------------------------------------------

interface PdfGeometry {
  left: number;
  right: number;
  bottom: number;
}

function pdfWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function pdfInline(doc: PDFKit.PDFDocument, inline: MdInlineRun[], size: number, continued: boolean): void {
  for (const run of inline) {
    const font = run.bold ? "Helvetica-Bold" : run.italic ? "Helvetica-Oblique" : "Helvetica";
    const isLast = run === inline[inline.length - 1];
    doc.font(font).fontSize(size).text(run.text, {
      continued: continued && !isLast,
      lineGap: 2,
    });
  }
  if (inline.length === 0) {
    doc.font("Helvetica").fontSize(size).text("", { continued });
  }
  doc.font("Helvetica");
}

function pdfBullet(doc: PDFKit.PDFDocument, block: Extract<MdBlock, { type: "bullet" }>, geo: PdfGeometry): void {
  const baseX = doc.page.margins.left;
  const indent = 14 + block.level * 16;
  doc.x = baseX + indent;
  const marker = block.ordered ? `${block.marker} ` : "\u2022 ";
  const inline = block.inline;
  const first = inline[0];
  if (first) {
    const rest = inline.slice(1);
    const font = first.bold ? "Helvetica-Bold" : first.italic ? "Helvetica-Oblique" : "Helvetica";
    doc.font(font).fontSize(10.5).text(marker + first.text, { continued: rest.length > 0, lineGap: 2 });
    if (rest.length > 0) {
      pdfInline(doc, rest, 10.5, false);
    }
  } else {
    doc.font("Helvetica").fontSize(10.5).text(marker, { lineGap: 2 });
  }
  doc.x = baseX;
  doc.moveDown(0.15);
  void geo;
}

function pdfTable(doc: PDFKit.PDFDocument, header: string[], rows: string[][], geo: PdfGeometry): void {
  const size = 8.5;
  const padding = 4;
  const available = pdfWidth(doc);

  doc.font("Helvetica").fontSize(size);
  const natural = header.map((h, c) => {
    const cells = [h, ...rows.map((r) => r[c] ?? "")];
    return Math.max(...cells.map((t) => doc.widthOfString(t))) + padding * 2;
  });
  const totalNatural = natural.reduce((a, b) => a + b, 0);
  const widths =
    totalNatural > 0 ? natural.map((w) => Math.max(36, (w / totalNatural) * available)) : header.map(() => available / header.length);
  const widthTotal = widths.reduce((a, b) => a + b, 0);
  const scale = available / widthTotal;
  const colWidths = widths.map((w) => w * scale);

  const rowHeight = (cells: string[], bold: boolean): number => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    let max = 0;
    cells.forEach((t, c) => {
      const w = (colWidths[c] ?? 36) - padding * 2;
      max = Math.max(max, doc.heightOfString(t || " ", { width: w, lineGap: 1 }));
    });
    return max + padding * 2;
  };

  const drawRow = (cells: string[], bold: boolean, shade: boolean): void => {
    const h = rowHeight(cells, bold);
    if (doc.y + h > geo.bottom) {
      doc.addPage();
      doc.x = geo.left;
      doc.y = doc.page.margins.top;
    }
    const y = doc.y;
    if (shade) {
      doc.save().rect(geo.left, y, available, h).fill("#EEF2F7").restore();
    }
    let x = geo.left;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    cells.forEach((t, c) => {
      doc.text(t || "", x + padding, y + padding, { width: (colWidths[c] ?? 36) - padding * 2, lineGap: 1, align: "left" });
      x += colWidths[c] ?? 0;
    });
    doc.save().moveTo(geo.left, y + h).lineTo(geo.left + available, y + h).lineWidth(0.5).strokeColor("#CBD5E1").stroke().restore();
    doc.x = geo.left;
    doc.y = y + h;
  };

  drawRow(header, true, true);
  for (const r of rows) drawRow(header.map((_, c) => r[c] ?? ""), false, false);
  doc.moveDown(0.5);
}

/** Renders parsed markdown blocks into a PDFKit document. */
export function renderPdfBlocks(doc: PDFKit.PDFDocument, blocks: MdBlock[]): void {
  const geo: PdfGeometry = {
    left: doc.page.margins.left,
    right: doc.page.width - doc.page.margins.right,
    bottom: doc.page.height - doc.page.margins.bottom,
  };
  for (const block of blocks) {
    if (doc.y > geo.bottom - 24) {
      doc.addPage();
      doc.x = geo.left;
      doc.y = doc.page.margins.top;
    }
    switch (block.type) {
      case "heading": {
        const size = block.level <= 1 ? 13.5 : block.level === 2 ? 12 : 11;
        doc.moveDown(0.4);
        pdfInline(doc, block.inline.map((r) => ({ ...r, bold: true })), size, false);
        doc.moveDown(0.2);
        break;
      }
      case "paragraph":
        pdfInline(doc, block.inline, 10.5, false);
        doc.moveDown(0.45);
        break;
      case "bullet":
        pdfBullet(doc, block, geo);
        break;
      case "quote": {
        const baseX = doc.page.margins.left;
        doc.x = baseX + 12;
        pdfInline(doc, block.inline.map((r) => ({ ...r, italic: r.italic ?? true })), 10.5, false);
        doc.x = baseX;
        doc.moveDown(0.45);
        break;
      }
      case "table":
        doc.moveDown(0.3);
        pdfTable(doc, block.header, block.rows, geo);
        break;
    }
  }
}
