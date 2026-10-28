"use client";

import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAME, isLocale } from "../domain/locales";
import { useI18n } from "./I18nProvider";

/** Pick the interface language. Each language is named in itself. The choice is kept on this device. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  return (
    <label className={className ?? "inline-flex items-center gap-2 text-sm"}>
      <span className="sr-only sm:not-sr-only">{t("language.label")}</span>
      <select
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-slate-900"
        value={locale}
        onChange={(e) => { if (isLocale(e.target.value)) { setLocale(e.target.value); router.refresh(); } }}
      >
        {LOCALES.map((l) => <option key={l} value={l} lang={l}>{LOCALE_NAME[l]}</option>)}
      </select>
    </label>
  );
}
