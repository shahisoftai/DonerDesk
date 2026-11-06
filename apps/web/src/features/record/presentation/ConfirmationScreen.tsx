"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/**
 * "Saved" or "Kept on this phone": one confirmation for every kind of record, with Record another and Done. It says nothing about
 * review: what a manager does next is not the field worker's business. The two outcomes differ in icon and words, never in alarm.
 */
export function ConfirmationScreen({
  queued, headline, detail, notices = [], onAnother, anotherLabel, onDone, extra,
}: {
  queued: boolean;
  headline?: string;
  detail: string;
  notices?: readonly string[];
  onAnother: () => void;
  anotherLabel: string;
  onDone: () => void;
  extra?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div role="status" className="flex flex-col items-center px-2 py-6 text-center">
      <div className={`grid h-24 w-24 place-items-center rounded-full ${queued ? "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200" : "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-300"}`} aria-hidden="true">
        {queued ? (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="m9.8 12.3 1.7 1.7 3-3.6" /></svg>
        ) : (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        )}
      </div>
      <h2 className="mt-5 text-2xl font-bold">{headline ?? (queued ? t("record.value.keptOnPhone") : t("record.value.saved"))}</h2>
      <p className="mt-2 max-w-xs text-base text-slate-700 dark:text-slate-300">{detail}</p>
      {notices.map((n) => <p key={n} className="mt-2 max-w-xs text-sm text-slate-600 dark:text-slate-400">{n}</p>)}
      {extra}
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button type="button" className="btn-primary min-h-[52px] text-base" onClick={onAnother}>{anotherLabel}</button>
        <button type="button" className="btn-secondary min-h-[52px] text-base" onClick={onDone}>{t("record.value.done")}</button>
      </div>
    </div>
  );
}
