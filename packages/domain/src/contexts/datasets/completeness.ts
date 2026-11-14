import type { DatasetRowValues } from "./model.js";

/**
 * Who reported (§3.11): for each period, the expected units (places of a level, facilities of a type, partners) that sent a row with at
 * least one figure, over those expected. A count of reports received, never a guess: a unit with only empty figures has not reported.
 * The cells are the "data sharing by province × month" table; a group without expected units shows no share, never 0 %.
 */
export interface CompletenessCell { group: string; period: string; reported: number; expected: number; share: number | null; missing: string[] }

export interface CompletenessInput {
  rows: readonly DatasetRowValues[];
  /** The column (or "_place_id") naming the unit that reports. */
  unitOf(row: DatasetRowValues): string | null;
  /** The group a unit belongs to (its province, its partner); one group "All" when there is none. */
  groupOfUnit(unit: string): string;
  /** Every unit expected to report, by group. */
  expected: ReadonlyMap<string, readonly string[]>;
  /** The figure columns: a row reports when any of them holds a figure. */
  figures: readonly string[];
  periods: readonly string[];
}

export function completeness(input: CompletenessInput): CompletenessCell[] {
  const reported = new Map<string, Set<string>>();
  for (const r of input.rows) {
    const unit = input.unitOf(r);
    if (!unit || !r.periodKey) continue;
    if (!input.figures.some((f) => typeof r.values[f] === "number")) continue;
    const k = `${r.periodKey}\u0000${unit}`;
    reported.set(k, new Set([...(reported.get(k) ?? []), unit]));
  }
  const cells: CompletenessCell[] = [];
  for (const [group, units] of input.expected) {
    for (const period of input.periods) {
      const sent = units.filter((u) => reported.has(`${period}\u0000${u}`));
      cells.push({ group, period, reported: sent.length, expected: units.length, share: units.length ? Math.round((sent.length / units.length) * 1000) / 10 : null, missing: units.filter((u) => !sent.includes(u)) });
    }
  }
  return cells;
}

/**
 * Partner × place presence (§3.11): which partner reported figures in which place. A table configuration, not a new block kind:
 * rows are places, columns are partners, a cell is the number of periods with a report (0 is a real "never reported", because both
 * the partner and the place appear in the dataset).
 */
export function coverageMatrix(rows: readonly DatasetRowValues[], placeColumn: string, partnerColumn: string, figures: readonly string[]): { places: string[]; partners: string[]; cells: Record<string, Record<string, number>> } {
  const cells: Record<string, Record<string, Set<string>>> = {};
  const partners = new Set<string>(), places = new Set<string>();
  for (const r of rows) {
    const place = r.values[placeColumn], partner = r.values[partnerColumn];
    if (typeof place !== "string" || typeof partner !== "string") continue;
    places.add(place); partners.add(partner);
    if (!figures.some((f) => typeof r.values[f] === "number")) continue;
    ((cells[place] ??= {})[partner] ??= new Set()).add(r.periodKey ?? "");
  }
  const ps = [...partners].sort(), pl = [...places].sort();
  return { places: pl, partners: ps, cells: Object.fromEntries(pl.map((p) => [p, Object.fromEntries(ps.map((q) => [q, cells[p]?.[q]?.size ?? 0]))])) };
}
