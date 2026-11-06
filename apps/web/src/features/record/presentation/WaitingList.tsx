"use client";

import { useMemo } from "react";
import { useI18n } from "@/features/i18n/presentation/I18nProvider";
import type { OutboxEntry } from "@/features/offline/domain/outbox";
import { useOutbox } from "@/features/offline/presentation/OutboxProvider";
import { stateOfEntry, waitingOrder, type SyncTone } from "../domain/sync-words";
import { SyncNote } from "./SyncNote";

const TONE: Record<SyncTone, string> = {
  neutral: "bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-slate-100",
  progress: "bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-100",
  good: "bg-success-50 text-success-800 dark:bg-success-500/15 dark:text-success-200",
  attention: "bg-warning-50 text-warning-900 dark:bg-warning-500/15 dark:text-warning-100",
};

const KIND_KEYS = ["activity", "indicator-values", "collection-record", "plan-status", "progress-log"] as const;

/** How many photos a queued record carries: only an activity or a form answer holds files, and only their count is shown. */
function photoCount(entry: OutboxEntry): number {
  const files = (entry.payload as { files?: unknown } | null)?.files;
  return Array.isArray(files) ? files.length : 0;
}

/**
 * Everything saved on this phone and not yet sent, in plain words: waiting, sending, or needs you (with the server's reason and one
 * action). Records that need the person come first, then the one being sent, then the rest oldest first. Nothing here is red for
 * having no signal.
 */
export function WaitingList() {
  const { t } = useI18n();
  const { supported, entries, sending, retry, discard, sendNow, online } = useOutbox();
  // The outbox sends one at a time, oldest first, so while it is sending the oldest waiting record is the one in flight.
  const sendingId = useMemo(() => (sending ? [...entries].filter((e) => e.state === "waiting").sort((a, b) => a.createdAt - b.createdAt)[0]?.id ?? null : null), [entries, sending]);
  const ordered = waitingOrder(entries, sendingId);

  if (!supported) return <p className="text-sm text-slate-700 dark:text-slate-200">{t("record.waiting.unsupported")}</p>;
  return (
    <div className="space-y-3">
      <SyncNote />
      {ordered.length === 0 ? (
        <p className="py-8 text-center text-base text-slate-600 dark:text-slate-300">{t("record.waiting.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {ordered.map((e) => {
            const state = stateOfEntry(e, sendingId);
            const photos = photoCount(e);
            const kindKey = (KIND_KEYS as readonly string[]).includes(e.kind) ? (`record.waiting.kind.${e.kind}` as const) : "record.waiting.unknownKind";
            return (
              <li key={e.id} className={`rounded-2xl border p-4 ${state.key === "NEEDS_YOU" ? "border-warning-500/40 bg-warning-50/70 dark:bg-warning-500/10" : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/40"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold">{e.title || t("record.waiting.unknownKind")}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{t(kindKey)}{photos > 0 ? ` · ${t("record.waiting.photos", { count: photos })}` : ""}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${TONE[state.tone]}`}>{t(state.labelKey)}</span>
                </div>
                {state.key === "NEEDS_YOU" && (
                  <>
                    <p className="mt-2 text-sm leading-snug">{e.lastError ?? ""}</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" className="btn-primary min-h-11" onClick={() => void retry(e.id)}>{t("record.waiting.retry")}</button>
                      <button type="button" className="btn-secondary min-h-11" onClick={() => void discard(e.id)}>{t("record.waiting.delete")}</button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {online && ordered.some((e) => e.state === "waiting") && !sending && (
        <button type="button" className="btn-secondary min-h-[48px] w-full" onClick={() => void sendNow()}>{t("record.waiting.sendNow")}</button>
      )}
    </div>
  );
}
