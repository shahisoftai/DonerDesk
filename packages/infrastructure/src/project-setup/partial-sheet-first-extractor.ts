/**
 * Decorator for an area that a sheet answers only in part (Phase 36 optimisation): the sheet reader supplies its fields
 * exactly, and the model reads only the documents the sheet did not account for, for the fields the sheet cannot give. The
 * sheet's fields win; when the model cannot answer, the sheet's fields are still returned and the area is marked partly read.
 */
import type { DomainError, Result, SetupAreaKey, SourceBlock } from "@donordesk/domain";
import type { ExtractedArea, ISetupAreaExtractor, SetupExtractInput } from "@donordesk/application";
import type { PartialSheetRead, PartialSheetReader } from "./budget-sheet-reader.js";
import { SHEET_PROMPT_VERSION } from "./sheet-first-extractor.js";

export class PartialSheetFirstExtractor implements ISetupAreaExtractor {
  readonly area: SetupAreaKey;

  constructor(private readonly read: PartialSheetReader, private readonly fallback: ISetupAreaExtractor) {
    this.area = fallback.area;
  }

  // The model is still needed for the rest of the area, so a sheet alone does not make this area model-free.
  canReadWithoutModel(_blocks: ReadonlyArray<SourceBlock>): boolean {
    return false;
  }

  async extract(input: SetupExtractInput): Promise<Result<ExtractedArea, DomainError>> {
    const sheet = this.read(input.blocks);
    if (!sheet) return this.fallback.extract(input);
    const rest = input.blocks.filter((b) => !sheet.documentIds.includes(b.documentId));
    const modelRun = rest.length > 0 ? await this.fallback.extract({ ...input, blocks: rest }) : null;
    if (modelRun && modelRun.ok) {
      return { ok: true, value: { ...modelRun.value, fields: combineFields(modelRun.value.fields, sheet) } };
    }
    return { ok: true, value: { fields: sheet.fields, partlyRead: modelRun !== null, promptVersion: SHEET_PROMPT_VERSION } };
  }
}

/** The sheet's fields over the model's: replaced, or (APPEND) list fields joined with the sheet's items first. */
export function combineFields(model: Readonly<Record<string, unknown>>, sheet: PartialSheetRead): Record<string, unknown> {
  if (sheet.combine !== "APPEND") return { ...model, ...sheet.fields };
  const out: Record<string, unknown> = { ...model };
  for (const [key, value] of Object.entries(sheet.fields)) {
    const theirs = model[key];
    out[key] = Array.isArray(value) && Array.isArray(theirs) ? [...value, ...theirs] : value;
  }
  return out;
}
