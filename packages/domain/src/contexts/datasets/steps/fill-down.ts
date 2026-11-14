import { isBlank } from "../parse-cells.js";
import type { StepDef } from "./types.js";
import { colIndex, missing, strs } from "./types.js";

/** Merged cells in a ministry export leave the value only on the first row of a block: copy it down into the empty cells below. */
export const FILL_DOWN: StepDef = {
  type: "FILL_DOWN", label: "Fill down", phase: "TABLE",
  validate: (p, headers) => (strs(p.columns).length === 0 ? "Choose a column." : missing(headers, strs(p.columns))),
  apply: (t, p) => {
    const idx = strs(p.columns).map((c) => colIndex(t, c));
    const last = new Map<number, unknown>();
    const rows = t.rows.map((r) => {
      const out = [...r];
      for (const i of idx) { if (isBlank(out[i])) { if (last.has(i)) out[i] = last.get(i) as never; } else last.set(i, out[i]); }
      return out;
    });
    return { ok: true, table: { headers: t.headers, rows } };
  },
  describe: (p) => `Fill ${strs(p.columns).map((c) => `'${c}'`).join(", ")} down`,
};
