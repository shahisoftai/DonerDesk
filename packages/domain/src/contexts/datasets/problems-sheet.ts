import type { RawTable } from "./model.js";
import type { Finding } from "./checks/types.js";

/**
 * The person's own sheet back with a Problems column (§3.5, the existing import rule): every row a finding names, with its sentences.
 * Only rows with a problem are returned when `onlyProblems`; the cells stay exactly as uploaded. A leading = + - @ is neutralised by
 * the CSV writer (`csvCell`), never here.
 */
export function problemsSheet(table: RawTable, findings: readonly Finding[], firstFileRow: number, onlyProblems = true): RawTable {
  const notes = new Map<number, string[]>();
  for (const f of findings) for (const row of f.rows) notes.set(row, [...(notes.get(row) ?? []), `${f.severity === "BLOCK" ? "Must fix" : "Check"}: ${f.message}`]);
  const rows = table.rows
    .map((r, i) => ({ r, fileRow: firstFileRow + i }))
    .filter(({ fileRow }) => !onlyProblems || notes.has(fileRow))
    .map(({ r, fileRow }) => [...r, (notes.get(fileRow) ?? []).join(" | ") || null]);
  return { headers: [...table.headers, "Problems"], rows };
}
