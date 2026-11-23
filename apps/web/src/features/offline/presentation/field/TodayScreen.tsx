"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { OfflinePack } from "../../domain/offline-pack";
import type { TodayView, VisitTask, WorkTask } from "../../domain/field-today";
import { CaughtUpCard, NextVisitCard, NextWorkCard, VisitRow, WorkRow } from "./VisitCards";

const H2 = "mb-3 mt-8 text-xl font-bold";

/**
 * Today: the one thing to do next (large), the other visits given to the person, the planned work, and the forms nobody has given a
 * facility for. Everything is a large button; nothing needs reading twice.
 */
export function TodayScreen({ view, packs, onStartVisit, onRecord, onFillForm }: {
  view: TodayView; packs: OfflinePack[]; onStartVisit: (v: VisitTask) => void; onRecord: (w?: WorkTask) => void; onFillForm: (projectId: string, formId: string) => void;
}) {
  const { t } = useI18n();
  const next = view.next;
  const visits = view.visits.filter((v) => v !== next);
  const work = view.work.filter((w) => w !== next && w.when !== "LATER");
  // Forms that no visit was given for (a survey, or a facility form nobody assigned) are listed so nothing is hidden.
  const given = new Set(packs.flatMap((p) => (p.assignments ?? []).map((a) => `${p.projectId}:${a.formId}`)));
  const others = packs.flatMap((p) => p.forms.filter((f) => !given.has(`${p.projectId}:${f.id}`)).map((f) => ({ projectId: p.projectId, projectName: p.projectName, form: f })));

  return (
    <div>
      {next?.kind === "VISIT" ? <NextVisitCard visit={next} onStart={() => onStartVisit(next)} />
        : next?.kind === "WORK" ? <NextWorkCard work={next} onRecord={() => onRecord(next)} />
        : <CaughtUpCard />}

      {visits.length > 0 && (
        <section aria-labelledby="visits-h">
          <h2 id="visits-h" className={H2}>{t("fa.section.visits")}</h2>
          <ul className="space-y-3">{visits.map((v) => <li key={v.id}><VisitRow visit={v} onStart={() => onStartVisit(v)} /></li>)}</ul>
        </section>
      )}

      {work.length > 0 && (
        <section aria-labelledby="work-h">
          <h2 id="work-h" className={H2}>{t("fa.section.work")}</h2>
          <ul className="space-y-3">{work.map((w) => <li key={w.id}><WorkRow work={w} onRecord={() => onRecord(w)} /></li>)}</ul>
        </section>
      )}

      <section aria-labelledby="rec-h">
        <h2 id="rec-h" className={H2}>{t("fa.section.record")}</h2>
        <button type="button" onClick={() => onRecord()} className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50 p-4 text-start dark:bg-brand-400/10">
          <span><span className="block text-lg font-semibold">{t("record.kind.ACTIVITY")}</span><span className="block text-sm text-slate-600 dark:text-slate-300">{t("fa.record.hint")}</span></span>
          <span aria-hidden="true" className="text-3xl text-brand-600">＋</span>
        </button>
      </section>

      {others.length > 0 && (
        <section aria-labelledby="forms-h">
          <h2 id="forms-h" className={H2}>{t("fa.section.forms")}</h2>
          <ul className="space-y-3">
            {others.map((o) => (
              <li key={`${o.projectId}:${o.form.id}`}>
                <button type="button" onClick={() => onFillForm(o.projectId, o.form.id)} className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-start dark:border-slate-700 dark:bg-slate-900">
                  <span className="min-w-0"><span className="block break-words text-base font-semibold">{o.form.name}</span><span className="block text-sm text-slate-500">{o.projectName}</span></span>
                  <span className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{t("fa.forms.fill")}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
