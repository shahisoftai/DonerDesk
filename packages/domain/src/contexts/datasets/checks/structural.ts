import { MAX_ROWS_NAMED } from "../limits.js";
import { SEMANTICS } from "../semantics.js";
import { columnKind } from "../column-kinds.js";
import type { CheckDef } from "./types.js";

const rowsText = (rows: number[]): string => {
  const named = rows.slice(0, MAX_ROWS_NAMED).join(", ");
  return rows.length > MAX_ROWS_NAMED ? `${named} and ${rows.length - MAX_ROWS_NAMED} more` : named;
};
const PLACE_SEMANTICS = new Set(SEMANTICS.filter((s) => s.resolver === "PLACE").map((s) => s.key));
const PERIOD_SEMANTICS = new Set(SEMANTICS.filter((s) => s.resolver === "PERIOD").map((s) => s.key));

/**
 * Two rows for the same place, period and grouping (§1.2): never silently added. The key is every grouping column (text, places,
 * periods, yes/no); a dataset without any grouping column has no key and nothing is checked.
 */
export const KEY_UNIQUE: CheckDef = {
  key: "KEY_UNIQUE", label: "One row per place, period and group", defaultSeverity: "BLOCK", params: [], always: true,
  validate: () => undefined,
  run: ({ rows, columns }) => {
    const keyCols = columns.filter((c) => columnKind(c.kind)?.role === "GROUP");
    if (keyCols.length === 0) return [];
    const seen = new Map<string, number[]>();
    for (const r of rows) {
      const k = JSON.stringify(keyCols.map((c) => (typeof r.values[c.key] === "string" ? (r.values[c.key] as string).toLowerCase() : r.values[c.key] ?? null)));
      seen.set(k, [...(seen.get(k) ?? []), r.fileRow]);
    }
    return [...seen.entries()].filter(([, at]) => at.length > 1).map(([k, at]) => {
      const parts = (JSON.parse(k) as unknown[]).map((v, i) => (v === null ? `no ${keyCols[i]!.label}` : String(v))).filter(Boolean);
      return { rows: at, message: `Rows ${rowsText(at)} are all ${parts.join(", ")}. Keep one row for each, or add the column that tells them apart.` };
    });
  },
};

export const PLACE_KNOWN: CheckDef = {
  key: "PLACE_KNOWN", label: "Places are in your places list", defaultSeverity: "WARN", params: [], always: true, noteOnVisuals: false,
  validate: () => undefined,
  run: ({ rows, columns, places }) => {
    const out: Array<{ rows: number[]; message: string; column: string }> = [];
    for (const c of columns.filter((x) => PLACE_SEMANTICS.has(x.semantic))) {
      const bad = new Map<string, { rows: number[]; status: string }>();
      for (const r of rows) {
        const v = r.values[c.key];
        if (typeof v !== "string") continue;
        const res = places?.get(v.trim().toLowerCase());
        if (res && res.status !== "RESOLVED") bad.set(v, { rows: [...(bad.get(v)?.rows ?? []), r.fileRow], status: res.status });
      }
      const unknown = [...bad].filter(([, b]) => b.status === "UNRESOLVED").map(([v]) => v);
      const several = [...bad].filter(([, b]) => b.status === "AMBIGUOUS").map(([v]) => v);
      const at = [...bad.values()].flatMap((b) => b.rows);
      if (unknown.length) out.push({ column: c.key, rows: at, message: `${unknown.length} ${c.label.toLowerCase()} ${unknown.length === 1 ? "value is" : "values are"} not in your places: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? "…" : ""}. Fix the spelling, read it as a known place, or add it to your places. Their rows are kept and listed apart, never placed at a guess.` });
      if (several.length) out.push({ column: c.key, rows: at, message: `${several.slice(0, 5).join(", ")} match more than one of your places. Add the area above (for example "Name, Province") or a code.` });
    }
    return out;
  },
};

export const PERIOD_READABLE: CheckDef = {
  key: "PERIOD_READABLE", label: "Periods can be read", defaultSeverity: "BLOCK", params: [], always: true,
  validate: () => undefined,
  run: ({ unreadable, columns }) => {
    const periods = new Set(columns.filter((c) => PERIOD_SEMANTICS.has(c.semantic)).map((c) => c.key));
    return unreadable.filter((u) => periods.has(u.column)).slice(0, 50).map((u) => {
      const col = columns.find((c) => c.key === u.column)!;
      const kind = columnKind(col.kind);
      return { rows: [u.fileRow], column: u.column, message: `Row ${u.fileRow}: '${u.raw}' is not ${kind?.noun ?? "readable"} (write it like ${kind?.example ?? "the other rows"}).` };
    });
  },
};

export const VALUE_READABLE: CheckDef = {
  key: "VALUE_READABLE", label: "Figures are numbers", defaultSeverity: "WARN", params: [], always: true,
  validate: () => undefined,
  run: ({ unreadable, columns }) => {
    const out: Array<{ rows: number[]; message: string; column: string }> = [];
    for (const c of columns.filter((x) => !PERIOD_SEMANTICS.has(x.semantic))) {
      const bad = unreadable.filter((u) => u.column === c.key);
      if (bad.length === 0) continue;
      out.push({ column: c.key, rows: bad.map((b) => b.fileRow), message: `${c.label}: ${bad.length === 1 ? `row ${bad[0]!.fileRow} holds '${bad[0]!.raw}'` : `${bad.length} cells (rows ${rowsText(bad.map((b) => b.fileRow))})`}, which ${bad.length === 1 ? "is" : "are"} not ${columnKind(c.kind)?.noun ?? "readable"}. ${bad.length === 1 ? "It is" : "They are"} kept as not reported.` });
    }
    return out;
  },
};
