"use client";

import { useI18n } from "@/features/i18n/presentation/I18nProvider";

export type FieldTab = "today" | "week" | "waiting" | "me";

const ICON: Record<FieldTab, string> = {
  today: "M4 11 12 4l8 7v9h-5v-6H9v6H4z",
  week: "M7 3v3m10-3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
  waiting: "M4 14v5h16v-5M12 4v10m0 0-4-4m4 4 4-4",
  me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0",
};

/** Four large tabs at the bottom, always the same four, with a number on Waiting when something is saved and not sent. */
export function FieldTabBar({ tab, onTab, waiting }: { tab: FieldTab; onTab: (t: FieldTab) => void; waiting: number }) {
  const { t } = useI18n();
  const tabs: Array<[FieldTab, string]> = [["today", t("fa.tab.today")], ["week", t("fa.tab.week")], ["waiting", t("fa.tab.waiting")], ["me", t("fa.tab.me")]];
  return (
    <nav aria-label="Field app" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-white/10 dark:bg-slate-900">
      <ul className="mx-auto flex max-w-xl">
        {tabs.map(([key, label]) => {
          const on = key === tab;
          return (
            <li key={key} className="flex-1">
              <button type="button" aria-current={on ? "page" : undefined} onClick={() => onTab(key)} className={`relative flex min-h-[68px] w-full flex-col items-center justify-center gap-1 text-sm font-semibold ${on ? "text-brand-700 dark:text-brand-300" : "text-slate-600 dark:text-slate-300"}`}>
                {on && <span aria-hidden="true" className="absolute inset-x-6 top-0 h-1 rounded-b bg-brand-600" />}
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d={ICON[key]} /></svg>
                {label}
                {key === "waiting" && waiting > 0 && <span className="absolute end-[22%] top-2 grid min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold leading-5 text-white">{waiting}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
