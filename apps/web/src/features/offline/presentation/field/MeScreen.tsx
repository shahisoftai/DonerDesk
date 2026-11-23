"use client";

import { LocaleSwitcher } from "@/features/i18n/presentation/LocaleSwitcher";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { packAgeDays, type OfflinePack } from "../../domain/offline-pack";
import { firstName } from "../../domain/field-today";
import { dayLabel } from "./words";
import { plainDateOf } from "../../domain/field-today";

/** You: the projects on this phone and how fresh they are, one button to refresh, the language, the way to the online home page, and sign out with its warning. */
export function MeScreen({ name, packs, online, busy, refreshed, onRefresh, waiting }: {
  name: string; packs: OfflinePack[]; online: boolean; busy: boolean; refreshed: boolean; onRefresh: () => void; waiting: number;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{firstName(name) || t("fa.me.title")}</h1>

      <section aria-labelledby="proj-h">
        <h2 id="proj-h" className="mb-3 text-xl font-bold">{t("fa.me.projects")}</h2>
        <ul className="space-y-3">
          {packs.map((p) => (
            <li key={p.projectId} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="break-words text-lg font-semibold">{p.projectName}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">✓ {t("fa.me.ready")} · {packAgeDays(p, Date.now()) === 0 ? t("fa.me.updatedToday") : t("fa.me.updatedOn", { date: dayLabel(plainDateOf(new Date(p.generatedAt)), locale) })}</p>
            </li>
          ))}
        </ul>
        <button type="button" disabled={!online || busy} onClick={onRefresh} className="btn-secondary mt-4 flex min-h-[56px] w-full items-center justify-center rounded-2xl text-lg font-semibold disabled:opacity-60">{busy ? t("fa.me.refreshing") : t("fa.me.refresh")}</button>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{refreshed ? `✓ ${t("fa.me.refreshed")}` : online ? t("fa.me.refreshHelp") : t("fa.get.needsSignal")}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <p className="mb-2 text-base font-semibold">{t("fa.me.language")}</p>
        <LocaleSwitcher className="block [&>span]:sr-only [&_select]:min-h-12 [&_select]:w-full [&_select]:text-base" />
      </section>

      {/* A plain anchor: only a document navigation reaches the online pages. */}
      <a href="/dashboard?stay=1" className="btn-secondary flex min-h-[56px] w-full items-center justify-center rounded-2xl text-lg font-semibold">{t("fa.me.home")}</a>

      <section className="rounded-2xl bg-warning-50 p-4 dark:bg-warning-500/10">
        <p className="text-base text-warning-900 dark:text-warning-100">{waiting > 0 ? `${t("fa.sync.waiting", { count: waiting })}. ` : ""}{t("fa.me.signOutWarn")}</p>
        <a href="/logout" className="btn-danger mt-3 flex min-h-[56px] w-full items-center justify-center rounded-2xl text-lg font-semibold">{t("fa.me.signOut")}</a>
      </section>
    </div>
  );
}
