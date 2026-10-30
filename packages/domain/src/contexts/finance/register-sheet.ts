/**
 * Importing the register from a spreadsheet (Phase 35.F, layer 3). One sheet carries expenses and money received. Every row is checked with the
 * same entry checks as a typed one; any bad row blocks the whole import, and the problems come back as the person's own sheet with a "Problems"
 * column, only the rows to fix. Rows land as DRAFT, to be approved like any other entry. Pure: text in, text out.
 */
import { normalizeHeader, splitDelimited } from "../../core/delimited.js";
import { checkDisbursement, checkRegisterExpense } from "./entry-checks.js";
import type { Amount } from "./money.js";

export const SHEET_COLUMNS = ["Type", "Date", "Amount", "Currency", "Paid to", "What for", "Budget line", "Funding source"] as const;
export const FINANCE_PROBLEMS_COLUMN = "Problems";
const TYPE_EXPENSE = "Expense";
const TYPE_RECEIVED = "Money received";

const csvCell = (v: string): string => (/[",;\t\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csvLine = (cells: ReadonlyArray<string>): string => cells.map(csvCell).join(",");

export function registerSheetTemplate(): string {
  return [
    csvLine(SHEET_COLUMNS),
    csvLine([`${TYPE_EXPENSE} or ${TYPE_RECEIVED}`, "YYYY-MM-DD", "a number", "optional", "who was paid (expenses)", "optional", "code of the budget line (expenses)", "name of the funding source (money received; optional for expenses)"]),
  ].join("\n") + "\n";
}

export interface SheetContext {
  /** Budget lines of the project by code (case-insensitive). */
  lines: ReadonlyMap<string, { id: string; currency: string }>;
  /** Funding sources by name (case-insensitive). */
  sources: ReadonlyMap<string, string>;
  /** Used when a money-received row has no currency. */
  primaryCurrency: string;
}

export type SheetEntry =
  | { kind: "EXPENSE"; budgetLineId: string; date: string; amount: Amount; vendor: string; memo: string; fundingSourceId?: string }
  | { kind: "DISBURSEMENT"; fundingSourceId: string; date: string; amount: Amount; memo: string };

export interface SheetRow { rowNumber: number; cells: string[]; entry: SheetEntry | null; problems: string[] }

export interface SheetResult {
  header: string[];
  /** Columns that match nothing we read: reported, never silently dropped. */
  unknownColumns: string[];
  /** Columns the sheet must have and does not. */
  missingColumns: string[];
  rows: SheetRow[];
  valid: number;
  invalid: number;
}

function delimiterOf(line: string): string {
  if (line.includes("\t")) return "\t";
  return (line.match(/;/g)?.length ?? 0) > (line.match(/,/g)?.length ?? 0) ? ";" : ",";
}

const REQUIRED = ["Type", "Date", "Amount"] as const;

export function parseRegisterSheet(text: string, ctx: SheetContext): SheetResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const first = lines.findIndex((l) => l.trim() !== "");
  const empty: SheetResult = { header: [], unknownColumns: [], missingColumns: [], rows: [], valid: 0, invalid: 0 };
  if (first < 0) return empty;
  const delimiter = delimiterOf(lines[first]!);
  const header = splitDelimited(lines[first]!, delimiter);
  const col = new Map<string, number>();
  header.forEach((h, i) => { const hit = SHEET_COLUMNS.find((c) => normalizeHeader(c) === normalizeHeader(h)); if (hit && !col.has(hit)) col.set(hit, i); });
  const unknownColumns = header.filter((h) => h.trim() !== "" && normalizeHeader(h) !== normalizeHeader(FINANCE_PROBLEMS_COLUMN) && !SHEET_COLUMNS.some((c) => normalizeHeader(c) === normalizeHeader(h)));
  const missingColumns = REQUIRED.filter((c) => !col.has(c));
  const get = (cells: string[], name: (typeof SHEET_COLUMNS)[number]): string => (col.has(name) ? (cells[col.get(name)!] ?? "").trim() : "");

  const rows: SheetRow[] = [];
  let skippedHint = false;
  for (let i = first + 1; i < lines.length; i += 1) {
    if (lines[i]!.trim() === "") continue;
    const cells = splitDelimited(lines[i]!, delimiter);
    const rowNumber = i - first + 1;
    if (!skippedHint && rows.length === 0 && /^YYYY-MM-DD$/i.test(get(cells, "Date")) ) { skippedHint = true; continue; }
    if (missingColumns.length > 0) { rows.push({ rowNumber, cells, entry: null, problems: [`The sheet has no column for ${missingColumns.join(", ")}.`] }); continue; }
    const type = get(cells, "Type").toLowerCase();
    const problems: string[] = [];
    let entry: SheetEntry | null = null;
    const isExpense = type === TYPE_EXPENSE.toLowerCase();
    const isReceived = type === TYPE_RECEIVED.toLowerCase() || type === "received";
    if (!isExpense && !isReceived) problems.push(`Type must be "${TYPE_EXPENSE}" or "${TYPE_RECEIVED}".`);
    else if (isExpense) {
      const code = get(cells, "Budget line").toLowerCase();
      const line = ctx.lines.get(code);
      if (!code) problems.push("Say which budget line it is booked against.");
      else if (!line) problems.push(`No budget line has the code "${get(cells, "Budget line")}" in this project.`);
      const sourceName = get(cells, "Funding source");
      const sourceId = sourceName ? ctx.sources.get(sourceName.toLowerCase()) : undefined;
      if (sourceName && !sourceId) problems.push(`No funding source is named "${sourceName}".`);
      if (line) {
        const checked = checkRegisterExpense({ date: get(cells, "Date"), amount: get(cells, "Amount"), ...(get(cells, "Currency") ? { currency: get(cells, "Currency") } : {}), vendor: get(cells, "Paid to"), memo: get(cells, "What for") }, line.currency);
        if (!checked.ok) problems.push(checked.error.message);
        else if (problems.length === 0) entry = { kind: "EXPENSE", budgetLineId: line.id, date: checked.value.date, amount: checked.value.amount, vendor: checked.value.vendor, memo: checked.value.memo, ...(sourceId ? { fundingSourceId: sourceId } : {}) };
      }
    } else {
      const sourceName = get(cells, "Funding source");
      const sourceId = sourceName ? ctx.sources.get(sourceName.toLowerCase()) : undefined;
      if (!sourceName) problems.push("Say which funding source the money came from.");
      else if (!sourceId) problems.push(`No funding source is named "${sourceName}".`);
      const checked = checkDisbursement({ fundingSourceId: sourceId ?? "x", date: get(cells, "Date"), amount: get(cells, "Amount"), currency: get(cells, "Currency") || ctx.primaryCurrency, memo: get(cells, "What for") });
      if (!checked.ok) problems.push(checked.error.message);
      else if (problems.length === 0 && sourceId) entry = { kind: "DISBURSEMENT", fundingSourceId: sourceId, date: checked.value.date, amount: checked.value.amount, memo: checked.value.memo };
    }
    rows.push({ rowNumber, cells, entry: problems.length === 0 ? entry : null, problems });
  }
  const invalid = rows.filter((r) => r.problems.length > 0).length;
  return { header, unknownColumns, missingColumns, rows, valid: rows.length - invalid, invalid };
}

/** The person's own sheet back, only the rows to fix, with a Problems column. */
export function registerSheetErrorFile(result: SheetResult): string {
  const header = [...result.header.filter((h) => normalizeHeader(h) !== normalizeHeader(FINANCE_PROBLEMS_COLUMN)), FINANCE_PROBLEMS_COLUMN];
  const body = result.rows.filter((r) => r.problems.length > 0).map((r) => csvLine([...r.cells.slice(0, header.length - 1), ...Array(Math.max(0, header.length - 1 - r.cells.length)).fill(""), r.problems.join(" ")]));
  return [csvLine(header), ...body].join("\n") + "\n";
}
