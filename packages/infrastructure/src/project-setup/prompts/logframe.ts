import { oneOf, text } from "../proposed-item.js";
import { parseLists, valueKey } from "../list-area.js";
import { mergeLists } from "../extractor-shared.js";
import type { AreaExtractionSpec } from "../area-spec.js";
import type { LogframeNodeDef, SetupLogLevel } from "@donordesk/domain";

const LEVELS: readonly SetupLogLevel[] = ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"];

/** Vocabulary the documents use for the four levels; one table, read before the strict level check. */
const LEVEL_ALIASES: Readonly<Record<string, SetupLogLevel>> = {
  IMPACT: "GOAL", OBJECTIVE: "GOAL", "OVERALL OBJECTIVE": "GOAL",
  "SPECIFIC OBJECTIVE": "OUTCOME", RESULT: "OUTCOME", "INTERMEDIATE RESULT": "OUTCOME", PURPOSE: "OUTCOME",
  "SUB-RESULT": "OUTPUT", DELIVERABLE: "OUTPUT",
};

const level = (x: unknown): SetupLogLevel | null => {
  const word = text(x)?.toUpperCase() ?? "";
  return LEVEL_ALIASES[word] ?? oneOf(word, LEVELS);
};

const read = (raw: Record<string, unknown>): LogframeNodeDef | null => {
  const lv = level(raw.level);
  const title = text(raw.title);
  if (!lv || !title) return null;
  const code = text(raw.code);
  return { level: lv, code, title, description: text(raw.description), parentCode: text(raw.parentCode), ...(code ? { codeSource: "DOCUMENT" as const } : {}) };
};

export const LOGFRAME_SPEC: AreaExtractionSpec = {
  area: "LOGFRAME",
  promptVersion: "setup-logframe-v1",
  keywords: ["goal", "impact", "objective", "outcome", "output", "result", "activity", "activities", "logframe", "logical framework", "results framework"],
  instructions: [
    "Extract the results hierarchy (logframe). Answer:",
    '{"logframe": [{"level": "GOAL|OUTCOME|OUTPUT|ACTIVITY", "code": "...", "title": "...", "description": "...", "parentCode": "...", "quote": "...", "block": N, "confidence": "..."}]}',
    "Impact/overall objective is GOAL; specific objective/result/purpose is OUTCOME; an output under it is OUTPUT; a planned action is ACTIVITY.",
    "parentCode is the code of the item one level up, only when the document's numbering or layout shows it; otherwise null.",
    "List items in the document's order. Do not repeat an item.",
  ].join("\n"),
  parse: parseLists({ logframe: read }),
  merge: mergeLists(valueKey("level", "code", "title"), "logframe"),
};
