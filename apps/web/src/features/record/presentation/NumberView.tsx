"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { PackIndicator, PackPeriod } from "@/features/offline/domain/offline-pack";
import type { QuickIndicator, QuickPeriod } from "@/features/reporting/domain/quick-entry-view";
import type { KindViewProps } from "./KindView";
import { ValueForm } from "./ValueForm";

const toQuickIndicator = (i: PackIndicator): QuickIndicator => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, type: i.type, disaggregationRequired: i.disaggregationRequired });
const toQuickPeriod = (p: PackPeriod): QuickPeriod => ({ id: p.id, reportType: p.reportType, startDate: p.startDate, endDate: p.endDate, status: p.status });

/** The number form inside the sheet: reads the project's indicators and periods through the lookup (server or phone) and hands them to the form. */
export function NumberView({ deps, projectId, today, can, indicatorId, onClose }: KindViewProps) {
  const { t } = useI18n();
  const [data, setData] = useState<{ indicators: QuickIndicator[]; periods: QuickPeriod[] } | "missing" | "failed" | null>(null);
  const [simpleReview, setSimpleReview] = useState(false);

  const load = useCallback(async () => {
    setData(null);
    try {
      const [indicators, periods] = await Promise.all([deps.lookup.indicators(projectId), deps.lookup.periods(projectId)]);
      setData(indicators === null || periods === null ? "missing" : { indicators: indicators.map(toQuickIndicator), periods: periods.map(toQuickPeriod) });
    } catch { setData("failed"); }
  }, [deps.lookup, projectId]);

  useEffect(() => {
    void load();
    if (deps.online) void deps.facts.simpleReview(projectId).then(setSimpleReview);
  }, [load, deps.online, deps.facts, projectId]);

  if (data === null) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.sheet.loading")}</p>;
  if (data === "missing") return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.value.notOnPhone")}</p>;
  if (data === "failed") {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-slate-700 dark:text-slate-200">{t("record.sheet.loadFailed")}</p>
        <button type="button" className="btn-secondary min-h-[48px]" onClick={() => { deps.lookup.refresh(projectId); void load(); }}>{t("record.sheet.tryAgain")}</button>
      </div>
    );
  }
  return (
    <ValueForm
      key={`${projectId}:${data.periods.length}`}
      projectId={projectId}
      indicators={data.indicators}
      periods={data.periods}
      today={today}
      sink={deps.valueSink}
      periodOpener={deps.periods}
      simpleReview={simpleReview}
      canOpenPeriod={can("project.edit")}
      initialIndicatorId={indicatorId}
      onPeriodsChanged={() => { deps.lookup.refresh(projectId); void load(); }}
      onDone={onClose}
    />
  );
}
