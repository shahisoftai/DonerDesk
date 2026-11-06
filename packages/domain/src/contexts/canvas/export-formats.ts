/**
 * What a canvas can be exported as (Phase 45.6). The table is the contract every export adapter implements (`IExportFormat` in
 * the application layer); `supportOf` says, per block family and format, whether the block is drawn, shown as text, or left out
 * with a sentence in the file, so no export silently drops something. The text formats are written here, purely.
 */
import type { BlockFamily } from "./block-definition.js";
import type { Canvas } from "./canvas.js";
import { definitionFor } from "./blocks/registry.js";

export const EXPORT_FORMAT_IDS = ["PDF", "PNG", "SVG", "PPTX", "XLSX", "CSV", "HTML", "JSON", "BLOCK_PNG", "ALT_PACK"] as const;
export type ExportFormatId = (typeof EXPORT_FORMAT_IDS)[number];
export interface ExportFormatInfo { id: ExportFormatId; label: string; mime: string; extension: string; /** Needs the print renderer (SVG pipeline). */ visual: boolean }

export const EXPORT_FORMATS: Readonly<Record<ExportFormatId, ExportFormatInfo>> = {
  PDF: { id: "PDF", label: "PDF (tagged, vector)", mime: "application/pdf", extension: "pdf", visual: true },
  PNG: { id: "PNG", label: "Picture (PNG)", mime: "image/png", extension: "png", visual: true },
  SVG: { id: "SVG", label: "Vector picture (SVG)", mime: "image/svg+xml", extension: "svg", visual: true },
  PPTX: { id: "PPTX", label: "PowerPoint", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extension: "pptx", visual: true },
  XLSX: { id: "XLSX", label: "Excel (figures)", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx", visual: false },
  CSV: { id: "CSV", label: "CSV (figures)", mime: "text/csv", extension: "csv", visual: false },
  HTML: { id: "HTML", label: "Web page snapshot", mime: "text/html", extension: "html", visual: true },
  JSON: { id: "JSON", label: "Canvas file (JSON)", mime: "application/json", extension: "json", visual: false },
  BLOCK_PNG: { id: "BLOCK_PNG", label: "One picture per block", mime: "application/zip", extension: "zip", visual: true },
  ALT_PACK: { id: "ALT_PACK", label: "Captions and alt text", mime: "text/plain", extension: "txt", visual: false },
};

export type Support = "DRAWN" | "AS_TEXT" | "TABLE_ONLY" | "LEFT_OUT";
/** Family x format. Controls and containers have no picture of their own: they print as the text of what they select. */
const SUPPORT: Readonly<Record<BlockFamily, Readonly<Record<ExportFormatId, Support>>>> = {
  TEXT: { PDF: "DRAWN", PNG: "DRAWN", SVG: "DRAWN", PPTX: "DRAWN", XLSX: "LEFT_OUT", CSV: "LEFT_OUT", HTML: "DRAWN", JSON: "DRAWN", BLOCK_PNG: "DRAWN", ALT_PACK: "AS_TEXT" },
  NUMBERS: { PDF: "DRAWN", PNG: "DRAWN", SVG: "DRAWN", PPTX: "DRAWN", XLSX: "TABLE_ONLY", CSV: "TABLE_ONLY", HTML: "DRAWN", JSON: "DRAWN", BLOCK_PNG: "DRAWN", ALT_PACK: "AS_TEXT" },
  CHARTS: { PDF: "DRAWN", PNG: "DRAWN", SVG: "DRAWN", PPTX: "DRAWN", XLSX: "TABLE_ONLY", CSV: "TABLE_ONLY", HTML: "DRAWN", JSON: "DRAWN", BLOCK_PNG: "DRAWN", ALT_PACK: "AS_TEXT" },
  MAPS: { PDF: "DRAWN", PNG: "DRAWN", SVG: "DRAWN", PPTX: "DRAWN", XLSX: "TABLE_ONLY", CSV: "TABLE_ONLY", HTML: "DRAWN", JSON: "DRAWN", BLOCK_PNG: "DRAWN", ALT_PACK: "AS_TEXT" },
  TABLES: { PDF: "DRAWN", PNG: "DRAWN", SVG: "DRAWN", PPTX: "DRAWN", XLSX: "TABLE_ONLY", CSV: "TABLE_ONLY", HTML: "DRAWN", JSON: "DRAWN", BLOCK_PNG: "DRAWN", ALT_PACK: "AS_TEXT" },
  AI: { PDF: "DRAWN", PNG: "DRAWN", SVG: "DRAWN", PPTX: "DRAWN", XLSX: "LEFT_OUT", CSV: "LEFT_OUT", HTML: "DRAWN", JSON: "DRAWN", BLOCK_PNG: "DRAWN", ALT_PACK: "AS_TEXT" },
  MEDIA: { PDF: "DRAWN", PNG: "DRAWN", SVG: "DRAWN", PPTX: "DRAWN", XLSX: "LEFT_OUT", CSV: "LEFT_OUT", HTML: "DRAWN", JSON: "DRAWN", BLOCK_PNG: "DRAWN", ALT_PACK: "AS_TEXT" },
  CONTAINERS: { PDF: "DRAWN", PNG: "DRAWN", SVG: "DRAWN", PPTX: "DRAWN", XLSX: "LEFT_OUT", CSV: "LEFT_OUT", HTML: "DRAWN", JSON: "DRAWN", BLOCK_PNG: "AS_TEXT", ALT_PACK: "LEFT_OUT" },
  CONTROLS: { PDF: "AS_TEXT", PNG: "AS_TEXT", SVG: "AS_TEXT", PPTX: "AS_TEXT", XLSX: "LEFT_OUT", CSV: "LEFT_OUT", HTML: "DRAWN", JSON: "DRAWN", BLOCK_PNG: "LEFT_OUT", ALT_PACK: "LEFT_OUT" },
};

export const supportOf = (family: BlockFamily, format: ExportFormatId): Support => SUPPORT[family][format];

export interface ExportPlanRow { pageId: string; blockId: string; kind: string; support: Support; note?: string }
/** What each block will be in this format; a block that is not drawn gets a sentence that goes into the file. */
export function exportPlan(canvas: Canvas, format: ExportFormatId): ExportPlanRow[] {
  const rows: ExportPlanRow[] = [];
  for (const page of canvas.pages) for (const b of page.blocks) {
    if (b.style?.hidden) continue;
    const def = definitionFor(b.kind);
    const support: Support = def ? supportOf(def.family, format) : "LEFT_OUT";
    const note = support === "AS_TEXT" ? "Shown as text: this block is interactive." : support === "TABLE_ONLY" ? "Its figures are written as a table." : support === "LEFT_OUT" ? "This block has no form in this file." : undefined;
    rows.push({ pageId: page.id, blockId: b.id, kind: b.kind, support, ...(note ? { note } : {}) });
  }
  return rows;
}

/** A CSV cell that cannot run as a spreadsheet formula and keeps commas, quotes and line breaks. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const csvOf = (columns: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number | null>>): string =>
  [columns.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n") + "\r\n";

/** The captions and alt text of every visible block, one per line group, for people who place the pictures elsewhere. */
export function altPack(canvas: Canvas): string {
  const lines: string[] = [`${canvas.title}`, ""];
  for (const page of canvas.pages) for (const b of page.blocks) {
    if (b.style?.hidden || (!b.alt && !b.description)) continue;
    lines.push(`[${page.title}] ${b.id} (${b.kind})`, `Alt: ${b.alt ?? ""}`, ...(b.description ? [`Description: ${b.description}`] : []), "");
  }
  return lines.join("\n");
}

/** The canvas as a stable JSON file: keys in a fixed order so two saves of the same canvas are byte-identical. */
export function canvasJson(canvas: Canvas): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sort(x)])) : v;
  return JSON.stringify(sort(canvas), null, 2);
}
