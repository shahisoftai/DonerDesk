"use client";

import { summarise } from "@/features/offline/domain/outbox";
import { useOutbox } from "@/features/offline/presentation/OutboxProvider";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";

/**
 * One calm line about the connection (Phase 44): no signal is NOT an error, so it is neutral and reassuring, never red; when the
 * connection is back and records are being sent it says so. Nothing at all when there is nothing to say.
 */
export function SyncNote() {
  const { t } = useI18n();
  const { supported, entries, online } = useOutbox();
  const { waiting } = summarise(entries);
  if (online && waiting === 0) return null;
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-800 dark:border-white/15 dark:bg-white/5 dark:text-slate-100">
      <p className="font-bold">{online ? t("record.waiting.backOnline") : t("record.sync.OFFLINE_NOTE")}</p>
      {!online && supported && <p className="mt-1">{t("record.waiting.safe")}</p>}
    </div>
  );
}
