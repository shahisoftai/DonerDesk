import mammoth from "mammoth";
import * as ExcelJS from "exceljs";
import JSZip from "jszip";
import WordExtractor from "word-extractor";
import type { IDocumentParser } from "@donordesk/application";
import { docxHtmlToText } from "./docx-text.js";

export class TolerantDocumentParser implements IDocumentParser {
  async parse(input: { buffer: Buffer; fileType: string; fileName: string }): Promise<{ text: string; metadata?: Record<string, unknown> }> {
    const name = input.fileName.toLowerCase();
    const ext = name.split(".").pop() ?? "";
    try {
      if (ext === "docx" || input.fileType.includes("officedocument.wordprocessingml")) {
        // Tables are kept as rows ("label | value"); raw text put every cell on its own line. Raw text stays the fallback.
        try {
          const html = await mammoth.convertToHtml({ buffer: input.buffer });
          const text = docxHtmlToText(html.value);
          if (text.trim()) return { text };
        } catch { /* fall through to raw text */ }
        const result = await mammoth.extractRawText({ buffer: input.buffer });
        return { text: result.value };
      }
      if (ext === "doc" || input.fileType === "application/msword") {
        const doc = await new WordExtractor().extract(input.buffer);
        return { text: doc.getBody() };
      }
      if (ext === "xlsx" || ext === "xlsm" || input.fileType.includes("spreadsheetml")) {
        let text = "";
        let firstError: unknown;
        try {
          text = await readWithExcelJs(input.buffer);
        } catch (e) {
          firstError = e;
        }
        // ExcelJS stops on workbooks with unusual styles, names or extensions; the sheets' own XML is still readable.
        if (!text.trim()) {
          try {
            text = await readXlsxXml(input.buffer);
          } catch (e) {
            return { text: "", metadata: { parseError: String(firstError ?? e) } };
          }
        }
        return { text };
      }
      if (ext === "txt" || input.fileType.startsWith("text/")) {
        return { text: input.buffer.toString("utf8") };
      }
      if (ext === "csv") {
        return { text: input.buffer.toString("utf8") };
      }
      if (ext === "pdf" || input.fileType === "application/pdf") {
        // pdf-parse can be slow / heavy on small installs; we try to lazy import.
        try {
          const mod = await import("pdf-parse");
          const data = await (mod as { default: (b: Buffer) => Promise<{ text: string }> }).default(input.buffer);
          return { text: data.text };
        } catch (e) {
          return { text: "", metadata: { parseError: String(e) } };
        }
      }
      // For images we just store the filename as the "text" placeholder.
      return { text: name };
    } catch (e) {
      return { text: "", metadata: { parseError: String(e) } };
    }
  }
}

async function readWithExcelJs(buffer: Buffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const parts: string[] = [];
  wb.eachSheet((sheet) => {
    parts.push(`# ${sheet.name}`);
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell((cell) => {
        let value = "";
        try { value = cell.text ?? ""; } catch { value = ""; }
        // A line break inside a cell would split one row into two and shift every column after it.
        cells.push(value.replace(/\s*\r?\n\s*/g, " "));
      });
      parts.push(cells.join("\t"));
    });
  });
  return parts.join("\n");
}

const decodeXml = (v: string): string => v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");
const textOf = (xml: string): string => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1]!)).join("");

function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/[^A-Z]/gi, "").toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return Math.max(0, n - 1);
}

/** Reads the cell text straight from the workbook's XML (shared strings, inline strings, cached formula results). */
async function readXlsxXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const read = async (path: string) => (await zip.file(path)?.async("string")) ?? "";
  const shared = [...(await read("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!));
  const workbook = await read("xl/workbook.xml");
  const rels = await read("xl/_rels/workbook.xml.rels");
  const target = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => [/Id="([^"]*)"/.exec(m[0])?.[1] ?? "", /Target="([^"]*)"/.exec(m[0])?.[1] ?? ""]));
  const parts: string[] = [];
  for (const sheet of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeXml(/name="([^"]*)"/.exec(sheet[0])?.[1] ?? "Sheet");
    const rid = /r:id="([^"]*)"/.exec(sheet[0])?.[1] ?? "";
    const rel = target.get(rid);
    if (!rel) continue;
    const xml = await read(rel.startsWith("/") ? rel.slice(1) : `xl/${rel}`);
    parts.push(`# ${name}`);
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const c of row[1]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1]!;
        const body = c[2] ?? "";
        const type = /\bt="([^"]*)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value = "";
        if (type === "s" && v !== undefined) value = shared[Number(v)] ?? "";
        else if (type === "inlineStr") value = textOf(body);
        else if (v !== undefined) value = decodeXml(v);
        const ref = /\br="([^"]*)"/.exec(attrs)?.[1];
        const at = ref ? columnIndex(ref) : cells.length;
        while (cells.length < at) cells.push("");
        cells[at] = value.replace(/\s*\r?\n\s*/g, " ");
      }
      if (cells.some((v) => v !== "")) parts.push(cells.join("\t"));
    }
  }
  return parts.join("\n");
}
