"use client";

import { kpiNarrative, kpiStatusOf } from "@donordesk/domain/contexts/dashboards/index.js";
import type { ChartDrawing } from "@/lib/server/schemas-dashboards";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { formatChangeAmount, formatFullNumber, formatTileNumber } from "@/features/design/domain/number-format";
import { segmentPath, sparkSegments } from "../domain/sparkline";
import { TILE_BACKGROUND } from "../domain/tile-theme";

type Kpi = NonNullable<ChartDrawing["kpi"]>;
const SPARK_W = 120;
const SPARK_H = 32;
const ARROW = { UP: "▲", DOWN: "▼", FLAT: "▬" } as const;

/**
 * One big figure with its period, change since the period before, progress to target and a sparkline. Nothing recorded says so; it never
 * shows a placeholder figure. A change is a word and an arrow, never colour alone; a plain card judges nothing it cannot back up.
 */
export function KpiTileView({ kpi }: { kpi: Kpi }) {
  const { t, locale } = useI18n();
  const solid = Boolean(kpi.color);
  const muted = solid ? "" : "text-[var(--tile-meta)]";
  const segments = sparkSegments(kpi.spark.map((s) => s.value), SPARK_W, SPARK_H);
  const change = kpi.change ?? null;
  const changeTone = solid || change === null || change.good === null ? "" : change.good ? "text-[var(--signal-good)]" : "text-[var(--signal-bad)]";
  const narrative = kpiNarrative({ value: kpi.value, status: kpi.status ?? kpiStatusOf({ value: kpi.value, percentOfTarget: kpi.percentOfTarget }), percentOfTarget: kpi.percentOfTarget, periodLabel: kpi.periodLabel, target: kpi.target });
  const percent = kpi.percentOfTarget === null ? null : Math.min(100, Math.max(0, kpi.percentOfTarget));
  return (
    <div className={`flex h-full min-h-0 flex-col justify-between gap-1 overflow-hidden rounded-md p-3 ${solid ? "text-white" : ""}`} style={kpi.color ? { backgroundColor: TILE_BACKGROUND[kpi.color] } : undefined} data-testid="kpi-widget">
      {kpi.value === null ? (
        <p className={`text-sm ${muted}`}>{t("tile.empty")}</p>
      ) : (
        <div className="min-w-0">
          <p className="truncate text-3xl font-semibold tabular-nums" title={formatFullNumber(kpi.value, locale)}>
            {formatTileNumber(kpi.value, locale)}{kpi.unit ? <span className={`ms-1 text-sm font-normal ${muted}`}>{kpi.unit}</span> : null}
          </p>
          <p className={`text-xs ${muted}`}>
            {kpi.periodLabel}{kpi.unverified ? ` · ${t("tile.unverified.one", { count: 1 }).replace(/^1 /, "")}` : ""}
          </p>
          {change && (
            <p className={`mt-0.5 text-xs font-medium ${changeTone}`} data-testid="kpi-change">
              <span aria-hidden="true">{ARROW[change.direction]} </span>
              {t(change.direction === "UP" ? "kpi.change.up" : change.direction === "DOWN" ? "kpi.change.down" : "kpi.change.flat", { delta: formatChangeAmount(change.delta, locale), period: change.sincePeriod })}
            </p>
          )}
        </div>
      )}
      {percent !== null && (
        <div data-testid="kpi-progress">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label={t("kpi.ofTarget", { percent: Math.round(kpi.percentOfTarget ?? 0) })}>
            <div className={`h-full rounded-full ${solid ? "bg-white" : "bg-[var(--viz-1)]"}`} style={{ width: `${percent}%` }} />
          </div>
          {narrative && <p className={`mt-0.5 text-xs ${muted}`} data-testid="kpi-narrative">{(kpi.status ?? kpiStatusOf({ value: kpi.value, percentOfTarget: kpi.percentOfTarget })) === "TARGET_MET" && <span aria-hidden="true">✓ </span>}{t(narrative.key, narrative.params)}</p>}
        </div>
      )}
      {segments.length > 0 && (
        <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="h-8 min-h-0 w-full shrink" role="img" aria-label={t("kpi.trend", { count: kpi.spark.length })} preserveAspectRatio="xMidYMid meet">
          {segments.map((s, i) => (s.points.length > 1
            ? <path key={i} d={segmentPath(s)} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className={solid ? "text-white" : "text-[var(--viz-1)]"} />
            : <circle key={i} cx={s.points[0]![0]} cy={s.points[0]![1]} r="1.8" className={solid ? "fill-white" : "fill-[var(--viz-1)]"} />))}
        </svg>
      )}
    </div>
  );
}
