/** Limits (§7). A file over any of them is refused with a sentence, never cut silently. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ROWS = 200_000;
export const MAX_COLUMNS = 200;
export const MAX_VERSIONS_KEPT = 10;
export const MAX_DATASET_NAME = 120;
export const MAX_COLUMN_LABEL = 120;
export const PREVIEW_ROWS = 20;
export const SAMPLE_VALUES = 5;
/** Rows named in one finding before "and N more". */
export const MAX_ROWS_NAMED = 5;
/** Findings kept per check (the problems sheet still marks every row). */
export const MAX_FINDINGS_PER_CHECK = 50;

export function limitProblem(rows: number, columns: number, bytes?: number): string | undefined {
  if (bytes !== undefined && bytes > MAX_FILE_BYTES) return `The file is ${(bytes / 1048576).toFixed(1)} MB; the most a dataset takes is ${MAX_FILE_BYTES / 1048576} MB.`;
  if (columns > MAX_COLUMNS) return `The table has ${columns} columns; the most a dataset takes is ${MAX_COLUMNS}. Leave out the columns you do not need and upload again.`;
  if (rows > MAX_ROWS) return `The table has ${rows.toLocaleString("en")} rows; the most a dataset takes is ${MAX_ROWS.toLocaleString("en")}. Split it by year and add each as its own upload.`;
  if (columns === 0) return "The table has no columns. Check that the first row holds the headers.";
  return undefined;
}
