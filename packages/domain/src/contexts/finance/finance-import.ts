import type { FinanceLine } from "./period-financial-summary.js";
import { parseMoney } from "./period-financial-summary.js";

/**
 * Spreadsheet rows (pasted CSV/TSV, already split into cells) → budget lines.
 * A pure mapping layer in the spirit of the indicator-value import: it reports
 * rows it cannot map instead of guessing, and persists nothing.
 */
export interface FinanceImportRow {
  rowIndex: number;
  line?: FinanceLine;
  /** Plain-language reason the row was not mapped. */
  error?: string;
}

export interface FinanceImportResult {
  rows: FinanceImportRow[];
  readyCount: number;
  errorCount: number;
}

const LINE_COL_RE = /(budget\s*line|line|category|item|description|name|activity)/i;
const BUDGET_COL_RE = /(budget|approved|plan|allocat)/i;
const SPENT_COL_RE = /(expend|spen[dt]|actual|cost)/i;
const COMMITTED_COL_RE = /(commit|encumb|obligat)/i;

const cell = (r: ReadonlyArray<string>, i: number): string => (i >= 0 && typeof r[i] === "string" ? r[i]!.trim() : "");

/** Column roles from a header row; a headerless file is read as: line, budget, expenditure, committed. */
function columnIndexes(rows: ReadonlyArray<ReadonlyArray<string>>): { start: number; line: number; budget: number; spent: number; committed: number } {
  const headerAt = rows.findIndex((r) => r.some((c) => BUDGET_COL_RE.test(c) || SPENT_COL_RE.test(c) || COMMITTED_COL_RE.test(c)));
  if (headerAt < 0) return { start: 0, line: 0, budget: 1, spent: 2, committed: 3 };
  const header = rows[headerAt]!.map((c) => (typeof c === "string" ? c.trim() : ""));
  // Most specific roles first: "Committed budget" is not the budget column and "Budget line" is not the amount.
  const committed = header.findIndex((h) => COMMITTED_COL_RE.test(h));
  const spent = header.findIndex((h, i) => i !== committed && SPENT_COL_RE.test(h));
  const line = header.findIndex((h, i) => i !== committed && i !== spent && LINE_COL_RE.test(h));
  const budget = header.findIndex((h, i) => i !== committed && i !== spent && i !== line && BUDGET_COL_RE.test(h));
  return { start: headerAt + 1, line: line >= 0 ? line : 0, budget, spent, committed };
}

export function parseFinanceRows(rows: ReadonlyArray<ReadonlyArray<string>>): FinanceImportResult {
  const cols = columnIndexes(rows);
  const out: FinanceImportRow[] = [];
  const seen = new Set<string>();
  for (let i = cols.start; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (r.every((c) => !String(c ?? "").trim())) continue;
    const name = cell(r, cols.line);
    const rowIndex = i + 1;
    if (!name) { out.push({ rowIndex, error: "Missing budget line name" }); continue; }
    const key = name.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) { out.push({ rowIndex, error: `"${name}" appears more than once` }); continue; }
    const budget = parseMoney(cell(r, cols.budget));
    const spent = parseMoney(cell(r, cols.spent));
    if (budget === null) { out.push({ rowIndex, error: `Budget of "${name}" is not a valid amount` }); continue; }
    if (spent === null) { out.push({ rowIndex, error: `Expenditure of "${name}" is not a valid amount` }); continue; }
    const committedText = cell(r, cols.committed);
    if (committedText && parseMoney(committedText) === null) { out.push({ rowIndex, error: `Committed amount of "${name}" is not valid` }); continue; }
    seen.add(key);
    out.push({ rowIndex, line: { budgetLine: name, budget: cell(r, cols.budget), expenditure: cell(r, cols.spent), ...(committedText ? { committed: committedText } : {}) } });
  }
  const readyCount = out.filter((x) => x.line).length;
  return { rows: out, readyCount, errorCount: out.length - readyCount };
}
