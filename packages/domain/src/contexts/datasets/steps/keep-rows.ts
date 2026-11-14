import { isBlank } from "../parse-cells.js";
import type { CellValue } from "../model.js";
import type { StepDef } from "./types.js";
import { colIndex, missing, str, strs } from "./types.js";

/** Leave out rows by a column's value ("Province is 'Total'") or rows where it is empty. Compared without case or extra spaces. */
const fold = (c: CellValue | undefined): string => (isBlank(c) ? "" : String(c).trim().toLowerCase());

export const KEEP_ROWS_WHERE: StepDef = {
  type: "KEEP_ROWS_WHERE", label: "Leave out rows", phase: "TABLE",
  validate: (p, headers) => missing(headers, [str(p.column)]) ?? (p.when === "EMPTY" || strs(p.values).length > 0 ? undefined : "Name the values to leave out."),
  apply: (t, p) => {
    const i = colIndex(t, str(p.column));
    const values = new Set(strs(p.values).map((v) => v.trim().toLowerCase()));
    const drop = (r: CellValue[]): boolean => (p.when === "EMPTY" ? fold(r[i]) === "" : values.has(fold(r[i])));
    return { ok: true, table: { headers: t.headers, rows: t.rows.filter((r) => !drop(r)) } };
  },
  describe: (p) => (p.when === "EMPTY" ? `Leave out rows where '${str(p.column)}' is empty` : `Leave out rows where '${str(p.column)}' is ${strs(p.values).map((v) => `'${v}'`).join(" or ")}`),
};
