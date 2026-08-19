import ExcelJS from "exceljs";

export const EVIDENCE_TEMPLATE_FILENAME = "evidence-template.xlsx";

export const EVIDENCE_HEADERS = [
  "Title",
  "File Name",
  "Evidence Type",
  "Confidentiality Level",
  "Location",
  "Activity Date",
  "Notes",
  "Drive Web Link",
  "Activity Title",
  "Indicator Code",
] as const;

const EXAMPLE_ROW: Record<string, string> = {
  Title: "Example evidence — replace with the evidence title",
  "File Name": "example-attendance-sheet.xlsx",
  "Evidence Type": "ATTENDANCE_SHEET",
  "Confidentiality Level": "INTERNAL",
  Location: "",
  "Activity Date": new Date().toISOString().slice(0, 10),
  Notes: "Provide the Google Drive share link in the Drive Web Link column; each imported row needs one.",
  "Drive Web Link": "https://drive.google.com/file/d/EXAMPLE/view",
  "Activity Title": "",
  "Indicator Code": "",
};

const EVIDENCE_TYPE_OPTIONS = [
  "ATTENDANCE_SHEET",
  "PHOTO",
  "DISTRIBUTION_LIST",
  "TRAINING_RECORD",
  "FIELD_VISIT_REPORT",
  "MONITORING_REPORT",
  "KOBO_ODK_EXPORT",
  "PROCUREMENT_DOCUMENT",
  "APPROVAL_DOCUMENT",
  "BENEFICIARY_LIST",
  "MEETING_MINUTES",
  "CASE_STUDY",
  "FINANCIAL_DOCUMENT",
  "SUPPLIER_DOCUMENT",
  "DONOR_COMMUNICATION",
  "OTHER",
];

const CONFIDENTIALITY_OPTIONS = ["PUBLIC", "INTERNAL", "SENSITIVE", "HIGHLY_SENSITIVE"];

function styleHeaderRow(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  for (let i = 1; i <= columnCount; i++) {
    header.getCell(i).border = { bottom: { style: "thin", color: { argb: "FFB0B0B0" } } };
  }
}

type ListValidation = {
  type: "list";
  allowBlank: boolean;
  formulae: string[];
  error?: string;
  errorTitle?: string;
  showErrorMessage?: boolean;
};

interface WorksheetWithDataValidations {
  dataValidations: {
    add(address: string, validation: ListValidation): void;
  };
}

/**
 * Builds the download-able evidence workbook. Each imported row creates an
 * evidence record from metadata; a Google Drive share link in the Drive Web
 * Link column is required per row (link-first storage — no byte upload). The
 * workbook is static content, so the buffer is built once and reused for every
 * download.
 */
export async function buildEvidenceTemplate(): Promise<Buffer> {
  if (cachedEvidenceTemplate) return cachedEvidenceTemplate;
  cachedEvidenceTemplate = await renderEvidenceTemplate();
  return cachedEvidenceTemplate;
}

let cachedEvidenceTemplate: Buffer | null = null;

async function renderEvidenceTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DonorDesk";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Evidence");
  sheet.columns = EVIDENCE_HEADERS.map((header) => ({ header, key: header, width: 30 }));
  styleHeaderRow(sheet, EVIDENCE_HEADERS.length);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "J1" };
  sheet.addRow(EXAMPLE_ROW);

  const dv = (sheet as unknown as WorksheetWithDataValidations).dataValidations;
  dv.add("C2:C200", {
    type: "list",
    allowBlank: true,
    formulae: [`"${EVIDENCE_TYPE_OPTIONS.join(",")}"`],
    error: "Evidence Type must be one of the listed values.",
    errorTitle: "Invalid evidence type",
    showErrorMessage: true,
  });
  dv.add("D2:D200", {
    type: "list",
    allowBlank: true,
    formulae: [`"${CONFIDENTIALITY_OPTIONS.join(",")}"`],
    error: "Confidentiality Level must be PUBLIC, INTERNAL, SENSITIVE, or HIGHLY_SENSITIVE.",
    errorTitle: "Invalid confidentiality level",
    showErrorMessage: true,
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
