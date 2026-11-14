import { columnKind } from "./column-kinds.js";
import type { ColumnDef, DatasetFigure, DatasetRowValues } from "./model.js";

/**
 * A dataset figure used for an indicator (§3.9). On save or refresh the linked figure is written as a draft indicator value through the
 * ordinary indicator save, so entry windows, locks and verification still apply. A verified value is never overwritten: a difference
 * becomes a note for the reviewer. A rate links only to a rate indicator, and only through its parts (a ratio of sums).
 */
export interface LinkFilter { column: string; values: string[] }
export interface DatasetIndicatorLinkDef {
  indicatorId: string;
  /** A column key or a dataset figure id. */
  figureRef: string;
  filters: LinkFilter[];
  /** Record the value by place (Phase 53): the breakdown is the matched places' own figures. */
  byPlace: boolean;
}

export interface LinkTarget { id: string; type: string; aggregation?: string | undefined; recordByPlace?: boolean | undefined; formula?: boolean | undefined }

type Figure = { kind: "SUM"; column: string } | { kind: "RATIO"; numerator: string; denominator: string; percent: boolean } | { kind: "NONE"; reason: string };

/** How a figure is combined over the rows of a period: a count is summed, a rate recomputed from its parts, anything else refused. */
export function linkFigure(ref: string, columns: readonly ColumnDef[], figures: readonly DatasetFigure[]): Figure {
  const col = columns.find((c) => c.key === ref);
  if (col) {
    const kind = columnKind(col.kind);
    if (kind?.role !== "FIGURE") return { kind: "NONE", reason: `${col.label} is not a figure.` };
    if (kind.additive) return { kind: "SUM", column: col.key };
    if (col.rateParts) return { kind: "RATIO", numerator: col.rateParts.numerator, denominator: col.rateParts.denominator, percent: col.rateParts.percent };
    return { kind: "NONE", reason: `${col.label} cannot be added across rows. Give its parts (what it is worked out from) to use it for an indicator.` };
  }
  const f = figures.find((x) => x.id === ref);
  if (f && (f.op === "RATIO" || f.op === "SHARE")) return { kind: "RATIO", numerator: f.terms[0]!, denominator: f.terms[1]!, percent: Boolean(f.percent) };
  if (f) return { kind: "NONE", reason: `${f.label} cannot be used for an indicator yet: use the columns it is made from.` };
  return { kind: "NONE", reason: "Choose a figure of this dataset." };
}

const RATE_TYPES = new Set(["PERCENTAGE", "RATIO"]);

export function linkProblems(link: DatasetIndicatorLinkDef, target: LinkTarget, columns: readonly ColumnDef[], figures: readonly DatasetFigure[]): string[] {
  const out: string[] = [];
  const f = linkFigure(link.figureRef, columns, figures);
  if (f.kind === "NONE") out.push(f.reason);
  if (target.formula) out.push("This indicator is calculated from others, so no value is typed or linked for it.");
  if (f.kind === "RATIO" && !RATE_TYPES.has(target.type)) out.push("A rate can only feed a percentage or ratio indicator.");
  if (f.kind === "SUM" && RATE_TYPES.has(target.type)) out.push("A count cannot feed a percentage indicator: link a rate worked out from its parts.");
  if (link.byPlace && !target.recordByPlace) out.push("This indicator is not recorded by place. Switch on 'Record by place' first, or link the total.");
  for (const flt of link.filters) if (!columns.some((c) => c.key === flt.column) || flt.values.length === 0) out.push("Each filter names a column and at least one of its values.");
  return out;
}

export interface LinkedValue {
  periodId: string;
  /** null = nothing recorded for the period (no draft is written; a gap is never 0). */
  value: number | null;
  rows: number;
  byPlace?: Record<string, number> | undefined;
}

/**
 * The value for each reporting period: rows whose period key falls inside the period's dates and that pass the filters, combined by
 * the figure's rule. Months and weeks count in the period that holds their first day. By place, each matched place gets its own figure
 * (a rate recomputed per place); rows without a matched place count in the total but in no place.
 */
