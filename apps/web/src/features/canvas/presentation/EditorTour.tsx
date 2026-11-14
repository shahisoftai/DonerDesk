"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { TOUR_STEPS, TOUR_STORAGE_KEY, nextTourStep, previousTourStep, tourSeen, type TourStep } from "../domain/tour";

/**
 * Five short steps the first time someone edits a canvas on this device. It is a card, not a lock: nothing is dimmed or blocked, Escape or
 * Skip closes it, and finishing or skipping is remembered so it never returns. Where the browser keeps nothing it does not show at all.
 */
export function EditorTour() {
  const { t } = useI18n();
  const [step, setStep] = useState<TourStep | null>(null);

  useEffect(() => {
    let show = false;
    try { show = !tourSeen(() => window.localStorage.getItem(TOUR_STORAGE_KEY)); } catch { show = false; }
    if (show) setStep(TOUR_STEPS[0]);
  }, []);

  const finish = () => { try { window.localStorage.setItem(TOUR_STORAGE_KEY, "done"); } catch { /* nothing to remember where storage is off */ } setStep(null); };

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  if (!step) return null;
  const next = nextTourStep(step);
  const back = previousTourStep(step);
  const btn = "rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800";
  return (
    <aside role="dialog" aria-label={t("canvas.tour.label")} className="fixed bottom-4 end-4 z-40 w-80 rounded-lg border border-slate-300 bg-white p-4 text-sm shadow-xl dark:border-slate-600 dark:bg-slate-900" data-testid="editor-tour">
      <p className="text-xs text-slate-500">{TOUR_STEPS.indexOf(step) + 1} / {TOUR_STEPS.length}</p>
      <h2 className="mt-1 text-base font-semibold">{t(`canvas.tour.${step}.title` as never)}</h2>
      <p className="mt-1 text-slate-600 dark:text-slate-300">{t(`canvas.tour.${step}.body` as never)}</p>
      <div className="mt-3 flex items-center gap-2">
        {back && <button type="button" className={btn} onClick={() => setStep(back)}>{t("canvas.tour.back")}</button>}
        {next ? <button type="button" className={`${btn} bg-brand-700 text-white hover:bg-brand-800 dark:hover:bg-brand-800`} onClick={() => setStep(next)}>{t("canvas.tour.next")}</button> : <button type="button" className={`${btn} bg-brand-700 text-white hover:bg-brand-800 dark:hover:bg-brand-800`} onClick={finish}>{t("canvas.tour.done")}</button>}
        <button type="button" className="ms-auto text-xs underline" onClick={finish}>{t("canvas.tour.skip")}</button>
      </div>
    </aside>
  );
}
