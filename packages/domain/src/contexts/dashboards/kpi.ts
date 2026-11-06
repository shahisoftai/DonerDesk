/**
 * A KPI tile (Phase 35): one indicator's latest figure, its share of target and a sparkline of its periods. Pure.
 * It asks `resolveDataset` for the figures (the same rules as every chart: a gap is null, never 0; drafts only when asked; a rate has no
 * share of target; a "lower is better" indicator has none), so the tile can never say what a chart would not.
 */
import { resolveDataset, type DatasetPoint } from "../reporting/dataset-query.js";
import type { DataSheet } from "../reporting/data-sheet.js";
import { TILE_COLORS, type TileColor } from "./metric-tile.js";

export interface KpiQuery {
  indicatorId: string;
  includeDraft: boolean;
  /** Read up to and including this period (the viewer's period filter sets it); absent = the latest period. */
  toPeriodId?: string | undefined;
  /** A colour for the tile (like a number tile); absent = a plain card. */
  color?: TileColor | undefined;
  /** A name for the tile; absent = the indicator's code and name. */
  title?: string | undefined;
}

export function validateKpiQuery(q: KpiQuery): string | null {
  if (!q.indicatorId) return "A KPI tile needs an indicator.";
  if (q.color !== undefined && !TILE_COLORS.includes(q.color)) return "That colour is not available.";
  if (q.title !== undefined && q.title.length > 60) return "A tile's name is at most 60 characters.";
  return null;
}

/** How the latest figure compares with the one before it. Never a percentage of zero; never a change when there is no earlier figure. */
export interface KpiChange {
  direction: "UP" | "DOWN" | "FLAT";
  /** Latest minus previous, as recorded. */
  delta: number;
  /** Change as a share of the previous figure; null when the previous figure is 0. */
  percent: number | null;
  /** Label of the period compared with. */
  sincePeriod: string;
  /** Whether this direction is the wanted one (a lower-is-better indicator wants DOWN); null for FLAT. */
  good: boolean | null;
}

/**
 * What a KPI says about itself. Judged only against the project's target: there is no "behind" here because the share of target is
 * measured against the final target, so a figure part-way through the project cannot be called late. NOT_JUDGED = a rate or a
 * lower-is-better indicator, or no target, so no claim is made.
 */
export const KPI_STATUSES = ["NO_DATA", "NOT_JUDGED", "TARGET_MET", "IN_PROGRESS"] as const;
export type KpiStatus = (typeof KPI_STATUSES)[number];

/** Ordered: the first rule that holds decides. */
export const KPI_STATUS_RULES: ReadonlyArray<{ status: KpiStatus; when: (f: { value: number | null; percentOfTarget: number | null }) => boolean }> = [
  { status: "NO_DATA", when: (f) => f.value === null },
  { status: "NOT_JUDGED", when: (f) => f.percentOfTarget === null },
  { status: "TARGET_MET", when: (f) => (f.percentOfTarget ?? 0) >= 100 },
  { status: "IN_PROGRESS", when: () => true },
];

export const kpiStatusOf = (f: { value: number | null; percentOfTarget: number | null }): KpiStatus => KPI_STATUS_RULES.find((r) => r.when(f))!.status;

/** Which direction is wanted: the table a change is read through (one row per way an indicator can be read). */
const WANTED_DIRECTION = { higherIsBetter: "UP", lowerIsBetter: "DOWN" } as const;

export function kpiChange(latest: { value: number }, previous: { value: number; periodLabel: string } | null, lowerIsBetter: boolean): KpiChange | null {
  if (previous === null) return null;
  const delta = Math.round((latest.value - previous.value) * 1e6) / 1e6;
  const direction = delta > 0 ? "UP" : delta < 0 ? "DOWN" : "FLAT";
  const wanted = lowerIsBetter ? WANTED_DIRECTION.lowerIsBetter : WANTED_DIRECTION.higherIsBetter;
  return {
    direction, delta, sincePeriod: previous.periodLabel,
    percent: previous.value === 0 ? null : Math.round((delta / Math.abs(previous.value)) * 1000) / 10,
    good: direction === "FLAT" ? null : direction === wanted,
  };
}

export interface KpiTile {
  title: string;
  /** The tile's colour when one was chosen. */
  color: TileColor | null;
  unit: string | null;
  /** The latest period with a figure. null = nothing recorded in range. */
  value: number | null;
  periodLabel: string | null;
  /** The project target as written ("" or the text), shown beside the figure. */
  target: string | null;
  /** Share of target for the latest period (cumulative against the schedule); null for a rate, a lower-is-better indicator or no target. */
  percentOfTarget: number | null;
  spark: Array<{ label: string; value: number | null }>;
  /** Against the period before; null when there is none. */
  change: KpiChange | null;
  status: KpiStatus;
  /** The figure shown is not verified yet. */
  unverified: boolean;
  notes: string[];
}

export type KpiResult = { ok: true; tile: KpiTile } | { ok: false; reason: string };

export function buildKpi(sheet: DataSheet, query: KpiQuery): KpiResult {
  const indicator = sheet.indicators.find((i) => i.id === query.indicatorId);
  if (!indicator) return { ok: false, reason: "This indicator is no longer part of the project." };
  const base = { indicatorIds: [query.indicatorId], includeDraft: query.includeDraft, ...(query.toPeriodId ? { toPeriodId: query.toPeriodId } : {}) };
  const period = resolveDataset(sheet, { ...base, measure: "PERIOD" });
  const share = resolveDataset(sheet, { ...base, measure: "PERCENT_OF_TARGET" });
  const points: DatasetPoint[] = period.points.filter((p) => p.indicatorId === query.indicatorId);
  const latest = [...points].reverse().find((p) => p.value !== null) ?? null;
  const sharePoint = latest ? share.points.find((p) => p.indicatorId === query.indicatorId && p.periodId === latest.periodId) : undefined;
  const earlier = latest ? points.slice(0, points.indexOf(latest)).reverse().find((p) => p.value !== null) ?? null : null;
  const percentOfTarget = sharePoint?.value ?? null;
  return {
    ok: true,
    tile: {
      title: query.title?.trim() || `${indicator.code} ${indicator.name}`.trim(),
      color: query.color ?? null,
      unit: indicator.unit?.trim() || null,
      value: latest?.value ?? null,
      periodLabel: latest?.periodLabel ?? null,
      target: indicator.target.trim() === "" ? null : indicator.target,
      percentOfTarget,
      change: latest && latest.value !== null ? kpiChange({ value: latest.value }, earlier && earlier.value !== null ? { value: earlier.value, periodLabel: earlier.periodLabel } : null, indicator.lowerIsBetter === true) : null,
      status: kpiStatusOf({ value: latest?.value ?? null, percentOfTarget }),
      spark: points.map((p) => ({ label: p.periodLabel, value: p.value })),
      unverified: latest ? !latest.verified : false,
      notes: period.notes,
    },
  };
}
