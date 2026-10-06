/** Which records a reviewer may accept in bulk, and how results are summarised: pure, so the list and its tests share it. */

export interface SelectableActivity {
  id: string;
  status: string;
}

/** Only submitted records are waiting for a decision. */
export function reviewableIds(items: ReadonlyArray<SelectableActivity>): string[] {
  return items.filter((a) => a.status === "SUBMITTED").map((a) => a.id);
}

export function toggleSelection(selected: ReadonlyArray<string>, id: string): string[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
}

/** Withdrawn records sink to the bottom; everything else keeps its order. */
export function withWithdrawnLast<T extends SelectableActivity>(items: ReadonlyArray<T>): T[] {
  return [...items.filter((a) => a.status !== "WITHDRAWN"), ...items.filter((a) => a.status === "WITHDRAWN")];
}

export function bulkSummary(result: { succeeded: number; failed: number }): string {
  const done = `${result.succeeded} record${result.succeeded === 1 ? "" : "s"} accepted`;
  return result.failed === 0 ? done : `${done}, ${result.failed} could not be accepted`;
}
