"use client";

import { useState } from "react";
import { choiceForDate, dateForChoice, type DayChoice } from "../domain/record-day";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { Input } from "@/components/ui/Input";

const chip = "inline-flex min-h-12 items-center rounded-full border px-5 text-base font-semibold transition";
const on = "border-brand-600 bg-brand-500/10 text-brand-800 dark:border-brand-400 dark:bg-brand-400/10 dark:text-brand-200";
const off = "border-slate-300 bg-white text-slate-800 hover:border-brand-400 dark:border-white/15 dark:bg-slate-900/40 dark:text-slate-100";

/** Today, Yesterday, or a day picked by hand. The chosen date is reported up; the box for a hand-picked day appears only when asked for. */
export function DayChips({ date, today, onChange, label }: { date: string; today: string; onChange: (date: string) => void; label?: string }) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(() => choiceForDate(date, today) === "pick");
  const choice: DayChoice = picking ? "pick" : choiceForDate(date, today);

  function choose(next: DayChoice) {
    setPicking(next === "pick");
    onChange(dateForChoice(next, today, date));
  }

  return (
    <fieldset className="space-y-2">
      <legend className="label">{label ?? t("record.day.label")}</legend>
      <div className="flex flex-wrap gap-2">
        {(["today", "yesterday", "pick"] as const).map((c) => (
          <button key={c} type="button" aria-pressed={choice === c} className={`${chip} ${choice === c ? on : off}`} onClick={() => choose(c)}>
            {t(`record.day.${c}`)}
          </button>
        ))}
      </div>
      {picking && <Input type="date" aria-label={t("record.day.pick")} value={date} onChange={(e) => onChange(e.target.value)} />}
    </fieldset>
  );
}
