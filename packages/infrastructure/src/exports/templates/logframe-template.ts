import ExcelJS from "exceljs";

export const LOGFRAME_TEMPLATE_FILENAME = "logframe-template.xlsx";

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
 * exceljs 4.4 ships the runtime worksheet.dataValidations collection but its
 * published typings omit it. Cast through a minimal interface so the runtime
 * API is used without weakening type checks for the rest of the template.
 */
function withDataValidations(sheet: ExcelJS.Worksheet): WorksheetWithDataValidations {
  return sheet as unknown as WorksheetWithDataValidations;
}

const LOGFRAME_HEADERS = ["Level", "Code", "Title", "Description"] as const;
const INDICATOR_HEADERS = [
  "Code",
  "Name",
  "Type",
  "Baseline",
  "Target",
  "Unit",
  "Means of Verification",
  "Data Source",
  "Frequency",
  "Disaggregation Required",
] as const;

const EXAMPLE_ROWS: Array<{ level: string; code: string; title: string; description?: string }> = [
  { level: "GOAL", code: "G1", title: "Example goal — replace this with your project goal statement", description: "The long-term development goal the project contributes to." },
  { level: "OUTCOME", code: "O1.1", title: "Example outcome — replace this with your outcome statement", description: "The change expected at outcome level during the project." },
  { level: "OUTPUT", code: "O1.1.1", title: "Example output — replace this with your output statement", description: "A concrete deliverable that contributes to the outcome." },
  { level: "ACTIVITY", code: "A1.1.1.1", title: "Example activity — replace this with your activity statement", description: "The action undertaken to produce the output." },
];

const EXAMPLE_INDICATORS: Array<{
  code: string;
  name: string;
  type: string;
  baseline: string;
  target: string;
  unit?: string;
  disaggregationRequired?: string;
}> = [
  { code: "O1.1", name: "Example indicator for the outcome above — replace with your indicator", type: "PERCENTAGE", baseline: "0", target: "80", unit: "%", disaggregationRequired: "Yes" },
];

function styleHeaderRow(sheet: ExcelJS.Worksheet, columnCount: number): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E79" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  for (let i = 1; i <= columnCount; i++) {
    const cell = header.getCell(i);
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
    };
  }
}

/**
 * Builds the download-able logframe workbook. Two sheets — Logframe and
 * Indicators — whose header rows use the exact vocabulary understood by the
 * logframe and indicator import parsers (Level/Code/Title/Description and
 * Code/Name/Type/Baseline/Target/...). Example rows demonstrate the format;
 * users replace them before uploading. The workbook is static content, so the
 * buffer is built once and reused for every download.
 */
export async function buildLogframeTemplate(): Promise<Buffer> {
  if (cachedLogframeTemplate) return cachedLogframeTemplate;
  cachedLogframeTemplate = await renderLogframeTemplate();
  return cachedLogframeTemplate;
}

let cachedLogframeTemplate: Buffer | null = null;

async function renderLogframeTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DonorDesk";
  wb.created = new Date();

  const logframeSheet = wb.addWorksheet("Logframe");
  logframeSheet.columns = [
    { header: LOGFRAME_HEADERS[0], key: "level", width: 16 },
    { header: LOGFRAME_HEADERS[1], key: "code", width: 14 },
    { header: LOGFRAME_HEADERS[2], key: "title", width: 60 },
    { header: LOGFRAME_HEADERS[3], key: "description", width: 50 },
  ];
  styleHeaderRow(logframeSheet, LOGFRAME_HEADERS.length);
  logframeSheet.views = [{ state: "frozen", ySplit: 1 }];
  logframeSheet.autoFilter = { from: "A1", to: "D1" };
  for (const row of EXAMPLE_ROWS) {
    logframeSheet.addRow({ level: row.level, code: row.code, title: row.title, description: row.description ?? "" });
  }
  withDataValidations(logframeSheet).dataValidations.add("A2:A200", {
    type: "list",
    allowBlank: true,
    formulae: ['"GOAL,OUTCOME,OUTPUT,ACTIVITY"'],
    error: "Level must be one of GOAL, OUTCOME, OUTPUT, ACTIVITY.",
    errorTitle: "Invalid level",
    showErrorMessage: true,
  });

  const indicatorSheet = wb.addWorksheet("Indicators");
  indicatorSheet.columns = [
    { header: INDICATOR_HEADERS[0], key: "code", width: 14 },
    { header: INDICATOR_HEADERS[1], key: "name", width: 50 },
    { header: INDICATOR_HEADERS[2], key: "type", width: 14 },
    { header: INDICATOR_HEADERS[3], key: "baseline", width: 12 },
    { header: INDICATOR_HEADERS[4], key: "target", width: 12 },
    { header: INDICATOR_HEADERS[5], key: "unit", width: 10 },
    { header: INDICATOR_HEADERS[6], key: "meansOfVerification", width: 30 },
    { header: INDICATOR_HEADERS[7], key: "dataSource", width: 25 },
    { header: INDICATOR_HEADERS[8], key: "frequency", width: 14 },
    { header: INDICATOR_HEADERS[9], key: "disaggregationRequired", width: 22 },
  ];
  styleHeaderRow(indicatorSheet, INDICATOR_HEADERS.length);
  indicatorSheet.views = [{ state: "frozen", ySplit: 1 }];
  indicatorSheet.autoFilter = { from: "A1", to: "J1" };
  for (const row of EXAMPLE_INDICATORS) {
    indicatorSheet.addRow({
      code: row.code,
      name: row.name,
      type: row.type,
      baseline: row.baseline,
      target: row.target,
      unit: row.unit ?? "",
      meansOfVerification: "",
      dataSource: "",
      frequency: "",
      disaggregationRequired: row.disaggregationRequired ?? "No",
    });
  }
  withDataValidations(indicatorSheet).dataValidations.add("C2:C200", {
    type: "list",
    allowBlank: true,
    formulae: ['"NUMBER,PERCENTAGE,YES_NO,TEXT,RATIO,CURRENCY,CUSTOM"'],
    error: "Type must be one of NUMBER, PERCENTAGE, YES_NO, TEXT, RATIO, CURRENCY, CUSTOM.",
    errorTitle: "Invalid indicator type",
    showErrorMessage: true,
  });
  withDataValidations(indicatorSheet).dataValidations.add("J2:J200", {
    type: "list",
    allowBlank: true,
    formulae: ['"Yes,No"'],
    error: "Disaggregation Required must be Yes or No.",
    errorTitle: "Invalid value",
    showErrorMessage: true,
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
