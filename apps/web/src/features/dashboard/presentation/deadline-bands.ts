export type DeadlineBand = "overdue" | "today" | "soon" | "later";

export function classifyBand(days: number | null | undefined): DeadlineBand | null {
  if (days === null || days === undefined) return null;
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "later";
}
