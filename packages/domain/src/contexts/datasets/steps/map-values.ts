import { isBlank } from "../parse-cells.js";
import type { StepDef } from "./types.js";
import { colIndex, missing, str } from "./types.js";

/** "Read 'Sind' as 'Sindh'". Compared without case or extra spaces. On a place column the screen also offers to save a place alias. */
export const MAP_VALUES: StepDef = {
  type: "MAP_VALUES", label: "Read a value as another", phase: "TABLE",
  validate: (p, headers) => {
    const pairs = p.pairs;
    if (!Array.isArray(pairs) || pairs.length === 0) return "Give at least one value to read differently.";
    if (pairs.some((x) => !x || typeof x !== "object" || !str((x as Record<string, unknown>).from).trim() || !str((x as Record<string, unknown>).to).trim())) return "Each value needs what it says and what to read it as.";
    return missing(headers, [str(p.column)]);
  },
  apply: (t, p) => {
    const i = colIndex(t, str(p.column));
    const map = new Map((p.pairs as Array<{ from: string; to: string }>).map((x) => [x.from.trim().toLowerCase(), x.to.trim()]));
    const rows = t.rows.map((r) => {
      if (isBlank(r[i])) return r;
      const to = map.get(String(r[i]).trim().toLowerCase());
      return to === undefined ? r : r.map((c, k) => (k === i ? to : c));
    });
    return { ok: true, table: { headers: t.headers, rows } };
  },
  describe: (p) => {
    const pairs = Array.isArray(p.pairs) ? (p.pairs as Array<{ from: string; to: string }>) : [];
    const first = pairs.slice(0, 2).map((x) => `'${x.from}' as '${x.to}'`).join(", ");
    return `In '${str(p.column)}', read ${first}${pairs.length > 2 ? ` and ${pairs.length - 2} more` : ""}`;
  },
};
