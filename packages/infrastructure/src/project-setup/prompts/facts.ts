import { proposedFrom, notStated, asObject, text, strings, plainDate, type RawItem } from "../proposed-item.js";
import type { AreaExtractionSpec } from "../area-spec.js";
import type { ChunkContext } from "../extractor-shared.js";
import { countryNames, withAlternative, type Proposed, type ProposedFacts } from "@donordesk/domain";

const FACT_READERS: Record<keyof ProposedFacts, (v: unknown) => unknown> = {
  name: text, code: text, donor: text, countries: (v) => { const list = strings(v); return list ? countryNames(list) : null; }, sectors: strings,
  startDate: plainDate, endDate: plainDate, currency: (v) => text(v)?.toUpperCase() ?? null, summary: text,
};
const FACT_KEYS = Object.keys(FACT_READERS) as (keyof ProposedFacts)[];

function parse(raw: unknown, ctx: ChunkContext): Record<string, unknown> | string {
  const root = asObject(raw);
  if (!root) return "The model's answer for the project facts was not an object.";
  const facts = Object.fromEntries(FACT_KEYS.map((key) => {
    const item = asObject(root[key]);
    return [key, item ? proposedFrom(item as RawItem, FACT_READERS[key](item.value) as never, ctx) : notStated()];
  }));
  return { facts };
}

/**
 * A later chunk fills a fact an earlier one left Not stated, and never replaces one already read: a different value it gives
 * is kept beside the first as an alternative (Phase 37.4), for the person to choose.
 */
function merge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const left = (a.facts ?? {}) as Record<string, Proposed<unknown>>;
  const right = (b.facts ?? {}) as Record<string, Proposed<unknown>>;
  return { facts: Object.fromEntries(FACT_KEYS.map((k) => [k, left[k] ? withAlternative(left[k]!, right[k]) : right[k] ?? notStated()])) };
}

export const FACTS_SPEC: AreaExtractionSpec = {
  area: "FACTS",
  promptVersion: "setup-facts-v3",
  headBlocks: 3,
  budgetChars: 14_000,
  // A fact the first read left Not stated is looked for again in the passages it did not quote (the merge only fills gaps).
  recallPass: true,
  keywords: ["project", "title", "donor", "funded", "duration", "start", "end", "country", "province", "district", "location", "sector", "budget", "currency", "summary", "period of performance"],
  instructions: [
    "Extract the project's basic facts. Answer:",
    '{"name": F, "code": F, "donor": F, "countries": F, "sectors": F, "startDate": F, "endDate": F, "currency": F, "summary": F}',
    'where each F is {"value": ..., "quote": "...", "block": N, "confidence": "HIGH|MEDIUM|LOW"} or null when not stated.',
    "countries and sectors are lists of strings; startDate/endDate are YYYY-MM-DD; currency is a three-letter code; summary is one or two sentences copied from the document.",
    "countries: every country the text names in words (in a title, a location, a staff or office list); quote the line that names it. A province, district or city is not a country, and a currency name is not a country.",
    "currency: from the line that states the money (\"Budgets developed in ...\", a currency column, a code beside an amount).",
  ].join("\n"),
  parse,
  merge,
};
