/**
 * The work plan as a small Gantt chart for the review (Phase 37.6), pure: one bar per dated activity, placed as a share of
 * the plan's whole span, and one tick per month. A row with no dates gets no bar (it is listed apart, never drawn at a
 * guessed place). Plain days only; no clock.
 */
export interface GanttInput {
  path: string;
  title: string;
  start: string | null;
  end: string | null;
  status: string;
}

export interface GanttBar {
  path: string;
  title: string;
  /** Left edge and width as percentages of the span (0-100). */
  left: number;
  width: number;
  start: string;
  end: string;
  status: string;
}

export interface GanttLayout {
  start: string;
  end: string;
  bars: GanttBar[];
  /** Month starts inside the span: label "2023-08" and position in %. */
  months: Array<{ label: string; at: number }>;
  undated: Array<{ path: string; title: string }>;
}

const DAY = 86_400_000;
const dayOf = (iso: string): number => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / DAY;
const isDay = (x: string | null): x is string => !!x && /^\d{4}-\d{2}-\d{2}$/.test(x);

export function ganttLayout(rows: ReadonlyArray<GanttInput>): GanttLayout | null {
  const dated = rows.filter((r) => isDay(r.start) && r.status !== "REJECTED");
  if (dated.length === 0) return null;
  const startOf = (r: GanttInput) => dayOf(r.start!);
  const endOf = (r: GanttInput) => (isDay(r.end) ? dayOf(r.end) : dayOf(r.start!));
  const first = Math.min(...dated.map(startOf));
  const last = Math.max(...dated.map(endOf));
  const span = Math.max(1, last - first + 1);
  const pct = (d: number) => Math.round(((d - first) / span) * 1000) / 10;
  const bars = dated.map((r) => ({
    path: r.path, title: r.title, status: r.status, start: r.start!, end: isDay(r.end) ? r.end : r.start!,
    left: pct(startOf(r)), width: Math.max(0.5, Math.round(((endOf(r) - startOf(r) + 1) / span) * 1000) / 10),
  }));
  const months: GanttLayout["months"] = [];
  const firstDate = new Date(first * DAY);
  for (let y = firstDate.getUTCFullYear(), m = firstDate.getUTCMonth() + 1; ; m += 1) {
    if (m > 11) { y += 1; m = 0; }
    const d = Date.UTC(y, m, 1) / DAY;
    if (d > last) break;
    months.push({ label: `${y}-${String(m + 1).padStart(2, "0")}`, at: pct(d) });
  }
  const iso = (d: number) => new Date(d * DAY).toISOString().slice(0, 10);
  return { start: iso(first), end: iso(last), bars, months, undated: rows.filter((r) => !isDay(r.start) && r.status !== "REJECTED").map((r) => ({ path: r.path, title: r.title })) };
}
