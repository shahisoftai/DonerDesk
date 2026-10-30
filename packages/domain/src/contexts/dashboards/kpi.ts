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
  return {
    ok: true,
    tile: {
      title: query.title?.trim() || `${indicator.code} ${indicator.name}`.trim(),
      color: query.color ?? null,
      unit: indicator.unit?.trim() || null,
      value: latest?.value ?? null,
      periodLabel: latest?.periodLabel ?? null,
      target: indicator.target.trim() === "" ? null : indicator.target,
      percentOfTarget: sharePoint?.value ?? null,
      spark: points.map((p) => ({ label: p.periodLabel, value: p.value })),
      unverified: latest ? !latest.verified : false,
      notes: period.notes,
    },
  };
}
