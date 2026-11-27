/** The shape of a Google Analytics Data API report, and the one way its rows are read. */
export interface GaReport {
  dimensionHeaders?: Array<{ name: string }>;
  metricHeaders?: Array<{ name: string }>;
  rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
}

export interface GaRow {
  dims: Record<string, string>;
  metrics: Record<string, number>;
}

/** Rows by header name, so the code never depends on the order Google happens to answer in. A missing figure is 0 only here, where Google omits an empty row's cell. */
export function gaRows(report: GaReport | undefined): GaRow[] {
  const dimNames = (report?.dimensionHeaders ?? []).map((h) => h.name);
  const metricNames = (report?.metricHeaders ?? []).map((h) => h.name);
  return (report?.rows ?? []).map((row) => ({
    dims: Object.fromEntries(dimNames.map((name, i) => [name, row.dimensionValues?.[i]?.value ?? ""])),
    metrics: Object.fromEntries(metricNames.map((name, i) => [name, Number(row.metricValues?.[i]?.value ?? 0) || 0])),
  }));
}

/** Google writes a day as 20261127. */
export function gaDate(value: string): string {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
}

/** With two date ranges Google adds a `dateRange` dimension: date_range_0 is the first range, date_range_1 the second. */
export const CURRENT = "date_range_0";
export const PREVIOUS = "date_range_1";
