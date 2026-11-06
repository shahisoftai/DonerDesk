"use client";

import type { Advice } from "../domain/entry-advice";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

const TONE: Record<Advice["tone"], string> = {
  info: "border-brand-500/30 bg-brand-50/70 text-brand-900 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-100",
  attention: "border-warning-500/40 bg-warning-50/80 text-warning-900 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-100",
};

/**
 * The notes shown while someone types. They are read out politely (not as alerts) and never remove the Save button: a note that stops
 * a save is the one the server would refuse anyway, and the screen says so before the person has typed anything.
 */
export function AdviceList({ advice, hide = [] }: { advice: readonly Advice[]; /** Notes another part of the screen already explains (the missing-period card). */ hide?: readonly Advice["key"][] }) {
  const { t } = useI18n();
  const shown = advice.filter((a) => !hide.includes(a.key));
  if (shown.length === 0) return null;
  return (
    <ul role="status" aria-live="polite" className="space-y-2">
      {shown.map((a) => (
        <li key={a.key} className={`rounded-xl border px-3 py-2.5 text-sm leading-snug ${TONE[a.tone]}`}>
          {t(`record.advice.${a.key}`, a.params)}
        </li>
      ))}
    </ul>
  );
}
