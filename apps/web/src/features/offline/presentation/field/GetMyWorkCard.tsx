"use client";

import { useState } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { GetWorkResult } from "./useFieldPacks";

/** The first thing a new person sees: one card, one button. It fetches every project they are on; there is nothing to choose. */
export function GetMyWorkCard({ busy, online, supported, onGet }: { busy: boolean; online: boolean; supported: boolean; onGet: () => Promise<GetWorkResult> }) {
  const { t } = useI18n();
  const [result, setResult] = useState<GetWorkResult | null>(null);
  const message = !supported ? t("fa.get.cannotKeep") : !online ? t("fa.get.needsSignal")
    : result === "NOTHING" ? t("fa.get.nothing") : result === "FAILED" ? t("fa.get.failed") : null;
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="mx-auto h-14 w-14 text-brand-600" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 19h14" /></svg>
      <h2 className="mt-3 text-2xl font-bold">{t("fa.get.title")}</h2>
      <p className="mt-2 text-base text-slate-600 dark:text-slate-300">{t("fa.get.body")}</p>
      <button type="button" disabled={busy || !online || !supported} onClick={() => void onGet().then(setResult)} className="btn-primary mt-5 flex min-h-[60px] w-full items-center justify-center rounded-2xl text-lg font-semibold disabled:opacity-60">
        {busy ? t("fa.get.working") : t("fa.get.button")}
      </button>
      {message && <p role="alert" className="mt-4 text-base font-medium text-warning-800 dark:text-warning-200">{message}</p>}
    </section>
  );
}
