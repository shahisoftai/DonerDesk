import { dataSheetText } from "@donordesk/domain/core/delimited.js";

/** Whether a chosen file is a spreadsheet workbook (read by the API) rather than delimited text (read in the browser). */
export function isWorkbook(file: { name: string; type?: string }): boolean {
  return /\.xlsx?$/i.test(file.name) || /spreadsheetml|ms-excel/.test(file.type ?? "");
}

/** The rows of a one-sheet import read from a workbook: no sheet marker and no instructions sheet, so the box shows only the data. */
export const workbookRows = (text: string): string => dataSheetText(text).replace(/\n+$/, "");
