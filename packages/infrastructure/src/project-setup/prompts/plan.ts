import { plainDate, text } from "../proposed-item.js";
import { parseLists, valueKey } from "../list-area.js";
import { mergeLists } from "../extractor-shared.js";
import { codesOf, datesLine } from "./prior.js";
import type { AreaExtractionSpec } from "../area-spec.js";
import type { PlannedActivityDef } from "@donordesk/domain";

const read = (raw: Record<string, unknown>): PlannedActivityDef | null => {
  const title = text(raw.title);
  return title
    ? { title, logframeCode: text(raw.logframeCode), start: plainDate(raw.start), end: plainDate(raw.end), location: text(raw.location), lead: text(raw.lead) }
    : null;
};

export const PLAN_SPEC: AreaExtractionSpec = {
  area: "PLAN",
  promptVersion: "setup-plan-v1",
  keywords: ["activity", "activities", "work plan", "workplan", "timeline", "schedule", "gantt", "month", "quarter", "milestone", "training", "distribution"],
  instructions: [
    "Extract the planned activities (the work plan). Answer:",
    '{"plan": [{"title": "...", "logframeCode": "...", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "location": "...", "lead": "...", "quote": "...", "block": N, "confidence": "..."}]}',
    "logframeCode only from the codes listed below and only when the document links the activity to it.",
    "Dates only when the document gives a full day, month and year; a month or quarter alone gives null dates.",
    "location is the place the document names for the activity; lead is the team or role named as responsible (text only).",
  ].join("\n"),
  context: (prior) => `${datesLine(prior.facts)}\nLogframe codes already read: ${codesOf(prior.logframe).join(", ") || "none"}.`,
  parse: parseLists({ plan: read }),
  merge: mergeLists(valueKey("title", "start"), "plan"),
};
