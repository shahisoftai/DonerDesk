"use client";

import { WaitingList } from "@/features/record/presentation/WaitingList";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import { summarise } from "../../domain/outbox";
import { useOutbox } from "../OutboxProvider";

/** What is saved on this phone and not sent yet, in plain words, with one reassurance sentence. */
export function WaitingScreen() {
  const { t } = useI18n();
  const { entries } = useOutbox();
  const { waiting, needsAttention } = summarise(entries);
  const nothing = waiting === 0 && needsAttention === 0 && entries.length === 0;
  return (
    <div>
      <h1 className="text-3xl font-bold">{t("fa.waiting.title")}</h1>
      <p className="mt-2 text-base text-slate-600 dark:text-slate-300">{t("fa.waiting.help")}</p>
      {nothing && <p className="mt-6 rounded-2xl bg-success-50 p-5 text-base font-medium text-success-900 dark:bg-success-500/15 dark:text-success-100">✓ {t("fa.waiting.empty")}</p>}
      <div className="mt-6"><WaitingList /></div>
    </div>
  );
}
