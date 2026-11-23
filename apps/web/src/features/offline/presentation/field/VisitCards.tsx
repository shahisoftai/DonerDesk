"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { VisitTask, WorkTask } from "../../domain/field-today";
import { dayLabel, dueTone, dueWords } from "./words";

const BIG = "btn-primary flex min-h-[56px] w-full items-center justify-center rounded-2xl text-lg font-semibold";

/** The one thing to do next, as a large card with one large button. */
export function NextVisitCard({ visit, onStart }: { visit: VisitTask; onStart: () => void }) {
  const { t, locale } = useI18n();
  return (
    <section aria-label={t("fa.next.title")} className="rounded-3xl border-2 border-brand-600 bg-white p-5 shadow-md dark:bg-slate-900">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">{t("fa.next.title")}</p>
      <h2 className="mt-2 break-words text-2xl font-bold leading-snug">{visit.placeName}</h2>
      <p className="mt-1 break-words text-base text-slate-600 dark:text-slate-300">{visit.path}</p>
      <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">{visit.formName} · {visit.projectName}</p>
      <p className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-semibold ${dueTone(visit.due.kind)}`}>{dueWords(t, visit.due, visit.dueOn, locale)}</p>
      <button type="button" className={`${BIG} mt-4`} onClick={onStart}>{visit.started ? t("fa.visit.continue") : t("fa.visit.start")}</button>
    </section>
  );
}

export function NextWorkCard({ work, onRecord }: { work: WorkTask; onRecord: () => void }) {
  const { t, locale } = useI18n();
  return (
    <section aria-label={t("fa.next.title")} className="rounded-3xl border-2 border-brand-600 bg-white p-5 shadow-md dark:bg-slate-900">
      <p className="text-sm font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">{t("fa.next.title")}</p>
      <h2 className="mt-2 break-words text-2xl font-bold leading-snug">{work.title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{work.projectName}{work.location ? ` · ${work.location}` : ""}</p>
      <p className="mt-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">{t("fa.work.dates", { from: dayLabel(work.plannedStart, locale), to: dayLabel(work.plannedEnd, locale) })}</p>
      <button type="button" className={`${BIG} mt-4`} onClick={onRecord}>{t("fa.work.record")}</button>
    </section>
  );
}

export function CaughtUpCard() {
  const { t } = useI18n();
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
      <p aria-hidden="true" className="text-4xl">✓</p>
      <h2 className="mt-2 text-xl font-bold">{t("fa.next.nothing.title")}</h2>
      <p className="mt-1 text-slate-600 dark:text-slate-300">{t("fa.next.nothing.body")}</p>
    </section>
  );
}

/** A visit in a list: the whole row is the button. */
export function VisitRow({ visit, onStart }: { visit: VisitTask; onStart: () => void }) {
  const { t, locale } = useI18n();
  return (
    <button type="button" onClick={onStart} className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm active:bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      <span className="min-w-0">
        <span className="block break-words text-lg font-semibold">{visit.placeName}</span>
        <span className="block break-words text-sm text-slate-500 dark:text-slate-400">{visit.projectName}</span>
        <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${dueTone(visit.due.kind)}`}>{dueWords(t, visit.due, visit.dueOn, locale)}</span>
      </span>
      <span className="shrink-0 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white">{visit.started ? t("fa.visit.continue") : t("fa.visit.start")}</span>
    </button>
  );
}

/** A piece of planned work in a list. */
export function WorkRow({ work, onRecord }: { work: WorkTask; onRecord: () => void }) {
  const { t, locale } = useI18n();
  const tone = work.when === "OVERDUE" ? dueTone("OVERDUE") : work.when === "TODAY" ? dueTone("TODAY") : dueTone("NONE");
  const label = work.when === "OVERDUE" ? t("fa.work.late") : work.when === "TODAY" ? t("fa.work.today") : t("fa.work.week");
  return (
    <div className="flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <span className="min-w-0">
        <span className="block break-words text-base font-semibold">{work.title}</span>
        <span className="block break-words text-sm text-slate-500 dark:text-slate-400">{t("fa.work.dates", { from: dayLabel(work.plannedStart, locale), to: dayLabel(work.plannedEnd, locale) })}</span>
        <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>
      </span>
      <button type="button" onClick={onRecord} className="btn-secondary shrink-0 rounded-xl px-4 py-2 text-sm font-semibold">{t("fa.work.record")}</button>
    </div>
  );
}
