/**
 * The data sheet as HXL-tagged CSV (Phase 60.7): the same rows as the workbook, with one row of Humanitarian Exchange Language hashtags
 * between the headers and the data, so the file can be published on the Humanitarian Data Exchange or read by an HXL-aware tool as it
 * is. The tag of each column is a row of `HXL_TAGS`, keyed by the sheet's own header, so a header added to the sheet without a tag
 * does not compile. Nothing is rewritten: a gap stays an empty cell, never 0.
 */
import { INDICATOR_SHEET_HEADERS, indicatorSheetRows, toCsv, type DataSheet } from "./data-sheet.js";

type SheetHeader = (typeof INDICATOR_SHEET_HEADERS)[number];

export const HXL_TAGS: Readonly<Record<SheetHeader, string>> = {
  "Indicator code": "#indicator+code",
  Indicator: "#indicator+name",
  Level: "#meta+level",
  Type: "#meta+type",
  Unit: "#meta+unit",
  Baseline: "#value+baseline",
  Target: "#value+target",
  Period: "#date+label",
  "Period start": "#date+start",
  "Period end": "#date+end",
  "Period value": "#value+period",
  "Cumulative value": "#value+cumulative",
  "% of target": "#value+percent_of_target",
  Status: "#status",
  "Data source": "#meta+source",
  Comments: "#meta+comments",
};

/** Header row, hashtag row, then the data. */
export function hxlSheetTable(sheet: DataSheet): string[][] {
  return [[...INDICATOR_SHEET_HEADERS], INDICATOR_SHEET_HEADERS.map((h) => HXL_TAGS[h]), ...indicatorSheetRows(sheet)];
}

export const hxlSheetCsv = (sheet: DataSheet): string => toCsv(hxlSheetTable(sheet));
