import { toPlainDate } from "@donordesk/domain/contexts/workplan/index.js";
import type { TimelineDeadline } from "./timeline-layout.ts";

export interface PeriodDeadlines {
  deadline: string;
  internalReviewDeadline?: string | null | undefined;
  cancelled?: boolean | undefined;
}

/** The top lane of the Timeline: each live period's donor deadline and internal review deadline (cancelled periods are out of the calendar). */
export function deadlinesFromPeriods(periods: ReadonlyArray<PeriodDeadlines>): TimelineDeadline[] {
  const out: TimelineDeadline[] = [];
  for (const p of periods) {
    if (p.cancelled) continue;
    const due = toPlainDate(p.deadline);
    if (due) out.push({ date: due, label: "Report due", kind: "DEADLINE" });
    const review = p.internalReviewDeadline ? toPlainDate(p.internalReviewDeadline) : undefined;
    if (review) out.push({ date: review, label: "Internal review", kind: "REVIEW" });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
