import { DomainError, type Result } from "@donordesk/domain";
import type { AuthenticatedContext } from "../../context.js";
import type { IStructuredDocumentParser, ITemplateFileStore, StructuredDocumentFormat } from "../../ports/templates.js";
import { renderDocumentText } from "../../services/structured-document-text.js";

export const MAX_TEMPLATE_FILE_BYTES = 20 * 1024 * 1024;

export interface ParsedTemplateFile {
  text: string;
  fileKey: string;
  fileName: string;
  mimeType: string;
  format: StructuredDocumentFormat;
  headingCount: number;
  tableCount: number;
  pageCount?: number;
}

/**
 * Parses an uploaded template with structure and stores the original so the
 * template keeps a downloadable source and extraction can re-read its layout.
 */
export class ParseTemplateFileHandler {
  constructor(private readonly parser: IStructuredDocumentParser, private readonly files: ITemplateFileStore) {}

  async handle(ctx: AuthenticatedContext, input: { buffer: Buffer; fileName: string; mimeType: string }): Promise<Result<ParsedTemplateFile, DomainError>> {
    if (input.buffer.length === 0) return { ok: false, error: DomainError.validation("The uploaded file is empty") };
    if (input.buffer.length > MAX_TEMPLATE_FILE_BYTES) {
      return { ok: false, error: DomainError.validation("Template files must be 20 MB or smaller") };
    }
    if (!this.parser.supports({ fileName: input.fileName, mimeType: input.mimeType })) {
      return { ok: false, error: DomainError.validation("Unsupported file type. Upload a DOCX, PDF, TXT, Markdown, XLSX or CSV file.") };
    }
    const parsed = await this.parser.parse(input);
    if (!parsed.ok) return parsed;
    const text = renderDocumentText(parsed.value);
    if (!text.trim()) {
      return {
        ok: false,
        error: DomainError.validation("No readable text was found in this file. If it is a scanned PDF, paste the template text instead."),
      };
    }
    const stored = await this.files.save({ tenantId: ctx.tenant.tenantId, fileName: input.fileName, mimeType: input.mimeType, buffer: input.buffer });
    if (!stored.ok) return stored;
    return {
      ok: true,
      value: {
        text,
        fileKey: stored.value.key,
        fileName: stored.value.fileName,
        mimeType: stored.value.mimeType,
        format: parsed.value.format,
        headingCount: parsed.value.blocks.filter((b) => b.kind === "HEADING").length,
        tableCount: parsed.value.blocks.filter((b) => b.kind === "TABLE").length,
        pageCount: parsed.value.pageCount,
      },
    };
  }
}
