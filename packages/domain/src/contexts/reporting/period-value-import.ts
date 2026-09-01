/**
 * Increment 5 — Excel/CSV → structured indicator period values.
 *
 * This is a pure parsing/mapping layer: it takes raw spreadsheet rows and
 * produces a preview of structured period values (indicator code + achievement)
 * plus clear "could not map" flags. It does NOT persist anything and does NOT
 * invent values. It feeds the existing IndicatorUpdate model.
 */

export interface PeriodValueRow {
  rowIndex: number;
  indicatorCode: string;
  periodAchievement?: string;
  cumulativeAchievement?: string;
  valid: boolean;
  /** Plain-language reason a row could not be mapped (code/number problems). */
  error?: string;
}

export interface PeriodValueImportResult {
  columns: { code?: string; achievement?: string; cumulative?: string };
  rows: PeriodValueRow[];
  /** Rows that could not be mapped (unknown/missing code or non-numeric value). */
  unmappedCount: number;
}

const CODE_COL_RE = /(indicator|code|id)/i;
const ACHIEVEMENT_COL_RE = /(achiev|period value|result|actual|progress)/i;
const CUMULATIVE_COL_RE = /(cumul|to date|ytd|year to date)/i;

function isNumeric(value: string | undefined): boolean {
  if (value === undefined) return false;
  const t = value.trim();
  if (!t) return false;
  return /^-?\d[\d,.]*$/.test(t) && Number.isFinite(Number(t.replace(/,/g, "")));
}

/**
 * Detects the code/achievement/cumulative columns from a header row (first row
 * with text), and maps each data row to an indicator code + achievement.
 * Rows that cannot be mapped are flagged, never silently dropped or guessed.
 */
export function parsePeriodValueRows(rows: string[][]): PeriodValueImportResult {
  // Only a row containing a known column label is a header. A data row like
  // ["OUT-1", "30"] is NOT (so a headerless file starts at row 0).
  const headerIndex = rows.findIndex((r) =>
    r.some((c) => {
      const v = typeof c === "string" ? c.trim() : "";
      return CODE_COL_RE.test(v) || ACHIEVEMENT_COL_RE.test(v) || CUMULATIVE_COL_RE.test(v);
    }),
  );

  let codeIdx = 0;
  let achievementIdx = 1;
  let cumulativeIdx = -1;
  const columns: PeriodValueImportResult["columns"] = {};

  if (headerIndex >= 0) {
    const header = (rows[headerIndex] ?? []).map((c) => (typeof c === "string" ? c.trim() : ""));
    const foundCode = header.findIndex((h) => CODE_COL_RE.test(h));
    const foundAch = header.findIndex((h) => ACHIEVEMENT_COL_RE.test(h));
    const foundCum = header.findIndex((h) => CUMULATIVE_COL_RE.test(h));
    if (foundCode >= 0) { codeIdx = foundCode; columns.code = header[foundCode]; }
    if (foundAch >= 0) { achievementIdx = foundAch; columns.achievement = header[foundAch]; }
    if (foundCum >= 0) { cumulativeIdx = foundCum; columns.cumulative = header[foundCum]; }
  }

  const out: PeriodValueRow[] = [];
  let unmappedCount = 0;
  const start = headerIndex >= 0 ? headerIndex + 1 : 0;

  for (let i = start; i < rows.length; i++) {
    const raw = rows[i] ?? [];
    const cell = (idx: number) => (idx >= 0 ? (raw[idx] !== undefined ? String(raw[idx]).trim() : undefined) : undefined);
    const code = cell(codeIdx) ?? "";
    const achievement = cell(achievementIdx);
    const cumulative = cumulativeIdx >= 0 ? cell(cumulativeIdx) : undefined;

    if (!code && !achievement && !cumulative) continue;

    const row: PeriodValueRow = { rowIndex: i + 1, indicatorCode: code, periodAchievement: achievement, cumulativeAchievement: cumulative, valid: true };
    if (!code) {
      row.valid = false;
      row.error = "No indicator code found in this row.";
    } else if (achievement && !isNumeric(achievement)) {
      row.valid = false;
      row.error = `"${achievement}" is not a number.`;
    } else if (cumulative !== undefined && cumulative !== "" && !isNumeric(cumulative)) {
      row.valid = false;
      row.error = `"${cumulative}" is not a number (cumulative).`;
    }
    if (!row.valid) unmappedCount++;
    out.push(row);
  }

  return { columns, rows: out, unmappedCount };
}
