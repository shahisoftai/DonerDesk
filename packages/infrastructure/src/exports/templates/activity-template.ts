import type { TemplateColumn } from "./template-kit.js";
import { addDataSheet, addGuideSheet, cachedBuild, newWorkbook, toBuffer } from "./template-kit.js";

export const ACTIVITY_TEMPLATE_FILENAME = "activity-template.xlsx";

/** Headers the activity import reads (`parseActivityText`); Title, Date and Summary are what a row needs. */
export const ACTIVITY_COLUMNS: ReadonlyArray<TemplateColumn> = [
  { header: "Activity Title", width: 36, required: true, takes: "What was done", example: "Hygiene promotion session, Ward 4" },
  { header: "Activity Date", width: 14, required: true, takes: "The day it happened (or started), written YYYY-MM-DD; it decides the reporting period", example: "2026-03-10" },
  { header: "Activity End Date", width: 16, required: false, takes: "Last day, YYYY-MM-DD, only for an activity that ran over several days; never before the Activity Date", example: "2026-03-12" },
  { header: "Location", width: 22, required: false, takes: "Where it happened", example: "Ward 4" },
  { header: "Logframe Code (Output or Activity)", width: 22, required: false, takes: "Code of the output or activity in this project's logframe; rows without one are imported unlinked and listed", example: "A1.1" },
  { header: "Indicator Code", width: 16, required: false, takes: "Code of the indicator this activity contributes to", example: "O1.1" },
  { header: "Participants Total", width: 20, required: false, takes: "Whole number", example: "48" },
  { header: "Participants Male", width: 20, required: false, takes: "Whole number", example: "20" },
  { header: "Participants Female", width: 20, required: false, takes: "Whole number", example: "28" },
  { header: "Participants Children", width: 20, required: false, takes: "Whole number", example: "" },
  { header: "Participants Disability", width: 20, required: false, takes: "Whole number", example: "3" },
  { header: "Participants Other", width: 20, required: false, takes: "Any other group, in words", example: "" },
  { header: "Summary", width: 50, required: true, takes: "What happened, who took part and why it matters", example: "Session on handwashing at critical times with caregivers of children under five." },
  { header: "Achievements", width: 36, required: false, takes: "Text", example: "" },
  { header: "Challenges", width: 36, required: false, takes: "Text", example: "" },
  { header: "Lessons Learned", width: 36, required: false, takes: "Text", example: "" },
  { header: "Next Steps", width: 36, required: false, takes: "Text", example: "" },
];

/** Kept for callers that list the headers. */
export const ACTIVITY_HEADERS = ACTIVITY_COLUMNS.map((c) => c.header);

export const buildActivityTemplate = cachedBuild(async () => {
  const wb = newWorkbook();
  addDataSheet(wb, "Activities", ACTIVITY_COLUMNS);
  addGuideSheet(wb, [
    "Fill the first sheet, one completed activity per row, then upload this file on Activities > Import.",
    "Each row goes into the reporting period that holds its date; a row whose date no period covers is skipped and named.",
  ], ACTIVITY_COLUMNS);
  return toBuffer(wb);
});
