import type { Result } from "@donordesk/domain";
import { DomainError, MAX_PARSE_FILE_BYTES, assessTextExtraction } from "@donordesk/domain";
import type { IDocumentParser } from "../../ports/evidence.js";

export interface ParsedUpload {
  text: string;
  metadata?: Record<string, unknown>;
}

/**
 * Turns an uploaded file into text for the "upload, paste or dictate" import screens, and says so plainly when it
 * cannot: an empty file, a file over the size limit, a damaged one, a scanned image with no words. The parser used to
 * return empty text and park the reason in `metadata.parseError`, which no screen read, so the person saw an empty box.
 */
export class ParseUploadedFileHandler {
  constructor(private readonly parser: IDocumentParser) {}

  async handle(input: { buffer: Buffer; fileName: string; fileType: string }): Promise<Result<ParsedUpload, DomainError>> {
    if (input.buffer.length === 0) return { ok: false, error: DomainError.validation("The uploaded file is empty. Choose a file with some content in it.") };
    if (input.buffer.length > MAX_PARSE_FILE_BYTES) {
      return { ok: false, error: DomainError.validation(`${input.fileName} is larger than ${MAX_PARSE_FILE_BYTES / (1024 * 1024)} MB. Split it, or paste the text instead.`) };
    }
    const parsed = await this.parser.parse(input);
    const failed = typeof parsed.metadata?.parseError === "string" && parsed.metadata.parseError.length > 0;
    const verdict = assessTextExtraction({ fileName: input.fileName, text: parsed.text, failed, readByOcr: parsed.metadata?.ocr !== undefined });
    if (verdict.status !== "EXTRACTED") {
      return { ok: false, error: DomainError.validation(verdict.message ?? "No readable text was found in this file.", { reason: verdict.status }) };
    }
    // The technical reason is for the logs, never for the person.
    const { parseError: _hidden, ...metadata } = parsed.metadata ?? {};
    return { ok: true, value: { text: parsed.text, ...(Object.keys(metadata).length > 0 ? { metadata } : {}) } };
  }
}
