import type { StepDef } from "./types.js";
import { missing, str } from "./types.js";

export const RENAME: StepDef = {
  type: "RENAME", label: "Rename a column", phase: "TABLE",
  validate: (p, headers) => missing(headers, [str(p.from)]) ?? (!str(p.to).trim() ? "Give the new name." : headers.includes(str(p.to).trim()) && str(p.to).trim() !== str(p.from) ? `There is already a column called '${str(p.to).trim()}'.` : undefined),
  apply: (t, p) => ({ ok: true, table: { headers: t.headers.map((h) => (h === str(p.from) ? str(p.to).trim() : h)), rows: t.rows } }),
  describe: (p) => `Call '${str(p.from)}' '${str(p.to)}'`,
};
