import { columnKind } from "./column-kinds.js";
import type { ColumnDef, DatasetRowValues } from "./model.js";

/**
 * A new upload against the current version (§3.10). "Replace" makes the new rows the version; "Add new periods" keeps the current rows
 * and adds only rows whose period is not in the dataset yet. Before saving the person sees what changes: rows added, changed and removed.
 * Rows are matched by their key (every grouping column), so a corrected figure shows as changed, not as one removed and one added.
 */
export const REFRESH_MODES = ["REPLACE", "ADD_PERIODS"] as const;
export type RefreshMode = (typeof REFRESH_MODES)[number];

export interface RefreshDiff {
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
  /** Periods the new rows bring that the dataset did not have (sorted). */
  newPeriods: string[];
  /** ADD_PERIODS: rows of periods already present, left out (the current figures for those periods stay). */
  skipped: number;
  /** The sentence the refresh dialog shows ("+106 rows for 2022-08, 3 rows changed, 0 removed"). */
  summary: string;
}

const keyCols = (columns: readonly ColumnDef[]): ColumnDef[] => columns.filter((c) => columnKind(c.kind)?.role === "GROUP");
const rowKey = (r: DatasetRowValues, cols: readonly ColumnDef[]): string => JSON.stringify(cols.map((c) => { const v = r.values[c.key]; return typeof v === "string" ? v.trim().toLowerCase() : v ?? null; }));
const same = (a: DatasetRowValues, b: DatasetRowValues, cols: readonly ColumnDef[]): boolean => cols.every((c) => (a.values[c.key] ?? null) === (b.values[c.key] ?? null));

export function planRefresh(current: readonly DatasetRowValues[], incoming: readonly DatasetRowValues[], columns: readonly ColumnDef[], mode: RefreshMode): { rows: DatasetRowValues[]; diff: RefreshDiff } {
  const keys = keyCols(columns);
  const had = new Set(current.map((r) => r.periodKey).filter((p): p is string => Boolean(p)));
  let next: DatasetRowValues[];
  let skipped = 0;
  if (mode === "ADD_PERIODS") {
    const fresh = incoming.filter((r) => r.periodKey && !had.has(r.periodKey));
    skipped = incoming.length - fresh.length;
    const start = Math.max(0, ...current.map((r) => r.rowNo)) + 1;
    next = [...current, ...fresh.map((r, i) => ({ ...r, rowNo: start + i }))];
  } else next = [...incoming];

  const before = new Map(current.map((r) => [rowKey(r, keys), r]));
  const after = new Map(next.map((r) => [rowKey(r, keys), r]));
  let added = 0, changed = 0, unchanged = 0;
  for (const [k, r] of after) { const old = before.get(k); if (!old) added += 1; else if (same(old, r, columns)) unchanged += 1; else changed += 1; }
  const removed = [...before.keys()].filter((k) => !after.has(k)).length;
  const newPeriods = [...new Set(next.map((r) => r.periodKey).filter((p): p is string => Boolean(p) && !had.has(p!)))].sort();
  const parts = [`+${added.toLocaleString("en")} ${added === 1 ? "row" : "rows"}${newPeriods.length ? ` for ${newPeriods.length > 3 ? `${newPeriods[0]} to ${newPeriods[newPeriods.length - 1]}` : newPeriods.join(", ")}` : ""}`, `${changed} ${changed === 1 ? "row" : "rows"} changed`, `${removed} removed`];
  if (skipped) parts.push(`${skipped} ${skipped === 1 ? "row" : "rows"} for periods already in the dataset left out`);
  return { rows: next, diff: { added, changed, removed, unchanged, newPeriods, skipped, summary: parts.join(", ") } };
}
