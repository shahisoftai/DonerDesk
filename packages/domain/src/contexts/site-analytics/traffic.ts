import type { Metric, PageRow, Ranked } from "./stats-report.js";

/** Change between two figures; null when there is no earlier figure above zero (no percentage of nothing). */
export function changeOf(value: number, previous: number | null): number | null {
  if (previous === null || !(previous > 0)) return null;
  return (value - previous) / previous;
}

export function metricOf(value: number, previous: number | null): Metric {
  return { value, previous, change: changeOf(value, previous) };
}

/** Part over whole; null when the whole is zero. */
export function shareOf(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

/** The biggest rows first, at most `limit`, each with its share of the listed visitors. */
export function ranked(rows: ReadonlyArray<{ name: string; visitors: number }>, limit: number): Ranked[] {
  const total = rows.reduce((sum, row) => sum + row.visitors, 0);
  return [...rows]
    .sort((a, b) => b.visitors - a.visitors || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((row) => ({ name: row.name, visitors: row.visitors, share: shareOf(row.visitors, total) }));
}

export function topPages(rows: readonly PageRow[], limit: number): PageRow[] {
  return [...rows].sort((a, b) => b.views - a.views || a.path.localeCompare(b.path)).slice(0, limit);
}

/** Sign-ups per visitor; null with no visitors. */
export function signUpRate(signUps: number, visitors: number): number | null {
  return shareOf(signUps, visitors);
}

/** Google writes an empty or "(not set)" name for a value it could not tell; say so in plain words. */
export function plainName(raw: string | undefined | null, unknown = "Not known"): string {
  const name = (raw ?? "").trim();
  return name === "" || name === "(not set)" || name === "(none)" ? unknown : name;
}
