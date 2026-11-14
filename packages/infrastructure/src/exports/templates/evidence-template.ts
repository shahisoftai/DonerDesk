import { CONFIDENTIALITY_LEVELS, EVIDENCE_TYPES } from "@donordesk/domain";
import type { TemplateColumn } from "./template-kit.js";
import { addDataSheet, addGuideSheet, cachedBuild, newWorkbook, toBuffer } from "./template-kit.js";

export const EVIDENCE_TEMPLATE_FILENAME = "evidence-template.xlsx";

/** Headers the evidence import reads (`parseEvidenceText`). A row becomes a record only with a Google Drive share link (link-first storage). */
export const EVIDENCE_COLUMNS: ReadonlyArray<TemplateColumn> = [
  { header: "Title", width: 32, required: true, takes: "What the file is", example: "Attendance sheet, hygiene session Ward 4" },
  { header: "File Name", width: 28, required: false, takes: "The file's name; empty uses the title", example: "attendance-ward4-2026-03-10.pdf" },
  { header: "Evidence Type", width: 22, required: true, takes: "The kind of evidence", example: "ATTENDANCE_SHEET", choices: EVIDENCE_TYPES },
  { header: "Confidentiality Level", width: 20, required: false, takes: "Who may open it; empty means INTERNAL", example: "INTERNAL", choices: CONFIDENTIALITY_LEVELS },
  { header: "Location", width: 18, required: false, takes: "Where it was collected", example: "Ward 4" },
  { header: "Activity Date", width: 14, required: false, takes: "YYYY-MM-DD", example: "2026-03-10" },
  { header: "Notes", width: 30, required: false, takes: "Text", example: "" },
  { header: "Drive Web Link", width: 40, required: true, takes: "The Google Drive share link of the file; a row without one is not imported", example: "https://drive.google.com/file/d/EXAMPLE/view" },
  { header: "Activity Title", width: 30, required: false, takes: "Title of the completed activity it proves", example: "Hygiene promotion session, Ward 4" },
  { header: "Indicator Code", width: 16, required: false, takes: "Code of the indicator it supports", example: "O1.1" },
];

/** Kept for callers that list the headers. */
export const EVIDENCE_HEADERS = EVIDENCE_COLUMNS.map((c) => c.header);

export const buildEvidenceTemplate = cachedBuild(async () => {
  const wb = newWorkbook();
  addDataSheet(wb, "Evidence", EVIDENCE_COLUMNS);
  addGuideSheet(wb, [
    "Put each file in Google Drive first and copy its share link. Then fill the first sheet, one file per row, and upload it on Evidence > Import.",
  ], EVIDENCE_COLUMNS);
  return toBuffer(wb);
});
