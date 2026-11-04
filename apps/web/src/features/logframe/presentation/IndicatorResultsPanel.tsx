"use client";

import { useMemo, useRef, useState } from "react";
import { buildChart } from "@donordesk/domain/contexts/reporting/chart-render.js";
import type { PlaceItem, PlaceResults } from "@/lib/server/schemas-places";
import { MapExplorer } from "@/features/maps/presentation/MapExplorer";
import { StudioChart, type ChartExport } from "@/features/charts/presentation/StudioChart";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { indicatorViewSpec } from "../domain/indicator-views";
import { highlightPeriod } from "../domain/period-highlight";
import { useIndicatorDataset } from "./useIndicatorDataset";

/**
 * One indicator's results by place (the interactive map) beside its figures against the target over time. The map's period slider is the
 * page's: the period it is on is marked on the chart, so the two always answer the same "when".
 */
export function IndicatorResultsPanel({ projectId, indicatorId, places, initial, periods }: {
  projectId: string;
  indicatorId: string;
  places: readonly PlaceItem[];
  initial: PlaceResults | null;
  periods: ReadonlyArray<{ id: string; label: string }>;
}) {
  const { t } = useI18n();
  const [periodId, setPeriodId] = useState<string | null>(null);
  const exportRef = useRef<ChartExport | null>(null);
  const spec = useMemo(() => indicatorViewSpec("OVER_TIME", indicatorId), [indicatorId]);
  const { dataset, error } = useIndicatorDataset(projectId, indicatorId, spec);
  const built = useMemo(() => (spec && dataset ? buildChart(spec, dataset) : null), [spec, dataset]);
  const label = periods.find((p) => p.id === periodId)?.label ?? null;
  const option = useMemo(() => (built?.ok && built.render === "ECHART" ? highlightPeriod(built.option as Record<string, unknown>, label) : null), [built, label]);

  return (
    <section className="card mt-4 space-y-3" aria-label={t("indicatorResults.title")} data-testid="indicator-results">
      <div>
        <h3 className="font-medium">{t("indicatorResults.title")}</h3>
        <p className="text-xs text-slate-500">{t("indicatorResults.hint")}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MapExplorer projectId={projectId} places={places} initial={initial} periods={periods} compact lockedIndicatorId={indicatorId} periodId={periodId} onPeriodChange={setPeriodId} />
        <figure className="space-y-2" aria-label={t("indicatorResults.chartTitle")} data-marked-period={option && label ? label : ""}>
          <figcaption className="text-sm font-medium">{t("indicatorResults.chartTitle")}</figcaption>
          {error ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
            : !built ? <p role="status" className="text-sm text-slate-500">{t("tile.loading")}</p>
            : !built.ok ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{built.reason}</p>
            : option && built.render === "ECHART" ? <StudioChart option={option} aspect={built.aspect} label={built.alt} exportRef={exportRef} />
            : <p role="status" className="text-sm text-slate-500">{t("indicatorViews.none")}</p>}
          {built?.ok && built.notes.length > 0 && <ul className="space-y-1 text-xs text-slate-500">{built.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </figure>
      </div>
    </section>
  );
}
