import type { StepDef } from "./types.js";
import { missing, strs } from "./types.js";

export const DROP_COLUMNS: StepDef = {
  type: "DROP_COLUMNS", label: "Leave out columns", phase: "TABLE",
  validate: (p, headers) => (strs(p.columns).length === 0 ? "Choose at least one column." : missing(headers, strs(p.columns))),
  apply: (t, p) => {
    const drop = new Set(strs(p.columns));
    const keep = t.headers.map((h, i) => (drop.has(h) ? -1 : i)).filter((i) => i >= 0);
    if (keep.length === 0) return { ok: false, problem: "Leaving out every column leaves nothing." };
    return { ok: true, table: { headers: keep.map((i) => t.headers[i]!), rows: t.rows.map((r) => keep.map((i) => r[i] ?? null)) } };
  },
  describe: (p) => `Leave out ${strs(p.columns).map((c) => `'${c}'`).join(", ")}`,
};
