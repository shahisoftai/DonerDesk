/**
 * What one area's extraction is, as data (Phase 36.2): its vocabulary for picking blocks, its prompt, how a reply becomes
 * proposal fields and how chunk results merge. A new area is a new spec file plus one entry in `SETUP_EXTRACTION_SPECS`;
 * the extractor that runs specs is never edited.
 */
import type { SetupAreaKey, SetupDocumentKind, SourceBlock } from "@donordesk/domain";
import type { ChunkMerger, ChunkParser } from "./extractor-shared.js";

export interface AreaExtractionSpec {
  area: SetupAreaKey;
  /** Recorded with every run, so an eval result names the prompt it measured. */
  promptVersion: string;
  /** Lower-case words that mark a block as relevant; a document with fewer than three matches is read whole. */
  keywords: readonly string[];
  /** What to extract and the exact JSON shape to answer in. */
  instructions: string;
  /** Upstream facts the model may use to link items (logframe codes, project dates); never text to quote from. */
  context?: (prior: Readonly<Record<string, unknown>>) => string;
  parse: ChunkParser;
  merge: ChunkMerger;
  maxTokens?: number;
  /** This area decides structure (results chain, indicators, work plan): it uses the heavier model when one is set (SETUP_HEAVY_MODEL). */
  heavy?: boolean;
  /** How much of the document this area reads, in characters (default: SELECTION_BUDGET_CHARS). */
  budgetChars?: number;
  /** Blocks this area never reads (another area owns them: a Gantt chart belongs to the work plan, not the results framework). */
  skipBlock?: (block: SourceBlock) => boolean;
  /** Blocks always read from the start of each document (the cover and summary pages). */
  headBlocks?: number;
  /**
   * Fragments of the headings that normally hold this area's information (English, French, Spanish; lower case). Sections
   * whose path contains one are read first and whole; keywords fill the rest. A document with no such heading is still read.
   */
  sectionTitles?: readonly string[];
  /** The document kinds this area reads (`classifyDocument`); OTHER and unclassified documents are always read. Absent = all. */
  readsFrom?: readonly SetupDocumentKind[];
  /** After the main read, ask again over the relevant blocks no kept item quotes (recall for long documents). */
  recallPass?: boolean;
  /** A second, small call that decides structure over the items found (the results chain's levels and parents). */
  refine?: AreaRefinement;
  /** The JSON Schema of a reply, for a provider that can enforce it. */
  schema?: Record<string, unknown>;
}

/** A follow-up call over the first answer's items only: small, fixed input, so its answer is stable. */
export interface AreaRefinement {
  promptVersion: string;
  schema?: Record<string, unknown>;
  /** How many independent answers to take; the majority wins (1 = no vote). */
  votes: number;
  /** The prompt for these fields, or null when there is nothing to refine. */
  prompt: (fields: Readonly<Record<string, unknown>>) => string | null;
  /** The refined fields from the answers (each a parsed JSON reply, or null when that answer was unreadable). */
  apply: (fields: Readonly<Record<string, unknown>>, answers: ReadonlyArray<unknown>) => Record<string, unknown>;
}
