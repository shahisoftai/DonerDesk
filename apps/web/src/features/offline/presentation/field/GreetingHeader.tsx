"use client";

import { Button } from "@/components/ui/Button";
import { LocaleSwitcher } from "@/features/i18n/presentation/LocaleSwitcher";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { firstName, partOfDay, type TodayView } from "../../domain/field-today";
import { dayLabel } from "./words";

const PILL = "inline-flex min-h-9 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold";

/**
 * The top of Today: a greeting by the hour with the person's first name, the date, one sentence about their day, and where their work
 * is (online or not, and whether anything is waiting to be sent). Everything the person needs to feel in control is in this one block.
 */
export function GreetingHeader({ name, today, now, view, online, waiting, attention, sending, onSendNow }: {
  name: string; today: string; now: Date; view: TodayView | null; online: boolean; waiting: number; attention: number; sending: boolean; onSendNow: () => void;
}) {
  const { t, locale } = useI18n();
  const part = partOfDay(now.getHours());
  const who = firstName(name);
  const greeting = who ? t(`fa.greet.${part}`, { name: who }) : t(`fa.greet.${part}.anon`);
  const s = view?.summary;
  const line = !s || (s.visits === 0 && !view?.next) ? t("fa.summary.none")
    : [s.visits > 0 ? t("fa.summary.visits", { count: s.visits }) : "", s.overdue > 0 ? t("fa.summary.late", { count: s.overdue }) : "", s.started > 0 ? t("fa.summary.started", { count: s.started }) : ""].filter(Boolean).join(" · ");

  return (
    <header className="rounded-3xl bg-brand-700 p-5 text-white shadow-md dark:bg-brand-800">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-white/85">{dayLabel(today, locale, true)}</p>
        <LocaleSwitcher className="inline-flex items-center gap-2 text-sm text-slate-900" />
      </div>
      <h1 className="mt-2 text-3xl font-bold leading-tight">{greeting}</h1>
      <p className="mt-1 text-base text-white/90">{line}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2" role="status" aria-live="polite">
        <span className={`${PILL} ${online ? "bg-white/15" : "bg-warning-500 text-white"}`}>
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${online ? "bg-success-400" : "bg-white"}`} />
          {online ? t("fa.status.online") : t("fa.status.offline")}
        </span>
        {waiting === 0 && attention === 0 ? (
          <span className={`${PILL} bg-white/15`}><span aria-hidden="true">✓</span>{t("fa.sync.allSent")}</span>
        ) : (
          <>
            {waiting > 0 && <span className={`${PILL} bg-white text-brand-900`}>{t("fa.sync.waiting", { count: waiting })}</span>}
            {attention > 0 && <span className={`${PILL} bg-warning-500 text-white`}>{t("fa.sync.attention", { count: attention })}</span>}
            {online && waiting > 0 && !sending && <Button size="touch" variant="secondary" onClick={onSendNow}>{t("fa.sync.sendNow")}</Button>}
          </>
        )}
      </div>
      {!online && <p className="mt-3 text-sm text-white/90">{t("fa.status.offline.help")}</p>}
    </header>
  );
}
