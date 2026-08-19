import ExcelJS from "exceljs";

export const ACTIVITY_TEMPLATE_FILENAME = "activity-template.xlsx";

export const ACTIVITY_HEADERS = [
  "Activity Title",
  "Activity Date",
  "Location",
  "Output Code",
  "Indicator Code",
  "Participants Total",
  "Participants Male",
  "Participants Female",
  "Participants Children",
  "Participants Disability",
  "Participants Other",
  "Summary",
  "Achievements",
  "Challenges",
  "Lessons Learned",
  "Next Steps",
] as const;

const EXAMPLE_ROW: Record<string, string> = {
  "Activity Title": "Example activity — replace with your activity title",
  "Activity Date": new Date().toISOString().slice(0, 10),
  Location: "",
  "Output Code": "O1.1.1",
  "Indicator Code": "",
  "Participants Total": "0",
  "Participants Male": "",
  "Participants Female": "",
  "Participants Children": "",
  "Participants Disability": "",
  "Participants Other": "",
  Summary: "Example summary of what happened, who participated, and why it matters.",
  Achievements: "",
  Challenges: "",
  "Lessons Learned": "",
  "Next Steps": "",
};

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

/**
 * Builds the download-able activity workbook. The header vocabulary matches
 * what the activity import parser understands (Activity Title, Activity Date,
 * Location, Output Code, Indicator Code, participant counts, and the four
 * narrative fields). One example row demonstrates the format. The workbook is
 * static content, so the buffer is built once and reused for every download.
 */
export async function buildActivityTemplate(): Promise<Buffer> {
  if (cachedActivityTemplate) return cachedActivityTemplate;
  cachedActivityTemplate = await renderActivityTemplate();
  return cachedActivityTemplate;
}

let cachedActivityTemplate: Buffer | null = null;

async function renderActivityTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DonorDesk";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Activities");
  sheet.columns = ACTIVITY_HEADERS.map((header) => ({ header, key: header, width: 28 }));
  styleHeaderRow(sheet, ACTIVITY_HEADERS.length);
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: `P1` };
  sheet.addRow(EXAMPLE_ROW);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
