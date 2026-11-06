/**
 * Ask "Why?" only when it matters: moving or changing a planned activity needs a reason once its original end date
 * has passed, or once a report (a non-cancelled period with a generated draft) covers it. The application layer
 * supplies `reportUsesIt`; this module only decides.
 */
import { compareDates, type PlainDate } from "./plain-date.js";

export function reasonRequired(item: { originalEnd: PlainDate }, today: PlainDate, facts: { reportUsesIt: boolean }): boolean {
  return facts.reportUsesIt || compareDates(item.originalEnd, today) < 0;
}
