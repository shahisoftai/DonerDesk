import { isBlank } from "../parse-cells.js";
import type { StepDef } from "./types.js";
import { colIndex, missing, str, strs } from "./types.js";

/** "District, Province" at the comma → two columns. A cell with fewer parts leaves the later columns empty; extra parts stay in the last. */
export const SPLIT: StepDef = {
  type: "SPLIT", label: "Split a column", phase: "TABLE",
  validate: (p, headers) => {
    const into = strs(p.into).map((s) => s.trim());
    if (!str(p.separator)) return "Give the character to split at.";
    if (into.length < 2 || into.some((n) => !n) || new Set(into).size !== into.length) return "Name each new column, at least two, all different.";
    return missing(headers, [str(p.column)]) ?? (into.some((n) => headers.includes(n) && n !== str(p.column)) ? "A new column name is already used." : undefined);
  },
  apply: (t, p) => {
    const i = colIndex(t, str(p.column));
    const into = strs(p.into).map((s) => s.trim());
    const sep = str(p.separator);
    const headers = [...t.headers.slice(0, i), ...into, ...t.headers.slice(i + 1)];
    const rows = t.rows.map((r) => {
      const cell = r[i];
      const parts = isBlank(cell) ? [] : String(cell).split(sep).map((s) => s.trim());
      const pieces = into.map((_, k) => (k < into.length - 1 ? parts[k] ?? null : parts.slice(k).join(`${sep} `) || null));
      return [...r.slice(0, i), ...pieces, ...r.slice(i + 1)];
    });
    return { ok: true, table: { headers, rows } };
  },
  describe: (p) => `Split '${str(p.column)}' at '${str(p.separator)}' into ${strs(p.into).map((c) => `'${c}'`).join(" and ")}`,
};
