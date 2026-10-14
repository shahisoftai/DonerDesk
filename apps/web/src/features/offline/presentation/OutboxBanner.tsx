"use client";

import { Button } from "@/components/ui/Button";
import { summarise } from "../domain/outbox";
import { useOutbox } from "./OutboxProvider";

/** Tells the person, in plain words, what is saved on this device and what is happening to it. Shows nothing when all is sent. */
export function OutboxBanner() {
  const { supported, entries, online, sending, sendNow, retry, discard } = useOutbox();
  if (!supported) return null;
  const { waiting, needsAttention } = summarise(entries);
  if (waiting === 0 && needsAttention === 0 && online) return null;

  const stuck = entries.filter((e) => e.state === "needs-attention");
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <p className="text-slate-800 dark:text-slate-100">
          {!online && waiting === 0 && needsAttention === 0
            ? "You're offline. What you finish now is saved on this device and sent when you're back online."
            : waiting > 0
              ? `${waiting} ${waiting === 1 ? "record is" : "records are"} saved on this device${online ? (sending ? ", sending now…" : " and waiting to send.") : " and will be sent when you're back online."}`
              : null}
          {needsAttention > 0 && ` ${needsAttention} need${needsAttention === 1 ? "s" : ""} your attention.`}
        </p>
        {online && waiting > 0 && !sending && (
          <Button size="sm" variant="secondary" onClick={() => void sendNow()}>Send now</Button>
        )}
      </div>
      {stuck.length > 0 && (
        <ul className="mx-auto mt-2 max-w-3xl space-y-2">
          {stuck.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-warning-200 bg-warning-50 p-2 text-xs dark:border-warning-500/30 dark:bg-warning-500/10">
              <span className="min-w-0 flex-1">
                <strong className="font-medium">{e.title || "Saved record"}</strong>: {e.lastError ?? "It could not be sent."}
              </span>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => void retry(e.id)}>Try again</Button>
                <Button size="sm" variant="ghost" onClick={() => void discard(e.id)}>Discard</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
