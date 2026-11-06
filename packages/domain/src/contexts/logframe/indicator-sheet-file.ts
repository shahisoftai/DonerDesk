/**
 * The indicator entry sheet as a file (Phase 34.2): what the downloaded workbook holds and how an uploaded one, or a Google Sheet, is
 * read back. One header rule for both ways in, so a column that is understood in one is understood in the other. Pure: no file
 * library here; the workbook itself is built and read in infrastructure.
 */

/** The columns of the downloaded file, in order. The last two are read back by the importer but not meant to be edited. */
export const ENTRY_FILE_HEADERS = ["Code", "Indicator", "Baseline", "Target", "Last period", "Period achievement", "Cumulative", "Comments", "Data source", "Indicator id", "Locked"] as const;

export interface EntryFileItem {
  id: string;
  code: string;
  name: string;
  baseline: string;
  target: string;
  previousCumulative: string;
  periodAchievement: string;
  cumulativeAchievement: string;
  comments: string;
  dataSource: string;
  /** Verified or calculated: the row is in the file for reference and an import never changes it. */
  locked: boolean;
}

/** The rows of the file (header first). A locked row says so in the last column. */
export function entryFileRows(items: ReadonlyArray<EntryFileItem>): string[][] {
  return [
    [...ENTRY_FILE_HEADERS],
    ...items.map((i) => [i.code, i.name, i.baseline, i.target, i.previousCumulative, i.periodAchievement, i.cumulativeAchievement, i.comments, i.dataSource, i.id, i.locked ? "yes" : ""]),
  ];
}

export interface ParsedIndicatorSheetRow {
  indicatorId: string | null;
  code: string;
  name: string | null;
  periodAchievement: string;
  cumulativeAchievement: string;
  comments: string;
  dataSource: string;
  matched: boolean;
  /** The row is locked (verified or calculated): shown in the preview, never applied. */
  locked: boolean;
}

const normalise = (header: string): string => header.toLowerCase().replace(/[^a-z0-9]+/g, "");

function findColumn(headers: ReadonlyArray<string>, candidates: ReadonlyArray<string>): number {
  const normalised = headers.map(normalise);
  const wanted = candidates.map(normalise);
  return normalised.findIndex((h) => wanted.includes(h));
}

export interface SheetIndicatorFacts { id: string; code: string; name: string }

/**
 * Reads a table (a header row and data rows) into indicator values. A row is matched by the indicator id when the file carries one
 * (a renamed code still matches), else by code, ignoring case. A row that matches nothing is kept and named, never dropped, and is
 * never applied. A locked row (the file's own "Locked" column) is shown but never applied.
 */
export function parseIndicatorSheetTable(headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string>>, indicators: ReadonlyArray<SheetIndicatorFacts>): { rows: ParsedIndicatorSheetRow[]; warnings: string[] } {
  const codeCol = findColumn(headers, ["code", "indicatorcode", "indicator"]);
  const idCol = findColumn(headers, ["indicatorid", "id"]);
  const periodCol = findColumn(headers, ["periodachievement", "achievement", "periodvalue", "actual", "value", "period", "thisperiod"]);
  const cumulativeCol = findColumn(headers, ["cumulativeachievement", "cumulative", "cumulativevalue"]);
  const commentsCol = findColumn(headers, ["comments", "notes", "remarks"]);
  const sourceCol = findColumn(headers, ["datasource", "source"]);
  const lockedCol = findColumn(headers, ["locked"]);

  const warnings: string[] = [];
  if (codeCol === -1 && idCol === -1) warnings.push('No indicator-code column found (expected a header such as "Code" or "Indicator code").');
  if (periodCol === -1) warnings.push('No period-achievement column found (expected a header such as "Period achievement" or "Achievement").');

  const byCode = new Map(indicators.map((i) => [i.code.trim().toLowerCase(), i]));
  const byId = new Map(indicators.map((i) => [i.id, i]));
  const cell = (row: ReadonlyArray<string>, col: number): string => (col >= 0 ? (row[col] ?? "").trim() : "");
  const out: ParsedIndicatorSheetRow[] = [];
  for (const row of rows) {
    const rawCode = cell(row, codeCol);
    const rawId = cell(row, idCol);
    if (!rawCode && !rawId) continue;
    const indicator = (rawId ? byId.get(rawId) : undefined) ?? byCode.get(rawCode.toLowerCase());
    const locked = /^(yes|true|1|x)$/i.test(cell(row, lockedCol));
    out.push({
      indicatorId: indicator?.id ?? null,
      code: rawCode || indicator?.code || rawId,
      name: indicator?.name ?? null,
      periodAchievement: cell(row, periodCol),
      cumulativeAchievement: cell(row, cumulativeCol),
      comments: cell(row, commentsCol),
      dataSource: cell(row, sourceCol),
      matched: Boolean(indicator),
      locked,
    });
    if (!indicator) warnings.push(`Indicator code "${rawCode || rawId}" does not exist in this project's logframe.`);
  }
  return { rows: out, warnings };
}
