import { DomainError, ok, type Result, type SourceBlock } from "@donordesk/domain";
import { driveFileIdsOf, type ISetupDocumentStore, type ISourceDocumentReader, type ParseUploadedFileHandler, type SetupSourceRef } from "@donordesk/application";

const BLOCK_CHARS = 1600;

/**
 * The one place that knows how a stored setup document becomes readable blocks: the file is downloaded from the
 * organisation's own Google Drive (and not kept), goes through the ordinary file parser (with its OCR fallback and its
 * plain-language refusals), then the text is cut into blocks on paragraph boundaries so an extracted value can point at
 * its place.
 */
export class StoredSetupDocumentReader implements ISourceDocumentReader {
  constructor(private readonly documents: ISetupDocumentStore, private readonly parse: ParseUploadedFileHandler) {}

  async read(source: SetupSourceRef): Promise<Result<SourceBlock[], DomainError>> {
    const fileIds = driveFileIdsOf(source.storageKey);
    if (fileIds.length === 0) {
      return { ok: false, error: DomainError.validation("This document was added before documents were kept in your Google Drive. Add it again.") };
    }
    const blocks: SourceBlock[] = [];
    for (const [n, fileId] of fileIds.entries()) {
      const file = await this.documents.read(source.tenantId, fileId);
      if (!file.ok) {
        return { ok: false, error: DomainError.validation("A document could not be read from your Google Drive. Check that Drive is still connected and the file is still in its folder, then add it again.") };
      }
      const name = file.value.name || source.fileName;
      const parsed = await this.parse.handle({ buffer: file.value.bytes, fileName: name, fileType: file.value.mimeType || guessContentType(name) });
      if (!parsed.ok) return { ok: false, error: DomainError.validation(fileIds.length > 1 ? `${name}: ${parsed.error.message}` : parsed.error.message) };
      // Blocks are numbered across the whole set, so a block number points at exactly one place; the document id says which file.
      for (const block of toBlocks(parsed.value.text)) blocks.push({ ...block, documentId: `source-${n + 1}`, index: blocks.length });
    }
    return ok(blocks);
  }
}

/**
 * Cuts the document's text into blocks of whole lines, numbered in reading order. Lines are kept verbatim — tabs and
 * commas included — so a spreadsheet sheet still parses as rows; only trailing whitespace is trimmed.
 */
export function toBlocks(text: string, blockChars = BLOCK_CHARS): SourceBlock[] {
  const blocks: SourceBlock[] = [];
  const lines = text.split(/\r?\n/);
  let carry: string[] = [];
  let length = 0;
  for (const line of lines) {
    const trimmed = line.replace(/\s+$/g, "");
    if (length > 0 && length + trimmed.length + 1 > blockChars) {
      blocks.push({ documentId: "source", index: blocks.length, text: carry.join("\n").trim() });
      carry = [];
      length = 0;
    }
    carry.push(trimmed);
    length += trimmed.length + 1;
  }
  const rest = carry.join("\n").trim();
  if (rest) blocks.push({ documentId: "source", index: blocks.length, text: rest });
  return blocks;
}

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
