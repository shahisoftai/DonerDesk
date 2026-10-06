import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { DefaultExportBuilder } from "../dist/exports/builder.js";

const input = (indicators, over = {}) => ({
  exportType: "EXCEL_INDICATORS", exportIntent: "INTERNAL_REVIEW", watermark: "INTERNAL PREVIEW", projectName: "P", reportingPeriodLabel: "2026-08", reportTitle: "Report",
  sections: [], indicators, activities: [], checklist: [], evidenceItems: [], includeSensitive: false, ...over,
});

async function rows(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet("Indicators");
  const out = [];
  sheet.eachRow((row) => out.push(row.values.slice(1).map((v) => String(v ?? ""))));
  return out;
}

test("a monthly indicator spreadsheet keeps today's columns (golden)", async () => {
  const { fileBuffer } = await new DefaultExportBuilder().build(input([{ code: "IND1", name: "People with safe water", baseline: "0", target: "14000", achievement: "2800", unit: "people", status: "VERIFIED" }]));
  const [header, row] = await rows(fileBuffer);
  assert.deepEqual(header, ["Code", "Indicator", "Baseline", "Target", "Achievement", "Unit", "Status"]);
  assert.deepEqual(row, ["IND1", "People with safe water", "0", "14000", "2800", "people", "VERIFIED"]);
});

test("a final report's spreadsheet shows 14,000 (life of project) beside 2,800 (August) and the % of target", async () => {
  const { fileBuffer } = await new DefaultExportBuilder().build(
    input([{ code: "IND1", name: "People with safe water", baseline: "0", target: "14000", achievement: "14000", unit: "people", status: "VERIFIED", periodValue: "2800", lifeOfProjectValue: "14000", percentOfTarget: "100%" }]),
  );
  const [header, row] = await rows(fileBuffer);
  assert.deepEqual(header, ["Code", "Indicator", "Baseline", "Target", "This period", "Life of project to date", "% of target", "Unit", "Status"]);
  assert.deepEqual(row, ["IND1", "People with safe water", "0", "14000", "2800", "14000", "100%", "people", "VERIFIED"]);
});
