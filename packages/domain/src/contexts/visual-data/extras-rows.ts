import type { DatasetBudgetLine, DatasetDay, DatasetPlanRow } from "../reporting/dataset-query.js";
import type { VisualRow } from "./shape.js";

/**
 * The plan, completed activities and the budget as catalogue rows (Phase 48.17). Plain mapping; the honesty rules live in
 * `shapeTable`. A milestone is a planned activity with start = end and is counted apart: it has no activity count.
 */
export function planRows(plan: ReadonlyArray<DatasetPlanRow>): VisualRow[] {
  return plan.map((r) => ({ values: { activity: r.title, delivery_state: r.signalLabel, planned_start: r.start, planned_end: r.end, activity_count: r.kind === "ACTIVITY" ? 1 : null } }));
}

export function activityRows(days: ReadonlyArray<DatasetDay>): VisualRow[] {
  return days.map((d) => ({ values: { activity_date: d.date, done_count: d.count } }));
}

/** An unlinked line is one group, "Not linked to a result"; when the results could not be read the group says unknown, never "none". */
export function spendingRows(lines: ReadonlyArray<DatasetBudgetLine>): VisualRow[] {
  return lines.map((l) => ({ values: { currency: l.currency, category: l.category, result: l.resultUnknown ? "Result unknown" : (l.result ?? "Not linked to a result"), budgeted: l.budgeted, spent: l.spent } }));
}
