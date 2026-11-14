import type { StepDef } from "./types.js";
import { str } from "./types.js";

/** Rows from another file with the same columns (in any order). A missing or extra column is refused by name, never filled with blanks. */
export const APPEND: StepDef = {
  type: "APPEND", label: "Add rows from another file", phase: "TABLE",
  validate: (p) => (str(p.fileKey) ? undefined : "Choose the file to add."),
  apply: (t, p, ctx) => {
    const other = ctx.extra.get(str(p.fileKey));
    if (!other) return { ok: false, problem: `The file '${str(p.fileName) || "to add"}' is no longer available. Upload it again.` };
    const lacking = t.headers.filter((h) => !other.headers.includes(h));
    const extra = other.headers.filter((h) => !t.headers.includes(h));
    if (lacking.length || extra.length) {
      return { ok: false, problem: `'${str(p.fileName)}' does not have the same columns${lacking.length ? `: it lacks ${lacking.slice(0, 3).map((h) => `'${h}'`).join(", ")}` : ""}${extra.length ? `${lacking.length ? " and" : ":"} it has ${extra.slice(0, 3).map((h) => `'${h}'`).join(", ")} too` : ""}.` };
    }
    const order = t.headers.map((h) => other.headers.indexOf(h));
    return { ok: true, table: { headers: t.headers, rows: [...t.rows, ...other.rows.map((r) => order.map((i) => r[i] ?? null))] } };
  },
  describe: (p) => `Add rows from '${str(p.fileName) || "another file"}'`,
};
