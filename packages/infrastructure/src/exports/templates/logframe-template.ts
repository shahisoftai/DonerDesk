import { FREQUENCY_CHOICES } from "@donordesk/domain";
import type ExcelJS from "exceljs";
import type { TemplateColumn } from "./template-kit.js";
import { addDataSheet, addGuideSheet, cachedBuild, newWorkbook, toBuffer } from "./template-kit.js";

export const LOGFRAME_TEMPLATE_FILENAME = "logframe-template.xlsx";
export const INDICATORS_TEMPLATE_FILENAME = "indicators-template.xlsx";

/** Headers the logframe import reads (`parseLogframeText`); a row needs a title or a code (the level is read from the code when empty). */
export const LOGFRAME_COLUMNS: ReadonlyArray<TemplateColumn> = [
  { header: "Level", width: 14, required: false, takes: "The result's level; empty reads it from the code", example: "OUTCOME", choices: ["GOAL", "OUTCOME", "OUTPUT", "ACTIVITY"] },
  { header: "Code", width: 12, required: false, takes: "Short code such as G1, O1.1, O1.1.1, A1.1.1.1; nesting follows the code", example: "O1.1" },
  { header: "Title", width: 60, required: true, takes: "The result statement", example: "Households practise safe hygiene" },
  { header: "Description", width: 50, required: false, takes: "Text", example: "" },
];

/** Headers the indicator import reads (`parseIndicatorText`); Code and Name are required. */
export const INDICATOR_COLUMNS: ReadonlyArray<TemplateColumn> = [
  { header: "Code", width: 12, required: true, takes: "The indicator's code", example: "O1.1-IND1" },
  { header: "Name", width: 50, required: true, takes: "What is measured", example: "% of households with a handwashing station" },
  { header: "Type", width: 14, required: false, takes: "How the value is written; empty means NUMBER", example: "PERCENTAGE", choices: ["NUMBER", "PERCENTAGE", "YES_NO", "TEXT", "RATIO", "CURRENCY", "CUSTOM"] },
  { header: "Baseline", width: 12, required: false, takes: "A number; empty when not known (never write 0 for unknown)", example: "35" },
  { header: "Target", width: 12, required: false, takes: "A number", example: "80" },
  { header: "Unit", width: 10, required: false, takes: "Text such as %, people, latrines", example: "%" },
  { header: "Means of Verification", width: 30, required: false, takes: "Text", example: "Household survey" },
  { header: "Data Source", width: 24, required: false, takes: "Text", example: "Baseline and endline survey" },
  { header: "Frequency", width: 16, required: false, takes: "How often it is measured", example: "Per survey", choices: FREQUENCY_CHOICES.map((c) => c.value) },
  { header: "Disaggregation Required", width: 20, required: false, takes: "Whether values must be broken down", example: "Yes", choices: ["Yes", "No"] },
  { header: "Logframe Code", width: 16, required: false, takes: "Code of the result it measures (on the Logframe sheet or already in the project); empty uses the indicator's own code", example: "O1.1" },
];

const LOGFRAME_EXAMPLES = [
  { Level: "GOAL", Code: "G1", Title: "Reduced water-borne disease in the target districts" },
  { Level: "OUTCOME", Code: "O1.1", Title: "Households practise safe hygiene" },
  { Level: "OUTPUT", Code: "O1.1.1", Title: "Caregivers trained in hygiene promotion" },
  { Level: "ACTIVITY", Code: "A1.1.1.1", Title: "Run hygiene promotion sessions" },
];

const addLogframe = (wb: ExcelJS.Workbook) => addDataSheet(wb, "Logframe", LOGFRAME_COLUMNS, 300);
const addIndicators = (wb: ExcelJS.Workbook) => addDataSheet(wb, "Indicators", INDICATOR_COLUMNS, 300);

/** Both sheets, for a whole framework: results first, then their indicators. */
export const buildLogframeTemplate = cachedBuild(async () => {
  const wb = newWorkbook();
  addLogframe(wb);
  addIndicators(wb);
  addGuideSheet(wb, [
    "Logframe sheet: one result per row. Indicators sheet: one indicator per row, linked to a result by Logframe Code.",
    "Upload the file on Logframe > Import (results) and on Logframe > Indicators > Import (indicators); each reads its own sheet.",
  ], [...LOGFRAME_COLUMNS, ...INDICATOR_COLUMNS.map((c) => ({ ...c, header: `Indicators: ${c.header}` }))], [
    { title: "Example rows for the Logframe sheet (this sheet is not imported)", columns: LOGFRAME_COLUMNS, rows: LOGFRAME_EXAMPLES },
    { title: "Example rows for the Indicators sheet", columns: INDICATOR_COLUMNS, rows: [Object.fromEntries(INDICATOR_COLUMNS.map((c) => [c.header, c.example]))] },
  ]);
  return toBuffer(wb);
});

/** The Indicators sheet alone, for adding indicators to a framework that already exists. */
export const buildIndicatorsTemplate = cachedBuild(async () => {
  const wb = newWorkbook();
  addIndicators(wb);
  addGuideSheet(wb, [
    "Fill the first sheet, one indicator per row, then upload it on Logframe > Indicators > Import.",
    "Logframe Code links an indicator to a result that already exists in the project.",
  ], INDICATOR_COLUMNS);
  return toBuffer(wb);
});
