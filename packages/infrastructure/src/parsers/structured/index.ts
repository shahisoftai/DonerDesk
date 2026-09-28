import { DomainError, type Result } from "@donordesk/domain";
import type { IStructuredDocumentParser, StructuredDocument } from "@donordesk/application";
import { CsvBlockReader, DocxBlockReader, PdfBlockReader, PlainTextBlockReader, SpreadsheetBlockReader } from "./readers.js";

export { htmlToBlocks, htmlText } from "./html-blocks.js";
export { linesToBlocks, headingLevel, stripRepeatedBoilerplate } from "./text-blocks.js";
export { parseCsv, cleanDocxBlocks } from "./readers.js";

/** Dispatches to the first format reader that supports the file (open for new formats). */
export class CompositeStructuredDocumentParser implements IStructuredDocumentParser {
  constructor(
    private readonly readers: readonly IStructuredDocumentParser[] = [
      new DocxBlockReader(),
      new PdfBlockReader(),
      new SpreadsheetBlockReader(),
      new CsvBlockReader(),
      new PlainTextBlockReader(),
    ],
  ) {}

  supports(input: { fileName: string; mimeType: string }): boolean {
    return this.readers.some((r) => r.supports(input));
  }

  async parse(input: { buffer: Buffer; fileName: string; mimeType: string }): Promise<Result<StructuredDocument, DomainError>> {
    const reader = this.readers.find((r) => r.supports(input));
    if (!reader) return { ok: false, error: DomainError.validation(`Unsupported file type: ${input.fileName}`) };
    return reader.parse(input);
  }
}
export { assignLevelsFromStyle } from "./style-levels.js";
export { attachStyles, readDocxParagraphStyles } from "./docx-styles.js";
