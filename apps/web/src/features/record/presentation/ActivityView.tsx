"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NewActivityForm } from "@/features/activities/presentation/NewActivityForm";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { PackPeriod, PackPlanItem, PackPlace } from "@/features/offline/domain/offline-pack";
import { periodOptionLabel } from "@/lib/shared/option-labels";
import type { KindViewProps } from "./KindView";
import { ConfirmationScreen } from "./ConfirmationScreen";

type Loaded = { periods: PackPeriod[]; plan: PackPlanItem[]; places: PackPlace[] };

/**
 * "Something we did" inside the sheet: the same activity form as the activity page, fed from the project pack (so it works with no
 * signal), embedded, and confirming in place. `plannedActivityId` pre-fills it from the plan item the person came from.
 */
export function ActivityView({ deps, projectId, today, can, plannedActivityId, onClose, afterSave }: KindViewProps & { afterSave?: ((info: { title: string; queued: boolean }) => Promise<void> | void) | undefined }) {
  const { t } = useI18n();
  const [data, setData] = useState<Loaded | "missing" | "failed" | null>(null);
  const [saved, setSaved] = useState<{ title: string; queued: boolean } | null>(null);
  const [session, setSession] = useState(0);

  const load = useCallback(async () => {
    setData(null);
    try {
      const [periods, plan, places] = await Promise.all([deps.lookup.periods(projectId), deps.lookup.plan(projectId), deps.lookup.places(projectId)]);
      setData(periods === null ? "missing" : { periods, plan: plan ?? [], places });
    } catch { setData("failed"); }
  }, [deps.lookup, projectId]);
  useEffect(() => { void load(); }, [load]);

  const periods = useMemo(() => (data && typeof data === "object" ? data.periods.map((p) => ({ id: p.id, label: periodOptionLabel(p), reportType: p.reportType, startDate: p.startDate, endDate: p.endDate })) : []), [data]);
  const planned = useMemo(
    () => (data && typeof data === "object" ? data.plan.map((p) => ({ id: p.id, title: p.title, status: p.status as "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED", plannedStart: p.plannedStart, plannedEnd: p.plannedEnd, ...(p.location ? { location: p.location } : {}) })) : []),
    [data],
  );

  if (data === null) return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.sheet.loading")}</p>;
  if (data === "missing") return <p className="text-sm text-slate-600 dark:text-slate-300">{t("record.sheet.notOnPhone")}</p>;
  if (data === "failed") {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-slate-700 dark:text-slate-200">{t("record.sheet.loadFailed")}</p>
        <button type="button" className="btn-secondary min-h-[48px]" onClick={() => { deps.lookup.refresh(projectId); void load(); }}>{t("record.sheet.tryAgain")}</button>
      </div>
    );
  }
  if (saved) {
    return (
      <ConfirmationScreen
        queued={saved.queued}
        detail={saved.queued ? t("record.value.keptHint") : t("record.activity.savedDetail", { title: saved.title || "" })}
        anotherLabel={t("record.activity.another")}
        onAnother={() => { setSaved(null); setSession((n) => n + 1); }}
        onDone={onClose}
      />
    );
  }

  const chosen = plannedActivityId ? planned.find((p) => p.id === plannedActivityId) : undefined;
  return (
    <NewActivityForm
      key={session}
      embedded
      projectId={projectId}
      reportingPeriods={periods}
      evidenceOptions={[]}
      plannedActivities={planned}
      places={data.places.map((p) => p.name)}
      today={today}
      canOpenPeriod={can("project.edit")}
      onPeriodsChanged={() => { deps.lookup.refresh(projectId); void load(); }}
      onSaved={(info) => { setSaved(info); void afterSave?.(info); }}
      {...(chosen ? { initialPlannedActivityId: chosen.id } : {})}
    />
  );
}
