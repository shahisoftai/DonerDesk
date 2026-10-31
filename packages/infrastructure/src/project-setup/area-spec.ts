/**
 * What one area's extraction is, as data (Phase 36.2): its vocabulary for picking blocks, its prompt, how a reply becomes
 * proposal fields and how chunk results merge. A new area is a new spec file plus one entry in `SETUP_EXTRACTION_SPECS`;
 * the extractor that runs specs is never edited.
 */
import type { SetupAreaKey } from "@donordesk/domain";
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
}