export function linkedValues(link: DatasetIndicatorLinkDef, rows: readonly DatasetRowValues[], columns: readonly ColumnDef[], figures: readonly DatasetFigure[], periods: ReadonlyArray<{ id: string; startDate: string; endDate: string }>, placeName: (id: string) => string | undefined): LinkedValue[] {
  const f = linkFigure(link.figureRef, columns, figures);
  if (f.kind === "NONE") return [];
  const pass = (r: DatasetRowValues): boolean => link.filters.every((x) => x.values.some((v) => String(r.values[x.column] ?? "").toLowerCase() === v.toLowerCase()));
  const startOf = (key: string): string => (/^\d{4}-W\d{2}$/.test(key) ? isoWeekStart(key) : key.length === 7 ? `${key}-01` : key);
  const combine = (rs: readonly DatasetRowValues[]): number | null => {
    const n = (r: DatasetRowValues, k: string): number | null => (typeof r.values[k] === "number" ? (r.values[k] as number) : null);
    if (f.kind === "SUM") { const xs = rs.map((r) => n(r, f.column)).filter((x): x is number => x !== null); return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) * 1e6) / 1e6 : null; }
    const both = rs.filter((r) => n(r, f.numerator) !== null && n(r, f.denominator) !== null);
    const num = both.reduce((a, r) => a + n(r, f.numerator)!, 0), den = both.reduce((a, r) => a + n(r, f.denominator)!, 0);
    return both.length && den !== 0 ? Math.round((num / den) * (f.percent ? 100 : 1) * 100) / 100 : null;
  };
  return periods.map((p) => {
    const inside = rows.filter((r) => r.periodKey && pass(r) && startOf(r.periodKey) >= p.startDate.slice(0, 10) && startOf(r.periodKey) <= p.endDate.slice(0, 10));
    const value = combine(inside);
    let byPlace: Record<string, number> | undefined;
    if (link.byPlace) {
      byPlace = {};
      const groups = new Map<string, DatasetRowValues[]>();
      for (const r of inside) if (r.placeId) groups.set(r.placeId, [...(groups.get(r.placeId) ?? []), r]);
      for (const [id, rs] of groups) { const v = combine(rs); const name = placeName(id); if (v !== null && name) byPlace[name] = v; }
    }
    return { periodId: p.id, value, rows: inside.length, ...(byPlace ? { byPlace } : {}) };
  });
}

/** The Monday of an ISO week ("2026-W07" → "2026-02-09"). */
export function isoWeekStart(key: string): string {
  const [y, w] = [Number(key.slice(0, 4)), Number(key.slice(6))];
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000 + (w - 1) * 7 * 86400000);
  return monday.toISOString().slice(0, 10);
}

/** What happens to a linked value on refresh: a new draft, an update of a draft, or a note because the stored value is verified. */
export type LinkWrite = { action: "WRITE"; value: number } | { action: "SKIP_EMPTY" } | { action: "NOTE_VERIFIED"; stored: number | null; incoming: number } | { action: "SAME" };

export function linkWriteFor(incoming: number | null, stored: { value: number | null; status: string } | undefined): LinkWrite {
  if (incoming === null) return { action: "SKIP_EMPTY" };
  if (stored && stored.value === incoming) return { action: "SAME" };
  if (stored && stored.status === "VERIFIED") return { action: "NOTE_VERIFIED", stored: stored.value, incoming };
  return { action: "WRITE", value: incoming };
}

/** Suggested links (§8.1): an indicator whose words overlap a column's label (two shared words, or the kit role names it). */
export function suggestLinks(columns: readonly ColumnDef[], indicators: ReadonlyArray<{ id: string; code: string; name: string; type: string; kitRole?: string | undefined }>): Array<{ column: string; indicatorId: string; reason: string }> {
  const words = (t: string): Set<string> => new Set(t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !["the", "and", "with", "for", "number", "total", "who", "were"].includes(w)));
  const out: Array<{ column: string; indicatorId: string; reason: string }> = [];
  for (const c of columns) {
    if (columnKind(c.kind)?.role !== "FIGURE") continue;
    const cw = words(c.label);
    let best: { id: string; score: number; reason: string } | undefined;
    for (const ind of indicators) {
      if (columnKind(c.kind)?.additive === RATE_TYPES.has(ind.type)) continue;
      const shared = [...words(ind.name)].filter((w) => cw.has(w));
      const score = c.role && ind.kitRole === c.role ? 10 : shared.length;
      const reason = c.role && ind.kitRole === c.role ? "the kit names the same figure" : `both mention ${shared.slice(0, 3).join(", ")}`;
      if (score >= 2 && (!best || score > best.score)) best = { id: ind.id, score, reason };
    }
    if (best) out.push({ column: c.key, indicatorId: best.id, reason: best.reason });
  }
  return out;
}
