"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SETUP_AREA_KEYS } from "@donordesk/contracts";
import { rerunSetupAreaAction } from "@/lib/actions/project-setup";
import type { SetupProposalView } from "@/lib/server/schemas-project-setup";
import { statedCount } from "../domain/review-state";
import { useSetupCopy } from "./useSetupCopy";

type AreaState = "WAITING" | "RUNNING" | "FINISHED" | "FAILED";

/** The latest extraction run of each area, as a word: waiting, reading, done or could not read. */
function areaStates(view: SetupProposalView): Record<string, { state: AreaState; reason?: string; partlyRead: boolean }> {
  const out: Record<string, { state: AreaState; reason?: string; partlyRead: boolean }> = {};
  for (const area of SETUP_AREA_KEYS) {
    const run = [...view.runs].reverse().find((r) => r.kind === "EXTRACT" && r.area === area);
    out[area] = !run
      ? { state: "WAITING", partlyRead: false }
      : { state: run.status === "FAILED" ? "FAILED" : run.status === "FINISHED" ? "FINISHED" : "RUNNING", ...(typeof run.detail.reason === "string" ? { reason: run.detail.reason } : {}), partlyRead: run.detail.partlyRead === true };
  }
  return out;
}

/** Step 2: live progress while the documents are read, then what was found, or what went wrong and what to do about it. */
export function ReadingSlide({ view, onNext, onBackToDocument }: { view: SetupProposalView | null; onNext: () => void; onBackToDocument: () => void }) {
  const { c, locale, n } = useSetupCopy();
  const r = c.reading;
  const router = useRouter();
  const status = view?.proposal.status ?? null;
  const [tip, setTip] = useState(0);
  const [again, startAgain] = useTransition();
  const [rereading, setRereading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  // A part that is being read again keeps the page updating, even though the document as a whole is ready.
  const anyRunning = view?.runs.some((x) => x.kind === "EXTRACT" && x.area !== undefined && x.status === "RUNNING") ?? false;
  const busy = status === "EXTRACTING" || anyRunning;
  useEffect(() => {
    if (!busy) return;
    const poll = setInterval(() => router.refresh(), 3_000);
    const rotate = setInterval(() => setTip((t) => (t + 1) % r.tips.length), 5_000);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    setNow(Date.now());
    return () => { clearInterval(poll); clearInterval(rotate); clearInterval(tick); };
  }, [busy, router, r.tips.length]);

  if (!view || status === null) return <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{r.addFirst}</p>;
  const states = areaStates(view);
  const finished = SETUP_AREA_KEYS.filter((a) => states[a]!.state === "FINISHED" || states[a]!.state === "FAILED").length;
  const percent = status === "EXTRACTING" ? Math.max(6, Math.round((finished / SETUP_AREA_KEYS.length) * 100)) : 100;

  function readAgain(area: string) {
    setMessage(null);
    setRereading(area);
    startAgain(async () => {
      // The server starts the reading and answers at once; the page then follows the part's own progress.
      const result = await rerunSetupAreaAction(view!.proposal.id, area);
      if (!result.ok) setMessage(result.error.message || c.common.unknownError);
      setRereading(null);
      router.refresh();
    });
  }

  if (status === "FAILED") {
    const reason = [...view.runs].reverse().find((x) => x.status === "FAILED" && typeof x.detail.reason === "string")?.detail.reason;
    return (
      <>
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-100">
          <p className="font-semibold">{r.failedTitle}</p>
          <p className="mt-1">{typeof reason === "string" ? reason : r.failedFallback}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {r.failedOptions.map((o) => (
            <li key={o.label} className="rounded-xl border border-brand-300/50 bg-brand-50 p-4 dark:border-brand-400/20 dark:bg-brand-400/5">
              <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">{o.label}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{o.text}</p>
            </li>
          ))}
        </ul>
        <button type="button" className="btn" onClick={onBackToDocument}><span aria-hidden="true" className="inline-block rtl:-scale-x-100">←</span> {r.addAgain}</button>
      </>
    );
  }

  const startedAt = Date.parse(view.proposal.createdAt);
  const seconds = now !== null && Number.isFinite(startedAt) ? Math.max(0, Math.round((now - startedAt) / 1000)) : null;
  const elapsedText = seconds === null ? null : r.elapsed(`${n(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, "0")}`);
  const usage = view.usage;
  const money = (usd: number) => new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-latn" : locale, { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(usd);
  return (
    <>
      <div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={r.progressLabel}>
          <div className="relative h-full rounded-full bg-gradient-to-r from-brand-400 to-accent-400 transition-all duration-700" style={{ width: `${percent}%` }}>
            {status === "EXTRACTING" ? <div className="setup-shimmer absolute inset-0 rounded-full" /> : null}
          </div>
        </div>
        <p role="status" className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          {status === "EXTRACTING" ? r.reading(n(finished), n(SETUP_AREA_KEYS.length)) : anyRunning ? r.readingAgain : r.doneTitle}
          {busy && elapsedText ? <span className="ms-2 font-normal text-slate-600 dark:text-slate-300">· {elapsedText}</span> : null}
        </p>
      </div>

      <ul aria-label={r.partsLabel} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SETUP_AREA_KEYS.map((area) => {
          const s = states[area]!;
          const found = s.state === "FINISHED" ? statedCount(view.proposal.proposal, view.areas.find((a) => a.area === area)?.fields ?? []) : null;
          const word = status === "EXTRACTING" && s.state === "WAITING" ? r.state.WAITING : s.state === "WAITING" ? r.state.NOT_READ : r.state[s.state];
          // A part that read only some of the document and found nothing is as unfinished as one that failed.
          const thin = s.state === "FINISHED" && s.partlyRead && found === 0;
          const canReadAgain = status === "READY" && (s.state === "FAILED" || s.state === "WAITING" || thin);
          return (
            <li key={area} className={`rounded-xl border p-3 transition ${thin ? "border-amber-400/60 bg-amber-50 dark:bg-amber-400/5" : s.state === "FINISHED" ? "border-green-400/40 bg-green-50 dark:bg-green-400/5" : s.state === "FAILED" ? "border-red-400/40 bg-red-50 dark:bg-red-400/5" : "border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900/50"}`}>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{c.areas[area].short}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">{word}{found !== null ? ` · ${r.found(found)}` : ""}</p>
              {s.partlyRead ? <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{thin ? r.partlyReadEmpty : r.partlyRead}</p> : null}
              {canReadAgain ? (
                <button type="button" className="btn-secondary mt-2 px-2 py-1 text-xs" disabled={again} onClick={() => readAgain(area)}>{rereading === area || s.state === "RUNNING" ? r.readingAgain : r.readAgain}</button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {anyRunning && status !== "EXTRACTING" ? <p className="text-xs text-slate-600 dark:text-slate-300">{r.stoppedHint}</p> : null}
      {message ? <p role="alert" className="text-sm text-red-700 dark:text-red-300">{message}</p> : null}
      {status === "EXTRACTING" ? (
        <p aria-live="off" className="rounded-lg bg-accent-300/20 px-4 py-3 text-sm text-slate-700 dark:bg-accent-500/10 dark:text-slate-200"><span className="font-semibold">{r.whileWait} </span>{r.tips[tip]}</p>
      ) : (
        <>
          {SETUP_AREA_KEYS.some((a) => states[a]!.state === "FAILED") && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100">
              <p className="font-semibold">{r.partial}</p>
              <ul className="mt-1 list-disc ps-5">{SETUP_AREA_KEYS.filter((a) => states[a]!.state === "FAILED").map((a) => <li key={a}>{c.areas[a].short}{states[a]!.reason ? `: ${states[a]!.reason}` : ""}</li>)}</ul>
              <p className="mt-1">{r.partialHelp}</p>
            </div>
          )}
          {usage.calls > 0 && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {r.usage(n(usage.calls), n(usage.inputTokens + usage.outputTokens))} {usage.costUsd !== null ? r.usageCost(money(usage.costUsd)) : r.usageUnpriced}
            </p>
          )}
          <div className="flex justify-center"><button type="button" className="btn px-8 py-3 text-base" onClick={onNext}>{r.next} <span aria-hidden="true" className="inline-block rtl:-scale-x-100">→</span></button></div>
        </>
      )}
    </>
  );
}
