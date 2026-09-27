import mammoth from "mammoth";
import * as ExcelJS from "exceljs";
import { DomainError, type Result } from "@donordesk/domain";
import type { DocumentBlock, IStructuredDocumentParser, StructuredDocument } from "@donordesk/application";
import { htmlToBlocks } from "./html-blocks.js";
import { linesToBlocks, type SourceLine } from "./text-blocks.js";

type ParseInput = { buffer: Buffer; fileName: string; mimeType: string };

function ext(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

function failure(format: string, error: unknown): Result<StructuredDocument, DomainError> {
  return {
    ok: false,
    error: DomainError.validation(`The ${format} file could not be read. It may be corrupt, password-protected or not a real ${format}.`, {
      cause: error instanceof Error ? error.message : String(error),
    }),
  };
}

const DOCX_STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
];

/** Promotes numbered/capitalised plain or bold paragraphs to headings in DOCX files without heading styles. */
function promotePseudoHeadings(blocks: DocumentBlock[]): DocumentBlock[] {
  if (blocks.some((b) => b.kind === "HEADING")) return blocks;
  const promoted: DocumentBlock[] = [];
  for (const b of blocks) {
    if (b.kind === "PARAGRAPH") {
      const [asBlock] = linesToBlocks([{ text: b.text }]);
      if (asBlock?.kind === "HEADING") {
        promoted.push(asBlock);
        continue;
      }
      if (b.emphasis && b.text.length <= 100 && !/[.?!]$/.test(b.text)) {
        promoted.push({ kind: "HEADING", level: 1, text: b.text.replace(/:$/, "") });
        continue;
      }
    }
    promoted.push(b);
  }
  return promoted;
}

export class DocxBlockReader implements IStructuredDocumentParser {
  supports(i: { fileName: string; mimeType: string }): boolean {
    return ext(i.fileName) === "docx" || i.mimeType.includes("wordprocessingml");
  }
  async parse(input: ParseInput): Promise<Result<StructuredDocument, DomainError>> {
    try {
      const html = await mammoth.convertToHtml({ buffer: input.buffer }, { styleMap: DOCX_STYLE_MAP });
      return { ok: true, value: { format: "DOCX", blocks: promotePseudoHeadings(htmlToBlocks(html.value)) } };
    } catch (error) {
      return failure("Word", error);
    }
  }
}

interface PdfTextItem {
  str: string;
  transform: number[];
}

export class PdfBlockReader implements IStructuredDocumentParser {
  supports(i: { fileName: string; mimeType: string }): boolean {
    return ext(i.fileName) === "pdf" || i.mimeType === "application/pdf";
  }
  async parse(input: ParseInput): Promise<Result<StructuredDocument, DomainError>> {
    const pages: string[] = [];
    try {
      const mod = (await import("pdf-parse")) as unknown as { default: (b: Buffer, o?: Record<string, unknown>) => Promise<{ numpages: number }> };
      const pagerender = async (pageData: { getTextContent: (o: Record<string, unknown>) => Promise<{ items: PdfTextItem[] }> }) => {
        const content = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
        let lastY: number | undefined;
        let text = "";
        for (const item of content.items) {
          const y = item.transform[5];
          if (lastY === undefined || Math.abs((y ?? 0) - lastY) < 2) text += item.str;
          else text += `\n${item.str}`;
          lastY = y;
        }
        pages.push(text);
        return text;
      };
      const data = await mod.default(input.buffer, { pagerender });
      const lines: SourceLine[] = pages.flatMap((p, i) => [...p.split(/\r?\n/).map((text) => ({ text, page: i + 1 })), { text: "", page: i + 1 }]);
      return { ok: true, value: { format: "PDF", blocks: linesToBlocks(stripRunningHeaders(lines, pages.length)), pageCount: data.numpages } };
    } catch (error) {
      return failure("PDF", error);
    }
  }
}

/** Drops lines repeated on most pages (running headers/footers, page numbers). */
function stripRunningHeaders(lines: SourceLine[], pageCount: number): SourceLine[] {
  if (pageCount < 3) return lines.filter((l) => !/^\s*(page\s*)?\d+(\s*(of|\/)\s*\d+)?\s*$/i.test(l.text));
  const counts = new Map<string, Set<number>>();
  for (const l of lines) {
    const k = l.text.trim().replace(/\d+/g, "#");
    if (!k) continue;
    const pages = counts.get(k) ?? new Set<number>();
    pages.add(l.page ?? 0);
    counts.set(k, pages);
  }
  const threshold = Math.max(3, Math.ceil(pageCount * 0.6));
  return lines.filter((l) => {
    const k = l.text.trim().replace(/\d+/g, "#");
    return !k || (counts.get(k)?.size ?? 0) < threshold;
  });
}

export class SpreadsheetBlockReader implements IStructuredDocumentParser {
  supports(i: { fileName: string; mimeType: string }): boolean {
    return ext(i.fileName) === "xlsx" || i.mimeType.includes("spreadsheetml");
  }
  async parse(input: ParseInput): Promise<Result<StructuredDocument, DomainError>> {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(input.buffer as unknown as ArrayBuffer);
      const blocks: DocumentBlock[] = [];
      wb.eachSheet((sheet) => {
        const rows: string[][] = [];
        sheet.eachRow((row) => {
          const cells: string[] = [];
          row.eachCell({ includeEmpty: true }, (cell) => cells.push((cell.text ?? "").trim()));
          if (cells.some((c) => c)) rows.push(cells);
        });
        if (rows.length === 0) return;
        blocks.push({ kind: "HEADING", level: 1, text: sheet.name });
        blocks.push({ kind: "TABLE", rows });
      });
      return { ok: true, value: { format: "XLSX", blocks } };
    } catch (error) {
      return failure("Excel", error);
    }
  }
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

export class CsvBlockReader implements IStructuredDocumentParser {
  supports(i: { fileName: string; mimeType: string }): boolean {
    return ext(i.fileName) === "csv" || i.mimeType === "text/csv";
  }
  async parse(input: ParseInput): Promise<Result<StructuredDocument, DomainError>> {
    const rows = parseCsv(input.buffer.toString("utf8").replace(/^﻿/, ""));
    return { ok: true, value: { format: "CSV", blocks: rows.length ? [{ kind: "TABLE", rows }] : [] } };
  }
}

export class PlainTextBlockReader implements IStructuredDocumentParser {
  supports(i: { fileName: string; mimeType: string }): boolean {
    const e = ext(i.fileName);
    return e === "txt" || e === "md" || e === "markdown" || (i.mimeType.startsWith("text/") && i.mimeType !== "text/csv");
  }
  async parse(input: ParseInput): Promise<Result<StructuredDocument, DomainError>> {
    const text = input.buffer.toString("utf8").replace(/^﻿/, "");
    return { ok: true, value: { format: "TEXT", blocks: linesToBlocks(text.split(/\r?\n/).map((t) => ({ text: t }))) } };
  }
}
