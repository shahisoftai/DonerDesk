/**
 * Decorator (Phase 36.2 follow-up): tries an area's deterministic sheet reader first and falls back to the model extractor
 * when the document is not a sheet. The wrapped extractor is unchanged, so the contract holds for both paths.
 */
import type { PartialSheetReader } from "./budget-sheet-reader.js";
import type { DomainError, Result, SetupAreaKey, SourceBlock } from "@donordesk/domain";
import type { ExtractedArea, ISetupAreaExtractor, SetupExtractInput } from "@donordesk/application";
import { readBudgetSheet } from "./budget-sheet-reader.js";
import { readIndicatorSheet } from "./indicator-sheet-reader.js";
import { FactsFromTextExtractor } from "./facts-from-text.js";
import { PartialSheetFirstExtractor } from "./partial-sheet-first-extractor.js";
import { logframeSheetReader, workPlanSheetReader, type SheetReader } from "./sheet-readers.js";

export const SHEET_PROMPT_VERSION = "sheet-reader-v1";

export class SheetFirstExtractor implements ISetupAreaExtractor {
  readonly area: SetupAreaKey;

  constructor(private readonly read: SheetReader, private readonly fallback: ISetupAreaExtractor) {
    this.area = fallback.area;
  }

  canReadWithoutModel(blocks: ReadonlyArray<SourceBlock>): boolean {
    return this.read(blocks) !== null;
  }

  async extract(input: SetupExtractInput): Promise<Result<ExtractedArea, DomainError>> {
    const fields = this.read(input.blocks);
    if (fields) return { ok: true, value: { fields, promptVersion: SHEET_PROMPT_VERSION } };
    return this.fallback.extract(input);
  }
}

/** Which areas have a sheet reader; an area not listed is always read by the model. */
export const SHEET_READERS: Readonly<Partial<Record<SetupAreaKey, SheetReader>>> = {
  LOGFRAME: logframeSheetReader,
  PLAN: workPlanSheetReader,
};

/** Areas a sheet answers only in part: the sheet gives its fields, the model reads the rest of the documents. */
export const PARTIAL_SHEET_READERS: Readonly<Partial<Record<SetupAreaKey, PartialSheetReader>>> = {
  FUNDING_BUDGET: readBudgetSheet,
  INDICATORS: readIndicatorSheet,
};

/** Areas the documents' own words can complete after the model (the country list for the facts). */
const TEXT_COMPLETERS: Readonly<Partial<Record<SetupAreaKey, (e: ISetupAreaExtractor) => ISetupAreaExtractor>>> = {
  FACTS: (e) => new FactsFromTextExtractor(e),
};

export const withSheetShortcuts = (extractors: ReadonlyArray<ISetupAreaExtractor>): ISetupAreaExtractor[] =>
  extractors.map((e) => TEXT_COMPLETERS[e.area]?.(e) ?? e).map((e) => {
    const read = SHEET_READERS[e.area];
    if (read) return new SheetFirstExtractor(read, e);
    const partial = PARTIAL_SHEET_READERS[e.area];
    return partial ? new PartialSheetFirstExtractor(partial, e) : e;
  });
