/** Rows typed into the per-group target editor (phase 28.1-B). Pure: no React, so it is unit-tested. */
export interface BreakdownTargetRow { dimension: string; category: string; value: string }

/** Keeps only rows with a group name and a target; a blank row is not a target. */
export function completeBreakdownRows(rows: BreakdownTargetRow[]): BreakdownTargetRow[] {
  return rows.filter((r) => r.category.trim() !== "" && r.value.trim() !== "").map((r) => ({ dimension: r.dimension, category: r.category.trim(), value: r.value.trim() }));
}
