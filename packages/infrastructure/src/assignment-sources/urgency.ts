import { compareDates, daysBetween, type PlainDate } from "@donordesk/domain";

/** The order My Work has always used: overdue first (0), then by days left (+1); no date sorts after dated work. */
export function urgencyFor(due: PlainDate | undefined, today: PlainDate, base: number): number {
  if (!due) return base + 100;
  if (compareDates(due, today) < 0) return 0;
  return daysBetween(today, due) + 1;
}

/** An assignment is late when its date has passed. */
export function stateFor(due: PlainDate | undefined, today: PlainDate): "OPEN" | "LATE" {
  return due && compareDates(due, today) < 0 ? "LATE" : "OPEN";
}

export const toDay = (d: Date): PlainDate => d.toISOString().slice(0, 10);
