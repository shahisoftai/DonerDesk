import { text } from "../proposed-item.js";
import { parseLists, valueKey } from "../list-area.js";
import { mergeLists } from "../extractor-shared.js";
import type { AreaExtractionSpec } from "../area-spec.js";
import type { RiskDef } from "@donordesk/domain";

const read = (raw: Record<string, unknown>): RiskDef | null => {
  const title = text(raw.title);
  return title ? { kind: text(raw.kind), title, seriousness: text(raw.seriousness), mitigation: text(raw.mitigation) } : null;
};

export const RISKS_SPEC: AreaExtractionSpec = {
  area: "RISKS",
  promptVersion: "setup-risks-v1",
  budgetChars: 16_000,
  keywords: ["risk", "assumption", "mitigat", "likelihood", "impact", "contingency", "threat"],
  instructions: [
    "Extract the risks and assumptions. Answer:",
    '{"risks": [{"kind": "RISK|ASSUMPTION|ISSUE", "title": "...", "seriousness": "...", "mitigation": "...", "quote": "...", "block": N, "confidence": "..."}]}',
    "seriousness only as the document rates it (\"high\", \"medium likelihood\"); mitigation as the document states it.",
  ].join("\n"),
  parse: parseLists({ risks: read }),
  merge: mergeLists(valueKey("title"), "risks"),
};
