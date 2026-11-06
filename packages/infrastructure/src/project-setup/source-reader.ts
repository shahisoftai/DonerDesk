import { classifyDocument, DomainError, ok, splitSheets, type Result, type SourceBlock } from "@donordesk/domain";
import { buildDocumentMap } from "./document-map.js";
import { compactSheetText, dropNearDuplicates } from "./document-prep.js";
import { driveFileIdsOf, type ISetupDocumentStore, type ISourceDocumentReader, type ParseUploadedFileHandler, type SetupSourceRef } from "@donordesk/application";

import { readPdfLayout, type ScannedPageReader } from "./pdf-layout.js";

const BLOCK_CHARS = 1600;

/**
 * The one place that knows how a stored setup document becomes readable blocks: the file is downloaded from the
 * organisation's own Google Drive (and not kept), goes through the ordinary file parser (with its OCR fallback and its
 * plain-language refusals), then the text is cut into blocks on paragraph boundaries so an extracted value can point at
 * its place.
 */
export class StoredSetupDocumentReader implements ISourceDocumentReader {
  constructor(private readonly documents: ISetupDocumentStore, private readonly parse: ParseUploadedFileHandler, private readonly scannedPageReader?: ScannedPageReader) {}

  async read(source: SetupSourceRef): Promise<Result<SourceBlock[], DomainError>> {
    const fileIds = driveFileIdsOf(source.storageKey);
    if (fileIds.length === 0) {
      return { ok: false, error: DomainError.validation("This document was added before documents were kept in your Google Drive. Add it again.") };
    }
    const parsedDocuments: { n: number; name: string; text: string }[] = [];
    for (const [n, fileId] of fileIds.entries()) {
      const file = await this.documents.read(source.tenantId, fileId);
      if (!file.ok) {
        return { ok: false, error: DomainError.validation("A document could not be read from your Google Drive. Check that Drive is still connected and the file is still in its folder, then add it again.") };
      }
      const name = file.value.name || source.fileName;
      const fileType = file.value.mimeType || guessContentType(name);
      // A PDF keeps its headings and table rows when its text layer has them; a scan goes on to the ordinary parser and its OCR.
      const pdf = fileType === "application/pdf" || name.toLowerCase().endsWith(".pdf") ? await readPdfLayout(file.value.bytes, name, this.scannedPageReader) : null;
      if (pdf) { parsedDocuments.push({ n, name, text: pdf }); continue; }
      const parsed = await this.parse.handle({ buffer: file.value.bytes, fileName: name, fileType });
      if (!parsed.ok) return { ok: false, error: DomainError.validation(fileIds.length > 1 ? `${name}: ${parsed.error.message}` : parsed.error.message) };
      parsedDocuments.push({ n, name, text: compactSheetText(parsed.value.text) });
    }
    // A draft and its revision say the same thing: read it once.
    const { kept } = dropNearDuplicates(parsedDocuments);
    const blocks: SourceBlock[] = [];
    for (const document of kept) {
      // Blocks are numbered across the whole set, so a block number points at exactly one place; the document id says which file.
      // Each sheet of a workbook is typed on its own (a workbook may hold a budget and a Gantt chart side by side).
      for (const section of splitSheets(document.text)) {
        const docKind = classifyDocument(section.text).kind;
        for (const block of toSectionBlocks(section.text, section.title)) blocks.push({ ...block, documentId: `source-${document.n + 1}`, index: blocks.length, docKind, documentName: document.name, sheet: section.title });
      }
    }
    return ok(blocks);
  }
}

/** More than this share of lines holding tab-separated cells makes the text a sheet. */
const TABULAR_SHARE = 0.3;

const isTabular = (lines: ReadonlyArray<string>): boolean => {
  const filled = lines.filter((l) => l.trim());
  return filled.length > 0 && filled.filter((l) => l.split("\t").filter((c) => c.trim()).length >= 2).length / filled.length > TABULAR_SHARE;
};

/**
 * Blocks that follow the document's own sections (Phase 37 §9): a sheet is one section named after it (its blocks are cut as
 * before); any other text is mapped by its headings and every block is cut inside one section, carrying that section's path.
 */
export function toSectionBlocks(text: string, sheetTitle: string | null, blockChars = BLOCK_CHARS): SourceBlock[] {
  const lines = text.split(/\r?\n/);
  if (isTabular(lines)) return toBlocks(text, blockChars).map((b) => ({ ...b, section: sheetTitle ?? PREAMBLE_SHEET }));
  const blocks: SourceBlock[] = [];
  for (const section of buildDocumentMap(lines)) {
    const body = lines.slice(section.start, section.end).join("\n");
    for (const block of toBlocks(body, blockChars)) blocks.push({ ...block, index: blocks.length, section: section.path });
  }
  return blocks;
}

const PREAMBLE_SHEET = "Document";

/**
 * Cuts the document's text into blocks of whole lines, numbered in reading order. Lines are kept verbatim — tabs and
 * commas included — so a spreadsheet sheet still parses as rows; only trailing whitespace is trimmed.
 */
const isTableRow = (line: string): boolean => line.includes(" | ") || line.split("\t").filter((c) => c.trim()).length >= 2;

export function toBlocks(text: string, blockChars = BLOCK_CHARS): SourceBlock[] {
  const blocks: SourceBlock[] = [];
  const lines = text.split(/\r?\n/);
  let carry: string[] = [];
  let length = 0;
  let columns: string | undefined;
  let header: string | undefined;
  for (const line of lines) {
    const trimmed = line.replace(/\s+$/g, "");
    if (length > 0 && length + trimmed.length + 1 > blockChars) {
      blocks.push({ documentId: "source", index: blocks.length, text: trimBlock(carry.join("\n")), ...(columns ? { columns } : {}) });
      carry = [];
      length = 0;
      columns = isTableRow(trimmed) ? header : undefined;
    }
    // A table's first row names its columns; a line that is not a row ends the table.
    if (!isTableRow(trimmed)) { if (trimmed.trim()) header = undefined; } else if (!header) header = trimmed.slice(0, 300);
    carry.push(trimmed);
    length += trimmed.length + 1;
  }
  const rest = trimBlock(carry.join("\n"));
  if (rest) blocks.push({ documentId: "source", index: blocks.length, text: rest, ...(columns ? { columns } : {}) });
  return blocks;
}

/**
 * Blank lines at the ends of a block go; a leading tab stays. A sheet row whose first cell is empty starts with a tab, and
 * trimming it would move every cell one column to the left (a deliverable read as the activity's title).
 */
const trimBlock = (text: string): string => text.replace(/^(?:[ \t]*\n)+/, "").replace(/\s+$/, "");

function guessContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".csv")) return "text/csv";
  return "text/plain";
}
