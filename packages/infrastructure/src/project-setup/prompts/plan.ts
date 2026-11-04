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
  heavy: true,
  promptVersion: "setup-plan-v2",
  sectionTitles: ["work plan", "workplan", "implementation plan", "timeline", "schedule", "activities", "activity", "gantt", "implementation", "plan de travail", "chronogramme", "activites", "plan de trabajo", "cronograma", "actividades"],
  readsFrom: ["WORK_PLAN_GANTT", "PROPOSAL"],
  keywords: ["activity", "activities", "work plan", "workplan", "timeline", "schedule", "gantt", "month", "quarter", "milestone", "training", "distribution"],
  instructions: [
    "Extract the planned activities (the work plan). Answer:",
    '{"plan": [{"title": "...", "logframeCode": "...", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "location": "...", "lead": "...", "quote": "...", "block": N, "confidence": "..."}]}',
    "logframeCode only from the codes listed below and only when the document links the activity to it.",
    "Dates only when the document gives a full day, month and year; a month or quarter alone gives null dates.",
    "A bracket such as [scheduled 2023-07-22 to 2023-08-07 (July Wk -4 to August, 2023 Wk - 1)] on an activity's row is the work plan's own schedule: use its first date as start and its second as end exactly, and keep that row in the quote.",
    "location is the place the document names for the activity; lead is the team or role named as responsible (text only).",
  ].join("\n"),
  context: (prior) => `${datesLine(prior.facts)}\nLogframe codes already read: ${codesOf(prior.logframe).join(", ") || "none"}.`,
  parse: parseLists({ plan: read }),
  merge: mergeLists(valueKey("title", "start"), "plan"),
};
