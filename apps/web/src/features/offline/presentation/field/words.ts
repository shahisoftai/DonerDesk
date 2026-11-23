import type { Due } from "../../domain/field-today";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** A plain day (`2026-11-28`) in the person's language: "Fri, 28 Nov". Noon avoids a time-zone edge moving the day. */
export function dayLabel(plain: string, locale: string, long = false): string {
  const at = new Date(`${plain}T12:00:00`);
  if (Number.isNaN(at.getTime())) return plain;
  return new Intl.DateTimeFormat(locale, long ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric", month: "short" }).format(at);
}

/** When a visit is due, in words: a date, never "N days late" (a date is clearer and needs no plural). */
export function dueWords(t: Translate, due: Due, dueOn: string | undefined, locale: string): string {
  switch (due.kind) {
    case "OVERDUE": return t("fa.due.late", { date: dayLabel(dueOn ?? "", locale) });
    case "TODAY": return t("fa.due.today");
    case "TOMORROW": return t("fa.due.tomorrow");
    case "SOON":
    case "LATER": return t("fa.due.on", { date: dayLabel(dueOn ?? "", locale) });
    case "NONE": return t("fa.due.none");
  }
}

/** Colour classes for a due state: late is warm, today is brand, the rest are calm. Colour is never the only signal (the words say it too). */
export function dueTone(kind: Due["kind"]): string {
  return kind === "OVERDUE" ? "bg-warning-50 text-warning-900 dark:bg-warning-500/15 dark:text-warning-100"
    : kind === "TODAY" ? "bg-brand-100 text-brand-900 dark:bg-brand-400/15 dark:text-brand-100"
    : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200";
}
