/**
 * Decorator for the project facts (Phase 37.4): after the model, a country the documents name in words but the answer left
 * Not stated is found by the country list (`countriesInText`), with the words around it as the quote. Only the documents'
 * own words are used, a cover or summary block is preferred, and anything the model did give is never replaced.
 */
import { countriesInText, type DomainError, type Proposed, type Result, type SetupAreaKey, type SourceBlock } from "@donordesk/domain";
import type { ExtractedArea, ISetupAreaExtractor, SetupExtractInput } from "@donordesk/application";

const WINDOW = 160;

/** The first line of the first block that names a country, as a quote of at most ~320 characters around the name. */
export function countriesFromBlocks(blocks: ReadonlyArray<SourceBlock>): Proposed<string[]> | null {
  const preferred = [...blocks].sort((a, b) => Number(b.docKind === "PROPOSAL") - Number(a.docKind === "PROPOSAL") || a.index - b.index);
  for (const block of preferred) {
    for (const line of block.text.split("\n")) {
      const names = countriesInText(line);
      if (names.length === 0) continue;
      const flat = line.replace(/\s+/g, " ").trim();
      const at = flat.toLowerCase().indexOf(names[0]!.toLowerCase().slice(0, 4));
      const from = Math.max(0, at - WINDOW);
      const quote = flat.slice(from, from + 2 * WINDOW).trim();
      if (!countriesInText(quote).length) continue;
      return {
        value: countriesInText(quote), sourceQuote: quote,
        sourceRef: { documentId: block.documentId, block: block.index, ...(block.page !== undefined ? { page: block.page } : {}) },
        confidence: "MEDIUM", status: "PROPOSED",
      };
    }
  }
  return null;
}

export class FactsFromTextExtractor implements ISetupAreaExtractor {
  readonly area: SetupAreaKey;

  constructor(private readonly inner: ISetupAreaExtractor) {
    this.area = inner.area;
  }

  async extract(input: SetupExtractInput): Promise<Result<ExtractedArea, DomainError>> {
    const run = await this.inner.extract(input);
    if (!run.ok) return run;
    const facts = run.value.fields.facts as Record<string, Proposed<unknown>> | undefined;
    if (!facts || (facts.countries && facts.countries.value !== null)) return run;
    const found = countriesFromBlocks(input.blocks);
    return found ? { ok: true, value: { ...run.value, fields: { ...run.value.fields, facts: { ...facts, countries: found } } } } : run;
  }
}
