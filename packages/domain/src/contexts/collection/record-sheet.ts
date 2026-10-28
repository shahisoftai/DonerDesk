/**
 * Importing collected records from a spreadsheet (Phase 33.5). The sheet's columns are the form's questions, named by their labels, so
 * the downloadable template is always the form's own. Every row is checked with the same rules as a typed submission; any bad row
 * blocks the whole import, and the problems come back as a file: the person's own sheet with a "Problems" column, only the rows
 * that need fixing. Pure: text in, text out.
 */
import { normalizeHeader, splitDelimited } from "../../core/delimited.js";
import { validateSubmission, type FormDefinition, type FormField } from "./form-rules.js";

export const PROBLEMS_COLUMN = "Problems";

const csvCell = (value: string): string => (/[",;\t\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csvLine = (cells: ReadonlyArray<string>): string => cells.map(csvCell).join(",");

/** The header row for a blank sheet, plus a hint row saying what each column takes. */
export function recordSheetTemplate(form: FormDefinition): string {
  const hint = (f: FormField): string => {
    switch (f.type) {
      case "NUMBER": return "a number";
      case "DATE": return "YYYY-MM-DD";
      case "YES_NO": return "yes or no";
      case "GPS": return "latitude, longitude";
      case "SELECT": return (f.options ?? []).map((o) => o.label).join(" / ");
      default: return "text";
    }
  };
  return [csvLine(form.fields.map((f) => f.label)), csvLine(form.fields.map((f) => `${hint(f)}${f.required ? "" : " (optional)"}`))].join("\n") + "\n";
}

export interface RecordSheetRow {
  /** The row's number in the sheet, counting the header as row 1. */
  rowNumber: number;
  cells: string[];
  /** The answers to store, in the form's own shape; empty when the row has problems. */
  answers: Record<string, string | number | boolean | { lat: number; lon: number }>;
  problems: string[];
  /** Questions answered but not asked for the other answers; they are not stored. */
  ignored: string[];
}

export interface RecordSheetResult {
  header: string[];
  /** Columns that match no question of the form: they are reported, never silently dropped. */
  unknownColumns: string[];
  /** Required questions the sheet has no column for. */
  missingColumns: string[];
  rows: RecordSheetRow[];
  valid: number;
  invalid: number;
}

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes("\t")) return "\t";
  return (headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0) ? ";" : ",";
}

function cellValue(field: FormField, text: string): unknown {
  const t = text.trim();
  if (t === "") return undefined;
  if (field.type === "SELECT") {
    const hit = (field.options ?? []).find((o) => o.label.toLowerCase() === t.toLowerCase() || o.value.toLowerCase() === t.toLowerCase());
    return hit ? hit.value : t;
  }
  if (field.type === "GPS") {
    const parts = t.split(/[,\s/]+/).filter(Boolean);
    return parts.length === 2 ? { lat: parts[0], lon: parts[1] } : t;
  }
  return t;
}

/** Reads a pasted or uploaded sheet against a form. A hint row that repeats the template's wording is skipped. */
export function parseRecordSheet(form: FormDefinition, text: string): RecordSheetResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const first = lines.findIndex((l) => l.trim() !== "");
  if (first < 0) return { header: [], unknownColumns: [], missingColumns: [], rows: [], valid: 0, invalid: 0 };
  const delimiter = detectDelimiter(lines[first]!);
  const header = splitDelimited(lines[first]!, delimiter);
  const byColumn = new Map<number, FormField>();
  const used = new Set<string>();
  header.forEach((h, i) => {
    const hit = form.fields.find((f) => !used.has(f.key) && normalizeHeader(f.label) === normalizeHeader(h));
    if (hit) { byColumn.set(i, hit); used.add(hit.key); }
  });
  const unknownColumns = header.filter((h, i) => h.trim() !== "" && !byColumn.has(i) && normalizeHeader(h) !== normalizeHeader(PROBLEMS_COLUMN));
  const missingColumns = form.fields.filter((f) => f.required === true && !used.has(f.key)).map((f) => f.label);

  const rows: RecordSheetRow[] = [];
  const templateHint = (cells: string[]) => cells.some((c) => /\((optional)\)$|^YYYY-MM-DD$|^a number$|^yes or no$/i.test(c.trim()));
  let skippedHint = false;
  for (let i = first + 1; i < lines.length; i += 1) {
    if (lines[i]!.trim() === "") continue;
    const cells = splitDelimited(lines[i]!, delimiter);
    if (!skippedHint && rows.length === 0 && templateHint(cells)) { skippedHint = true; continue; }
    const answers: Record<string, unknown> = {};
    byColumn.forEach((field, col) => {
      const v = cellValue(field, cells[col] ?? "");
      if (v !== undefined) answers[field.key] = v;
    });
    if (missingColumns.length > 0) {
      rows.push({ rowNumber: i - first + 1, cells, answers: {}, problems: [`The sheet has no column for ${missingColumns.join(", ")}.`], ignored: [] });
      continue;
    }
    const checked = validateSubmission(form, answers);
    rows.push({
      rowNumber: i - first + 1, cells, answers: checked.problems.length === 0 ? checked.values : {},
      problems: checked.problems.map((p) => p.message), ignored: checked.ignored.map((k) => form.fields.find((f) => f.key === k)?.label ?? k),
    });
  }
  const invalid = rows.filter((r) => r.problems.length > 0).length;
  return { header, unknownColumns, missingColumns, rows, valid: rows.length - invalid, invalid };
}

/** The person's own sheet back: the same columns, only the rows that need fixing, with what is wrong in a final column. */
export function recordSheetErrorFile(result: RecordSheetResult): string {
  const header = result.header.filter((h) => normalizeHeader(h) !== normalizeHeader(PROBLEMS_COLUMN));
  const lines = [csvLine([...header, PROBLEMS_COLUMN])];
  for (const row of result.rows) {
    if (row.problems.length === 0) continue;
    lines.push(csvLine([...header.map((_, i) => row.cells[i] ?? ""), row.problems.join(" ")]));
  }
  return lines.join("\n") + "\n";
}
