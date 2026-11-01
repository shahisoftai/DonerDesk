import { proposedFrom, notStated, asObject, text, strings, plainDate, type RawItem } from "../proposed-item.js";
import type { AreaExtractionSpec } from "../area-spec.js";
import type { ChunkContext } from "../extractor-shared.js";
import type { ProposedFacts } from "@donordesk/domain";

const FACT_READERS: Record<keyof ProposedFacts, (v: unknown) => unknown> = {
  name: text, code: text, donor: text, countries: strings, sectors: strings,
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

/** A later chunk fills only facts an earlier one left Not stated; it never replaces one already read. */
function merge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const left = (a.facts ?? {}) as Record<string, { value: unknown }>;
  const right = (b.facts ?? {}) as Record<string, { value: unknown }>;
  return { facts: Object.fromEntries(FACT_KEYS.map((k) => [k, left[k] && left[k].value !== null ? left[k] : right[k] ?? left[k] ?? notStated()])) };
}

export const FACTS_SPEC: AreaExtractionSpec = {
  area: "FACTS",
  promptVersion: "setup-facts-v1",
  headBlocks: 3,
  budgetChars: 14_000,
  keywords: ["project", "title", "donor", "funded", "duration", "start", "end", "country", "sector", "budget", "currency", "summary"],
  instructions: [
    "Extract the project's basic facts. Answer:",
    '{"name": F, "code": F, "donor": F, "countries": F, "sectors": F, "startDate": F, "endDate": F, "currency": F, "summary": F}',
    'where each F is {"value": ..., "quote": "...", "block": N, "confidence": "HIGH|MEDIUM|LOW"} or null when not stated.',
    "countries and sectors are lists of strings; startDate/endDate are YYYY-MM-DD; currency is a three-letter code; summary is one or two sentences copied from the document.",
  ].join("\n"),
  parse,
  merge,
};
