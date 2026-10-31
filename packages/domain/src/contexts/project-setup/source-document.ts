/**
 * The uploaded document as the extraction pipeline sees it: short blocks (a paragraph, a table row, a heading) with where each
 * sits, so a proposed value can point at its page. `normaliseForMatch` is the one spelling a quote and the source text are
 * compared in: whitespace differences never break an otherwise verbatim quote.
 */
export interface SourceBlock {
  /** Which uploaded document a proposal may be built from; the UI ships one document first. */
  documentId: string;
  /** Position of the block inside its document, in reading order. */
  index: number;
  page?: number;
  text: string;
}

export const normaliseForMatch = (text: string): string => text.replace(/\s+/g, " ").trim();

/** The whole document's text in one normalised string: the grounding reference for every proposed item. */
export function joinBlocks(blocks: ReadonlyArray<SourceBlock>): string {
  return normaliseForMatch(blocks.map((b) => b.text).join(" "));
}
