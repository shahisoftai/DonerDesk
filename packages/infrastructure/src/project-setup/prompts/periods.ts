import { oneOf, plainDate } from "../proposed-item.js";
import { parseLists, valueKey } from "../list-area.js";
import { mergeLists } from "../extractor-shared.js";
import { datesLine } from "./prior.js";
import type { AreaExtractionSpec } from "../area-spec.js";
import type { PeriodDef } from "@donordesk/domain";

const CADENCES = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL"] as const;

const read = (raw: Record<string, unknown>): PeriodDef | null => {
  const type = oneOf(String(raw.type ?? "").replace(/[- ]/g, "_"), CADENCES);
  return type ? { type, start: plainDate(raw.start), end: plainDate(raw.end) } : null;
};

export const PERIODS_SPEC: AreaExtractionSpec = {
  area: "PERIODS",
  promptVersion: "setup-periods-v1",
  budgetChars: 12_000,
  keywords: ["report", "reporting", "quarterly", "monthly", "semi-annual", "annual", "final report", "due", "submit"],
  instructions: [
    "Extract the reports the document says must be submitted. Answer:",
    '{"periods": [{"type": "MONTHLY|QUARTERLY|SEMI_ANNUAL|ANNUAL|FINAL", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "quote": "...", "block": N, "confidence": "..."}]}',
    "One item per stated reporting obligation. When the document states only a cadence (\"quarterly reports\"), give one item with that type and null dates; never work out the periods yourself.",
  ].join("\n"),
  context: (prior) => datesLine(prior.facts),
  parse: parseLists({ periods: read }),
  merge: mergeLists(valueKey("type", "start", "end"), "periods"),
};
