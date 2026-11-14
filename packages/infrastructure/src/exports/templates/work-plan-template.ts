import type { TemplateColumn } from "./template-kit.js";
import { addDataSheet, addGuideSheet, cachedBuild, newWorkbook, toBuffer } from "./template-kit.js";

export const WORK_PLAN_TEMPLATE_FILENAME = "work-plan-template.xlsx";

/** Headers the work-plan import reads (`parseWorkPlanText`); Title and Start are the only ones a row needs. */
export const WORK_PLAN_COLUMNS: ReadonlyArray<TemplateColumn> = [
  { header: "Logframe Code", width: 16, required: false, takes: "Code of the output or activity in this project's logframe; links the planned activity to it", example: "A1.1" },
  { header: "Title", width: 44, required: true, takes: "What will be done", example: "Community outreach visits" },
  { header: "Start", width: 14, required: true, takes: "First day, written YYYY-MM-DD", example: "2026-03-10" },
  { header: "End", width: 14, required: false, takes: "Last day, YYYY-MM-DD; empty means the same day as Start", example: "2026-03-12" },
  { header: "Lead email", width: 28, required: false, takes: "Email of a project member who leads it", example: "amina@example.org" },
  { header: "Location", width: 28, required: false, takes: "Where it happens; separate several places with a semicolon", example: "Ward 4; Ward 5" },
  { header: "Sessions", width: 10, required: false, takes: "How many sessions or visits, a whole number", example: "4" },
  { header: "Repeats", width: 12, required: false, takes: "Whether the activity repeats", example: "Monthly", choices: ["No", "Weekly", "Monthly"] },
];

export const buildWorkPlanTemplate = cachedBuild(async () => {
  const wb = newWorkbook();
  addDataSheet(wb, "Work plan", WORK_PLAN_COLUMNS);
  addGuideSheet(wb, [
    "Fill the first sheet, one planned activity per row, then upload this file on Activities > Import planned activities.",
    "If any row cannot be read, nothing is imported, and the message names the rows to fix. Rows already planned for the same dates are skipped.",
  ], WORK_PLAN_COLUMNS, [
    { "Logframe Code": "A1.1", Title: "Community outreach visits", Start: "2026-03-10", End: "2026-03-12", "Lead email": "amina@example.org", Location: "Ward 4; Ward 5", Sessions: "4", Repeats: "Monthly" },
    { Title: "Mid-term review workshop", Start: "2026-06-15" },
  ]);
  return toBuffer(wb);
});
