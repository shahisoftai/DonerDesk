/** The sentence that previews what "Create all" will do, from the plan the server computed. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthYear(dateOnly: string): string {
  const d = new Date(`${dateOnly.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? dateOnly : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export interface PlanLike {
  periods: ReadonlyArray<{ startDate: string; endDate: string }>;
  closing: { startDate: string; endDate: string } | null;
}

export function planSummary(plan: PlanLike): string {
  const n = plan.periods.length;
  if (n === 0) return plan.closing ? `No more regular periods are needed. The last one (${monthYear(plan.closing.startDate)}) is the closing report.` : "Every period this project needs already exists.";
  const first = plan.periods[0]!;
  const last = plan.periods[n - 1]!;
  const span = first.startDate.slice(0, 7) === last.endDate.slice(0, 7) ? monthYear(first.startDate) : `${monthYear(first.startDate)} – ${monthYear(last.endDate)}`;
  const closing = plan.closing ? ` The last one (${monthYear(plan.closing.startDate)}) is the closing report, created from its own steps.` : "";
  return `${n} period${n === 1 ? "" : "s"}: ${span}.${closing}`;
}
