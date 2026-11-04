import { strings, text } from "../proposed-item.js";
import { parseLists, valueKey } from "../list-area.js";
import { mergeLists } from "../extractor-shared.js";
import { codesOf } from "./prior.js";
import type { AreaExtractionSpec } from "../area-spec.js";
import type { IndicatorDef } from "@donordesk/domain";

const read = (raw: Record<string, unknown>): IndicatorDef | null => {
  const title = text(raw.title);
  if (!title) return null;
  const code = text(raw.code);
  return {
    code, title, logframeCode: text(raw.logframeCode), type: text(raw.type)?.toUpperCase() ?? null, unit: text(raw.unit),
    baseline: text(raw.baseline), target: text(raw.target), targetSchedule: text(raw.targetSchedule), frequency: text(raw.frequency),
    direction: text(raw.direction), disaggregation: strings(raw.disaggregation), meansOfVerification: text(raw.meansOfVerification),
    ...(code ? { codeSource: "DOCUMENT" as const } : {}),
  };
};

export const INDICATORS_SPEC: AreaExtractionSpec = {
  area: "INDICATORS",
  heavy: true,
  promptVersion: "setup-indicators-v2",
  sectionTitles: ["indicator", "indicators", "monitoring and evaluation", "monitoring evaluation", "m&e", "meal", "performance monitoring", "performance management", "results measurement", "baseline", "targets", "suivi et evaluation", "indicateur", "seguimiento y evaluacion", "indicador", "metas"],
  readsFrom: ["PROPOSAL", "LOGFRAME_MATRIX", "INDICATOR_TABLE"],
  recallPass: true,
  keywords: ["indicator", "baseline", "target", "means of verification", "measured", "frequency", "disaggregat", "%", "number of", "proportion"],
  instructions: [
    "Extract the indicators. Answer:",
    '{"indicators": [{"code": "...", "title": "...", "logframeCode": "...", "type": "NUMBER|PERCENTAGE|RATIO|CURRENCY", "unit": "...", "baseline": "...", "target": "...", "targetSchedule": "...", "frequency": "...", "direction": "higher is better|lower is better", "disaggregation": ["sex", "age"], "meansOfVerification": "...", "quote": "...", "block": N, "confidence": "..."}]}',
    "logframeCode is the code of the logframe item the indicator measures, chosen only from the codes listed below and only when the document links them.",
    "baseline and target are copied as written (\"0\", \"75%\", \"1,200\"); if a figure is not stated, null. direction only when the document says it.",
    "The quote must contain the indicator's baseline and target figures when you give them; use the table row or sentence that states them.",
    "A target or baseline of 0 in a table that was never filled in (all its columns are 0) is not a target: use null. Keep the indicator.",
  ].join("\n"),
  context: (prior) => `Logframe codes already read: ${codesOf(prior.logframe).join(", ") || "none"}.`,
  parse: parseLists({ indicators: read }),
  merge: mergeLists(valueKey("code", "title"), "indicators"),
};
