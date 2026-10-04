/**
 * How a project's reports get their financial figures (set on the reporting
 * profile). DISABLED is the default: no finance inputs, the financial section
 * says figures are reported separately. TYPED: entered per period. IMPORT:
 * pasted spreadsheet rows, confirmed by the user. Both fill the same summary.
 */
export type FinanceDataMode = "DISABLED" | "TYPED" | "IMPORT";

export const FINANCE_DATA_MODES: readonly FinanceDataMode[] = ["DISABLED", "TYPED", "IMPORT"];

export function isFinanceDataMode(value: unknown): value is FinanceDataMode {
  return typeof value === "string" && (FINANCE_DATA_MODES as readonly string[]).includes(value);
}

/** Unknown or missing values mean DISABLED, so older rows and bad input never switch finance on. */
export function normalizeFinanceDataMode(value: unknown): FinanceDataMode {
  return isFinanceDataMode(value) ? value : "DISABLED";
}

/** Report types whose financial section can carry figures (cadence reports longer than a month). */
export const FINANCE_REPORT_TYPES: ReadonlySet<string> = new Set(["QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "FINAL"]);

/** Whether a period of this type takes finance figures under the given mode. */
export function financeAppliesTo(mode: FinanceDataMode, reportType: string): boolean {
  return mode !== "DISABLED" && FINANCE_REPORT_TYPES.has(reportType);
}
