import type { CellValue } from "../model.js";
import type { StepDef } from "./types.js";
import { missing, str, strs } from "./types.js";

/** Months as columns ("January … July") become rows of Month and Value; the other columns repeat on each new row. */
export const UNPIVOT: StepDef = {
  type: "UNPIVOT", label: "Turn columns into rows", phase: "TABLE",
  validate: (p, headers) => {
    const cols = strs(p.columns);
    if (cols.length < 2) return "Choose at least two columns to turn into rows.";
    const name = str(p.nameColumn).trim(), value = str(p.valueColumn).trim();
    if (!name || !value || name === value) return "Give the two new columns different names.";
    return missing(headers, cols) ?? (headers.some((h) => !cols.includes(h) && (h === name || h === value)) ? "A new column name is already used." : undefined);
  },
  apply: (t, p) => {
    const cols = new Set(strs(p.columns));
    const keep = t.headers.map((h, i) => (cols.has(h) ? -1 : i)).filter((i) => i >= 0);
    const turn = t.headers.map((h, i) => (cols.has(h) ? i : -1)).filter((i) => i >= 0);
    const rows: CellValue[][] = [];
    for (const r of t.rows) for (const i of turn) rows.push([...keep.map((k) => r[k] ?? null), t.headers[i]!, r[i] ?? null]);
    return { ok: true, table: { headers: [...keep.map((k) => t.headers[k]!), str(p.nameColumn).trim(), str(p.valueColumn).trim()], rows } };
  },
  describe: (p) => {
    const c = strs(p.columns);
    return `Turn the ${c.length > 3 ? `${c[0]}…${c[c.length - 1]}` : c.join(", ")} columns into rows of ${str(p.nameColumn)} and ${str(p.valueColumn)}`;
  },
};
